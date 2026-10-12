const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// GET /api/settings/profile
const getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, u.last_login,
         COALESCE(u.avatar_url, '') AS avatar_url,
         s.id                              AS student_db_id,
         COALESCE(s.lrn,           '')     AS lrn,
         COALESCE(s.grade_level,   '')     AS grade_level,
         COALESCE(s.strand,        '')     AS strand,
         COALESCE(s.phone,         '')     AS student_phone,
         COALESCE(s.guardian_name, '')     AS guardian_name,
         COALESCE(s.guardian_phone,'')     AS guardian_phone,
         COALESCE(s.address::text, '')     AS address,
         s.birthday                        AS birthday,
         COALESCE(sec.section_name,'')     AS section_name,
         COALESCE(sec.id::text, '0')       AS section_id,
         t.id                              AS teacher_db_id,
         COALESCE(t.employee_id,   '')     AS employee_id,
         COALESCE(t.department,    '')     AS department,
         COALESCE(t.phone,         '')     AS teacher_phone,
         COALESCE(t.bio,           '')     AS bio
       FROM users u
       LEFT JOIN students s   ON s.user_id  = u.id
       LEFT JOIN sections sec ON sec.id     = s.section_id
       LEFT JOIN teachers t   ON t.user_id  = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });

    const u = rows[0];
    res.json({
      success: true,
      data: {
        id:           u.id,
        firstName:    u.first_name,
        middleName:   u.middle_name,
        lastName:     u.last_name,
        email:        u.email,
        role:         u.role,
        lastLogin:    u.last_login,
        avatarUrl:    u.avatar_url    || null,
        studentId:    u.student_db_id || null,
        lrn:          u.lrn           || null,
        gradeLevel:   u.grade_level   || null,
        strand:       u.strand        || null,
        sectionName:  u.section_name  || null,
        sectionId:    u.section_id    || null,
        birthday:     u.birthday      || null,
        address:      u.address       || null,
        guardianName: u.guardian_name  || null,
        guardianPhone:u.guardian_phone || null,
        studentPhone: u.student_phone  || null,
        teacherId:    u.teacher_db_id || null,
        employeeId:   u.employee_id   || null,
        department:   u.department    || null,
        teacherPhone: u.teacher_phone || null,
        bio:          u.bio           || null,
      }
    });
  } catch (err) {
    console.error('getProfile error:', err.message);
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

    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
    await logAction(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/avatar
const updateAvatar = async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) return res.status(400).json({ success: false, message: 'Avatar URL required.' });
    await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, req.user.id]);
    await logAction(req.user.id, 'UPDATE_AVATAR', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Profile photo updated.' });
  } catch (err) {
    console.error('updateAvatar error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/student-profile
const updateStudentProfile = async (req, res) => {
  try {
    const { birthday, address, phone, guardianName, guardianPhone } = req.body;
    await pool.query(
      `UPDATE students SET birthday = $1, address = $2, phone = $3, guardian_name = $4, guardian_phone = $5
       WHERE user_id = $6`,
      [birthday || null, address || null, phone || null, guardianName || null, guardianPhone || null, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_STUDENT_PROFILE', 'students', null, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateStudentProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/teacher-profile
const updateTeacherProfile = async (req, res) => {
  try {
    const { phone, department, bio } = req.body;
    await pool.query(
      `UPDATE teachers SET phone = $1, department = $2, bio = $3 WHERE user_id = $4`,
      [phone || null, department || null, bio || null, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_TEACHER_PROFILE', 'teachers', null, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateTeacherProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProfile, changePassword, updateAvatar, updateStudentProfile, updateTeacherProfile };
