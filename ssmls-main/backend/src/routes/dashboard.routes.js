const express = require('express');
const router  = express.Router();
const { getDashboard } = require('../controllers/main.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', getDashboard);

module.exports = router;
