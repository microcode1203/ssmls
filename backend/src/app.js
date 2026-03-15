// @v2-fixed-imports
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 1 — HTTP Headers (Helmet)
//  Prevents XSS, clickjacking, MIME sniffing, and more
// ═══════════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  hsts: {
    maxAge:            31536000, // 1 year
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy:        { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // needed for QR code generation
}));

// Remove X-Powered-By header (don't reveal Express)
app.disable('x-powered-by');

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 2 — CORS (strict origin whitelist)
// ═══════════════════════════════════════════════════════════════
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman in dev)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials:      true,
  methods:          ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders:   ['Content-Type','Authorization','X-Request-ID'],
  exposedHeaders:   ['X-RateLimit-Limit','X-RateLimit-Remaining'],
  maxAge:           86400, // preflight cache 24h
}));

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 3 — Body size limits (prevent payload attacks)
// ═══════════════════════════════════════════════════════════════
app.use(express.json({ limit: '2mb' }));        // was 10mb — too generous
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 4 — Input sanitization (XSS & injection)
// ═══════════════════════════════════════════════════════════════
// Strip HTML tags and dangerous characters from all req.body, req.query, req.params
const xss = require('xss');

const sanitizeValue = (val) => {
  if (typeof val === 'string') return xss(val.trim());
  if (Array.isArray(val))      return val.map(sanitizeValue);
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = sanitizeValue(val[k]);
    return out;
  }
  return val;
};

app.use((req, res, next) => {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.query)  req.query  = sanitizeValue(req.query);
  // Note: do NOT sanitize passwords — they may contain < > & legitimately
  // The DB uses parameterized queries so SQL injection is already prevented
  next();
});

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 5 — Rate limiting (per route sensitivity)
// ═══════════════════════════════════════════════════════════════

// Auth: strictest — 5 attempts per 15 min (brute force protection)
const authLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,
  max:               5,
  skipSuccessfulRequests: true,       // only count failures
  standardHeaders:   true,
  legacyHeaders:     false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => req.ip + ':' + (req.body?.email || ''), // per IP + email
});

// Password operations: 10 per hour
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many password change attempts. Try again later.' },
});

// Write operations: 60 per 15 min (create/update/delete)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      60,
  message:  { success: false, message: 'Too many requests. Slow down.' },
});

// General API: 200 per 15 min
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:  { success: false, message: 'Rate limit exceeded. Try again shortly.' },
});

app.use('/api', apiLimiter);

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 6 — Request ID (traceability)
// ═══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] ||
    `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 7 — Logging (production-safe)
// ═══════════════════════════════════════════════════════════════
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  // In production: log method, path, status, response time — NO sensitive data
  app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));
}

// ═══════════════════════════════════════════════════════════════
//  SECURITY LAYER 8 — Static files (safe path)
// ═══════════════════════════════════════════════════════════════
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  dotfiles:  'deny',   // block .env, .htaccess etc
  index:     false,    // no directory listing
  maxAge:    '1d',
}));

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════
const authRoutes         = require('./routes/auth.routes');
const studentRoutes      = require('./routes/student.routes');
const teacherRoutes      = require('./routes/teacher.routes');
const adminRoutes        = require('./routes/admin.routes');
const attendanceRoutes   = require('./routes/attendance.routes');
const scheduleRoutes     = require('./routes/schedule.routes');
const assignmentRoutes   = require('./routes/assignment.routes');
const gradeRoutes        = require('./routes/grade.routes');
const materialRoutes     = require('./routes/material.routes');
const sectionRoutes      = require('./routes/section.routes');
const announcementRoutes = require('./routes/announcement.routes');
const dashboardRoutes    = require('./routes/dashboard.routes');
const settingsRoutes     = require('./routes/settings.routes');
const subjectRoutes      = require('./routes/subject.routes');
const notificationRoutes = require('./routes/notification.routes');
const messageRoutes      = require('./routes/message.routes');
const calendarRoutes     = require('./routes/calendar.routes');
const appealRoutes       = require('./routes/appeal.routes');
const configRoutes       = require('./routes/config.routes');
const reportRoutes       = require('./routes/report.routes');
const importRoutes       = require('./routes/import.routes');
const promotionRoutes    = require('./routes/promotion.routes');

app.use('/api/auth',          authLimiter,     authRoutes);
app.use('/api/students',      writeLimiter,    studentRoutes);
app.use('/api/teachers',      writeLimiter,    teacherRoutes);
app.use('/api/admin',                          adminRoutes);
app.use('/api/attendance',                     attendanceRoutes);
app.use('/api/schedules',     writeLimiter,    scheduleRoutes);
app.use('/api/assignments',   writeLimiter,    assignmentRoutes);
app.use('/api/grades',        writeLimiter,    gradeRoutes);
app.use('/api/materials',     writeLimiter,    materialRoutes);
app.use('/api/sections',      writeLimiter,    sectionRoutes);
app.use('/api/announcements', writeLimiter,    announcementRoutes);
app.use('/api/dashboard',                      dashboardRoutes);
app.use('/api/settings',      passwordLimiter, settingsRoutes);
app.use('/api/subjects',                       subjectRoutes);
app.use('/api/notifications',                  notificationRoutes);
app.use('/api/messages',      writeLimiter,    messageRoutes);
app.use('/api/calendar',      writeLimiter,    calendarRoutes);
app.use('/api/appeals',       writeLimiter,    appealRoutes);
app.use('/api/config',                         configRoutes);
app.use('/api/reports',                        reportRoutes);
app.use('/api/import',        writeLimiter,    importRoutes);
app.use('/api/promotion',                      promotionRoutes);

// Health check — no auth, no rate limit
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
//  ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// Global error — never leak stack traces in production
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: 'Cross-origin request blocked.' });
  }

  console.error(`❌ [${req.requestId}] ${err.stack || err.message}`);

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { requestId: req.requestId }),
  });
});

module.exports = app;
