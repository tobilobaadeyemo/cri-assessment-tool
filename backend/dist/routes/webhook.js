"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRouter = void 0;
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../lib/db");
const logger_1 = require("../lib/logger");
const emailService_1 = require("../services/emailService");
const reportGenerator_1 = require("../services/reportGenerator");
exports.webhookRouter = (0, express_1.Router)();
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY, { apiVersion: '2024-04-10' });
exports.webhookRouter.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig)
        return res.status(400).json({ error: 'No stripe signature' });
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SIGNING_SECRET);
    }
    catch (err) {
        logger_1.logger.error('Webhook signature verification failed', err);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const { orgId, userId, tier, assessmentId } = session.metadata || {};
                const amountTotal = session.amount_total || 0;
                // Record payment
                await (0, db_1.query)(`INSERT INTO payments (organization_id, stripe_payment_intent, amount_cents, currency, status, tier)
           VALUES ($1, $2, $3, $4, 'succeeded', $5)`, [orgId, session.payment_intent, amountTotal, session.currency || 'usd', tier]);
                // Upgrade org plan
                const planMap = {
                    starter: 'starter',
                    enterprise: 'enterprise',
                };
                await (0, db_1.query)(`UPDATE organizations SET plan = $1, plan_status = 'active', updated_at = NOW() WHERE id = $2`, [planMap[tier] || 'starter', orgId]);
                // Trigger report generation
                if (assessmentId) {
                    await (0, reportGenerator_1.generateReport)(assessmentId, tier === 'enterprise');
                }
                // Send payment confirmation email
                const userResult = await (0, db_1.query)(`SELECT u.email, u.first_name, o.name as org_name
           FROM users u JOIN organizations o ON o.owner_user_id = u.id
           WHERE o.id = $1`, [orgId]);
                if (userResult.rows.length > 0) {
                    const { email, first_name, org_name } = userResult.rows[0];
                    await (0, emailService_1.sendEmail)({
                        to: email,
                        type: 'payment_confirmation',
                        organizationId: orgId,
                        data: {
                            firstName: first_name,
                            orgName: org_name,
                            tier: tier || 'Starter',
                            amount: (amountTotal / 100).toFixed(2),
                            reportUrl: assessmentId
                                ? `${process.env.FRONTEND_URL}/reports/${assessmentId}`
                                : undefined,
                        },
                    });
                }
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                await (0, db_1.query)(`UPDATE payments SET status = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`, [sub.status === 'canceled' ? 'canceled' : 'succeeded', sub.id]);
                break;
            }
        }
        res.json({ received: true });
    }
    catch (err) {
        logger_1.logger.error('Webhook processing error', err);
        // Return 200 to prevent Stripe retries for non-signature errors
        res.json({ received: true, warning: 'Processing error logged' });
    }
});
//# sourceMappingURL=webhook.js.map