const express = require('express');
const router  = express.Router();
const { getMaterials, createMaterial } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',    getMaterials);
router.post('/',   authorize('teacher','admin'), createMaterial);

// DELETE material
router.delete('/:id', authorize('teacher','admin'), async (req, res) => {
  try {
    const { pool } = require('../config/database');
    await pool.execute(`DELETE FROM learning_materials WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Material deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
