/**
 * CRI MCP Server
 * 
 * Exposes the Cultural Readiness Index scoring algorithm as:
 * 1. MCP tools (for AI agent integration)
 * 2. REST POST /score endpoint (for direct API integration)
 * 
 * POST /score
 * Body: {
 *   responses: [{ answers: { PD1: 4, IC1: 5, ... } }],
 *   weights?: { power_distance: 1.2, ... },  // optional, default all 1.0
 *   benchmarks?: { power_distance: 75, ... }  // optional benchmark for deltas
 * }
 */

import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

// ── Embedded scoring engine (mirrors backend/src/services/scoringEngine.ts) ──

const QUESTION_SCORING: Record<string, 'direct' | 'inverse'> = {
  PD1:'direct', PD2:'direct', PD3:'direct', PD4:'direct',
  IC1:'direct', IC2:'direct', IC3:'direct', IC4:'direct',
  MF1:'direct', MF2:'inverse', MF3:'inverse', MF4:'direct',
  UA1:'direct', UA2:'inverse', UA3:'direct', UA4:'direct',
  LTO1:'direct', LTO2:'direct', LTO3:'inverse',
  IR1:'direct', IR2:'inverse', IR3:'direct',
  CS1:'direct', CS2:'inverse', CS3:'direct',
};

const QUESTION_TO_DIMENSION: Record<string, string> = {
  PD1:'power_distance', PD2:'power_distance', PD3:'power_distance', PD4:'power_distance',
  IC1:'individualism_collectivism', IC2:'individualism_collectivism',
  IC3:'individualism_collectivism', IC4:'individualism_collectivism',
  MF1:'masculinity_femininity', MF2:'masculinity_femininity',
  MF3:'masculinity_femininity', MF4:'masculinity_femininity',
  UA1:'uncertainty_avoidance', UA2:'uncertainty_avoidance',
  UA3:'uncertainty_avoidance', UA4:'uncertainty_avoidance',
  LTO1:'long_term_orientation', LTO2:'long_term_orientation', LTO3:'long_term_orientation',
  IR1:'indulgence_restraint', IR2:'indulgence_restraint', IR3:'indulgence_restraint',
  CS1:'communication_style', CS2:'communication_style', CS3:'communication_style',
};

const DIMENSIONS = [
  'power_distance','individualism_collectivism','masculinity_femininity',
  'uncertainty_avoidance','long_term_orientation','indulgence_restraint','communication_style'
];

function scoreResponse(answers: Record<string, number>): Record<string, number[]> {
  const agg: Record<string, number[]> = Object.fromEntries(DIMENSIONS.map(d => [d, []]));
  for (const [qid, raw] of Object.entries(answers)) {
    const dim = QUESTION_TO_DIMENSION[qid];
    const type = QUESTION_SCORING[qid];
    if (!dim || !type) continue;
    if (raw < 1 || raw > 5) throw new Error(`Invalid value ${raw} for ${qid} (must be 1-5)`);
    const scored = type === 'direct' ? raw : (6 - raw);
    agg[dim].push(scored);
  }
  return agg;
}

function normalize(rawAvg: number): number {
  return Math.round(((rawAvg - 1) / 4) * 100 * 100) / 100;
}

function colourBand(score: number): 'green' | 'amber' | 'red' {
  return score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
}

function computeScore(
  responses: Array<{ answers: Record<string, number> }>,
  weights: Record<string, number> = {},
  benchmarks?: Record<string, number>
) {
  if (!responses.length) throw new Error('No responses');

  // Aggregate raw scores per dimension
  const agg: Record<string, number[]> = Object.fromEntries(DIMENSIONS.map(d => [d, []]));
  for (const r of responses) {
    const scored = scoreResponse(r.answers);
    for (const dim of DIMENSIONS) {
      agg[dim].push(...scored[dim]);
    }
  }

  // Normalise
  const dimScores: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    const vals = agg[dim];
    if (vals.length === 0) { dimScores[dim] = 0; continue; }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    dimScores[dim] = normalize(avg);
  }

  // Weighted overall
  let wSum = 0, wTotal = 0;
  for (const dim of DIMENSIONS) {
    const w = weights[dim] ?? 1.0;
    wSum += dimScores[dim] * w;
    wTotal += w;
  }
  const overall = wTotal > 0 ? Math.round((wSum / wTotal) * 100) / 100 : 0;

  // Benchmark deltas
  const deltas: Record<string, number> = {};
  if (benchmarks) {
    for (const dim of DIMENSIONS) {
      if (benchmarks[dim] != null) {
        deltas[dim] = Math.round((dimScores[dim] - benchmarks[dim]) * 100) / 100;
      }
    }
  }

  return {
    dimensionScores: dimScores,
    overallScore: overall,
    colourBand: colourBand(overall),
    benchmarkDeltas: deltas,
    responseCount: responses.length,
  };
}

// ── REST API server ────────────────────────────────────────────
const app = express();
app.use(express.json());

/**
 * POST /score
 * Main scoring endpoint as specified in research documents.
 */
app.post('/score', (req, res) => {
  try {
    const { responses, weights, benchmarks } = req.body;

    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({
        error: 'responses must be a non-empty array',
        example: {
          responses: [{ answers: { PD1: 4, PD2: 5, IC1: 3, IC2: 4 } }],
          weights: { power_distance: 1.2 },
          benchmarks: { power_distance: 75 }
        }
      });
    }

    const result = computeScore(responses, weights || {}, benchmarks);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /dimensions
 * Returns available dimensions and their questions.
 */
app.get('/dimensions', (_req, res) => {
  res.json({
    dimensions: DIMENSIONS,
    questionMapping: QUESTION_TO_DIMENSION,
    scoringTypes: QUESTION_SCORING,
    scale: { min: 1, max: 5, description: '1=Strongly Disagree, 5=Strongly Agree' },
    normalization: 'Raw average (1-5) normalized to 0-100: score = (avg - 1) / 4 * 100',
    colourBands: { green: '70-100 (High Readiness)', amber: '40-69 (Moderate)', red: '0-39 (Developing)' },
  });
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cri-mcp-server', version: '1.0.0' });
});

/**
 * POST /score/validate
 * Validate answers without computing full score.
 */
app.post('/score/validate', (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object required' });
  }

  const knownIds = new Set(Object.keys(QUESTION_SCORING));
  const provided = new Set(Object.keys(answers));
  const unknown = [...provided].filter(id => !knownIds.has(id));
  const missing = [...knownIds].filter(id => !provided.has(id));
  const invalid = Object.entries(answers)
    .filter(([, v]) => typeof v !== 'number' || v < 1 || v > 5)
    .map(([k]) => k);

  res.json({
    valid: unknown.length === 0 && missing.length === 0 && invalid.length === 0,
    unknownIds: unknown,
    missingIds: missing,
    invalidValues: invalid,
  });
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, () => {
  console.log(`CRI MCP Server listening on port ${PORT}`);
  console.log(`POST /score   — compute CRI scores`);
  console.log(`GET  /dimensions — list dimensions and questions`);
});

export { computeScore };

// ── FIX: POST /score/validate ───────────────────────────────────
// Validates answers before submission — returns missing/unknown/invalid question IDs
app.post('/score/validate', (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers object required' });
    }
    const allQuestionIds = Object.keys(QUESTION_SCORING);
    const provided = Object.keys(answers);

    const missing = allQuestionIds.filter(id => !(id in answers));
    const unknown = provided.filter(id => !QUESTION_SCORING[id]);
    const invalid = provided.filter(id => {
      const v = answers[id];
      return typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5;
    });

    const valid = missing.length === 0 && unknown.length === 0 && invalid.length === 0;
    res.json({ valid, missing, unknown, invalid, total: allQuestionIds.length, provided: provided.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
