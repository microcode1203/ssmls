const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// Safe column adder — works on ALL MySQL versions
const safeAddColumn = async (table, column, definition) => {
  try {
    // Check if column exists first
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = ?
         AND COLUMN_NAME  = ?`,
      [table, column]
    );
    if (rows[0].cnt === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`✅ Added column ${table}.${column}`);
    }
  } catch (err) {
    console.warn(`⚠️  safeAddColumn(${table}.${column}):`, err.message);
  }
};

const ensureColumns = async () => {
  await safeAddColumn('users',    'avatar_url', 'VARCHAR(500) NULL');
  await safeAddColumn('students', 'birthday',   'DATE NULL');
  await safeAddColumn('students', 'address',    'TEXT NULL');
  await safeAddColumn('teachers', 'bio',        'TEXT NULL');
};
ensureColumns();

// GET /api/settings/profile
const getProfile = async (req, res) => {
  try {
    // Build query dynamically based on what columns exist
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'`
    );
    const userCols = cols.map(c => c.COLUMN_NAME);
    const hasAvatar = userCols.includes('avatar_url');

    const [sCols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students'`
    );
    const stuCols = sCols.map(c => c.COLUMN_NAME);
    const hasBirthday = stuCols.includes('birthday');
    const hasAddress  = stuCols.includes('address');

    const [tCols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers'`
    );
    const teachCols = tCols.map(c => c.COLUMN_NAME);
    const hasBio = teachCols.includes('bio');

    const [rows] = await pool.execute(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.role, u.last_login,
         ${hasAvatar ? "IFNULL(u.avatar_url,'')" : "''"} AS avatar_url,
         s.id                              AS student_db_id,
         IFNULL(s.lrn,           '')       AS lrn,
         IFNULL(s.grade_level,   '')       AS grade_level,
         IFNULL(s.strand,        '')       AS strand,
         IFNULL(s.phone,         '')       AS student_phone,
         IFNULL(s.guardian_name, '')       AS guardian_name,
         IFNULL(s.guardian_phone,'')       AS guardian_phone,
         ${hasAddress  ? "IFNULL(s.address,'')"  : "''"} AS address,
         ${hasBirthday ? "IFNULL(s.birthday,'')" : "''"} AS birthday,
         IFNULL(sec.section_name,'')       AS section_name,
         IFNULL(sec.id, 0)                 AS section_id,
         t.id                              AS teacher_db_id,
         IFNULL(t.employee_id,   '')       AS employee_id,
         IFNULL(t.department,    '')       AS department,
         IFNULL(t.phone,         '')       AS teacher_phone,
         ${hasBio ? "IFNULL(t.bio,'')" : "''"} AS bio
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
    console.error('changePassword error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/avatar
const updateAvatar = async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl)
      return res.status(400).json({ success: false, message: 'Avatar URL required.' });
    await safeAddColumn('users', 'avatar_url', 'VARCHAR(500) NULL');
    await pool.execute(`UPDATE users SET avatar_url = ? WHERE id = ?`, [avatarUrl, req.user.id]);
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
    await safeAddColumn('students', 'birthday', 'DATE NULL');
    await safeAddColumn('students', 'address',  'TEXT NULL');
    await pool.execute(
      `UPDATE students
       SET birthday=?, address=?, phone=?, guardian_name=?, guardian_phone=?
       WHERE user_id=?`,
      [birthday||null, address||null, phone||null,
       guardianName||null, guardianPhone||null, req.user.id]
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
    await safeAddColumn('teachers', 'bio', 'TEXT NULL');
    await pool.execute(
      `UPDATE teachers SET phone=?, department=?, bio=? WHERE user_id=?`,
      [phone||null, department||null, bio||null, req.user.id]
    );
    await logAction(req.user.id, 'UPDATE_TEACHER_PROFILE', 'teachers', null, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateTeacherProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getProfile, changePassword, updateAvatar,
  updateStudentProfile, updateTeacherProfile
};
