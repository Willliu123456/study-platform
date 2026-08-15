---
title: 学升智能刷题平台
emoji: 📚
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# 学升·智能刷题平台

考研 · 考公 · 期末刷题学习平台

## 部署说明

- **运行环境**：Hugging Face Spaces（Docker 模式，免费 16GB RAM / 2 vCPU）
- **端口**：7860（HF Spaces 默认）
- **数据库**：SQLite，持久存储挂载到 `/data`
- **管理员口令**：首次启动自动生成，从 Space **Logs** 面板查看

## 环境变量（在 Space Settings → Repository secrets 配置）

| 变量 | 必填 | 说明 |
|------|------|------|
| `XS_ADMIN_PASSWORD` | 否 | 预设管理员口令；不设则首次启动随机生成 |
| `WX_APPID` | 否 | 微信支付 AppID |
| `WX_SECRET` | 否 | 微信支付 AppSecret |
| `WX_MCHID` | 否 | 微信支付商户号 |
| `WX_KEY` | 否 | 微信支付 API V3 密钥 |

## 启用持久存储（必做！）

否则每次重启 SQLite 数据库会丢失，用户数据全没：

**Space Settings → Persistent storage → 选 20GB（免费）**

## 访问

部署后访问地址：
```
https://<你的HF用户名>-<Space名称>.hf.space
```

例如 `https://willliu-study-platform.hf.space`

## 管理员后台

部署后访问 `/admin.html`，输入首次启动日志里的口令登录。
