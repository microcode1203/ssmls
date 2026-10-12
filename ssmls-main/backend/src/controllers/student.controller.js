const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// GET /api/students
const getAllStudents = async (req, res) => {
  try {
    const { gradeLevel, sectionId, strand, status, search } = req.query;
    const isTeacher = req.user.role === 'teacher';

    let teacherSectionIds = [];
    if (isTeacher) {
      const { rows: tRows } = await pool.query(`SELECT id FROM teachers WHERE user_id = $1`, [req.user.id]);
      if (tRows.length) {
        const { rows: schedRows } = await pool.query(
          `SELECT DISTINCT section_id FROM schedules WHERE teacher_id = $1 AND status = 'approved'`,
          [tRows[0].id]
        );
        teacherSectionIds = schedRows.map(r => r.section_id);
      }
      if (!teacherSectionIds.length) return res.json({ success: true, data: [], total: 0 });
    }

    const params = [];
    let query = `
      SELECT s.id, s.lrn, s.grade_level, s.strand, s.status, s.phone,
        s.birthday, s.birthplace,
        u.id as user_id, u.first_name, u.middle_name, u.last_name, u.email,
        sec.section_name, sec.id as section_id
      FROM students s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE u.is_active = TRUE
    `;

    if (isTeacher && teacherSectionIds.length) {
      params.push(teacherSectionIds);
      query += ` AND s.section_id = ANY($${params.length})`;
    }
    if (gradeLevel) { params.push(gradeLevel); query += ` AND s.grade_level = $${params.length}`; }
    if (sectionId)  { params.push(sectionId);  query += ` AND s.section_id = $${params.length}`; }
    if (strand)     { params.push(strand);      query += ` AND s.strand = $${params.length}`; }
    if (status)     { params.push(status);      query += ` AND s.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR s.lrn ILIKE $${params.length})`;
    }
    query += ' ORDER BY sec.section_name, u.last_name, u.first_name';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('getAllStudents error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.first_name, u.middle_name, u.last_name, u.email,
         sec.section_name, sec.grade_level as sec_grade
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/students
const createStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      firstName, middleName, lastName, email, password, lrn,
      gradeLevel, sectionId, strand, phone,
      birthday, birthplace, guardianName, guardianPhone
    } = req.body;

    const cleanLrn = String(lrn || '').trim();
    if (!/^\d{12}$/.test(cleanLrn)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'LRN must be exactly 12 digits.' });
    }

    const { rows: emailCheck } = await client.query(
      `SELECT id FROM users WHERE email = $1 AND is_active = TRUE`, [email.toLowerCase().trim()]
    );
    if (emailCheck.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email is already in use by an active account.' });
    }

    const { rows: lrnCheck } = await client.query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE s.lrn = $1 AND u.is_active = TRUE`,
      [cleanLrn]
    );
    if (lrnCheck.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'LRN is already assigned to an active student.' });
    }

    const hash = await bcrypt.hash(password || 'Student@2026', 12);
    const { rows: userRes } = await client.query(
      `INSERT INTO users (first_name, middle_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'student') RETURNING id`,
      [firstName, middleName || null, lastName, email.toLowerCase().trim(), hash]
    );

    await client.query(
      `INSERT INTO students (user_id, lrn, grade_level, section_id, strand, phone, birthday, birthplace, guardian_name, guardian_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userRes[0].id, cleanLrn, gradeLevel, sectionId || null, strand,
       phone || null, birthday || null, birthplace || null, guardianName || null, guardianPhone || null]
    );

    await client.query('COMMIT');
    await logAction(req.user.id, 'CREATE_STUDENT', 'students', userRes[0].id, { lrn: cleanLrn }, req.ip);
    res.status(201).json({ success: true, message: 'Student created successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createStudent error:', err);
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email or LRN is already in use.' });
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  } finally {
    client.release();
  }
};

// PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const { firstName, middleName, lastName, gradeLevel, sectionId, strand, status, phone, birthday, birthplace } = req.body;
    const { id } = req.params;

    const { rows: st } = await pool.query(`SELECT user_id FROM students WHERE id = $1`, [id]);
    if (!st.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    await pool.query(
      `UPDATE users SET first_name = $1, middle_name = $2, last_name = $3 WHERE id = $4`,
      [firstName, middleName || null, lastName, st[0].user_id]
    );
    await pool.query(
      `UPDATE students SET grade_level = $1, section_id = $2, strand = $3, status = $4,
         phone = $5, birthday = $6, birthplace = $7 WHERE id = $8`,
      [gradeLevel, sectionId || null, strand, status || 'active',
       phone || null, birthday || null, birthplace || null, id]
    );

    await logAction(req.user.id, 'UPDATE_STUDENT', 'students', id, req.body, req.ip);
    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT s.id, s.lrn, s.user_id, u.email FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    const { user_id, email, lrn } = rows[0];
    const ts = String(Date.now()).slice(-8);
    const freedEmail = `del${ts}_${email}`;
    const freedLrn   = `del${ts}`;

    await pool.query(`UPDATE users SET is_active = FALSE, email = $1 WHERE id = $2`, [freedEmail, user_id]);
    await pool.query(`UPDATE students SET lrn = $1, status = 'inactive' WHERE id = $2`, [freedLrn, id]);
    await logAction(req.user.id, 'DEACTIVATE_STUDENT', 'students', id, { original_email: email, original_lrn: lrn }, req.ip);

    res.json({ success: true, message: 'Student account deactivated.' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// POST /api/students/:id/reset-password
const resetStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const { rows } = await pool.query(
      `SELECT s.user_id, u.first_name, u.last_name FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND u.is_active = TRUE`, [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].user_id]);
    await logAction(req.user.id, 'RESET_STUDENT_PASSWORD', 'students', id, { studentName: rows[0].first_name + ' ' + rows[0].last_name }, req.ip);
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent, resetStudentPassword };
