const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/audit');

router.use(authenticate);

// GET all subjects
router.get('/', async (req, res) => {
  try {
    const { gradeLevel } = req.query;
    const [rows] = await pool.execute(
      `SELECT s.*,
         (SELECT COUNT(*) FROM schedules sc WHERE sc.subject_id = s.id AND sc.status='approved') as class_count
       FROM subjects s
       ${gradeLevel ? 'WHERE s.grade_level = ? OR s.grade_level = "Both"' : ''}
       ORDER BY s.grade_level, s.name`,
      gradeLevel ? [gradeLevel] : []
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET single subject
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM subjects WHERE id = ?`, [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST create subject (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { code, name, description, gradeLevel, units } = req.body;
    if (!code || !name)
      return res.status(400).json({ success: false, message: 'Code and name are required.' });

    await pool.execute(
      `INSERT INTO subjects (code, name, description, grade_level, units)
       VALUES (?, ?, ?, ?, ?)`,
      [code.toUpperCase().trim(), name.trim(), description || null, gradeLevel || 'Both', units || 1]
    );
    await logAction(req.user.id, 'CREATE_SUBJECT', 'subjects', null, { code, name }, req.ip);
    res.status(201).json({ success: true, message: 'Subject created successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Subject code already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT update subject (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { code, name, description, gradeLevel, units } = req.body;
    const { id } = req.params;

    const [exists] = await pool.execute(`SELECT id FROM subjects WHERE id = ?`, [id]);
    if (!exists.length)
      return res.status(404).json({ success: false, message: 'Subject not found.' });

    await pool.execute(
      `UPDATE subjects SET code=?, name=?, description=?, grade_level=?, units=? WHERE id=?`,
      [code.toUpperCase().trim(), name.trim(), description || null, gradeLevel || 'Both', units || 1, id]
    );
    await logAction(req.user.id, 'UPDATE_SUBJECT', 'subjects', id, { code, name }, req.ip);
    res.json({ success: true, message: 'Subject updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Subject code already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE subject (admin only) — blocked if used in schedules
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subject is used in any schedule
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM schedules WHERE subject_id = ?`, [id]
    );
    if (count.cnt > 0)
      return res.status(409).json({
        success: false,
        message: `Cannot delete — this subject is used in ${count.cnt} schedule(s). Remove those schedules first.`
      });

    await pool.execute(`DELETE FROM subjects WHERE id = ?`, [id]);
    await logAction(req.user.id, 'DELETE_SUBJECT', 'subjects', id, null, req.ip);
    res.json({ success: true, message: 'Subject deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
