#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPORTS_DIR = path.join(ROOT, 'reports');
const LOGS_DIR = path.join(ROOT, 'logs');
const AGENT_LOG = path.join(LOGS_DIR, 'agent-interactions.json');
const ANALYTICS_JS = path.join(ROOT, 'analytics.js');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadReport(date) {
  return readJson(path.join(REPORTS_DIR, `${date}.json`), {});
}

function saveReport(date, data) {
  writeJson(path.join(REPORTS_DIR, `${date}.json`), data);
}

function loadAgentLog() {
  ensureDir(LOGS_DIR);
  return readJson(AGENT_LOG, { interactions: [] });
}

function saveAgentLog(data) {
  ensureDir(LOGS_DIR);
  writeJson(AGENT_LOG, data);
}

function detectAgentSource(text) {
  const hay = (text || '').toLowerCase();
  if (hay.includes('mandy')) return 'MandyMondayAI';
  if (hay.includes('chatgpt') || hay.includes('openai')) return 'ChatGPT/OpenAI';
  if (hay.includes('perplexity')) return 'Perplexity';
  if (hay.includes('you.com') || hay.includes('youcom')) return 'You.com';
  if (hay.includes('claude')) return 'Claude';
  return 'unknown';
}

function appendInteraction(entry) {
  const log = loadAgentLog();
  const key = JSON.stringify([entry.date, entry.source, entry.platform, entry.summary]);
  const exists = log.interactions.some(i => JSON.stringify([i.date, i.source, i.platform, i.summary]) === key);
  if (!exists) {
    log.interactions.push({
      loggedAt: new Date().toISOString(),
      ...entry,
    });
    saveAgentLog(log);
  }
  return log;
}

function upsertQualitativeSignal(date, signal) {
  const report = loadReport(date);
  if (!report.qualitativeSignals) report.qualitativeSignals = [];
  const key = JSON.stringify([signal.source, signal.platform, signal.summary]);
  const exists = report.qualitativeSignals.some(s => JSON.stringify([s.source, s.platform, s.summary]) === key);
  if (!exists) report.qualitativeSignals.push(signal);
  saveReport(date, report);
  return report;
}

function buildAnalyticsScript() {
  return `(function(){\n  var endpoint='https://api.goatcounter.com/count';\n  function withRef(url){\n    try {\n      var u=new URL(url, location.href);\n      var sp=u.searchParams;\n      if(!sp.get('ref')) {\n        var ref = new URLSearchParams(location.search).get('ref') || document.referrer || 'direct';\n        sp.set('ref', ref);\n      }\n      if(!sp.get('variant')) {\n        var variant = document.documentElement.getAttribute('data-experiment-variant') || 'unknown';\n        sp.set('variant', variant);\n      }\n      u.search = sp.toString();\n      return u.pathname + (u.search ? '?' + u.search : '') + (u.hash || '');\n    } catch(e) { return url; }\n  }\n  function count(path, title, event){\n    var payload={\n      v:1,\n      no_onload:1,\n      referrer: document.referrer || '',\n      path:path,\n      title:title || document.title,\n      event: !!event\n    };\n    var body = new URLSearchParams(payload).toString();\n    if (navigator.sendBeacon) {\n      navigator.sendBeacon(endpoint, new Blob([body], {type:'application/x-www-form-urlencoded'}));\n    } else {\n      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,keepalive:true}).catch(function(){});\n    }\n  }\n  count(withRef(location.pathname + location.search + location.hash), document.title, false);\n  document.addEventListener('click', function(e){\n    var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;\n    if(!a) return;\n    var href=a.getAttribute('href');\n    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;\n    count(withRef(href), 'outbound:'+href, true);\n  }, true);\n})();\n`;
}

function ensureAnalyticsAsset() {
  fs.writeFileSync(ANALYTICS_JS, buildAnalyticsScript(), 'utf8');
}

function usage() {
  console.log('Usage:');
  console.log('  node measurement.js ensure-assets');
  console.log('  node measurement.js log-agent --date YYYY-MM-DD --platform x --source MandyMondayAI --summary "..." --evidence "..."');
}

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const cmd = process.argv[2];
if (cmd === 'ensure-assets') {
  ensureAnalyticsAsset();
  ensureDir(LOGS_DIR);
  if (!fs.existsSync(AGENT_LOG)) saveAgentLog({ interactions: [] });
  console.log('measurement assets ready');
} else if (cmd === 'log-agent') {
  const date = arg('--date') || new Date().toISOString().slice(0,10);
  const platform = arg('--platform') || 'unknown';
  const source = arg('--source') || detectAgentSource((arg('--summary') || '') + ' ' + (arg('--evidence') || ''));
  const summary = arg('--summary') || '';
  const evidence = arg('--evidence') || '';
  const url = arg('--url') || '';
  const entry = { date, platform, source, summary, evidence, url, kind: 'qualitative-agent-interaction' };
  appendInteraction(entry);
  upsertQualitativeSignal(date, entry);
  console.log('agent interaction logged');
} else {
  usage();
  process.exit(cmd ? 1 : 0);
}
