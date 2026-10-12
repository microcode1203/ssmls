const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// Personal student QR badges (auto-derived from student id, no manual generation needed)
router.get('/my-qr',                authorize('student'), ctrl.getMyQR);
router.get('/qr/:studentId',        authorize('admin', 'teacher'), ctrl.getStudentQR);

// Teacher scans each student's badge instead of students scanning a projected code
router.post('/start-session',       authorize('teacher'), ctrl.startSession);
router.post('/scan-student',        authorize('teacher'), ctrl.scanStudentQR);

router.get('/class/:classId',       authorize('teacher','admin'), ctrl.getClassAttendance);
router.get('/student/:studentId',   ctrl.getStudentAttendance);
router.patch('/close/:classId',     authorize('teacher','admin'), ctrl.closeAttendance);

module.exports = router;
