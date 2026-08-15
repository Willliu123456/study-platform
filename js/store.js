/* ============ 学升·数据层（真实后端 + localStorage 双通道） ============ */
const Store = (() => {
  const K_USERS = 'xs_users';
  const K_SESSION = 'xs_session';
  const K_RECORDS = 'xs_records';
  const K_STREAK = 'xs_streak';
  const K_AQUEUE = 'xs_aqueue';   // 答题事件上报队列（服务端权威记录）
  const K_BANNED = 'xs_banned';   // 本地封禁状态（服务端心跳/上报下发）

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------- 云同步（真实后端数据库） ---------- */
  let remoteReady = false;
  async function detectRemote() {
    try { remoteReady = await window.API.ping(); }
    catch (e) { remoteReady = false; }
    return remoteReady;
  }
  function snapshot(username) {
    const users = getUsers();
    const u = users[username];
    if (!u) return null;
    return {
      user: u,
      record: getRecords()[username] || null,
      streak: read(K_STREAK, {})[username] || null,
      personalBanks: getPersonalBanksFor(username) || null
    };
  }
  async function pushRemote(username) {
    if (!remoteReady || !username) return false;
    try { await window.API.pushUser(username, snapshot(username)); return true; }
    catch (e) { return false; }
  }
  async function pullRemote(username) {
    if (!remoteReady || !username) return false;
    try {
      const d = await window.API.pullUser(username);
      if (!d) return false;
      if (d.user) {
        const users = getUsers();
        users[username] = { ...(users[username] || {}), ...d.user };
        write(K_USERS, users);
      }
      if (d.record) {
        const rec = getRecords();
        rec[username] = d.record;
        write(K_RECORDS, rec);
      }
      if (d.streak) {
        const st = read(K_STREAK, {});
        st[username] = d.streak;
        write(K_STREAK, st);
      }
      if (d.personalBanks) {
        savePersonalBanksFor(username, d.personalBanks);
      }
      return true;
    } catch (e) { return false; }
  }
  function syncNow() {
    const s = getSession();
    if (s) pushRemote(s);
  }

  /* ---------- 实时同步：答题事件上报（服务端权威）+ 心跳 ---------- */
  let flushTimer = null;
  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushAnswers, 1500);
  }
  /* 答题事件入队：每次答题本地记录后，同步入队待上报 */
  function enqueueAnswer(qid, correct, dt) {
    const s = getSession();
    if (!s) return;
    const all = read(K_AQUEUE, {});
    all[s] = all[s] || [];
    all[s].push({ qid, correct: !!correct, dt: Math.max(0, Math.floor(dt || 0)), ts: Date.now() });
    if (all[s].length > 500) all[s].splice(0, all[s].length - 500);
    write(K_AQUEUE, all);
    scheduleFlush();
  }
  /* 上报队列：服务端校验后返回权威记录/额度/风控，本地以其为准 */
  async function flushAnswers() {
    const s = getSession();
    if (!s || !remoteReady || !(window.API && window.API.getToken && window.API.getToken())) return;
    const all = read(K_AQUEUE, {});
    const q = all[s];
    if (!q || !q.length) return;
    try {
      const r = await window.API.postAnswers(s, q);
      const all2 = read(K_AQUEUE, {});
      all2[s] = [];
      write(K_AQUEUE, all2);
      if (r && r.record) {
        const rec = getRecords();
        rec[s] = r.record;
        write(K_RECORDS, rec);
      }
      if (r && r.quota) {
        const users = getUsers();
        const u = users[s];
        if (u) { u.dailyQuota = { date: r.quota.date, used: r.quota.used }; users[s] = u; write(K_USERS, users); }
      }
      if (r && r.flags && r.flags.disabled) markBanned(r.flags.reason);
    } catch (e) {
      if (e && String(e.message).includes('封禁')) markBanned();
    }
  }
  function markBanned(reason) {
    const s = getSession();
    if (!s) return;
    const b = read(K_BANNED, {});
    b.user = s; b.reason = reason || ''; b.at = Date.now();
    write(K_BANNED, b);
  }
  function clearBanned() {
    const s = getSession();
    if (!s) return;
    const b = read(K_BANNED, {});
    if (b.user === s) { delete b.user; write(K_BANNED, b); }
  }
  function isBanned() {
    const s = getSession();
    if (!s) return false;
    const b = read(K_BANNED, {});
    return b.user === s;
  }
  /* 断线检测：心跳连续失败 N 次视为断线，触发全局离线事件（前端强制拦截） */
  let _hbFail = 0;
  function offline() { try { window.dispatchEvent(new CustomEvent('xs-offline')); } catch (e) { /* ignore */ } }
  /* 心跳：向服务端拉取权威的会员/额度/风控状态并应用到本地 */
  async function heartbeatNow() {
    const s = getSession();
    if (!s || !remoteReady || !(window.API && window.API.getToken && window.API.getToken())) return;
    try {
      const r = await window.API.heartbeat(s);
      if (!r) throw new Error('empty');
      _hbFail = 0;
      if (r.user) {
        const users = getUsers();
        const u = users[s];
        if (u) {
          u.vip = r.user.vip;
          u.dailyQuota = r.user.dailyQuota;
          users[s] = u;
          write(K_USERS, users);
        }
      }
      if (r.flags && r.flags.disabled) markBanned(r.flags.reason);
      else clearBanned();
    } catch (e) {
      /* 网络异常：连续 3 次失败（约 45 秒）判定断线，通知前端强制拦截 */
      if (++_hbFail >= 3) { _hbFail = 0; offline(); }
    }
  }
  /* 启动心跳定时任务：每 15 秒同步一次（登录/连接云端后调用），
     服务端据此实时记录用户在线状态，供管理后台监控 */
  function startHeartbeat() {
    if (window._xsHbTimer) clearInterval(window._xsHbTimer);
    heartbeatNow();
    window._xsHbTimer = setInterval(() => { heartbeatNow(); flushAnswers(); }, 15000);
  }

  /* ---------- 用户 ---------- */
  function getUsers() { return read(K_USERS, {}); }
  function register(username, password, role, nickname) {
    const users = getUsers();
    if (users[username]) return { ok: false, msg: '该账号已注册，请直接登录' };
    if (password.length < 4) return { ok: false, msg: '密码至少 4 位' };
    const now = Date.now();
    users[username] = {
      username, password, role, nickname: nickname || username,
      createdAt: now,
      vip: { level: 'free', expireAt: 0 },
      dailyQuota: { date: dayKey(now), used: 0 },
      plan: null,
      coins: 0
    };
    write(K_USERS, users);
    return { ok: true };
  }
  function login(username, password) {
    const users = getUsers();
    const u = users[username];
    if (!u || u.password !== password) return { ok: false, msg: '账号或密码错误' };
    setSession(username);
    return { ok: true };
  }
  function registerRemote(username, password, role, nickname) {
    return window.API.register({ username, password, role, nickname });
  }
  async function loginRemote(username, password) {
    const d = await window.API.login({ username, password });
    // 服务端返回封禁状态 → 本地立即标记（展示封禁页）
    if (d && d.flags && d.flags.disabled) markBanned(d.flags.reason);
    return d;
  }
  function getSession() { return read(K_SESSION, null); }
  function setSession(username) { write(K_SESSION, username); }
  async function logout() {
    const s = getSession();
    write(K_SESSION, null);
    try {
      if (window.API && window.API.getToken && window.API.getToken() && s && window.API.logout) {
        await window.API.logout(s); /* 安全修复（第四轮）：销毁服务端会话 */
      } else if (window.API && window.API.setToken) {
        window.API.setToken('');
      }
    } catch (e) {
      try { if (window.API && window.API.setToken) window.API.setToken(''); } catch (e2) {}
    }
  }
  function getUser() {
    const s = getSession();
    if (!s) return null;
    return getUsers()[s] || null;
  }
  function updateUser(patch) {
    const s = getSession();
    if (!s) return null;
    const users = getUsers();
    users[s] = { ...users[s], ...patch };
    write(K_USERS, users);
    return users[s];
  }

  /* ---------- 学习记录 ---------- */
  function getRecords() { return read(K_RECORDS, {}); }
  function recordAnswer(qid, correct, dt) {
    const s = getSession();
    if (!s) return;
    const rec = getRecords();
    rec[s] = rec[s] || { total: 0, correct: 0, wrong: 0, byDay: {}, byBank: {}, wrongSet: {} };
    const r = rec[s];
    r.total++;
    if (correct) r.correct++; else r.wrong++;
    const dk = dayKey(Date.now());
    r.byDay[dk] = r.byDay[dk] || { total: 0, correct: 0 };
    r.byDay[dk].total++;
    if (correct) r.byDay[dk].correct++;
    const q = questionById(qid);
    if (q) {
      const b = q.bank;
      r.byBank[b] = r.byBank[b] || { total: 0, correct: 0, wrong: 0 };
      r.byBank[b].total++;
      if (correct) r.byBank[b].correct++; else r.byBank[b].wrong++;
    }
    // 答错自动收录错题本（去重计数）
    if (!correct) r.wrongSet[qid] = { qid, bank: q.bank, kp: q.kp, wrongCount: (r.wrongSet[qid]?.wrongCount || 0) + 1, lastAt: Date.now() };
    write(K_RECORDS, rec);
    // 自动扣减每日额度
    useQuota(1);
    touchStreak();
    // 答题事件上报（服务端权威校验 + 风控），离线时积累入队
    enqueueAnswer(qid, correct, dt || 0);
    // 同步到真实后端
    syncNow();
  }
  function getMyRecord() {
    const s = getSession();
    if (!s) return null;
    return getRecords()[s] || null;
  }
  function addWrong(qid) {
    const s = getSession();
    if (!s) return;
    const rec = getRecords();
    rec[s] = rec[s] || { total: 0, correct: 0, wrong: 0, byDay: {}, byBank: {}, wrongSet: {} };
    const q = questionById(qid);
    if (q) {
      rec[s].wrongSet[qid] = { qid, bank: q.bank, kp: q.kp, wrongCount: (rec[s].wrongSet[qid]?.wrongCount || 0) + 1, lastAt: Date.now() };
      write(K_RECORDS, rec);
    }
  }
  function removeWrong(qid) {
    const s = getSession();
    if (!s) return;
    const rec = getRecords();
    if (rec[s]?.wrongSet) { delete rec[s].wrongSet[qid]; write(K_RECORDS, rec); }
    syncNow();
  }
  function getWrongList() {
    const r = getMyRecord();
    if (!r) return [];
    return Object.values(r.wrongSet || {}).sort((a, b) => b.lastAt - a.lastAt);
  }

  /* ---------- 收藏 / 标记疑难（本地保存，按用户隔离） ---------- */
  const K_MARKS = 'xs_marks';
  function getMarksAll() { return read(K_MARKS, {}); }
  function getMyMarks() {
    const s = getSession();
    if (!s) return { favs: {}, flags: {} };
    const m = getMarksAll()[s];
    return (m && m.favs && m.flags) ? m : { favs: {}, flags: {} };
  }
  function setMyMarks(m) {
    const s = getSession();
    if (!s) return;
    const all = getMarksAll();
    all[s] = m;
    write(K_MARKS, all);
  }
  function toggleFav(qid) {
    const m = getMyMarks();
    if (m.favs[qid]) delete m.favs[qid]; else m.favs[qid] = { at: Date.now() };
    setMyMarks(m);
    return !!m.favs[qid];
  }
  function isFav(qid) { return !!getMyMarks().favs[qid]; }
  function toggleFlag(qid) {
    const m = getMyMarks();
    if (m.flags[qid]) delete m.flags[qid]; else m.flags[qid] = { at: Date.now() };
    setMyMarks(m);
    return !!m.flags[qid];
  }
  function isFlagged(qid) { return !!getMyMarks().flags[qid]; }
  function getFavList() { return Object.keys(getMyMarks().favs); }
  function getFlagList() { return Object.keys(getMyMarks().flags); }

  /* ---------- 连续打卡 ---------- */
  function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function touchStreak() {
    const s = getSession();
    if (!s) return;
    const st = read(K_STREAK, {});
    const t = st[s] || { count: 0, last: '' };
    const today = dayKey(Date.now());
    const yest = dayKey(Date.now() - 86400000);
    if (t.last === today) { /* 已打卡 */ }
    else if (t.last === yest) { t.count++; }
    else { t.count = 1; }
    t.last = today;
    st[s] = t;
    write(K_STREAK, st);
  }
  function getStreak() {
    const s = getSession();
    if (!s) return 0;
    const st = read(K_STREAK, {});
    const t = st[s];
    if (!t) return 0;
    const today = dayKey(Date.now());
    const yest = dayKey(Date.now() - 86400000);
    if (t.last === today || t.last === yest) return t.count;
    return 0;
  }

  /* ---------- 每日额度 & VIP ---------- */
  function getQuota() {
    const u = getUser();
    if (!u) return { used: 0, limit: 0 };
    const today = dayKey(Date.now());
    if (u.dailyQuota?.date !== today) {
      updateUser({ dailyQuota: { date: today, used: 0 } });
      return { used: 0, limit: isVip(u) ? 9999 : 50 };
    }
    return { used: u.dailyQuota.used, limit: isVip(u) ? 9999 : 50 };
  }
  function useQuota(n = 1) {
    const u = getUser();
    if (!u) return;
    const today = dayKey(Date.now());
    const used = (u.dailyQuota?.date === today ? u.dailyQuota.used : 0) + n;
    updateUser({ dailyQuota: { date: today, used } });
  }
  function isVip(u = getUser()) { return !!u && u.vip?.level !== 'free' && (u.vip?.expireAt || 0) > Date.now(); }
  function vipLevel(u = getUser()) {
    if (!u) return 'free';
    return isVip(u) ? u.vip.level : 'free';
  }
  function activateVip(level, months) {
    const u = getUser();
    if (!u) return null;
    const now = Date.now();
    const base = isVip(u) ? (u.vip.expireAt || now) : now;
    const expireAt = base + months * 30 * 86400000;
    updateUser({ vip: { level, expireAt } });
    const nu = getUser();
    // 订单记录统一由「付款提交 / 管理员核验」流程产生，
    // 这里只做本地会员生效 + 同步用户资料，避免产生虚假「待核对」订单。
    syncNow();
    return nu;
  }
  function canUse(feature) {
    const u = getUser();
    if (!u) return false;
    if (!isVip(u)) return false;
    const lv = u.vip.level; // vip1 | vip2 | vip3
    const order = { vip1: 1, vip2: 2, vip3: 3 };
    const need = { vip1: 1, vip2: 2, vip3: 3 };
    return order[lv] >= (need[feature] || 1);
  }

  /* ---------- 个人题库（本地 + 云端备份） ---------- */
  const K_PBANKS = 'xs_pbanks';
  function getPersonalBanksFor(username) {
    const all = read(K_PBANKS, {});
    return username ? (Array.isArray(all[username]) ? all[username] : []) : [];
  }
  function getPersonalBanks() { return getPersonalBanksFor(getSession()); }
  function getPersonalBank(id) { return getPersonalBanks().find(b => b.id === id) || null; }
  function savePersonalBanksFor(username, list) {
    if (!username) return false;
    const all = read(K_PBANKS, {});
    all[username] = Array.isArray(list) ? list : [];
    write(K_PBANKS, all);
    return true;
  }
  function savePersonalBanks(list) {
    if (!savePersonalBanksFor(getSession(), list)) return false;
    pushPersonalRemote();
    return true;
  }
  /* 配额：普通 3 个 / vip1 10 个 / vip2 50 个 / vip3 100 个 */
  function getPersonalBankLimit(level) {
    const lv = level || vipLevel();
    return { free: 3, vip1: 10, vip2: 50, vip3: 100 }[lv] ?? 3;
  }
  function getPersonalBankQuota() {
    return { used: getPersonalBanks().length, limit: getPersonalBankLimit() };
  }
  function addPersonalBank(bank) {
    if (!bank || !bank.id || !Array.isArray(bank.questions)) return { ok: false, msg: '题库数据无效' };
    const list = getPersonalBanks();
    if (list.some(b => b.id === bank.id)) return { ok: false, msg: '该题库已存在' };
    const quota = getPersonalBankQuota();
    if (list.length >= quota.limit) return { ok: false, msg: `个人题库数量已达上限（${quota.limit}个），升级会员可扩容` };
    list.push(bank);
    savePersonalBanks(list);
    return { ok: true, bank };
  }
  function removePersonalBank(id) {
    savePersonalBanks(getPersonalBanks().filter(b => b.id !== id));
    return true;
  }
  function pushPersonalRemote() {
    const s = getSession();
    if (!s || !remoteReady) return;
    window.API.putPersonalBanks(s, getPersonalBanks()).catch(() => {});
  }

  return { register, login, logout, getUser, updateUser, getSession,
    recordAnswer, getMyRecord, addWrong, removeWrong, getWrongList,
    getStreak, getQuota, useQuota, isVip, vipLevel, activateVip, canUse,
    registerRemote, loginRemote, detectRemote, pullRemote, pushRemote, syncNow,
    getRemoteReady: () => remoteReady,
    flushAnswers, heartbeatNow, startHeartbeat, isBanned,
    getPersonalBanks, getPersonalBank, addPersonalBank, removePersonalBank,
    getPersonalBankLimit, getPersonalBankQuota,
    toggleFav, isFav, toggleFlag, isFlagged, getFavList, getFlagList };
})();
