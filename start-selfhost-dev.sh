#!/usr/bin/env bash
set -euo pipefail

echo "=== 启动自托管 ClawHub（本机前端 + Docker API）==="
echo

echo "1. 确保 API 容器在跑..."
docker compose -f docker-compose.selfhost.yml up -d
echo "   API: http://127.0.0.1:3000/api/v1/skills"
echo

echo "2. 启动前端 dev server（本机）..."
echo "   Web: http://127.0.0.1:5173"
echo

export VITE_SELFHOST_MODE=true
export VITE_CONVEX_URL=""
export PATH="$HOME/.bun/bin:$PATH"

cd /Users/taomiao/codes/clawhub
bun --bun vite dev --host 127.0.0.1 --port 5173
