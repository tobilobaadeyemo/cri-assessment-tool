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

const app = express();
const PORT = process.env.PORT || 8080;

// ── Security middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook needs raw body BEFORE json parsing
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter limits on auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/survey', surveyRouter);
app.use('/api/reports', reportRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);

// ── Health check ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── GDPR/POPIA/NDPA - Data deletion endpoint ───────────────────
app.post('/api/data-deletion-request', async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { pool } = await import('./lib/db');
    await pool.query(
      `INSERT INTO data_deletion_requests (email, reason) VALUES ($1, $2)`,
      [email, reason || null]
    );
    res.json({ message: 'Data deletion request received. We will process it within 30 days.' });
  } catch (err) {
    logger.error('Data deletion request error', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// ── Error handler ──────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`CRI Backend running on port ${PORT}`);
});

export default app;
