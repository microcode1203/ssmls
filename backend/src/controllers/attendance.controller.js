// @v2-fixed-imports
const QRCode = require('qrcode');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

// Generate a secure time-limited QR token
const generateQRToken = (classId) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.QR_SECRET || 'default_qr_secret';
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${classId}|${timestamp}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  return { token: `${classId}|${timestamp}|${hash}`, timestamp };
};

// Validate a QR token (must be < 60 seconds old)
const validateQRToken = (token) => {
  try {
    const secret = process.env.QR_SECRET || 'default_qr_secret';
    const parts = token.split('|');
    if (parts.length !== 3) return { valid: false, classId: null };

    const [classId, timestamp, providedHash] = parts;
    const now = Math.floor(Date.now() / 1000);

    if (now - parseInt(timestamp) > 60) return { valid: false, classId: null, reason: 'QR code expired' };

    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`${classId}|${timestamp}`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();

    if (expectedHash !== providedHash) return { valid: false, classId: null, reason: 'Invalid QR code' };
    return { valid: true, classId: parseInt(classId) };
  } catch {
    return { valid: false, classId: null, reason: 'Malformed QR token' };
  }
};

// POST /api/attendance/generate-qr  (teacher only)
const generateQR = async (req, res) => {
  try {
    const { scheduleId } = req.body;
    if (!scheduleId)
      return res.status(400).json({ success: false, message: 'scheduleId is required.' });

    // Verify teacher owns this schedule
    const [rows] = await pool.execute(
      `SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       WHERE s.id = ? AND t.user_id = ?`,
      [scheduleId, req.user.id]
    );
    if (rows.length === 0)
      return res.status(403).json({ success: false, message: 'Schedule not found or unauthorized.' });

    const schedule = rows[0];
    const today = new Date().toISOString().slice(0, 10);

    // Create or get today's class record
    let [classRows] = await pool.execute(
      `SELECT id FROM classes WHERE schedule_id = ? AND class_date = ?`,
      [scheduleId, today]
    );

    let classId;
    if (classRows.length === 0) {
      const [ins] = await pool.execute(
        `INSERT INTO classes (schedule_id, class_date, attendance_open) VALUES (?, ?, 1)`,
        [scheduleId, today]
      );
      classId = ins.insertId;
    } else {
      classId = classRows[0].id;
      await pool.execute(`UPDATE classes SET attendance_open = 1 WHERE id = ?`, [classId]);
    }

    // Generate QR token
    const { token } = generateQRToken(classId);
    const expiresAt = new Date(Date.now() + 60000);
    await pool.execute(
      `UPDATE classes SET qr_token = ?, qr_expires_at = ? WHERE id = ?`,
      [token, expiresAt, classId]
    );

    // Generate QR image (base64 PNG)
    const qrImageBase64 = await QRCode.toDataURL(token, {
      width: 300, margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    });

    await logAction(req.user.id, 'GENERATE_QR', 'classes', classId, { scheduleId }, req.ip);

    res.json({
      success: true,
      data: {
        classId,
        token,
        qrImage: qrImageBase64,
        expiresAt,
        expiresInSeconds: 60,
        scheduleInfo: {
          subjectName: schedule.subject_name,
          sectionName: schedule.section_name,
          gradeLevel: schedule.grade_level,
          room: schedule.room,
          day: schedule.day_of_week,
        }
      }
    });
  } catch (err) {
    console.error('Generate QR error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate QR code.' });
  }
};

// POST /api/attendance/scan  (student only)
const scanQR = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({ success: false, message: 'QR token is required.' });

    // Validate token
    const { valid, classId, reason } = validateQRToken(token);
    if (!valid)
      return res.status(400).json({ success: false, message: reason || 'Invalid or expired QR code.' });

    // Get student profile
    const [studentRows] = await pool.execute(
      `SELECT s.id, s.section_id FROM students s WHERE s.user_id = ?`,
      [req.user.id]
    );
    if (studentRows.length === 0)
      return res.status(403).json({ success: false, message: 'Student profile not found.' });

    const student = studentRows[0];

    // Verify class exists and is open
    const [classRows] = await pool.execute(
      `SELECT c.*, s.section_id as sched_section_id, s.start_time
       FROM classes c
       JOIN schedules s ON s.id = c.schedule_id
       WHERE c.id = ? AND c.attendance_open = 1`,
      [classId]
    );
    if (classRows.length === 0)
      return res.status(400).json({ success: false, message: 'Attendance is not open for this class.' });

    const cls = classRows[0];

    // Verify student belongs to this section
    if (student.section_id !== cls.sched_section_id)
      return res.status(403).json({ success: false, message: 'You are not enrolled in this class section.' });

    // Prevent duplicate scan
    const [existing] = await pool.execute(
      `SELECT id, status FROM attendance WHERE class_id = ? AND student_id = ?`,
      [classId, student.id]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Attendance already recorded for this class.' });

    // Determine if late (> 15 min after start)
    const now = new Date();
    const [hours, minutes] = cls.start_time.split(':').map(Number);
    const classStart = new Date(now);
    classStart.setHours(hours, minutes + 15, 0, 0);
    const status = now > classStart ? 'late' : 'present';

    await pool.execute(
      `INSERT INTO attendance (class_id, student_id, status, time_in, scanned_via) VALUES (?, ?, ?, NOW(), 'qr')`,
      [classId, student.id, status]
    );

    await logAction(req.user.id, 'SCAN_ATTENDANCE', 'attendance', classId, { status }, req.ip);

    res.json({
      success: true,
      message: status === 'late' ? '⚠️ Attendance recorded — marked as Late' : '✅ Attendance recorded successfully!',
      data: { status, timeIn: now.toISOString(), classId }
    });
  } catch (err) {
    console.error('Scan QR error:', err);
    res.status(500).json({ success: false, message: 'Failed to record attendance.' });
  }
};

// GET /api/attendance/class/:classId  (teacher)
const getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const [rows] = await pool.execute(
      `SELECT a.*, u.first_name, u.last_name, s.lrn
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       WHERE a.class_id = ?
       ORDER BY a.time_in ASC`,
      [classId]
    );

    const [summary] = await pool.execute(
      `SELECT
         COUNT(*) as total,
         SUM(status='present') as present,
         SUM(status='late') as late,
         SUM(status='absent') as absent
       FROM attendance WHERE class_id = ?`,
      [classId]
    );

    res.json({ success: true, data: { records: rows, summary: summary[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/attendance/student/:studentId  (student/teacher/admin)
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { scheduleId } = req.query;

    let query = `
      SELECT a.*, c.class_date,
        sub.name as subject_name, sec.section_name
      FROM attendance a
      JOIN classes c ON c.id = a.class_id
      JOIN schedules s ON s.id = c.schedule_id
      JOIN subjects sub ON sub.id = s.subject_id
      JOIN sections sec ON sec.id = s.section_id
      WHERE a.student_id = ?
    `;
    const params = [studentId];
    if (scheduleId) { query += ` AND c.schedule_id = ?`; params.push(scheduleId); }
    query += ` ORDER BY c.class_date DESC LIMIT 100`;

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/attendance/close/:classId  (teacher)
// Auto-marks all enrolled students who didn't scan as ABSENT
const closeAttendance = async (req, res) => {
  try {
    const { classId } = req.params;

    // 1. Get the section for this class
    const [classRows] = await pool.execute(
      `SELECT c.id, c.schedule_id, c.class_date, s.section_id
       FROM classes c
       JOIN schedules s ON s.id = c.schedule_id
       WHERE c.id = ?`,
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ success: false, message: 'Class not found.' });

    const cls = classRows[0];

    // 2. Get all active students in that section
    const [allStudents] = await pool.execute(
      `SELECT s.id as student_id
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.section_id = ? AND s.status = 'active' AND u.is_active = 1`,
      [cls.section_id]
    );

    // 3. Get students who already have a record (present or late)
    const [scanned] = await pool.execute(
      `SELECT student_id FROM attendance WHERE class_id = ?`,
      [classId]
    );
    const scannedIds = new Set(scanned.map(r => r.student_id));

    // 4. Insert ABSENT for everyone who didn't scan
    let markedAbsent = 0;
    for (const stu of allStudents) {
      if (!scannedIds.has(stu.student_id)) {
        await pool.execute(
          `INSERT INTO attendance (class_id, student_id, status, scanned_via)
           VALUES (?, ?, 'absent', 'auto')`,
          [classId, stu.student_id]
        );
        markedAbsent++;
      }
    }

    // 5. Close the session
    await pool.execute(
      `UPDATE classes SET attendance_open = 0 WHERE id = ?`,
      [classId]
    );

    // 6. Check absence threshold alerts per student
    try {
      // Get threshold from config (default 3)
      let threshold = 3;
      try {
        const [[cfg]] = await pool.execute(
          `SELECT config_value FROM school_config WHERE config_key = 'attendance_threshold'`
        );
        threshold = parseInt(cfg?.config_value || '3');
      } catch (_) {}

      // Only check students newly marked absent this session
      for (const stu of allStudents) {
        if (scannedIds.has(stu.student_id)) continue; // was present/late, skip

        // Count total absences for this student in this subject
        const [absCnt] = await pool.execute(
          `SELECT COUNT(*) as cnt
           FROM attendance a
           JOIN classes c ON c.id = a.class_id
           WHERE a.student_id = ? AND a.status = 'absent'
             AND c.schedule_id = ?`,
          [stu.student_id, cls.schedule_id]
        );
        const totalAbsences = Number(absCnt[0].cnt);

        // Only alert exactly when threshold is FIRST reached (not every session after)
        // This prevents spam — alert fires once at 3, not at 4, 5, 6...
        if (totalAbsences === threshold) {
          // Get student name
          const [stuInfo] = await pool.execute(
            `SELECT u.first_name, u.last_name, sub.name as subject_name
             FROM students st
             JOIN users u ON u.id = st.user_id
             JOIN schedules sc ON sc.id = ?
             JOIN subjects sub ON sub.id = sc.subject_id
             WHERE st.id = ?`,
            [cls.schedule_id, stu.student_id]
          );
          if (!stuInfo.length) continue;

          const { first_name, last_name, subject_name } = stuInfo[0];
          const title = `⚠️ Absence Alert: ${first_name} ${last_name}`;
          const body  = `${first_name} ${last_name} has reached ${totalAbsences} absences in ${subject_name}. Intervention may be needed.`;

          // Notify the teacher of this class
          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT t.user_id, 'alert', ?, ?
             FROM schedules sc
             JOIN teachers t ON t.id = sc.teacher_id
             WHERE sc.id = ?
             LIMIT 1`,
            [title, body, cls.schedule_id]
          ).catch(() => {});

          // Also notify all admins
          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT u.id, 'alert', ?, ?
             FROM users u
             WHERE u.role = 'admin' AND u.is_active = 1`,
            [title, body]
          ).catch(() => {});

          // Also notify the student themselves
          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT st.user_id, 'alert',
               CONCAT('Absence warning — ', ?),
               CONCAT('You have reached ', ?, ' absences in ', ?, '. Please speak with your teacher.')
             FROM students st WHERE st.id = ?`,
            [subject_name, totalAbsences, subject_name, stu.student_id]
          ).catch(() => {});
        }
      }
    } catch (alertErr) {
      console.warn('Threshold alert warning:', alertErr.message);
    }

    res.json({
      success: true,
      message: `Session closed. ${markedAbsent} student(s) marked absent.`,
      markedAbsent,
    });
  } catch (err) {
    console.error('Close attendance error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateQR, scanQR, getClassAttendance, getStudentAttendance, closeAttendance };
