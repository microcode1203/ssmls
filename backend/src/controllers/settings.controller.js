const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// GET /api/settings/profile
const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.last_login, u.avatar_url,
         s.id as student_db_id, s.lrn, s.grade_level, s.strand, s.phone as student_phone,
         s.guardian_name, s.guardian_phone, s.address, s.birthday,
         sec.section_name, sec.id as section_id, sec.strand as section_strand,
         t.id as teacher_db_id, t.employee_id, t.department, t.phone as teacher_phone, t.bio
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    const u = rows[0];
    res.json({
      success: true,
      data: {
        id: u.id, firstName: u.first_name, lastName: u.last_name,
        email: u.email, role: u.role, lastLogin: u.last_login, avatarUrl: u.avatar_url,
        // student fields
        studentId: u.student_db_id, lrn: u.lrn, gradeLevel: u.grade_level,
        strand: u.strand, sectionName: u.section_name, sectionId: u.section_id,
        birthday: u.birthday, address: u.address,
        guardianName: u.guardian_name, guardianPhone: u.guardian_phone,
        studentPhone: u.student_phone,
        // teacher fields
        teacherId: u.teacher_db_id, employeeId: u.employee_id,
        department: u.department, teacherPhone: u.teacher_phone, bio: u.bio,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
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

    const [rows] = await pool.execute(`SELECT password_hash FROM users WHERE id=?`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.user.id]);
    await logAction(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/avatar
const updateAvatar = async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) return res.status(400).json({ success: false, message: 'Avatar URL required.' });

    // Check if column exists, add if not
    try {
      await pool.execute(`UPDATE users SET avatar_url=? WHERE id=?`, [avatarUrl, req.user.id]);
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL`);
        await pool.execute(`UPDATE users SET avatar_url=? WHERE id=?`, [avatarUrl, req.user.id]);
      } else throw colErr;
    }

    await logAction(req.user.id, 'UPDATE_AVATAR', 'users', req.user.id, null, req.ip);
    res.json({ success: true, message: 'Profile photo updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/student-profile  (student only)
const updateStudentProfile = async (req, res) => {
  try {
    const { birthday, address, phone, guardianName, guardianPhone } = req.body;
    const [sRows] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
    if (!sRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    // Add birthday column if missing
    try {
      await pool.execute(
        `UPDATE students SET birthday=?, address=?, phone=?, guardian_name=?, guardian_phone=? WHERE user_id=?`,
        [birthday||null, address||null, phone||null, guardianName||null, guardianPhone||null, req.user.id]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(`ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday DATE NULL`);
        await pool.execute(`ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT NULL`);
        await pool.execute(
          `UPDATE students SET birthday=?, address=?, phone=?, guardian_name=?, guardian_phone=? WHERE user_id=?`,
          [birthday||null, address||null, phone||null, guardianName||null, guardianPhone||null, req.user.id]
        );
      } else throw colErr;
    }

    await logAction(req.user.id, 'UPDATE_STUDENT_PROFILE', 'students', sRows[0].id, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/settings/teacher-profile  (teacher only)
const updateTeacherProfile = async (req, res) => {
  try {
    const { phone, department, bio } = req.body;
    const [tRows] = await pool.execute(`SELECT id FROM teachers WHERE user_id=?`, [req.user.id]);
    if (!tRows.length) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    try {
      await pool.execute(
        `UPDATE teachers SET phone=?, department=?, bio=? WHERE user_id=?`,
        [phone||null, department||null, bio||null, req.user.id]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bio TEXT NULL`);
        await pool.execute(
          `UPDATE teachers SET phone=?, department=?, bio=? WHERE user_id=?`,
          [phone||null, department||null, bio||null, req.user.id]
        );
      } else throw colErr;
    }

    await logAction(req.user.id, 'UPDATE_TEACHER_PROFILE', 'teachers', tRows[0].id, null, req.ip);
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProfile, changePassword, updateAvatar, updateStudentProfile, updateTeacherProfile };
