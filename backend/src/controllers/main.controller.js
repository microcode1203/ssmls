const { pool } = require('../config/database');

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const { rows: totalsRows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM students s JOIN users u ON u.id=s.user_id WHERE s.status='active' AND u.is_active=TRUE) AS total_students,
          (SELECT COUNT(*) FROM teachers t JOIN users u ON u.id=t.user_id WHERE u.is_active=TRUE) AS total_teachers,
          (SELECT COUNT(*) FROM sections) AS total_sections,
          (SELECT COUNT(*) FROM schedules WHERE status='approved') AS total_classes,
          (SELECT COUNT(*) FROM schedules WHERE status='pending') AS pending_schedules,
          (SELECT COUNT(*) FROM assignments WHERE due_date >= NOW()) AS active_assignments,
          (SELECT COUNT(*) FROM submissions sub JOIN students st ON st.id=sub.student_id JOIN users u ON u.id=st.user_id WHERE sub.status='submitted' AND u.is_active=TRUE) AS ungraded_submissions
      `);
      const totals = totalsRows[0];

      const { rows: attRateRows } = await pool.query(`
        SELECT
          COUNT(*) AS total_scans,
          COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS attended,
          COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
          COUNT(*) FILTER (WHERE a.status = 'late') AS late_count,
          COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
          ROUND(COUNT(*) FILTER (WHERE a.status IN ('present','late')) * 100.0 / NULLIF(COUNT(*), 0), 1) AS attendance_rate
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        WHERE u.is_active = TRUE
      `);
      const attRate = attRateRows[0];

      const { rows: attendanceToday } = await pool.query(`
        SELECT COUNT(*) AS count, a.status
        FROM attendance a
        JOIN classes c ON c.id = a.class_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        WHERE c.class_date = CURRENT_DATE AND u.is_active = TRUE
        GROUP BY a.status
      `);

      const { rows: weeklyAtt } = await pool.query(`
        SELECT
          TO_CHAR(c.class_date, 'Dy') AS day_label,
          c.class_date,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS attended
        FROM attendance a
        JOIN classes c ON c.id = a.class_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        WHERE c.class_date >= CURRENT_DATE - INTERVAL '6 days' AND u.is_active = TRUE
        GROUP BY c.class_date ORDER BY c.class_date ASC
      `);

      const { rows: gradeBreakdown } = await pool.query(`
        SELECT s.grade_level, COUNT(*) AS count
        FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND u.is_active = TRUE
        GROUP BY s.grade_level ORDER BY s.grade_level
      `);

      const { rows: strandBreakdown } = await pool.query(`
        SELECT s.strand, COUNT(*) AS count
        FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND u.is_active = TRUE
        GROUP BY s.strand ORDER BY count DESC
      `);

      const { rows: recentLogs } = await pool.query(`
        SELECT l.*, u.first_name, u.middle_name, u.last_name, u.role
        FROM audit_logs l JOIN users u ON u.id = l.user_id
        ORDER BY l.timestamp DESC LIMIT 8
      `);

      let monthlyTrend = [];
      try {
        const { rows: mt } = await pool.query(`
          SELECT TO_CHAR(c.class_date, 'Mon') AS month,
            TO_CHAR(c.class_date, 'YYYY-MM') AS month_key,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS attended,
            ROUND(COUNT(*) FILTER (WHERE a.status IN ('present','late')) * 100.0 / NULLIF(COUNT(*),0),1) AS rate
          FROM attendance a
          JOIN classes c ON c.id = a.class_id
          JOIN students s ON s.id = a.student_id
          JOIN users u ON u.id = s.user_id
          WHERE c.class_date >= CURRENT_DATE - INTERVAL '6 months' AND u.is_active = TRUE
          GROUP BY month_key, month ORDER BY month_key ASC`);
        monthlyTrend = mt;
      } catch(e) { console.warn('monthlyTrend failed:', e.message); }

      let atRiskStudents = [];
      try {
        const { rows: ar } = await pool.query(`
          SELECT u.first_name, u.middle_name, u.last_name,
            s.grade_level, s.strand, sec.section_name, COUNT(*) AS absences
          FROM attendance a
          JOIN students s ON s.id = a.student_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN sections sec ON sec.id = s.section_id
          WHERE a.status = 'absent' AND u.is_active = TRUE
          GROUP BY s.id, u.first_name, u.middle_name, u.last_name, s.grade_level, s.strand, sec.section_name
          ORDER BY absences DESC LIMIT 5`);
        atRiskStudents = ar;
      } catch(e) { console.warn('atRiskStudents failed:', e.message); }

      let gradeDistribution = [];
      try {
        const { rows: gd } = await pool.query(`
          SELECT
            CASE
              WHEN final_grade >= 90 THEN 'Outstanding'
              WHEN final_grade >= 85 THEN 'Very Satisfactory'
              WHEN final_grade >= 80 THEN 'Satisfactory'
              WHEN final_grade >= 75 THEN 'Fairly Satisfactory'
              ELSE 'Did Not Meet'
            END AS category,
            COUNT(*) AS cnt
          FROM grades WHERE final_grade IS NOT NULL
          GROUP BY category ORDER BY MIN(final_grade) DESC`);
        gradeDistribution = gd.map(r => ({ category: r.category, count: r.cnt }));
      } catch(e) { console.warn('gradeDistribution failed:', e.message); }

      let submissionStats = [];
      try {
        const { rows: ss } = await pool.query(`
          SELECT a.title, a.type,
            COUNT(DISTINCT sub.id) AS submitted,
            COUNT(DISTINCT st.id) AS enrolled
          FROM assignments a
          JOIN schedules sc ON sc.id = a.schedule_id
          JOIN sections sec ON sec.id = sc.section_id
          JOIN students st ON st.section_id = sec.id AND st.status = 'active'
          LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = st.id
          WHERE a.due_date <= NOW()
          GROUP BY a.id, a.title, a.type ORDER BY a.due_date DESC LIMIT 5`);
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
        attendanceToday, weeklyAtt, gradeBreakdown, strandBreakdown,
        recentLogs, monthlyTrend, atRiskStudents, gradeDistribution, submissionStats,
      }});
    }

    if (role === 'teacher') {
      const { rows: tRows } = await pool.query(`SELECT id FROM teachers WHERE user_id=$1`, [req.user.id]);
      if (!tRows.length) return res.status(404).json({ success:false, message:'Teacher not found.' });
      const teacherId = tRows[0].id;

      const { rows: myClasses } = await pool.query(
        `SELECT s.id, sub.name as subject, sec.section_name, sec.grade_level,
           s.day_of_week, s.start_time, s.end_time, s.room, s.status
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
         WHERE s.teacher_id=$1 AND s.status='approved'
         ORDER BY
           CASE s.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END, s.start_time`,
        [teacherId]
      );

      const { rows: attStatsRows } = await pool.query(
        `SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE a.status='present') as present,
           COUNT(*) FILTER (WHERE a.status='late') as late,
           COUNT(*) FILTER (WHERE a.status='absent') as absent
         FROM attendance a
         JOIN classes c ON c.id=a.class_id
         JOIN schedules s ON s.id=c.schedule_id
         WHERE s.teacher_id=$1 AND c.class_date=CURRENT_DATE`,
        [teacherId]
      );
      const attStats = attStatsRows[0];

      const { rows: pendingGrades } = await pool.query(
        `SELECT COUNT(*) as count FROM submissions sub2
         JOIN assignments a ON a.id=sub2.assignment_id
         JOIN schedules s ON s.id=a.schedule_id
         WHERE s.teacher_id=$1 AND sub2.status='submitted'`,
        [teacherId]
      );

      let teacherWeeklyAtt = [];
      try {
        const { rows: twa } = await pool.query(`
          SELECT TO_CHAR(c.class_date,'Dy') AS day,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS attended
          FROM attendance a JOIN classes c ON c.id = a.class_id
          JOIN schedules sc ON sc.id = c.schedule_id
          WHERE sc.teacher_id = $1 AND c.class_date >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY c.class_date ORDER BY c.class_date ASC`, [teacherId]);
        teacherWeeklyAtt = twa;
      } catch(e) { console.warn('teacherWeeklyAtt failed:', e.message); }

      let teacherSubmissions = [];
      try {
        const { rows: ts } = await pool.query(`
          SELECT a.title, a.type,
            COUNT(DISTINCT sub.id) AS submitted,
            COUNT(DISTINCT st.id) AS enrolled
          FROM assignments a
          JOIN schedules sc ON sc.id = a.schedule_id
          JOIN sections sec ON sec.id = sc.section_id
          JOIN students st ON st.section_id = sec.id AND st.status = 'active'
          LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = st.id
          WHERE sc.teacher_id = $1 AND a.due_date <= NOW()
          GROUP BY a.id, a.title, a.type ORDER BY a.due_date DESC LIMIT 5`, [teacherId]);
        teacherSubmissions = ts;
      } catch(e) { console.warn('teacherSubmissions failed:', e.message); }

      return res.json({ success:true, data:{
        myClasses, attStats,
        pendingGradesCount: pendingGrades[0].count,
        teacherWeeklyAtt, teacherSubmissions,
      }});
    }

    if (role === 'student') {
      const { rows: sRows } = await pool.query(
        `SELECT s.id, s.section_id, s.grade_level FROM students s WHERE s.user_id=$1`, [req.user.id]
      );
      if (!sRows.length) return res.status(404).json({ success:false, message:'Student not found.' });
      const student = sRows[0];

      const { rows: schedule } = await pool.query(
        `SELECT s.id, sub.name as subject, u.first_name, u.middle_name, u.last_name,
           s.day_of_week, s.start_time, s.end_time, s.room
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id
         JOIN teachers t ON t.id=s.teacher_id JOIN users u ON u.id=t.user_id
         WHERE s.section_id=$1 AND s.status='approved'
         ORDER BY
           CASE s.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END, s.start_time`,
        [student.section_id]
      );

      const { rows: pendingAssignments } = await pool.query(
        `SELECT a.id, a.title, a.due_date, sub.name as subject FROM assignments a
         JOIN schedules s ON s.id=a.schedule_id JOIN subjects sub ON sub.id=s.subject_id
         WHERE s.section_id=$1 AND a.due_date >= NOW()
           AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_id=$2)
         ORDER BY a.due_date LIMIT 5`,
        [student.section_id, student.id]
      );

      const { rows: attSummaryRows } = await pool.query(
        `SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status='present') as present,
           COUNT(*) FILTER (WHERE status='late') as late,
           COUNT(*) FILTER (WHERE status='absent') as absent
         FROM attendance WHERE student_id=$1`,
        [student.id]
      );
      const attSummary = attSummaryRows[0];

      let studentMonthlyAtt = [];
      try {
        const { rows: sma } = await pool.query(`
          SELECT TO_CHAR(c.class_date,'Mon') AS month,
            TO_CHAR(c.class_date,'YYYY-MM') AS month_key,
            COUNT(*) FILTER (WHERE a.status='present') AS present,
            COUNT(*) FILTER (WHERE a.status='late') AS late,
            COUNT(*) FILTER (WHERE a.status='absent') AS absent
          FROM attendance a JOIN classes c ON c.id = a.class_id
          WHERE a.student_id = $1 AND c.class_date >= CURRENT_DATE - INTERVAL '4 months'
          GROUP BY month_key, month ORDER BY month_key ASC`, [student.id]);
        studentMonthlyAtt = sma;
      } catch(e) { console.warn('studentMonthlyAtt failed:', e.message); }

      let studentGrades = [];
      try {
        const { rows: sg } = await pool.query(`
          SELECT sub.name AS subject, g.quarter, g.final_grade, g.remarks
          FROM grades g JOIN schedules sc ON sc.id = g.schedule_id
          JOIN subjects sub ON sub.id = sc.subject_id
          WHERE g.student_id = $1 ORDER BY sub.name, g.quarter`, [student.id]);
        studentGrades = sg;
      } catch(e) { console.warn('studentGrades failed:', e.message); }

      return res.json({ success:true, data:{
        schedule, pendingAssignments, attSummary, studentMonthlyAtt, studentGrades,
      }});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
const getSections = async (req, res) => {
  try {
    const { gradeLevel } = req.query;
    const params = [];
    let where = '';
    if (gradeLevel) { params.push(gradeLevel); where = `WHERE s.grade_level = $1`; }

    const { rows } = await pool.query(
      `SELECT s.*,
         u.first_name, u.last_name,
         (SELECT COUNT(*) FROM students st JOIN users uu ON uu.id = st.user_id
          WHERE st.section_id = s.id AND st.status = 'active' AND uu.is_active = TRUE) as student_count
       FROM sections s LEFT JOIN users u ON u.id = s.adviser_id
       ${where} ORDER BY s.grade_level, s.section_name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getSections error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createSection = async (req, res) => {
  try {
    const { sectionName, gradeLevel, strand, adviserId } = req.body;
    await pool.query(
      `INSERT INTO sections (section_name, grade_level, strand, adviser_id) VALUES ($1,$2,$3,$4)`,
      [sectionName, gradeLevel, strand, adviserId||null]
    );
    res.status(201).json({ success:true, message:'Section created.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success:false, message:'Section already exists.' });
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  try {
    const role = req.user.role;
    const { rows } = await pool.query(
      `SELECT a.*, u.first_name, u.middle_name, u.last_name
       FROM announcements a JOIN users u ON u.id=a.created_by
       WHERE a.target_role='all' OR a.target_role=$1
       ORDER BY a.created_at DESC LIMIT 20`,
      [role]
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetRole, sectionId } = req.body;
    await pool.query(
      `INSERT INTO announcements (title, content, target_role, section_id, created_by) VALUES ($1,$2,$3,$4,$5)`,
      [title, content, targetRole||'all', sectionId||null, req.user.id]
    );
    res.status(201).json({ success:true, message:'Announcement created.' });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────
const getAssignments = async (req, res) => {
  try {
    const { scheduleId, sectionId } = req.query;
    let q, p = [];

    if (req.user.role === 'student') {
      const { rows: sRows } = await pool.query(
        `SELECT section_id FROM students WHERE user_id = $1`, [req.user.id]
      );
      const secId = sRows[0]?.section_id;
      if (!secId) return res.json({ success: true, data: [] });
      p = [secId];
      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s ON s.id = a.schedule_id
           JOIN subjects sub ON sub.id = s.subject_id
           JOIN sections sec ON sec.id = s.section_id
           JOIN users u ON u.id = a.created_by
           WHERE s.section_id = $1 ORDER BY a.due_date ASC`;

    } else if (req.user.role === 'teacher') {
      p = [req.user.id];
      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s ON s.id = a.schedule_id
           JOIN subjects sub ON sub.id = s.subject_id
           JOIN sections sec ON sec.id = s.section_id
           JOIN teachers t ON t.id = s.teacher_id
           JOIN users u ON u.id = a.created_by
           WHERE t.user_id = $1 ORDER BY a.due_date ASC`;
    } else {
      q = `SELECT a.*, sub.name as subject_name, sec.section_name, sec.grade_level,
             u.first_name, u.middle_name, u.last_name
           FROM assignments a
           JOIN schedules s ON s.id = a.schedule_id
           JOIN subjects sub ON sub.id = s.subject_id
           JOIN sections sec ON sec.id = s.section_id
           JOIN users u ON u.id = a.created_by
           ORDER BY a.due_date ASC`;
    }

    // Additional filters — append with next param index
    const nextIdx = p.length + 1;
    if (scheduleId) { q = q.replace('ORDER BY', `AND a.schedule_id=$${nextIdx} ORDER BY`); p.push(scheduleId); }
    if (sectionId && req.user.role !== 'student') {
      const idx = p.length + 1;
      q = q.replace('ORDER BY', `AND s.section_id=$${idx} ORDER BY`); p.push(sectionId);
    }

    const { rows } = await pool.query(q, p);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAssignments error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAssignment = async (req, res) => {
  try {
    const { scheduleId, title, description, dueDate, maxScore, type } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO assignments (schedule_id, title, description, due_date, max_score, type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [scheduleId, title, description||null, dueDate, maxScore||100, type||'homework', req.user.id]
    );
    res.status(201).json({ success:true, message:'Assignment created.', data:{ id: rows[0].id } });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, textAnswer, fileData, fileName, fileType, fileSize } = req.body;
    if (fileData && fileData.length > 4000000)
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 2MB.' });

    const { rows: sRows } = await pool.query(`SELECT id FROM students WHERE user_id=$1`, [req.user.id]);
    if (!sRows.length) return res.status(403).json({ success:false, message:'Student not found.' });

    await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, text_answer, file_data, file_name, file_type, file_size, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted')
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         text_answer=EXCLUDED.text_answer,
         file_data=EXCLUDED.file_data,
         file_name=EXCLUDED.file_name,
         file_type=EXCLUDED.file_type,
         file_size=EXCLUDED.file_size,
         submitted_at=NOW(),
         status='submitted'`,
      [assignmentId, sRows[0].id, textAnswer||null, fileData||null, fileName||null, fileType||null, fileSize||null]
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
    await pool.query(
      `UPDATE submissions SET score=$1, feedback=$2, status='graded', graded_at=NOW(), graded_by=$3 WHERE id=$4`,
      [parseFloat(score), feedback||null, req.user.id, req.params.id]
    );
    res.json({ success:true, message:'Submission graded.' });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// ─── GRADES ───────────────────────────────────────────────────────────────────
const getGrades = async (req, res) => {
  try {
    const { studentId, scheduleId } = req.query;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required.' });
    const params = [studentId];
    let extra = '';
    if (scheduleId) { params.push(scheduleId); extra = `AND g.schedule_id=$2`; }
    const { rows } = await pool.query(
      `SELECT g.*, sub.name as subject_name, sec.section_name
       FROM grades g JOIN schedules s ON s.id=g.schedule_id
       JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
       WHERE g.student_id=$1 ${extra} ORDER BY sub.name, g.quarter`,
      params
    );
    res.json({ success:true, data:rows });
  } catch (err) {
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
    await pool.query(
      `INSERT INTO grades (student_id, schedule_id, quarter, written_works, performance_tasks, quarterly_assessment, final_grade, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (student_id, schedule_id, quarter) DO UPDATE SET
         written_works=$4, performance_tasks=$5, quarterly_assessment=$6,
         final_grade=$7, remarks=$8, updated_at=NOW()`,
      [studentId, scheduleId, quarter, ww, pt, qa, final, remarks]
    );
    res.json({ success:true, message:'Grade saved.', data:{ finalGrade:final, remarks } });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// ─── MATERIALS ────────────────────────────────────────────────────────────────
const getMaterials = async (req, res) => {
  try {
    const { scheduleId } = req.query;
    const params = [];
    let where = '';
    if (scheduleId) { params.push(scheduleId); where = 'WHERE m.schedule_id=$1'; }
    const { rows } = await pool.query(
      `SELECT m.*, u.first_name, u.middle_name, u.last_name, sub.name as subject_name,
         sec.section_name, sec.grade_level
       FROM learning_materials m JOIN users u ON u.id=m.uploaded_by
       JOIN schedules s ON s.id=m.schedule_id JOIN subjects sub ON sub.id=s.subject_id
       JOIN sections sec ON sec.id=s.section_id
       ${where} ORDER BY m.created_at DESC`,
      params
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

const createMaterial = async (req, res) => {
  try {
    const { scheduleId, title, description, fileUrl, fileType } = req.body;
    if (!scheduleId || !title)
      return res.status(400).json({ success: false, message: 'scheduleId and title are required.' });
    await pool.query(
      `INSERT INTO learning_materials (schedule_id, title, description, file_url, file_type, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [scheduleId, title.trim(), description||null, fileUrl||null, fileType||null, req.user.id]
    );
    res.status(201).json({ success:true, message:'Material uploaded.' });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

module.exports = {
  getDashboard, getSections, createSection,
  getAnnouncements, createAnnouncement,
  getAssignments, createAssignment, submitAssignment, gradeSubmission,
  getGrades, upsertGrade, getMaterials, createMaterial
};
