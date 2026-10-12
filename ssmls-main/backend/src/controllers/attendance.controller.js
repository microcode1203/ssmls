// @v3-personal-qr-badges
const QRCode = require('qrcode');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

// ── Personal student QR badge ────────────────────────────────────────────────
// Every registered student automatically has a permanent, signed QR code
// derived from their student id — nothing needs to be generated or stored at
// registration time, it's just computed on demand. The teacher scans this
// badge (instead of students scanning a projected/rotating code), which is
// faster for a full class and works offline-first once the camera is open.
const STUDENT_QR_PREFIX = 'STU';

const generateStudentToken = (studentId) => {
  const secret = process.env.QR_SECRET || 'default_qr_secret';
  const payload = `${STUDENT_QR_PREFIX}|${studentId}`;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 12).toUpperCase();
  return `${payload}|${hash}`;
};

const validateStudentToken = (token) => {
  try {
    const secret = process.env.QR_SECRET || 'default_qr_secret';
    const parts = String(token).trim().split('|');
    if (parts.length !== 3 || parts[0] !== STUDENT_QR_PREFIX) return { valid: false, studentId: null, reason: 'Not a valid student badge.' };
    const [, studentId, providedHash] = parts;
    if (!/^\d+$/.test(studentId)) return { valid: false, studentId: null, reason: 'Malformed student badge.' };
    const expectedHash = crypto.createHmac('sha256', secret)
      .update(`${STUDENT_QR_PREFIX}|${studentId}`).digest('hex').substring(0, 12).toUpperCase();
    if (expectedHash !== providedHash) return { valid: false, studentId: null, reason: 'Invalid or tampered badge.' };
    return { valid: true, studentId: parseInt(studentId, 10) };
  } catch {
    return { valid: false, studentId: null, reason: 'Malformed student badge.' };
  }
};

const buildQrImage = (token) => QRCode.toDataURL(token, {
  width: 320, margin: 2,
  color: { dark: '#111827', light: '#ffffff' },
  errorCorrectionLevel: 'H'
});

// GET /api/attendance/my-qr  (student — their own permanent badge)
const getMyQR = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.lrn, u.first_name, u.middle_name, u.last_name, sec.section_name, sec.grade_level
       FROM students s JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(403).json({ success: false, message: 'Student profile not found.' });

    const student = rows[0];
    const token = generateStudentToken(student.id);
    const qrImage = await buildQrImage(token);

    res.json({
      success: true,
      data: {
        token, qrImage,
        student: {
          lrn: student.lrn,
          firstName: student.first_name,
          middleName: student.middle_name,
          lastName: student.last_name,
          sectionName: student.section_name,
          gradeLevel: student.grade_level,
        }
      }
    });
  } catch (err) {
    console.error('getMyQR error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate QR code.' });
  }
};

// GET /api/attendance/qr/:studentId  (admin/teacher — e.g. to print ID badges)
const getStudentQR = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { rows } = await pool.query(
      `SELECT s.id, s.lrn, u.first_name, u.middle_name, u.last_name, sec.section_name, sec.grade_level
       FROM students s JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`,
      [studentId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    const student = rows[0];
    const token = generateStudentToken(student.id);
    const qrImage = await buildQrImage(token);
    res.json({ success: true, data: { token, qrImage, student } });
  } catch (err) {
    console.error('getStudentQR error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate QR code.' });
  }
};

// POST /api/attendance/start-session  (teacher — opens today's class for scanning)
const startSession = async (req, res) => {
  try {
    const { scheduleId } = req.body;
    if (!scheduleId) return res.status(400).json({ success: false, message: 'scheduleId is required.' });

    const { rows } = await pool.query(
      `SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       WHERE s.id = $1 AND t.user_id = $2`,
      [scheduleId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ success: false, message: 'Schedule not found or unauthorized.' });

    const schedule = rows[0];
    const today = new Date().toISOString().slice(0, 10);

    const { rows: classRows } = await pool.query(
      `SELECT id FROM classes WHERE schedule_id = $1 AND class_date = $2`, [scheduleId, today]
    );

    let classId;
    if (!classRows.length) {
      const { rows: ins } = await pool.query(
        `INSERT INTO classes (schedule_id, class_date, attendance_open) VALUES ($1, $2, TRUE) RETURNING id`,
        [scheduleId, today]
      );
      classId = ins[0].id;
    } else {
      classId = classRows[0].id;
      await pool.query(`UPDATE classes SET attendance_open = TRUE WHERE id = $1`, [classId]);
    }

    await logAction(req.user.id, 'START_ATTENDANCE_SESSION', 'classes', classId, { scheduleId }, req.ip);

    res.json({
      success: true,
      data: {
        classId,
        scheduleInfo: {
          subjectName: schedule.subject_name,
          sectionName: schedule.section_name,
          gradeLevel: schedule.grade_level,
          room: schedule.room,
          day: schedule.day_of_week,
          sectionId: schedule.section_id,
        }
      }
    });
  } catch (err) {
    console.error('Start session error:', err);
    res.status(500).json({ success: false, message: 'Failed to start attendance session.' });
  }
};

// POST /api/attendance/scan-student  (teacher — scans a student's personal QR badge)
const scanStudentQR = async (req, res) => {
  try {
    const { token, classId } = req.body;
    if (!token || !classId) return res.status(400).json({ success: false, message: 'token and classId are required.' });

    const { valid, studentId, reason } = validateStudentToken(token);
    if (!valid) return res.status(400).json({ success: false, message: reason || 'Invalid student badge.' });

    // Confirm this teacher owns the class/session being scanned into
    const { rows: classRows } = await pool.query(
      `SELECT c.*, s.section_id as sched_section_id, s.start_time
       FROM classes c
       JOIN schedules s ON s.id = c.schedule_id
       JOIN teachers t ON t.id = s.teacher_id
       WHERE c.id = $1 AND t.user_id = $2`,
      [classId, req.user.id]
    );
    if (!classRows.length) return res.status(403).json({ success: false, message: 'Class session not found or unauthorized.' });

    const cls = classRows[0];
    if (!cls.attendance_open) return res.status(400).json({ success: false, message: 'This attendance session has been closed.' });

    const { rows: studentRows } = await pool.query(
      `SELECT s.id, s.section_id, s.status, u.first_name, u.middle_name, u.last_name, s.lrn
       FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [studentId]
    );
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    const student = studentRows[0];
    if (student.status !== 'active')
      return res.status(403).json({ success: false, message: `${student.first_name} ${student.last_name}'s account is not active.` });
    if (student.section_id !== cls.sched_section_id)
      return res.status(403).json({ success: false, message: `${student.first_name} ${student.last_name} is not enrolled in this class section.` });

    const { rows: existing } = await pool.query(
      `SELECT id, status FROM attendance WHERE class_id = $1 AND student_id = $2`, [classId, student.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${student.first_name} ${student.last_name} was already scanned (${existing[0].status}).`,
        data: { alreadyScanned: true, status: existing[0].status, student }
      });
    }

    const now = new Date();
    const [hours, minutes] = cls.start_time.split(':').map(Number);
    const classStart = new Date(now);
    classStart.setHours(hours, minutes + 15, 0, 0);
    const status = now > classStart ? 'late' : 'present';

    await pool.query(
      `INSERT INTO attendance (class_id, student_id, status, time_in, scanned_via) VALUES ($1, $2, $3, NOW(), 'qr')`,
      [classId, student.id, status]
    );

    await logAction(req.user.id, 'SCAN_STUDENT_BADGE', 'attendance', classId, { studentId: student.id, status }, req.ip);
    res.json({
      success: true,
      message: status === 'late'
        ? `⚠️ ${student.first_name} ${student.last_name} — marked Late`
        : `✅ ${student.first_name} ${student.last_name} — Present`,
      data: { status, timeIn: now.toISOString(), classId, student }
    });
  } catch (err) {
    console.error('Scan student QR error:', err);
    res.status(500).json({ success: false, message: 'Failed to record attendance.' });
  }
};

// GET /api/attendance/class/:classId
const getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { rows } = await pool.query(
      `SELECT a.*, u.first_name, u.middle_name, u.last_name, s.lrn
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       WHERE a.class_id = $1 ORDER BY a.time_in ASC`,
      [classId]
    );

    const { rows: summary } = await pool.query(
      `SELECT COUNT(*) as total,
         COUNT(*) FILTER (WHERE status='present') as present,
         COUNT(*) FILTER (WHERE status='late') as late,
         COUNT(*) FILTER (WHERE status='absent') as absent
       FROM attendance WHERE class_id = $1`,
      [classId]
    );

    res.json({ success: true, data: { records: rows, summary: summary[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/attendance/student/:studentId
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { scheduleId } = req.query;
    const params = [studentId];
    let extra = '';
    if (scheduleId) { params.push(scheduleId); extra = ` AND c.schedule_id = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT a.*, c.class_date, sub.name as subject_name, sec.section_name
       FROM attendance a
       JOIN classes c ON c.id = a.class_id
       JOIN schedules s ON s.id = c.schedule_id
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE a.student_id = $1 ${extra}
       ORDER BY c.class_date DESC LIMIT 100`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/attendance/close/:classId
const closeAttendance = async (req, res) => {
  try {
    const { classId } = req.params;

    const { rows: classRows } = await pool.query(
      `SELECT c.id, c.schedule_id, c.class_date, s.section_id
       FROM classes c JOIN schedules s ON s.id = c.schedule_id WHERE c.id = $1`,
      [classId]
    );
    if (!classRows.length) return res.status(404).json({ success: false, message: 'Class not found.' });

    const cls = classRows[0];

    const { rows: allStudents } = await pool.query(
      `SELECT s.id as student_id FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.section_id = $1 AND s.status = 'active' AND u.is_active = TRUE`,
      [cls.section_id]
    );

    const { rows: scanned } = await pool.query(
      `SELECT student_id FROM attendance WHERE class_id = $1`, [classId]
    );
    const scannedIds = new Set(scanned.map(r => r.student_id));

    let markedAbsent = 0;
    for (const stu of allStudents) {
      if (!scannedIds.has(stu.student_id)) {
        await pool.query(
          `INSERT INTO attendance (class_id, student_id, status, scanned_via) VALUES ($1, $2, 'absent', 'auto')`,
          [classId, stu.student_id]
        );
        markedAbsent++;
      }
    }

    await pool.query(`UPDATE classes SET attendance_open = FALSE WHERE id = $1`, [classId]);

    // Threshold alerts
    try {
      let threshold = 3;
      try {
        const { rows: cfg } = await pool.query(
          `SELECT config_value FROM school_config WHERE config_key = 'attendance_threshold'`
        );
        threshold = parseInt(cfg[0]?.config_value || '3');
      } catch (_) {}

      for (const stu of allStudents) {
        if (scannedIds.has(stu.student_id)) continue;

        const { rows: absCnt } = await pool.query(
          `SELECT COUNT(*) as cnt FROM attendance a
           JOIN classes c ON c.id = a.class_id
           WHERE a.student_id = $1 AND a.status = 'absent' AND c.schedule_id = $2`,
          [stu.student_id, cls.schedule_id]
        );
        const totalAbsences = Number(absCnt[0].cnt);

        if (totalAbsences === threshold) {
          const { rows: stuInfo } = await pool.query(
            `SELECT u.first_name, u.last_name, sub.name as subject_name
             FROM students st JOIN users u ON u.id = st.user_id
             JOIN schedules sc ON sc.id = $1
             JOIN subjects sub ON sub.id = sc.subject_id
             WHERE st.id = $2`,
            [cls.schedule_id, stu.student_id]
          );
          if (!stuInfo.length) continue;

          const { first_name, last_name, subject_name } = stuInfo[0];
          const title = `⚠️ Absence Alert: ${first_name} ${last_name}`;
          const body  = `${first_name} ${last_name} has reached ${totalAbsences} absences in ${subject_name}.`;

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT t.user_id, 'alert', $1, $2
             FROM schedules sc JOIN teachers t ON t.id = sc.teacher_id
             WHERE sc.id = $3 LIMIT 1`,
            [title, body, cls.schedule_id]
          ).catch(() => {});

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT u.id, 'alert', $1, $2 FROM users u WHERE u.role = 'admin' AND u.is_active = TRUE`,
            [title, body]
          ).catch(() => {});
        }
      }
    } catch (alertErr) {
      console.warn('Threshold alert warning:', alertErr.message);
    }

    res.json({ success: true, message: `Session closed. ${markedAbsent} student(s) marked absent.`, markedAbsent });
  } catch (err) {
    console.error('Close attendance error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMyQR, getStudentQR, startSession, scanStudentQR,
  getClassAttendance, getStudentAttendance, closeAttendance
};
