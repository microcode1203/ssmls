const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAction } = require('../utils/audit');

// GET /api/students  (admin, teacher)
const getAllStudents = async (req, res) => {
  try {
    const { gradeLevel, sectionId, strand, status, search } = req.query;
    let query = `
      SELECT s.id, s.lrn, s.grade_level, s.strand, s.status, s.phone,
        u.id as user_id, u.first_name, u.last_name, u.email,
        sec.section_name, sec.id as section_id
      FROM students s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE u.is_active = 1
    `;
    const params = [];
    if (gradeLevel) { query += ' AND s.grade_level = ?'; params.push(gradeLevel); }
    if (sectionId)  { query += ' AND s.section_id = ?';  params.push(sectionId); }
    if (strand)     { query += ' AND s.strand = ?';      params.push(strand); }
    if (status)     { query += ' AND s.status = ?';      params.push(status); }
    if (search)     { query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR s.lrn LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY sec.section_name, u.last_name, u.first_name';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.first_name, u.last_name, u.email,
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
    const { firstName, lastName, email, password, lrn, gradeLevel, sectionId, strand, phone, guardianName, guardianPhone } = req.body;

    const hash = await bcrypt.hash(password || 'Student@2026', 12);
    const [userRes] = await conn.execute(
      `INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'student')`,
      [firstName, lastName, email, hash]
    );

    await conn.execute(
      `INSERT INTO students (user_id, lrn, grade_level, section_id, strand, phone, guardian_name, guardian_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userRes.insertId, lrn, gradeLevel, sectionId || null, strand, phone || null, guardianName || null, guardianPhone || null]
    );

    await conn.commit();
    await logAction(req.user.id, 'CREATE_STUDENT', 'students', userRes.insertId, { lrn }, req.ip);
    res.status(201).json({ success: true, message: 'Student created successfully.' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Email or LRN already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
};

// PUT /api/students/:id  (admin)
const updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, gradeLevel, sectionId, strand, status, phone } = req.body;
    const { id } = req.params;

    const [st] = await pool.execute(`SELECT user_id FROM students WHERE id=?`, [id]);
    if (!st.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    await pool.execute(
      `UPDATE users SET first_name=?, last_name=? WHERE id=?`,
      [firstName, lastName, st[0].user_id]
    );
    await pool.execute(
      `UPDATE students SET grade_level=?, section_id=?, strand=?, status=?, phone=? WHERE id=?`,
      [gradeLevel, sectionId || null, strand, status || 'active', phone || null, id]
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

    // Get student details before deactivating
    const [rows] = await pool.execute(
      `SELECT s.id, s.lrn, s.user_id, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    const { user_id, email, lrn } = rows[0];

    // Append a unique suffix to free up email and LRN
    // so the same email/LRN can be reused when adding a new student
    const suffix = '_deleted_' + Date.now();
    const freedEmail = email + suffix;
    const freedLrn   = lrn   + suffix;

    // Deactivate and free up the unique email
    await pool.execute(
      'UPDATE users SET is_active = 0, email = ? WHERE id = ?',
      [freedEmail, user_id]
    );

    // Free up the unique LRN and mark student inactive
    await pool.execute(
      'UPDATE students SET lrn = ?, status = ? WHERE id = ?',
      [freedLrn, 'inactive', id]
    );

    await logAction(req.user.id, 'DEACTIVATE_STUDENT', 'students', id, { email, lrn }, req.ip);
    res.json({ success: true, message: 'Student account deactivated.' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent };
