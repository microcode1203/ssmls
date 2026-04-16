// server.js — with Socket.io real-time notifications
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const http       = require('http');
const { Server } = require('socket.io');

const { testConnection }   = require('./config/database');
const { runMigrations }    = require('./config/migrate');
const { runMigrationsV2 }  = require('./config/migrate_v2');
const { seedDatabase }     = require('./config/seed');
const { initSocket }       = require('./socket');

const authRoutes       = require('./routes/auth.routes');
const studentRoutes    = require('./routes/student.routes');
const scheduleRoutes   = require('./routes/schedule.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const mainRoutes       = require('./routes/main.routes');
const settingsRoutes   = require('./routes/settings.routes');
const reportRoutes     = require('./routes/report.routes');

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

app.use('/api/auth',       authRoutes);
app.use('/api/students',   studentRoutes);
app.use('/api/schedules',  scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api',            mainRoutes);
app.use('/api/settings',   settingsRoutes);
app.use('/api/reports',    reportRoutes);

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
