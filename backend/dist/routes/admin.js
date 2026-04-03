"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.authenticate);
exports.adminRouter.use(auth_1.requireSuperAdmin);
// ── All assessments ────────────────────────────────────────────
exports.adminRouter.get('/assessments', async (_req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT a.*, o.name as org_name, ds.overall_score, ds.colour_band, r.status as report_status
       FROM assessments a
       JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
       LEFT JOIN reports r ON r.assessment_id = a.id
       ORDER BY a.created_at DESC`);
        res.json(result.rows);
    }
    catch {
        res.status(500).json({ error: 'Failed' });
    }
});
// ── Stats ──────────────────────────────────────────────────────
exports.adminRouter.get('/stats', async (_req, res) => {
    try {
        const [orgs, assessments, responses, payments] = await Promise.all([
            (0, db_1.query)('SELECT COUNT(*) FROM organizations'),
            (0, db_1.query)('SELECT COUNT(*), status FROM assessments GROUP BY status'),
            (0, db_1.query)('SELECT COUNT(*) FROM responses WHERE is_complete = true'),
            (0, db_1.query)('SELECT SUM(amount_cents), COUNT(*) FROM payments WHERE status = \'succeeded\''),
        ]);
        res.json({
            totalOrganizations: Number(orgs.rows[0].count),
            assessmentsByStatus: Object.fromEntries(assessments.rows.map(r => [r.status, Number(r.count)])),
            totalResponses: Number(responses.rows[0].count),
            totalRevenueCents: Number(payments.rows[0].sum || 0),
            totalPayments: Number(payments.rows[0].count || 0),
        });
    }
    catch {
        res.status(500).json({ error: 'Failed' });
    }
});
// ── Export CSV ─────────────────────────────────────────────────
exports.adminRouter.get('/export', async (_req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT o.name as org_name, o.industry, a.name as assessment_name,
              a.target_country, a.response_count, a.status,
              ds.overall_score, ds.colour_band,
              ds.power_distance, ds.individualism_collectivism,
              ds.masculinity_femininity, ds.uncertainty_avoidance,
              ds.long_term_orientation, ds.indulgence_restraint,
              ds.communication_style, a.created_at
       FROM assessments a
       JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
       ORDER BY a.created_at DESC`);
        const headers = Object.keys(result.rows[0] || {}).join(',');
        const rows = result.rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="cri-assessments-export.csv"');
        res.send([headers, ...rows].join('\n'));
    }
    catch {
        res.status(500).json({ error: 'Export failed' });
    }
});
//# sourceMappingURL=admin.js.map