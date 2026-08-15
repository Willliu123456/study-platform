/* ============ 学升·Electron 桌面应用入口 ============
   启动内嵌 Node 后端（随机端口）→ 打开桌面窗口加载页面
*/
'use strict';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const { app, BrowserWindow, dialog, Menu } = require('electron');

// 针对 Windows 部分环境下 Electron 渲染进程崩溃（exitCode 3）的兼容性处理
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,HardwareMediaKeyHandling,msWebOO');
app.disableHardwareAcceleration();
const path = require('path');
const fs = require('fs');

let win = null;
let backend = null;
const LOG_FILE = path.join(app.getPath('userData'), 'app.log');

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) { /* ignore */ }
  console.log(line);
}

/* 单实例锁：重复打开时聚焦已有窗口，避免起多个后端 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

async function startBackend() {
  // 桌面版数据库存到系统用户数据目录（%APPDATA%/xuesheng），避免写入失败/更新丢数据
  process.env.XS_DATA_DIR = path.join(app.getPath('userData'), 'data');
  log('INFO', `数据目录: ${process.env.XS_DATA_DIR}`);
  const { start } = require('./server/server.js');
  backend = await start(0); // 随机空闲端口，避免与已运行的后端冲突
  log('INFO', `后端已启动: ${backend.url}`);
  return backend.url;
}

function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, 'assets', 'icon-512.png'),
    autoHideMenuBar: true,
    backgroundColor: '#4F46E5',
    title: '学升·智能刷题平台',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      offscreen: false
    }
  });
  win.loadURL(url);
  win.on('closed', () => { win = null; });

  // 按 Alt 显示菜单，可从中打开"开发者工具"
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: '视图',
      submenu: [
        { label: '重新加载页面', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomin' },
        { label: '缩小', role: 'zoomout' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
        { label: '退出', role: 'quit' }
      ]
    }
  ]));

  // F12 直接打开/关闭开发者工具
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  // 页面出现 JS 错误时记录日志并自动弹出开发者工具
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const label = level >= 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    log(label, `[页面] ${sourceId}:${line} ${message}`);
    if (level >= 3) {
      try {
        win.webContents.openDevTools({ mode: 'detach' });
      } catch (_) {}
    }
  });

  // 页面加载失败
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log('ERROR', `页面加载失败: ${errorCode} ${errorDescription}`);
    dialog.showErrorBox('页面加载失败', `${errorDescription}\n\n日志: ${LOG_FILE}`);
  });

  // 渲染进程崩溃或被杀掉
  win.webContents.on('render-process-gone', (event, details) => {
    log('ERROR', `渲染进程异常: ${JSON.stringify(details)}`);
    dialog.showErrorBox('页面异常', `渲染进程退出：${details.reason}\n\n日志: ${LOG_FILE}`);
  });
}

app.whenReady().then(async () => {
  try {
    const url = await startBackend();
    createWindow(url);
  } catch (e) {
    log('ERROR', `启动失败: ${String((e && e.stack) || e)}`);
    dialog.showErrorBox('学升启动失败', `${String((e && e.stack) || e)}\n\n日志: ${LOG_FILE}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('quit', () => {
  if (backend && backend.server) {
    try { backend.server.close(); } catch (_) { /* ignore */ }
  }
});
