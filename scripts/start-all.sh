#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run build

if command -v pm2 &> /dev/null; then
  pm2 start ecosystem.config.js
  pm2 save
  echo "All services started via PM2."
else
  echo "PM2 not found. Install with: npm install -g pm2"
  exit 1
fi
