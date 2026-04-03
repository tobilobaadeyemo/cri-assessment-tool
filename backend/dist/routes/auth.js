"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const emailService_1 = require("../services/emailService");
exports.authRouter = (0, express_1.Router)();
// ── Register ───────────────────────────────────────────────────
exports.authRouter.post('/register', (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').isLength({ min: 8 }), (0, express_validator_1.body)('firstName').trim().notEmpty(), (0, express_validator_1.body)('lastName').trim().notEmpty(), (0, express_validator_1.body)('orgName').trim().notEmpty(), (0, express_validator_1.body)('gdprConsent').isBoolean().equals('true'), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password, firstName, lastName, orgName, industry, gdprConsent, popiaConsent, ndpaConsent } = req.body;
    try {
        // Check existing user
        const existing = await (0, db_1.query)('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        const hash = await bcryptjs_1.default.hash(password, 12);
        const consentDate = new Date();
        // Create user
        const userResult = await (0, db_1.query)(`INSERT INTO users (email, password_hash, first_name, last_name, role, gdpr_consent, popia_consent, ndpa_consent, consent_date)
         VALUES ($1, $2, $3, $4, 'admin', $5, $6, $7, $8) RETURNING id`, [email, hash, firstName, lastName, gdprConsent, popiaConsent ?? false, ndpaConsent ?? false, consentDate]);
        const userId = userResult.rows[0].id;
        // Create organization
        const orgResult = await (0, db_1.query)(`INSERT INTO organizations (owner_user_id, name, industry, plan, plan_status)
         VALUES ($1, $2, $3, 'trial', 'active') RETURNING id`, [userId, orgName, industry || null]);
        const orgId = orgResult.rows[0].id;
        // Send welcome email
        await (0, emailService_1.sendEmail)({
            to: email,
            type: 'welcome',
            data: { firstName, orgName },
        });
        const token = jsonwebtoken_1.default.sign({ id: userId, email, role: 'admin', orgId }, process.env.SECRET_KEY, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: userId, email, firstName, lastName, orgId } });
    }
    catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});
// ── Login ──────────────────────────────────────────────────────
exports.authRouter.post('/login', (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').notEmpty(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
        const result = await (0, db_1.query)(`SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, o.id as org_id, o.plan
         FROM users u
         JOIN organizations o ON o.owner_user_id = u.id
         WHERE u.email = $1 AND u.is_active = true`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const valid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, orgId: user.org_id }, process.env.SECRET_KEY, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id, email: user.email,
                firstName: user.first_name, lastName: user.last_name,
                role: user.role, orgId: user.org_id, plan: user.plan,
            }
        });
    }
    catch {
        res.status(500).json({ error: 'Login failed' });
    }
});
// ── Me ─────────────────────────────────────────────────────────
exports.authRouter.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              o.id as org_id, o.name as org_name, o.plan, o.plan_status
       FROM users u
       JOIN organizations o ON o.owner_user_id = u.id
       WHERE u.id = $1`, [req.user.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
//# sourceMappingURL=auth.js.map