"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const db_1 = require("../lib/db");
const logger_1 = require("../lib/logger");
const anthropic = new sdk_1.default({ apiKey: process.env.LLM_PROVIDER_API_KEY });
const DIMENSION_LABELS = {
    power_distance: 'Hierarchy & Authority',
    individualism_collectivism: 'Team & Community Orientation',
    masculinity_femininity: 'Drive for Achievement',
    uncertainty_avoidance: 'Attitude to Rules & Risk',
    long_term_orientation: 'Time Perception & Tradition',
    indulgence_restraint: 'Work-Life Integration',
    communication_style: 'Communication Style',
};
const DIMENSION_DESCRIPTIONS = {
    power_distance: 'Measures acceptance of unequal power distribution. High scores indicate comfort with hierarchy; managers expected to be decisive and directive.',
    individualism_collectivism: 'Measures group vs. individual orientation. High scores indicate collectivism — loyalty, harmony, and group success are paramount.',
    masculinity_femininity: 'Measures achievement vs. quality-of-life orientation. High scores indicate competition, ambition, and recognition are valued.',
    uncertainty_avoidance: 'Measures tolerance for ambiguity. High scores prefer clear rules, structured procedures, and predictable environments.',
    long_term_orientation: 'Measures short vs. long-term focus. High scores favour pragmatism, thrift, and investment in the future; low scores favour tradition and quick results.',
    indulgence_restraint: 'Measures gratification of desires. High scores (Indulgent) value enjoyment, celebration, and work-life integration.',
    communication_style: 'Measures directness of communication. High scores indicate high-context, indirect communication where relationships and context carry meaning.',
};
// ── LLM Recommendations ────────────────────────────────────────
async function generateLLMRecommendations(scores, benchmarks, country, industry, orgName, teamName) {
    const prompt = `You are Dr. Anya Sharma, an expert management consultant and organizational psychologist specializing in cross-cultural dynamics for African markets. Generate Cultural Readiness Index recommendations.

CLIENT: ${orgName}
TEAM: ${teamName}
COUNTRY: ${country}
INDUSTRY: ${industry}

TEAM SCORES (0-100):
${Object.entries(scores).map(([k, v]) => `- ${DIMENSION_LABELS[k] || k}: ${v}`).join('\n')}

COUNTRY/INDUSTRY BENCHMARK SCORES:
${Object.entries(benchmarks).map(([k, v]) => `- ${DIMENSION_LABELS[k] || k}: ${v ?? 'N/A'}`).join('\n')}

Analyze the gaps between team scores and benchmarks. Generate your response as valid JSON with EXACTLY this structure:
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "development_areas": ["area 1 with specific risk explanation", "area 2", "area 3"],
  "action_steps": ["concrete step 1", "concrete step 2", "concrete step 3", "concrete step 4", "concrete step 5"]
}

For ${country} context, be specific about cultural nuances (e.g. Power Distance norms, collectivism, relationship-building). Frame recommendations positively and practically. Each item should be 1-3 sentences.`;
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('No JSON in LLM response');
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            strengths: parsed.strengths || [],
            developmentAreas: parsed.development_areas || [],
            actionSteps: parsed.action_steps || [],
        };
    }
    catch (err) {
        logger_1.logger.error('LLM recommendations failed', err);
        return {
            strengths: ['Strong team alignment identified', 'Cultural competency developing'],
            developmentAreas: ['Further analysis recommended', 'Benchmark gaps identified'],
            actionSteps: ['Review dimension scores in detail', 'Consult cultural expert for target market'],
        };
    }
}
// ── HTML Report Template ───────────────────────────────────────
function buildReportHTML(data) {
    const bandColor = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }[data.colourBand] || '#6b7280';
    const bandLabel = { green: 'High Readiness', amber: 'Moderate Readiness', red: 'Developing Readiness' }[data.colourBand] || 'Unknown';
    const dimensionRows = Object.entries(data.scores).map(([dim, score]) => {
        const benchmark = data.benchmarks[dim];
        const delta = benchmark != null ? (score - benchmark) : null;
        const deltaStr = delta != null
            ? `<span style="color:${delta >= 0 ? '#22c55e' : '#ef4444'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}</span>`
            : '—';
        const barWidth = Math.round(score);
        const bWidth = benchmark != null ? Math.round(benchmark) : 0;
        return `
      <tr>
        <td style="padding:12px 8px;font-weight:500">${DIMENSION_LABELS[dim] || dim}</td>
        <td style="padding:12px 8px">
          <div style="position:relative;height:16px;background:#e5e7eb;border-radius:8px;overflow:hidden">
            <div style="position:absolute;height:100%;width:${barWidth}%;background:#0055a4;border-radius:8px"></div>
            ${benchmark != null ? `<div style="position:absolute;top:0;left:${bWidth}%;width:3px;height:100%;background:#f59e0b"></div>` : ''}
          </div>
        </td>
        <td style="padding:12px 8px;text-align:center;font-weight:600">${score.toFixed(1)}</td>
        <td style="padding:12px 8px;text-align:center;color:#6b7280">${benchmark != null ? benchmark.toFixed(1) : '—'}</td>
        <td style="padding:12px 8px;text-align:center">${deltaStr}</td>
      </tr>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CRI Report — ${data.teamName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #fff; }
  .header { background: #003366; color: white; padding: 32px 40px; }
  .header h1 { margin: 0 0 8px 0; font-size: 28px; }
  .header p { margin: 0; opacity: 0.8; font-size: 14px; }
  .container { padding: 40px; max-width: 900px; margin: 0 auto; }
  .section { margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid #e5e7eb; }
  .section:last-child { border-bottom: none; }
  h2 { color: #003366; font-size: 20px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #0055a4; }
  h3 { color: #374151; font-size: 16px; margin: 16px 0 8px 0; }
  .score-badge { display: inline-block; background: ${bandColor}; color: white; padding: 8px 20px; border-radius: 4px; font-size: 18px; font-weight: bold; }
  .overall-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; display: flex; align-items: center; gap: 24px; margin-bottom: 24px; }
  .overall-score { font-size: 48px; font-weight: 700; color: #003366; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 10px 8px; font-size: 13px; color: #64748b; }
  tr:nth-child(even) td { background: #f8fafc; }
  .rec-list { list-style: none; padding: 0; margin: 0; }
  .rec-list li { padding: 12px 16px; margin-bottom: 8px; border-radius: 6px; font-size: 14px; line-height: 1.5; }
  .strength-item { background: #f0fdf4; border-left: 4px solid #22c55e; }
  .dev-item { background: #fffbeb; border-left: 4px solid #f59e0b; }
  .action-item { background: #eff6ff; border-left: 4px solid #0055a4; counter-increment: action; }
  .footer { background: #f8fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #6b7280; }
  .legend { display: flex; gap: 24px; font-size: 12px; color: #6b7280; margin-top: 8px; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 2px; }
  @media print { body { print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="header">
  <h1>Cultural Readiness Index Report</h1>
  <p>${data.orgName} &bull; ${data.teamName} &bull; Country Focus: ${data.country} &bull; Industry: ${data.industry}</p>
  <p>Generated: ${data.generatedAt} &bull; Based on ${data.responseCount} responses</p>
</div>

<div class="container">

  <!-- Executive Summary -->
  <div class="section">
    <h2>Executive Summary</h2>
    <div class="overall-box">
      <div>
        <div class="overall-score">${data.overallScore.toFixed(1)}</div>
        <div style="color:#6b7280;font-size:13px">Overall CRI Score</div>
      </div>
      <div>
        <div class="score-badge">${bandLabel}</div>
        <p style="margin:8px 0 0 0;font-size:14px;color:#374151">
          This report analyses your team's cultural profile across 7 dimensions, benchmarked against
          ${data.country} ${data.industry} industry norms.
          ${data.colourBand === 'green' ? 'Your team demonstrates high cultural readiness.' :
        data.colourBand === 'amber' ? 'Your team shows moderate readiness with clear development opportunities.' :
            'Your team is developing cultural readiness — targeted intervention recommended.'}
        </p>
      </div>
    </div>
  </div>

  <!-- Dimension Scores -->
  <div class="section">
    <h2>Cultural Profile — All Dimensions</h2>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background:#0055a4"></div> Team Score</div>
      <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div> Benchmark</div>
    </div>
    <table style="margin-top:16px">
      <thead>
        <tr>
          <th>Dimension</th>
          <th style="width:40%">Score vs. Benchmark</th>
          <th>Your Score</th>
          <th>Benchmark</th>
          <th>Gap</th>
        </tr>
      </thead>
      <tbody>${dimensionRows}</tbody>
    </table>
  </div>

  <!-- Dimension Explanations -->
  <div class="section">
    <h2>Dimensions Explained</h2>
    ${Object.entries(data.scores).map(([dim, score]) => `
      <div style="margin-bottom:20px">
        <h3>${DIMENSION_LABELS[dim] || dim} — Score: ${score.toFixed(1)}/100</h3>
        <p style="color:#6b7280;font-size:14px;margin:0">${DIMENSION_DESCRIPTIONS[dim] || ''}</p>
      </div>`).join('')}
  </div>

  <!-- Strengths -->
  <div class="section">
    <h2>Strengths to Leverage</h2>
    <ul class="rec-list">
      ${data.strengths.map(s => `<li class="rec-list-item strength-item">✓ ${s}</li>`).join('')}
    </ul>
  </div>

  <!-- Development Areas -->
  <div class="section">
    <h2>Areas for Development</h2>
    <ul class="rec-list">
      ${data.developmentAreas.map(d => `<li class="rec-list-item dev-item">⚠ ${d}</li>`).join('')}
    </ul>
  </div>

  <!-- Action Steps -->
  <div class="section">
    <h2>Actionable Recommendations</h2>
    <p style="color:#6b7280;font-size:14px">Generated by Dr. Anya Sharma, Organizational Psychologist</p>
    <ol class="rec-list" style="list-style:decimal;padding-left:20px">
      ${data.actionSteps.map(a => `<li class="rec-list-item action-item" style="margin-left:0">${a}</li>`).join('')}
    </ol>
  </div>

  <!-- Risk Heatmap -->
  <div class="section">
    <h2>Risk Heatmap</h2>
    <table>
      <thead>
        <tr>
          <th>Dimension</th><th>Risk Level</th><th>Priority</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(data.scores).map(([dim, score]) => {
        const benchmark = data.benchmarks[dim];
        const gap = benchmark != null ? Math.abs(score - benchmark) : 0;
        const risk = gap > 20 ? 'High' : gap > 10 ? 'Medium' : 'Low';
        const riskColor = risk === 'High' ? '#fecaca' : risk === 'Medium' ? '#fef3c7' : '#d1fae5';
        const priority = risk === 'High' ? '🔴 Immediate' : risk === 'Medium' ? '🟡 Short-term' : '🟢 Monitor';
        return `<tr>
            <td style="padding:10px 8px">${DIMENSION_LABELS[dim] || dim}</td>
            <td style="padding:10px 8px"><span style="background:${riskColor};padding:2px 10px;border-radius:4px">${risk}</span></td>
            <td style="padding:10px 8px">${priority}</td>
          </tr>`;
    }).join('')}
      </tbody>
    </table>
  </div>

</div>

<div class="footer">
  <p>Cultural Readiness Index © ${new Date().getFullYear()} | Methodology based on Hofstede 6-D cultural dimensions model</p>
  <p>GDPR/POPIA/NDPA compliant — Individual responses remain anonymous. Aggregated data only.</p>
</div>

</body>
</html>`;
}
// ── Main report generator ──────────────────────────────────────
async function generateReport(assessmentId, includeLLM = false) {
    logger_1.logger.info('Generating report', { assessmentId, includeLLM });
    // Get assessment + scores + benchmarks
    const result = await (0, db_1.query)(`SELECT a.name as team_name, a.target_country, a.target_industry, a.response_count,
            o.name as org_name,
            ds.power_distance, ds.individualism_collectivism, ds.masculinity_femininity,
            ds.uncertainty_avoidance, ds.long_term_orientation, ds.indulgence_restraint,
            ds.communication_style, ds.overall_score, ds.colour_band,
            b.power_distance as b_pd, b.individualism_collectivism as b_ic,
            b.masculinity_femininity as b_mf, b.uncertainty_avoidance as b_ua,
            b.long_term_orientation as b_lto, b.indulgence_restraint as b_ir,
            b.communication_style as b_cs
     FROM assessments a
     JOIN organizations o ON o.id = a.organization_id
     LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
     LEFT JOIN benchmarks b ON b.country = a.target_country
       AND b.industry = COALESCE(a.target_industry, 'General')
     WHERE a.id = $1`, [assessmentId]);
    if (result.rows.length === 0)
        throw new Error('Assessment not found');
    const row = result.rows[0];
    const scores = {
        power_distance: Number(row.power_distance || 0),
        individualism_collectivism: Number(row.individualism_collectivism || 0),
        masculinity_femininity: Number(row.masculinity_femininity || 0),
        uncertainty_avoidance: Number(row.uncertainty_avoidance || 0),
        long_term_orientation: Number(row.long_term_orientation || 0),
        indulgence_restraint: Number(row.indulgence_restraint || 0),
        communication_style: Number(row.communication_style || 0),
    };
    const benchmarks = {
        power_distance: row.b_pd,
        individualism_collectivism: row.b_ic,
        masculinity_femininity: row.b_mf,
        uncertainty_avoidance: row.b_ua,
        long_term_orientation: row.b_lto,
        indulgence_restraint: row.b_ir,
        communication_style: row.b_cs,
    };
    // Create report record
    await (0, db_1.query)(`INSERT INTO reports (assessment_id, organization_id, status)
     SELECT $1, organization_id, 'generating' FROM assessments WHERE id = $1
     ON CONFLICT (assessment_id) DO UPDATE SET status = 'generating', updated_at = NOW()`, [assessmentId]).catch(async () => {
        // Handle case where unique constraint doesn't exist on assessment_id
        await (0, db_1.query)(`UPDATE reports SET status = 'generating', updated_at = NOW() WHERE assessment_id = $1`, [assessmentId]);
    });
    let strengths = [];
    let developmentAreas = [];
    let actionSteps = [];
    // Generate LLM recommendations for Enterprise tier
    if (includeLLM) {
        const llmResult = await generateLLMRecommendations(scores, benchmarks, row.target_country, row.target_industry || 'General', row.org_name, row.team_name);
        strengths = llmResult.strengths;
        developmentAreas = llmResult.developmentAreas;
        actionSteps = llmResult.actionSteps;
    }
    else {
        // Basic recommendations without LLM
        const sortedDims = Object.entries(scores).sort(([, a], [, b]) => b - a);
        strengths = sortedDims.slice(0, 2).map(([dim]) => `Strong performance in ${DIMENSION_LABELS[dim]}`);
        developmentAreas = sortedDims.slice(-2).map(([dim]) => `Development opportunity in ${DIMENSION_LABELS[dim]}`);
        actionSteps = ['Review benchmark gaps for each dimension', 'Engage cultural training for key areas', 'Re-assess in 6 months'];
    }
    const html = buildReportHTML({
        orgName: row.org_name,
        teamName: row.team_name,
        country: row.target_country,
        industry: row.target_industry || 'General',
        responseCount: row.response_count,
        scores,
        benchmarks,
        overallScore: Number(row.overall_score || 0),
        colourBand: row.colour_band || 'amber',
        strengths,
        developmentAreas,
        actionSteps,
        generatedAt: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
    // Save report
    await (0, db_1.query)(`UPDATE reports SET
       status = 'ready',
       html_content = $2,
       executive_summary = $3,
       strengths = $4,
       development_areas = $5,
       action_steps = $6,
       generated_at = NOW(),
       expires_at = NOW() + INTERVAL '90 days',
       updated_at = NOW()
     WHERE assessment_id = $1`, [
        assessmentId,
        html,
        `CRI report for ${row.team_name} in ${row.target_country} based on ${row.response_count} responses.`,
        JSON.stringify(strengths),
        JSON.stringify(developmentAreas),
        JSON.stringify(actionSteps),
    ]);
    logger_1.logger.info('Report generated', { assessmentId });
}
//# sourceMappingURL=reportGenerator.js.map