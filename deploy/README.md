# 学升 · 云端部署指南

把桌面版"学升"变成**手机也能用的云端版**：部署一套后端到云服务器，电脑 / 安卓 App / 手机浏览器全部连这台服务器。

---

## 一、架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ 安卓 App     │───▶│              │    │  云服务器(你租的)   │
│ (Capacitor)  │    │  手机/电脑    │───▶│  Node 后端:8790    │
│ 手机浏览器    │    │  浏览器       │    │  + SQLite 数据库   │
└──────────────┘    └──────────────┘    │  + LibreOffice      │
                                        │   (自动转换 .doc)   │
                                        └──────────────────┘
```

- **安卓 App** = 现在的网页界面（HTML/JS）打包成 APK，通过 HTTPS 调云端接口
- **云端服务器** = 现在本地跑的 `server/server.js`，部署到 Linux 服务器
- **.doc 旧版题库**：Windows 本地用 Word/WPS 转换，Linux 服务器用 LibreOffice 转换（已内置）

---

## 二、需要准备

| 资源 | 说明 | 费用 |
|---|---|---|
| 云服务器 | Linux（Ubuntu/Debian 推荐），2C2G 起步，建议有公网 IP | 学生机约 ¥9.9/月起 |
| 域名（可选） | 有域名+HTTPS 体验最好；纯 IP 用 http 也可 | 首年约 ¥10 |
| 安装 Android Studio 的电脑 | 用于打 APK 的电脑（可用家里 Windows） | 免费 |

---

## 三、部署服务器（5 分钟）

把整个 `study-platform` 目录上传到服务器（例如 `/opt/xuesheng`），然后：

```bash
cd /opt/xuesheng
bash deploy/setup.sh
```

脚本会自动：
1. 安装 Node.js 22 + LibreOffice（`.doc` 转换必需）
2. 校验 Node 内置 SQLite
3. 注册 systemd 服务并启动
4. 放行 8790 端口

验证：

```bash
curl http://127.0.0.1:8790/api/health
# {"ok":true,"version":2,"features":["convert-doc"],...}
```

### 配置 HTTPS（强烈建议，安卓默认禁明文 http）

```bash
# 用 nginx 反代（deploy/nginx.conf 已写好，改域名后放入 sites-available）
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d xs.example.com
```

完成后云端地址填 `https://xs.example.com`。

> 没域名也可直接用 `http://服务器IP:8790`，但安卓调试包需允许明文流量（见第四节备注）。

---

## 四、连接客户端

### 1. 电脑（本机模式不受影响）
桌面版继续用 `启动学升.vbs`，默认本机模式，无需改动。

### 2. 电脑/手机浏览器连云端
- 打开 `https://你的域名`
- 登录后 → **我的 → 云端服务器** → 填入 `https://你的域名` → 保存并测试连接
- 连接成功后，账号、题库、刷题记录全部走云端

### 3. 安卓 App（APK）
- 按第五节打 APK 安装
- 打开 App → **我的 → 云端服务器** → 填入服务器地址

> 注：`云端服务器` 地址是"全局切换"：填了它，本机桌面版也会连云端。想回本机就清空该地址。

---

## 五、打包安卓 APK

前置：电脑装好 [Android Studio](https://developer.android.com/studio)（含 JDK 17+ 与 Android SDK）。

```bash
cd study-platform/android-app
node sync-www.mjs          # 把网页前端同步到 www/
npx cap sync android       # 同步资源到安卓工程
npx cap open android       # 用 Android Studio 打开
# Android Studio 里：Build → Build App Bundle(s)/APK(s) → Build APK(s)
# 产物在 android/app/build/outputs/apk/debug/ 或 release/
```

> 备注：若服务器没有 HTTPS（纯 IP http），在 Android Studio 中给 AndroidManifest.xml 的 `<application>` 加
> `android:usesCleartextTraffic="true"`（仅调试用）。

---

## 六、数据说明

- 数据库在服务器 `XS_DATA_DIR`（默认 `data/xuesheng.db`），定期备份该文件即可
- 本机数据不会自动上传到云端；在网页/App 登录**同一账号**后，云端是独立的一套数据
- 想迁移本机数据到云端：暂无一键迁移，可在两边分别用"我的题库"手动导入
