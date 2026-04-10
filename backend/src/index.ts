import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { assessmentRouter } from './routes/assessments';
import { surveyRouter } from './routes/survey';
import { reportRouter } from './routes/reports';
import { paymentRouter } from './routes/payments';
import { adminRouter } from './routes/admin';
import { webhookRouter } from './routes/webhook';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';

dotenv.config();

// ── FIX 1: Validate required env vars at startup ────────────────
const REQUIRED_ENV = [
  'SECRET_KEY', 'DATABASE_URL', 'STRIPE_API_KEY',
  'STRIPE_WEBHOOK_SIGNING_SECRET', 'LLM_PROVIDER_API_KEY',
  'FRONTEND_URL', 'CORS_ORIGIN',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n❌ FATAL: Missing required environment variables:\n  ${missing.join('\n  ')}\n`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);
app.use(express.json({ limit: '10mb' }));

// ── FIX 2: Rate limiting ────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { error: 'Too many login attempts. Try again in an hour.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// FIX 3: Survey submission rate limiter (prevents bot flooding)
const surveyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  message: { error: 'Submission limit reached. Please wait before submitting again.' },
});
app.use('/api/survey/:token/submit', surveyLimiter);

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/survey', surveyRouter);
app.use('/api/reports', reportRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0' });
});

// ── GDPR data deletion ──────────────────────────────────────────
app.post('/api/data-deletion-request', async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const { pool } = await import('./lib/db');
    await pool.query(
      `INSERT INTO data_deletion_requests (email, reason) VALUES ($1, $2)`,
      [email, reason || null]
    );
    res.json({ message: 'Request received. We will process it within 30 days.' });
  } catch (err) {
    logger.error('Data deletion request error', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// FIX 4: Internal cron endpoint — secured with INTERNAL_SECRET header
app.post('/api/internal/process-reminders', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (process.env.NODE_ENV === 'production' && secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { processReminderQueue } = await import('./services/emailService');
    await processReminderQueue();
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`✅ CRI Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
});

export default app;
