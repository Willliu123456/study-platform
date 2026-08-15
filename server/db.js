/* ============ 学升·SQLite 数据层（真实后端数据库） ============ */
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const { systemQuestion } = require('./questions.js');

const DB_DIR = process.env.XS_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_FILE = path.join(DB_DIR, 'study.db');

const db = new DatabaseSync(DB_FILE);

/* 安全修复：数据库文件权限仅限所有者（0600），防其他本地用户读取 */
try { fs.chmodSync(DB_FILE, 0o600); } catch (e) { /* 忽略 */ }
try { fs.chmodSync(DB_FILE + '-wal', 0o600); } catch (e) { /* 忽略 */ }
try { fs.chmodSync(DB_FILE + '-shm', 0o600); } catch (e) { /* 忽略 */ }

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    username   TEXT PRIMARY KEY,
    password   TEXT NOT NULL,
    nickname   TEXT,
    role       TEXT DEFAULT 'student',
    vip_level  TEXT DEFAULT 'free',
    vip_expire INTEGER DEFAULT 0,
    quota_date TEXT,
    quota_used INTEGER DEFAULT 0,
    coins      INTEGER DEFAULT 0,
    created_at INTEGER,
    last_seen  INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS records (
    user       TEXT PRIMARY KEY,
    total      INTEGER DEFAULT 0,
    correct    INTEGER DEFAULT 0,
    wrong      INTEGER DEFAULT 0,
    by_day     TEXT DEFAULT '{}',
    by_bank    TEXT DEFAULT '{}',
    wrong_set  TEXT DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS streaks (
    user  TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    last  TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user       TEXT,
    plan_id    TEXT,
    amount     REAL,
    level      TEXT,
    months     INTEGER,
    status     TEXT DEFAULT 'pending',
    note       TEXT,
    contact    TEXT,
    created_at INTEGER,
    confirmed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS personal_banks (
    user  TEXT PRIMARY KEY,
    banks TEXT DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS redeem_codes (
    code       TEXT PRIMARY KEY,
    level      TEXT,
    months     INTEGER DEFAULT 1,
    status     TEXT DEFAULT 'unused',
    created_by TEXT,
    created_at INTEGER,
    used_by    TEXT,
    used_at    INTEGER
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token      TEXT PRIMARY KEY,
    created_at INTEGER,
    expire_at  INTEGER
  );
  CREATE TABLE IF NOT EXISTS admin_logs (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    time   INTEGER,
    action TEXT,
    detail TEXT
  );
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);
/* 兼容迁移：老库 users 表无 last_seen 列时补上（在线监控） */
try {
  db.exec(`ALTER TABLE users ADD COLUMN last_seen INTEGER DEFAULT 0`);
} catch (e) { /* 列已存在则忽略 */ }
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    token      TEXT PRIMARY KEY,
    user       TEXT,
    created_at INTEGER,
    expire_at  INTEGER
  );
  CREATE TABLE IF NOT EXISTS user_flags (
    user       TEXT PRIMARY KEY,
    suspicious INTEGER DEFAULT 0,
    disabled   INTEGER DEFAULT 0,
    reason     TEXT,
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user       TEXT,
    subject    TEXT,
    content    TEXT,
    status     TEXT DEFAULT 'open',
    reply      TEXT,
    reply_at   INTEGER,
    created_at INTEGER,
    updated_at INTEGER
  );
  /* 资料中心：用户解锁下载记录（user + 资料 item id 唯一），服务端权威 */
  CREATE TABLE IF NOT EXISTS material_downloads (
    user       TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    size       INTEGER DEFAULT 0,
    created_at INTEGER,
    PRIMARY KEY (user, item_id)
  );
`);

/* ---------- 迁移：老版本 orders 表缺少 status/note/contact/confirmed_at 列 ---------- */
(function migrateOrders() {
  try {
    const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
    const add = (name, def) => {
      if (!cols.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${def}`);
    };
    add('status', "TEXT DEFAULT 'pending'");
    add('note', 'TEXT');
    add('contact', 'TEXT');
    add('confirmed_at', 'INTEGER');
  } catch (e) { /* 表可能尚未创建，忽略 */ }
})();

/* ---------- users ---------- */
function upsertUser(u) {
  db.prepare(`INSERT INTO users (username,password,nickname,role,vip_level,vip_expire,quota_date,quota_used,coins,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(username) DO UPDATE SET
      password=excluded.password, nickname=excluded.nickname, role=excluded.role,
      vip_level=excluded.vip_level, vip_expire=excluded.vip_expire,
      quota_date=excluded.quota_date, quota_used=excluded.quota_used, coins=excluded.coins
  `).run(u.username, u.password, u.nickname, u.role || 'student',
    u.vip && u.vip.level || 'free', u.vip && u.vip.expireAt || 0,
    u.dailyQuota && u.dailyQuota.date || null, u.dailyQuota && u.dailyQuota.used || 0,
    u.coins || 0, u.createdAt || Date.now());
  return getUser(u.username);
}
function getUser(username) {
  const row = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!row) return null;
  return {
    username: row.username, password: row.password, nickname: row.nickname,
    role: row.role,
    vip: { level: row.vip_level, expireAt: row.vip_expire },
    dailyQuota: row.quota_date ? { date: row.quota_date, used: row.quota_used } : null,
    coins: row.coins, createdAt: row.created_at
  };
}
/* 对外返回的用户信息：绝不包含密码等敏感字段 */
function getUserPublic(username) {
  const u = getUser(username);
  if (!u) return null;
  return {
    username: u.username, nickname: u.nickname, role: u.role,
    vip: u.vip, dailyQuota: u.dailyQuota, coins: u.coins, createdAt: u.createdAt,
    flags: getFlags(username)
  };
}

/* ---------- 密码安全（PBKDF2-SHA256 加盐哈希，10 万轮迭代，兼容旧 s1 格式） ---------- */
const PBKDF2_ITERATIONS = 100000, PBKDF2_KEYLEN = 32, PBKDF2_DIGEST = 'sha256';
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(String(pw), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return 's2:' + salt + ':' + h;
}
function verifyPw(pw, stored) {
  if (!stored) return false;
  stored = String(stored);
  if (stored.startsWith('s2:')) {
    /* PBKDF2 格式 s2:salt:hash */
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const calc = crypto.pbkdf2Sync(String(pw), parts[1], PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
    /* 恒时比较防时序攻击 */
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(parts[2], 'hex'));
  }
  if (stored.startsWith('s1:')) {
    /* 旧 SHA256 格式：验证通过后由调用方触发 upgradePassword 升级 */
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const calc = crypto.createHash('sha256').update(parts[1] + ':' + pw).digest('hex');
    return calc === parts[2];
  }
  return false; /* 历史明文密码已不再兼容（安全优先） */
}
function upgradePassword(username, plainPw) {
  db.prepare('UPDATE users SET password=? WHERE username=?').run(hashPw(plainPw), username);
}

/* ---------- 密码复杂度校验（高危修复） ---------- */
function checkPasswordStrength(pw) {
  const p = String(pw || '');
  if (p.length < 8) return { ok: false, msg: '密码至少 8 位' };
  if (p.length > 128) return { ok: false, msg: '密码最长 128 位' };
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { ok: false, msg: '密码需同时包含大写字母、小写字母和数字' };
  return { ok: true };
}

/* ---------- 配置项（管理员口令存 DB，不再硬编码） ---------- */
function getConfig(key) {
  const r = db.prepare('SELECT value FROM config WHERE key=?').get(key);
  return r ? r.value : null;
}
function setConfig(key, value) {
  db.prepare('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
function getAdminPassword() { return getConfig('admin_password'); }
function setAdminPassword(pw) { setConfig('admin_password', hashPw(pw)); }
function verifyAdminPassword(pw) { return verifyPw(pw, getAdminPassword()); }

/* ---------- 管理员会话（登录签发，12 小时过期） ---------- */
const SESSION_TTL = 12 * 3600 * 1000;
function createAdminSession() {
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO admin_sessions (token,created_at,expire_at) VALUES (?,?,?)').run(token, now, now + SESSION_TTL);
  return { token, expireAt: now + SESSION_TTL };
}
function verifyAdminSession(token) {
  if (!token) return false;
  const row = db.prepare('SELECT * FROM admin_sessions WHERE token=?').get(token);
  if (!row) return false;
  if (row.expire_at < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token=?').run(token);
    return false;
  }
  return true;
}
function killAdminSession(token) { db.prepare('DELETE FROM admin_sessions WHERE token=?').run(token); }
function killAllAdminSessions() { db.prepare('DELETE FROM admin_sessions').run(); }

/* ---------- 用户会话（登录签发，7 天有效） ----------
   安全修复：30 天过长，缩短为 7 天，降低 token 泄露窗口。 */
const USER_SESSION_TTL = 7 * 24 * 3600 * 1000;
function createUserSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO user_sessions (token,user,created_at,expire_at) VALUES (?,?,?,?)')
    .run(token, username, now, now + USER_SESSION_TTL);
  return token;
}
function verifyUserSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM user_sessions WHERE token=?').get(token);
  if (!row) return null;
  if (row.expire_at < Date.now()) {
    db.prepare('DELETE FROM user_sessions WHERE token=?').run(token);
    return null;
  }
  return row.user;
}
function killUserSession(token) { db.prepare('DELETE FROM user_sessions WHERE token=?').run(token); }
function killUserSessions(username) {
  if (!username) return;
  db.prepare('DELETE FROM user_sessions WHERE user=?').run(username);
}

/* ---------- 用户风控（异常累计 → 自动封禁） ---------- */
function getFlags(username) {
  const r = db.prepare('SELECT * FROM user_flags WHERE user=?').get(username);
  return r ? { suspicious: r.suspicious || 0, disabled: r.disabled || 0, reason: r.reason || '', updatedAt: r.updated_at || 0 }
           : { suspicious: 0, disabled: 0, reason: '', updatedAt: 0 };
}
const AUTO_BAN_THRESHOLD = 30;
function addSuspicious(username, n, reason) {
  if (!username) return getFlags(username);
  const f = getFlags(username);
  const now = Date.now();
  const suspicious = f.suspicious + Math.max(1, Math.floor(n || 1));
  db.prepare(`INSERT INTO user_flags (user,suspicious,disabled,reason,updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(user) DO UPDATE SET suspicious=excluded.suspicious, reason=excluded.reason, updated_at=excluded.updated_at`)
    .run(username, suspicious, f.disabled ? 1 : 0, (reason || f.reason || '').slice(0, 300), now);
  const nf = getFlags(username);
  if (nf.suspicious >= AUTO_BAN_THRESHOLD && !f.disabled) {
    db.prepare('UPDATE user_flags SET disabled=1, updated_at=? WHERE user=?').run(Date.now(), username);
    killUserSessions(username);
    addLog('auto_ban', username + ' 疑似开挂自动封禁（' + (reason || '').slice(0, 200) + '）');
    return getFlags(username);
  }
  return nf;
}
function setDisabled(username, disabled, reason) {
  if (!username) return null;
  const cur = getFlags(username);
  db.prepare(`INSERT INTO user_flags (user,suspicious,disabled,reason,updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(user) DO UPDATE SET disabled=excluded.disabled, reason=excluded.reason, updated_at=excluded.updated_at`)
    .run(username, cur.suspicious, disabled ? 1 : 0, String(reason || '').slice(0, 300), Date.now());
  if (disabled) killUserSessions(username);
  addLog(disabled ? 'admin_ban' : 'admin_unban', username + (disabled ? ' 封禁' : ' 解封') + (reason ? '：' + String(reason).slice(0, 200) : ''));
  return getFlags(username);
}

/* ---------- 审计日志 ---------- */
function addLog(action, detail) {
  db.prepare('INSERT INTO admin_logs (time,action,detail) VALUES (?,?,?)')
    .run(Date.now(), String(action || '').slice(0, 60), String(detail || '').slice(0, 500));
}
function listLogs(limit) {
  return db.prepare('SELECT * FROM admin_logs ORDER BY id DESC LIMIT ?').all(limit || 100)
    .map(r => ({ id: r.id, time: r.time, action: r.action, detail: r.detail }));
}
/* ---------- 日志与过期会话自动清理（中危修复） ----------
   日志保留 90 天 / 最多 5 万条；过期会话每次校验时惰性删除，此处兜底全量清理。 */
const LOG_RETENTION_MS = 90 * 24 * 3600 * 1000, LOG_MAX_ROWS = 50000;
function cleanupLogsAndSessions() {
  try {
    db.prepare('DELETE FROM admin_logs WHERE time < ?').run(Date.now() - LOG_RETENTION_MS);
    db.prepare(`DELETE FROM admin_logs WHERE id NOT IN (SELECT id FROM admin_logs ORDER BY id DESC LIMIT ?)`).run(LOG_MAX_ROWS);
    db.prepare('DELETE FROM admin_sessions WHERE expire_at < ?').run(Date.now());
    db.prepare('DELETE FROM user_sessions WHERE expire_at < ?').run(Date.now());
  } catch (e) { /* 清理失败不影响主流程 */ }
}
let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 3600 * 1000) { lastCleanup = now; cleanupLogsAndSessions(); }
}
maybeCleanup();

/* ---------- records ---------- */
function getRecord(user) {
  const row = db.prepare('SELECT * FROM records WHERE user=?').get(user);
  if (!row) return null;
  return {
    total: row.total, correct: row.correct, wrong: row.wrong,
    byDay: safeJson(row.by_day), byBank: safeJson(row.by_bank), wrongSet: safeJson(row.wrong_set)
  };
}
function upsertRecord(user, r) {
  db.prepare(`INSERT INTO records (user,total,correct,wrong,by_day,by_bank,wrong_set)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user) DO UPDATE SET
      total=excluded.total, correct=excluded.correct, wrong=excluded.wrong,
      by_day=excluded.by_day, by_bank=excluded.by_bank, wrong_set=excluded.wrong_set
  `).run(user, r.total || 0, r.correct || 0, r.wrong || 0,
    JSON.stringify(r.byDay || {}), JSON.stringify(r.byBank || {}), JSON.stringify(r.wrongSet || {}));
  return getRecord(user);
}

/* ---------- streaks ---------- */
function getStreak(user) {
  const row = db.prepare('SELECT * FROM streaks WHERE user=?').get(user);
  return row ? { count: row.count, last: row.last } : { count: 0, last: '' };
}
function upsertStreak(user, s) {
  db.prepare(`INSERT INTO streaks (user,count,last) VALUES (?,?,?)
    ON CONFLICT(user) DO UPDATE SET count=excluded.count, last=excluded.last
  `).run(user, s.count || 0, s.last || '');
  return getStreak(user);
}
/* 打卡合并：只增不减（兼容旧客户端全量覆盖） */
function mergeStreak(user, incoming) {
  const cur = getStreak(user);
  const count = Math.max(cur.count || 0, incoming.count || 0);
  const last = String(incoming.last || '') > String(cur.last || '') ? incoming.last : cur.last;
  return upsertStreak(user, { count, last });
}

/* ---------- 答题事件（服务端权威记录 + 风控检测） ---------- */
function emptyRecord() { return { total: 0, correct: 0, wrong: 0, byDay: {}, byBank: {}, wrongSet: {} }; }
function questionMeta(username, qid) {
  const sq = systemQuestion(qid);
  if (sq) return { bank: sq.bank, kp: sq.kp || '' };
  const banks = getPersonalBanks(username);
  for (const b of banks) {
    const q = (b.questions || []).find(x => x.id === qid);
    if (q) return { bank: b.id, kp: q.kp || '' };
  }
  return null;
}
/* 记录合并：total/correct/wrong 只增不减；byDay/byBank 逐日取最大；错题本取更严重者 */
function mergeRecord(cur, incoming) {
  const c = cur || emptyRecord();
  const n = incoming || emptyRecord();
  const r = {
    total: Math.max(c.total || 0, n.total || 0),
    correct: Math.max(c.correct || 0, n.correct || 0),
    wrong: Math.max(c.wrong || 0, n.wrong || 0)
  };
  r.correct = Math.min(r.correct, r.total);
  r.wrong = Math.min(r.wrong, r.total - r.correct);
  const mergeMap = (a, b, hasWrong) => {
    const out = { ...(a || {}) };
    for (const k of Object.keys(b || {})) {
      const av = (a && a[k]) || { total: 0, correct: 0 };
      const bv = b[k] || { total: 0, correct: 0 };
      const merged = { total: Math.max(av.total || 0, bv.total || 0), correct: Math.max(av.correct || 0, bv.correct || 0) };
      if (hasWrong) merged.wrong = Math.max(av.wrong || 0, bv.wrong || 0);
      out[k] = merged;
    }
    return out;
  };
  r.byDay = mergeMap(c.byDay, n.byDay, false);
  r.byBank = mergeMap(c.byBank, n.byBank, true);
  r.wrongSet = { ...(c.wrongSet || {}) };
  for (const [k, v] of Object.entries(n.wrongSet || {})) {
    const old = r.wrongSet[k];
    if (!old || (v.wrongCount || 0) > (old.wrongCount || 0)) r.wrongSet[k] = v;
  }
  return r;
}
function touchStreakServer(username, ts) {
  const s = getStreak(username);
  const today = dayKeyOf(ts);
  const yest = dayKeyOf(ts - 86400000);
  let count = s.count || 0;
  if (s.last === today) { /* 今日已打卡 */ }
  else if (s.last === yest) count++;
  else count = 1;
  upsertStreak(username, { count, last: today });
}
/* 处理批量答题事件：校验 → 风控累计 → 服务端权威生成记录 */
function processAnswers(username, events) {
  const flags = getFlags(username);
  if (flags.disabled) return { ok: false, banned: true, msg: '账号已被封禁' };
  const u = getUser(username);
  if (!u) return { ok: false, msg: '用户不存在' };
  const list = (Array.isArray(events) ? events : []).slice(0, 100);
  const now = Date.now();
  if (!list.length) {
    const hb = heartbeatData(username);
    return { ok: true, accepted: 0, dropped: 0, record: getRecord(username) || emptyRecord(), quota: hb.quota, flags: hb.flags, serverTime: now };
  }
  touchUserSeen(username); /* 答题即在线活跃 */
  const rec = getRecord(username) || emptyRecord();
  const todayKey = dayKeyOf(now);
  const isVipUser = u.vip.level !== 'free' && u.vip.expireAt > now;
  const limit = isVipUser ? 9999 : 50;
  let todayUsed = (rec.byDay[todayKey] && rec.byDay[todayKey].total) || 0;
  let accepted = 0, dropped = 0, susp = 0;
  const suspLog = [];
  let prevTs = 0, fastPairs = 0;
  for (const ev of list) {
    const qid = String(ev.qid || '');
    const correct = !!ev.correct;
    let ts = Number(ev.ts) || 0;
    const dt = Number(ev.dt) || 0;
    if (!ts) ts = now;
    if (ts > now + 60000) { susp += 2; suspLog.push('时间超前'); continue; }
    if (prevTs && ts < prevTs) { susp += 1; suspLog.push('时间倒序'); continue; }
    if (prevTs && ts - prevTs > 0 && ts - prevTs < 2000) fastPairs++;
    prevTs = ts;
    const meta = questionMeta(username, qid);
    if (!meta) { susp += 3; suspLog.push('未知题目'); dropped++; continue; }
    if (dt > 0 && dt < 1500) { susp += 1; suspLog.push('用时过短'); }
    if (limit !== 9999 && todayUsed >= limit) { susp += 5; suspLog.push('超额度刷题'); dropped++; continue; }
    todayUsed++;
    accepted++;
    const dk = dayKeyOf(ts);
    rec.total++;
    if (correct) rec.correct++; else rec.wrong++;
    rec.byDay[dk] = rec.byDay[dk] || { total: 0, correct: 0 };
    rec.byDay[dk].total++;
    if (correct) rec.byDay[dk].correct++;
    rec.byBank[meta.bank] = rec.byBank[meta.bank] || { total: 0, correct: 0, wrong: 0 };
    rec.byBank[meta.bank].total++;
    if (correct) rec.byBank[meta.bank].correct++; else rec.byBank[meta.bank].wrong++;
    if (!correct) {
      const w = rec.wrongSet[qid] || { qid, bank: meta.bank, kp: meta.kp || '', wrongCount: 0, lastAt: 0 };
      w.wrongCount++;
      w.lastAt = ts;
      rec.wrongSet[qid] = w;
    }
  }
  upsertRecord(username, rec);
  if (accepted > 0) touchStreakServer(username, now);
  /* 免费额度限制由服务端权威记录同步到 users 表 */
  const used2 = (rec.byDay[todayKey] && rec.byDay[todayKey].total) || 0;
  if ((u.dailyQuota && u.dailyQuota.date === todayKey ? u.dailyQuota.used : 0) < used2) {
    upsertUser({ ...u, dailyQuota: { date: todayKey, used: used2 } });
  }
  if (fastPairs >= 3) { susp += fastPairs * 2; suspLog.push('连续极速答题'); }
  let newFlags = flags;
  if (susp > 0) newFlags = addSuspicious(username, susp, suspLog.join(';'));
  const hb = heartbeatData(username);
  return {
    ok: true, accepted, dropped,
    record: getRecord(username), quota: hb.quota, flags: newFlags, serverTime: now
  };
}
/* 在线监控：更新用户最后活跃时间（心跳/答题/资料解锁等任意活跃请求调用） */
function touchUserSeen(username) {
  if (!username) return;
  try { db.prepare('UPDATE users SET last_seen=? WHERE username=?').run(Date.now(), username); } catch (e) { /* 忽略 */ }
}

/* 心跳：返回服务端权威的用户 / 额度 / 风控状态，供客户端实时同步 */
function heartbeatData(username) {
  const u = getUser(username);
  if (!u) return null;
  touchUserSeen(username);
  const flags = getFlags(username);
  const now = Date.now();
  const todayKey = dayKeyOf(now);
  const isVipUser = u.vip.level !== 'free' && u.vip.expireAt > now;
  const todayUsed = u.dailyQuota && u.dailyQuota.date === todayKey ? u.dailyQuota.used : 0;
  return {
    serverTime: now,
    user: getUserPublic(username),
    quota: { date: todayKey, used: todayUsed, limit: isVipUser ? 9999 : 50 },
    flags
  };
}

/* ---------- orders ---------- */
function addOrder(o) {
  const now = Date.now();
  const status = o.status || 'pending';
  const info = db.prepare(`INSERT INTO orders (user,plan_id,amount,level,months,status,note,contact,created_at,confirmed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(o.user, o.planId || '', o.amount || 0, o.level || '', o.months || 0,
      status, o.note || '', o.contact || '', o.createdAt || now,
      status === 'confirmed' ? (o.confirmedAt || now) : null);
  return getOrderById(info.lastInsertRowid);
}
function getOrderById(id) {
  const r = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  return r ? mapOrder(r) : null;
}
function getOrders(user) {
  return db.prepare('SELECT * FROM orders WHERE user=? ORDER BY created_at DESC').all(user).map(mapOrder);
}
function getOrderByNote(note) {
  if (!note) return null;
  const r = db.prepare('SELECT * FROM orders WHERE note=? ORDER BY id DESC LIMIT 1').get(note);
  return r ? mapOrder(r) : null;
}
function listOrders(status) {
  if (!status) return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(mapOrder);
  return db.prepare('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC').all(status).map(mapOrder);
}
function confirmOrder(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!row) return null;
  if (row.status === 'pending') {
    db.prepare('UPDATE orders SET status=?, confirmed_at=? WHERE id=?')
      .run('confirmed', Date.now(), id);
  }
  /* 同时给用户开通对应会员 */
  activateVip(row.user, row.level || 'vip1', row.months || 1);
  return getOrderById(id);
}
function rejectOrder(id) {
  db.prepare('UPDATE orders SET status=? WHERE id=?').run('rejected', id);
  return getOrderById(id);
}
function activateVip(username, level, months) {
  const u = getUser(username);
  if (!u) return null;
  const now = Date.now();
  const base = (u.vip.level !== 'free' && u.vip.expireAt > now) ? u.vip.expireAt : now;
  const expireAt = base + months * 30 * 86400000;
  db.prepare('UPDATE users SET vip_level=?, vip_expire=? WHERE username=?')
    .run(level, expireAt, username);
  return getUser(username);
}
/* 管理员手动开通（线下收款/补单场景）：直接给用户加会员，并写审计日志 */
function grantVipByAdmin(username, level, months, by) {
  const u = activateVip(username, level, months);
  if (!u) return null;
  addLog('grant_vip', username + ' -> ' + level + ' x' + months + '个月（by ' + by + '）');
  return getUserPublic(username);
}
/* ---------- 兑换码 ---------- */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 0/O/1/I
function makeCode() {
  const seg = n => { let s = ''; for (let i = 0; i < n; i++) s += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]; return s; };
  return 'XS-' + seg(4) + '-' + seg(4) + '-' + seg(4);
}
function generateRedeemCodes(level, months, count, by) {
  const num = Math.max(1, Math.min(100, Number(count) || 1));
  const ins = db.prepare('INSERT OR IGNORE INTO redeem_codes (code,level,months,status,created_by,created_at) VALUES (?,?,?,?,?,?)');
  const now = Date.now();
  const codes = [];
  let guard = 0;
  while (codes.length < num && guard < num * 20) {
    guard++;
    const c = makeCode();
    const r = ins.run(c, level, months, 'unused', by || 'admin', now);
    if (r.changes) codes.push(c);
  }
  return codes;
}
function listRedeemCodes(limit) {
  return db.prepare('SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT ?').all(limit || 200)
    .map(r => ({
      code: r.code, level: r.level, months: r.months, status: r.status,
      createdBy: r.created_by, createdAt: r.created_at,
      usedBy: r.used_by, usedAt: r.used_at
    }));
}
function redeemCode(code, username) {
  const c = String(code || '').trim().toUpperCase();
  const row = db.prepare('SELECT * FROM redeem_codes WHERE code=?').get(c);
  if (!row) return { ok: false, msg: '兑换码不存在' };
  if (row.status === 'used') return { ok: false, msg: '该兑换码已被使用' };
  const u = getUser(username);
  if (!u) return { ok: false, msg: '用户不存在' };
  const now = Date.now();
  db.prepare('UPDATE redeem_codes SET status=?, used_by=?, used_at=? WHERE code=?')
    .run('used', username, now, row.code);
  activateVip(username, row.level || 'vip1', row.months || 1);
  addOrder({ user: username, planId: row.level || 'vip1', amount: 0, level: row.level || 'vip1', months: row.months || 1, status: 'confirmed', note: row.code, contact: '兑换码', createdAt: now, confirmedAt: now });
  addLog('redeem_use', username + ' 使用兑换码 ' + row.code + '（' + (row.level || 'vip1') + ' x' + (row.months || 1) + '个月）');
  return { ok: true, data: getUserPublic(username) };
}

function mapOrder(r) {
  return {
    id: r.id, user: r.user, planId: r.plan_id, amount: r.amount, level: r.level,
    months: r.months, status: r.status, note: r.note, contact: r.contact,
    createdAt: r.created_at, confirmedAt: r.confirmed_at,
    source: (r.note || '').startsWith('XS-') && r.contact === '兑换码' ? 'redeem' : 'pay'
  };
}

/* ---------- personal_banks ---------- */
function getPersonalBanks(user) {
  const row = db.prepare('SELECT banks FROM personal_banks WHERE user=?').get(user);
  return row ? safeJson(row.banks) : [];
}
function upsertPersonalBanks(user, banks) {
  db.prepare(`INSERT INTO personal_banks (user,banks) VALUES (?,?)
    ON CONFLICT(user) DO UPDATE SET banks=excluded.banks`)
    .run(user, JSON.stringify(Array.isArray(banks) ? banks : []));
  return getPersonalBanks(user);
}

/* ---------- 客服工单（用户在软件内提交，管理员在后台回复/关闭） ---------- */
function mapTicket(r) {
  return {
    id: r.id, user: r.user, subject: r.subject, content: r.content,
    status: r.status, reply: r.reply, replyAt: r.reply_at,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function createTicket(t) {
  const now = Date.now();
  const info = db.prepare(`INSERT INTO tickets (user,subject,content,status,reply,reply_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(String(t.user || ''), String(t.subject || '咨询').slice(0, 100),
      String(t.content || '').slice(0, 2000), 'open', '', 0, now, now);
  return getTicketById(info.lastInsertRowid);
}
function getTicketById(id) {
  const r = db.prepare('SELECT * FROM tickets WHERE id=?').get(id);
  return r ? mapTicket(r) : null;
}
function getUserTickets(user) {
  return db.prepare('SELECT * FROM tickets WHERE user=? ORDER BY created_at DESC').all(user).map(mapTicket);
}
function listTickets(status) {
  if (!status) return db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all().map(mapTicket);
  return db.prepare('SELECT * FROM tickets WHERE status=? ORDER BY created_at DESC').all(status).map(mapTicket);
}
function replyTicket(id, reply) {
  const row = db.prepare('SELECT * FROM tickets WHERE id=?').get(id);
  if (!row) return null;
  const now = Date.now();
  /* 已关闭的工单可追加回复但不改变关闭状态 */
  const status = row.status === 'closed' ? 'closed' : 'replied';
  db.prepare('UPDATE tickets SET reply=?, reply_at=?, status=?, updated_at=? WHERE id=?')
    .run(String(reply || '').slice(0, 2000), now, status, now, id);
  return getTicketById(id);
}
function closeTicket(id) {
  const row = db.prepare('SELECT * FROM tickets WHERE id=?').get(id);
  if (!row) return null;
  db.prepare('UPDATE tickets SET status=?, updated_at=? WHERE id=?').run('closed', Date.now(), id);
  return getTicketById(id);
}
function ticketStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all();
  const out = { open: 0, pending: 0, replied: 0, closed: 0, total: 0 };
  for (const r of rows) { if (out[r.status] !== undefined) out[r.status] = r.n; out.total += r.n; }
  return out;
}

/* ---------- 资料中心（解锁下载记录） ---------- */
function getMaterialDownloads(user) {
  if (!user) return [];
  return db.prepare('SELECT item_id AS itemId, size, created_at AS createdAt FROM material_downloads WHERE user=? ORDER BY created_at DESC')
    .all(user);
}
function addMaterialDownload(user, itemId, size) {
  if (!user || !itemId) return getMaterialDownloads(user);
  db.prepare(`INSERT INTO material_downloads (user,item_id,size,created_at) VALUES (?,?,?,?)
    ON CONFLICT(user,item_id) DO UPDATE SET size=excluded.size, created_at=excluded.created_at`)
    .run(user, itemId, Math.max(0, Number(size) || 0), Date.now());
  return getMaterialDownloads(user);
}
function materialDownloadCount(user) {
  if (!user) return 0;
  const r = db.prepare('SELECT COUNT(*) AS n FROM material_downloads WHERE user=?').get(user);
  return r ? r.n : 0;
}
/* 资料中心配额：普通用户免费解锁上限 8 套，VIP 不限（服务端权威判断） */
const MATERIAL_FREE_LIMIT = 8;
function isVipUser(u) {
  return !!(u && u.vip && u.vip.level !== 'free' && u.vip.expireAt > Date.now());
}
function materialQuota(user) {
  const u = getUser(user);
  const vip = isVipUser(u);
  const used = materialDownloadCount(user);
  return {
    freeLimit: MATERIAL_FREE_LIMIT,
    isVip: vip,
    used,
    left: vip ? Infinity : Math.max(0, MATERIAL_FREE_LIMIT - used)
  };
}

function stats() {
  const u = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  const o = db.prepare('SELECT COUNT(*) AS n, IFNULL(SUM(amount),0) AS amt FROM orders').get();
  return { users: u.n, orders: o.n, revenue: o.amt };
}

/* ---------- 管理控制台（管理员用） ---------- */
function dayKeyOf(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* 管理员视角的用户原始行：用户 + 刷题记录 + 连续打卡 + 个人题库 + 订单聚合 */
function adminUserRows(whereSql, params) {
  return db.prepare(`
    SELECT u.username, u.nickname, u.role, u.vip_level, u.vip_expire, u.created_at, u.coins, u.last_seen AS u_last_seen,
           r.total AS r_total, r.correct AS r_correct, r.wrong AS r_wrong, r.by_day AS r_by_day,
           s.count AS s_count, s.last AS s_last,
           p.banks AS p_banks,
           (SELECT COUNT(*) FROM orders o WHERE o.user = u.username) AS o_count,
           (SELECT COUNT(*) FROM orders o WHERE o.user = u.username AND o.status = 'confirmed') AS o_confirmed,
           (SELECT MAX(confirmed_at) FROM orders o WHERE o.user = u.username AND o.status = 'confirmed') AS o_last,
           (SELECT IFNULL(SUM(amount),0) FROM orders o WHERE o.user = u.username AND o.status = 'confirmed') AS o_amount
    FROM users u
    LEFT JOIN records r ON r.user = u.username
    LEFT JOIN streaks s ON s.user = u.username
    LEFT JOIN personal_banks p ON p.user = u.username
    ${whereSql || ''}`).all(...(params || []));
}
/* 从原始行组装管理员视角用户对象（列表与详情共用同一套逻辑） */
function mapAdminUser(r) {
  const byDay = safeJson(r.r_by_day || '{}');
  const todayKey = dayKeyOf(Date.now());
  const td = byDay[todayKey] || { total: 0, correct: 0 };
  const total = r.r_total || 0;
  const banks = safeJson(r.p_banks || '[]');
  return {
    username: r.username, nickname: r.nickname || r.username, role: r.role || 'student',
    vip: { level: r.vip_level || 'free', expireAt: r.vip_expire || 0 },
    coins: r.coins || 0, createdAt: r.created_at || 0, lastSeen: r.u_last_seen || 0,
    record: { total, correct: r.r_correct || 0, wrong: r.r_wrong || 0, todayTotal: td.total || 0, todayCorrect: td.correct || 0 },
    streak: { count: r.s_count || 0, last: r.s_last || '' },
    banks: { count: banks.length, totalQuestions: banks.reduce((s, b) => s + (b.questions ? b.questions.length : 0), 0), data: banks },
    orders: { count: r.o_count || 0, confirmed: r.o_confirmed || 0, lastAt: r.o_last || 0, amount: r.o_amount || 0 },
    flags: getFlags(r.username)
  };
}
function adminUsers() {
  return adminUserRows('ORDER BY u.created_at DESC').map(mapAdminUser);
}
/* 用户详情：完整个人数据（个人题库全量 + 订单全量 + 各题库表现 + 近 14 天趋势 + 活跃天数） */
function adminUserDetail(username) {
  const rows = adminUserRows('WHERE u.username = ?', [username]);
  if (!rows.length) return null;
  const u = mapAdminUser(rows[0]);
  const rec = getRecord(username) || { total: 0, correct: 0, wrong: 0, byDay: {}, byBank: {}, wrongSet: {} };
  const orders = getOrders(username);
  /* 近 14 天趋势（含今天） */
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = dayKeyOf(d.getTime());
    const v = rec.byDay[k] || { total: 0, correct: 0 };
    days.push({ key: k, label: (d.getMonth() + 1) + '/' + d.getDate(), total: v.total || 0, correct: v.correct || 0 });
  }
  /* 各题库表现：系统题库 + 个人题库 */
  const SYSTEM_BANKS = { kyzz: '考研政治', kyyy: '考研英语', xc: '公务员行测', sl: '申论', sx: '大学数学', cet: '大学英语四六级' };
  const bankRows = Object.entries(rec.byBank || {}).map(([id, v]) => {
    const pb = u.banks.data.find(b => b.id === id);
    const name = pb ? pb.name : SYSTEM_BANKS[id] || (id === 'undefined' || !id ? '未知题库' : id);
    return { id, name, isPersonal: !!pb, total: v.total || 0, correct: v.correct || 0, wrong: v.wrong || 0 };
  }).sort((a, b) => b.total - a.total);
  /* 活跃天数与总用时估算（每答一题约 45 秒） */
  const activeDays = Object.keys(rec.byDay || {}).filter(k => (rec.byDay[k].total || 0) > 0).length;
  const todayOrders = orders.filter(o => dayKeyOf(o.createdAt) === dayKeyOf(Date.now())).length;
  return {
    ...u,
    record: { ...u.record, byBank: bankRows, wrongCount: Object.keys(rec.wrongSet || {}).length, activeDays },
    days,
    orders: orders.map(o => ({
      id: o.id, planId: o.planId, amount: o.amount, level: o.level, months: o.months,
      status: o.status, note: o.note, contact: o.contact, createdAt: o.createdAt, confirmedAt: o.confirmedAt, source: o.source
    })),
    todayOrders
  };
}
function adminDashboard() {
  const users = adminUsers();
  const orders = listOrders();
  const todayKey = dayKeyOf(Date.now());
  const now = Date.now();
  const vipUsers = users.filter(u => u.vip.level !== 'free' && u.vip.expireAt > now).length;
  const todayNew = users.filter(u => dayKeyOf(u.createdAt) === todayKey).length;
  const todayActive = users.filter(u => (u.record.todayTotal || 0) > 0).length;
  const todayQuestions = users.reduce((s, u) => s + (u.record.todayTotal || 0), 0);
  const totalQuestions = users.reduce((s, u) => s + (u.record.total || 0), 0);
  const todayOrders = orders.filter(o => dayKeyOf(o.createdAt) === todayKey).length;
  const ts = ticketStats();
  /* 实时在线监控：最近 5 分钟内活跃视为"在线"，1 小时内为"近期活跃" */
  const onlineUsers = users.filter(u => u.lastSeen && (now - u.lastSeen) < 5 * 60 * 1000);
  const active30 = users.filter(u => u.lastSeen && (now - u.lastSeen) < 30 * 60 * 1000);
  return {
    users: users.length, vipUsers, todayNew, todayActive, todayQuestions, totalQuestions,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
    totalOrders: orders.length, todayOrders,
    pendingTickets: ts.open + ts.pending + ts.replied, totalTickets: ts.total,
    revenue: orders.filter(o => o.status === 'confirmed').reduce((s, o) => s + (o.amount || 0), 0),
    onlineUsers: onlineUsers.length,
    onlineList: onlineUsers.map(u => ({ username: u.username, nickname: u.nickname, lastSeen: u.lastSeen, vip: u.vip })).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 50),
    active30: active30.length
  };
}
function safeJson(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

module.exports = {
  upsertUser, getUser, getUserPublic, hashPw, verifyPw, upgradePassword, checkPasswordStrength,
  getConfig, setConfig, getAdminPassword, setAdminPassword, verifyAdminPassword,
  createAdminSession, verifyAdminSession, killAdminSession, killAllAdminSessions,
  createUserSession, verifyUserSession, killUserSession, killUserSessions,
  getFlags, addSuspicious, setDisabled,
  addLog, listLogs,
  getRecord, upsertRecord, mergeRecord, getStreak, upsertStreak, mergeStreak,
  processAnswers, heartbeatData, touchUserSeen,
  addOrder, getOrderById, getOrders, getOrderByNote, listOrders, confirmOrder, rejectOrder, activateVip, grantVipByAdmin,
  generateRedeemCodes, listRedeemCodes, redeemCode,
  getPersonalBanks, upsertPersonalBanks,
  createTicket, getUserTickets, getTicketById, listTickets, replyTicket, closeTicket, ticketStats,
  getMaterialDownloads, addMaterialDownload, materialDownloadCount, materialQuota,
  stats, adminUsers, adminUserDetail, adminDashboard, DB_FILE
};
