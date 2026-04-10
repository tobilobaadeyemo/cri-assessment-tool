import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { query } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { logger } from '../lib/logger';

export const authRouter = Router();

// ── Register ───────────────────────────────────────────────────
authRouter.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('orgName').trim().notEmpty(),
  body('gdprConsent').isBoolean().equals('true'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, orgName, industry, gdprConsent, popiaConsent, ndpaConsent } = req.body;
    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

      const hash = await bcrypt.hash(password, 12);
      const consentDate = new Date();

      const userResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, gdpr_consent, popia_consent, ndpa_consent, consent_date)
         VALUES ($1, $2, $3, $4, 'admin', $5, $6, $7, $8) RETURNING id`,
        [email, hash, firstName, lastName, gdprConsent, popiaConsent ?? false, ndpaConsent ?? false, consentDate]
      );
      const userId = userResult.rows[0].id;

      const orgResult = await query(
        `INSERT INTO organizations (owner_user_id, name, industry, plan, plan_status)
         VALUES ($1, $2, $3, 'trial', 'active') RETURNING id`,
        [userId, orgName, industry || null]
      );
      const orgId = orgResult.rows[0].id;

      await sendEmail({ to: email, type: 'welcome', data: { firstName, orgName } });

      const token = jwt.sign(
        { id: userId, email, role: 'admin', orgId },
        process.env.SECRET_KEY!,
        { expiresIn: '7d' }
      );
      res.status(201).json({ token, user: { id: userId, email, firstName, lastName, orgId } });
    } catch (err: any) {
      logger.error('Registration error', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ── Login ──────────────────────────────────────────────────────
authRouter.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const result = await query(
        `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role,
                o.id as org_id, o.plan, o.name as org_name
         FROM users u
         JOIN organizations o ON o.owner_user_id = u.id
         WHERE u.email = $1 AND u.is_active = true`,
        [email]
      );
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, orgId: user.org_id },
        process.env.SECRET_KEY!,
        { expiresIn: '7d' }
      );
      res.json({
        token,
        user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, orgId: user.org_id, plan: user.plan, orgName: user.org_name },
      });
    } catch { res.status(500).json({ error: 'Login failed' }); }
  }
);

// ── Me ─────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              o.id as org_id, o.name as org_name, o.plan, o.plan_status
       FROM users u JOIN organizations o ON o.owner_user_id = u.id WHERE u.id = $1`,
      [req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch user' }); }
});

// FIX: Forgot password ──────────────────────────────────────────
authRouter.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email } = req.body;
    // Always return 200 to prevent user enumeration
    res.json({ message: 'If that email exists, a reset link has been sent.' });

    try {
      const result = await query('SELECT id, first_name FROM users WHERE email = $1 AND is_active = true', [email]);
      if (result.rows.length === 0) return;

      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, used = false`,
        [user.id, token, expires]
      );

      await sendEmail({
        to: email,
        type: 'password_reset',
        data: { firstName: user.first_name, resetUrl: `${process.env.FRONTEND_URL}/#/reset-password?token=${token}` },
      });
    } catch (err) {
      logger.error('Forgot password error', err);
    }
  }
);

// FIX: Reset password ───────────────────────────────────────────
authRouter.post('/reset-password',
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;
    try {
      const result = await query(
        `SELECT prt.user_id, prt.expires_at
         FROM password_reset_tokens prt
         WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
        [token]
      );
      if (result.rows.length === 0) return res.status(400).json({ error: 'Reset link is invalid or expired.' });

      const { user_id } = result.rows[0];
      const hash = await bcrypt.hash(password, 12);

      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user_id]);
      await query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);

      res.json({ message: 'Password updated successfully. You can now sign in.' });
    } catch {
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// FIX: Change password (authenticated) ─────────────────────────
authRouter.post('/change-password',
  authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    try {
      const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

      const hash = await bcrypt.hash(newPassword, 12);
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user!.id]);
      res.json({ message: 'Password changed successfully.' });
    } catch { res.status(500).json({ error: 'Failed to change password' }); }
  }
);

// FIX: Resend invite ────────────────────────────────────────────
authRouter.post('/resend-invite', authenticate, async (req: AuthRequest, res) => {
  const { email, assessmentId } = req.body;
  if (!email || !assessmentId) return res.status(400).json({ error: 'email and assessmentId required' });

  try {
    const result = await query(
      `SELECT a.*, o.name as org_name FROM assessments a
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [assessmentId, req.user!.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });

    const assessment = result.rows[0];
    const surveyUrl = `${process.env.FRONTEND_URL}/#/survey/${assessment.survey_token}`;
    await sendEmail({ to: email, type: 'invite', assessmentId, data: { orgName: assessment.org_name, assessmentName: assessment.name, surveyUrl } });
    res.json({ message: 'Invite resent.' });
  } catch { res.status(500).json({ error: 'Failed to resend invite' }); }
});
