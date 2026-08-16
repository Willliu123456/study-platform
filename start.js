#!/usr/bin/env node
/* ============ 学升·统一启动入口 ============
   根据"运行环境"自动选择启动方式：
   - 云平台（Glitch / Render / HF Spaces / Zeabur 等）→ Node 后端
   - 本地桌面开发 → Electron 桌面应用
   判定依据：各云平台会自动注入特定环境变量；本地开发则没有这些变量。
*/
'use strict';
const { spawn } = require('child_process');

/* 已知云平台会注入的环境变量（任一存在即判定为服务器模式） */
const SERVER_ENV_VARS = [
  'GLITCH_PROJECT_DOMAINS',   // Glitch
  'GLITCH_TOKEN',
  'RENDER',                    // Render
  'RENDER_SERVICE_ID',
  'SPACE_AUTHOR_NAME',         // Hugging Face Spaces
  'SPACE_ID',
  'ZEABUR_PROJECT_ID',         // Zeabur
  'RAILWAY_PROJECT_ID',        // Railway
  'FLY_REGION',                // Fly.io
  'KOYEB_SERVICE_ID',          // Koyeb
  'XS_SERVER_MODE'             // 手动强制指定（值任意即可）
];

const isServerMode = SERVER_ENV_VARS.some(k => process.env[k]);

if (isServerMode) {
  /* 服务器模式：直接启动 Node 后端（不带 Electron） */
  console.log('[学升] 服务器模式启动 → node server/server.js');
  const args = process.argv.slice(2);
  const proc = spawn('node', ['server/server.js', ...args], {
    stdio: 'inherit',
    env: process.env
  });
  proc.on('exit', (code) => process.exit(code || 0));
  proc.on('error', (err) => {
    console.error('[学升] 启动失败：', err.message);
    process.exit(1);
  });
} else {
  /* 桌面模式：启动 Electron 应用 */
  console.log('[学升] 桌面模式启动 → electron .');
  const proc = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'  // Windows 下 npx 需要 shell
  });
  proc.on('exit', (code) => process.exit(code || 0));
  proc.on('error', (err) => {
    console.error('[学升] Electron 启动失败：', err.message);
    console.error('如果是云平台部署，请设置环境变量 XS_SERVER_MODE=1 强制服务器模式');
    process.exit(1);
  });
}
