const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Security headers
app.use(helmet());

// ── CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Global rate limiter (100 req / 15 min per IP)
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// ── Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts. Account locked for 10 minutes.' },
});

// ── Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes
const authRoutes        = require('./routes/auth.routes');
const studentRoutes     = require('./routes/student.routes');
const teacherRoutes     = require('./routes/teacher.routes');
const adminRoutes       = require('./routes/admin.routes');
const attendanceRoutes  = require('./routes/attendance.routes');
const scheduleRoutes    = require('./routes/schedule.routes');
const assignmentRoutes  = require('./routes/assignment.routes');
const gradeRoutes       = require('./routes/grade.routes');
const materialRoutes    = require('./routes/material.routes');
const sectionRoutes     = require('./routes/section.routes');
const announcementRoutes = require('./routes/announcement.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const settingsRoutes    = require('./routes/settings.routes');
const subjectRoutes     = require('./routes/subject.routes');

app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/students',      studentRoutes);
app.use('/api/teachers',      teacherRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/schedules',     scheduleRoutes);
app.use('/api/assignments',   assignmentRoutes);
app.use('/api/grades',        gradeRoutes);
app.use('/api/materials',     materialRoutes);
app.use('/api/sections',      sectionRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/subjects',      subjectRoutes);

// ── Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SSMLS API is running', timestamp: new Date().toISOString() });
});

// ── 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
