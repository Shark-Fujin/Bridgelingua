#!/bin/bash
set -e

echo "=== Bridgelingua 服务器部署脚本 ==="

# 1. 安装系统依赖
echo "[1/6] 安装系统依赖..."
apt-get update -qq
apt-get install -y -qq nginx python3-venv python3-pip > /dev/null

# 2. 创建项目目录
echo "[2/6] 创建项目目录..."
mkdir -p /opt/bridgelingua/frontend
mkdir -p /opt/bridgelingua/backend

# 3. 部署前端
echo "[3/6] 部署前端静态文件..."
rm -rf /opt/bridgelingua/frontend/*
cp -r /tmp/bridgelingua-deploy/frontend-dist/* /opt/bridgelingua/frontend/

# 4. 部署后端
echo "[4/6] 部署后端..."
rm -rf /opt/bridgelingua/backend/app
cp -r /tmp/bridgelingua-deploy/backend/app /opt/bridgelingua/backend/
cp /tmp/bridgelingua-deploy/backend/pyproject.toml /opt/bridgelingua/backend/

# 创建虚拟环境并安装依赖
if [ ! -d /opt/bridgelingua/backend/.venv ]; then
    python3 -m venv /opt/bridgelingua/backend/.venv
fi
/opt/bridgelingua/backend/.venv/bin/pip install -q --upgrade pip
/opt/bridgelingua/backend/.venv/bin/pip install -q -e /opt/bridgelingua/backend

# 创建存储目录
mkdir -p /opt/bridgelingua/backend/app/storage/uploads
mkdir -p /opt/bridgelingua/backend/app/storage/db

# 5. 配置 nginx
echo "[5/6] 配置 nginx..."
cp /tmp/bridgelingua-deploy/nginx.conf /etc/nginx/sites-available/bridgelingua
ln -sf /etc/nginx/sites-available/bridgelingua /etc/nginx/sites-enabled/bridgelingua
rm -f /etc/nginx/sites-enabled/default
nginx -t

# 6. 配置 systemd 服务
echo "[6/6] 配置后端服务..."
cp /tmp/bridgelingua-deploy/bridgelingua.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable bridgelingua
systemctl restart bridgelingua
systemctl reload nginx

echo ""
echo "=== 部署完成 ==="
echo "前端: http://47.242.239.187"
echo "API:  http://47.242.239.187/api/health"
echo ""
echo "查看后端日志: journalctl -u bridgelingua -f"
