const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET student report card data (all grades for a student, formatted for PDF)
router.get('/report-card/:studentId', async (req, res) => {
  try {
    // Students can only view their own report card
    if (req.user.role === 'student') {
      const [s] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
      if (!s.length || String(s[0].id) !== String(req.params.studentId)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const { studentId } = req.params;

    // Try with middle_name first, fall back if column doesn't exist yet
    let studentInfo;
    try {
      [studentInfo] = await pool.execute(
        `SELECT s.*, u.first_name, u.middle_name, u.last_name, u.email,
           sec.section_name, sec.strand, sec.grade_level as section_grade
         FROM students s JOIN users u ON u.id=s.user_id
         LEFT JOIN sections sec ON sec.id=s.section_id
         WHERE s.id=?`, [studentId]
      );
    } catch (colErr) {
      // middle_name column doesn't exist yet — query without it
      [studentInfo] = await pool.execute(
        `SELECT s.*, u.first_name, u.last_name, u.email,
           sec.section_name, sec.strand, sec.grade_level as section_grade
         FROM students s JOIN users u ON u.id=s.user_id
         LEFT JOIN sections sec ON sec.id=s.section_id
         WHERE s.id=?`, [studentId]
      );
    }
    if (!studentInfo || !studentInfo.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    const [grades] = await pool.execute(
      `SELECT g.*, sub.name as subject_name, sub.code as subject_code, sub.units
       FROM grades g
       JOIN schedules sc ON sc.id=g.schedule_id
       JOIN subjects sub ON sub.id=sc.subject_id
       WHERE g.student_id=?
       ORDER BY sub.name, g.quarter`, [studentId]
    );

    // Build subject map
    const subjectMap = {};
    grades.forEach(g => {
      if (!subjectMap[g.subject_name]) {
        subjectMap[g.subject_name] = { name:g.subject_name, code:g.subject_code, units:g.units, quarters:{} };
      }
      subjectMap[g.subject_name].quarters[g.quarter] = {
        final_grade: g.final_grade,
        written_works: g.written_works,
        performance_tasks: g.performance_tasks,
        quarterly_assessment: g.quarterly_assessment,
        remarks: g.remarks
      };
    });

    // Compute GWA
    const subjects = Object.values(subjectMap);
    const gradedSubjects = subjects.filter(s => Object.keys(s.quarters).length > 0);
    let gwa = null;
    if (gradedSubjects.length) {
      const allGrades = gradedSubjects.flatMap(s => Object.values(s.quarters).map(q => parseFloat(q.final_grade)||0));
      gwa = allGrades.length ? (allGrades.reduce((a,b)=>a+b,0)/allGrades.length).toFixed(2) : null;
    }

    // Attendance summary
    const [attendance] = await pool.execute(
      `SELECT COUNT(*) as total,
         SUM(status='present') as present,
         SUM(status='late') as late,
         SUM(status='absent') as absent
       FROM attendance a JOIN students st ON st.id=a.student_id
       WHERE st.id=?`, [studentId]
    );

    let cfg = {};
    try {
      const [config] = await pool.execute(`SELECT config_key, config_value FROM school_config`);
      config.forEach(r => { cfg[r.config_key] = r.config_value; });
    } catch (e) { /* school_config table may not exist yet — use empty config */ }

    res.json({
      success: true,
      data: {
        student: studentInfo[0],
        subjects,
        gwa,
        attendance: attendance[0],
        schoolConfig: cfg,
      }
    });
  } catch (err) {
    console.error('Report card error:', err.message);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// GET class ranking for a section
router.get('/ranking/:sectionId', authorize('admin','teacher'), async (req, res) => {
  try {
    const { sectionId } = req.params;

    const [students] = await pool.execute(
      `SELECT s.id, u.first_name, u.middle_name, u.last_name, s.lrn
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE s.section_id=? AND s.status='active' AND u.is_active=1
       ORDER BY u.last_name`, [sectionId]
    );

    const rankings = [];
    for (const stu of students) {
      const [grades] = await pool.execute(
        `SELECT g.final_grade FROM grades g WHERE g.student_id=?`, [stu.id]
      );
      const vals = grades.map(g => parseFloat(g.final_grade)||0).filter(v=>v>0);
      const gwa = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      rankings.push({ ...stu, gwa: gwa.toFixed(2), gradeCount: vals.length });
    }
    rankings.sort((a,b) => parseFloat(b.gwa) - parseFloat(a.gwa));
    rankings.forEach((r,i) => { r.rank = i+1; });

    res.json({ success: true, data: rankings });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET at-risk students (failing in any subject)
router.get('/at-risk', authorize('admin','teacher'), async (req, res) => {
  try {
    const passingGrade = 75;
    let query = `
      SELECT s.id, u.first_name, u.last_name, sec.section_name, sec.grade_level,
        sub.name as subject_name, g.final_grade, g.quarter,
        COUNT(g2.id) as total_failing
      FROM grades g
      JOIN students s ON s.id=g.student_id
      JOIN users u ON u.id=s.user_id
      LEFT JOIN sections sec ON sec.id=s.section_id
      JOIN schedules sc ON sc.id=g.schedule_id
      JOIN subjects sub ON sub.id=sc.subject_id
      LEFT JOIN grades g2 ON g2.student_id=s.id AND CAST(g2.final_grade AS DECIMAL(5,2)) < ?
      WHERE CAST(g.final_grade AS DECIMAL(5,2)) < ? AND u.is_active=1`;

    if (req.user.role === 'teacher') {
      const [t] = await pool.execute(`SELECT id FROM teachers WHERE user_id=?`, [req.user.id]);
      if (t.length) {
        query += ` AND sc.teacher_id=${t[0].id}`;
      }
    }
    query += ` GROUP BY s.id, sub.name, g.quarter ORDER BY CAST(g.final_grade AS DECIMAL(5,2)) ASC LIMIT 100`;

    const [rows] = await pool.execute(query, [passingGrade, passingGrade]);
    res.json({ success: true, data: rows, passingGrade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET attendance export data
router.get('/attendance-export', authorize('admin','teacher'), async (req, res) => {
  try {
    const { sectionId, scheduleId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT u.first_name, u.middle_name, u.last_name, s.lrn,
        sec.section_name, sec.grade_level,
        sub.name as subject_name, c.class_date,
        a.status, a.time_in
      FROM attendance a
      JOIN students s ON s.id=a.student_id
      JOIN users u ON u.id=s.user_id
      LEFT JOIN sections sec ON sec.id=s.section_id
      JOIN classes c ON c.id=a.class_id
      JOIN schedules sc ON sc.id=c.schedule_id
      JOIN subjects sub ON sub.id=sc.subject_id
      WHERE u.is_active=1`;
    const params = [];
    if (sectionId)  { query += ` AND s.section_id=?`;  params.push(sectionId); }
    if (scheduleId) { query += ` AND c.schedule_id=?`; params.push(scheduleId); }
    if (dateFrom)   { query += ` AND c.class_date>=?`;  params.push(dateFrom); }
    if (dateTo)     { query += ` AND c.class_date<=?`;  params.push(dateTo); }
    query += ` ORDER BY c.class_date DESC, u.last_name LIMIT 2000`;
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
