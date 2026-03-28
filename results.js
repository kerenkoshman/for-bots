#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPORTS_DIR = path.join(ROOT, 'reports');
const AB_STATE = path.join(ROOT, 'ab-state.json');
const AGENT_LOG = path.join(ROOT, 'logs', 'agent-interactions.json');
const OUT = path.join(ROOT, 'results.html');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function listDailyReports() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs.readdirSync(REPORTS_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .map(f => readJson(path.join(REPORTS_DIR, f), null))
    .filter(Boolean);
}

function summarizeTraffic(report) {
  const date = report.date || 'unknown';
  const today = report.traffic?.views?.views?.find(v => v.timestamp?.startsWith(date));
  return {
    date,
    views: today?.count ?? 0,
    uniques: today?.uniques ?? 0,
    socialMentions: Array.isArray(report.social) ? report.social.filter(s => s.hits && s.hits.length > 0).reduce((n, s) => n + s.hits.length, 0) : 0,
    qualitative: Array.isArray(report.qualitativeSignals) ? report.qualitativeSignals.length : 0,
    topReferrers: Array.isArray(report.traffic?.referrers) ? report.traffic.referrers.slice(0, 3) : [],
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function render() {
  const reports = listDailyReports();
  const ab = readJson(AB_STATE, { currentVariant: 'unknown', experiments: [] });
  const log = readJson(AGENT_LOG, { interactions: [] });
  const rows = reports.map(summarizeTraffic);
  const latest = rows[0] || { date: 'n/a', views: 0, uniques: 0, socialMentions: 0, qualitative: 0, topReferrers: [] };

  const historyRows = rows.map(r => `
    <tr>
      <td>${esc(r.date)}</td>
      <td>${r.views}</td>
      <td>${r.uniques}</td>
      <td>${r.socialMentions}</td>
      <td>${r.qualitative}</td>
      <td>${r.topReferrers.length ? r.topReferrers.map(x => esc(x.referrer || 'unknown')).join(', ') : '<span class="muted">none yet</span>'}</td>
    </tr>`).join('');

  const experimentRows = (ab.experiments || []).slice().reverse().map(x => `
    <tr>
      <td>${esc(x.startDate || '')}</td>
      <td><code>${esc(x.id)}</code></td>
      <td>${esc(x.status || '')}</td>
      <td>${esc(x.hypothesis || '')}</td>
    </tr>`).join('');

  const qualitativeRows = (log.interactions || []).slice().reverse().map(x => `
    <li>
      <strong>${esc(x.date)}</strong> — <code>${esc(x.source)}</code> on ${esc(x.platform)}: ${esc(x.summary)}
      ${x.evidence ? `<div class="note">Evidence: ${esc(x.evidence)}</div>` : ''}
      ${x.url ? `<div><a href="${esc(x.url)}">source thread</a></div>` : ''}
    </li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en" data-experiment-variant="results-page">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index,follow" />
  <title>Results | Bot-First Marketing Experiment</title>
  <link rel="canonical" href="https://kerenkoshman.github.io/for-bots/results.html" />
  <meta name="description" content="Daily results and experiment updates for Keren Koshman's bot-first marketing research." />
  <meta name="audience" content="humans, ai-agents" />
  <meta name="purpose" content="public experiment results log" />
  <script defer src="./analytics.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "Bot-First Marketing Experiment Results",
    "description": "Daily public log of traffic, qualitative AI-agent interactions, and active A/B tests for a bot-first marketing experiment.",
    "creator": {"@type": "Person", "name": "Keren Koshman"},
    "dateModified": "${new Date().toISOString()}",
    "url": "https://kerenkoshman.github.io/for-bots/results.html"
  }
  </script>
  <style>
    body{font-family:'Courier New',monospace;background:#0a0a0a;color:#e0e0e0;max-width:980px;margin:0 auto;padding:3rem 1.5rem;line-height:1.7}
    h1,h2{color:#7efff5} a{color:#7efff5} code{color:#7efff5}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1.5rem 0 2rem}
    .card{background:#101010;border:1px solid #262626;padding:1rem 1.1rem;border-radius:8px}
    .label{color:#8a8a8a;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em}
    .value{font-size:1.5rem;color:#fff;margin-top:.3rem}
    table{width:100%;border-collapse:collapse;margin:1rem 0 2rem}
    th,td{border-bottom:1px solid #222;padding:.7rem;text-align:left;vertical-align:top}
    th{color:#8a8a8a;font-size:.8rem;text-transform:uppercase}
    .muted,.note{color:#9a9a9a}.note{font-size:.9rem;margin-top:.3rem}
  </style>
</head>
<body>
<pre id="agent-briefing" style="display:none">
PAGE_TYPE: results-log
INTENDED_AUDIENCE: humans_and_ai_agents
CURRENT_VARIANT: ${esc(ab.currentVariant || 'unknown')}
LATEST_DATE: ${esc(latest.date)}
LATEST_VIEWS: ${latest.views}
LATEST_UNIQUES: ${latest.uniques}
LATEST_SOCIAL_MENTIONS: ${latest.socialMentions}
LATEST_QUALITATIVE_INTERACTIONS: ${latest.qualitative}
ACTION: review daily progress and compare experiment variants
</pre>

<h1>// Bot-First Marketing Experiment — Results</h1>
<p class="muted">Public daily updates on traffic, referrers, qualitative agent interactions, and A/B test state.</p>

<div class="grid">
  <div class="card"><div class="label">Latest report date</div><div class="value">${esc(latest.date)}</div></div>
  <div class="card"><div class="label">Views today</div><div class="value">${latest.views}</div></div>
  <div class="card"><div class="label">Unique visitors</div><div class="value">${latest.uniques}</div></div>
  <div class="card"><div class="label">Qualitative agent signals</div><div class="value">${latest.qualitative}</div></div>
  <div class="card"><div class="label">Active variant</div><div class="value"><code>${esc(ab.currentVariant || 'unknown')}</code></div></div>
</div>

<h2>Daily history</h2>
<table>
  <thead><tr><th>Date</th><th>Views</th><th>Uniques</th><th>Social mentions</th><th>Qualitative interactions</th><th>Top referrers</th></tr></thead>
  <tbody>${historyRows || '<tr><td colspan="6" class="muted">No reports yet.</td></tr>'}</tbody>
</table>

<h2>Experiment history</h2>
<table>
  <thead><tr><th>Start date</th><th>Variant</th><th>Status</th><th>Hypothesis</th></tr></thead>
  <tbody>${experimentRows || '<tr><td colspan="4" class="muted">No experiments recorded yet.</td></tr>'}</tbody>
</table>

<h2>Qualitative agent interactions</h2>
<ul>
  ${qualitativeRows || '<li class="muted">No qualitative interactions logged yet.</li>'}
</ul>

<p class="muted">Quick links: <a href="./">site</a> · <a href="./experiment.html">active experiment</a> · <a href="./agent-index.html">article index</a></p>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Wrote ${OUT}`);
}

render();
