const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/schedule.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/',                          authorize('teacher','admin'), ctrl.createSchedule);
router.get('/teacher/:teacherId',         ctrl.getTeacherSchedule);
router.get('/section/:sectionId',         ctrl.getSectionSchedule);
router.get('/pending',                    authorize('admin'), ctrl.getPendingSchedules);
router.patch('/:id/approve',              authorize('admin'), ctrl.approveSchedule);
router.delete('/:id',                     authorize('teacher','admin'), ctrl.deleteSchedule);

module.exports = router;
