// ── teacher.routes.js ──────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', authorize('admin'), async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT t.id, t.employee_id, t.department, t.phone,
       u.first_name, u.last_name, u.email, u.is_active
     FROM teachers t JOIN users u ON u.id = t.user_id
     ORDER BY u.last_name`
  );
  res.json({ success: true, data: rows });
});

router.get('/:id', authorize('admin', 'teacher'), async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT t.*, u.first_name, u.last_name, u.email
     FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Teacher not found.' });
  res.json({ success: true, data: rows[0] });
});

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
    res.status(201).json({ success: true, message: 'Teacher created. Default password: Teacher@2026' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Email or Employee ID already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally { conn.release(); }
});

module.exports = router;
