// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createNotification } = require('./notification.routes');

router.use(authenticate);

// GET appeals (student sees own; teacher/admin sees all for their classes)
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'student') {
      const [s] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
      if (!s.length) return res.json({ success: true, data: [] });
      [rows] = await pool.execute(
        `SELECT a.*, g.final_grade, g.quarter, sub.name as subject_name
         FROM grade_appeals a JOIN grades g ON g.id=a.grade_id
         JOIN schedules sc ON sc.id=g.schedule_id JOIN subjects sub ON sub.id=sc.subject_id
         WHERE a.student_id=? ORDER BY a.created_at DESC`, [s[0].id]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT a.*, g.final_grade, g.quarter, sub.name as subject_name,
           u.first_name, u.middle_name, u.last_name
         FROM grade_appeals a JOIN grades g ON g.id=a.grade_id
         JOIN schedules sc ON sc.id=g.schedule_id JOIN subjects sub ON sub.id=sc.subject_id
         JOIN students st ON st.id=a.student_id JOIN users u ON u.id=st.user_id
         ORDER BY a.status ASC, a.created_at DESC`
      );
    }
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST submit appeal (student)
router.post('/', authorize('student'), async (req, res) => {
  try {
    const { gradeId, reason } = req.body;
    if (!gradeId || !reason?.trim())
      return res.status(400).json({ success: false, message: 'Grade and reason are required.' });
    const [s] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
    if (!s.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Check not already appealed
    const [existing] = await pool.execute(
      `SELECT id FROM grade_appeals WHERE student_id=? AND grade_id=? AND status='pending'`, [s[0].id, gradeId]
    );
    if (existing.length)
      return res.status(409).json({ success: false, message: 'You already have a pending appeal for this grade.' });

    await pool.execute(
      `INSERT INTO grade_appeals (student_id, grade_id, reason) VALUES (?,?,?)`,
      [s[0].id, gradeId, reason.trim()]
    );

    // Notify the teacher who owns this grade's schedule
    const [teacherInfo] = await pool.execute(
      `SELECT t.user_id FROM grades g JOIN schedules sc ON sc.id=g.schedule_id
       JOIN teachers t ON t.id=sc.teacher_id WHERE g.id=?`, [gradeId]
    );
    if (teacherInfo.length) {
      await createNotification(teacherInfo[0].user_id, 'grade',
        'New grade appeal submitted', reason.slice(0,80), '/appeals');
    }
    res.status(201).json({ success: true, message: 'Appeal submitted.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH respond to appeal (teacher/admin)
router.patch('/:id', authorize('teacher','admin'), async (req, res) => {
  try {
    const { status, response } = req.body;
    const [appeal] = await pool.execute(`SELECT * FROM grade_appeals WHERE id=?`, [req.params.id]);
    if (!appeal.length) return res.status(404).json({ success: false, message: 'Appeal not found.' });

    await pool.execute(
      `UPDATE grade_appeals SET status=?, teacher_response=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?`,
      [status, response||null, req.user.id, req.params.id]
    );

    // Notify student
    const [stu] = await pool.execute(
      `SELECT s.user_id FROM grade_appeals a JOIN students s ON s.id=a.student_id WHERE a.id=?`, [req.params.id]
    );
    if (stu.length) {
      await createNotification(stu[0].user_id, 'grade',
        `Grade appeal ${status}`, response?.slice(0,80) || `Your appeal has been ${status}`, '/grades');
    }
    res.json({ success: true, message: 'Appeal updated.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
