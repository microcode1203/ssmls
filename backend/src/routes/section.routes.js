const express = require('express');
const router  = express.Router();
const { getSections, createSection } = require('../controllers/main.controller');
const { authenticate, authorize }    = require('../middleware/auth.middleware');
const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

router.use(authenticate);

router.get('/', getSections);

router.post('/', authorize('admin'), createSection);

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { sectionName, gradeLevel, strand, adviserId } = req.body;
    const { id } = req.params;
    const [exists] = await pool.execute(`SELECT id FROM sections WHERE id=?`, [id]);
    if (!exists.length)
      return res.status(404).json({ success: false, message: 'Section not found.' });
    await pool.execute(
      `UPDATE sections SET section_name=?, grade_level=?, strand=?, adviser_id=? WHERE id=?`,
      [sectionName, gradeLevel, strand, adviserId||null, id]
    );
    await logAction(req.user.id, 'UPDATE_SECTION', 'sections', id, req.body, req.ip);
    res.json({ success: true, message: 'Section updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // FIX: must check BOTH students.status AND users.is_active
    // Deleted students have is_active=0 so they should NOT block deletion
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) as cnt
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.section_id = ?
         AND s.status = 'active'
         AND u.is_active = 1`,
      [id]
    );

    if (count.cnt > 0)
      return res.status(409).json({
        success: false,
        message: `Cannot delete — this section has ${count.cnt} active student(s). Delete or reassign them first.`
      });

    await pool.execute(`DELETE FROM sections WHERE id=?`, [id]);
    await logAction(req.user.id, 'DELETE_SECTION', 'sections', id, null, req.ip);
    res.json({ success: true, message: 'Section deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
