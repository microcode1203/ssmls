// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { createNotification } = require('./notification.routes');

router.use(authenticate);

// GET inbox
router.get('/inbox', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.id, m.subject, m.body, m.is_read, m.created_at, m.parent_id,
         u.first_name, u.last_name, u.role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.receiver_id = ?
       ORDER BY m.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: rows, unread: rows.filter(r=>!r.is_read).length });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET sent
router.get('/sent', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
         u.first_name, u.last_name, u.role
       FROM messages m JOIN users u ON u.id = m.receiver_id
       WHERE m.sender_id = ?
       ORDER BY m.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET users can message (teachers see their students; students see their teachers)
router.get('/contacts', async (req, res) => {
  try {
    let rows = [];
    if (req.user.role === 'student') {
      // Students can message their teachers
      const [s] = await pool.execute(`SELECT section_id FROM students WHERE user_id=?`, [req.user.id]);
      if (s.length) {
        [rows] = await pool.execute(
          `SELECT DISTINCT u.id, u.first_name, u.last_name, u.role
           FROM users u JOIN teachers t ON t.user_id=u.id
           JOIN schedules sc ON sc.teacher_id=t.id
           JOIN students st ON st.section_id=sc.section_id
           WHERE st.user_id=? AND u.is_active=1 AND sc.status='approved'`,
          [req.user.id]
        );
      }
    } else if (req.user.role === 'teacher') {
      // Teachers can message their students
      const [t] = await pool.execute(`SELECT id FROM teachers WHERE user_id=?`, [req.user.id]);
      if (t.length) {
        [rows] = await pool.execute(
          `SELECT DISTINCT u.id, u.first_name, u.middle_name, u.last_name, u.role
           FROM users u JOIN students st ON st.user_id=u.id
           JOIN schedules sc ON sc.section_id=st.section_id
           WHERE sc.teacher_id=? AND u.is_active=1 AND sc.status='approved'`,
          [t[0].id]
        );
      }
    } else {
      // Admin can message everyone
      [rows] = await pool.execute(
        `SELECT id, first_name, last_name, role FROM users WHERE is_active=1 AND id!=? ORDER BY role, last_name`,
        [req.user.id]
      );
    }
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST send message
router.post('/', async (req, res) => {
  try {
    const { receiverId, subject, body, parentId } = req.body;
    if (!receiverId || !body?.trim())
      return res.status(400).json({ success: false, message: 'Receiver and body are required.' });

    const [result] = await pool.execute(
      `INSERT INTO messages (sender_id, receiver_id, subject, body, parent_id) VALUES (?,?,?,?,?)`,
      [req.user.id, receiverId, subject || 'No subject', body.trim(), parentId || null]
    );

    // Notify receiver
    const [sender] = await pool.execute(`SELECT first_name, last_name FROM users WHERE id=?`, [req.user.id]);
    if (sender.length) {
      await createNotification(
        receiverId, 'message',
        `New message from ${sender[0].first_name} ${sender[0].last_name}`,
        subject || body.slice(0, 60),
        '/messages'
      );
    }
    res.status(201).json({ success: true, message: 'Message sent.', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH mark as read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.execute(`UPDATE messages SET is_read=1 WHERE id=? AND receiver_id=?`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
