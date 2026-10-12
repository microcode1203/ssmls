// Student-facing online exam routes.  Mount in app.js:
//   app.use('/api/exam-online', require('./routes/examOnline.routes'));
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const o = require('../controllers/examOnline.controller');

router.use(authenticate, authorize('student'));

router.post('/preview', o.preview);                       // check the exam code, show rules
router.post('/start', o.start);                           // create or resume the attempt
router.put('/attempts/:id/answers', o.saveAnswers);       // autosave
router.post('/attempts/:id/heartbeat', o.heartbeat);      // keep-alive + server clock
router.post('/attempts/:id/event', o.event);              // tab switch / fullscreen exit etc.
router.post('/attempts/:id/submit', o.submit);

module.exports = router;
