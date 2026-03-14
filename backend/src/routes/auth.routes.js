// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { login, getMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
