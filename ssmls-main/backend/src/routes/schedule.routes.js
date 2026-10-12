/* @v2-fixed-imports */
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/schedule.controller');
const { getAllSchedules } = require('../controllers/schedule.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { pool } = require('../config/database');

router.use(authenticate);

// ── Static named routes FIRST (before any /:id routes) ──────────────────────

router.post('/', authorize('teacher','admin'), ctrl.createSchedule);

// GET /api/schedules/my — teacher's own approved schedules by user.id
// MUST be before /:id routes or Express will treat 'my' as an id param
router.get('/my', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, sub.name AS subject, sub.name AS subject_name, sub.code,
         sec.section_name, sec.grade_level, sec.strand,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t   ON t.id   = s.teacher_id
       JOIN users u      ON u.id   = t.user_id
       WHERE t.user_id = ? AND s.status = 'approved'
       ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
                s.start_time`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /schedules/my:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/teacher/:teacherId', ctrl.getTeacherSchedule);
router.get('/section/:sectionId', ctrl.getSectionSchedule);
router.get('/pending',            authorize('admin'), ctrl.getPendingSchedules);
router.get('/all',                authorize('admin'), getAllSchedules);

// ── Dynamic /:id routes LAST ─────────────────────────────────────────────────
router.patch('/:id/approve', authorize('admin'),            ctrl.approveSchedule);
router.delete('/:id',        authorize('teacher','admin'),  ctrl.deleteSchedule);

module.exports = router;
