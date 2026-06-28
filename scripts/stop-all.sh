#!/usr/bin/env bash
set -euo pipefail

if command -v pm2 &> /dev/null; then
  pm2 stop ecosystem.config.js || true
  echo "All services stopped."
else
  echo "PM2 not found."
  exit 1
fi
