const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const c = require('../controllers/exam.controller');
const o = require('../controllers/examOnline.controller');

router.use(authenticate, authorize('admin', 'teacher'));

router.get('/', c.listExams);
router.post('/', c.createExam);
router.post('/ai-generate', c.aiGenerate);   // must stay above '/:id'

// online exam: attempts, review, retake (keep above '/:id')
router.get('/attempts/:attemptId', o.attemptDetail);
router.post('/attempts/:attemptId/review', o.reviewAttempt);
router.delete('/attempts/:attemptId', o.deleteAttempt);

router.get('/:id', c.getExam);
router.put('/:id', c.updateExam);
router.delete('/:id', c.deleteExam);
router.get('/:id/qr', c.examQr);
router.post('/:id/grade', c.gradeSubmission);
router.get('/:id/results', c.listResults);
router.get('/:id/attempts', o.listAttempts);
router.post('/:id/code', o.regenerateCode);

module.exports = router;
