// ai.routes.js
// Place in: backend/src/routes/ai.routes.js

const express = require('express')
const router  = express.Router()
const { authenticate } = require('../middleware/auth.middleware')
const { chat } = require('../controllers/ai.controller')

// POST /api/ai/chat — requires login
router.post('/chat', authenticate, chat)

module.exports = router
