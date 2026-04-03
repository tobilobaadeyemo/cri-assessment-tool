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
    value: number;
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
/**
 * Main scoring function.
 *
 * @param allResponses - Array of response objects, each containing answers
 * @param weights - Optional dimension weights (default = equal weight = 1.0)
 * @param benchmarks - Optional benchmark scores to compute deltas
 */
export declare function computeCRIScore(allResponses: Array<{
    answers: Record<string, number>;
}>, weights?: Partial<Record<keyof DimensionScores, number>>, benchmarks?: Partial<DimensionScores>): CRIResult;
/**
 * POST /score endpoint handler logic (used by both MCP server and REST API)
 */
export declare function scoreAssessment(assessmentId: string, responses: Array<{
    answers: Record<string, number>;
}>, weights?: Partial<Record<keyof DimensionScores, number>>, benchmarks?: Partial<DimensionScores>): Promise<CRIResult>;
//# sourceMappingURL=scoringEngine.d.ts.map