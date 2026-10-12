// learn.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getContent, createContent, deleteContent,
  completeContent, getMySchedules
} = require('../controllers/learn.controller');

// GET /api/learn/schedules — class selector (teacher + admin)
router.get('/schedules',
  authenticate,
  authorize('teacher', 'admin'),
  getMySchedules
);

// GET /api/learn/content — all roles
router.get('/content', authenticate, getContent);

// POST /api/learn/content — teacher + admin only
router.post('/content',
  authenticate,
  authorize('teacher', 'admin'),
  createContent
);

// DELETE /api/learn/content/:id
router.delete('/content/:id',
  authenticate,
  authorize('teacher', 'admin'),
  deleteContent
);

// POST /api/learn/content/:id/complete — track plays
router.post('/content/:id/complete', authenticate, completeContent);

module.exports = router;
