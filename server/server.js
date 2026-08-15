/* ============ 学升·真实后端服务（零依赖 Node + SQLite） ============ */
/* 用法: node server/server.js [port]   默认 8790
   提供 REST API + 静态文件托管（study-platform 目录）
*/
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const DB = require('./db.js');
const WX = require('./wxpay.js');
const { DB_FILE } = DB;

const ROOT = path.join(__dirname, '..');

/* ============ 管理员口令初始化 ============
   口令以加盐哈希存 SQLite config 表，绝不明文硬编码。
   首次启动自动生成随机口令（可用环境变量 XS_ADMIN_PASSWORD 预设）。
   安全：口令仅在控制台打印一次，不落盘明文文件。 */
if (!DB.getAdminPassword()) {
  const preset = process.env.XS_ADMIN_PASSWORD;
  const pw = preset || ('xs' + crypto.randomBytes(4).toString('hex'));
  DB.setAdminPassword(pw);
  /* 安全修复：不再把明文口令写入 admin.config.json */
  console.log('====================================================');
  console.log('[学升] 管理员初始口令（登录后台 admin.html 使用）: ' + pw);
  console.log('[学升] 请立即抄下并妥善保存，登录后台后尽快修改');
  console.log('====================================================');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.mp3': 'audio/mpeg'
};

const MATERIALS_DIR = path.join(ROOT, 'assets', 'materials');
const MATERIALS_MANIFEST = path.join(MATERIALS_DIR, 'manifest.json');
/* 读取资料中心 manifest（每次读文件，导入脚本重跑后无需重启） */
let materialManifestCache = null;
function loadMaterialManifest() {
  try {
    const st = fs.statSync(MATERIALS_MANIFEST);
    if (!materialManifestCache || materialManifestCache.mtimeMs !== st.mtimeMs) {
      materialManifestCache = {
        mtimeMs: st.mtimeMs,
        data: JSON.parse(fs.readFileSync(MATERIALS_MANIFEST, 'utf8'))
      };
    }
    return materialManifestCache.data;
  } catch (e) {
    return { version: 0, categories: [], items: [], generatedAt: 0, generatedAtText: '' };
  }
}
function findMaterialItem(itemId) {
  const m = loadMaterialManifest();
  return (m.items || []).find(it => it.id === itemId) || null;
}

/* ============ CORS 白名单 + 安全响应头 ============
   安全修复：不再使用 Access-Control-Allow-Origin: *。
   默认仅允许本机来源；可通过环境变量 XS_ALLOWED_ORIGINS 追加（逗号分隔）。 */
const ALLOWED_ORIGINS = ['http://localhost', 'http://127.0.0.1']
  .concat(String(process.env.XS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
function corsOrigin(req) {
  const o = req.headers.origin;
  if (!o) return null;
  return ALLOWED_ORIGINS.includes(o) ? o : null;
}
function sendJson(res, code, data) {
  /* Node.js ServerResponse 自动绑定 res.req，无需调用方额外传递 */
  const req = res.req;
  const body = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    /* 安全响应头 */
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    /* 补充低危安全头：CSP / HSTS / XSS 保护 */
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-XSS-Protection': '1; mode=block'
  };
  const origin = req ? corsOrigin(req) : null;
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Token, X-User-Token';
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
    headers['Vary'] = 'Origin';
  }
  res.writeHead(code, headers);
  res.end(body);
}
/* 安全修复：请求体读取器。超大请求体必须被安全拒绝，
   绝不能因 reject/destroy 顺序问题产生未处理异常导致进程崩溃（DoS）。 */
function makeBodyReader(raw) {
  return function readBody(req, maxSize) {
    return new Promise((resolve, reject) => {
      let d = '';
      let settled = false;
      const MAX = maxSize || 5e6;
      const fail = (e) => {
        if (settled) return;
        settled = true;
        try { req.removeAllListeners('data'); req.removeAllListeners('end'); } catch (err) { /* ignore */ }
        reject(e);
      };
      req.on('data', c => {
        if (settled) return;
        d += c;
        if (d.length > MAX) {
          /* 先标记再 destroy，避免 error 事件二次 reject */
          fail(new Error('body too large'));
          try { req.destroy(); } catch (err) { /* ignore */ }
        }
      });
      req.on('end', () => {
        if (settled) return;
        settled = true;
        try {
          if (raw) return resolve(d);
          const parsed = d ? JSON.parse(d) : {};
          /* 安全修复：JSON 顶层必须是普通对象；数组/字符串/数字/null 一律拒绝，
             防止 SQLite 参数绑定失败导致 500（统一返回 400） */
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            const err = new Error('invalid-body-type');
            err.isBadRequest = true;
            return reject(err);
          }
          resolve(parsed);
        }
        catch (e) {
          /* 安全修复：畸形 JSON 属于客户端错误，标记后由上层返回 400 而非 500 */
          if (e && e.isBadRequest) return reject(e);
          const err = new Error('invalid-json: ' + e.message);
          err.isBadRequest = true;
          reject(err);
        }
      });
      req.on('error', (e) => fail(e));
    });
  };
}
const readBody = makeBodyReader(false);
const readRawBody = makeBodyReader(true);

/* ============ 旧版 .doc → .docx 转换（Windows 下调用 Word/WPS COM） ============ */
const PS_CONVERT_SCRIPT = [
  'param([string]$inPath, [string]$outPath)',
  '$ErrorActionPreference = "Stop"',
  '$candidates = @("Word.Application", "KWPS.Application", "WPS.Application", "kwps.Application", "wps.Application")',
  '$word = $null',
  'foreach ($p in $candidates) {',
  '  try { $word = New-Object -ComObject $p; break } catch { $word = $null }',
  '}',
  'if ($null -eq $word) { Write-Output "NO_OFFICE"; exit 10 }',
  'try { $word.Visible = $false } catch {}',
  'try { $word.DisplayAlerts = 0 } catch {}',
  'try {',
  '  $doc = $word.Documents.Open($inPath, $false, $true)',
  '  try { $doc.SaveAs2($outPath, 12) } catch { $doc.SaveAs($outPath, 12) }',
  '  $doc.Close($false)',
  '  $word.Quit()',
  '  Write-Output "OK"',
  '  exit 0',
  '} catch {',
  '  Write-Output ("ERR:" + $_.Exception.Message)',
  '  try { $word.Quit() } catch {}',
  '  exit 1',
  '}'
].join('\n');

/* Linux/macOS 服务器：用 LibreOffice 无头模式转换 .doc → .docx */
function convertDocWithLibreOffice(inPath, outPath) {
  return new Promise((resolve) => {
    const soffice = process.env.SOFFICE || 'soffice';
    const dir = path.dirname(inPath);
    const profile = path.join(dir, 'lo_profile');
    execFile(soffice, [
      '-env:UserInstallation=file://' + profile,
      '--headless', '--norestore', '--convert-to', 'docx', '--outdir', dir, inPath
    ], { timeout: 120000, maxBuffer: 2e6 }, (err) => {
      /* LibreOffice 输出与输入同名的 .docx：input.doc → input.docx */
      const candidate = inPath.replace(/\.doc$/i, '.docx');
      let size = 0;
      try { size = fs.statSync(candidate).size; } catch (e) { /* ignore */ }
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
      if (!err && size > 0) {
        try { fs.copyFileSync(candidate, outPath); } catch (e) { /* ignore */ }
        return resolve({ ok: true });
      }
      const detail = err && String(err.message || '').split('\n')[0];
      return resolve({ ok: false, msg: '服务器转换失败' + (detail ? '（' + detail + '）' : '') + '。请安装 LibreOffice：sudo apt install libreoffice-writer，或手动另存为 .docx 后导入。' });
    });
  });
}

function convertDocWithOffice(inPath, outPath) {
  if (process.platform !== 'win32') return convertDocWithLibreOffice(inPath, outPath);
  return new Promise((resolve) => {
    const scriptPath = path.join(path.dirname(inPath), 'convert.ps1');
    /* 加 UTF-8 BOM，保证 PowerShell 5.1 按 UTF-8 读取脚本 */
    fs.writeFileSync(scriptPath, '\ufeff' + PS_CONVERT_SCRIPT, 'utf8');
    const ps = process.env.WINDIR
      ? path.join(process.env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe';
    execFile(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-inPath', inPath, '-outPath', outPath], {
      timeout: 90000, windowsHide: true, maxBuffer: 2e6
    }, (err, stdout) => {
      const out = String(stdout || '');
      if (!err) {
        let size = 0;
        try { size = fs.statSync(outPath).size; } catch (e) { /* ignore */ }
        if (size > 0) return resolve({ ok: true });
        return resolve({ ok: false, msg: '转换进程已结束但未生成 .docx 文件，请用 Word/WPS 手动另存为 .docx 后导入。' });
      }
      if (err.code === 10) return resolve({ ok: false, msg: '未检测到 Word / WPS，无法自动转换 .doc，请安装 Office 或将文件另存为 .docx 后导入。' });
      if (err.code === 1) {
        const detail = (out.indexOf('ERR:') >= 0 ? out.split('ERR:')[1] : '').trim().replace(/\s+/g, ' ').slice(0, 200);
        return resolve({ ok: false, msg: '转换失败：' + (detail || '文件可能已损坏') + '。请用 Word/WPS 手动另存为 .docx 后导入。' });
      }
      if (err.killed) return resolve({ ok: false, msg: '转换超时（Word/WPS 可能弹出了对话框），请用 Word/WPS 手动另存为 .docx 后导入。' });
      return resolve({ ok: false, msg: '转换进程异常：' + (err.message || err) + '，请用 Word/WPS 手动另存为 .docx 后导入。' });
    });
  });
}

async function handleConvertDoc(req, res, username) {
  /* 安全修复（第四轮）：
     1) 接口必须登录（route 层已校验 token）；
     2) 免费用户单文件 ≤ 2MB，VIP ≤ 15MB（防止 VIP 权益被绕过 + 匿名 DoS）； */
  const u = DB.getUser(username);
  const isVip = !!(u && u.vip && u.vip.level !== 'free' && u.vip.expireAt > Date.now());
  const MAX_DOC = isVip ? 15 * 1024 * 1024 : 2 * 1024 * 1024;
  let b;
  try {
    b = await readBody(req, 22e6);
  } catch (e) {
    /* readBody 超限/畸形时安全拒绝，避免进程崩溃 */
    const code = (e && e.isBadRequest) ? 400 : 413;
    return sendJson(res, code, { ok: false, msg: code === 400 ? '请求体格式错误' : '文档过大或请求体格式错误' });
  }
  if (!b || !b.base64) return sendJson(res, 400, { ok: false, msg: '缺少文件内容' });
  const buf = Buffer.from(String(b.base64), 'base64');
  if (!buf.length) return sendJson(res, 400, { ok: false, msg: '文件内容为空' });
  if (buf.length > MAX_DOC) {
    return sendJson(res, 400, { ok: false, msg: isVip ? '文档超过 15MB 上限，请压缩后重试' : '免费版单文件最大 2MB，开通 VIP 可导入大文件' });
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xs-doc-'));
  const inPath = path.join(dir, 'input.doc');
  const outPath = path.join(dir, 'output.docx');
  try {
    fs.writeFileSync(inPath, buf);
    const r = await convertDocWithOffice(inPath, outPath);
    if (!r.ok) return sendJson(res, 200, { ok: false, msg: r.msg });
    const outBuf = fs.readFileSync(outPath);
    return sendJson(res, 200, { ok: true, base64: outBuf.toString('base64'), size: outBuf.length });
  } catch (e) {
    /* 安全修复：不向客户端泄露内部转换错误细节（文件路径/系统信息） */
    console.error('[convert-doc] 转换异常:', e.message);
    return sendJson(res, 500, { ok: false, msg: '转换接口异常，请稍后重试' });
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

/* 管理员登录失败锁定（内存态，进程重启自动清零） */
const adminLoginFails = new Map(); // ip -> { count, lockUntil }
const FAIL_LIMIT = 5, LOCK_MS = 15 * 60 * 1000;

/* ============ 通用 IP 速率限制（中危修复） ============
   防暴力破解 / 资源滥用。内存滑动窗口，每分钟清理一次过期条目。 */
const rateBuckets = new Map(); // ip -> { count, resetAt }
const RATE_WINDOW_MS = 60 * 1000;
function clientIp(req) {
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}
function rateLimit(req, max, windowMs, key) {
  const ip = clientIp(req);
  const now = Date.now();
  const win = windowMs || RATE_WINDOW_MS;
  const k = key ? ip + '|' + key : ip;
  let b = rateBuckets.get(k);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + win };
    rateBuckets.set(k, b);
  }
  b.count++;
  if (rateBuckets.size > 10000) { /* 防内存膨胀 */
    for (const [k2, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k2);
  }
  return b.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
}, RATE_WINDOW_MS).unref();

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // e.g. api, register
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  /* 安全修复：拒绝 TRACE/CONNECT 等危险 HTTP 方法，仅允许 REST 方法 */
  const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']);
  if (!ALLOWED_METHODS.has(req.method)) {
    return sendJson(res, 405, { ok: false, msg: 'Method Not Allowed' });
  }
  /* 速率限制：普通接口 120 次/分钟；登录/注册类 15 次/分钟 */
  const sensitive = ['login', 'register', 'redeem'];
  const isSensitive = sensitive.includes(parts[1]) || (parts[1] === 'admin' && parts[2] === 'login');
  if (!rateLimit(req, isSensitive ? 15 : 120)) {
    return sendJson(res, 429, { ok: false, msg: '请求过于频繁，请稍后再试' });
  }
  try {
    /* 微信支付回调：验签需要原始报文，独立处理 */
    if (parts[1] === 'wxpay' && parts[2] === 'notify' && req.method === 'POST') {
      return await handleWxpayNotify(req, res);
    }
    if (parts[1] === 'register' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b || typeof b !== 'object' || Array.isArray(b)) return sendJson(res, 400, { ok: false, msg: '请求体格式错误' });
      /* 输入长度与格式校验（低危修复：防超长输入滥用存储；先校验再查库避免参数绑定异常） */
      const uname = String(b.username || '').trim();
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(uname)) return sendJson(res, 400, { ok: false, msg: '用户名需为 3-32 位字母、数字或下划线' });
      if (b.nickname && String(b.nickname).length > 32) return sendJson(res, 400, { ok: false, msg: '昵称最长 32 个字符' });
      b.username = uname;
      const existing = DB.getUser(b.username);
      if (existing) return sendJson(res, 400, { ok: false, msg: '该账号已注册，请直接登录' });
      const pwCheck = DB.checkPasswordStrength(b.password);
      if (!pwCheck.ok) return sendJson(res, 400, { ok: false, msg: pwCheck.msg });
      /* 安全：注册一律为普通用户，禁止通过接口自封管理员；密码加盐哈希存储 */
      const u = DB.upsertUser({
        username: b.username, password: DB.hashPw(b.password), nickname: b.nickname || b.username,
        role: 'student', createdAt: Date.now(),
        vip: { level: 'free', expireAt: 0 }, dailyQuota: { date: '', used: 0 }, coins: 0
      });
      const token = DB.createUserSession(b.username);
      DB.addLog('user_register', b.username);
      return sendJson(res, 200, { ok: true, data: { token, username: u.username, nickname: u.nickname, role: u.role } });
    }
    if (parts[1] === 'login' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b || typeof b !== 'object' || Array.isArray(b)) return sendJson(res, 400, { ok: false, msg: '请求体格式错误' });
      const unameL = String(b.username || '').trim();
      if (!unameL) return sendJson(res, 400, { ok: false, msg: '请输入账号' });
      b.username = unameL;
      const u = DB.getUser(b.username);
      if (!u || !DB.verifyPw(b.password || '', u.password)) return sendJson(res, 400, { ok: false, msg: '账号或密码错误' });
      /* 封禁账号拒绝登录 */
      const lf = DB.getFlags(b.username);
      if (lf.disabled) return sendJson(res, 403, { ok: false, msg: '账号已被封禁，请联系管理员' });
      /* 旧 s1(SHA256) 哈希自动升级为 s2(PBKDF2)，更安全 */
      if (String(u.password).startsWith('s1:')) DB.upgradePassword(b.username, b.password);
      const token = DB.createUserSession(b.username);
      DB.touchUserSeen(b.username); /* 登录即标记在线 */
      return sendJson(res, 200, { ok: true, data: { token, ...DB.getUserPublic(b.username) } });
    }
    /* 用户数据接口：一律要求登录 token 且只能操作自己的数据 */
    if (parts[1] === 'user' && parts[2] && req.method === 'PUT') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      const cur = DB.getUser(parts[2]);
      if (!cur) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
      const u = b.user || {};
      /* 安全：password / role / vip / coins / createdAt 一律以服务端为准，客户端不可篡改 */
      const updated = DB.upsertUser({
        username: cur.username, password: cur.password,
        nickname: (u.nickname && String(u.nickname).trim()) || cur.nickname,
        role: cur.role,
        vip: cur.vip,
        dailyQuota: cur.dailyQuota,
        coins: cur.coins,
        createdAt: cur.createdAt
      });
      return sendJson(res, 200, { ok: true, data: DB.getUserPublic(updated.username) });
    }
    if (parts[1] === 'user' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      const u = DB.getUserPublic(parts[2]);
      if (!u) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
      return sendJson(res, 200, { ok: true, data: u });
    }
    if (parts[1] === 'record' && parts[2] && req.method === 'PUT') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      /* 安全修复：仅接受单次合理增量（兼容离线同步），拒绝客户端一次刷入巨量记录 */
      const cur = DB.getRecord(parts[2]) || { total: 0, correct: 0, wrong: 0 };
      const inc = b.record || {};
      const incTotal = Math.max(0, Math.floor(Number(inc.total) || 0));
      const curTotal = Math.max(0, Math.floor(Number(cur.total) || 0));
      if (incTotal - curTotal > 500) return sendJson(res, 400, { ok: false, msg: '单次同步的刷题记录异常，已拒绝（上限 500 条）' });
      const merged = DB.mergeRecord(cur, b.record || {});
      const r = DB.upsertRecord(parts[2], merged);
      return sendJson(res, 200, { ok: true, data: r });
    }
    if (parts[1] === 'record' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      const r = DB.getRecord(parts[2]);
      return sendJson(res, 200, { ok: true, data: r || { total: 0, correct: 0, wrong: 0, byDay: {}, byBank: {}, wrongSet: {} } });
    }
    if (parts[1] === 'streak' && parts[2] && req.method === 'PUT') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      /* 安全修复：连续打卡天数上限校验（10 年 = 3650 天），防客户端刷量 */
      const incCount = Math.max(0, Math.floor(Number((b.streak || {}).count) || 0));
      if (incCount > 3650) return sendJson(res, 400, { ok: false, msg: '连续打卡天数异常，已拒绝' });
      const s = DB.mergeStreak(parts[2], b.streak || {});
      return sendJson(res, 200, { ok: true, data: s });
    }
    if (parts[1] === 'streak' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      return sendJson(res, 200, { ok: true, data: DB.getStreak(parts[2]) });
    }
    if (parts[1] === 'order' && parts[2] && req.method === 'POST') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      const order = DB.addOrder({ user: parts[2], ...(b.order || {}) });
      return sendJson(res, 200, { ok: true, data: order });
    }
    if (parts[1] === 'orders' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      return sendJson(res, 200, { ok: true, data: DB.getOrders(parts[2]) });
    }
    /* 兑换码：用户凭码开通会员（需登录本人） */
    if (parts[1] === 'redeem' && req.method === 'POST') {
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const r = DB.redeemCode(b.code, username);
      if (!r.ok) return sendJson(res, 400, { ok: false, msg: r.msg });
      return sendJson(res, 200, { ok: true, data: r.data, msg: '兑换成功' });
    }
    /* 客服工单：用户提交 / 查询自己的工单（需登录本人） */
    if (parts[1] === 'contact' && parts[2] && req.method === 'POST') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      if (!String(b.content || '').trim()) return sendJson(res, 400, { ok: false, msg: '请填写问题描述' });
      if (String(b.content).trim().length < 5) return sendJson(res, 400, { ok: false, msg: '问题描述至少 5 个字' });
      if (String(b.content).length > 2000) return sendJson(res, 400, { ok: false, msg: '问题描述最长 2000 字' });
      if (b.subject && String(b.subject).length > 100) return sendJson(res, 400, { ok: false, msg: '主题最长 100 字' });
      const t = DB.createTicket({ user: parts[2], subject: b.subject, content: b.content });
      DB.addLog('ticket_create', '#' + t.id + ' ' + parts[2] + ' ' + t.subject);
      return sendJson(res, 200, { ok: true, data: t, msg: '工单已提交，客服会尽快处理' });
    }
    if (parts[1] === 'contact' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      return sendJson(res, 200, { ok: true, data: DB.getUserTickets(parts[2]) });
    }
    /* 答题事件批量上报：服务端权威校验 + 风控，实时同步学习记录 */
    if (parts[1] === 'answers' && req.method === 'POST') {
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const r = DB.processAnswers(username, b.events);
      if (!r.ok && r.banned) return sendJson(res, 403, { ok: false, msg: r.msg });
      if (!r.ok) return sendJson(res, 400, { ok: false, msg: r.msg });
      return sendJson(res, 200, { ok: true, data: r });
    }
    /* 心跳：返回服务端权威的会员 / 额度 / 风控状态，客户端据此实时同步 */
    if (parts[1] === 'heartbeat' && req.method === 'POST') {
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const hb = DB.heartbeatData(username);
      if (!hb) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
      return sendJson(res, 200, { ok: true, data: hb });
    }
    /* ---------- 资料中心（真题/解析/听力）：解锁下载后才可在线查看，仅软件内使用 ---------- */
    if (parts[1] === 'materials' && parts[2] && parts[2] !== 'file' && parts[2] !== 'unlock' && req.method === 'GET') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      const m = loadMaterialManifest();
      const dl = DB.getMaterialDownloads(parts[2]);
      const unlocked = new Set(dl.map(d => d.itemId));
      const quota = DB.materialQuota(parts[2]);
      return sendJson(res, 200, { ok: true, data: {
        version: m.version, generatedAt: m.generatedAt, generatedAtText: m.generatedAtText,
        categories: m.categories || [], items: m.items || [],
        unlocked: Array.from(unlocked), downloads: dl,
        freeLimit: quota.freeLimit, isVip: quota.isVip, unlockedCount: quota.used
      } });
    }
    if (parts[1] === 'materials' && parts[2] === 'unlock' && req.method === 'POST') {
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const itemId = String(b.itemId || '').trim();
      const item = findMaterialItem(itemId);
      if (!item) return sendJson(res, 404, { ok: false, msg: '资料不存在' });
      if (item.free) return sendJson(res, 200, { ok: true, data: { unlocked: DB.getMaterialDownloads(username).map(d => d.itemId) }, msg: '该资料为免费资料' });
      /* 免费额度：普通用户最多解锁 8 套，VIP 不限 */
      const quota = DB.materialQuota(username);
      if (!quota.isVip && quota.used >= quota.freeLimit) {
        return sendJson(res, 403, { ok: false, msg: '普通用户最多免费解锁 ' + quota.freeLimit + ' 套资料，开通 VIP 可解锁全部' });
      }
      DB.addMaterialDownload(username, itemId, item.size || 0);
      DB.addLog('material_unlock', username + ' 解锁 ' + itemId + ' (' + (item.title || item.file) + ')');
      return sendJson(res, 200, { ok: true, data: { unlocked: DB.getMaterialDownloads(username).map(d => d.itemId) }, msg: '解锁成功，可在软件内在线查看' });
    }
    /* 资料文件流式下载（鉴权 + 已解锁）：支持 PDF 阅读器与音频播放 */
    if (parts[1] === 'materials' && parts[2] === 'file' && req.method === 'GET') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      const username = String(url.searchParams.get('u') || '').trim();
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问' });
      const itemId = String(url.searchParams.get('id') || '').trim();
      const item = findMaterialItem(itemId);
      if (!item) return sendJson(res, 404, { ok: false, msg: '资料不存在' });
      const dl = DB.getMaterialDownloads(username);
      if (!item.free && !dl.some(d => d.itemId === itemId)) {
        return sendJson(res, 403, { ok: false, msg: '请先下载解锁该资料' });
      }
      const rel = String(item.file || '').replace(/\\/g, '/');
      const file = path.normalize(path.join(MATERIALS_DIR, rel));
      if (!file.startsWith(MATERIALS_DIR) || rel.indexOf('..') >= 0) {
        return sendJson(res, 403, { ok: false, msg: '非法文件路径' });
      }
      let st = null;
      try { st = fs.statSync(file); } catch (e) { /* ignore */ }
      if (!st || !st.isFile()) return sendJson(res, 404, { ok: false, msg: '文件不存在' });
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Content-Disposition': 'inline; filename="' + encodeURIComponent(item.title || path.basename(rel)) + '"',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        /* 安全响应头 */
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer'
      });
      const stream = fs.createReadStream(file);
      stream.on('error', () => { try { res.destroy(); } catch (e) { /* ignore */ } });
      stream.pipe(res);
      return; // 已自行完成响应
    }
    /* ---------- 管理员接口（口令登录 → 12 小时会话；操作全程审计） ---------- */
    if (parts[1] === 'admin') {
      /* 登录：口令 + 失败锁定 */
      if (parts[2] === 'login' && req.method === 'POST') {
        const ip = clientIp(req);
        const rec = adminLoginFails.get(ip) || { count: 0, lockUntil: 0 };
        if (rec.lockUntil > Date.now()) {
          return sendJson(res, 429, { ok: false, msg: '尝试次数过多，请 ' + Math.ceil((rec.lockUntil - Date.now()) / 60000) + ' 分钟后再试' });
        }
        const b = await readBody(req);
        if (!DB.verifyAdminPassword(b.password || '')) {
          rec.count++;
          if (rec.count >= FAIL_LIMIT) { rec.lockUntil = Date.now() + LOCK_MS; rec.count = 0; }
          adminLoginFails.set(ip, rec);
          DB.addLog('admin_login_fail', 'IP ' + ip);
          const remain = rec.lockUntil > Date.now() ? '，已锁定 15 分钟' : '，还可尝试 ' + (FAIL_LIMIT - rec.count) + ' 次';
          return sendJson(res, 401, { ok: false, msg: '口令错误' + remain });
        }
        adminLoginFails.delete(ip);
        /* 管理员口令 s1(SHA256) 升级为 s2(PBKDF2) */
        if (String(DB.getAdminPassword()).startsWith('s1:')) DB.setAdminPassword(b.password);
        const s = DB.createAdminSession();
        DB.addLog('admin_login', 'IP ' + ip);
        return sendJson(res, 200, { ok: true, data: { token: s.token, expireAt: s.expireAt } });
      }
      /* 其余接口：一律校验会话 */
      const sessToken = req.headers['x-admin-token'];
      if (!sessToken || !DB.verifyAdminSession(sessToken)) {
        return sendJson(res, 401, { ok: false, msg: '未登录或会话已过期' });
      }
      if (parts[2] === 'logout' && req.method === 'POST') {
        DB.killAdminSession(sessToken);
        DB.addLog('admin_logout', '');
        return sendJson(res, 200, { ok: true });
      }
      if (parts[2] === 'password' && req.method === 'POST') {
        const b = await readBody(req);
        if (!DB.verifyAdminPassword(b.old || '')) return sendJson(res, 400, { ok: false, msg: '原口令错误' });
        const pwCheck = DB.checkPasswordStrength(b.next);
        if (!pwCheck.ok) return sendJson(res, 400, { ok: false, msg: pwCheck.msg });
        DB.setAdminPassword(b.next);
        DB.killAllAdminSessions();
        DB.addLog('admin_chpass', '');
        return sendJson(res, 200, { ok: true, msg: '口令已修改，请重新登录' });
      }
      if (parts[2] === 'grant' && req.method === 'POST') {
        const b = await readBody(req);
        const level = ['vip1', 'vip2', 'vip3'].includes(b.level) ? b.level : 'vip1';
        const months = Math.max(1, Math.min(120, Number(b.months) || 1));
        const u = DB.grantVipByAdmin(String(b.username || '').trim(), level, months, 'sess-' + sessToken.slice(0, 8));
        if (!u) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
        return sendJson(res, 200, { ok: true, data: u });
      }
      if (parts[2] === 'logs' && req.method === 'GET') {
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
        return sendJson(res, 200, { ok: true, data: DB.listLogs(limit) });
      }
      if (parts[2] === 'export' && req.method === 'GET') {
        const users = DB.adminUsers();
        const orders = DB.listOrders();
        /* 安全修复（第四轮）：CSV 公式注入防护——以 = + - @ 开头的单元格加单引号前缀，
           防止恶意昵称/订单号在 Excel 打开时执行公式（HYPERLINK/CMD 等） */
        const q = v => {
          let s = String(v == null ? '' : v);
          if (/^[=+\-@]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        };
        const uline = users.map(u => [u.username, u.nickname, u.role, u.vip.level, u.vip.expireAt || '',
          u.record.total, u.record.correct, u.record.wrong, u.streak.count, u.createdAt || ''].map(q).join(',')).join('\n');
        const oline = orders.map(o => [o.id, o.user, o.planId, o.amount, o.status, o.note, o.contact,
          o.createdAt || '', o.confirmedAt || ''].map(q).join(',')).join('\n');
        DB.addLog('admin_export', '导出 ' + users.length + ' 用户 / ' + orders.length + ' 订单');
        return sendJson(res, 200, { ok: true, data: {
          usersCsv: '\ufeff用户名,昵称,角色,会员等级,到期时间,累计刷题,答对,答错,连续打卡,注册时间\n' + uline,
          ordersCsv: '\ufeff订单ID,用户,套餐,金额,状态,单号,昵称,创建时间,确认时间\n' + oline,
          exportedAt: Date.now()
        } });
      }
      if (parts[2] === 'orders' && req.method === 'GET') {
        const status = url.searchParams.get('status') || '';
        return sendJson(res, 200, { ok: true, data: DB.listOrders(status || undefined) });
      }
      if (parts[2] === 'dashboard' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, data: DB.adminDashboard() });
      }
      if (parts[2] === 'users' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, data: DB.adminUsers() });
      }
      if (parts[2] === 'user-detail' && req.method === 'GET') {
        const username = String(url.searchParams.get('username') || '').trim();
        if (!username) return sendJson(res, 400, { ok: false, msg: '缺少用户名' });
        const detail = DB.adminUserDetail(username);
        if (!detail) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
        return sendJson(res, 200, { ok: true, data: detail });
      }
      if (parts[2] === 'confirm' && req.method === 'POST') {
        const b = await readBody(req);
        const order = DB.confirmOrder(Number(b.id));
        if (!order) return sendJson(res, 404, { ok: false, msg: '订单不存在' });
        DB.addLog('order_confirm', '#' + b.id + ' ' + order.user + ' ' + (order.planId || ''));
        return sendJson(res, 200, { ok: true, data: order });
      }
      if (parts[2] === 'reject' && req.method === 'POST') {
        const b = await readBody(req);
        const order = DB.rejectOrder(Number(b.id));
        if (!order) return sendJson(res, 404, { ok: false, msg: '订单不存在' });
        DB.addLog('order_reject', '#' + b.id + ' ' + order.user);
        return sendJson(res, 200, { ok: true, data: order });
      }
      /* 兑换码：生成 / 列表 */
      if (parts[2] === 'redeem' && parts[3] === 'generate' && req.method === 'POST') {
        const b = await readBody(req);
        const level = ['vip1', 'vip2', 'vip3'].includes(b.level) ? b.level : 'vip1';
        const months = Math.max(1, Math.min(120, Number(b.months) || 1));
        const count = Math.max(1, Math.min(100, Number(b.count) || 1));
        const codes = DB.generateRedeemCodes(level, months, count, 'sess-' + sessToken.slice(0, 8));
        DB.addLog('redeem_generate', level + ' x' + months + '个月，生成 ' + codes.length + ' 个');
        return sendJson(res, 200, { ok: true, data: { codes, level, months, count: codes.length } });
      }
      if (parts[2] === 'redeem' && parts[3] === 'list' && req.method === 'GET') {
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 200));
        return sendJson(res, 200, { ok: true, data: DB.listRedeemCodes(limit) });
      }
      /* 客服工单：列表（可按状态筛选） / 回复 / 关闭 */
      if (parts[2] === 'tickets' && req.method === 'GET') {
        const status = url.searchParams.get('status') || '';
        return sendJson(res, 200, { ok: true, data: DB.listTickets(status || undefined) });
      }
      if (parts[2] === 'tickets' && parts[3] === 'reply' && req.method === 'POST') {
        const b = await readBody(req);
        if (!String(b.reply || '').trim()) return sendJson(res, 400, { ok: false, msg: '请填写回复内容' });
        const t = DB.replyTicket(Number(b.id), b.reply);
        if (!t) return sendJson(res, 404, { ok: false, msg: '工单不存在' });
        DB.addLog('ticket_reply', '#' + t.id + ' ' + t.user + ' 工单回复');
        return sendJson(res, 200, { ok: true, data: t, msg: '已回复' });
      }
      if (parts[2] === 'tickets' && parts[3] === 'close' && req.method === 'POST') {
        const b = await readBody(req);
        let t = DB.closeTicket(Number(b.id));
        if (!t) return sendJson(res, 404, { ok: false, msg: '工单不存在' });
        if (String(b.reply || '').trim()) t = DB.replyTicket(Number(b.id), b.reply); /* 关闭时附最终回复 */
        DB.addLog('ticket_close', '#' + t.id + ' ' + t.user + ' 工单关闭');
        return sendJson(res, 200, { ok: true, data: t, msg: '工单已关闭' });
      }
      /* 封禁 / 解封用户（针对开挂、篡改） */
      if (parts[2] === 'ban' && req.method === 'POST') {
        const b = await readBody(req);
        const username = String(b.username || '').trim();
        if (!username) return sendJson(res, 400, { ok: false, msg: '缺少用户名' });
        const flags = DB.setDisabled(username, !!b.disabled, String(b.reason || '').slice(0, 200));
        if (!flags) return sendJson(res, 404, { ok: false, msg: '用户不存在' });
        return sendJson(res, 200, { ok: true, data: flags });
      }
      return sendJson(res, 404, { ok: false, msg: 'Admin API not found' });
    }
    if (parts[1] === 'personal-banks' && parts[2] && req.method === 'PUT') {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const b = await readBody(req);
      /* 安全修复（第四轮）：个人题库整体大小上限 1MB、单库 2000 题、总 200 库，
         防超大 JSON 撑爆数据库（DB 膨胀 DoS） */
      const banks = Array.isArray(b.banks) ? b.banks : [];
      if (JSON.stringify(banks).length > 1024 * 1024) return sendJson(res, 400, { ok: false, msg: '题库数据过大（超过 1MB），请精简后重试' });
      if (banks.length > 200) return sendJson(res, 400, { ok: false, msg: '题库数量超过上限（200 个）' });
      if (banks.some(x => !x || (Array.isArray(x.questions) && x.questions.length > 2000))) return sendJson(res, 400, { ok: false, msg: '单个题库题目数超过上限（2000 题）' });
      const banks2 = DB.upsertPersonalBanks(parts[2], banks);
      return sendJson(res, 200, { ok: true, data: banks2 });
    }
    if (parts[1] === 'personal-banks' && parts[2]) {
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (authed !== parts[2]) return sendJson(res, 401, { ok: false, msg: '未登录或无权限访问该账号' });
      return sendJson(res, 200, { ok: true, data: DB.getPersonalBanks(parts[2]) });
    }
    /* ---------- 微信支付（Native 扫码支付 · 自动到账） ---------- */
    if (parts[1] === 'wxpay' && parts[2] === 'status' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, data: { enabled: WX.isEnabled() } });
    }
    if (parts[1] === 'wxpay' && parts[2] === 'order' && req.method === 'POST') {
      const b = await readBody(req);
      const user = String(b.user || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!user || authed !== user) return sendJson(res, 401, { ok: false, msg: '未登录或无权限操作该账号' });
      const planId = ['vip1', 'vip2', 'vip3'].includes(b.planId) ? b.planId : 'vip1';
      const months = { vip1: 1, vip2: 3, vip3: 12 }[planId];
      const price = { vip1: 18, vip2: 45, vip3: 128 }[planId];
      if (!WX.isEnabled()) return sendJson(res, 400, { ok: false, msg: '微信支付未启用' });
      /* 用内部订单号作为微信 out_trade_no，回调时按 note 反查 */
      const outTradeNo = 'XS' + Date.now() + Math.floor(Math.random() * 900 + 100);
      const order = DB.addOrder({ user, planId, amount: price, level: planId, months, status: 'pending', note: outTradeNo, contact: '微信支付' });
      const codeUrl = await WX.createNativeOrder({ outTradeNo, desc: '学升会员-' + planId, amountFen: Math.round(price * 100) });
      return sendJson(res, 200, { ok: true, data: { codeUrl, outTradeNo, orderId: order.id, amount: price, planId } });
    }
    if (parts[1] === 'stats') {
      /* 安全：仅向匿名访客暴露用户规模与在线数，不暴露订单数/收入等经营数据 */
      const now = Date.now();
      const online = DB.adminUsers().filter(u => u.lastSeen && (now - u.lastSeen) < 5 * 60 * 1000).length;
      return sendJson(res, 200, { ok: true, data: { users: DB.stats().users, onlineUsers: online } });
    }
    if (parts[1] === 'logout' && req.method === 'POST') {
      /* 安全修复（第四轮）：登出必须销毁服务端会话，防止 token 泄露后无法失效 */
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!username || authed !== username) return sendJson(res, 401, { ok: false, msg: '未登录或无权限' });
      DB.killUserSession(req.headers['x-user-token']);
      DB.killUserSessions(username); /* 全端登出：销毁该用户全部会话 */
      return sendJson(res, 200, { ok: true, msg: '已退出登录' });
    }
    if (parts[1] === 'convert-doc' && req.method === 'POST') {
      /* 安全修复（第四轮）：convert-doc 会拉起外部进程（soffice/Word COM），
         必须登录且严格限流（每 IP 5 次/分钟），防匿名 DoS / 资源耗尽 */
      const authed = DB.verifyUserSession(req.headers['x-user-token']);
      if (!authed) return sendJson(res, 401, { ok: false, msg: '请先登录后再转换文档' });
      if (!rateLimit(req, 5, 0, 'convert-doc')) return sendJson(res, 429, { ok: false, msg: '转换请求过于频繁，请稍后再试' });
      return await handleConvertDoc(req, res, authed);
    }
    if (parts[1] === 'health') {
      return sendJson(res, 200, { ok: true, name: '学升后端', version: 3, features: ['convert-doc', 'pay-admin'], time: Date.now(), totalUsers: DB.stats().users });
    }
    return sendJson(res, 404, { ok: false, msg: 'API not found: /' + parts.join('/') });
  } catch (e) {
    /* 安全修复：畸形请求体属客户端错误返回 400；其余统一 500 且不透露内部细节 */
    if (e && e.isBadRequest) {
      return sendJson(res, 400, { ok: false, msg: '请求体格式错误' });
    }
    console.error('[server] 请求处理异常:', e.message);
    return sendJson(res, 500, { ok: false, msg: '服务器内部错误' });
  }
}

/* 微信支付回调：验签 → 解密 → 核验订单并自动开通会员 */
async function handleWxpayNotify(req, res) {
  try {
    const raw = await readRawBody(req);
    WX.verifyNotifySign(req.headers, raw);
    const body = JSON.parse(raw);
    const data = WX.decryptResource(body.resource || {});
    if (data && data.trade_state === 'SUCCESS' && data.out_trade_no) {
      const order = DB.getOrderByNote(data.out_trade_no);
      if (order && order.status === 'pending') {
        DB.confirmOrder(order.id);
        const amt = data.amount ? (data.amount.total / 100) : 0;
        DB.addLog('wxpay_notify', '#' + order.id + ' ' + order.user + ' 微信支付 ' + amt + ' 元，自动开通');
      }
    }
    /* 微信要求：返回 SUCCESS 即视为送达，否则会重复推送 */
    return sendJson(res, 200, { code: 'SUCCESS', message: '成功' });
  } catch (e) {
    console.error('[wxpay-notify]', e.message);
    return sendJson(res, 200, { code: 'FAIL', message: e.message });
  }
}

function serveStatic(res, url) {
  let p;
  try {
    p = decodeURIComponent(url.pathname);
  } catch (e) {
    /* 非法百分号编码（如 %zz）会导致 decodeURIComponent 抛异常，返回 400 而非崩溃 */
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }
  /* 安全修复：拒绝含空字节/控制字符的路径（%00 等会导致 fs 抛 TypeError → 500） */
  if (/[\u0000-\u001f\u007f]/.test(p)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }
  /* 资料文件必须经 /api/materials/file 鉴权访问，禁止静态直读绕过解锁 */
  if (/^\/assets\/materials\//.test(p)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden: materials require unlock');
  }
  /* 安全修复：敏感目录/文件禁止静态直读（源码、数据库、配置、版本库、日志、报告、开发残留等） */
  const SENSITIVE_PREFIX = ['/server', '/data', '/.git', '/.svn', '/node_modules', '/dist', '/build', '/test', '/tests', '/.env', '/package-lock.json', '/deploy', '/scripts', '/release'];
  const SENSITIVE_EXACT = ['/package.json', '/.gitignore', '/admin.config.json', '/README.md', '/db.js', '/server.js', '/launcher.js', '/electron-main.js'];
  /* 敏感扩展名：日志 / 文档 / 密钥证书 / 测试脚本 / 构建产物 */
  const SENSITIVE_EXT = /\.(log|md|pem|key|crt|bak|sql|sqlite|env|config|lock|py)$/i;
  /* 开发/测试残留模式：下划线前缀、e2e/audit 报告、测试脚本 */
  const SENSITIVE_PAT = /^\/[_.]|SECURITY|e2e|test_|_test|scenario|\.DS_Store/i;
  if (SENSITIVE_PREFIX.some(s => p.startsWith(s)) || SENSITIVE_EXACT.includes(p) ||
      SENSITIVE_EXT.test(p) || SENSITIVE_PAT.test(p)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden: sensitive path');
  }
  if (p === '/' || p === '/index.html') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  /* 双重校验：归一化后再检查敏感子路径（防路径归一化绕过） */
  const rel = path.relative(ROOT, file).split(path.sep);
  if (rel[0] === 'server' || rel[0] === 'data' || rel[0] === '.git' || rel[0] === '.svn' || rel[0] === 'node_modules' ||
      rel[0] === 'deploy' || rel[0] === 'scripts' || rel[0] === 'release') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden: sensitive path');
  }
  /* 流式传输，避免大文件（PDF/MP3）整读进内存 */
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      /* 安全响应头：防 MIME 嗅探与点击劫持 */
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'no-referrer',
      /* 补充低危安全头 */
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-XSS-Protection': '1; mode=block'
    });
    const stream = fs.createReadStream(file);
    stream.on('error', () => { try { res.destroy(); } catch (e) { /* ignore */ } });
    stream.pipe(res);
  });
}

/* 安全修复：全局兜底未处理 Promise rejection，防止单个异常请求导致进程崩溃（DoS） */
process.on('unhandledRejection', (reason) => {
  console.error('[server] 未处理的 Promise rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  /* 记录但不退出，避免攻击者用单个畸形请求打崩服务 */
  console.error('[server] 未捕获异常（已兜底）:', err.message);
});

/* 启动 HTTP 服务；port 传 0 时由系统分配随机空闲端口 */
function start(port) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = http.createServer(async (req, res) => {
      /* 整体兜底：任何未捕获异常都返回 500/400，绝不因单个坏请求拖垮整个服务 */
      try {
        let url;
        try {
          url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('400 Bad Request');
        }
        /* 安全修复：全局拒绝 TRACE/CONNECT 等危险方法 */
        if (req.method === 'TRACE' || req.method === 'CONNECT') {
          res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('405 Method Not Allowed');
        }
        if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
        return serveStatic(res, url);
      } catch (e) {
        console.error('[server] 请求处理异常:', e.message);
        try {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, msg: '服务器内部错误' }));
        } catch (e2) { /* 响应已断开则忽略 */ }
      }
    });
    server.on('error', (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
    server.listen(port || 0, () => {
      if (settled) return;
      settled = true;
      const actual = server.address().port;
      console.log(`[学升后端] 已启动 http://127.0.0.1:${actual}  数据库: ${DB_FILE}`);
      resolve({ server, port: actual, url: `http://127.0.0.1:${actual}` });
    });
  });
}

if (require.main === module) {
  const PORT = Number(process.argv[2] || process.env.PORT || 8790);
  start(PORT).catch((e) => { console.error('[学升后端] 启动失败:', e.message); process.exit(1); });
}

module.exports = { start };
