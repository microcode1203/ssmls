const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate-qr',         authorize('teacher'), ctrl.generateQR);
router.post('/scan',                authorize('student'), ctrl.scanQR);
router.get('/class/:classId',       authorize('teacher','admin'), ctrl.getClassAttendance);
router.get('/student/:studentId',   ctrl.getStudentAttendance);
router.patch('/close/:classId',     authorize('teacher','admin'), ctrl.closeAttendance);

module.exports = router;
