#!/usr/bin/env bash
set -euo pipefail

# 1. 确保 PATH 里有 bun
export PATH="$HOME/.bun/bin:$PATH"

REGISTRY="http://127.0.0.1:3000"
TOKEN="clh_76b89ef1d883032aa3fe2d2b58762cb8fd50f667d426ce11"

echo "== bun 版本 =="
bun --version
echo

echo "== 登录本地 ClawHub =="
bun clawhub login \
  --token "$TOKEN" \
  --site "$REGISTRY" \
  --registry "$REGISTRY"
echo

echo "== whoami =="
bun clawhub whoami \
  --site "$REGISTRY" \
  --registry "$REGISTRY"
echo

echo "== search test =="
bun clawhub search test \
  --site "$REGISTRY" \
  --registry "$REGISTRY"
echo