const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/audit');

router.use(authenticate);

// GET all teachers
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.id, t.employee_id, t.department, t.phone,
         u.id as user_id, u.first_name, u.last_name, u.email, u.is_active
       FROM teachers t JOIN users u ON u.id = t.user_id
       WHERE u.is_active = 1
       ORDER BY u.last_name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET single teacher
router.get('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, u.first_name, u.last_name, u.email
       FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=?`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST create teacher
router.post('/', authorize('admin'), async (req, res) => {
  const bcrypt = require('bcryptjs');
  const conn   = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { firstName, lastName, email, employeeId, department, phone } = req.body;
    const hash = await bcrypt.hash('Teacher@2026', 12);
    const [u] = await conn.execute(
      `INSERT INTO users (first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,'teacher')`,
      [firstName, lastName, email, hash]
    );
    await conn.execute(
      `INSERT INTO teachers (user_id,employee_id,department,phone) VALUES (?,?,?,?)`,
      [u.insertId, employeeId, department || null, phone || null]
    );
    await conn.commit();
    await logAction(req.user.id, 'CREATE_TEACHER', 'teachers', u.insertId, { employeeId }, req.ip);
    res.status(201).json({ success: true, message: 'Teacher created. Default password: Teacher@2026' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Email or Employee ID already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally { conn.release(); }
});

// DELETE teacher — deactivates account
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get teacher info
    const [rows] = await pool.execute(
      `SELECT t.id, t.user_id, u.first_name, u.last_name
       FROM teachers t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Teacher not found.' });

    const teacher = rows[0];

    // Check if teacher has active schedules
    const [[schedCount]] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM schedules WHERE teacher_id=? AND status='approved'`,
      [id]
    );
    if (schedCount.cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — this teacher has ${schedCount.cnt} active schedule(s). Remove their schedules first.`
      });
    }

    // Get teacher's email before deactivating
    const [userRows] = await pool.execute(
      'SELECT email FROM users WHERE id = ?', [teacher.user_id]
    );
    const teacherEmail = userRows[0]?.email || '';

    // Append suffix to free up email (so it can be reused)
    const suffix = '_deleted_' + Date.now();
    const freedEmail = teacherEmail + suffix;

    await pool.execute(
      'UPDATE users SET is_active = 0, email = ? WHERE id = ?',
      [freedEmail, teacher.user_id]
    );
    await logAction(
      req.user.id, 'DELETE_TEACHER', 'teachers', id,
      { name: teacher.first_name + ' ' + teacher.last_name }, req.ip
    );

    res.json({ success: true, message: 'Teacher account deactivated successfully.' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET teacher's schedules (sections + subjects they handle)
router.get('/:id/schedules', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         s.id, s.day_of_week, s.start_time, s.end_time, s.room, s.status,
         sub.id as subject_id, sub.name as subject_name, sub.code as subject_code,
         sec.id as section_id, sec.section_name, sec.grade_level, sec.strand
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.teacher_id = ? AND s.status = 'approved'
       ORDER BY
         FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
         s.start_time`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
