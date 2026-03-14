const express = require('express');
const router  = express.Router();
const { getAssignments, createAssignment, submitAssignment, gradeSubmission } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',                          getAssignments);
router.post('/',                         authorize('teacher','admin'), createAssignment);
router.post('/submit',                   authorize('student'), submitAssignment);
router.patch('/submissions/:id/grade',   authorize('teacher','admin'), gradeSubmission);

module.exports = router;
