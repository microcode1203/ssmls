const express = require('express');
const router  = express.Router();
const { getAnnouncements, createAnnouncement } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',    getAnnouncements);
router.post('/',   authorize('admin','teacher'), createAnnouncement);

module.exports = router;
