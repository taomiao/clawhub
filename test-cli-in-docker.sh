#!/usr/bin/env bash
set -euo pipefail

echo "=== 在 Docker 容器里测试 CLI ==="
echo

echo "1. 生成一个管理员 token..."
TOKEN=$(docker compose -f docker-compose.selfhost.yml exec -T api bun selfhost/api/src/seed.ts 2>/dev/null | tail -n 1)
echo "Token: $TOKEN"
echo

echo "2. 在容器里运行 clawhub login + whoami..."
docker compose -f docker-compose.selfhost.yml exec -T api bash -c "
  echo 'Login...'
  bun clawhub login --token $TOKEN --site http://localhost:3000 --registry http://localhost:3000
  echo 'Whoami...'
  bun clawhub whoami --site http://localhost:3000 --registry http://localhost:3000
"
echo

echo "3. 在容器里搜索 test..."
docker compose -f docker-compose.selfhost.yml exec -T api \
  bun clawhub search test --site http://localhost:3000 --registry http://localhost:3000
echo

echo "=== 测试完成！CLI 已成功连接到本地自托管 ClawHub ==="
