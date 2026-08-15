# 学升·Dockerfile（Render / Railway / Fly.io 通用）
# 用法：render.yaml 自动引用，或平台手动指定
FROM node:22-slim

# 安装 LibreOffice（.doc → .docx 转换需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package 文件，利用 Docker 缓存
COPY package*.json ./

# 安装生产依赖
RUN npm ci --omit=dev || npm install --omit=dev

# 复制项目代码
COPY . .

# 创建数据目录（SQLite 数据库存放）
RUN mkdir -p /app/data

# 暴露端口（Render 自动注入 PORT 环境变量）
ENV PORT=8790
ENV XS_DATA_DIR=/app/data
EXPOSE 8790

# 启动后端
CMD ["node", "server/server.js"]
