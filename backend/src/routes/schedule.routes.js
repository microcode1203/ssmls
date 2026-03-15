const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/schedule.controller');
const { getAllSchedules } = require('../controllers/schedule.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/',                          authorize('teacher','admin'), ctrl.createSchedule);
router.get('/teacher/:teacherId',         ctrl.getTeacherSchedule);
router.get('/section/:sectionId',         ctrl.getSectionSchedule);
router.get('/pending',                    authorize('admin'), ctrl.getPendingSchedules);
router.get('/all',                        authorize('admin'), ctrl.getPendingSchedules); // alias
router.get('/all',                        authorize('admin'), getAllSchedules);
router.patch('/:id/approve',              authorize('admin'), ctrl.approveSchedule);
router.delete('/:id',                     authorize('teacher','admin'), ctrl.deleteSchedule);

// GET /api/schedules/my — Teacher's own schedules by user.id (no teacherId needed)
router.get('/my', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const [rows] = await pool.execute(
      `SELECT s.*, sub.name as subject, sub.name as subject_name, sub.code,
         sec.section_name, sec.grade_level, sec.strand,
         t.id as teacher_id_val,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub  ON sub.id = s.subject_id
       JOIN sections sec  ON sec.id = s.section_id
       JOIN teachers t    ON t.id   = s.teacher_id
       JOIN users u       ON u.id   = t.user_id
       WHERE t.user_id = ? AND s.status = 'approved'
       ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
                s.start_time`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /schedules/my error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
