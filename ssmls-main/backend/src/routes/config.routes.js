// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// PUBLIC: school name + logo (needed by the login page before anyone is signed in)
router.get('/branding', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT config_key, config_value FROM school_config WHERE config_key IN ('school_name', 'school_logo')`
    );
    const out = { school_name: '', school_logo: '' };
    rows.forEach(r => { out[r.config_key] = r.config_value; });
    res.set('Cache-Control', 'no-cache');
    res.json({ success: true, data: out });
  } catch (err) {
    console.error('Branding error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.use(authenticate);

// Logo is stored as a data URL. Allow only real image types and a sane size.
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const LOGO_MAX_CHARS = 700000; // ~500 KB of image data

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
    if (typeof updates.school_logo === 'string' && updates.school_logo !== '') {
      if (updates.school_logo.length > LOGO_MAX_CHARS || !LOGO_RE.test(updates.school_logo))
        return res.status(400).json({ success: false, message: 'Logo must be a PNG, JPG, WEBP or SVG image under 500 KB.' });
    }
    for (const [key, value] of Object.entries(updates)) {
      await pool.execute(
        `INSERT INTO school_config (config_key, config_value, updated_by) VALUES (?,?,?)
         ON CONFLICT (config_key) DO UPDATE
           SET config_value = EXCLUDED.config_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [key, String(value), req.user.id]
      );
    }
    res.json({ success: true, message: 'Configuration updated.' });
  } catch (err) { console.error('Config update error:', err); res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
