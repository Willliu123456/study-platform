# 学升 · 安卓 APK 构建手册

把桌面版"学升"打包成安卓 App。**App 界面就是现在的网页前端**，后端（题库/账号/.doc 转换）通过"云端服务器"地址访问——所以打包前建议先按 `deploy/README.md` 部署好服务器，装好 APK 后在里面填服务器地址即可。

---

## 一、需要准备

| 工具 | 用途 | 获取方式 |
|---|---|---|
| Node.js 18+ | 同步前端、运行 Capacitor CLI | 已有（本机 Node v22） |
| JDK 17+ | 编译安卓代码 | Android Studio 自带，或单独安装 |
| Android SDK（API 34） | 编译安卓工程 | Android Studio 自带 |
| Android Studio | 图形化构建/安装 APK（可选） | https://developer.android.com/studio |

> 本机（`20260814` 环境）尚未安装 JDK / Android SDK，首次构建前需先按下面二、三节安装。

---

## 二、安装环境（Windows）

### 方案 A：Android Studio（推荐，图形化）

1. 官网下载并安装 [Android Studio](https://developer.android.com/studio)（自带 JDK 与 Android SDK）。
2. 首次启动时按向导下载 SDK，确保 **Android SDK Platform 34** 已安装：
   - `Settings → Languages & Frameworks → Android SDK`，勾选 API 34，Apply。
3. 记下两个路径备用：
   - JDK：Android Studio 自带，一般在 `C:\Program Files\Android\Android Studio\jbr`
   - SDK：默认在 `C:\Users\你的用户名\AppData\Local\Android\Sdk`

### 方案 B：命令行（不装 Android Studio）

```powershell
# 1. 安装 JDK 17（任选一种）
#    winget install Microsoft.OpenJDK.17

# 2. 下载 Android 命令行工具并解压到 C:\android-sdk
#    https://developer.android.com/studio#command-line-tools-only

# 3. 安装 SDK 平台与构建工具
C:\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-34" "build-tools;34.0.0"

# 4. 设置环境变量
setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.x"
setx ANDROID_HOME "C:\android-sdk"
# 重新打开终端使其生效
```

---

## 三、构建 APK（两种方式都行）

在 `android-app/` 目录下：

```powershell
node sync-www.mjs      # 1. 把 server 静态目录的最新前端同步到 www/
npx cap sync android   # 2. 把 www 同步进安卓原生工程
```

然后任选：

### 方式一：Android Studio（图形化）
```powershell
npx cap open android
```
Android Studio 打开后：
- 菜单 `Build → Build App Bundle(s)/APK(s) → Build APK(s)`
- 等待底部 Gradle 构建完成，右下角弹窗点 `locate` 可定位 APK

### 方式二：命令行（更快）
```powershell
cd android
.\gradlew.bat assembleDebug    # 调试包（未签名，可直接安装测试）
.\gradlew.bat assembleRelease  # 发布包（未签名，需配置签名后使用）
```

---

## 四、APK 产物与安装

| 类型 | 路径 |
|---|---|
| Debug 包 | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release 包 | `android/app/build/outputs/apk/release/app-release-unsigned.apk` |

安装到手机：
- **有线**：手机开 USB 调试，连电脑后 Android Studio 直接点 Run；命令行则 `adb install app-debug.apk`
- **无线**：把 APK 发到手机（微信/网盘），手机上允许"安装未知来源应用"后安装

---

## 五、App 内配置云端地址

1. 安装后打开 App → 登录
2. 进入 **我的 → 云端服务器**
3. 填入服务器地址（如 `https://xs.example.com` 或 `http://服务器IP:8790`）→ 保存并测试连接
4. 提示"已连接"后，账号、题库、刷题记录全部走云端；清空地址则回到本机模式

> 若服务器只有 http（无 HTTPS），安卓默认禁明文流量，需要给调试包放行（见下）。

---

## 六、常见问题

**Q1：App 请求云端报"网络请求失败/无法连接"**
- 服务器地址要**可被手机访问**（公网 IP 或域名），`127.0.0.1` 指的是手机自身
- 检查服务器防火墙已放行 8790，或 nginx 已配置

**Q2：http 地址连不上（安卓默认禁明文）**
调试阶段可在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 标签上加：
```xml
android:usesCleartextTraffic="true"
```
然后重新 `npx cap sync android` 并构建。正式发布建议直接上 HTTPS，不推荐保留该开关。

**Q3：release 包提示"应用未安装/签名冲突"**
`assembleRelease` 产出的是未签名包，只能用于自己测试；正式分发需生成签名：
```powershell
keytool -genkey -v -keystore xuesheng.jks -alias xuesheng -keyalg RSA -keysize 2048 -validity 10000
# 然后在 android/app/build.gradle 的 release 中配置 signingConfigs，重新构建
```

**Q4：图标/名称想自定义**
- 应用名：改 `android/app/src/main/res/values/strings.xml` 的 `app_name`
- 图标：替换 `android/app/src/main/res/mipmap-*/ic_launcher*` 各分辨率图标后重新构建

---

## 七、更新 App 里的功能

改完前端代码（`study-platform/` 下的 html/js/css）后：

```powershell
cd android-app
node sync-www.mjs      # 同步最新前端
npx cap sync android   # 同步进原生工程
.\android\gradlew.bat assembleDebug   # 重新打包
```
