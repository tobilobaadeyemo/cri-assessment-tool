"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../lib/logger");
exports.paymentRouter = (0, express_1.Router)();
exports.paymentRouter.use(auth_1.authenticate);
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY, { apiVersion: '2024-04-10' });
// Tier pricing (as specified in research docs)
const TIERS = {
    starter: {
        name: 'Starter',
        priceId: process.env.STRIPE_PRICE_STARTER || 'price_starter',
        amount: 29900, // $299 one-time
        currency: 'usd',
    },
    enterprise: {
        name: 'Enterprise',
        priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
        amount: 250000, // $2,500
        currency: 'usd',
    },
};
// ── Create checkout session ────────────────────────────────────
exports.paymentRouter.post('/create-checkout', async (req, res) => {
    const { tier, assessmentId } = req.body;
    if (!TIERS[tier]) {
        return res.status(400).json({ error: `Invalid tier: ${tier}. Use 'starter' or 'enterprise'` });
    }
    try {
        const orgResult = await (0, db_1.query)(`SELECT o.*, u.email FROM organizations o JOIN users u ON u.id = o.owner_user_id WHERE o.id = $1`, [req.user.orgId]);
        const org = orgResult.rows[0];
        const tierConfig = TIERS[tier];
        // Get or create Stripe customer
        let customerId = org.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: org.email,
                name: org.name,
                metadata: { orgId: org.id, userId: req.user.id },
            });
            customerId = customer.id;
            await (0, db_1.query)(`UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`, [customerId, org.id]);
        }
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                    price_data: {
                        currency: tierConfig.currency,
                        product_data: {
                            name: `CRI ${tierConfig.name} Report`,
                            description: `Cultural Readiness Index - ${tierConfig.name} tier report`,
                        },
                        unit_amount: tierConfig.amount,
                    },
                    quantity: 1,
                }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/dashboard?payment=cancelled`,
            client_reference_id: req.user.orgId,
            metadata: {
                orgId: req.user.orgId,
                userId: req.user.id,
                tier,
                assessmentId: assessmentId || '',
            },
        });
        res.json({ sessionId: session.id, url: session.url });
    }
    catch (err) {
        logger_1.logger.error('Checkout creation failed', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});
// ── Get payment history ────────────────────────────────────────
exports.paymentRouter.get('/history', async (req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT * FROM payments WHERE organization_id = $1 ORDER BY created_at DESC`, [req.user.orgId]);
        res.json(result.rows);
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});
//# sourceMappingURL=payments.js.map