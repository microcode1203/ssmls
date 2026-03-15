const { pool } = require('../config/database');

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      // ── All counts filter by is_active=1 to exclude deleted accounts ──────
      const [[totals]] = await pool.execute(`
        SELECT
          -- Only count students whose user account is active
          (SELECT COUNT(*)
           FROM students s JOIN users u ON u.id=s.user_id
           WHERE s.status='active' AND u.is_active=1)             AS total_students,

          -- Only count teachers whose user account is active
          (SELECT COUNT(*)
           FROM teachers t JOIN users u ON u.id=t.user_id
           WHERE u.is_active=1)                                    AS total_teachers,

          -- Sections that still exist (already cleaned up on delete)
          (SELECT COUNT(*) FROM sections)                          AS total_sections,

          -- Active approved schedules
          (SELECT COUNT(*) FROM schedules WHERE status='approved') AS total_classes,

          -- Pending schedules awaiting approval
          (SELECT COUNT(*) FROM schedules WHERE status='pending')  AS pending_schedules,

          -- Assignments not yet due
          (SELECT COUNT(*) FROM assignments
           WHERE due_date >= NOW())                                 AS active_assignments,

          -- Ungraded submissions from active students only
          (SELECT COUNT(*)
           FROM submissions sub
           JOIN students st ON st.id=sub.student_id
           JOIN users u ON u.id=st.user_id
           WHERE sub.status='submitted' AND u.is_active=1)         AS ungraded_submissions
      `);

      // Attendance rate — only from active students
      const [[attRate]] = await pool.execute(`
        SELECT
          COUNT(*)                                          AS total_scans,
          SUM(a.status IN ('present','late'))               AS attended,
          SUM(a.status = 'present')                         AS present_count,
          SUM(a.status = 'late')                            AS late_count,
          SUM(a.status = 'absent')                          AS absent_count,
          ROUND(
            SUM(a.status IN ('present','late')) * 100.0
            / NULLIF(COUNT(*), 0), 1
          )                                                 AS attendance_rate
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN users u    ON u.id = s.user_id
        WHERE u.is_active = 1
      `);

      // Today's attendance — active students only
      const [attendanceToday] = await pool.execute(`
        SELECT COUNT(*) AS count, a.status
        FROM attendance a
        JOIN classes c  ON c.id  = a.class_id
        JOIN students s ON s.id  = a.student_id
        JOIN users u    ON u.id  = s.user_id
        WHERE DATE(c.class_date) = CURDATE()
          AND u.is_active = 1
        GROUP BY a.status
      `);

      // Weekly attendance — active students only
      const [weeklyAtt] = await pool.execute(`
        SELECT
          DATE_FORMAT(c.class_date, '%a') AS day_label,
          c.class_date,
          COUNT(*)                         AS total,
          SUM(a.status IN ('present','late')) AS attended
        FROM attendance a
        JOIN classes c  ON c.id  = a.class_id
        JOIN students s ON s.id  = a.student_id
        JOIN users u    ON u.id  = s.user_id
        WHERE c.class_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND u.is_active = 1
        GROUP BY c.class_date
        ORDER BY c.class_date ASC
      `);

      // Grade breakdown — active students only
      const [gradeBreakdown] = await pool.execute(`
        SELECT s.grade_level, COUNT(*) AS count
        FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND u.is_active = 1
        GROUP BY s.grade_level
        ORDER BY s.grade_level
      `);

      // Strand breakdown — active students only
      const [strandBreakdown] = await pool.execute(`
        SELECT s.strand, COUNT(*) AS count
        FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND u.is_active = 1
        GROUP BY s.strand
        ORDER BY count DESC
      `);

      // Recent activity logs
      const [recentLogs] = await pool.execute(`
        SELECT l.*, u.first_name, u.middle_name, u.last_name, u.role
        FROM audit_logs l
        JOIN users u ON u.id = l.user_id
        ORDER BY l.timestamp DESC
        LIMIT 8
      `);

      // Monthly attendance trend (last 6 months) — non-critical, fallback to []
      let monthlyTrend = [];
      try {
        const [mt] = await pool.execute(`
          SELECT DATE_FORMAT(c.class_date, '%b') AS month,
            DATE_FORMAT(c.class_date, '%Y-%m') AS month_key,
            COUNT(*) AS total,
            SUM(a.status IN ('present','late')) AS attended,
            ROUND(SUM(a.status IN ('present','late')) * 100.0 / NULLIF(COUNT(*),0),1) AS rate
          FROM attendance a
          JOIN classes c ON c.id = a.class_id
          JOIN students s ON s.id = a.student_id
          JOIN users u ON u.id = s.user_id
          WHERE c.class_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            AND u.is_active = 1
          GROUP BY month_key, month
          ORDER BY month_key ASC`);
        monthlyTrend = mt;
      } catch(e) { console.warn('monthlyTrend failed:', e.message); }

      // Top absent students (at-risk) — non-critical
      let atRiskStudents = [];
      try {
        const [ar] = await pool.execute(`
          SELECT u.first_name, u.middle_name, u.last_name,
            s.grade_level, s.strand, sec.section_name,
            COUNT(*) AS absences
          FROM attendance a
          JOIN students s ON s.id = a.student_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN sections sec ON sec.id = s.section_id
          WHERE a.status = 'absent' AND u.is_active = 1
          GROUP BY s.id, u.first_name, u.middle_name, u.last_name,
                   s.grade_level, s.strand, sec.section_name
          ORDER BY absences DESC
          LIMIT 5`);
        atRiskStudents = ar;
      } catch(e) { console.warn('atRiskStudents failed:', e.message); }

      // Grade distribution — non-critical
      let gradeDistribution = [];
      try {
        const [gd] = await pool.execute(`
          SELECT
            CASE
              WHEN final_grade >= 90 THEN 'Outstanding'
              WHEN final_grade >= 85 THEN 'Very Satisfactory'
              WHEN final_grade >= 80 THEN 'Satisfactory'
              WHEN final_grade >= 75 THEN 'Fairly Satisfactory'
              ELSE 'Did Not Meet'
            END AS category,
            COUNT(*) AS cnt
          FROM grades
          WHERE final_grade IS NOT NULL
          GROUP BY category
          ORDER BY MIN(final_grade) DESC`);
        gradeDistribution = gd.map(r => ({ category: r.category, count: r.cnt }));
      } catch(e) { console.warn('gradeDistribution failed:', e.message); }

      // Submission stats — non-critical
      let submissionStats = [];
      try {
        const [ss] = await pool.execute(`
          SELECT a.title, a.type,
            COUNT(DISTINCT sub.id) AS submitted,
            COUNT(DISTINCT st.id) AS enrolled
          FROM assignments a
          JOIN schedules sc ON sc.id = a.schedule_id
          JOIN sections sec ON sec.id = sc.section_id
          JOIN students st ON st.section_id = sec.id AND st.status = 'active'
          LEFT JOIN submissions sub ON sub.assignment_id = a.id
            AND sub.student_id = st.id
          WHERE a.due_date <= NOW()
          GROUP BY a.id, a.title, a.type
          ORDER BY a.due_date DESC
          LIMIT 5`);
        submissionStats = ss;
      } catch(e) { console.warn('submissionStats failed:', e.message); }

      return res.json({ success: true, data: {
        totals: {
          ...totals,
          attendance_rate: attRate.attendance_rate || 0,
          present_count:   attRate.present_count   || 0,
          late_count:      attRate.late_count       || 0,
          absent_count:    attRate.absent_count     || 0,
          total_scans:     attRate.total_scans      || 0,
        },
        attendanceToday,
        weeklyAtt,
        gradeBreakdown,
        strandBreakdown,
        recentLogs,
        monthlyTrend,
        atRiskStudents,
        gradeDistribution,
        submissionStats,
      }});
    }

    if (role === 'teacher') {
      const [tRows] = await pool.execute(`SELECT id FROM teachers WHERE user_id=?`, [req.user.id]);
      if (!tRows.length) return res.status(404).json({ success:false, message:'Teacher not found.' });
      const teacherId = tRows[0].id;

      const [myClasses] = await pool.execute(
        `SELECT s.id, sub.name as subject, sec.section_name, sec.grade_level, s.day_of_week, s.start_time, s.end_time, s.room, s.status
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
         WHERE s.teacher_id=? AND s.status='approved'
         ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.start_time`,
        [teacherId]
      );
      const [[attStats]] = await pool.execute(
        `SELECT COUNT(*) as total,
           SUM(a.status='present') as present,
           SUM(a.status='late') as late,
           SUM(a.status='absent') as absent
         FROM attendance a
         JOIN classes c ON c.id=a.class_id
         JOIN schedules s ON s.id=c.schedule_id
         WHERE s.teacher_id=? AND DATE(c.class_date)=CURDATE()`,
        [teacherId]
      );
      const [pendingGrades] = await pool.execute(
        `SELECT COUNT(*) as count FROM submissions sub2
         JOIN assignments a ON a.id=sub2.assignment_id
         JOIN schedules s ON s.id=a.schedule_id
         WHERE s.teacher_id=? AND sub2.status='submitted'`,
        [teacherId]
      );
      // Weekly attendance chart for teacher — non-critical
      let teacherWeeklyAtt = [];
      try {
        const [twa] = await pool.execute(`
          SELECT DATE_FORMAT(c.class_date,'%a') AS day,
            COUNT(*) AS total,
            SUM(a.status IN ('present','late')) AS attended
          FROM attendance a
          JOIN classes c ON c.id = a.class_id
          JOIN schedules sc ON sc.id = c.schedule_id
          WHERE sc.teacher_id = ? AND c.class_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          GROUP BY c.class_date ORDER BY c.class_date ASC`, [teacherId]);
        teacherWeeklyAtt = twa;
      } catch(e) { console.warn('teacherWeeklyAtt failed:', e.message); }

      // Submission rate per assignment — non-critical
      let teacherSubmissions = [];
      try {
        const [ts] = await pool.execute(`
          SELECT a.title, a.type,
            COUNT(DISTINCT sub.id) AS submitted,
            COUNT(DISTINCT st.id) AS enrolled
          FROM assignments a
          JOIN schedules sc ON sc.id = a.schedule_id
          JOIN sections sec ON sec.id = sc.section_id
          JOIN students st ON st.section_id = sec.id AND st.status = 'active'
          LEFT JOIN submissions sub ON sub.assignment_id = a.id
            AND sub.student_id = st.id
          WHERE sc.teacher_id = ? AND a.due_date <= NOW()
          GROUP BY a.id, a.title, a.type
          ORDER BY a.due_date DESC LIMIT 5`, [teacherId]);
        teacherSubmissions = ts;
      } catch(e) { console.warn('teacherSubmissions failed:', e.message); }

      return res.json({ success:true, data:{
        myClasses, attStats,
        pendingGradesCount: pendingGrades[0].count,
        teacherWeeklyAtt,
        teacherSubmissions,
      }});
    }

    if (role === 'student') {
      const [sRows] = await pool.execute(
        `SELECT s.id, s.section_id, s.grade_level FROM students s WHERE s.user_id=?`, [req.user.id]
      );
      if (!sRows.length) return res.status(404).json({ success:false, message:'Student not found.' });
      const student = sRows[0];

      const [schedule] = await pool.execute(
        `SELECT s.id, sub.name as subject, u.first_name, u.middle_name, u.last_name, s.day_of_week, s.start_time, s.end_time, s.room
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id
         JOIN teachers t ON t.id=s.teacher_id JOIN users u ON u.id=t.user_id
         WHERE s.section_id=? AND s.status='approved'
         ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.start_time`,
        [student.section_id]
      );
      const [pendingAssignments] = await pool.execute(
        `SELECT a.id, a.title, a.due_date, sub.name as subject FROM assignments a
         JOIN schedules s ON s.id=a.schedule_id JOIN subjects sub ON sub.id=s.subject_id
         WHERE s.section_id=? AND a.due_date >= NOW()
           AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_id=?)
         ORDER BY a.due_date LIMIT 5`,
        [student.section_id, student.id]
      );
      const [[attSummary]] = await pool.execute(
        `SELECT COUNT(*) as total,
           SUM(status='present') as present, SUM(status='late') as late, SUM(status='absent') as absent
         FROM attendance WHERE student_id=?`,
        [student.id]
      );
      // Monthly attendance trend — non-critical
      let studentMonthlyAtt = [];
      try {
        const [sma] = await pool.execute(`
          SELECT DATE_FORMAT(c.class_date,'%b') AS month,
            DATE_FORMAT(c.class_date,'%Y-%m') AS month_key,
            SUM(a.status='present') AS present,
            SUM(a.status='late') AS late,
            SUM(a.status='absent') AS absent
          FROM attendance a JOIN classes c ON c.id = a.class_id
          WHERE a.student_id = ? AND c.class_date >= DATE_SUB(CURDATE(), INTERVAL 4 MONTH)
          GROUP BY month_key, month ORDER BY month_key ASC`, [student.id]);
        studentMonthlyAtt = sma;
      } catch(e) { console.warn('studentMonthlyAtt failed:', e.message); }

      // Grades per subject — non-critical
      let studentGrades = [];
      try {
        const [sg] = await pool.execute(`
          SELECT sub.name AS subject, g.quarter, g.final_grade, g.remarks
          FROM grades g
          JOIN schedules sc ON sc.id = g.schedule_id
          JOIN subjects sub ON sub.id = sc.subject_id
          WHERE g.student_id = ?
          ORDER BY sub.name, g.quarter`, [student.id]);
        studentGrades = sg;
      } catch(e) { console.warn('studentGrades failed:', e.message); }

      return res.json({ success:true, data:{
        schedule, pendingAssignments, attSummary,
        studentMonthlyAtt, studentGrades,
      }});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// ─── SECTIONS ────────────────────────────────────────────────────────────────
const getSections = async (req, res) => {
  try {
    const { gradeLevel } = req.query;

    // Fix 1: student_count only counts students whose USER account is active
    // (students.status='active' alone is not enough — deleted accounts
    //  set is_active=0 on users table but may still have status='active' on students)
    const whereClause = gradeLevel ? 'WHERE s.grade_level = ?' : '';
    const [rows] = await pool.execute(
      `SELECT
         s.*,
         u.first_name,
         u.last_name,
         (
           SELECT COUNT(*)
           FROM students st
           JOIN users uu ON uu.id = st.user_id
           WHERE st.section_id = s.id
             AND st.status = 'active'
             AND uu.is_active = 1
         ) as student_count
       FROM sections s
       LEFT JOIN users u ON u.id = s.adviser_id
       ${whereClause}
       ORDER BY s.grade_level, s.section_name`,
      gradeLevel ? [gradeLevel] : []
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getSections error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createSection = async (req, res) => {
  const { sectionName, gradeLevel, strand, adviserId } = req.body;
  await pool.execute(
    `INSERT INTO sections (section_name, grade_level, strand, adviser_id) VALUES (?,?,?,?)`,
    [sectionName, gradeLevel, strand, adviserId||null]
  );
  res.status(201).json({ success:true, message:'Section created.' });
};

// ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  const role = req.user.role;
  const [rows] = await pool.execute(
    `SELECT a.*, u.first_name, u.middle_name, u.last_name
     FROM announcements a JOIN users u ON u.id=a.created_by
     WHERE a.target_role='all' OR a.target_role=?
     ORDER BY a.created_at DESC LIMIT 20`,
    [role]
  );
  res.json({ success:true, data:rows });
};

const createAnnouncement = async (req, res) => {
  const { title, content, targetRole, sectionId } = req.body;
  await pool.execute(
    `INSERT INTO announcements (title, content, target_role, section_id, created_by) VALUES (?,?,?,?,?)`,
    [title, content, targetRole||'all', sectionId||null, req.user.id]
  );
  res.status(201).json({ success:true, message:'Announcement created.' });
};

// ─── ASSIGNMENTS ─────────────────────────────────────────────────────────────
const getAssignments = async (req, res) => {
  try {
    const { scheduleId, sectionId } = req.query;

    // For students — show assignments for their section
    // For teachers — show assignments they created
    // For admin — show all assignments
    let q, p = [];

    if (req.user.role === 'student') {
      // Get student's section
      const [sRows] = await pool.execute(
        `SELECT section_id FROM students WHERE user_id = ?`, [req.user.id]
      );
      const secId = sRows[0]?.section_id;
      if (!secId) return res.json({ success: true, data: [] });

      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s   ON s.id = a.schedule_id
           JOIN subjects sub  ON sub.id = s.subject_id
           JOIN sections sec  ON sec.id = s.section_id
           JOIN users u       ON u.id = a.created_by
           WHERE s.section_id = ?
           ORDER BY a.due_date ASC`;
      p = [secId];

    } else if (req.user.role === 'teacher') {
      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s   ON s.id = a.schedule_id
           JOIN subjects sub  ON sub.id = s.subject_id
           JOIN sections sec  ON sec.id = s.section_id
           JOIN teachers t    ON t.id = s.teacher_id
           JOIN users u       ON u.id = a.created_by
           WHERE t.user_id = ?
           ORDER BY a.due_date ASC`;
      p = [req.user.id];

    } else {
      // Admin — all assignments
      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s   ON s.id = a.schedule_id
           JOIN subjects sub  ON sub.id = s.subject_id
           JOIN sections sec  ON sec.id = s.section_id
           JOIN users u       ON u.id = a.created_by
           ORDER BY a.due_date ASC`;
    }

    if (scheduleId) { q = q.replace('ORDER BY', 'AND a.schedule_id=? ORDER BY'); p.push(scheduleId); }
    if (sectionId)  { q = q.replace('ORDER BY', 'AND s.section_id=? ORDER BY');  p.push(sectionId); }

    const [rows] = await pool.execute(q, p);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAssignments error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAssignment = async (req, res) => {
  const { scheduleId, title, description, dueDate, maxScore, type } = req.body;
  const [r] = await pool.execute(
    `INSERT INTO assignments (schedule_id, title, description, due_date, max_score, type, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [scheduleId, title, description||null, dueDate, maxScore||100, type||'homework', req.user.id]
  );
  res.status(201).json({ success:true, message:'Assignment created.', data:{ id: r.insertId } });
};

const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, textAnswer, fileData, fileName, fileType, fileSize } = req.body;

    // Validate file size — max 3MB base64 (~2MB actual file)
    if (fileData && fileData.length > 4000000) {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 2MB.' });
    }

    const [sRows] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
    if (!sRows.length) return res.status(403).json({ success:false, message:'Student not found.' });

    await pool.execute(
      `INSERT INTO submissions
         (assignment_id, student_id, text_answer, file_data, file_name, file_type, file_size, status)
       VALUES (?,?,?,?,?,?,?,'submitted')
       ON DUPLICATE KEY UPDATE
         text_answer=VALUES(text_answer),
         file_data=VALUES(file_data),
         file_name=VALUES(file_name),
         file_type=VALUES(file_type),
         file_size=VALUES(file_size),
         submitted_at=NOW(),
         status='submitted'`,
      [
        assignmentId, sRows[0].id,
        textAnswer||null,
        fileData||null, fileName||null, fileType||null, fileSize||null
      ]
    );
    res.json({ success:true, message:'Assignment submitted successfully.' });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    if (score === undefined || score === null)
      return res.status(400).json({ success: false, message: 'Score is required.' });
    await pool.execute(
      `UPDATE submissions SET score=?, feedback=?, status='graded', graded_at=NOW(), graded_by=? WHERE id=?`,
      [parseFloat(score), feedback||null, req.user.id, req.params.id]
    );
    res.json({ success:true, message:'Submission graded.' });
  } catch (err) {
    console.error('gradeSubmission:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};

// ─── GRADES ──────────────────────────────────────────────────────────────────
const getGrades = async (req, res) => {
  try {
    const { studentId, scheduleId } = req.query;
    if (!studentId)
      return res.status(400).json({ success: false, message: 'studentId is required.' });
    const [rows] = await pool.execute(
      `SELECT g.*, sub.name as subject_name, sec.section_name
       FROM grades g JOIN schedules s ON s.id=g.schedule_id
       JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
       WHERE g.student_id=? ${scheduleId ? 'AND g.schedule_id=?' : ''}
       ORDER BY sub.name, g.quarter`,
      scheduleId ? [studentId, scheduleId] : [studentId]
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error('getGrades:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};

const upsertGrade = async (req, res) => {
  try {
    const { studentId, scheduleId, quarter, writtenWorks, performanceTasks, quarterlyAssessment } = req.body;
    if (!studentId || !scheduleId || !quarter)
      return res.status(400).json({ success: false, message: 'studentId, scheduleId, and quarter are required.' });
    const ww = parseFloat(writtenWorks) || 0;
    const pt = parseFloat(performanceTasks) || 0;
    const qa = parseFloat(quarterlyAssessment) || 0;
    const final   = (ww * 0.25 + pt * 0.50 + qa * 0.25).toFixed(2);
    const remarks  = parseFloat(final) >= 75 ? 'Passed' : 'Failed';
    await pool.execute(
      `INSERT INTO grades (student_id, schedule_id, quarter, written_works, performance_tasks, quarterly_assessment, final_grade, remarks)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE written_works=?, performance_tasks=?, quarterly_assessment=?, final_grade=?, remarks=?`,
      [studentId, scheduleId, quarter, ww, pt, qa, final, remarks,
       ww, pt, qa, final, remarks]
    );
    res.json({ success:true, message:'Grade saved.', data:{ finalGrade:final, remarks } });
  } catch (err) {
    console.error('upsertGrade:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};

// ─── MATERIALS ───────────────────────────────────────────────────────────────
const getMaterials = async (req, res) => {
  try {
    const { scheduleId } = req.query;
    const [rows] = await pool.execute(
      `SELECT m.*, u.first_name, u.middle_name, u.last_name, sub.name as subject_name,
         sec.section_name, sec.grade_level
       FROM learning_materials m JOIN users u ON u.id=m.uploaded_by
       JOIN schedules s ON s.id=m.schedule_id JOIN subjects sub ON sub.id=s.subject_id
       JOIN sections sec ON sec.id=s.section_id
       ${scheduleId ? 'WHERE m.schedule_id=?' : ''}
       ORDER BY m.created_at DESC`,
      scheduleId ? [scheduleId] : []
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error('getMaterials:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};

const createMaterial = async (req, res) => {
  try {
    const { scheduleId, title, description, fileUrl, fileType } = req.body;
    if (!scheduleId || !title)
      return res.status(400).json({ success: false, message: 'scheduleId and title are required.' });
    await pool.execute(
      `INSERT INTO learning_materials (schedule_id, title, description, file_url, file_type, uploaded_by) VALUES (?,?,?,?,?,?)`,
      [scheduleId, title.trim(), description||null, fileUrl||null, fileType||null, req.user.id]
    );
    res.status(201).json({ success:true, message:'Material uploaded.' });
  } catch (err) {
    console.error('createMaterial:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};

module.exports = {
  getDashboard, getSections, createSection,
  getAnnouncements, createAnnouncement,
  getAssignments, createAssignment, submitAssignment, gradeSubmission,
  getGrades, upsertGrade, getMaterials, createMaterial
};
