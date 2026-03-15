const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET all config (admin) or public config (others)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT config_key, config_value FROM school_config ORDER BY config_key`);
    const config = {};
    rows.forEach(r => { config[r.config_key] = r.config_value; });
    res.json({ success: true, data: config });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PUT update config (admin only)
router.put('/', authorize('admin'), async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await pool.execute(
        `INSERT INTO school_config (config_key, config_value, updated_by) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE config_value=?, updated_by=?`,
        [key, String(value), req.user.id, String(value), req.user.id]
      );
    }
    res.json({ success: true, message: 'Configuration updated.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
