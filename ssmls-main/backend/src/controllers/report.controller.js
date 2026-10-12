// report.controller.js — Automated Report Generation
const { pool } = require('../config/database');

// GET /api/reports/student/:studentId — full student report data
const getStudentReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolYear, quarter } = req.query;

    // Student info
    const { rows: studentRows } = await pool.query(
      `SELECT s.*, u.first_name, u.middle_name, u.last_name, u.email,
         sec.section_name, sec.grade_level, sec.strand
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`,
      [studentId]
    );
    if (!studentRows.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });
    const student = studentRows[0];

    // Grades per subject
    const { rows: grades } = await pool.query(
      `SELECT g.*, sub.name as subject_name, sub.code
       FROM grades g
       JOIN schedules sc ON sc.id = g.schedule_id
       JOIN subjects sub ON sub.id = sc.subject_id
       WHERE g.student_id = $1
       ${quarter ? 'AND g.quarter = $2' : ''}
       ORDER BY sub.name, g.quarter`,
      quarter ? [studentId, quarter] : [studentId]
    );

    // Attendance summary
    const { rows: attRows } = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE a.status='present') as present,
         COUNT(*) FILTER (WHERE a.status='late') as late,
         COUNT(*) FILTER (WHERE a.status='absent') as absent
       FROM attendance a
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_id = $1`,
      [studentId]
    );
    const attendance = attRows[0];

    // Assignments submitted / total
    const { rows: subRows } = await pool.query(
      `SELECT
         COUNT(DISTINCT a.id) as total_assignments,
         COUNT(DISTINCT sub.id) as submitted,
         AVG(sub.score) as avg_score
       FROM assignments a
       JOIN schedules sc ON sc.id = a.schedule_id
       JOIN sections sec ON sec.id = sc.section_id
       LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = $1
       WHERE sec.id = $2`,
      [studentId, student.section_id]
    );

    // General average
    const gradeValues = grades.map(g => parseFloat(g.final_grade)).filter(n => !isNaN(n))
    const generalAverage = gradeValues.length > 0
      ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(2)
      : null

    // Remarks
    const remarks = generalAverage
      ? parseFloat(generalAverage) >= 90 ? 'With Highest Honors'
      : parseFloat(generalAverage) >= 85 ? 'With High Honors'
      : parseFloat(generalAverage) >= 80 ? 'With Honors'
      : parseFloat(generalAverage) >= 75 ? 'Passed'
      : 'For Remediation'
      : '—'

    res.json({
      success: true,
      data: {
        student,
        grades,
        attendance,
        submissions: subRows[0],
        generalAverage,
        remarks,
        schoolYear: schoolYear || '2025-2026',
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    console.error('getStudentReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/reports/class/:scheduleId — class performance summary
const getClassReport = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    // Schedule info
    const { rows: schedRows } = await pool.query(
      `SELECT sc.*, sub.name as subject_name, sec.section_name, sec.grade_level, sec.strand,
         u.first_name, u.last_name
       FROM schedules sc
       JOIN subjects sub ON sub.id = sc.subject_id
       JOIN sections sec ON sec.id = sc.section_id
       JOIN teachers t ON t.id = sc.teacher_id
       JOIN users u ON u.id = t.user_id
       WHERE sc.id = $1`,
      [scheduleId]
    );
    if (!schedRows.length)
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    const schedule = schedRows[0];

    // All students with grades
    const { rows: students } = await pool.query(
      `SELECT s.id, u.first_name, u.middle_name, u.last_name, s.lrn,
         g.quarter, g.final_grade, g.written_works, g.performance_tasks, g.quarterly_assessment, g.remarks
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grades g ON g.student_id = s.id AND g.schedule_id = $1
       WHERE s.section_id = $2 AND s.status = 'active' AND u.is_active = TRUE
       ORDER BY u.last_name, u.first_name`,
      [scheduleId, schedule.section_id]
    );

    // Attendance stats per student
    const { rows: attStats } = await pool.query(
      `SELECT a.student_id,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE a.status='present') as present,
         COUNT(*) FILTER (WHERE a.status='late') as late,
         COUNT(*) FILTER (WHERE a.status='absent') as absent
       FROM attendance a
       JOIN classes c ON c.id = a.class_id
       WHERE c.schedule_id = $1
       GROUP BY a.student_id`,
      [scheduleId]
    );
    const attMap = Object.fromEntries(attStats.map(a => [a.student_id, a]));

    // Grade distribution
    const gradeValues = students.map(s => parseFloat(s.final_grade)).filter(n => !isNaN(n))
    const classAverage = gradeValues.length > 0
      ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1)
      : null
    const passing = gradeValues.filter(g => g >= 75).length
    const failing  = gradeValues.filter(g => g < 75).length

    res.json({
      success: true,
      data: {
        schedule,
        students: students.map(s => ({ ...s, attendance: attMap[s.id] || {} })),
        classAverage,
        passing,
        failing,
        total: students.length,
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    console.error('getClassReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── helpers ─────────────────────────────────────────────────────────────────
const getConfigMap = async () => {
  const { rows } = await pool.query(`SELECT config_key, config_value FROM school_config`);
  const cfg = {};
  rows.forEach(r => { cfg[r.config_key] = r.config_value; });
  return cfg;
};

// GET /api/reports/ranking/:sectionId — students in a section ranked by GWA
const getRanking = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { rows } = await pool.query(
      `SELECT s.id, s.lrn, u.first_name, u.middle_name, u.last_name,
              ROUND(AVG(g.final_grade)::numeric, 2) AS gwa,
              COUNT(g.id)::int AS "gradeCount"
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grades g ON g.student_id = s.id AND g.final_grade IS NOT NULL
       WHERE s.section_id = $1 AND s.status = 'active' AND u.is_active = TRUE
       GROUP BY s.id, s.lrn, u.first_name, u.middle_name, u.last_name
       ORDER BY gwa DESC NULLS LAST, u.last_name, u.first_name`,
      [sectionId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getRanking error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/reports/at-risk — failing grades (admin: all, teacher: own classes)
const getAtRisk = async (req, res) => {
  try {
    const cfg = await getConfigMap();
    const passingGrade = parseFloat(cfg.passing_grade || cfg.grade_passing || 75);
    const params = [passingGrade];
    let teacherFilter = '';
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      teacherFilter = `AND sc.teacher_id = (SELECT id FROM teachers WHERE user_id = $2)`;
    }
    const { rows } = await pool.query(
      `SELECT u.first_name, u.middle_name, u.last_name,
              sec.grade_level, sec.section_name,
              sub.name AS subject_name, g.quarter, g.final_grade
       FROM grades g
       JOIN students s   ON s.id  = g.student_id
       JOIN users u      ON u.id  = s.user_id
       JOIN schedules sc ON sc.id = g.schedule_id
       JOIN subjects sub ON sub.id = sc.subject_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE g.final_grade IS NOT NULL AND g.final_grade < $1
         AND s.status = 'active' AND u.is_active = TRUE
         ${teacherFilter}
       ORDER BY g.final_grade ASC, u.last_name
       LIMIT 200`,
      params
    );
    res.json({ success: true, passingGrade, data: rows });
  } catch (err) {
    console.error('getAtRisk error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/reports/report-card/:studentId — Form 138 data
const getReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { rows: st } = await pool.query(
      `SELECT s.id, s.user_id, s.lrn, u.first_name, u.middle_name, u.last_name,
              COALESCE(sec.grade_level, s.grade_level) AS grade_level,
              COALESCE(s.strand, sec.strand) AS strand, sec.section_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`,
      [studentId]
    );
    if (!st.length) return res.status(404).json({ success: false, message: 'Student not found.' });
    const student = st[0];

    // Students may only open their own report card
    if (req.user.role === 'student' && student.user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'You can only view your own report card.' });

    const { rows: grades } = await pool.query(
      `SELECT sub.name AS subject_name, g.quarter, g.final_grade
       FROM grades g
       JOIN schedules sc ON sc.id = g.schedule_id
       JOIN subjects sub ON sub.id = sc.subject_id
       WHERE g.student_id = $1
       ORDER BY sub.name, g.quarter`,
      [studentId]
    );
    const bySubject = {};
    grades.forEach(g => {
      if (!bySubject[g.subject_name]) bySubject[g.subject_name] = { name: g.subject_name, quarters: {} };
      bySubject[g.subject_name].quarters[g.quarter] = { final_grade: g.final_grade };
    });
    const vals = grades.map(g => parseFloat(g.final_grade)).filter(n => !isNaN(n));
    const gwa = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;

    const { rows: att } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status IN ('present','late'))::int AS present,
              COUNT(*) FILTER (WHERE status = 'absent')::int AS absent
       FROM attendance WHERE student_id = $1`,
      [studentId]
    );

    const cfg = await getConfigMap();
    const { user_id, ...studentOut } = student;
    res.json({
      success: true,
      data: {
        student: studentOut,
        subjects: Object.values(bySubject),
        gwa,
        attendance: att[0],
        schoolConfig: {
          school_name:    cfg.school_name,
          school_address: cfg.school_address,
          school_year:    cfg.school_year,
          semester:       cfg.semester,
        },
      },
    });
  } catch (err) {
    console.error('getReportCard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getStudentReport, getClassReport, getRanking, getAtRisk, getReportCard };

