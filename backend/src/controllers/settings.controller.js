const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// Run once to ensure all columns exist
const ensureColumns = async () => {
  try {
    await pool.execute(`ALTER TABLE users     ADD COLUMN IF NOT EXISTS avatar_url  VARCHAR(500) NULL`);
    await pool.execute(`ALTER TABLE students  ADD COLUMN IF NOT EXISTS birthday    DATE NULL`);
    await pool.execute(`ALTER TABLE students  ADD COLUMN IF NOT EXISTS address     TEXT NULL`);
    await pool.execute(`ALTER TABLE teachers  ADD COLUMN IF NOT EXISTS bio         TEXT NULL`);
  } catch (err) {
    // Ignore if columns already exist
    if (!err.message.includes('Duplicate column')) {
      console.warn('ensureColumns warning:', err.message);
    }
  }
};
ensureColumns();

// GET /api/settings/profile
const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.role, u.last_login,
         IFNULL(u.avatar_url, '')          AS avatar_url,
         s.id                              AS student_db_id,
         IFNULL(s.lrn,           '')       AS lrn,
         IFNULL(s.grade_level,   '')       AS grade_level,
         IFNULL(s.strand,        '')       AS strand,
         IFNULL(s.phone,         '')       AS student_phone,
         IFNULL(s.guardian_name, '')       AS guardian_name,
         IFNULL(s.guardian_phone,'')       AS guardian_phone,
         IFNULL(s.address,       '')       AS address,
         IFNULL(s.birthday,      '')       AS birthday,
         IFNULL(sec.section_name,'')       AS section_name,
         IFNULL(sec.id,          0)        AS section_id,
         t.id                              AS teacher_db_id,
         IFNULL(t.employee_id,   '')       AS employee_id,
         IFNULL(t.department,    '')       AS department,
         IFNULL(t.phone,         '')       AS teacher_phone,
         IFNULL(t.bio,           '')       AS bio
       FROM users u
       LEFT JOIN students s   ON s.user_id  = u.id
       LEFT JOIN sections sec ON sec.id     = s.section_id
       LEFT JOIN teachers t   ON t.user_id  = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found.' });

    const u = rows[0];
    res.json({
      success: true,
      data: {
        id:           u.id,
        firstName:    u.first_name,
        lastName:     u.last_name,
        email:        u.email,
        role:         u.role,
        lastLogin:    u.last_login,
        avatarUrl:    u.avatar_url || null,
        // student
        studentId:    u.student_db_id,
        lrn:          u.lrn          || null,
        gradeLevel:   u.grade_level  || null,
        strand:       u.strand       || null,
        sectionName:  u.section_name || null,
        sectionId:    u.section_id   || null,
        birthday:     u.birthday     || null,
        address:      u.address      || null,
        guardianName: u.guardian_name  || null,
        guardianPhone:u.guardian_phone || null,
        studentPhone: u.student_phone  || null,
        // teacher
        teacherId:    u.teacher_db_id,
        employeeId:   u.employee_id  || null,
        department:   u.department   || null,
        teacherPhone: u.teacher_phone|| null,
        bio:          u.bio          || null,
      }
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// PUT /api/settings/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const [rows] = await pool.execute(
      `SELECT password_hash FROM users WHERE id = ?`, [req.user.id]
    );
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, req.user.id]);
    await logAction(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/avatar
const updateAvatar = async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl)
      return res.status(400).json({ success: false, message: 'Avatar URL required.' });

    await pool.execute(
      `UPDATE users SET avatar_url = ? WHERE id = ?`, [avatarUrl, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_AVATAR', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Profile photo updated.' });
  } catch (err) {
    console.error('updateAvatar error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/student-profile  (student only)
const updateStudentProfile = async (req, res) => {
  try {
    const { birthday, address, phone, guardianName, guardianPhone } = req.body;
    await pool.execute(
      `UPDATE students
       SET birthday = ?, address = ?, phone = ?, guardian_name = ?, guardian_phone = ?
       WHERE user_id = ?`,
      [birthday || null, address || null, phone || null,
       guardianName || null, guardianPhone || null, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_STUDENT_PROFILE', 'students', null, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateStudentProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/teacher-profile  (teacher only)
const updateTeacherProfile = async (req, res) => {
  try {
    const { phone, department, bio } = req.body;
    await pool.execute(
      `UPDATE teachers SET phone = ?, department = ?, bio = ? WHERE user_id = ?`,
      [phone || null, department || null, bio || null, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_TEACHER_PROFILE', 'teachers', null, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateTeacherProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getProfile, changePassword, updateAvatar,
  updateStudentProfile, updateTeacherProfile
};

