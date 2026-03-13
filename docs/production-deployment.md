# 生产环境部署指南

本文档介绍如何将 ClawHub 安全地部署到阿里云 ECS 或其他公网服务器。

## ⚠️ 安全警告

**直接运行开发配置（`docker-compose.selfhost.yml`）到公网是不安全的！**

必须做的安全措施：
- ✅ HTTPS（防止中间人攻击）
- ✅ 限制 CORS 来源
- ✅ 不暴露数据库端口
- ✅ 使用强密码
- ✅ Rate limiting（防止滥用）
- ✅ 配置防火墙

## 快速部署（推荐）

### 1. 准备工作

**服务器要求**：
- 2 CPU / 4GB RAM（最低）
- 20GB 磁盘空间
- Ubuntu 20.04+ / Debian 11+
- 已安装 Docker 和 Docker Compose

**域名准备**：
- 注册域名（例如 `clawhub.example.com`）
- 配置 DNS A 记录指向服务器公网 IP

### 2. 安装 Docker（如果未安装）

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# 将当前用户添加到 docker 组（可选）
sudo usermod -aG docker $USER
# 重新登录后生效
```

### 3. 克隆代码

```bash
git clone https://github.com/openclaw/clawhub.git
cd clawhub
```

### 4. 运行部署脚本

```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

脚本会自动：
- 配置域名
- 获取 Let's Encrypt SSL 证书
- 生成强密码
- 启动所有服务
- 生成管理员 token

### 5. 配置防火墙

**阿里云安全组规则**：
```
入方向规则：
- 80/TCP   (HTTP, 用于 Let's Encrypt 验证和重定向)
- 443/TCP  (HTTPS)
- 22/TCP   (SSH, 仅允许你的 IP)

出方向规则：
- 全部允许（或根据需求限制）
```

**UFW 防火墙**（Ubuntu）：
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 6. 验证部署

```bash
# 检查服务状态
docker compose -f docker-compose.production.yml ps

# 查看日志
docker compose -f docker-compose.production.yml logs -f

# 测试 API
curl https://your-domain.com/.well-known/clawhub.json
```

## 手动部署步骤

如果不使用自动脚本，可以按以下步骤手动部署：

### 1. 配置环境变量

```bash
# 创建 .env.production 文件
cat > .env.production << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
API_BASE_URL=https://your-domain.com
EOF
```

### 2. 配置 Nginx

```bash
# 复制并修改 nginx 配置
cp nginx.conf.example nginx.conf
# 编辑 nginx.conf，将 your-domain.com 替换为实际域名
sed -i 's/your-domain.com/clawhub.example.com/g' nginx.conf
```

### 3. 获取 SSL 证书

**方案 A：Let's Encrypt（免费，推荐）**

```bash
# 安装 certbot
sudo apt install -y certbot

# 获取证书
sudo certbot certonly --standalone \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# 复制证书到项目目录
mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
sudo chown -R $USER:$USER ssl/
```

**方案 B：自签名证书（仅测试用）**

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=your-domain.com"
```

### 4. 启动服务

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

### 5. 生成管理员 token

```bash
docker compose -f docker-compose.production.yml exec api bun selfhost/api/src/seed.ts
```

保存输出的 token（`clh_...`）。

## 后续管理

### 更新代码

```bash
git pull
docker compose -f docker-compose.production.yml up -d --build
```

### 备份数据

```bash
# 备份数据库
docker compose -f docker-compose.production.yml exec -T db \
  pg_dump -U clawhub clawhub > backup_$(date +%Y%m%d).sql

# 备份文件存储
docker run --rm -v clawhub_storage:/data -v $(pwd):/backup \
  alpine tar czf /backup/storage_$(date +%Y%m%d).tar.gz -C /data .
```

### 恢复数据

```bash
# 恢复数据库
docker compose -f docker-compose.production.yml exec -T db \
  psql -U clawhub clawhub < backup_20260312.sql

# 恢复文件存储
docker run --rm -v clawhub_storage:/data -v $(pwd):/backup \
  alpine tar xzf /backup/storage_20260312.tar.gz -C /data
```

### SSL 证书续期

Let's Encrypt 证书 90 天过期，需要定期续期：

```bash
# 手动续期
sudo certbot renew
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
docker compose -f docker-compose.production.yml restart nginx

# 自动续期（cron）
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/clawhub/ssl/ && docker compose -f /path/to/clawhub/docker-compose.production.yml restart nginx") | crontab -
```

### 监控和日志

```bash
# 查看实时日志
docker compose -f docker-compose.production.yml logs -f

# 查看特定服务日志
docker compose -f docker-compose.production.yml logs -f api

# 查看资源使用
docker stats
```

### 性能优化

**数据库连接池**：
编辑 `selfhost/api/src/db.ts`，增加连接池配置：
```typescript
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,  // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

**Nginx 缓存**：
在 `nginx.conf` 添加：
```nginx
proxy_cache_path /tmp/nginx_cache levels=1:2 keys_zone=api_cache:10m max_size=100m;

location /api/v1/skills {
  proxy_cache api_cache;
  proxy_cache_valid 200 5m;
  proxy_cache_key "$request_uri";
}
```

## 安全最佳实践

### 1. 使用强密码
```bash
# 生成随机密码
openssl rand -base64 32
```

### 2. 限制 SSH 访问
```bash
# 仅允许密钥登录，禁止密码登录
sudo vim /etc/ssh/sshd_config
# 设置: PasswordAuthentication no
sudo systemctl restart sshd
```

### 3. 定期更新系统
```bash
sudo apt update && sudo apt upgrade -y
```

### 4. 配置日志轮转
创建 `/etc/logrotate.d/clawhub`：
```
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  delaycompress
  missingok
  notifempty
}
```

### 5. 设置告警
使用 UptimeRobot 或类似服务监控服务可用性。

## 故障排查

### 服务无法启动
```bash
# 查看详细错误
docker compose -f docker-compose.production.yml logs

# 检查端口占用
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

### 数据库连接失败
```bash
# 检查数据库状态
docker compose -f docker-compose.production.yml exec db pg_isready -U clawhub

# 查看数据库日志
docker compose -f docker-compose.production.yml logs db
```

### SSL 证书问题
```bash
# 检查证书文件
ls -la ssl/

# 测试 HTTPS
curl -v https://your-domain.com
```

### 磁盘空间不足
```bash
# 查看磁盘使用
df -h

# 清理 Docker 缓存
docker system prune -a

# 清理旧的备份文件
rm -f backup_*.sql storage_*.tar.gz
```

## 进一步优化（可选）

### 使用 CDN
将静态资源（前端 JS/CSS）托管到阿里云 OSS + CDN，减轻服务器压力。

### 数据库优化
- 升级到 RDS（托管数据库）
- 配置读写分离
- 启用连接池

### 高可用部署
- 使用负载均衡（SLB）
- 多台 ECS 实例
- 使用 OSS 替代本地存储

## 成本估算

**基础配置（单台 ECS）**：
- ECS（2C4G）：约 ¥100-200/月
- 数据盘（100GB）：约 ¥15/月
- 流量（1TB）：约 ¥100/月
- 域名：约 ¥50-100/年

**总计**：约 ¥215-315/月

## 技术支持

遇到问题？
- GitHub Issues: https://github.com/openclaw/clawhub/issues
- Discord: https://discord.gg/clawd
