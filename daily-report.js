#!/usr/bin/env node
/**
 * Daily Agent Traffic Report
 * Sources:
 *   1. GitHub Pages traffic API (views, uniques, referrers, popular paths)
 *   2. Brave web search — social mentions of the landing page URL
 *   3. Report saved as JSON + markdown daily log
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO = 'kerenkoshman/for-bots';
const SITE_URL = 'https://kerenkoshman.github.io/for-bots';
const REPORTS_DIR = path.join(__dirname, 'reports');
const SEARCH_TERMS = [
  `"kerenkoshman.github.io/for-bots"`,
  `"keren koshman" "for-bots"`,
  `"keren koshman" "bot-first"`,
  `site:x.com "kerenkoshman.github.io"`,
  `site:linkedin.com "kerenkoshman.github.io"`,
];

// Read GitHub token from git remote
function getGitHubToken() {
  try {
    const { execSync } = require('child_process');
    const remote = execSync('git -C ' + __dirname + ' remote get-url origin', { encoding: 'utf8' }).trim();
    const m = remote.match(/:([^@]+)@/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'bot-landing-reporter/1.0', ...headers },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getGitHubTraffic(token) {
  const headers = { Authorization: `token ${token}` };
  const base = `https://api.github.com/repos/${REPO}/traffic`;

  const [views, clones, referrers, paths] = await Promise.all([
    httpGet(`${base}/views`, headers).catch(() => null),
    httpGet(`${base}/clones`, headers).catch(() => null),
    httpGet(`${base}/referrers`, headers).catch(() => null),
    httpGet(`${base}/popular/paths`, headers).catch(() => null),
  ]);

  return { views, clones, referrers, paths };
}

async function searchSocialMentions() {
  const BRAVE_KEY = process.env.BRAVE_API_KEY;
  const results = [];

  for (const term of SEARCH_TERMS) {
    if (BRAVE_KEY) {
      try {
        const data = await httpGet(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(term)}&count=5&freshness=week`,
          { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': BRAVE_KEY }
        );
        const hits = (data?.web?.results || []).filter(r =>
          r.url && (r.url.includes('x.com') || r.url.includes('twitter.com') ||
                    r.url.includes('linkedin.com') || r.url.includes('reddit.com') ||
                    r.url.includes('github.io'))
        );
        if (hits.length > 0) results.push({ query: term, hits });
      } catch (e) {
        results.push({ query: term, error: e.message });
      }
    } else {
      // Fallback: use standard web search via curl-style (no key)
      results.push({ query: term, note: 'No BRAVE_API_KEY — run with key for social search' });
    }
  }
  return results;
}

function formatMarkdownReport(date, traffic, social, articleCount) {
  const today = traffic.views?.views?.find(v => v.timestamp?.startsWith(date));
  const totalViews = traffic.views?.count ?? 0;
  const totalUniques = traffic.views?.uniques ?? 0;
  const todayViews = today?.count ?? 0;
  const todayUniques = today?.uniques ?? 0;

  const referrerList = Array.isArray(traffic.referrers) ? traffic.referrers : [];
  const topReferrers = referrerList.length > 0
    ? referrerList.map(r => `  - ${r.referrer}: ${r.count} views (${r.uniques} unique)`).join('\n')
    : '  - No referrer data yet';

  const topPaths = Array.isArray(traffic.paths) && traffic.paths.length > 0
    ? traffic.paths.slice(0, 5).map(p => `  - \`${p.path}\`: ${p.count} views`).join('\n')
    : '  - No path data yet';

  const socialHits = social.filter(s => s.hits && s.hits.length > 0);
  const socialSection = socialHits.length > 0
    ? socialHits.map(s =>
        `  **Query:** \`${s.query}\`\n` +
        s.hits.map(h => `  - [${h.title}](${h.url})\n    > ${(h.description || '').substring(0, 120)}`).join('\n')
      ).join('\n\n')
    : '  No social mentions found today.';

  const hasSocialActivity = socialHits.length > 0;
  const trafficSignal = todayViews > 0 ? `🟢 ${todayViews} views today` : '⚪ No views yet today';

  return `# 🤖 Bot-First Daily Report — ${date}

## Summary
| Metric | Value |
|---|---|
| Today's page views | ${todayViews} |
| Today's unique visitors | ${todayUniques} |
| Total views (14d window) | ${totalViews} |
| Total uniques (14d window) | ${totalUniques} |
| Article pages live | ${articleCount} |
| Social mentions found | ${hasSocialActivity ? socialHits.reduce((n,s) => n + s.hits.length, 0) : 0} |

**Traffic signal:** ${trafficSignal}
**Social signal:** ${hasSocialActivity ? '🔴 Activity detected — see below' : '⚪ No mentions yet'}

---

## GitHub Pages Traffic

### Views (last 14 days)
${(traffic.views?.views || []).filter(v => v.count > 0).map(v =>
  `  - ${v.timestamp.split('T')[0]}: ${v.count} views, ${v.uniques} unique`
).join('\n') || '  No traffic data yet.'}

### Top Referrers
${topReferrers}

### Popular Pages
${topPaths}

---

## Social & Web Mentions

${socialSection}

---

## Agent Activity Signals

Based on traffic patterns and referrer data:
${totalViews === 0 ? `- 🕐 Site launched today — no traffic yet. Give agents 24–48h to index and visit.` : ''}
${totalViews > 0 && referrerList.some(r => r.referrer?.includes('perplexity')) ? '- 🤖 **Perplexity** visited — AI search agent detected' : ''}
${totalViews > 0 && referrerList.some(r => r.referrer?.includes('you.com')) ? '- 🤖 **You.com** visited — AI search agent detected' : ''}
${totalViews > 0 && referrerList.some(r => r.referrer?.includes('openai') || r.referrer?.includes('chatgpt')) ? '- 🤖 **ChatGPT/OpenAI** referral detected' : ''}
${referrerList.filter(r => !['google','github','direct','t.co','linkedin'].some(k => r.referrer?.includes(k))).map(r =>
  `- ⚠️ Unknown referrer (possible bot): \`${r.referrer}\` — ${r.count} hits`
).join('\n') || (totalViews > 0 ? '' : '')}
${totalViews === 0 ? '' : '- Check referrers above for unrecognized sources — those are your best agent-visit candidates.'}

---

*Report generated: ${new Date().toISOString()} | Site: ${SITE_URL}*
`;
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const today = new Date().toISOString().split('T')[0];
  console.log(`[${new Date().toISOString()}] Generating daily report for ${today}...`);

  const token = getGitHubToken();
  if (!token) { console.error('Could not read GitHub token from git remote.'); process.exit(1); }

  // Count live articles
  const articlesDir = path.join(__dirname, 'articles');
  const articleCount = fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter(f => f.endsWith('.html')).length
    : 0;

  console.log('Fetching GitHub traffic...');
  const traffic = await getGitHubTraffic(token);

  console.log('Searching for social mentions...');
  const social = await searchSocialMentions();

  const report = formatMarkdownReport(today, traffic, social, articleCount);
  const rawData = { date: today, traffic, social, articleCount };

  const mdPath = path.join(REPORTS_DIR, `${today}.md`);
  const jsonPath = path.join(REPORTS_DIR, `${today}.json`);

  fs.writeFileSync(mdPath, report, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(rawData, null, 2), 'utf8');

  console.log(`Report saved: ${mdPath}`);
  console.log('---');
  console.log(report);
}

main().catch(err => { console.error(err); process.exit(1); });
