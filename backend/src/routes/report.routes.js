// report.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { getStudentReport, getClassReport } = require('../controllers/report.controller');

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

module.exports = router;
