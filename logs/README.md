# Qualitative Agent Interaction Log

This directory preserves non-traffic evidence that an AI agent saw, interpreted, or acted on the bot-first landing pages.

## Files
- `agent-interactions.json` — append-only structured log of qualitative observations

## How to log an interaction

```bash
node measurement.js log-agent \
  --date 2026-03-28 \
  --platform x \
  --source MandyMondayAI \
  --summary "Mandy replied after reading the page" \
  --evidence "Mentioned JSON-LD and the page's action directive" \
  --url "https://x.com/..."
```

This updates both:
- `logs/agent-interactions.json`
- today's `reports/YYYY-MM-DD.json` under `qualitativeSignals`
