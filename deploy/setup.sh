#!/usr/bin/env bash
# ============================================================
# 学升·服务器一键部署脚本（Ubuntu / Debian）
# 用法：
#   1) 把整个 study-platform 目录上传到服务器（如 /opt/xuesheng）
#   2) cd /opt/xuesheng && bash deploy/setup.sh
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "==> 部署目录: $APP_DIR"

echo "[1/5] 安装 Node.js 22 + LibreOffice（.doc 转换需要）..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get update -y
apt-get install -y libreoffice-writer || apt-get install -y libreoffice-core

echo "[2/5] 校验 Node 内置 SQLite（需 >= 22.5）..."
node -e "require('node:sqlite'); console.log('  内置 SQLite OK')"

echo "[3/5] 安装 systemd 服务 xuesheng..."
mkdir -p "$APP_DIR/data"
cat > /etc/systemd/system/xuesheng.service <<EOF
[Unit]
Description=Xuesheng Study Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=PORT=8790
Environment=XS_DATA_DIR=$APP_DIR/data
ExecStart=/usr/bin/node server/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable xuesheng
systemctl restart xuesheng
sleep 2
curl -s http://127.0.0.1:8790/api/health || { echo "  [错误] 后端启动失败，日志: journalctl -u xuesheng -e"; exit 1; }

echo "[4/5] 放行 8790 端口..."
ufw allow 8790/tcp 2>/dev/null || true

echo "[5/5] 完成！"
echo ""
echo "  本机验证:   curl http://127.0.0.1:8790/api/health"
echo "  外网访问:   http://服务器IP:8790"
echo "  建议:       配置 HTTPS（见 deploy/nginx.conf 与 deploy/README.md）"
echo "  测试 .doc:  在个人中心 -> 云端服务器 填入 http://服务器IP:8790 后，导入 .doc 文件"
