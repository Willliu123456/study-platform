/* ============ 学升·后端 API 客户端（真实数据库同步层） ============ */
/* 若后端不可达（纯静态/离线），自动回退本地 localStorage。 */
window.API = (() => {
  const KEY = 'xs_api_base';
  const KEY_TOKEN = 'xs_user_token';
  let base = '';
  let token = '';
  /* 安全修复：token 改存 sessionStorage（关闭标签页即失效），并清理 localStorage 中的历史 token */
  try { base = localStorage.getItem(KEY) || ''; } catch (e) { base = ''; }
  try {
    token = sessionStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_TOKEN) || '';
    if (localStorage.getItem(KEY_TOKEN)) localStorage.removeItem(KEY_TOKEN);
  } catch (e) { token = ''; }

  function setBase(url) {
    base = (url || '').replace(/\/+$/, '');
    try { if (base) localStorage.setItem(KEY, base); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function getBase() { return base; }
  function setToken(t) {
    token = t || '';
    try { if (token) sessionStorage.setItem(KEY_TOKEN, token); else sessionStorage.removeItem(KEY_TOKEN); } catch (e) {}
  }
  function getToken() { return token; }

  function headers(extra) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['x-user-token'] = token;
    return { ...h, ...(extra || {}) };
  }

  async function call(method, path, body) {
    // base 为空时走同源 /api（与 ping 一致），此时页面由后端静态托管
    const r = await fetch((base || '') + path, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.msg || '请求失败');
    return j.data;
  }

  /* 后端健康检查（自动探测，位于同源 /api） */
  async function ping() {
    try {
      const r = await fetch((base || '') + '/api/health', { method: 'GET' });
      if (!r.ok) return false;
      const j = await r.json();
      return !!j.ok;
    } catch (e) { return false; }
  }

  /* 登录 / 注册：成功即下发并保存会话 token */
  async function login(u) {
    const r = await fetch((base || '') + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u)
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.msg || '登录失败');
    if (j.data && j.data.token) setToken(j.data.token);
    return j.data;
  }
  async function register(u) {
    const r = await fetch((base || '') + '/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u)
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.msg || '注册失败');
    if (j.data && j.data.token) setToken(j.data.token);
    return j.data;
  }

  /* ---------- 业务接口 ---------- */
  const getUser = (name) => call('GET', '/api/user/' + encodeURIComponent(name));
  const putUser = (name, user) => call('PUT', '/api/user/' + encodeURIComponent(name), { user });
  const getRecord = (name) => call('GET', '/api/record/' + encodeURIComponent(name));
  const putRecord = (name, record) => call('PUT', '/api/record/' + encodeURIComponent(name), { record });
  const getStreak = (name) => call('GET', '/api/streak/' + encodeURIComponent(name));
  const putStreak = (name, streak) => call('PUT', '/api/streak/' + encodeURIComponent(name), { streak });
  const addOrder = (name, order) => call('POST', '/api/order/' + encodeURIComponent(name), { order });
  const getOrders = (name) => call('GET', '/api/orders/' + encodeURIComponent(name));
  /* 客服工单：用户提交 / 查询本人工单 */
  const createTicket = (name, ticket) => call('POST', '/api/contact/' + encodeURIComponent(name), { subject: ticket.subject, content: ticket.content });
  const getTickets = (name) => call('GET', '/api/contact/' + encodeURIComponent(name));
  const wxpayStatus = () => call('GET', '/api/wxpay/status');
  const wxpayCreateOrder = (name, planId) => call('POST', '/api/wxpay/order', { user: name, planId });
  const redeem = (name, code) => call('POST', '/api/redeem', { username: name, code });
  const getStats = () => call('GET', '/api/stats');
  const getPersonalBanks = (name) => call('GET', '/api/personal-banks/' + encodeURIComponent(name));
  const putPersonalBanks = (name, banks) => call('PUT', '/api/personal-banks/' + encodeURIComponent(name), { banks });
  /* 答题事件批量上报 / 心跳（实时同步服务端权威状态） */
  const postAnswers = (name, events) => call('POST', '/api/answers', { username: name, events });
  const heartbeat = (name) => call('POST', '/api/heartbeat', { username: name });
  /* 安全修复（第四轮）：登出必须销毁服务端会话，防止 token 泄露后无法撤销 */
  async function logout(name) {
    const r = await fetch((base || '') + '/api/logout', {
      method: 'POST', headers: headers(), body: JSON.stringify({ username: name })
    });
    setToken(''); /* 无论服务端结果如何，本地 token 立即清除 */
    try { await r.json(); } catch (e) { /* ignore */ }
  }
  /* 资料中心：清单 / 解锁下载 / 文件拉取（带 token，返回 arrayBuffer） */
  const getMaterials = (name) => call('GET', '/api/materials/' + encodeURIComponent(name));
  const unlockMaterial = (name, itemId) => call('POST', '/api/materials/unlock', { username: name, itemId });
  async function fetchMaterialFile(name, itemId) {
    const r = await fetch((base || '') + '/api/materials/file?u=' + encodeURIComponent(name) + '&id=' + encodeURIComponent(itemId), {
      method: 'GET', headers: { 'x-user-token': token }
    });
    if (!r.ok) {
      let j = {};
      try { j = await r.json(); } catch (e) { j = {}; }
      const err = new Error(j.msg || '文件获取失败(' + r.status + ')');
      err.status = r.status;
      throw err;
    }
    return await r.arrayBuffer();
  }

  /* ---------- 管理员接口（口令登录 → 会话 token；失败/过期抛 401 由页面处理） ---------- */
  async function adminFetch(method, path, body, adminToken) {
    const r = await fetch((base || '') + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: body ? JSON.stringify(body) : undefined
    });
    let j = {};
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok || !j.ok) {
      const err = new Error(j.msg || ('请求失败(' + r.status + ')'));
      err.status = r.status;
      throw err;
    }
    return j.data;
  }
  const adminLogin = (password) => adminFetch('POST', '/api/admin/login', { password }, '');
  const adminLogout = (adminToken) => adminFetch('POST', '/api/admin/logout', {}, adminToken);
  const adminChangePassword = (old, next, adminToken) => adminFetch('POST', '/api/admin/password', { old, next }, adminToken);
  const adminGrant = (username, level, months, adminToken) => adminFetch('POST', '/api/admin/grant', { username, level, months }, adminToken);
  const adminLogs = (limit, adminToken) => adminFetch('GET', '/api/admin/logs?limit=' + (limit || 100), null, adminToken);
  const adminExport = (adminToken) => adminFetch('GET', '/api/admin/export', null, adminToken);
  const adminListOrders = (status, adminToken) => adminFetch('GET', '/api/admin/orders?status=' + encodeURIComponent(status || ''), null, adminToken);
  const adminConfirm = (id, adminToken) => adminFetch('POST', '/api/admin/confirm', { id }, adminToken);
  const adminReject = (id, adminToken) => adminFetch('POST', '/api/admin/reject', { id }, adminToken);
  const adminDashboard = (adminToken) => adminFetch('GET', '/api/admin/dashboard', null, adminToken);
  const adminUsers = (adminToken) => adminFetch('GET', '/api/admin/users', null, adminToken);
  const adminRedeemList = (limit, adminToken) => adminFetch('GET', '/api/admin/redeem/list?limit=' + (limit || 200), null, adminToken);
  const adminRedeemGenerate = (level, months, count, adminToken) => adminFetch('POST', '/api/admin/redeem/generate', { level, months, count }, adminToken);
  const adminBan = (username, disabled, reason, adminToken) => adminFetch('POST', '/api/admin/ban', { username, disabled, reason }, adminToken);

  /* 全量上传当前用户数据到后端（合并策略：服务端权威 + 只增不减） */
  async function pushUser(username, snapshot) {
    if (!username || !snapshot) return;
    if (snapshot.user) await putUser(username, snapshot.user);
    if (snapshot.record) await putRecord(username, snapshot.record);
    if (snapshot.streak) await putStreak(username, snapshot.streak);
    if (snapshot.personalBanks) await putPersonalBanks(username, snapshot.personalBanks);
  }

  /* 从后端拉取当前用户数据 */
  async function pullUser(username) {
    if (!username) return null;
    try {
      const [u, r, s, pb] = await Promise.all([
        getUser(username), getRecord(username), getStreak(username), getPersonalBanks(username)
      ]);
      return { user: u, record: r, streak: s, personalBanks: pb };
    } catch (e) { return null; }
  }

  return {
    setBase, getBase, setToken, getToken, ping, login, register, getUser, putUser,
    getRecord, putRecord, getStreak, putStreak, addOrder, getOrders, getStats,
    createTicket, getTickets,
    wxpayStatus, wxpayCreateOrder, redeem,
    postAnswers, heartbeat, logout,
    getPersonalBanks, putPersonalBanks,
    getMaterials, unlockMaterial, fetchMaterialFile,
    adminLogin, adminLogout, adminChangePassword, adminGrant, adminLogs, adminExport,
    adminListOrders, adminConfirm, adminReject, adminDashboard, adminUsers,
    adminRedeemList, adminRedeemGenerate, adminBan,
    pushUser, pullUser
  };
})();
