const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/audit');

router.use(authenticate, authorize('admin'));

// GET audit logs
router.get('/audit-logs', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT l.*, u.first_name, u.last_name, u.role
     FROM audit_logs l JOIN users u ON u.id=l.user_id
     ORDER BY l.timestamp DESC LIMIT 100`
  );
  res.json({ success: true, data: rows });
});

// GET stats
router.get('/stats', async (req, res) => {
  const [[stats]] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE status='active') as students,
      (SELECT COUNT(*) FROM teachers)                       as teachers,
      (SELECT COUNT(*) FROM sections)                       as sections,
      (SELECT COUNT(*) FROM schedules WHERE status='approved') as classes,
      (SELECT COUNT(*) FROM schedules WHERE status='pending')  as pending,
      (SELECT COUNT(*) FROM attendance WHERE DATE(created_at)=CURDATE()) as today_att
  `);
  res.json({ success: true, data: stats });
});

// ── Admin Account Management ──────────────────────────────────────────────────

// GET all admin accounts
router.get('/admins', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, first_name, last_name, email, is_active, last_login, created_at
       FROM users
       WHERE role = 'admin'
       ORDER BY created_at ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST create new admin account
router.post('/admins', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required.' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    // Check email not already used
    const [existing] = await pool.execute(
      `SELECT id FROM users WHERE email = ? AND is_active = 1`,
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email is already in use.' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
       VALUES (?, ?, ?, ?, 'admin', 1, 1)`,
      [firstName.trim(), lastName.trim(), email.toLowerCase().trim(), hash]
    );

    await logAction(
      req.user.id, 'CREATE_ADMIN', 'users', result.insertId,
      { email: email.toLowerCase().trim() }, req.ip
    );

    res.status(201).json({ success: true, message: 'Admin account created successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH reset admin password
router.patch('/admins/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { id } = req.params;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    // Cannot reset own password from here (use settings page instead)
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ success: false, message: 'Use the Settings page to change your own password.' });

    const [rows] = await pool.execute(
      `SELECT id FROM users WHERE id=? AND role='admin' AND is_active=1`, [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Admin account not found.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE users SET password_hash=? WHERE id=?`, [hash, id]);
    await logAction(req.user.id, 'RESET_ADMIN_PASSWORD', 'users', id, null, req.ip);

    res.json({ success: true, message: 'Admin password reset successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE deactivate admin account
router.delete('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });

    const [rows] = await pool.execute(
      `SELECT id, email FROM users WHERE id=? AND role='admin' AND is_active=1`, [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Admin account not found.' });

    // Free up email on deactivation
    const suffix = '_deleted_' + Date.now();
    await pool.execute(
      `UPDATE users SET is_active=0, email=? WHERE id=?`,
      [rows[0].email + suffix, id]
    );
    await logAction(req.user.id, 'DELETE_ADMIN', 'users', id, null, req.ip);

    res.json({ success: true, message: 'Admin account deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
