// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `SELECT e.*, u.first_name, u.last_name
      FROM calendar_events e JOIN users u ON u.id=e.created_by
      WHERE e.target_role='all' OR e.target_role=?`;
    const params = [req.user.role];
    if (month && year) {
      query += ` AND (MONTH(e.event_date)=? AND YEAR(e.event_date)=?)`;
      params.push(month, year);
    }
    query += ` ORDER BY e.event_date ASC`;
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/', authorize('admin','teacher'), async (req, res) => {
  try {
    const { title, description, eventDate, endDate, type, targetRole } = req.body;
    if (!title || !eventDate)
      return res.status(400).json({ success: false, message: 'Title and date required.' });
    await pool.execute(
      `INSERT INTO calendar_events (title, description, event_date, end_date, type, target_role, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [title, description||null, eventDate, endDate||null, type||'other', targetRole||'all', req.user.id]
    );
    res.status(201).json({ success: true, message: 'Event created.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/:id', authorize('admin','teacher'), async (req, res) => {
  try {
    await pool.execute(`DELETE FROM calendar_events WHERE id=? AND (created_by=? OR ?)`,
      [req.params.id, req.user.id, req.user.role==='admin']);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
