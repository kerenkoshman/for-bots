#!/bin/bash
# Master daily orchestrator for bot-first landing page system
# Runs at 8:00am UTC every day
# 1. Sync new Medium articles
# 2. Rotate A/B variant
# 3. Generate traffic + social report
# 4. Push everything to GitHub Pages
# 5. Write summary to DAILY_SUMMARY.md (picked up by HEARTBEAT)

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
TODAY=$(date -u +%Y-%m-%d)
LOG="$DIR/generate.log"

echo "[${TODAY}] ===== DAILY ORCHESTRATOR START =====" >> "$LOG"

# 1. Regenerate article pages from Medium RSS
echo "[$(date -u +%H:%M:%SZ)] Step 1: Sync Medium articles..." >> "$LOG"
node generate.js >> "$LOG" 2>&1

# 2. Rotate A/B test variant
echo "[$(date -u +%H:%M:%SZ)] Step 2: Rotate A/B variant..." >> "$LOG"
node ab-test.js >> "$LOG" 2>&1

# 3. Generate traffic report
echo "[$(date -u +%H:%M:%SZ)] Step 3: Generate traffic report..." >> "$LOG"
node daily-report.js >> "$LOG" 2>&1

# 4. Push to GitHub Pages
echo "[$(date -u +%H:%M:%SZ)] Step 4: Push to GitHub..." >> "$LOG"
git add -A
if git diff --cached --quiet; then
  echo "[$(date -u +%H:%M:%SZ)] No changes to push." >> "$LOG"
else
  git commit -m "Daily update ${TODAY}: article sync + A/B rotation + report" >> "$LOG" 2>&1
  git push origin main >> "$LOG" 2>&1
  echo "[$(date -u +%H:%M:%SZ)] Pushed." >> "$LOG"
fi

# 5. Write summary for HEARTBEAT pickup
REPORT_FILE="$DIR/reports/${TODAY}.md"
AB_STATE=$(node -e "const s=require('./ab-state.json'); console.log(s.currentVariant || 'unknown')" 2>/dev/null || echo "unknown")

if [ -f "$REPORT_FILE" ]; then
  VIEWS=$(grep "Today's page views" "$REPORT_FILE" | grep -oP '\d+' | head -1 || echo "0")
  UNIQUES=$(grep "Today's unique visitors" "$REPORT_FILE" | grep -oP '\d+' | head -1 || echo "0")
  SOCIAL=$(grep "Social mentions found" "$REPORT_FILE" | grep -oP '\d+' | head -1 || echo "0")
  SIGNAL=$(grep "Traffic signal" "$REPORT_FILE" | sed 's/.*Traffic signal: //' || echo "no data")
  SOCIAL_SIGNAL=$(grep "Social signal" "$REPORT_FILE" | sed 's/.*Social signal: //' || echo "no data")
else
  VIEWS=0; UNIQUES=0; SOCIAL=0; SIGNAL="no data"; SOCIAL_SIGNAL="no data"
fi

cat > "$DIR/DAILY_SUMMARY.md" << SUMMARY
# Bot-First Daily Report — ${TODAY}

## Traffic
- Views today: ${VIEWS}
- Unique visitors: ${UNIQUES}
- Social mentions: ${SOCIAL}
- Traffic signal: ${SIGNAL}
- Social signal: ${SOCIAL_SIGNAL}

## A/B Test
- Active variant: \`${AB_STATE}\`

## Links
- Site: https://kerenkoshman.github.io/for-bots/
- Active experiment: https://kerenkoshman.github.io/for-bots/experiment.html
- Article index: https://kerenkoshman.github.io/for-bots/agent-index.html
- Full report: bot-landing/reports/${TODAY}.md
SUMMARY

echo "[$(date -u +%H:%M:%SZ)] Summary written. Done." >> "$LOG"
echo "[${TODAY}] ===== DAILY ORCHESTRATOR END =====" >> "$LOG"
