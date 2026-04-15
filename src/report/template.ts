import type { Session, SessionMetrics } from '../types.js';

// ─── Threshold helpers ───────────────────────────────────────────────────

type Status = 'good' | 'fair' | 'poor' | 'na';

function statusColor(s: Status): string {
  switch (s) {
    case 'good': return '#22c55e';
    case 'fair': return '#eab308';
    case 'poor': return '#ef4444';
    case 'na': return '#6b7280';
  }
}

function statusLabel(s: Status): string {
  switch (s) {
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    case 'na': return 'N/A';
  }
}

// Threshold evaluators per metric.md
function ttftStatus(v: number | null): Status {
  if (v === null) return 'na';
  if (v < 2) return 'good';
  if (v <= 5) return 'fair';
  return 'poor';
}

function outputSpeedStatus(v: number | null): Status {
  if (v === null) return 'na';
  if (v > 40) return 'good';
  if (v >= 15) return 'fair';
  return 'poor';
}

function resumeSpeedStatus(v: number | null): Status {
  if (v === null) return 'na';
  if (v < 2) return 'good';
  if (v <= 5) return 'fair';
  return 'poor';
}

function timePerTurnStatus(v: number): Status {
  if (v < 10) return 'good';
  if (v <= 30) return 'fair';
  return 'poor';
}

function stallRatioStatus(v: number): Status {
  if (v < 0.1) return 'good';
  if (v <= 0.2) return 'fair';
  return 'poor';
}

function stallCountStatus(v: number): Status {
  if (v <= 3) return 'good';
  if (v <= 10) return 'fair';
  return 'poor';
}

function avgStallDurationStatus(v: number | null): Status {
  if (v === null) return 'na';
  if (v < 2) return 'good';
  if (v <= 5) return 'fair';
  return 'poor';
}

function errorRateStatus(v: number): Status {
  if (v === 0) return 'good';
  if (v <= 2) return 'fair';
  return 'poor';
}

function hiddenRetriesStatus(v: number): Status {
  if (v === 0) return 'good';
  if (v <= 3) return 'fair';
  return 'poor';
}

function questionsAskedStatus(v: number): Status {
  if (v === 0) return 'good';
  if (v <= 2) return 'fair';
  return 'poor';
}

function userCorrectionsStatus(v: number): Status {
  if (v === 0) return 'good';
  if (v <= 1) return 'fair';
  return 'poor';
}

function cleanOutputRateStatus(v: number | null): Status {
  if (v === null) return 'na';
  const pct = v * 100;
  if (pct > 95) return 'good';
  if (pct >= 80) return 'fair';
  return 'poor';
}

function usefulTokenPctStatus(v: number): Status {
  if (v > 30) return 'good';
  if (v >= 15) return 'fair';
  return 'poor';
}

function taskCompletionStatus(v: number): Status {
  if (v >= 0.85) return 'good';
  if (v >= 0.6) return 'fair';
  return 'poor';
}

function gaveUpRateStatus(v: number): Status {
  if (v < 0.05) return 'good';
  if (v <= 0.15) return 'fair';
  return 'poor';
}

// ─── Formatters ──────────────────────────────────────────────────────────

function fmt(v: number | null, decimals: number = 1, suffix: string = ''): string {
  if (v === null || v === undefined) return 'N/A';
  return v.toFixed(decimals) + suffix;
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return 'N/A';
  return (v * 100).toFixed(1) + '%';
}

function fmtInt(v: number | null): string {
  if (v === null || v === undefined) return 'N/A';
  return String(Math.round(v));
}

// ─── Metric card SVG bar ─────────────────────────────────────────────────

function metricBar(value: number, max: number, color: string): string {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return `<svg width="100%" height="8" style="margin-top:4px">
    <rect width="100%" height="8" rx="4" fill="#1e293b"/>
    <rect width="${pct}%" height="8" rx="4" fill="${color}"/>
  </svg>`;
}

// ─── Metric card ─────────────────────────────────────────────────────────

function metricCard(
  label: string,
  value: string,
  status: Status,
  barValue?: number,
  barMax?: number,
): string {
  const color = statusColor(status);
  const bar = barValue !== undefined && barMax !== undefined
    ? metricBar(barValue, barMax, color)
    : '';
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value" style="color:${color}">${value}</div>
      <div class="metric-status" style="color:${color}">${statusLabel(status)}</div>
      ${bar}
    </div>`;
}

// ─── Main template ───────────────────────────────────────────────────────

export function renderReport(
  sessions: Session[],
  allMetrics: SessionMetrics[],
): string {
  const totalSessions = sessions.length;
  if (totalSessions === 0) {
    return minimalReport('No sessions found.');
  }

  // Date range
  const dates = sessions.map((s) => s.started_at).sort();
  const dateFrom = dates[0].substring(0, 10);
  const dateTo = dates[dates.length - 1].substring(0, 10);

  // Aggregates across all sessions
  const avgTokens = avg(allMetrics.map((m) => m.tokens_per_session));
  const avgTurns = avg(allMetrics.map((m) => m.turns_per_session));
  const avgDuration = avg(allMetrics.map((m) => m.duration_seconds));
  const avgToolCalls = avg(allMetrics.map((m) => m.tool_calls_per_session));

  // Pillar averages
  const avgTTFT = avgNullable(allMetrics.map((m) => m.r_time_to_first_token));
  const avgOutputSpeed = avgNullable(allMetrics.map((m) => m.r_output_speed));
  const avgResumeSpeed = avgNullable(allMetrics.map((m) => m.r_resume_speed));
  const avgTimePerTurn = avg(allMetrics.map((m) => m.r_time_per_turn));

  const avgStallRatio = avg(allMetrics.map((m) => m.rel_stall_ratio));
  const avgStallCount = avg(allMetrics.map((m) => m.rel_stall_count));
  const avgAvgStallDuration = avgNullable(allMetrics.map((m) => m.rel_avg_stall_duration));
  const sumErrors = sum(allMetrics.map((m) => m.rel_error_rate));
  const sumHiddenRetries = sum(allMetrics.map((m) => m.rel_hidden_retries));

  const avgQuestionsAsked = avg(allMetrics.map((m) => m.a_questions_asked));
  const avgUserCorrections = avg(allMetrics.map((m) => m.a_user_corrections));
  const avgFirstTrySuccess = avg(allMetrics.map((m) => m.a_first_try_success_rate));
  const avgUserActivePct = avg(allMetrics.map((m) => m.a_user_active_time_pct));
  const avgWorkMultiplier = avgNullable(allMetrics.map((m) => m.a_work_multiplier));

  const avgCleanOutput = avgNullable(allMetrics.map((m) => m.c_clean_output_rate));
  const avgUsefulTokenPct = avg(allMetrics.map((m) => m.c_useful_token_pct));

  const avgTaskCompletion = avg(allMetrics.map((m) => m.comp_task_completion_rate));
  const avgGaveUpRate = avg(allMetrics.map((m) => m.comp_gave_up_rate));
  const avgTimeToDone = avgNullable(allMetrics.map((m) => m.comp_time_to_done));

  // Session rows
  const sessionRows = sessions
    .map((s, i) => {
      const m = allMetrics[i];
      const completedIcon = s.task_completed ? '&#10003;' : '&#10007;';
      const completedColor = s.task_completed ? '#22c55e' : '#ef4444';
      return `<tr>
        <td style="font-family:monospace;font-size:11px">${s.session_id.substring(0, 12)}...</td>
        <td>${s.started_at.substring(0, 19).replace('T', ' ')}</td>
        <td>${s.agent_name} ${s.agent_version}</td>
        <td>${s.model_id}</td>
        <td>${s.total_turns}</td>
        <td>${fmt(s.duration_ms / 1000, 1)}s</td>
        <td>${s.total_tool_calls}</td>
        <td style="color:${completedColor}">${completedIcon}</td>
        <td>${m ? fmt(m.r_time_to_first_token, 2) + 's' : 'N/A'}</td>
        <td>${m ? fmt(m.rel_stall_ratio * 100, 1) + '%' : 'N/A'}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jinsong AX Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    background: #0f172a;
    color: #e2e8f0;
    line-height: 1.6;
    padding: 32px;
  }
  h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; color: #f8fafc; }
  h2 { font-size: 18px; font-weight: 500; margin: 32px 0 16px; color: #94a3b8; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
  h3 { font-size: 14px; font-weight: 500; margin: 24px 0 12px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }
  .header { margin-bottom: 32px; }
  .header-meta { color: #64748b; font-size: 13px; margin-top: 4px; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .summary-card {
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .summary-card .value { font-size: 28px; font-weight: 700; color: #f8fafc; margin: 4px 0; }
  .summary-card .unit { font-size: 12px; color: #94a3b8; }
  .pillar-section {
    background: #1e293b;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .pillar-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pillar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .metric-card {
    background: #0f172a;
    border-radius: 6px;
    padding: 12px;
  }
  .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-value { font-size: 20px; font-weight: 700; margin: 4px 0 2px; }
  .metric-status { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 12px;
  }
  th { text-align: left; padding: 8px 12px; background: #1e293b; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
  td { padding: 8px 12px; border-bottom: 1px solid #1e293b; }
  tr:hover td { background: #1e293b40; }
  .footer { margin-top: 48px; text-align: center; color: #475569; font-size: 11px; }
</style>
</head>
<body>

<div class="header">
  <h1>Jinsong AX Report</h1>
  <div class="header-meta">${dateFrom} to ${dateTo} &middot; ${totalSessions} session${totalSessions !== 1 ? 's' : ''} &middot; Generated ${new Date().toISOString().substring(0, 19)}</div>
</div>

<h2>Operational Overview</h2>
<div class="summary-grid">
  <div class="summary-card">
    <div class="label">Sessions</div>
    <div class="value">${totalSessions}</div>
  </div>
  <div class="summary-card">
    <div class="label">Avg Tokens</div>
    <div class="value">${fmtInt(avgTokens)}</div>
    <div class="unit">per session</div>
  </div>
  <div class="summary-card">
    <div class="label">Avg Turns</div>
    <div class="value">${fmt(avgTurns, 1)}</div>
    <div class="unit">per session</div>
  </div>
  <div class="summary-card">
    <div class="label">Avg Duration</div>
    <div class="value">${fmt(avgDuration, 1)}</div>
    <div class="unit">seconds</div>
  </div>
  <div class="summary-card">
    <div class="label">Avg Tool Calls</div>
    <div class="value">${fmt(avgToolCalls, 1)}</div>
    <div class="unit">per session</div>
  </div>
</div>

<h2>Experience Quality</h2>

<div class="pillar-section">
  <div class="pillar-title">Responsiveness &mdash; "Is it fast?"</div>
  <div class="pillar-grid">
    ${metricCard('Time to First Token', fmt(avgTTFT, 2) + 's', ttftStatus(avgTTFT), avgTTFT ?? 0, 10)}
    ${metricCard('Output Speed', fmt(avgOutputSpeed, 1) + ' tok/s', outputSpeedStatus(avgOutputSpeed), avgOutputSpeed ?? 0, 80)}
    ${metricCard('Resume Speed', fmt(avgResumeSpeed, 2) + 's', resumeSpeedStatus(avgResumeSpeed))}
    ${metricCard('Time per Turn', fmt(avgTimePerTurn, 1) + 's', timePerTurnStatus(avgTimePerTurn), avgTimePerTurn, 60)}
  </div>
</div>

<div class="pillar-section">
  <div class="pillar-title">Reliability &mdash; "Does it work without breaking?"</div>
  <div class="pillar-grid">
    ${metricCard('Stall Ratio', fmt(avgStallRatio * 100, 1) + '%', stallRatioStatus(avgStallRatio), avgStallRatio * 100, 50)}
    ${metricCard('Stall Count', fmt(avgStallCount, 1), stallCountStatus(avgStallCount), avgStallCount, 15)}
    ${metricCard('Avg Stall Duration', fmt(avgAvgStallDuration, 1) + 's', avgStallDurationStatus(avgAvgStallDuration))}
    ${metricCard('Errors', fmtInt(sumErrors), errorRateStatus(sumErrors / totalSessions))}
    ${metricCard('Hidden Retries', fmtInt(sumHiddenRetries), hiddenRetriesStatus(sumHiddenRetries / totalSessions))}
  </div>
</div>

<div class="pillar-section">
  <div class="pillar-title">Autonomy &mdash; "Can it handle it on its own?"</div>
  <div class="pillar-grid">
    ${metricCard('Questions Asked', fmt(avgQuestionsAsked, 1), questionsAskedStatus(avgQuestionsAsked))}
    ${metricCard('User Corrections', fmt(avgUserCorrections, 1), userCorrectionsStatus(avgUserCorrections))}
    ${metricCard('First-Try Success', fmtPct(avgFirstTrySuccess), avgFirstTrySuccess >= 0.8 ? 'good' : avgFirstTrySuccess >= 0.5 ? 'fair' : 'poor')}
    ${metricCard('User Active Time', fmt(avgUserActivePct, 1) + '%', avgUserActivePct < 10 ? 'good' : avgUserActivePct <= 30 ? 'fair' : 'poor')}
    ${metricCard('Work Multiplier', avgWorkMultiplier !== null ? fmt(avgWorkMultiplier, 1) + 'x' : 'N/A', avgWorkMultiplier === null ? 'na' : avgWorkMultiplier > 10 ? 'good' : avgWorkMultiplier >= 3 ? 'fair' : 'poor')}
  </div>
</div>

<div class="pillar-section">
  <div class="pillar-title">Correctness &mdash; "Is the output right?"</div>
  <div class="pillar-grid">
    ${metricCard('Clean Output Rate', avgCleanOutput !== null ? fmtPct(avgCleanOutput) : 'N/A', cleanOutputRateStatus(avgCleanOutput))}
    ${metricCard('Useful Token %', fmt(avgUsefulTokenPct, 1) + '%', usefulTokenPctStatus(avgUsefulTokenPct))}
    ${metricCard('Output Quality', 'N/A', 'na')}
    ${metricCard('Quality Decay', 'N/A', 'na')}
  </div>
</div>

<div class="pillar-section">
  <div class="pillar-title">Completion &mdash; "Did it finish the job?"</div>
  <div class="pillar-grid">
    ${metricCard('Task Completion', fmtPct(avgTaskCompletion), taskCompletionStatus(avgTaskCompletion), avgTaskCompletion * 100, 100)}
    ${metricCard('Gave-Up Rate', fmtPct(avgGaveUpRate), gaveUpRateStatus(avgGaveUpRate))}
    ${metricCard('Time to Done', avgTimeToDone !== null ? fmt(avgTimeToDone, 1) + 's' : 'N/A', 'na')}
    ${metricCard('Redo Rate', 'N/A', 'na')}
    ${metricCard('Came Back Rate', 'N/A', 'na')}
  </div>
</div>

<h2>Sessions</h2>
<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Started</th>
      <th>Agent</th>
      <th>Model</th>
      <th>Turns</th>
      <th>Duration</th>
      <th>Tools</th>
      <th>Done</th>
      <th>TTFT</th>
      <th>Stall%</th>
    </tr>
  </thead>
  <tbody>
    ${sessionRows}
  </tbody>
</table>

<div class="footer">
  Jinsong v0.1.0 &middot; Agent Experience Quality
</div>

</body>
</html>`;
}

function minimalReport(message: string): string {
  return `<!DOCTYPE html>
<html><head><title>Jinsong Report</title>
<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;height:100vh}
.msg{text-align:center;color:#64748b}</style></head>
<body><div class="msg"><h1>Jinsong AX Report</h1><p>${message}</p></div></body></html>`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function avgNullable(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
