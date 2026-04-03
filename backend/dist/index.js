"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const assessments_1 = require("./routes/assessments");
const survey_1 = require("./routes/survey");
const reports_1 = require("./routes/reports");
const payments_1 = require("./routes/payments");
const admin_1 = require("./routes/admin");
const webhook_1 = require("./routes/webhook");
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./lib/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// ── Security middleware ────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
// Stripe webhook needs raw body BEFORE json parsing
app.use('/api/webhook', express_1.default.raw({ type: 'application/json' }), webhook_1.webhookRouter);
app.use(express_1.default.json({ limit: '10mb' }));
// ── Rate limiting ──────────────────────────────────────────────
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
// Stricter limits on auth endpoints
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', auth_1.authRouter);
app.use('/api/assessments', assessments_1.assessmentRouter);
app.use('/api/survey', survey_1.surveyRouter);
app.use('/api/reports', reports_1.reportRouter);
app.use('/api/payments', payments_1.paymentRouter);
app.use('/api/admin', admin_1.adminRouter);
// ── Health check ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ── GDPR/POPIA/NDPA - Data deletion endpoint ───────────────────
app.post('/api/data-deletion-request', async (req, res) => {
    const { email, reason } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Email is required' });
    try {
        const { pool } = await Promise.resolve().then(() => __importStar(require('./lib/db')));
        await pool.query(`INSERT INTO data_deletion_requests (email, reason) VALUES ($1, $2)`, [email, reason || null]);
        res.json({ message: 'Data deletion request received. We will process it within 30 days.' });
    }
    catch (err) {
        logger_1.logger.error('Data deletion request error', err);
        res.status(500).json({ error: 'Failed to submit request' });
    }
});
// ── Error handler ──────────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    logger_1.logger.info(`CRI Backend running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map