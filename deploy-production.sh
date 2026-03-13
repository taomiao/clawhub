#!/bin/bash
# 阿里云 ECS 部署脚本

set -e

echo "=== ClawHub 生产环境部署 ==="

# 检查必要工具
command -v docker >/dev/null 2>&1 || { echo "❌ Docker 未安装"; exit 1; }
command -v certbot >/dev/null 2>&1 || { echo "⚠️  Certbot 未安装，无法自动配置 HTTPS"; }

# 读取配置
read -p "输入域名（例如 clawhub.example.com）: " DOMAIN
read -p "输入邮箱（用于 Let's Encrypt）: " EMAIL
read -sp "输入数据库密码: " DB_PASSWORD
echo

# 创建 .env 文件
cat > .env.production << EOF
POSTGRES_PASSWORD=${DB_PASSWORD}
API_BASE_URL=https://${DOMAIN}
EOF

echo "✅ 配置文件已创建"

# 修改 nginx.conf 中的域名
if [ -f "nginx.conf.example" ]; then
  sed "s/your-domain.com/${DOMAIN}/g" nginx.conf.example > nginx.conf
  echo "✅ Nginx 配置已生成"
fi

# 创建 SSL 证书目录
mkdir -p ssl

# 获取 Let's Encrypt 证书
if command -v certbot >/dev/null 2>&1; then
  echo "📜 正在获取 SSL 证书..."
  
  # 先启动一个临时 nginx 用于 certbot 验证
  docker run -d --name nginx-certbot -p 80:80 -p 443:443 \
    -v $(pwd)/ssl:/etc/letsencrypt \
    nginx:alpine
  
  sleep 2
  
  certbot certonly --webroot \
    -w /var/www/certbot \
    -d ${DOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --non-interactive || {
      echo "❌ SSL 证书获取失败"
      docker stop nginx-certbot && docker rm nginx-certbot
      exit 1
    }
  
  # 复制证书到正确位置
  cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ssl/
  cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ssl/
  
  docker stop nginx-certbot && docker rm nginx-certbot
  echo "✅ SSL 证书已配置"
else
  echo "⚠️  请手动配置 SSL 证书"
  echo "   1. 将证书文件复制到 ssl/fullchain.pem"
  echo "   2. 将私钥文件复制到 ssl/privkey.pem"
  read -p "按回车继续..."
fi

# 启动服务
echo "🚀 启动服务..."
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 生成管理员 token
echo "🔑 生成管理员 token..."
ADMIN_TOKEN=$(docker compose -f docker-compose.production.yml exec -T api bun selfhost/api/src/seed.ts | grep "clh_" || echo "")

if [ -n "$ADMIN_TOKEN" ]; then
  echo "✅ 部署完成！"
  echo ""
  echo "📝 重要信息："
  echo "   网站: https://${DOMAIN}"
  echo "   管理员 token: ${ADMIN_TOKEN}"
  echo ""
  echo "⚠️  请将 token 保存到安全的地方！"
  echo ""
  echo "🔄 后续操作："
  echo "   1. 登录 CLI: clawhub login --registry https://${DOMAIN} --site https://${DOMAIN} --token ${ADMIN_TOKEN}"
  echo "   2. 发布技能: clawhub publish ./my-skill --version 1.0.0 --changelog 'Initial release'"
  echo "   3. 查看日志: docker compose -f docker-compose.production.yml logs -f"
else
  echo "⚠️  部署完成，但未能自动生成管理员 token"
  echo "   请手动运行: docker compose -f docker-compose.production.yml exec api bun selfhost/api/src/seed.ts"
fi

# 设置防火墙规则提醒
echo ""
echo "🔐 安全提醒："
echo "   1. 确保防火墙只开放 80 和 443 端口"
echo "   2. 定期备份数据库（docker volume: clawhub_db）"
echo "   3. 定期更新 SSL 证书：certbot renew"
echo "   4. 定期检查日志：docker compose -f docker-compose.production.yml logs"
