#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. 检查系统时间 ==="
date
echo

echo "=== 2. 检查能否访问 npm registry ==="
curl -I https://registry.npmjs.org 2>&1 | head -5
echo

echo "=== 3. 尝试用淘宝镜像源（国内常用） ==="
export BUN_INSTALL_REGISTRY=https://registry.npmmirror.com
export PATH="$HOME/.bun/bin:$PATH"

echo "设置了 BUN_INSTALL_REGISTRY=$BUN_INSTALL_REGISTRY"
echo

echo "=== 4. 重试 bun clawhub whoami ==="
cd /Users/taomiao/codes/clawhub
bun clawhub whoami \
  --site http://127.0.0.1:3000 \
  --registry http://127.0.0.1:3000 2>&1 || echo "仍然失败，继续尝试其他方案"
echo

echo "=== 5. 如果上面仍失败，尝试关闭 TLS 验证（仅测试用，不推荐生产） ==="
export NODE_TLS_REJECT_UNAUTHORIZED=0
echo "设置了 NODE_TLS_REJECT_UNAUTHORIZED=0（临时绕过证书检查）"
echo

bun clawhub whoami \
  --site http://127.0.0.1:3000 \
  --registry http://127.0.0.1:3000 2>&1 || echo "仍失败"
echo

echo "=== 诊断完成 ==="
