"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.processReminderQueue = processReminderQueue;
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = require("../lib/db");
const logger_1 = require("../lib/logger");
const transporter = nodemailer_1.default.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});
function getEmailContent(type, data) {
    const from = `"CRI Platform" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`;
    switch (type) {
        case 'welcome':
            return {
                from,
                subject: `Welcome to the Cultural Readiness Index, ${data.firstName}!`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>Welcome, ${data.firstName}!</h2>
              <p>Your account for <strong>${data.orgName}</strong> has been created successfully.</p>
              <p>You can now create your first cultural assessment and start measuring your team's readiness for global markets.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${process.env.FRONTEND_URL}/dashboard" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  Go to Dashboard
                </a>
              </div>
              <p style="color:#666;font-size:14px">If you did not create this account, please contact us immediately.</p>
            </div>
          </div>`,
            };
        case 'invite':
            return {
                from,
                subject: `You're invited: Cultural Readiness Survey for ${data.orgName}`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>You've been invited to participate</h2>
              <p><strong>${data.orgName}</strong> is measuring cultural readiness with the Cultural Readiness Index.</p>
              <p>Your input is valuable and completely <strong>anonymous</strong>. The survey takes approximately <strong>10–15 minutes</strong>.</p>
              <div style="background:#f5f7fa;border-radius:8px;padding:20px;margin:24px 0">
                <p style="margin:0;font-weight:bold">Assessment: ${data.assessmentName}</p>
              </div>
              <div style="text-align:center;margin:32px 0">
                <a href="${data.surveyUrl}" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  Start Survey
                </a>
              </div>
              <p style="color:#666;font-size:12px">
                Your responses are anonymous and will be aggregated with others. 
                Individual answers cannot be identified. 
                <a href="${process.env.FRONTEND_URL}/privacy">Privacy Policy</a>
              </p>
            </div>
          </div>`,
            };
        case 'reminder':
            return {
                from,
                subject: `Reminder: Your input is needed — ${data.assessmentName}`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>A friendly reminder</h2>
              <p>You were invited to complete a cultural readiness survey for <strong>${data.orgName}</strong> three days ago, and we haven't received your response yet.</p>
              <p>Your perspective matters. The survey is anonymous and takes just 10–15 minutes.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${data.surveyUrl}" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  Complete Survey Now
                </a>
              </div>
            </div>
          </div>`,
            };
        case 'report_ready':
            return {
                from,
                subject: `Your Cultural Readiness Report is ready — ${data.assessmentName}`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>Your report is ready, ${data.firstName}!</h2>
              <p>The Cultural Readiness Index report for <strong>${data.assessmentName}</strong> has been generated.</p>
              <p>Log in to your dashboard to view insights, download the full PDF report, and access AI-powered recommendations.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${data.dashboardUrl}" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  View Your Report
                </a>
              </div>
            </div>
          </div>`,
            };
        case 'payment_confirmation':
            return {
                from,
                subject: `Payment Confirmed — CRI ${data.tier} Plan`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>Payment Confirmed</h2>
              <p>Thank you, ${data.firstName}! Your payment has been successfully processed.</p>
              <div style="background:#f5f7fa;border-radius:8px;padding:20px;margin:24px 0">
                <p style="margin:0 0 8px 0"><strong>Plan:</strong> ${data.tier}</p>
                <p style="margin:0 0 8px 0"><strong>Amount:</strong> $${data.amount}</p>
                <p style="margin:0"><strong>Receipt:</strong> ${data.receiptUrl || 'Available in Stripe'}</p>
              </div>
              <p>Your full report including AI-powered recommendations is now available.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${data.reportUrl || process.env.FRONTEND_URL + '/dashboard'}" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  Download Report
                </a>
              </div>
            </div>
          </div>`,
            };
        case 'abandoned_cart':
            return {
                from,
                subject: `Your CRI report is waiting — complete your purchase`,
                html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#003366;color:white;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:24px">Cultural Readiness Index</h1>
            </div>
            <div style="padding:32px">
              <h2>Your report is ready to download</h2>
              <p>You started the checkout process for your Cultural Readiness Report but didn't complete it.</p>
              <p>Your team's data is waiting. Unlock your full report including benchmark comparisons and AI recommendations.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${data.checkoutUrl}" 
                   style="background:#0055a4;color:white;padding:14px 28px;text-decoration:none;border-radius:4px;font-size:16px">
                  Complete Purchase
                </a>
              </div>
              <p style="color:#666;font-size:12px">If you'd like to unsubscribe from these reminders, 
                <a href="${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(data.email)}">click here</a>.
              </p>
            </div>
          </div>`,
            };
        default:
            throw new Error(`Unknown email type: ${type}`);
    }
}
async function sendEmail(options) {
    const { to, type, assessmentId, organizationId, data = {} } = options;
    try {
        const content = getEmailContent(type, data);
        await transporter.sendMail({ ...content, to });
        // Log success
        await (0, db_1.query)(`INSERT INTO email_log (to_email, subject, type, assessment_id, organization_id, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, 'sent', NOW())`, [to, content.subject, type, assessmentId || null, organizationId || null]);
        logger_1.logger.info('Email sent', { to, type });
    }
    catch (err) {
        logger_1.logger.error('Email send failed', { to, type, error: err.message });
        await (0, db_1.query)(`INSERT INTO email_log (to_email, subject, type, assessment_id, organization_id, status, error_msg)
       VALUES ($1, $2, $3, $4, $5, 'failed', $6)`, [to, `[${type}]`, type, assessmentId || null, organizationId || null, err.message]).catch(() => { }); // Don't throw on log failure
        throw err;
    }
}
// Schedule reminder emails (run this as a cron job every hour)
async function processReminderQueue() {
    // Find invites sent 3 days ago that haven't been responded to
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const pending = await (0, db_1.query)(`SELECT el.to_email, el.assessment_id, a.name as assessment_name, o.name as org_name, a.survey_token
     FROM email_log el
     JOIN assessments a ON a.id = el.assessment_id
     JOIN organizations o ON o.id = a.organization_id
     WHERE el.type = 'invite'
       AND el.sent_at < $1
       AND el.status = 'sent'
       AND NOT EXISTS (
         SELECT 1 FROM email_log r
         WHERE r.to_email = el.to_email
           AND r.assessment_id = el.assessment_id
           AND r.type = 'reminder'
       )`, [cutoff]);
    for (const row of pending.rows) {
        await sendEmail({
            to: row.to_email,
            type: 'reminder',
            assessmentId: row.assessment_id,
            data: {
                orgName: row.org_name,
                assessmentName: row.assessment_name,
                surveyUrl: `${process.env.FRONTEND_URL}/survey/${row.survey_token}`,
            },
        }).catch(() => { });
    }
}
//# sourceMappingURL=emailService.js.map