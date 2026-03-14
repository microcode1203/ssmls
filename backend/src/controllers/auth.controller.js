const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

const generateToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const [rows] = await pool.execute(
      `SELECT u.*, 
         COALESCE(s.id, NULL) as student_db_id,
         COALESCE(t.id, NULL) as teacher_db_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE u.email = ? AND u.is_active = 1`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // Update last login
    await pool.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);
    await logAction(user.id, 'LOGIN', 'users', user.id, null, req.ip);

    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          studentId: user.student_db_id,
          teacherId: user.teacher_db_id,
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.last_login,
         s.id as student_db_id, s.lrn, s.grade_level, s.strand,
         sec.section_name, sec.id as section_id,
         t.id as teacher_db_id, t.employee_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    const u = rows[0];
    res.json({
      success: true,
      data: {
        id: u.id, firstName: u.first_name, lastName: u.last_name,
        email: u.email, role: u.role, lastLogin: u.last_login,
        studentId: u.student_db_id, lrn: u.lrn,
        gradeLevel: u.grade_level, strand: u.strand,
        sectionName: u.section_name, sectionId: u.section_id,
        teacherId: u.teacher_db_id, employeeId: u.employee_id,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    const [rows] = await pool.execute(`SELECT password_hash FROM users WHERE id = ?`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);
    await logAction(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, req.ip);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, getMe, changePassword };
