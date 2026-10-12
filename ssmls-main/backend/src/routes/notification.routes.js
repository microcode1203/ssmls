// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET notifications for current user
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(r => !r.is_read).length;
    res.json({ success: true, data: rows, unread });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH mark all as read
router.patch('/read-all', async (req, res) => {
  try {
    await pool.execute(`UPDATE notifications SET is_read=1 WHERE user_id=?`, [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH mark single as read
router.delete('/clear', async (req, res) => {
  try {
    await pool.execute(`DELETE FROM notifications WHERE user_id=? AND is_read=1`, [req.user.id]);
    res.json({ success: true, message: 'Cleared read notifications.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});


router.patch('/:id/read', async (req, res) => {
  try {
    await pool.execute(
      `UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// DELETE clear all read

// Helper — create notification (used internally by other routes)
const createNotification = async (userId, type, title, body, link = null) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)`,
      [userId, type, title, body, link]
    );
  } catch {}
};

module.exports = router;
module.exports.createNotification = createNotification;
