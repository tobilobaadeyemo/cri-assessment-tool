import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../lib/db';
import { computeCRIScore } from '../services/scoringEngine';
import { sendEmail } from '../services/emailService';

export const surveyRouter = Router();

// ── Get survey by token (public) ───────────────────────────────
surveyRouter.get('/:token', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.name, a.description, a.target_country, a.target_industry,
              a.status, o.name as org_name
       FROM assessments a
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.survey_token = $1 AND a.status = 'active'`,
      [req.params.token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found or no longer active' });
    }

    // Fetch questions for the country
    const questionsResult = await query(
      `SELECT dimension_id, question_id, question_text, scoring_type
       FROM question_bank
       WHERE country = $1
       ORDER BY dimension_id, question_id`,
      [result.rows[0].target_country]
    );

    res.json({
      assessment: result.rows[0],
      questions: questionsResult.rows,
    });
  } catch { res.status(500).json({ error: 'Failed to load survey' }); }
});

// ── Submit survey response (public, anonymous) ─────────────────
surveyRouter.post('/:token/submit',
  body('answers').isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { answers } = req.body;

    try {
      const assessmentResult = await query(
        `SELECT id, min_responses, target_country, target_industry, organization_id
         FROM assessments
         WHERE survey_token = $1 AND status = 'active'`,
        [req.params.token]
      );
      if (assessmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Survey not found or not active' });
      }

      const assessment = assessmentResult.rows[0];

      // Validate all required questions are answered
      const questionsResult = await query(
        `SELECT question_id FROM question_bank WHERE country = $1`,
        [assessment.target_country]
      );
      const requiredIds = questionsResult.rows.map((r: any) => r.question_id);
      const missingIds = requiredIds.filter((id: string) => !(id in answers));

      if (missingIds.length > 0) {
        return res.status(400).json({
          error: 'Incomplete survey',
          missing: missingIds,
        });
      }

      // Insert response
      await query(
        `INSERT INTO responses (assessment_id, answers, is_complete, submitted_at)
         VALUES ($1, $2, true, NOW())`,
        [assessment.id, JSON.stringify(answers)]
      );

      // Update response count
      const countResult = await query(
        `UPDATE assessments SET response_count = response_count + 1, updated_at = NOW()
         WHERE id = $1 RETURNING response_count`,
        [assessment.id]
      );
      const newCount = countResult.rows[0].response_count;

      // Auto-compute scores when minimum threshold reached
      if (newCount >= assessment.min_responses) {
        try {
          await autoComputeAndNotify(assessment);
        } catch (e) {
          // Non-fatal — scores can be computed manually
        }
      }

      res.json({
        message: 'Thank you! Your response has been recorded.',
        responseCount: newCount,
        minRequired: assessment.min_responses,
      });
    } catch { res.status(500).json({ error: 'Failed to submit response' }); }
  }
);

async function autoComputeAndNotify(assessment: any) {
  const responsesResult = await query(
    `SELECT answers FROM responses WHERE assessment_id = $1 AND is_complete = true`,
    [assessment.id]
  );

  const benchmarksResult = await query(
    `SELECT * FROM benchmarks
     WHERE country = $1 AND industry = COALESCE($2, 'General')
     LIMIT 1`,
    [assessment.target_country, assessment.target_industry]
  );

  const responses = responsesResult.rows.map((r: any) => ({ answers: r.answers }));
  const benchmarks = benchmarksResult.rows[0] || {};

  const result = computeCRIScore(responses, {}, {
    power_distance: benchmarks.power_distance,
    individualism_collectivism: benchmarks.individualism_collectivism,
    masculinity_femininity: benchmarks.masculinity_femininity,
    uncertainty_avoidance: benchmarks.uncertainty_avoidance,
    long_term_orientation: benchmarks.long_term_orientation,
    indulgence_restraint: benchmarks.indulgence_restraint,
    communication_style: benchmarks.communication_style,
  });

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
      assessment.id,
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
    [assessment.id]
  );

  // Notify admin that report is ready
  const orgResult = await query(
    `SELECT u.email, u.first_name, o.name as org_name
     FROM organizations o JOIN users u ON u.id = o.owner_user_id
     WHERE o.id = $1`,
    [assessment.organization_id]
  );

  if (orgResult.rows.length > 0) {
    const { email, first_name, org_name } = orgResult.rows[0];
    await sendEmail({
      to: email,
      type: 'report_ready',
      assessmentId: assessment.id,
      data: {
        firstName: first_name,
        orgName: org_name,
        assessmentName: assessment.name,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      },
    });
  }
}
