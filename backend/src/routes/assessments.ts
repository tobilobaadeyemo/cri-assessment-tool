import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { computeCRIScore } from '../services/scoringEngine';

export const assessmentRouter = Router();
assessmentRouter.use(authenticate);

// ── List assessments for org ───────────────────────────────────
assessmentRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT a.*, ds.overall_score, ds.colour_band,
              r.status as report_status, r.pdf_url
       FROM assessments a
       LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
       LEFT JOIN reports r ON r.assessment_id = a.id
       WHERE a.organization_id = $1
       ORDER BY a.created_at DESC`,
      [req.user!.orgId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Failed to fetch assessments' }); }
});

// ── Create assessment ──────────────────────────────────────────
assessmentRouter.post('/',
  body('name').trim().notEmpty(),
  body('targetCountry').trim().notEmpty(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, targetCountry, targetIndustry, dimensionWeights } = req.body;
    try {
      const result = await query(
        `INSERT INTO assessments (organization_id, created_by, name, description, target_country, target_industry, dimension_weights)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.user!.orgId, req.user!.id, name, description || null, targetCountry,
         targetIndustry || null, JSON.stringify(dimensionWeights || {})]
      );
      res.status(201).json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Failed to create assessment' }); }
  }
);

// ── Get single assessment ──────────────────────────────────────
assessmentRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT a.*, ds.*, r.status as report_status, r.pdf_url, r.executive_summary,
              r.strengths, r.development_areas, r.action_steps
       FROM assessments a
       LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
       LEFT JOIN reports r ON r.assessment_id = a.id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, req.user!.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch assessment' }); }
});

// ── Invite participants ────────────────────────────────────────
assessmentRouter.post('/:id/invite', async (req: AuthRequest, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails array required' });
  }

  try {
    const assessmentResult = await query(
      `SELECT a.*, o.name as org_name
       FROM assessments a
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, req.user!.orgId]
    );
    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];
    const surveyUrl = `${process.env.FRONTEND_URL}/survey/${assessment.survey_token}`;

    const results = await Promise.allSettled(
      emails.map((email: string) =>
        sendEmail({
          to: email,
          type: 'invite',
          assessmentId: assessment.id,
          data: { orgName: assessment.org_name, assessmentName: assessment.name, surveyUrl },
        })
      )
    );

    // Schedule abandoned cart reminder after 3 days
    // In production, use a job queue (Bull/BullMQ)
    for (const email of emails) {
      await query(
        `INSERT INTO email_log (to_email, subject, type, assessment_id, organization_id, status)
         VALUES ($1, $2, 'invite', $3, $4, 'sent')`,
        [email, `Complete your cultural readiness survey for ${assessment.name}`, assessment.id, req.user!.orgId]
      );
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    res.json({ sent, total: emails.length });
  } catch { res.status(500).json({ error: 'Failed to send invitations' }); }
});

// ── Compute scores (triggered when min responses met) ──────────
assessmentRouter.post('/:id/compute-scores', async (req: AuthRequest, res) => {
  try {
    const assessmentResult = await query(
      `SELECT a.*, b.power_distance as b_pd, b.individualism_collectivism as b_ic,
              b.masculinity_femininity as b_mf, b.uncertainty_avoidance as b_ua,
              b.long_term_orientation as b_lto, b.indulgence_restraint as b_ir,
              b.communication_style as b_cs
       FROM assessments a
       LEFT JOIN benchmarks b ON b.country = a.target_country AND b.industry = COALESCE(a.target_industry, 'General')
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, req.user!.orgId]
    );
    if (assessmentResult.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });

    const assessment = assessmentResult.rows[0];

    // Get all complete responses
    const responsesResult = await query(
      `SELECT answers FROM responses WHERE assessment_id = $1 AND is_complete = true`,
      [req.params.id]
    );

    if (responsesResult.rows.length < assessment.min_responses) {
      return res.status(400).json({
        error: `Minimum ${assessment.min_responses} responses required. Currently: ${responsesResult.rows.length}`
      });
    }

    const responses = responsesResult.rows.map(r => ({ answers: r.answers }));
    const weights = assessment.dimension_weights || {};
    const benchmarks = {
      power_distance: assessment.b_pd,
      individualism_collectivism: assessment.b_ic,
      masculinity_femininity: assessment.b_mf,
      uncertainty_avoidance: assessment.b_ua,
      long_term_orientation: assessment.b_lto,
      indulgence_restraint: assessment.b_ir,
      communication_style: assessment.b_cs,
    };

    const result = computeCRIScore(responses, weights, benchmarks);

    // Upsert dimension scores
    await query(
      `INSERT INTO dimension_scores (assessment_id, power_distance, individualism_collectivism,
        masculinity_femininity, uncertainty_avoidance, long_term_orientation, indulgence_restraint,
        communication_style, overall_score, colour_band, benchmark_deltas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (assessment_id) DO UPDATE SET
         power_distance = EXCLUDED.power_distance,
         individualism_collectivism = EXCLUDED.individualism_collectivism,
         masculinity_femininity = EXCLUDED.masculinity_femininity,
         uncertainty_avoidance = EXCLUDED.uncertainty_avoidance,
         long_term_orientation = EXCLUDED.long_term_orientation,
         indulgence_restraint = EXCLUDED.indulgence_restraint,
         communication_style = EXCLUDED.communication_style,
         overall_score = EXCLUDED.overall_score,
         colour_band = EXCLUDED.colour_band,
         benchmark_deltas = EXCLUDED.benchmark_deltas,
         computed_at = NOW()`,
      [
        req.params.id,
        result.dimensionScores.power_distance,
        result.dimensionScores.individualism_collectivism,
        result.dimensionScores.masculinity_femininity,
        result.dimensionScores.uncertainty_avoidance,
        result.dimensionScores.long_term_orientation,
        result.dimensionScores.indulgence_restraint,
        result.dimensionScores.communication_style,
        result.overallScore,
        result.colourBand,
        JSON.stringify(result.benchmarkDeltas),
      ]
    );

    await query(
      `UPDATE assessments SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute scores' });
  }
});
