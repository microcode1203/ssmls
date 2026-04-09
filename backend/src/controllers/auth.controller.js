// @v2-fixed-imports
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { pool }     = require('../config/database');
const { logAction } = require('../utils/audit');

const failedLogins = new Map();
const MAX_FAILS    = 5;
const LOCK_MINUTES = 15;

const getFailRecord = (email) => {
  const rec = failedLogins.get(email);
  if (!rec) return { count: 0, lockedUntil: null };
  if (rec.lockedUntil && Date.now() > rec.lockedUntil) {
    failedLogins.delete(email);
    return { count: 0, lockedUntil: null };
  }
  return rec;
};

const recordFail = (email) => {
  const rec = getFailRecord(email);
  const count = rec.count + 1;
  const lockedUntil = count >= MAX_FAILS
    ? Date.now() + LOCK_MINUTES * 60 * 1000
    : rec.lockedUntil;
  failedLogins.set(email, { count, lockedUntil });
  return { count, lockedUntil };
};

const clearFails = (email) => failedLogins.delete(email);

const generateToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn:  process.env.JWT_EXPIRES_IN || '8h',
    algorithm:  'HS256',
    issuer:     'ssmls-api',
    audience:   'ssmls-app',
  });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ success: false, message: 'Invalid input.' });

    const cleanEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return res.status(400).json({ success: false, message: 'Invalid email format.' });

    const failRec = getFailRecord(cleanEmail);
    if (failRec.lockedUntil && Date.now() < failRec.lockedUntil) {
      const minsLeft = Math.ceil((failRec.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Try again in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}.`,
        lockedUntil: failRec.lockedUntil,
      });
    }

    const { rows } = await pool.query(
      `SELECT u.*,
         s.id AS student_db_id,
         t.id AS teacher_db_id,
         s.status AS student_status
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE u.email = $1`,
      [cleanEmail]
    );

    const user = rows[0];
    const dummyHash = '$2a$12$dummyhashfordummyuserpreventingtimingattack000000000000';
    const hashToCheck = user ? user.password_hash : dummyHash;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (user && valid && user.is_active && user.student_status === 'graduated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been graduated. Please contact the school administrator.',
      });
    }

    if (!user || !valid || !user.is_active) {
      const { count } = recordFail(cleanEmail);
      const remaining = MAX_FAILS - count;
      if (user) await logAction(user.id, 'LOGIN_FAILED', 'users', user.id, { ip: req.ip, attempts: count }, req.ip);
      if (remaining <= 0) {
        return res.status(429).json({ success: false, message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.` });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        ...(remaining <= 2 && { warning: `${remaining} attempt${remaining > 1 ? 's' : ''} remaining before lockout.` }),
      });
    }

    clearFails(cleanEmail);
    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
    await logAction(user.id, 'LOGIN', 'users', user.id, { ip: req.ip }, req.ip);

    const token = generateToken(user.id, user.role);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        expiresIn: 8 * 60 * 60,
        user: {
          id:        user.id,
          firstName: user.first_name,
          lastName:  user.last_name,
          email:     user.email,
          role:      user.role,
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
    const { rows } = await pool.query(
      `SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, u.last_login,
         s.id AS student_db_id, s.lrn, s.grade_level, s.strand,
         sec.section_name, sec.id AS section_id,
         t.id AS teacher_db_id, t.employee_id
       FROM users u
       LEFT JOIN students s   ON s.user_id  = u.id
       LEFT JOIN sections sec ON sec.id     = s.section_id
       LEFT JOIN teachers t   ON t.user_id  = u.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.user.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found.' });

    const u = rows[0];
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        id: u.id, firstName: u.first_name, middleName: u.middle_name, lastName: u.last_name,
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
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(newPassword))
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase letter.' });
    if (!/[0-9]/.test(newPassword))
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });
    if (currentPassword === newPassword)
      return res.status(400).json({ success: false, message: 'New password must be different from current password.' });

    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, req.user.id]);
    await logAction(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await logAction(req.user.id, 'LOGOUT', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, getMe, changePassword, logout };
