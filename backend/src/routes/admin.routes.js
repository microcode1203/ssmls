const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('admin'));

router.get('/audit-logs', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT l.*, u.first_name, u.last_name, u.role
     FROM audit_logs l JOIN users u ON u.id=l.user_id
     ORDER BY l.timestamp DESC LIMIT 100`
  );
  res.json({ success: true, data: rows });
});

router.get('/stats', async (req, res) => {
  const [[stats]] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE status='active')       as students,
      (SELECT COUNT(*) FROM teachers)                             as teachers,
      (SELECT COUNT(*) FROM sections)                             as sections,
      (SELECT COUNT(*) FROM schedules WHERE status='approved')    as classes,
      (SELECT COUNT(*) FROM schedules WHERE status='pending')     as pending,
      (SELECT COUNT(*) FROM attendance WHERE DATE(created_at)=CURDATE()) as today_att
  `);
  res.json({ success: true, data: stats });
});

module.exports = router;
