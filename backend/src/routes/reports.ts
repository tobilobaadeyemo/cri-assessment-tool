import { Router, Response } from 'express';
import { query } from '../lib/db';
import { authenticate, AuthRequest, requireSuperAdmin } from '../middleware/auth';
import { generateReport } from '../services/reportGenerator';

export const reportRouter = Router();
reportRouter.use(authenticate);

// ── Get report for assessment ──────────────────────────────────
reportRouter.get('/:assessmentId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, a.name as assessment_name, a.target_country
       FROM reports r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE r.assessment_id = $1 AND a.organization_id = $2`,
      [req.params.assessmentId, req.user!.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch report' }); }
});

// ── Download HTML report ───────────────────────────────────────
reportRouter.get('/:assessmentId/html', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT r.html_content, a.name
       FROM reports r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE r.assessment_id = $1 AND a.organization_id = $2 AND r.status = 'ready'`,
      [req.params.assessmentId, req.user!.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not ready' });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="CRI-Report-${result.rows[0].name.replace(/\s+/g, '-')}.html"`);
    res.send(result.rows[0].html_content);
  } catch { res.status(500).json({ error: 'Failed to download report' }); }
});

// ── Trigger report generation ──────────────────────────────────
reportRouter.post('/:assessmentId/generate', async (req: AuthRequest, res: Response) => {
  const { includeLLM } = req.body;
  try {
    // Check org plan for LLM access
    const orgResult = await query(
      `SELECT plan FROM organizations WHERE id = $1`,
      [req.user!.orgId]
    );
    const isEnterprise = orgResult.rows[0]?.plan === 'enterprise';
    const useLLM = includeLLM && isEnterprise;

    await generateReport(req.params.assessmentId, useLLM);
    res.json({ message: 'Report generated successfully', llmUsed: useLLM });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate report' });
  }
});
