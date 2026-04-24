// server.js — with Socket.io real-time notifications
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const http       = require('http');
const { Server } = require('socket.io');

const { testConnection }  = require('./config/database');
const { runMigrations }   = require('./config/migrate');
const { runMigrationsV2 } = require('./config/migrate_v2');
const { seed: seedDatabase } = require('./config/seed');
// Socket.io - safely load
let initSocket = () => {};
try {
  initSocket = require('./socket').initSocket;
} catch (e) {
  console.warn('⚠️  socket.js not found — real-time disabled. Add backend/src/socket.js to enable.');
}

const authRoutes         = require('./routes/auth.routes');
const studentRoutes      = require('./routes/student.routes');
const scheduleRoutes     = require('./routes/schedule.routes');
const attendanceRoutes   = require('./routes/attendance.routes');
const settingsRoutes     = require('./routes/settings.routes');
const adminRoutes        = require('./routes/admin.routes');
const announcementRoutes = require('./routes/announcement.routes');
const appealRoutes       = require('./routes/appeal.routes');
const assignmentRoutes   = require('./routes/assignment.routes');
const calendarRoutes     = require('./routes/calendar.routes');
const configRoutes       = require('./routes/config.routes');
const dashboardRoutes    = require('./routes/dashboard.routes');
const gradeRoutes        = require('./routes/grade.routes');
const importRoutes       = require('./routes/import.routes');
const materialRoutes     = require('./routes/material.routes');
const messageRoutes      = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const promotionRoutes    = require('./routes/promotion.routes');
// report.routes — new file, safe load
let reportRoutes = require('express').Router();
try { reportRoutes = require('./routes/report.routes'); } catch (e) {
  console.warn('⚠️  report.routes.js not found — /api/reports disabled');
}

// ai.routes — new file, safe load
let aiRoutes = require('express').Router();
try { aiRoutes = require('./routes/ai.routes'); } catch (e) {
  console.warn('⚠️  ai.routes.js not found — /api/ai disabled');
}

// learn.routes — new file, safe load
let learnRoutes = require('express').Router();
try { learnRoutes = require('./routes/learn.routes'); } catch (e) {
  console.warn('⚠️  learn.routes.js not found — /api/learn disabled');
}
const searchRoutes       = require('./routes/search.routes');
const sectionRoutes      = require('./routes/section.routes');
const subjectRoutes      = require('./routes/subject.routes');
const teacherRoutes      = require('./routes/teacher.routes');

const app    = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET','POST'],
    credentials: true,
  },
  transports: ['websocket','polling'],
});
global._io = io;
initSocket(io);

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',          authRoutes);
app.use('/api/students',      studentRoutes);
app.use('/api/schedules',     scheduleRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/appeals',       appealRoutes);
app.use('/api/assignments',   assignmentRoutes);
app.use('/api/calendar',      calendarRoutes);
app.use('/api/config',        configRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/grades',        gradeRoutes);
app.use('/api/import',        importRoutes);
app.use('/api/materials',     materialRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotion',     promotionRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/learn',          learnRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/sections',      sectionRoutes);
app.use('/api/subjects',      subjectRoutes);
app.use('/api/teachers',      teacherRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
(async () => {
  await testConnection();
  await runMigrations();
  await runMigrationsV2();
  await seedDatabase();
  server.listen(PORT, () => {
    console.log(`🚀 SSMLS running on port ${PORT}`);
    console.log(`🔌 Socket.io ready`);
  });
})();
