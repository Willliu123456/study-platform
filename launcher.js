/* ============================================================
   学升·桌面启动器
   作用：确保后端以最新代码运行 → 用 Edge 应用模式打开（无地址栏，像原生应用）
   双击 启动学升.vbs 即可

   关键逻辑：后端进程是 detached 的，关闭浏览器窗口不会退出。
   如果端口 8790 上残留的是旧版后端，用户重开应用会一直用旧逻辑。
   因此启动时先探测后端版本（/api/health 的 version 字段），
   低于要求版本时自动杀掉旧 node 后端并启动最新代码，避免“改了不生效”。
   ============================================================ */
'use strict';
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 8790;
const BACKEND = path.join(__dirname, 'server', 'server.js');
const MIN_VERSION = 3; // 后端 health.version >= 3 才认为包含 convert-doc + 对账后台（pay-admin）等新能力

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

function findBrowser() {
  const { existsSync } = require('fs');
  for (const p of EDGE_CANDIDATES) if (existsSync(p)) return p;
  return null;
}

/* 探测后端是否就绪，且为不低于 MIN_VERSION 的版本 */
function probeBackend(cb) {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 1500 }, (res) => {
    let body = '';
    res.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    res.on('end', () => {
      let ver = 0;
      try { ver = Number(JSON.parse(body).version) || 0; } catch (e) { /* ignore */ }
      cb(res.statusCode === 200 && ver >= MIN_VERSION);
    });
  });
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
}

/* 杀掉占用端口的旧 node 后端进程（仅当进程名是 node.exe，避免误伤其他程序） */
function killOldBackend() {
  let out = '';
  try {
    out = execSync('netstat -ano -p tcp | findstr ":' + PORT + '"', { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  } catch (e) { return; }
  const pids = new Set();
  for (const line of out.split('\n')) {
    const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }
  for (const pid of pids) {
    let name = '';
    try {
      name = execSync('tasklist /FI "PID eq ' + pid + '" /FO CSV /NH', { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    } catch (e) { /* ignore */ }
    if (/node/i.test(name || '')) {
      try { execSync('taskkill /F /PID ' + pid + ' /T', { windowsHide: true, timeout: 5000 }); } catch (e) { /* ignore */ }
    }
  }
}

function startBackend() {
  const server = spawn(process.execPath, [BACKEND], { detached: true, stdio: 'ignore', windowsHide: true });
  server.unref();
}

function waitBackend(cb) {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    probeBackend((ok) => {
      if (ok) {
        clearInterval(timer);
        cb(true);
      } else if (tries > 40) {
        clearInterval(timer);
        cb(false);
      }
    });
  }, 500);
}

function openApp(browser) {
  spawn(browser, ['--app=http://127.0.0.1:' + PORT, '--new-window'], { detached: true, stdio: 'ignore' }).unref();
  console.log('[启动器] 已在应用模式打开: http://127.0.0.1:' + PORT);
}

const browser = findBrowser();
if (!browser) {
  console.error('[启动器] 未找到 Edge/Chrome');
  process.exit(1);
}

probeBackend((ready) => {
  if (ready) {
    // 后端已是最新版本，直接打开页面
    openApp(browser);
    process.exit(0);
  }
  // 端口空闲，或残留旧版后端：清理后启动最新后端
  killOldBackend();
  startBackend();
  waitBackend((ok) => {
    if (!ok) {
      console.error('[启动器] 后端启动超时');
      process.exit(1);
    }
    openApp(browser);
    process.exit(0);
  });
});
