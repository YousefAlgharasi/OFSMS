require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// ── Firebase: initialize before any route that may send notifications ─────────
require('./config/firebase');

// ── Scheduler: register monthly cron jobs ────────────────────────────────────
const { initScheduler } = require('./scheduler');

// ── Security middleware (helmet + HSTS + HTTPS redirect) ─────────────────────
const { applySecurityMiddleware } = require('./middleware/security');

const app = express();
app.set('etag', false); // ← add this
const PORT = process.env.PORT || 4000;

// ── Security (must come before routes and other middleware) ───────────────────
applySecurityMiddleware(app);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing & logging ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  // `commit` lets you check which version is live (set by Render on every deploy)
  const commit = (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || undefined;
  res.json({ status: 'ok', commit, timestamp: new Date().toISOString() });
});

// ── Local static files (dev storage fallback) ────────────────────────────────
// Files are served only through the authenticated /api/documents routes in production
if (process.env.NODE_ENV !== 'production') app.use('/local-files', express.static(process.env.UPLOADS_DIR || path.resolve(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./modules/auth/auth.routes'));
app.use('/api/orphans',      require('./modules/orphans/orphans.routes'));
app.use('/api/families',     require('./modules/families/families.routes'));
app.use('/api/documents',    require('./modules/documents/documents.routes'));
app.use('/api/sponsors',     require('./modules/sponsors/sponsors.routes'));
app.use('/api/sponsor',      require('./modules/sponsor-portal/sponsorPortal.routes'));
app.use('/api/governorates', require('./modules/governorates/governorates.routes'));
app.use('/api/dashboard',    require('./modules/dashboard/dashboard.routes'));
app.use('/api/quran-reports',  require('./modules/quran/quran.routes'));
app.use('/api/disbursements',  require('./modules/disbursements/disbursements.routes'));
app.use('/api/receipts',       require('./modules/receipts/receipts.routes'));
app.use('/api/notifications',  require('./modules/notifications/notifications.routes'));
app.use('/api/audit-logs', require('./modules/users/users.routes'));
app.use('/api/announcements',  require('./modules/announcements/announcements.routes'));
app.use('/api/ads',            require('./modules/ads/ads.routes'));
app.use('/api/reports',        require('./modules/reports/reports.routes'));
app.use('/api/users',          require('./modules/users/users.routes'));
app.use('/api/quran-thresholds', require('./modules/quran/thresholds.routes'));
app.use('/api/reports',          require('./modules/reports/reports.routes'));
app.use('/api/supervisor',       require('./modules/supervisor/supervisor.routes'));
app.use('/api/landing',          require('./modules/landing/landing.routes'));
app.use('/api/in-kind',          require('./modules/in-kind/inKind.routes'));
app.use('/api/educational',      require('./modules/educational/educational.routes'));
app.use('/api/evaluations',      require('./modules/evaluations/evaluations.routes'));
app.use('/api/settings',         require('./modules/settings/settings.routes'));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  // Database errors get a clear Arabic message instead of the raw SQL text
  if (err.code === '23505') return res.status(409).json({ error: 'هذه القيمة مسجّلة مسبقاً' });
  if (err.code === '22001') return res.status(400).json({ error: 'أحد الحقول أطول من الحد المسموح' });
  if (err.code === '22P02' || err.code === '23502' || err.code === '23514' || err.code === '23503') {
    return res.status(400).json({ error: 'بيانات غير صالحة' });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 && process.env.NODE_ENV === 'production'
      ? 'خطأ داخلي في الخادم'
      : err.message || 'خطأ داخلي في الخادم',
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ OFSMS backend running on port ${PORT}`);
  initScheduler();
});

module.exports = app;
