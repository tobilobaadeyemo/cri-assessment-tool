/**
 * CRI Scoring Engine
 * 
 * Implements the Cultural Readiness Index scoring algorithm as specified in
 * the research documents. Based on Hofstede 6-D model adapted for African
 * workplace contexts, with a 7th dimension for Communication Style.
 * 
 * Scoring method:
 * - Each question uses a 5-point Likert scale (1=Strongly Disagree, 5=Strongly Agree)
 * - "direct" scoring: score = raw_value
 * - "inverse" scoring: score = (max_scale + 1 - raw_value) = 6 - raw_value
 * - Dimension score = average of question scores, normalized to 0–100
 * - Overall CRI = weighted average of all dimension scores
 * - Colour bands: 0-39 = RED, 40-69 = AMBER, 70-100 = GREEN
 */

export interface QuestionAnswer {
  questionId: string;
  value: number; // 1–5 Likert scale
}

export interface DimensionScores {
  power_distance: number;
  individualism_collectivism: number;
  masculinity_femininity: number;
  uncertainty_avoidance: number;
  long_term_orientation: number;
  indulgence_restraint: number;
  communication_style: number;
}

export interface CRIResult {
  dimensionScores: DimensionScores;
  overallScore: number;
  colourBand: 'green' | 'amber' | 'red';
  benchmarkDeltas: Partial<DimensionScores>;
}

// ── Question definitions ───────────────────────────────────────
// Maps questionId → scoring type
const NIGERIA_QUESTION_SCORING: Record<string, 'direct' | 'inverse'> = {
  // Power Distance (Hierarchy & Authority)
  PD1: 'direct', PD2: 'direct', PD3: 'direct', PD4: 'direct',
  // Individualism-Collectivism (Team & Community)
  IC1: 'direct', IC2: 'direct', IC3: 'direct', IC4: 'direct',
  // Masculinity-Femininity (Achievement Drive)
  MF1: 'direct', MF2: 'inverse', MF3: 'inverse', MF4: 'direct',
  // Uncertainty Avoidance (Rules & Risk)
  UA1: 'direct', UA2: 'inverse', UA3: 'direct', UA4: 'direct',
  // Long-Term Orientation (Time Perception)
  LTO1: 'direct', LTO2: 'direct', LTO3: 'inverse',
  // Indulgence-Restraint (Work-Life Integration)
  IR1: 'direct', IR2: 'inverse', IR3: 'direct',
  // Communication Style
  CS1: 'direct', CS2: 'inverse', CS3: 'direct',
};

// Question → Dimension mapping
const QUESTION_TO_DIMENSION: Record<string, keyof DimensionScores> = {
  PD1: 'power_distance',  PD2: 'power_distance',
  PD3: 'power_distance',  PD4: 'power_distance',
  IC1: 'individualism_collectivism', IC2: 'individualism_collectivism',
  IC3: 'individualism_collectivism', IC4: 'individualism_collectivism',
  MF1: 'masculinity_femininity', MF2: 'masculinity_femininity',
  MF3: 'masculinity_femininity', MF4: 'masculinity_femininity',
  UA1: 'uncertainty_avoidance', UA2: 'uncertainty_avoidance',
  UA3: 'uncertainty_avoidance', UA4: 'uncertainty_avoidance',
  LTO1: 'long_term_orientation', LTO2: 'long_term_orientation',
  LTO3: 'long_term_orientation',
  IR1: 'indulgence_restraint', IR2: 'indulgence_restraint',
  IR3: 'indulgence_restraint',
  CS1: 'communication_style', CS2: 'communication_style',
  CS3: 'communication_style',
};

const SCALE_MIN = 1;
const SCALE_MAX = 5;

/**
 * Score a single question answer.
 * For inverse questions: score = (SCALE_MAX + 1) - raw_value
 */
function scoreQuestion(questionId: string, rawValue: number): number {
  if (rawValue < SCALE_MIN || rawValue > SCALE_MAX) {
    throw new Error(`Invalid Likert value ${rawValue} for question ${questionId}`);
  }
  const scoringType = NIGERIA_QUESTION_SCORING[questionId];
  if (!scoringType) {
    throw new Error(`Unknown question ID: ${questionId}`);
  }
  return scoringType === 'direct'
    ? rawValue
    : (SCALE_MAX + 1 - rawValue);
}

/**
 * Normalize a raw score (1-5 scale avg) to 0-100
 */
function normalizeToHundred(rawAvg: number): number {
  // (rawAvg - SCALE_MIN) / (SCALE_MAX - SCALE_MIN) * 100
  return Math.round(((rawAvg - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100 * 100) / 100;
}

/**
 * Determine colour band
 */
function getColourBand(score: number): 'green' | 'amber' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

/**
 * Compute dimension scores from a set of answers (single respondent).
 * Used internally to aggregate across multiple responses.
 */
function scoreSingleResponse(answers: Record<string, number>): Partial<DimensionScores> {
  const dimensionRawScores: Record<string, number[]> = {
    power_distance: [],
    individualism_collectivism: [],
    masculinity_femininity: [],
    uncertainty_avoidance: [],
    long_term_orientation: [],
    indulgence_restraint: [],
    communication_style: [],
  };

  for (const [questionId, rawValue] of Object.entries(answers)) {
    const dimension = QUESTION_TO_DIMENSION[questionId];
    if (!dimension) continue;
    const scored = scoreQuestion(questionId, rawValue);
    dimensionRawScores[dimension].push(scored);
  }

  const result: Partial<DimensionScores> = {};
  for (const [dimension, scores] of Object.entries(dimensionRawScores)) {
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      (result as any)[dimension] = avg; // raw 1-5 average, not yet normalized
    }
  }
  return result;
}

/**
 * Main scoring function.
 * 
 * @param allResponses - Array of response objects, each containing answers
 * @param weights - Optional dimension weights (default = equal weight = 1.0)
 * @param benchmarks - Optional benchmark scores to compute deltas
 */
export function computeCRIScore(
  allResponses: Array<{ answers: Record<string, number> }>,
  weights: Partial<Record<keyof DimensionScores, number>> = {},
  benchmarks?: Partial<DimensionScores>
): CRIResult {
  if (allResponses.length === 0) {
    throw new Error('Cannot compute CRI score with zero responses');
  }

  // Aggregate raw scores per dimension across all responses
  const dimensionAggregates: Record<string, number[]> = {
    power_distance: [],
    individualism_collectivism: [],
    masculinity_femininity: [],
    uncertainty_avoidance: [],
    long_term_orientation: [],
    indulgence_restraint: [],
    communication_style: [],
  };

  for (const response of allResponses) {
    const scored = scoreSingleResponse(response.answers);
    for (const [dim, val] of Object.entries(scored)) {
      if (val !== undefined) {
        dimensionAggregates[dim].push(val as number);
      }
    }
  }

  // Compute mean per dimension and normalize to 0-100
  const dimensionScores: DimensionScores = {
    power_distance: 0,
    individualism_collectivism: 0,
    masculinity_femininity: 0,
    uncertainty_avoidance: 0,
    long_term_orientation: 0,
    indulgence_restraint: 0,
    communication_style: 0,
  };

  for (const dim of Object.keys(dimensionScores) as Array<keyof DimensionScores>) {
    const vals = dimensionAggregates[dim];
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      dimensionScores[dim] = normalizeToHundred(avg);
    }
  }

  // Compute weighted overall score
  const defaultWeight = 1.0;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of Object.keys(dimensionScores) as Array<keyof DimensionScores>) {
    const weight = weights[dim] ?? defaultWeight;
    weightedSum += dimensionScores[dim] * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0;

  const colourBand = getColourBand(overallScore);

  // Compute benchmark deltas (team score - benchmark)
  const benchmarkDeltas: Partial<DimensionScores> = {};
  if (benchmarks) {
    for (const dim of Object.keys(dimensionScores) as Array<keyof DimensionScores>) {
      const bVal = benchmarks[dim];
      if (bVal !== undefined) {
        benchmarkDeltas[dim] = Math.round((dimensionScores[dim] - bVal) * 100) / 100;
      }
    }
  }

  return { dimensionScores, overallScore, colourBand, benchmarkDeltas };
}

/**
 * POST /score endpoint handler logic (used by both MCP server and REST API)
 */
export async function scoreAssessment(
  assessmentId: string,
  responses: Array<{ answers: Record<string, number> }>,
  weights?: Partial<Record<keyof DimensionScores, number>>,
  benchmarks?: Partial<DimensionScores>
): Promise<CRIResult> {
  if (responses.length === 0) {
    throw new Error('No responses to score');
  }
  return computeCRIScore(responses, weights ?? {}, benchmarks);
}
