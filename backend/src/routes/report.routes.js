// report.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
<<<<<<< HEAD
const { getStudentReport, getClassReport } = require('../controllers/report.controller');
=======
const { getStudentReport, getClassReport, getRanking, getAtRisk, getReportCard } = require('../controllers/report.controller');
>>>>>>> 645db23 (V-Smart Update)

// GET /api/reports/student/:studentId
router.get('/student/:studentId',
  authenticate,
  authorize('admin', 'teacher'),
  getStudentReport
);

// GET /api/reports/class/:scheduleId
router.get('/class/:scheduleId',
  authenticate,
  authorize('admin', 'teacher'),
  getClassReport
);

<<<<<<< HEAD
=======
// GET /api/reports/ranking/:sectionId — class ranking by GWA
router.get('/ranking/:sectionId', authenticate, authorize('admin', 'teacher'), getRanking);

// GET /api/reports/at-risk — students with failing grades
router.get('/at-risk', authenticate, authorize('admin', 'teacher'), getAtRisk);

// GET /api/reports/report-card/:studentId — Form 138 (students: own only)
router.get('/report-card/:studentId', authenticate, authorize('admin', 'teacher', 'student'), getReportCard);

>>>>>>> 645db23 (V-Smart Update)
module.exports = router;
