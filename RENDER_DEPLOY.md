# 部署到 Render 免费层（0 元）

## 第 1 步：注册 GitHub（5 分钟）
1. 打开 https://github.com → Sign Up
2. 注册免费账号
3. 新建仓库 → 名字 `study-platform`
4. 把整个 `study-platform` 文件夹上传（网页拖拽即可）

## 第 2 步：注册 Render（2 分钟）
1. 打开 https://render.com → Sign Up
2. 用 GitHub 账号登录

## 第 3 步：部署（3 分钟）
1. Dashboard → **New +** → **Blueprint**
2. 选择你刚传的 GitHub 仓库
3. Render 自动读取 `render.yaml` → 点 **Apply**
4. 等 3-5 分钟构建完成

## 第 4 步：拿到公网地址
部署完成后 Render 给你一个地址：
```
https://xuesheng.onrender.com
```

## 第 5 步：域名解析
1. 腾讯云域名管理 → `willbe.wang` → 解析
2. 添加 CNAME 记录：
   - `@` → CNAME → `xuesheng.onrender.com`
   - `www` → CNAME → `xuesheng.onrender.com`
3. 等 5 分钟生效
4. 手机访问 `https://willbe.wang` 即可

## 管理员口令
首次启动在 Render 日志里看：
1. Render Dashboard → 你的服务 → **Logs**
2. 找 `[学升后端] 管理员口令: xs1234abcd`
3. 登录 `https://willbe.wang/admin.html`

## 免费层限制
| 限制 | 说明 |
|------|------|
| 512MB 内存 | 够用（Node 150MB + LibreOffice 400MB 勉强） |
| 750 小时/月 | 单服务跑满一个月够用 |
| 15 分钟无访问休眠 | 下次访问 30 秒自动唤醒 |
| 1GB 持久磁盘 | SQLite 数据库存放够用 |

## 注意
- LibreOffice 转换大文件可能 OOM（512MB 内存），建议免费层关闭 .doc 转换
- 休眠不影响数据（持久磁盘保留）
- 想要不休眠 + 更多内存，升级到付费层（7 美元/月 ≈ 50 元/月）
