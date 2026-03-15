// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// ── Report Card ──────────────────────────────────────────────────────────────
router.get('/at-risk', authorize('admin','teacher'), async (req, res) => {
  try {
    const passing = 75;
    let query = `
      SELECT s.id, u.first_name, u.last_name,
        sec.section_name, sec.grade_level,
        sub.name AS subject_name,
        g.final_grade, g.quarter
      FROM grades g
      JOIN students  s   ON s.id   = g.student_id
      JOIN users     u   ON u.id   = s.user_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      JOIN schedules sc  ON sc.id  = g.schedule_id
      JOIN subjects  sub ON sub.id = sc.subject_id
      WHERE CAST(g.final_grade AS DECIMAL(5,2)) < ?
        AND u.is_active = 1`;

    const params = [passing];

    if (req.user.role === 'teacher') {
      const [t] = await pool.execute(
        `SELECT id FROM teachers WHERE user_id = ?`, [req.user.id]
      );
      if (t.length) { query += ` AND sc.teacher_id = ?`; params.push(t[0].id); }
    }

    query += ` ORDER BY CAST(g.final_grade AS DECIMAL(5,2)) ASC LIMIT 100`;

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows, passingGrade: passing });
  } catch (err) {
    console.error('At-risk error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/attendance-export', authorize('admin','teacher'), async (req, res) => {
  try {
    const { sectionId, scheduleId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT u.first_name, u.last_name, s.lrn,
        sec.section_name, sec.grade_level,
        sub.name AS subject_name,
        c.class_date, a.status AS attendance_status, a.time_in
      FROM attendance a
      JOIN students  s   ON s.id   = a.student_id
      JOIN users     u   ON u.id   = s.user_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      JOIN classes   c   ON c.id   = a.class_id
      JOIN schedules sc  ON sc.id  = c.schedule_id
      JOIN subjects  sub ON sub.id = sc.subject_id
      WHERE u.is_active = 1`;

    const params = [];
    if (sectionId)  { query += ` AND s.section_id = ?`;   params.push(sectionId); }
    if (scheduleId) { query += ` AND c.schedule_id = ?`;  params.push(scheduleId); }
    if (dateFrom)   { query += ` AND c.class_date >= ?`;  params.push(dateFrom); }
    if (dateTo)     { query += ` AND c.class_date <= ?`;  params.push(dateTo); }
    query += ` ORDER BY c.class_date DESC, u.last_name LIMIT 2000`;

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/report-card/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Students can only view their own report card
    if (req.user.role === 'student') {
      const [s] = await pool.execute(
        `SELECT id FROM students WHERE user_id=?`, [req.user.id]
      );
      if (!s.length || String(s[0].id) !== String(studentId))
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Student info — explicit columns only (no s.* to avoid ambiguous 'status')
    let studentRows;
    try {
      [studentRows] = await pool.execute(
        `SELECT s.id, s.lrn, s.grade_level, s.strand, s.phone,
           s.birthday, s.birthplace, s.guardian_name, s.guardian_phone,
           u.first_name, u.middle_name, u.last_name, u.email,
           sec.section_name, sec.grade_level as section_grade, sec.strand as section_strand
         FROM students s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         WHERE s.id = ?`,
        [studentId]
      );
    } catch (_) {
      // Fallback if middle_name / new columns don't exist yet
      [studentRows] = await pool.execute(
        `SELECT s.id, s.lrn, s.grade_level, s.strand, s.phone,
           s.guardian_name, s.guardian_phone,
           u.first_name, u.last_name, u.email,
           sec.section_name, sec.grade_level as section_grade
         FROM students s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         WHERE s.id = ?`,
        [studentId]
      );
    }
    if (!studentRows?.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    // Grades
    const [grades] = await pool.execute(
      `SELECT g.id, g.quarter, g.final_grade, g.written_works,
         g.performance_tasks, g.quarterly_assessment, g.remarks,
         sub.name as subject_name, sub.code as subject_code, sub.units
       FROM grades g
       JOIN schedules sc  ON sc.id  = g.schedule_id
       JOIN subjects sub  ON sub.id = sc.subject_id
       WHERE g.student_id = ?
       ORDER BY sub.name, g.quarter`,
      [studentId]
    );

    // Build subject map
    const subjectMap = {};
    grades.forEach(g => {
      if (!subjectMap[g.subject_name]) {
        subjectMap[g.subject_name] = {
          name: g.subject_name, code: g.subject_code,
          units: g.units, quarters: {}
        };
      }
      subjectMap[g.subject_name].quarters[g.quarter] = {
        final_grade:          g.final_grade,
        written_works:        g.written_works,
        performance_tasks:    g.performance_tasks,
        quarterly_assessment: g.quarterly_assessment,
        remarks:              g.remarks,
      };
    });

    // GWA
    const subjects = Object.values(subjectMap);
    const allGradeValues = subjects
      .flatMap(s => Object.values(s.quarters))
      .map(q => parseFloat(q.final_grade))
      .filter(n => n > 0);
    const gwa = allGradeValues.length
      ? (allGradeValues.reduce((a,b) => a+b, 0) / allGradeValues.length).toFixed(2)
      : null;

    // Attendance — prefix a. to avoid ambiguous 'status'
    const [[attSummary]] = await pool.execute(
      `SELECT
         COUNT(*)                      AS total,
         SUM(a.status = 'present')     AS present,
         SUM(a.status = 'late')        AS late,
         SUM(a.status = 'absent')      AS absent
       FROM attendance a
       WHERE a.student_id = ?`,
      [studentId]
    );

    // School config (safe — table may not exist yet)
    let cfg = {};
    try {
      const [cfgRows] = await pool.execute(
        `SELECT config_key, config_value FROM school_config`
      );
      cfgRows.forEach(r => { cfg[r.config_key] = r.config_value; });
    } catch (_) {}

    res.json({
      success: true,
      data: {
        student:     studentRows[0],
        subjects,
        gwa,
        attendance:  attSummary,
        schoolConfig: cfg,
      }
    });
  } catch (err) {
    console.error('Report card error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Class Ranking ─────────────────────────────────────────────────────────────
router.get('/ranking/:sectionId', authorize('admin','teacher'), async (req, res) => {
  try {
    const { sectionId } = req.params;

    let studentRows;
    try {
      [studentRows] = await pool.execute(
        `SELECT s.id, s.lrn, u.first_name, u.middle_name, u.last_name
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.section_id = ? AND s.status = 'active' AND u.is_active = 1
         ORDER BY u.last_name`,
        [sectionId]
      );
    } catch (_) {
      [studentRows] = await pool.execute(
        `SELECT s.id, s.lrn, u.first_name, u.last_name
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.section_id = ? AND s.status = 'active' AND u.is_active = 1
         ORDER BY u.last_name`,
        [sectionId]
      );
    }

    const rankings = [];
    for (const stu of studentRows) {
      const [gradeRows] = await pool.execute(
        `SELECT final_grade FROM grades WHERE student_id = ?`, [stu.id]
      );
      const vals = gradeRows.map(g => parseFloat(g.final_grade)||0).filter(v => v > 0);
      const gwa  = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length) : 0;
      rankings.push({ ...stu, gwa: gwa.toFixed(2), gradeCount: vals.length });
    }
    rankings.sort((a,b) => parseFloat(b.gwa) - parseFloat(a.gwa));
    rankings.forEach((r,i) => { r.rank = i + 1; });

    res.json({ success: true, data: rankings });
  } catch (err) {
    console.error('Ranking error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── At-Risk Students ──────────────────────────────────────────────────────────


// ── Attendance Export ─────────────────────────────────────────────────────────


module.exports = router;
