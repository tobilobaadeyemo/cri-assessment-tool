import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/emailService';

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
      // Check existing user
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const hash = await bcrypt.hash(password, 12);
      const consentDate = new Date();

      // Create user
      const userResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, gdpr_consent, popia_consent, ndpa_consent, consent_date)
         VALUES ($1, $2, $3, $4, 'admin', $5, $6, $7, $8) RETURNING id`,
        [email, hash, firstName, lastName, gdprConsent, popiaConsent ?? false, ndpaConsent ?? false, consentDate]
      );
      const userId = userResult.rows[0].id;

      // Create organization
      const orgResult = await query(
        `INSERT INTO organizations (owner_user_id, name, industry, plan, plan_status)
         VALUES ($1, $2, $3, 'trial', 'active') RETURNING id`,
        [userId, orgName, industry || null]
      );
      const orgId = orgResult.rows[0].id;

      // Send welcome email
      await sendEmail({
        to: email,
        type: 'welcome',
        data: { firstName, orgName },
      });

      const token = jwt.sign(
        { id: userId, email, role: 'admin', orgId },
        process.env.SECRET_KEY!,
        { expiresIn: '7d' }
      );

      res.status(201).json({ token, user: { id: userId, email, firstName, lastName, orgId } });
    } catch (err: any) {
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
        `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, o.id as org_id, o.plan
         FROM users u
         JOIN organizations o ON o.owner_user_id = u.id
         WHERE u.email = $1 AND u.is_active = true`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

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
        user: {
          id: user.id, email: user.email,
          firstName: user.first_name, lastName: user.last_name,
          role: user.role, orgId: user.org_id, plan: user.plan,
        }
      });
    } catch {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ── Me ─────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              o.id as org_id, o.name as org_name, o.plan, o.plan_status
       FROM users u
       JOIN organizations o ON o.owner_user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
