const express = require('express');
const router  = express.Router();
const { getSections, createSection } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',    getSections);
router.post('/',   authorize('admin'), createSection);

module.exports = router;
