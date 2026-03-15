const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// GET /api/students  (admin sees all; teacher sees only their sections)
const getAllStudents = async (req, res) => {
  try {
    const { gradeLevel, sectionId, strand, status, search } = req.query;
    const isTeacher = req.user.role === 'teacher';

    // For teachers: find the section IDs they actually teach
    let teacherSectionIds = [];
    if (isTeacher) {
      const [tRows] = await pool.execute(
        `SELECT id FROM teachers WHERE user_id = ?`, [req.user.id]
      );
      if (tRows.length) {
        const [schedRows] = await pool.execute(
          `SELECT DISTINCT section_id FROM schedules
           WHERE teacher_id = ? AND status = 'approved'`,
          [tRows[0].id]
        );
        teacherSectionIds = schedRows.map(r => r.section_id);
      }
      // Teacher with no schedules sees empty list
      if (!teacherSectionIds.length) {
        return res.json({ success: true, data: [], total: 0 });
      }
    }

    let query = `
      SELECT s.id, s.lrn, s.grade_level, s.strand, s.status, s.phone,
        s.birthday, s.birthplace,
        u.id as user_id, u.first_name, u.middle_name, u.last_name, u.email,
        sec.section_name, sec.id as section_id
      FROM students s
      JOIN users u   ON u.id   = s.user_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE u.is_active = 1
    `;
    const params = [];

    // Teachers only see students in their assigned sections
    if (isTeacher && teacherSectionIds.length) {
      query += ` AND s.section_id IN (${teacherSectionIds.map(() => '?').join(',')})`;
      params.push(...teacherSectionIds);
    }

    if (gradeLevel) { query += ' AND s.grade_level = ?'; params.push(gradeLevel); }
    if (sectionId)  { query += ' AND s.section_id = ?';  params.push(sectionId); }
    if (strand)     { query += ' AND s.strand = ?';      params.push(strand); }
    if (status)     { query += ' AND s.status = ?';      params.push(status); }
    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR s.lrn LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY sec.section_name, u.last_name, u.first_name';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('getAllStudents error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.first_name, u.middle_name, u.last_name, u.email,
         sec.section_name, sec.grade_level as sec_grade
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/students  (admin)
const createStudent = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      firstName, middleName, lastName, email, password, lrn,
      gradeLevel, sectionId, strand, phone,
      birthday, birthplace,
      guardianName, guardianPhone
    } = req.body;

    // Validate LRN — must be exactly 12 digits
    const cleanLrn = String(lrn || '').trim();
    if (!/^\d{12}$/.test(cleanLrn)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'LRN must be exactly 12 digits (numbers only).'
      });
    }

    // Check if email already used by an ACTIVE user
    const [emailCheck] = await conn.execute(
      `SELECT id FROM users WHERE email = ? AND is_active = 1`,
      [email.toLowerCase().trim()]
    );
    if (emailCheck.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Email is already in use by an active account.' });
    }

    // Check if LRN already used by an active student
    const [lrnCheck] = await conn.execute(
      `SELECT s.id FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.lrn = ? AND u.is_active = 1`,
      [cleanLrn]
    );
    if (lrnCheck.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'LRN is already assigned to an active student.' });
    }

    const hash = await bcrypt.hash(password || 'Student@2026', 12);

    const [userRes] = await conn.execute(
      `INSERT INTO users (first_name, middle_name, last_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, 'student')`,
      [firstName, middleName || null, lastName, email.toLowerCase().trim(), hash]
    );

    await conn.execute(
      `INSERT INTO students
         (user_id, lrn, grade_level, section_id, strand, phone,
          birthday, birthplace, guardian_name, guardian_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userRes.insertId, cleanLrn, gradeLevel,
        sectionId || null, strand,
        phone || null,
        birthday || null, birthplace || null,
        guardianName || null, guardianPhone || null
      ]
    );

    await conn.commit();
    await logAction(req.user.id, 'CREATE_STUDENT', 'students', userRes.insertId, { lrn: cleanLrn }, req.ip);
    res.status(201).json({ success: true, message: 'Student created successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('createStudent error:', err);
    // Fallback duplicate check (should not reach here with checks above)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email or LRN is already in use.' });
    }
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/students/:id  (admin)
const updateStudent = async (req, res) => {
  try {
    const { firstName, middleName, lastName, gradeLevel, sectionId, strand, status, phone, birthday, birthplace } = req.body;
    const { id } = req.params;

    const [st] = await pool.execute(`SELECT user_id FROM students WHERE id=?`, [id]);
    if (!st.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    await pool.execute(
      `UPDATE users SET first_name=?, middle_name=?, last_name=? WHERE id=?`,
      [firstName, middleName || null, lastName, st[0].user_id]
    );
    await pool.execute(
      `UPDATE students SET grade_level=?, section_id=?, strand=?, status=?, phone=?,
         birthday=?, birthplace=? WHERE id=?`,
      [gradeLevel, sectionId || null, strand, status || 'active', phone || null,
       birthday || null, birthplace || null, id]
    );

    await logAction(req.user.id, 'UPDATE_STUDENT', 'students', id, req.body, req.ip);
    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/students/:id  (admin)
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT s.id, s.lrn, s.user_id, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    const { user_id, email, lrn } = rows[0];

    // Use a short numeric suffix (last 8 digits of timestamp)
    // to stay well within column length limits
    const ts = String(Date.now()).slice(-8);
    const freedEmail = `del${ts}_${email}`;
    const freedLrn   = `del${ts}`;  // store short placeholder, original saved in audit log

    await pool.execute(
      `UPDATE users SET is_active = 0, email = ? WHERE id = ?`,
      [freedEmail, user_id]
    );

    await pool.execute(
      `UPDATE students SET lrn = ?, status = 'inactive' WHERE id = ?`,
      [freedLrn, id]
    );

    // Log original values so they are not lost
    await logAction(
      req.user.id, 'DEACTIVATE_STUDENT', 'students', id,
      { original_email: email, original_lrn: lrn }, req.ip
    );

    res.json({ success: true, message: 'Student account deactivated.' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// POST /api/students/:id/reset-password  (admin)
const resetStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const [rows] = await pool.execute(
      `SELECT s.user_id, u.first_name, u.middle_name, u.last_name
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE s.id=? AND u.is_active=1`,
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE users SET password_hash=? WHERE id=?`, [hash, rows[0].user_id]);
    await logAction(req.user.id, 'RESET_STUDENT_PASSWORD', 'students', id, { studentName: rows[0].first_name + ' ' + rows[0].last_name }, req.ip);

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('resetStudentPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent, resetStudentPassword };
