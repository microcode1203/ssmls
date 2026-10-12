const express = require('express');
const router  = express.Router();
const { getGrades, upsertGrade } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',    getGrades);
router.post('/',   authorize('teacher','admin'), upsertGrade);

module.exports = router;
