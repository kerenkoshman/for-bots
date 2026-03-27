#!/bin/bash
# Generate daily report and deliver it via OpenClaw
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
node daily-report.js
