"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const reportGenerator_1 = require("../services/reportGenerator");
exports.reportRouter = (0, express_1.Router)();
exports.reportRouter.use(auth_1.authenticate);
// ── Get report for assessment ──────────────────────────────────
exports.reportRouter.get('/:assessmentId', async (req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT r.*, a.name as assessment_name, a.target_country
       FROM reports r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE r.assessment_id = $1 AND a.organization_id = $2`, [req.params.assessmentId, req.user.orgId]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Report not found' });
        res.json(result.rows[0]);
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});
// ── Download HTML report ───────────────────────────────────────
exports.reportRouter.get('/:assessmentId/html', async (req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT r.html_content, a.name
       FROM reports r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE r.assessment_id = $1 AND a.organization_id = $2 AND r.status = 'ready'`, [req.params.assessmentId, req.user.orgId]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Report not ready' });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="CRI-Report-${result.rows[0].name.replace(/\s+/g, '-')}.html"`);
        res.send(result.rows[0].html_content);
    }
    catch {
        res.status(500).json({ error: 'Failed to download report' });
    }
});
// ── Trigger report generation ──────────────────────────────────
exports.reportRouter.post('/:assessmentId/generate', async (req, res) => {
    const { includeLLM } = req.body;
    try {
        // Check org plan for LLM access
        const orgResult = await (0, db_1.query)(`SELECT plan FROM organizations WHERE id = $1`, [req.user.orgId]);
        const isEnterprise = orgResult.rows[0]?.plan === 'enterprise';
        const useLLM = includeLLM && isEnterprise;
        await (0, reportGenerator_1.generateReport)(req.params.assessmentId, useLLM);
        res.json({ message: 'Report generated successfully', llmUsed: useLLM });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to generate report' });
    }
});
//# sourceMappingURL=reports.js.map