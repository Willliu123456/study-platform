# 学升·Dockerfile（HF Spaces / Render / Railway 通用）
# HF Spaces 要求：7860 端口 + 非 root 用户（UID 1000）+ /data 持久存储
FROM node:22-slim

# 安装 LibreOffice（.doc → .docx 转换需要；如不需要可注释掉以减小镜像）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package 文件，利用 Docker 缓存
COPY package*.json ./

# 安装生产依赖（package.json 里只有 devDependencies 是 electron 相关，
# --omit=dev 会跳过它们，得到纯净后端依赖；若后端无第三方依赖则 npm ci 是 no-op）
RUN npm ci --omit=dev || npm install --omit=dev

# 复制项目代码（.dockerignore 已排除 node_modules/release/android-app/data 等）
COPY . .

# HF Spaces 安全要求：必须以非 root 用户运行，UID 必须是 1000
# 同时授权 /data 持久目录（HF Spaces 启用 Persistent Storage 后会挂载到 /data）
RUN useradd -m -u 1000 appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data

# HF Spaces 默认端口 7860；SQLite 数据写到 /data 持久目录
ENV PORT=7860
ENV XS_DATA_DIR=/data
ENV NODE_ENV=production
EXPOSE 7860

# 切换非 root 用户（HF 强制要求）
USER appuser

# 启动后端
CMD ["node", "server/server.js"]
