/* ============ 学升·智能刷题平台 主应用 ============ */
(() => {
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast-wrap');

  /* ---------- 工具 ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => `¥${n}`;

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $toast.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2200);
  }

  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const colorMap = { '#EF4444': 'linear-gradient(135deg,#EF4444,#EE9B62)', '#688DDF': 'linear-gradient(135deg,#688DDF,#688DDF)', '#6371C8': 'linear-gradient(135deg,#6371C8,#EE9B62)', '#E8B54D': 'linear-gradient(135deg,#E8B54D,#EE9B62)', '#10B981': 'linear-gradient(135deg,#10B981,#688DDF)', '#EE9B62': 'linear-gradient(135deg,#EE9B62,#E8B54D)', '#688DDF': 'linear-gradient(135deg,#688DDF,#6371C8)' };

  /* ---------- 状态 ---------- */
  let route = 'home';
  let quiz = null;      // 刷题会话
  let exam = null;      // 模拟考试会话
  let importState = null; // 个人题库导入预览状态
  let quizSheetOpen = false;   // 刷题页答题卡是否展开（默认收起）
  let examSheetOpen = false;   // 考试页答题卡是否展开（默认收起）
  let materialsState = null;   // 资料中心数据（manifest + 解锁状态）
  const matFilter = { group: '', year: '', type: '' }; // 资料中心筛选

  /* ---------- 路由 ---------- */
  const navStack = []; // 页面访问历史栈，用于"返回上一页"
  function navigate(path) {
    const cur = route.split('?')[0];
    const next = path.split('?')[0];
    if (cur !== next) navStack.push(cur); // 记录离开前的页面
    if (navStack.length > 40) navStack.shift(); // 防止栈无限增长
    route = path;
    render();
    window.scrollTo(0, 0);
  }
  /* 返回上一页；若上一页是已结束的刷题/考试会话则继续往前找 */
  function back() {
    let prev = navStack.pop();
    while (prev) {
      if (prev.startsWith('quiz/')) { if (quiz) break; }
      else if (prev.startsWith('exam/run')) { if (exam) break; }
      else break;
      prev = navStack.pop();
    }
    if (!prev) prev = 'home';
    route = prev;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- 顶层渲染 ---------- */
  function render() {
    try {
      const u = Store.getUser();
      if (!u) { renderAuth(); return; }
      if (Store.isBanned()) {
        renderShell();
        const page = document.getElementById('page-root');
        page.innerHTML = renderBanned();
        bindPage();
        return;
      }
      if (route.startsWith('quiz/')) renderQuiz();
    else if (route.startsWith('exam/run')) renderExamRun();
    else if (route === 'examResult') renderResultOnly();
    else if (route.startsWith('trainkp/')) {
      renderShell();
      const page = document.getElementById('page-root');
      page.innerHTML = renderTrainKp(u);
      bindPage();
    } else {
      renderShell();
      const page = document.getElementById('page-root');
      switch (route.split('?')[0]) {
        case 'home': page.innerHTML = renderHome(u); break;
        case 'practice': page.innerHTML = renderPractice(u); break;
        case 'train': page.innerHTML = renderTrain(u); break;
        case 'exam': page.innerHTML = renderExam(u); break;
        case 'wrong': page.innerHTML = renderWrong(u); break;
        case 'vip': page.innerHTML = renderVip(u); break;
        case 'stats': page.innerHTML = renderStats(u); break;
        case 'profile': page.innerHTML = renderProfile(u); break;
        case 'mybanks': page.innerHTML = renderMyBanks(u); break;
        case 'import': page.innerHTML = renderImport(u); break;
        case 'orders': page.innerHTML = renderOrders(u); loadOrdersPage(u); break;
        case 'contact': page.innerHTML = renderContact(u); loadContactPage(u); break;
        case 'materials': page.innerHTML = renderMaterials(u); loadMaterialsPage(u); break;
        case 'favs': page.innerHTML = renderFavs(u); break;
        case 'flags': page.innerHTML = renderFlags(u); break;
        case 'policy': renderInlinePage(page, 'privacy.html', '隐私政策'); break;
        case 'agreement': renderInlinePage(page, 'agreement.html', '用户协议'); break;
        default: page.innerHTML = renderHome(u);
      }
      bindPage();
    }
    } catch (err) {
      console.error('[render] 渲染失败:', err);
      $app.innerHTML = `<div style="padding:40px;color:#fff;text-align:center">页面渲染出错：${esc(err.message)}<br><br><button class="btn" onclick="location.reload()">刷新重试</button></div>`;
    }
  }

  /* ---------- 内嵌页面（隐私政策/用户协议） ----------
     拉取静态 HTML 后注入到应用内页面，顶部带"返回"按钮，
     替代之前的 window.open 新标签（用户能直接关闭新标签绕过） */
  async function renderInlinePage(page, file, title) {
    page.innerHTML = '<div style="max-width:780px;margin:0 auto;padding:16px"><div class="card page-anim" style="padding:0;overflow:hidden"><div class="card-head" style="padding:14px 18px;border-bottom:1px solid #E2E8F0"><h3 style="font-size:15px">' + esc(title) + '</h3><button class="btn btn-sm btn-ghost" data-action="back">' + window.ICONS.arrowLeft + ' 返回</button></div><div id="inline-page-content" style="padding:18px 24px;line-height:1.8;font-size:14px;color:#334155;max-height:70vh;overflow:auto"></div></div></div>';
    try {
      const r = await fetch('./' + file);
      const html = await r.text();
      const c = document.getElementById('inline-page-content');
      const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      c.innerHTML = m ? m[1] : html;
      const s = document.createElement('style');
      s.textContent = '#inline-page-content .back{display:none}#inline-page-content h1{font-size:22px;color:#0f172a;text-align:center;margin:0 0 8px}#inline-page-content .meta{text-align:center;color:#64748b;font-size:12px;margin-bottom:18px}#inline-page-content h2{font-size:16px;color:#1e293b;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid #f1f5f9}';
      c.appendChild(s);
      if (c.firstElementChild) c.firstElementChild.style.padding = '8px 0';
    } catch (e) {
      page.querySelector('#inline-page-content').innerHTML = '<div style="color:#ef4444">加载失败，请稍后重试</div>';
    }
    bindPage();
  }

  /* ---------- 账号封禁提示页（风控自动/管理员封禁） ---------- */
  function renderBanned() {
    return `
      <div class="container" style="max-width:560px">
        <div class="card page-anim" style="margin-top:24px;text-align:center;padding:46px 24px">
          <div style="width:84px;height:84px;margin:0 auto 18px;border-radius:24px;background:var(--danger-light);display:flex;align-items:center;justify-content:center">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h3 style="font-size:20px;margin-bottom:8px">账号已被封禁</h3>
          <p style="font-size:13.5px;color:var(--text-3);line-height:1.9">
            经平台风控检测，该账号存在<b style="color:var(--danger)">开挂或篡改数据</b>等异常行为，已暂停使用权限。<br>
            如系误判，请联系管理员核实后解封。
          </p>
          <div style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-ghost" data-action="logout">退出登录</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------- 登录/注册 ---------- */
  function renderAuth() {
    let mode = 'login';
    $app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card page-anim">
          <div class="auth-logo"><img src="./assets/logo.png" alt="学升" /></div>
          <div class="auth-title">学升·智能刷题</div>
          <div class="auth-sub">考研 · 考公 · 期末，一站式刷题提分</div>
          <div id="auth-body">${loginForm()}</div>
        </div>
      </div>`;
    $app.querySelector('#auth-body').addEventListener('submit', e => e.preventDefault());
    $app.querySelector('.auth-wrap').addEventListener('click', e => {
      const roleOpt = e.target.closest('[data-role]');
      if (roleOpt) {
        $app.querySelectorAll('[data-role]').forEach(x => x.classList.remove('active'));
        roleOpt.classList.add('active');
        const h = $app.querySelector('#auth-body input[name="role"]');
        if (h) h.value = roleOpt.dataset.role;
        return;
      }
      const link = e.target.closest('[data-auth]');
      if (!link) return;
      mode = link.dataset.auth;
      $app.querySelector('#auth-body').innerHTML = mode === 'login' ? loginForm() : registerForm();
    });
    $app.querySelector('.auth-wrap').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const username = (fd.get('username') || '').trim();
      const password = fd.get('password') || '';
      const remote = Store.getRemoteReady();
      if (mode === 'login') {
        let remoteOk = false;
        if (remote) {
          try {
            await Store.loginRemote(username, password);
            remoteOk = true;
            await Store.pullRemote(username);
            // 确保本地存在该用户（远程新账号）
            if (!Store.getUser()) {
              const u = await window.API.getUser(username).catch(() => null);
              if (u) Store.register(username, password, u.role, u.nickname);
            }
          } catch (err) { remoteOk = false; }
        }
        const r = Store.login(username, password);
        if (!r.ok && !remoteOk) return toast(r.msg, 'err');
        if (remoteOk) Store.startHeartbeat();
        toast('欢迎回来！', 'ok');
        render();
      } else {
        let remoteOk = false;
        if (remote) {
          try {
            await Store.registerRemote(username, password, fd.get('role') || 'student', fd.get('nickname') || username);
            remoteOk = true;
          } catch (err) { remoteOk = false; }
        }
        const r = Store.register(username, password, fd.get('role') || 'student', fd.get('nickname') || username);
        if (!r.ok && !remoteOk) return toast(r.msg, 'err');
        Store.login(username, password);
        if (remoteOk) Store.startHeartbeat();
        toast('注册成功，开始学习吧！', 'ok');
        render();
      }
    });
  }
  function loginForm() {
    return `
      <form>
        <div class="field"><label>账号</label><input name="username" placeholder="请输入手机号 / 用户名" required /></div>
        <div class="field"><label>密码</label><input name="password" type="password" placeholder="请输入密码" required /></div>
        <button class="btn btn-block btn-lg" type="submit">登 录</button>
      </form>
      <div class="auth-switch">还没有账号？<a data-auth="register">立即注册</a></div>`;
  }
  function registerForm() {
    return `
      <form>
        <div class="field">
          <label>我是</label>
          <div class="role-select">
            <div class="role-opt" data-role="kaoyan">考研人</div>
            <div class="role-opt" data-role="kaogong">考公人</div>
            <div class="role-opt active" data-role="student">在校生</div>
          </div>
          <input type="hidden" name="role" value="student" />
        </div>
        <div class="field"><label>昵称</label><input name="nickname" placeholder="给自己起个好听的名字" /></div>
        <div class="field"><label>账号</label><input name="username" placeholder="设置登录账号" required /></div>
        <div class="field"><label>密码</label><input name="password" type="password" placeholder="至少4位" required /></div>
        <label class="agree" style="display:flex;align-items:flex-start;gap:6px;font-size:12px;color:#6b7280;margin:10px 2px 4px;cursor:pointer">
          <input type="checkbox" name="agree" required style="margin-top:2px" />
          <span>我已阅读并同意 <a href="./agreement.html" target="_blank" rel="noopener">《用户协议》</a> 与 <a href="./privacy.html" target="_blank" rel="noopener">《隐私政策》</a></span>
        </label>
        <button class="btn btn-block btn-lg" type="submit">注册并登录</button>
      </form>
      <div class="auth-switch">已有账号？<a data-auth="login">去登录</a></div>`;
  }

  /* ---------- 外壳：顶栏 + 底部Tab ---------- */
  function renderShell() {
    const u = Store.getUser();
    const lv = Store.vipLevel(u);
    const rec = Store.getMyRecord();
    const wrongCount = rec ? Object.keys(rec.wrongSet || {}).length : 0;
    const activeRoute = route.split('?')[0];
    const tabs = [
      ['home', '首页', 'home'], ['practice', '刷题', 'practice'],
      ['materials', '资料中心', 'book'], ['profile', '个人中心', 'user']
    ];
    $app.innerHTML = `
      <header class="topbar ${navStack.length ? 'has-back' : ''}">
        <div class="topbar-inner">
          ${navStack.length ? `<button class="btn-back" data-action="back" title="返回上一页">${window.ICONS.arrowLeft}<span>返回</span></button>` : ''}
          <div class="brand" data-nav="home">
            <div class="brand-logo"><img src="./assets/logo.png" alt="学升" /></div>
            <div class="brand-name">学升·智能刷题</div>
          </div>
          <nav class="nav-links">
            ${tabs.map(([r, n]) => `<div class="nl-item ${activeRoute === r ? 'active' : ''}" data-nav="${r}">${n}</div>`).join('')}
          </nav>
          <div class="topbar-right">
            ${lv !== 'free'
              ? `<button class="btn btn-vip btn-sm" data-nav="vip" title="续费 / 升级会员">${window.ICONS.vip} ${vipName(lv)}</button>`
              : `<button class="btn btn-vip btn-sm" data-nav="vip">${window.ICONS.vip} 开通VIP</button>`}
            <button class="bell-btn" data-nav="wrong" title="${wrongCount} 题待巩固错题">${window.ICONS.bell}${wrongCount ? '<span class="bell-dot"></span>' : ''}</button>
            <div class="topbar-user" data-nav="profile">
              <div class="avatar">${esc((u.nickname || u.username || '?')[0])}</div>
            </div>
          </div>
        </div>
      </header>
      <div id="page-root" class="page"></div>
      <nav class="bottom-tab">
        ${tabs.map(([r, n, ic]) => `<div class="bottom-tab-item ${activeRoute === r ? 'active' : ''}" data-nav="${r}">${window.ICONS[ic]}<span>${n}</span></div>`).join('')}
      </nav>`;
    $app.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
    $app.querySelectorAll('.topbar-user').forEach(el => el.addEventListener('click', () => navigate('profile')));
    $app.querySelectorAll('[data-action="back"]').forEach(el => el.addEventListener('click', back));
  }

  function vipName(lv) { return { free: '普通用户', vip1: '黄金VIP', vip2: '铂金VIP', vip3: '钻石VIP' }[lv] || '普通用户'; }

  /* ---------- 首页（设计稿还原） ---------- */
  function renderHome(u) {
    const rec = Store.getMyRecord();
    const streak = Store.getStreak();
    const quota = Store.getQuota();
    const isVip = Store.isVip(u);
    const total = rec ? rec.total : 0;
    const correctRate = rec && rec.total ? Math.round(rec.correct / rec.total * 100) : 0;
    const wrongCount = rec ? Object.keys(rec.wrongSet || {}).length : 0;
    const pbCount = Store.getPersonalBanks().length;

    /* 系统题库卡片 */
    const catCards = QUESTION_BANKS.map(b => {
      const r = rec?.byBank?.[b.id];
      const done = r ? r.total : 0;
      const acc = r && r.total ? Math.round(r.correct / r.total * 100) : 0;
      const master = r && r.total ? Math.round(r.correct / b.questions.length * 100) : 0;
      const left = Math.max(0, b.questions.length - done);
      return `
        <div class="cat-card lift" data-nav="quiz" data-bank="${esc(b.id)}">
          <div class="cat-icon" style="background:${colorMap[b.color] || b.color}">${window.ICONS[b.icon] || window.ICONS.book}</div>
          <h3>${esc(b.name)}</h3>
          <div class="cat-desc">${esc(b.desc)}</div>
          <div class="cat-meta">
            <span class="cm-tag">${window.ICONS.book}<b>${b.questions.length}</b>题</span>
            <span class="cm-tag">${window.ICONS.target}<b>${acc}%</b>正确</span>
            <span class="cm-tag">${window.ICONS.practice}<b>${left}</b>待练</span>
          </div>
          <div class="cat-progress">
            <div class="cp-head"><span>掌握进度</span><b>${master}%</b></div>
            <div class="progress-bar"><i style="width:${master}%"></i></div>
          </div>
        </div>`;
    }).join('');

    /* 热门题库：前 3 个 */
    const hotBanks = QUESTION_BANKS.slice(0, 3).map(b => {
      const r = rec?.byBank?.[b.id];
      const master = r && r.total ? Math.round(r.correct / b.questions.length * 100) : 0;
      return `
        <div class="hot-bank" data-nav="quiz" data-bank="${esc(b.id)}">
          <div class="hb-top">
            <div class="hb-ico" style="background:${colorMap[b.color] || b.color}">${window.ICONS[b.icon] || window.ICONS.book}</div>
            <b>${esc(b.name)}</b>
          </div>
          <div class="hb-nums">
            <div><span>题目</span><b>${b.questions.length}</b></div>
            <div><span>已练</span><b>${r ? r.total : 0}</b></div>
            <div><span>掌握</span><b>${master}%</b></div>
          </div>
          <div class="hb-bar-row">
            <span>进度</span>
            <div class="progress-bar"><i style="width:${master}%"></i></div>
            <b>${master}%</b>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="container">
        <!-- 欢迎卡（白渐变 + 插画） -->
        <div class="welcome-card">
          <div class="welcome-left">
            <h1>你好，${esc(u.nickname || u.username)} 👋</h1>
            <p>把资料变成题库，把错题变成分数，连续打卡 ${streak} 天，每天进步一点点。</p>
            <div class="welcome-actions">
              <button class="btn btn-primary" data-nav="quiz" data-bank="random">${window.ICONS.practice} 开始刷题</button>
              <button class="btn btn-outline" data-nav="materials">${window.ICONS.book} 资料中心</button>
            </div>
          </div>
          <div class="welcome-illustration">
            <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="70" r="62" fill="#DFE5FA"/>
              <circle cx="100" cy="70" r="46" fill="#EEF1FB"/>
              <path d="M68 52h52v34c0 8-6 12-13 12H81c-7 0-13-4-13-12V52Z" fill="#2E489E"/>
              <path d="M80 52h40v30c0 6-4.5 9-10 9H80V52Z" fill="#4A63C8"/>
              <path d="M92 62h16M92 70h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
              <path d="M60 96c2.5-1.5 5.5-1.5 8 0s5.5 1.5 8 0" stroke="#A9B7E9" stroke-width="3" stroke-linecap="round"/>
              <path d="M124 96c2.5-1.5 5.5-1.5 8 0s5.5 1.5 8 0" stroke="#A9B7E9" stroke-width="3" stroke-linecap="round"/>
              <path d="M14 52c5-4 11-4 16 0M20 62c5-4 11-4 16 0" stroke="#C9D3F2" stroke-width="3" stroke-linecap="round"/>
              <path d="M166 60c5 4 11 4 16 0M160 70c5 4 11 4 16 0" stroke="#C9D3F2" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- 4 数据卡 -->
        <div class="welcome-stats">
          <div class="ws-card blue">
            <div class="ws-icon">${window.ICONS.practice}</div>
            <div class="ws-text"><span>累计刷题</span><b>${total}</b></div>
          </div>
          <div class="ws-card teal">
            <div class="ws-icon">${window.ICONS.target}</div>
            <div class="ws-text"><span>正确率</span><b>${correctRate}%</b></div>
          </div>
          <div class="ws-card orange">
            <div class="ws-icon">${window.ICONS.flame}</div>
            <div class="ws-text"><span>连续打卡</span><b>${streak} 天</b></div>
          </div>
          <div class="ws-card red">
            <div class="ws-icon">${window.ICONS.wrong}</div>
            <div class="ws-text"><span>待巩固错题</span><b>${wrongCount}</b></div>
          </div>
        </div>

        <!-- 免费 vs VIP 权益对比 -->
        <div class="rights-row">
          <div class="rights-card free">
            <div class="rc-head">
              <div class="rc-icon">${window.ICONS.user}</div>
              <b>免费版</b>
            </div>
            <ul class="rc-list">
              <li class="on">${window.ICONS.check}<span>每日 ${quota.limit === 9999 ? '不限量' : quota.limit + ' 题'} 刷题</span></li>
              <li class="on">${window.ICONS.check}<span>个人题库 ${Store.getPersonalBankLimit('free')} 个</span></li>
              <li class="off">${window.ICONS.close}<span>深度解析 · 学习报告</span></li>
              <li class="off">${window.ICONS.close}<span>模拟考试 · 导出打印</span></li>
            </ul>
            <button class="rc-btn free" data-nav="practice">继续免费学习</button>
          </div>
          <div class="rights-card vip">
            <div class="rc-head">
              <div class="rc-icon">${window.ICONS.vip}</div>
              <b>VIP 会员</b>
              <span class="rc-badge">热门</span>
            </div>
            <ul class="rc-list">
              <li class="on">${window.ICONS.check}<span>不限量刷题，额度 ∞</span></li>
              <li class="on">${window.ICONS.check}<span>个人题库 100 个 · 大文件批量导入</span></li>
              <li class="on">${window.ICONS.check}<span>深度解析 · 举一反三 · 学习报告</span></li>
              <li class="on">${window.ICONS.check}<span>模拟考试组卷 · 错题导出打印</span></li>
            </ul>
            <button class="rc-btn vip" data-nav="vip">${isVip ? '续费 / 升级' : '立即开通'}</button>
          </div>
        </div>

        <!-- 快速入口 5 宫格 -->
        <div class="section-title">快速开始 <span class="sub">选择你的训练方式</span></div>
        <div class="quick-menu">
          <div class="qm-item blue" data-nav="quiz" data-bank="random"><div class="qm-ico">${window.ICONS.practice}</div><b>随机组卷</b></div>
          <div class="qm-item orange" data-nav="train"><div class="qm-ico">${window.ICONS.target}</div><b>专项训练</b></div>
          <div class="qm-item purple" data-nav="exam"><div class="qm-ico">${window.ICONS.exam}</div><b>模拟考试</b><span class="qm-vip">VIP</span></div>
          <div class="qm-item red" data-nav="wrong"><div class="qm-ico">${window.ICONS.wrong}</div><b>错题本</b></div>
          <div class="qm-item green" data-nav="mybanks"><div class="qm-ico">${window.ICONS.book}</div><b>个人题库</b></div>
        </div>

        <!-- 热门题库 -->
        <div class="section-title">热门题库 <span class="sub">大家都在刷</span></div>
        <div class="hot-banks">${hotBanks}</div>

        <!-- 系统题库 -->
        <div class="section-title">系统题库 <span class="sub">官方题库 · 持续更新</span></div>
        <div class="cat-grid">${catCards}</div>

        <!-- 今日进度 -->
        <div class="section-title">今日进度 <span class="sub">${quota.used} / ${quota.limit === 9999 ? '∞' : quota.limit} 题</span></div>
        <div class="card">
          <div class="progress-bar" style="height:10px"><i style="width:${quota.limit === 9999 ? 100 : Math.min(100, quota.used / quota.limit * 100)}%"></i></div>
          ${quota.limit !== 9999 && quota.used >= quota.limit ? `<p style="margin-top:10px;font-size:13px;color:var(--warning)">今日免费额度已用完，<a data-nav="vip">开通会员</a>不限量刷题～</p>` : ''}
        </div>
      </div>`;
  }

  /* ---------- 刷题选择页 ---------- */
  function renderPractice(u) {
    const lv = Store.vipLevel(u);
    const pbs = Store.getPersonalBanks();
    const quota = Store.getPersonalBankQuota();
    const full = pbs.length >= quota.limit;
    const rec = Store.getMyRecord();
    const catCard = b => {
      const r = rec?.byBank?.[b.id];
      const done = r ? r.total : 0;
      const acc = r && r.total ? Math.round(r.correct / r.total * 100) : 0;
      const master = r && r.total ? Math.round(r.correct / b.questions.length * 100) : 0;
      const left = Math.max(0, b.questions.length - done);
      return `
        <div class="cat-card" data-nav="quiz" data-bank="${esc(b.id)}">
          <div class="cat-icon" style="background:${colorMap[b.color] || b.color}">${window.ICONS[b.icon] || window.ICONS.book}</div>
          <h3>${esc(b.name)}</h3>
          <div class="cat-desc">${esc(b.desc)}</div>
          <div class="cat-meta">
            <span class="cm-tag">${window.ICONS.book}<b>${b.questions.length}</b>题</span>
            <span class="cm-tag">${window.ICONS.target}<b>${acc}%</b>正确</span>
            <span class="cm-tag">${window.ICONS.practice}<b>${left}</b>待练</span>
          </div>
          <div class="cat-progress">
            <div class="cp-head"><span>掌握进度</span><b>${master}%</b></div>
            <div class="progress-bar"><i style="width:${master}%"></i></div>
          </div>
        </div>`;
    };
    /* 热门题库：带掌握进度的横排卡 */
    const hotCards = QUESTION_BANKS.slice(0, 4).map(b => {
      const r = rec?.byBank?.[b.id];
      const master = r && r.total ? Math.round(r.correct / b.questions.length * 100) : 0;
      return `
        <div class="hb-card" data-nav="quiz" data-bank="${esc(b.id)}">
          <div class="hb-icon" style="background:${colorMap[b.color] || b.color}">${window.ICONS[b.icon] || window.ICONS.book}</div>
          <div class="hb-main">
            <b>${esc(b.name)}</b>
            <div class="hb-meta"><span>${b.questions.length} 题</span><span>掌握 <b>${master}%</b></span></div>
            <div class="hb-progress"><div class="progress-bar"><i style="width:${master}%"></i></div></div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="container">
        <!-- 资料中心 / 导入 功能大卡 -->
        <div class="featured-links">
          <div class="fl-card" data-nav="materials">
            <div class="fl-icon" style="background:linear-gradient(135deg,#2E489E,#4A63C8)">${window.ICONS.book}</div>
            <div class="fl-main">
              <b>资料中心</b>
              <span>近20年真题 · 解析 · 听力 · 国考</span>
            </div>
            <div class="fl-arrow">${window.ICONS.arrowRight}</div>
          </div>
          <div class="fl-card" data-nav="import">
            <div class="fl-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.book}</div>
            <div class="fl-main">
              <b>导入我的资料</b>
              <span>Word / PDF / Excel 一键变题库</span>
            </div>
            <div class="fl-arrow">${window.ICONS.arrowRight}</div>
          </div>
        </div>

        <div class="section-title">快速开始 <span class="sub">选择你的训练方式</span></div>
        <div class="quick-grid">
          <div class="quick-card lift" data-nav="quiz" data-bank="random"><div class="q-icon" style="background:linear-gradient(135deg,#688DDF,#688DDF)">${window.ICONS.refresh}</div><b>随机组卷</b><span>全部科目随机</span></div>
          <div class="quick-card lift" data-nav="train"><div class="q-icon" style="background:linear-gradient(135deg,#6371C8,#EE9B62)">${window.ICONS.target}</div><b>专项训练</b><span>按知识点</span></div>
          <div class="quick-card lift" data-nav="exam"><div class="q-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.exam}</div><b>模拟考试</b><span>限时实战</span></div>
        </div>

        <div class="section-title">热门题库 <span class="sub">大家都在刷</span></div>
        <div class="hot-bank-row">${hotCards}</div>

        <div class="section-title">系统题库 <span class="sub">官方题库 · 持续更新</span></div>
        <div class="cat-grid">
          ${QUESTION_BANKS.map(catCard).join('')}
        </div>

        <div class="section-title">我的题库 <span class="sub">个人导入 · 已安装 ${pbs.length}/${quota.limit} 个</span></div>
        ${pbs.length ? `
        <div class="cat-grid">
          ${pbs.map(catCard).join('')}
        </div>` : `
        <div class="card" style="padding:24px 18px;text-align:center;margin-bottom:16px">
          <div style="font-size:36px">📂</div>
          <b style="display:block;margin:8px 0 4px">还没有个人题库</b>
          <p style="font-size:13px;color:var(--text-3);line-height:1.7">导入你自己的题目，会归类到这里。<br>支持 JSON / CSV / TXT / Markdown / Word / Excel / PDF。</p>
          <button class="btn btn-sm btn-gold" style="margin-top:10px" data-nav="import">＋ 导入题目</button>
        </div>`}
        <div style="text-align:center;margin-bottom:18px">
          <button class="btn btn-sm btn-outline" data-nav="import" ${full ? 'disabled' : ''}>${full ? '题库配额已满' : '＋ 导入新题库'}</button>
        </div>
      </div>`;
  }

  /* ---------- 训练页 ---------- */
  function renderTrain(u) {
    const lv = Store.vipLevel(u);
    const modes = TRAIN_MODES.map(m => {
      const locked = m.free === false && !Store.canUse(m.vip);
      return `
        <div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:16px;${locked ? 'opacity:.6' : ''}">
          <div class="q-icon" style="width:52px;height:52px;border-radius:14px;background:${m.color};display:flex;align-items:center;justify-content:center;color:#fff;flex:none">${window.ICONS[m.icon]}</div>
          <div style="flex:1">
            <b style="font-size:16px">${esc(m.name)} ${locked ? '<span class="badge badge-gold">VIP</span>' : ''}</b>
            <div style="font-size:13px;color:var(--text-3)">${esc(m.desc)}</div>
          </div>
          <button class="btn btn-sm ${locked ? 'btn-gold' : 'btn-outline'}" data-action="${locked ? 'unlock' : 'train'}" data-mode="${m.id}">${locked ? '解锁' : '开始'}</button>
        </div>`;
    }).join('');
    return `
      <div class="container">
        <div class="section-title">训练中心 <span class="sub">针对性提升</span></div>
        ${modes}
        <div class="section-title">知识点专项</div>
        <div class="card">
          <div class="chip-row">
            ${QUESTION_BANKS.map(b => `<button class="chip" data-nav="trainkp" data-bank="${esc(b.id)}">${esc(b.name)}</button>`).join('')}
            ${Store.getPersonalBanks().map(b => `<button class="chip chip-gold" data-nav="trainkp" data-bank="${esc(b.id)}">${esc(b.name)}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  /* ---------- 知识点专项选择 ---------- */
  function renderTrainKp(u) {
    const bankId = route.split('/')[1] || QUESTION_BANKS[0].id;
    const bank = bankById(bankId);
    if (!bank) return renderTrain(u);
    return `
      <div class="container">
        <div class="section-title">${esc(bank.name)} · 知识点专项</div>
        <div class="card">
          <div class="chip-row" style="flex-direction:column;align-items:stretch;gap:10px">
            ${bank.kps.map((kp, i) => `
              <button class="chip" style="text-align:left;padding:14px 18px;border-radius:12px;font-size:14px" data-action="startKp" data-bank="${esc(bank.id)}" data-kp="${esc(kp)}">${esc(kp)}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  /* ---------- 模拟考试页 ---------- */
  function renderExam(u) {
    const lv = Store.vipLevel(u);
    const rec = Store.getMyRecord();
    const papers = EXAM_PAPERS.map(p => {
      const bank = bankById(p.bank);
      const r = rec?.byBank?.[p.bank];
      const pct = r?.total ? Math.round(r.correct / r.total * 100) : 0;
      return `
        <div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:16px">
          <div class="q-icon" style="width:52px;height:52px;border-radius:14px;background:${colorMap[bank.color]};display:flex;align-items:center;justify-content:center;color:#fff;flex:none">${window.ICONS.exam}</div>
          <div style="flex:1;min-width:0">
            <b style="font-size:16px">${esc(p.name)}</b>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">${esc(p.desc)} · 限时${p.minutes}分钟 · 难度${p.diff}</div>
            <div style="font-size:12px;color:var(--text-3)">该科目正确率 ${pct}%</div>
          </div>
          <button class="btn btn-sm ${lv === 'free' ? 'btn-gold' : 'btn-success'}" data-action="startExam" data-paper="${p.id}">${lv === 'free' ? 'VIP解锁' : '开始'}</button>
        </div>`;
    }).join('');
    return `
      <div class="container">
        <div class="section-title">模拟考试 <span class="sub">限时实战，检验真实水平</span></div>
        ${lv === 'free' ? '<div class="card" style="border:1.5px dashed var(--warning);background:var(--warning-light);font-size:13px;color:#8F6724;margin-bottom:14px">💡 模拟考试为会员功能，开通黄金VIP及以上每月可考3次，铂金/钻石不限次数。</div>' : ''}
        ${papers}
      </div>`;
  }

  /* ---------- 错题本 ---------- */
  function renderWrong(u) {
    const list = Store.getWrongList();
    if (!list.length) {
      return `
        <div class="container">
          <div class="section-title">错题本 <span class="sub">温故而知新</span></div>
          <div class="card">
            <div class="empty">
              <div class="e-icon">${window.ICONS.shield}</div>
              <b>还没有错题</b>
              <p>恭喜你！继续保持，做错题会自动收录到这里。</p>
              <button class="btn" style="margin-top:16px" data-nav="practice">去刷题</button>
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="container">
        <div class="section-title">错题本 <span class="sub">共 ${list.length} 题</span></div>
        <div class="card" style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-sm btn-success" data-action="redoWrong">重新练习全部</button>
          <button class="btn btn-sm btn-ghost" data-action="clearWrong">清空错题本</button>
        </div>
        ${list.map(w => {
          const q = questionById(w.qid);
          if (!q) return '';
          const bank = bankById(w.bank);
          return `
            <div class="wrong-item" data-action="redoOne" data-qid="${w.qid}">
              <div class="w-num">${Math.min(w.wrongCount, 9)}</div>
              <div class="w-main">
                <div class="w-q">${esc(q.q.replace(/\n/g, ' '))}</div>
                <div class="w-meta"><span class="badge badge-red">${esc(bank?.name || '')}</span><span>${esc(q.kp)}</span><span>${diffLabel(q.diff)}</span><span>错了 ${w.wrongCount} 次</span></div>
              </div>
              <div class="w-del" data-del="${w.qid}" title="移出错题">${window.ICONS.close}</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ---------- VIP 页 ---------- */
  function renderVip(u) {
    const lv = Store.vipLevel(u);
    const isVip = Store.isVip(u);
    const expireText = isVip && u.vip.expireAt ? new Date(u.vip.expireAt).toLocaleDateString('zh-CN') : '';
    const heroPlan = isVip ? 'vip3' : (VIP_PLANS.find(p => p.popular) || VIP_PLANS[2]).id;
    const heroTxt = isVip ? (lv === 'vip3' ? '续费年卡' : '升级钻石VIP') : '立即开通';
    return `
      <div class="container">
        <div class="vip-hero page-anim">
          <div class="vh-crown">${window.ICONS.vip}</div>
          <h2 style="position:relative;z-index:1">学升会员中心</h2>
          <p style="position:relative;z-index:1">当前身份：<b>${vipName(lv)}</b>${expireText ? ' · ' + expireText + ' 到期' : ''}</p>
          <p style="margin-top:8px;opacity:.8;position:relative;z-index:1">解锁全部题库、模拟考试、智能解析与学习报告，助你高效上岸。</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;position:relative;z-index:1">
            <button class="btn btn-vip btn-lg" data-action="pay" data-plan="${heroPlan}">${window.ICONS.vip} ${heroTxt}</button>
            <button class="btn btn-ghost" data-action="redeem" style="background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff">🎟 有兑换码？</button>
          </div>
        </div>

        <div class="vip-plan-grid">
          ${VIP_PLANS.map(p => {
            const isCurrent = p.id === lv && isVip;
            const btnCls = isCurrent ? 'btn-ghost' : p.popular ? 'btn-vip' : 'btn-gold';
            return `
            <div class="vip-plan ${p.popular ? 'popular' : ''}">
              ${p.popular ? '<div class="pop-tag">最受欢迎</div>' : ''}
              <div class="vp-name"><span class="badge" style="background:${p.color};color:#fff">${esc(p.name)}</span>${isCurrent ? '<span class="badge badge-gold">当前等级</span>' : ''}</div>
              <div class="vp-price"><b>${p.price === 0 ? '免费' : money(p.price)}</b> ${p.price === 0 ? '' : `<small>${esc(p.tag)}</small>`}</div>
              <div class="vp-desc">${esc(p.desc)}</div>
              <ul class="vp-feat">
                ${p.features.map(f => `<li class="${f.on ? '' : 'off'}">${f.on ? window.ICONS.check : window.ICONS.close}<span>${esc(f.text)}</span></li>`).join('')}
              </ul>
              <button class="btn btn-block ${btnCls}" data-action="pay" data-plan="${p.id}" ${isCurrent ? 'disabled' : ''}>${isCurrent ? '当前等级' : p.id === 'free' ? '当前使用' : '立即开通'}</button>
            </div>`;
          }).join('')}
        </div>

        <div class="section-title">会员专属权益 <span class="sub">不只是刷题</span></div>
        <div class="perk-grid">
          <div class="perk"><div class="pk-icon" style="background:linear-gradient(135deg,#3043AA,#6371C8)">${window.ICONS.shield}</div><b>不限量刷题</b><span>告别额度限制</span></div>
          <div class="perk"><div class="pk-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.exam}</div><b>模拟考试</b><span>全真限时演练</span></div>
          <div class="perk"><div class="pk-icon" style="background:linear-gradient(135deg,#10B981,#688DDF)">${window.ICONS.chart}</div><b>智能学习报告</b><span>掌握薄弱环节</span></div>
          <div class="perk"><div class="pk-icon" style="background:linear-gradient(135deg,#EE9B62,#6371C8)">${window.ICONS.target}</div><b>专项训练</b><span>精准提分</span></div>
        </div>
      </div>`;
  }

  /* ---------- 学习统计页 ---------- */
  function renderStats(u) {
    const rec = Store.getMyRecord();
    const streak = Store.getStreak();
    const total = rec?.total || 0;
    const correct = rec?.correct || 0;
    const wrong = rec?.wrong || 0;
    const rate = total ? Math.round(correct / total * 100) : 0;
    // 近7天
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ key: k, label: `${d.getMonth() + 1}/${d.getDate()}` });
    }
    const maxDay = Math.max(1, ...days.map(d => rec?.byDay?.[d.key]?.total || 0));
    const dayBars = days.map(d => {
      const v = rec?.byDay?.[d.key]?.total || 0;
      const c = rec?.byDay?.[d.key]?.correct || 0;
      return `<div class="trend-bar"><span class="trend-val">${v}</span><i style="height:${v / maxDay * 100}%"></i><span>${d.label}</span></div>`;
    }).join('');

    const kpStats = {};
    allQuestions().forEach(q => {
      kpStats[q.kp] = { name: q.kp, total: 0, correct: 0, bankId: q.bank };
    });
    // 用各题库真实正确率作为知识点掌握度参考
    [...QUESTION_BANKS, ...Store.getPersonalBanks()].forEach(b => {
      const r = rec?.byBank?.[b.id];
      if (r && r.total) {
        const pct = Math.round(r.correct / r.total * 100);
        (b.kps || []).forEach(kp => { if (kpStats[kp]) { kpStats[kp].total = r.total; kpStats[kp].correct = pct; } });
      }
    });
    const kpRows = Object.values(kpStats).map(v => {
      const pct = v.total ? Math.min(100, v.correct) : 0;
      const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      const label = v.total ? `${pct}%` : '未练';
      return `<div class="kp-row"><span class="kp-name">${esc(v.name)}</span><div class="kp-bar"><i style="width:${pct}%;background:${color}"></i></div><span class="kp-pct" style="color:${v.total ? color : 'var(--text-3)'}">${label}</span></div>`;
    }).join('');

    return `
      <div class="container">
        <div class="section-title">学习统计 <span class="sub">你的每一步都在向前</span></div>
        <div class="stat-grid">
          <div class="stat-card"><div class="s-icon" style="background:linear-gradient(135deg,#3043AA,#6371C8)">${window.ICONS.practice}</div><b>${total}</b><span>累计刷题</span></div>
          <div class="stat-card"><div class="s-icon" style="background:linear-gradient(135deg,#10B981,#688DDF)">${window.ICONS.check}</div><b>${correct}</b><span>答对</span></div>
          <div class="stat-card"><div class="s-icon" style="background:linear-gradient(135deg,#EF4444,#EE9B62)">${window.ICONS.wrong}</div><b>${wrong}</b><span>答错</span></div>
          <div class="stat-card"><div class="s-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.flame}</div><b>${streak}</b><span>连续打卡(天)</span></div>
          <div class="stat-card"><div class="s-icon" style="background:linear-gradient(135deg,#688DDF,#688DDF)">${window.ICONS.target}</div><b>${rate}%</b><span>正确率</span></div>
        </div>
        <div class="section-title">近7天刷题趋势</div>
        <div class="card"><div class="trend-row">${dayBars}</div></div>
        <div class="section-title">知识点掌握度</div>
        <div class="card">${kpRows}</div>
      </div>`;
  }

  /* ---------- 个人中心（数据驾驶舱） ---------- */
  function renderProfile(u) {
    const lv = Store.vipLevel(u);
    const rec = Store.getMyRecord();
    const streak = Store.getStreak();
    const total = rec?.total || 0;
    const correct = rec?.correct || 0;
    const correctRate = rec && rec.total ? Math.round(rec.correct / rec.total * 100) : 0;
    const wrongCount = Object.keys(rec?.wrongSet || {}).length;
    const isVip = Store.isVip(u);
    const vipExpire = isVip && u.vip.expireAt ? new Date(u.vip.expireAt).toLocaleDateString('zh-CN') : '';
    const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayCount = rec?.byDay?.[dayKey(new Date())]?.total || 0;
    let weekCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000);
      weekCount += rec?.byDay?.[dayKey(d)]?.total || 0;
    }
    const favCount = Store.getFavList().length;
    const flagCount = Store.getFlagList().length;
    const revNav = wrongCount > 0 ? 'wrong' : 'practice';
    return `
      <div class="container">
        <!-- 资料卡 / VIP 卡 并排 -->
        <div class="profile-grid">
          <div class="pg-user">
            <div class="avatar">${esc((u.nickname || u.username || '?')[0])}</div>
            <div class="pu-main">
              <h3>${esc(u.nickname || u.username)}</h3>
              <p>${roleName(u.role)} · 注册于 ${new Date(u.createdAt).toLocaleDateString('zh-CN')}</p>
              <div class="streak" style="margin-top:8px">${window.ICONS.flame} 连续打卡 ${streak} 天</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-nav="stats" title="详细学习报告">${window.ICONS.chart}</button>
          </div>
          <div class="pg-vip">
            <div class="pv-crown">${window.ICONS.vip}</div>
            <b>${isVip ? vipName(lv) + ' · 尊享会员' : '开通钻石VIP，解锁全部权益'}</b>
            <span>${isVip ? vipExpire + ' 到期 · 不限量刷题 / 深度解析 / 完整报告' : '不限量刷题 · 大 PDF/Word 批量导入 · 深度解析 · 完整报告'}</span>
            <div class="pv-btn"><button class="btn btn-vip btn-sm" data-nav="vip">${isVip ? '续费 / 升级' : '立即开通'}</button></div>
          </div>
        </div>

        <!-- 数据驾驶舱：大数字仪表盘 -->
        <div class="dash-head">
          <div class="section-title">数据驾驶舱 <span class="sub">你的每一步都在向前</span></div>
          <button class="btn btn-sm btn-ghost" data-nav="stats">${window.ICONS.chart} 详细报告</button>
        </div>
        <div class="dash-grid">
          <div class="dash-card lift"><div class="dash-icon" style="background:linear-gradient(135deg,#16307F,#4A63C8)">${window.ICONS.practice}</div><b>${total}</b><span class="dash-label">累计刷题</span></div>
          <div class="dash-card lift"><div class="dash-icon" style="background:linear-gradient(135deg,#10B981,#688DDF)">${window.ICONS.target}</div><b>${correctRate}<small>%</small></b><span class="dash-label">正确率</span></div>
          <div class="dash-card lift"><div class="dash-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.flame}</div><b>${streak}<small>天</small></b><span class="dash-label">连续打卡</span></div>
          <div class="dash-card lift"><div class="dash-icon" style="background:linear-gradient(135deg,#EF4444,#EE9B62)">${window.ICONS.wrong}</div><b>${wrongCount}</b><span class="dash-label">待巩固错题</span></div>
        </div>
        <div class="mini-stats">
          <div class="mini-stat"><div class="ms-ico" style="background:linear-gradient(135deg,#10B981,#059669)">${window.ICONS.check}</div><div class="ms-txt"><b>${correct}</b><span>累计答对</span></div></div>
          <div class="mini-stat"><div class="ms-ico" style="background:linear-gradient(135deg,#688DDF,#688DDF)">${window.ICONS.clock}</div><div class="ms-txt"><b>${todayCount}</b><span>今日刷题</span></div></div>
          <div class="mini-stat"><div class="ms-ico" style="background:linear-gradient(135deg,#6371C8,#EE9B62)">${window.ICONS.chart}</div><div class="ms-txt"><b>${weekCount}</b><span>近7天刷题</span></div></div>
          <div class="mini-stat"><div class="ms-ico" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.medal}</div><div class="ms-txt"><b>${favCount}</b><span>收藏好题</span></div></div>
        </div>

        <!-- 错题复习入口 -->
        <div class="rev-card" data-nav="${revNav}">
          <div class="rev-ico">${window.ICONS.wrong}</div>
          <div class="rev-main">
            <b>错题复习 · ${wrongCount} 题待巩固</b>
            <span>${wrongCount ? '温故而知新，建议 1 / 3 / 7 天间隔重练，把错题变成分数' : '暂时没有错题，继续保持！去刷两题巩固手感'}</span>
          </div>
          <div class="rev-btn"><button class="btn btn-vip btn-sm">${wrongCount ? '立即复习' : '去刷题'}</button></div>
        </div>

        <!-- 刷题热力图 -->
        ${(() => { const hm = heatmapData(); return `
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span>刷题热力图 <span class="sub">近 70 天活跃记录</span></span>
          <span class="hm-stats">累计 ${hm.total} 题 · 活跃 ${hm.activeDays} 天</span>
        </div>
        <div class="card">
          <div class="heatmap-calendar" style="--weeks:${hm.weeks}">
            <div class="hm-months">${hm.months}</div>
            <div class="hm-body">
              <div class="hm-days"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div>
              <div class="heatmap">${hm.cells}</div>
            </div>
          </div>
          <div class="hm-legend"><span>少</span><i></i><i data-lv="1"></i><i data-lv="2"></i><i data-lv="3"></i><i data-lv="4"></i><span>多</span></div>
        </div>
        `; })()}

        <div class="section-title">我的权益</div>
        <div class="menu-list">
          <div class="menu-item" data-nav="orders">
            <div class="mi-icon" style="background:linear-gradient(135deg,#688DDF,#688DDF)">${window.ICONS.card}</div>
            <div class="mi-main"><b>我的订单</b><span>会员开通 / 核验进度</span></div>
            <div class="mi-arrow">${window.ICONS.arrowRight}</div>
          </div>
          <div class="menu-item" data-nav="materials">
            <div class="mi-icon" style="background:linear-gradient(135deg,#6371C8,#688DDF)">${window.ICONS.book}</div>
            <div class="mi-main"><b>资料中心</b><span>四六级 / 考研英语 / 考研数学 · 近20年真题</span></div>
            <div class="mi-arrow">${window.ICONS.arrowRight}</div>
          </div>
          <div class="menu-item" data-action="redeem">
            <div class="mi-icon" style="background:linear-gradient(135deg,#10B981,#688DDF)">${window.ICONS.vip}</div>
            <div class="mi-main"><b>兑换码兑换</b><span>输入兑换码开通会员</span></div>
            <div class="mi-arrow">${window.ICONS.arrowRight}</div>
          </div>
          <div class="menu-item" data-nav="favs"><div class="mi-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.medal}</div><div class="mi-main"><b>我的收藏</b><span>${favCount} 题已收藏</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-nav="flags"><div class="mi-icon" style="background:linear-gradient(135deg,#EF4444,#EE9B62)">${window.ICONS.target}</div><div class="mi-main"><b>标记疑难</b><span>${flagCount} 题待攻克</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
        </div>
        <div class="section-title">学习管理</div>
        <div class="menu-list">
          <div class="menu-item" data-nav="stats"><div class="mi-icon" style="background:linear-gradient(135deg,#3043AA,#6371C8)">${window.ICONS.chart}</div><div class="mi-main"><b>学习统计</b><span>累计刷题 ${total} 题 · 查看报告</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-nav="mybanks"><div class="mi-icon" style="background:linear-gradient(135deg,#688DDF,#6371C8)">${window.ICONS.book}</div><div class="mi-main"><b>我的题库</b><span>${Store.getPersonalBanks().length}/${Store.getPersonalBankQuota().limit} 个 · 导入管理</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-nav="wrong"><div class="mi-icon" style="background:linear-gradient(135deg,#EF4444,#EE9B62)">${window.ICONS.wrong}</div><div class="mi-main"><b>错题本</b><span>${wrongCount} 题待巩固</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-nav="exam"><div class="mi-icon" style="background:linear-gradient(135deg,#E8B54D,#EE9B62)">${window.ICONS.exam}</div><div class="mi-main"><b>模拟考试</b><span>限时实战演练</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
        </div>
        <div class="section-title">账号</div>
        <div class="menu-list">
          <div class="menu-item"><div class="mi-icon" style="background:linear-gradient(135deg,#64748B,#94A3B8)">${window.ICONS.user}</div><div class="mi-main"><b>账号信息</b><span>${esc(u.username)}</span></div></div>
          <div class="menu-item" data-action="server"><div class="mi-icon" style="background:linear-gradient(135deg,#688DDF,#688DDF)">${window.ICONS.server || '☁'}</div><div class="mi-main"><b>云端服务器</b><span>${serverModeLabel()}</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-action="privacy"><div class="mi-icon" style="background:linear-gradient(135deg,#10B981,#059669)">${window.ICONS.shield}</div><div class="mi-main"><b>隐私政策</b><span>了解我们如何保护您的数据</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-action="agreement"><div class="mi-icon" style="background:linear-gradient(135deg,#F59E0B,#D97706)">${window.ICONS.book}</div><div class="mi-main"><b>用户协议</b><span>平台使用规则</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
          <div class="menu-item" data-action="logout"><div class="mi-icon" style="background:linear-gradient(135deg,#EF4444,#DC2626)">${window.ICONS.close}</div><div class="mi-main"><b style="color:var(--danger)">退出登录</b><span>退出当前账号</span></div><div class="mi-arrow">${window.ICONS.arrowRight}</div></div>
        </div>
      </div>`;
  }

  /* 刷题热力图：GitHub 风格日历，横向展示近 10 周（周一始），绿阶表示活跃强度 */
  function heatmapData() {
    const rec = Store.getMyRecord();
    const byDay = rec?.byDay || {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayKey = fmt(today);

    // 从包含 today-69 那周的周一开始，到今天，补齐末尾空天保持整周
    const start = new Date(today);
    start.setDate(today.getDate() - 69);
    const dow = start.getDay(); // 0 周日
    const offset = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + offset);

    const days = [];
    let activeDays = 0, total = 0;
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = fmt(d);
      const v = byDay[key]?.total || 0;
      if (v > 0) { activeDays++; total += v; }
      days.push({ key, v, isToday: key === todayKey });
    }
    // 补齐到周日，保持最后一列完整
    const lastDow = today.getDay();
    const pad = lastDow === 0 ? 0 : 7 - lastDow;
    for (let i = 0; i < pad; i++) days.push({ key: '', v: -1, isToday: false });

    const weeks = days.length / 7;

    // 月份标签：只在周一跨月时显示
    const months = [];
    for (let w = 0; w < weeks; w++) {
      const mon = days[w * 7];
      if (!mon.key) { months.push('<div class="hm-month empty"></div>'); continue; }
      const m = Number(mon.key.split('-')[1]);
      const prev = w > 0 ? days[(w - 1) * 7].key : null;
      const show = !prev || Number(prev.split('-')[1]) !== m;
      months.push(`<div class="hm-month${show ? '' : ' empty'}">${show ? m + '月' : ''}</div>`);
    }

    const cells = days.map(day => {
      if (day.v < 0) return '<div class="hm-cell empty"></div>';
      const v = day.v;
      const lv = v === 0 ? 0 : v <= 4 ? 1 : v <= 14 ? 2 : v <= 29 ? 3 : 4;
      return `<div class="hm-cell${day.isToday ? ' today' : ''}" data-lv="${lv}" title="${day.key} · 刷题 ${v} 题"></div>`;
    }).join('');

    return { cells, months: months.join(''), weeks, activeDays, total };
  }

  /* 收藏 / 标记疑难 列表页 */
  function renderMarkList(u, type) {
    const isFav = type === 'favs';
    const ids = isFav ? Store.getFavList() : Store.getFlagList();
    const title = isFav ? '我的收藏' : '标记疑难';
    const sub = isFav ? '收藏的好题，随时回看' : '标记的难题，重点攻克';
    if (!ids.length) {
      return `
        <div class="container">
          <div class="section-title">${title} <span class="sub">${sub}</span></div>
          <div class="card">
            <div class="empty">
              <div class="e-icon">${isFav ? window.ICONS.medal : window.ICONS.target}</div>
              <b>${isFav ? '还没有收藏题目' : '还没有标记疑难'}</b>
              <p>${isFav ? '刷题时点击题目下方的「收藏」按钮，好题不错过。' : '刷题时点击「标记疑难」，把难题记下来重点攻克。'}</p>
              <button class="btn" style="margin-top:16px" data-nav="practice">去刷题</button>
            </div>
          </div>
        </div>`;
    }
    const list = ids.map(id => ({ id, q: questionById(id) })).filter(x => x.q);
    return `
      <div class="container">
        <div class="section-title">${title} <span class="sub">共 ${list.length} 题</span></div>
        ${list.map(x => {
          const q = x.q;
          const bank = bankById(q.bank);
          return `
            <div class="wrong-item" data-action="markOne" data-qid="${x.id}" data-title="${title}">
              <div class="w-num" style="background:${isFav ? 'linear-gradient(135deg,#E8B54D,#EE9B62)' : 'linear-gradient(135deg,#EF4444,#EE9B62)'}">${isFav ? '★' : '!'}</div>
              <div class="w-main">
                <div class="w-q">${esc(q.q.replace(/\n/g, ' '))}</div>
                <div class="w-meta"><span class="badge ${isFav ? 'badge-gold' : 'badge-red'}">${esc(bank?.name || '')}</span><span>${esc(q.kp)}</span><span>${diffLabel(q.diff)}</span></div>
              </div>
              <div class="w-del" data-del="${x.id}" data-kind="${type}" title="${isFav ? '取消收藏' : '移除标记'}">${window.ICONS.close}</div>
            </div>`;
        }).join('')}
      </div>`;
  }
  function renderFavs(u) { return renderMarkList(u, 'favs'); }
  function renderFlags(u) { return renderMarkList(u, 'flags'); }

  /* ---------- 我的订单页 ---------- */
  function renderOrders(u) {
    return `
      <div class="container">
        <div class="section-title">我的订单 <span class="sub">会员开通与核验进度</span></div>
        <div class="card" style="padding:14px 16px">
          <div style="font-size:12px;color:var(--text-3);line-height:1.8">
            💡 个人收款码支付没有自动回调，付款后需要管理员人工核对，通常几分钟内开通（夜间可能到次日）。<br>
            核对通过后会员会自动生效，无需重复付款。
          </div>
          <button class="btn btn-sm btn-outline" style="margin-top:10px" data-action="refreshOrders">⟳ 刷新订单状态</button>
        </div>
        <div id="orders-list" style="margin-top:14px;text-align:center;padding:40px 0;color:var(--text-3)">加载中…</div>
      </div>`;
  }
  function orderFmtTime(t) {
    if (!t) return '-';
    const d = new Date(t);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  async function loadOrdersPage(u0) {
    const box = document.getElementById('orders-list');
    if (!box) return;
    const u = Store.getUser() || u0;
    if (!u) return;
    if (!Store.getRemoteReady() || !window.API) {
      box.innerHTML = `
        <div class="card" style="padding:36px 20px">
          <div style="font-size:40px">📴</div>
          <b style="display:block;margin:10px 0 4px">未连接云端服务器</b>
          <p style="font-size:13px;color:var(--text-3);line-height:1.7">订单保存在学升服务器上。<br>请配置服务器地址后，才能查询订单与核验进度。</p>
          <button class="btn btn-sm btn-ghost" style="margin-top:14px" data-action="server">去设置服务器</button>
        </div>`;
      bindOrderActions(u);
      return;
    }
    try {
      const orders = await window.API.getOrders(u.username);
      const confirmed = orders.filter(o => o.status === 'confirmed');
      // 补发：已有核验通过的订单但本地会员未生效
      if (confirmed.length && !Store.isVip(u)) {
        const last = confirmed[0];
        Store.activateVip(last.level || 'vip1', last.months || 1);
        toast('检测到已核验订单，会员已自动开通！', 'ok');
        render();
        return;
      }
      if (!orders.length) {
        box.innerHTML = `
          <div class="card" style="padding:36px 20px">
            <div style="font-size:40px">🛍️</div>
            <b style="display:block;margin:10px 0 4px">还没有订单</b>
            <p style="font-size:13px;color:var(--text-3)">去会员中心开通黄金 / 铂金 / 至尊 VIP</p>
            <button class="btn btn-sm btn-gold" style="margin-top:14px" data-nav="vip">去开通</button>
          </div>`;
        bindOrderActions(u);
        return;
      }
      const STATUS = {
        pending: '<span class="badge badge-orange">待核对</span>',
        confirmed: '<span class="badge badge-green">已开通</span>',
        rejected: '<span class="badge badge-red">已驳回</span>'
      };
      box.innerHTML = orders.map((o, i) => `
        <div class="card" style="margin-bottom:12px;padding:14px 16px;text-align:left">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <b>${esc(vipName(o.planId) + ' (' + (o.months || 1) + '个月)')}</b>
            ${STATUS[o.status] || '<span class="badge badge-blue">' + esc(o.status) + '</span>'}
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.9">
            ${i === 0 ? (o.status === 'pending'
              ? '<div style="color:var(--warning);font-weight:600">⏳ 等待管理员核对，请稍候…</div>'
              : o.status === 'confirmed'
                ? '<div style="color:var(--success);font-weight:600">✅ 会员已生效，本页会自动展示权益</div>'
                : '<div style="color:var(--danger);font-weight:600">该订单已被驳回，如有疑问请联系管理员</div>') : ''}
            <div>来源：<b style="color:var(--primary)">${o.source === 'redeem' ? '🎟 兑换码开通' : '扫码支付'}</b> · 套餐：${esc(vipName(o.planId))}</div>
            <div>金额：<b style="color:var(--primary)">${o.source === 'redeem' ? '免费' : money(o.amount)}</b> · 单号：<code>${esc(o.note || '-')}</code></div>
            <div>提交时间：${orderFmtTime(o.createdAt)}${o.confirmedAt ? ' · 开通时间：' + orderFmtTime(o.confirmedAt) : ''}</div>
          </div>
        </div>`).join('');
      bindOrderActions(u);
    } catch (e) {
      box.innerHTML = `
        <div class="card" style="padding:36px 20px">
          <div style="font-size:40px">⚠️</div>
          <b style="display:block;margin:10px 0 4px">加载失败</b>
          <p style="font-size:13px;color:var(--text-3)">${esc(e.message || '网络异常')}</p>
          <button class="btn btn-sm btn-ghost" style="margin-top:14px" data-action="refreshOrders">重试</button>
        </div>`;
      bindOrderActions(u);
    }
  }
  function bindOrderActions(u) {
    const box = document.getElementById('orders-list');
    if (!box) return;
    box.querySelectorAll('[data-action="refreshOrders"]').forEach(el => el.addEventListener('click', () => loadOrdersPage(u)));
    box.querySelectorAll('[data-action="server"]').forEach(el => el.addEventListener('click', openServerSettings));
    box.querySelectorAll('[data-nav="vip"]').forEach(el => el.addEventListener('click', () => navigate('vip')));
  }

  /* ---------- 联系客服（工单提交 / 进度查询） ---------- */
  function renderContact(u) {
    return `
      <div class="container">
        <div class="section-title">联系客服 <span class="sub">人工服务 · 提交问题并跟踪处理进度</span></div>
        <div class="card" style="padding:14px 16px">
          <div style="font-size:12px;color:var(--text-3);line-height:1.9">
            💬 提交工单后，客服会在后台看到你的问题并及时回复，本页可随时查看处理进度与回复内容。<br>
            🔒 涉及账号、会员、题目等问题均可提交；请勿在内容中填写密码等敏感信息。
          </div>
        </div>
        <div class="section-title">提交新工单</div>
        <div class="card" style="padding:16px">
          <div class="field">
            <label>问题类型</label>
            <select id="ticket-subject" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:11px;outline:none;background:#fff;font-size:15px">
              <option value="账号问题">账号问题</option>
              <option value="会员开通">会员开通 / 订单</option>
              <option value="题目反馈">题目 / 题库反馈</option>
              <option value="导入问题">导入问题</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="field">
            <label>问题描述</label>
            <textarea id="ticket-content" rows="5" maxlength="2000" placeholder="请尽量详细描述你遇到的问题，例如：开通会员后未生效、某道题解析有误、导入文件失败…" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:11px;outline:none;background:#fff;font-size:15px;line-height:1.7;resize:vertical;box-sizing:border-box"></textarea>
            <div style="font-size:11px;color:var(--text-3);margin-top:6px">最多 2000 字，至少 5 个字</div>
          </div>
          <button class="btn btn-block" data-action="submitTicket">提交工单</button>
        </div>
        <div class="section-title">我的工单</div>
        <div id="tickets-list" style="text-align:center;padding:40px 0;color:var(--text-3)">加载中…</div>
      </div>`;
  }
  function bindContactActions(u) {
    const box = document.getElementById('tickets-list');
    if (!box) return;
    box.querySelectorAll('[data-action="refreshTickets"]').forEach(el => el.addEventListener('click', () => loadContactPage(u)));
    box.querySelectorAll('[data-action="server"]').forEach(el => el.addEventListener('click', openServerSettings));
    box.querySelectorAll('[data-nav="vip"]').forEach(el => el.addEventListener('click', () => navigate('vip')));
  }
  const TICKET_STATUS = {
    open: '<span class="badge badge-orange">待处理</span>',
    pending: '<span class="badge badge-blue">处理中</span>',
    replied: '<span class="badge badge-green">已回复</span>',
    closed: '<span class="badge badge-teal">已关闭</span>'
  };
  async function loadContactPage(u0) {
    const box = document.getElementById('tickets-list');
    if (!box) return;
    const u = Store.getUser() || u0;
    if (!u) return;
    if (!Store.getRemoteReady() || !window.API) {
      box.innerHTML = `
        <div class="card" style="padding:36px 20px">
          <div style="font-size:40px">📴</div>
          <b style="display:block;margin:10px 0 4px">未连接云端服务器</b>
          <p style="font-size:13px;color:var(--text-3);line-height:1.7">工单保存在学升服务器上。<br>请配置服务器地址后，才能联系客服与查看处理进度。</p>
          <button class="btn btn-sm btn-ghost" style="margin-top:14px" data-action="server">去设置服务器</button>
        </div>`;
      bindContactActions(u);
      return;
    }
    try {
      const tickets = await window.API.getTickets(u.username);
      if (!tickets.length) {
        box.innerHTML = `
          <div class="card" style="padding:36px 20px">
            <div style="font-size:40px">💬</div>
            <b style="display:block;margin:10px 0 4px">还没有工单</b>
            <p style="font-size:13px;color:var(--text-3)">遇到任何问题，都可以在上面提交工单联系客服</p>
          </div>`;
        bindContactActions(u);
        return;
      }
      box.innerHTML = tickets.map(t => `
        <div class="card" style="margin-bottom:12px;padding:14px 16px;text-align:left">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <b>${esc(t.subject)}</b>
            ${TICKET_STATUS[t.status] || '<span class="badge badge-blue">' + esc(t.status) + '</span>'}
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.9">
            <div>工单号 #${t.id} · 提交于 ${orderFmtTime(t.createdAt)}${t.updatedAt && t.updatedAt !== t.createdAt ? ' · 更新于 ' + orderFmtTime(t.updatedAt) : ''}</div>
            <div style="color:var(--text-1);font-size:13px;margin-top:8px;white-space:pre-wrap;line-height:1.7">${esc(t.content)}</div>
            ${t.reply
              ? `<div style="margin-top:10px;background:var(--primary-light);border-radius:10px;padding:10px 12px">
                  <b style="color:var(--primary);font-size:12px">客服回复</b><span style="color:var(--text-3);font-size:11px">（${orderFmtTime(t.replyAt)}）</span>
                  <div style="white-space:pre-wrap;margin-top:4px;font-size:13px;color:var(--text-1);line-height:1.7">${esc(t.reply)}</div>
                </div>`
              : t.status === 'closed'
                ? '<div style="margin-top:8px;color:var(--text-3)">该工单已关闭</div>'
                : '<div style="margin-top:8px;color:var(--warning)">⏳ 客服正在处理中，请耐心等待…</div>'}
          </div>
        </div>`).join('');
      bindContactActions(u);
    } catch (e) {
      box.innerHTML = `
        <div class="card" style="padding:36px 20px">
          <div style="font-size:40px">⚠️</div>
          <b style="display:block;margin:10px 0 4px">加载失败</b>
          <p style="font-size:13px;color:var(--text-3)">${esc(e.message || '网络异常')}</p>
          <button class="btn btn-sm btn-ghost" style="margin-top:14px" data-action="refreshTickets">重试</button>
        </div>`;
      bindContactActions(u);
    }
  }
  async function submitTicket() {
    const u = Store.getUser();
    if (!u) return;
    if (!Store.getRemoteReady() || !window.API) { toast('未连接云端服务器', 'err'); return; }
    const subject = (document.getElementById('ticket-subject') || {}).value || '其他';
    const content = (document.getElementById('ticket-content') || {}).value || '';
    if (!content.trim()) return toast('请填写问题描述', 'err');
    if (content.trim().length < 5) return toast('问题描述至少 5 个字', 'err');
    const btn = document.getElementById('ticket-submit');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
    try {
      await window.API.createTicket(u.username, { subject, content });
      toast('工单已提交，客服会尽快处理', 'ok');
      const ta = document.getElementById('ticket-content');
      if (ta) ta.value = '';
      await loadContactPage(u);
    } catch (e) {
      toast('提交失败：' + e.message, 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '提交工单'; }
    }
  }

  /* ---------- 兑换码兑换弹窗 ---------- */
  function openRedeem() {
    const u = Store.getUser();
    if (!u) { toast('请先登录', 'err'); return; }
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>🎟 兑换码开通会员</h3><button class="rd-close" style="padding:6px;border-radius:8px">${window.ICONS.close}</button></div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--text-2);line-height:1.7;margin-bottom:12px">输入管理员发放的兑换码（格式 XS-XXXX-XXXX-XXXX），兑换成功后对应会员立即生效。</p>
          <input id="rd-input" class="srv-input" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--border);border-radius:10px;font-size:14px;margin-bottom:12px" placeholder="例如 XS-AB12-CD34-EF56" maxlength="17" autocomplete="off" />
          <div id="rd-msg" style="font-size:12px;min-height:16px;margin-bottom:10px"></div>
          <button class="btn btn-block btn-gold" data-rd-submit>兑换开通</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelector('.rd-close').addEventListener('click', close);
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    const input = mask.querySelector('#rd-input');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    mask.querySelector('[data-rd-submit]').addEventListener('click', submit);
    input.focus();
    async function submit() {
      const code = (input.value || '').trim().toUpperCase();
      const msg = mask.querySelector('#rd-msg');
      if (code.length < 10) { msg.innerHTML = '<span style="color:var(--danger)">请输入完整兑换码</span>'; return; }
      const btn = mask.querySelector('[data-rd-submit]');
      btn.disabled = true; btn.textContent = '兑换中…';
      try {
        await window.API.redeem(u.username, code);
        toast('兑换成功！会员已开通', 'ok');
        mask.remove();
        Store.pullRemote(u.username).catch(() => {});
        render();
      } catch (e) {
        msg.innerHTML = '<span style="color:var(--danger)">' + esc(e.message || '兑换失败') + '</span>';
        btn.disabled = false; btn.textContent = '兑换开通';
      }
    }
  }

  function roleName(r) { return { kaoyan: '考研党', kaogong: '考公党', student: '在校大学生' }[r] || '学生'; }

  /* ---------- 云端服务器设置 ---------- */
  function serverModeLabel() {
    const b = (window.API && typeof window.API.getBase === 'function') ? (window.API.getBase() || '') : '';
    return b ? '已连接 · ' + b.replace(/^https?:\/\//, '') : '本机模式 · 安卓 App 需配置云端地址';
  }

  function openServerSettings() {
    const cur = (window.API && typeof window.API.getBase === 'function') ? (window.API.getBase() || '') : '';
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>云端服务器设置</h3><button class="ps-close" style="padding:6px;border-radius:8px">${window.ICONS.close}</button></div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--text-2);line-height:1.7">安卓 App / 手机浏览器需要连接你部署好的服务器。填写地址后，账号、题库、刷题记录都会走云端；留空则使用本机模式。</p>
          <input id="srv-input" class="srv-input" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--border);border-radius:10px;font-size:13px;margin:12px 0" placeholder="https://你的服务器域名 或 http://IP:端口" value="${esc(cur)}" />
          <div id="srv-hint" style="font-size:12px;color:var(--text-3);margin-bottom:12px">示例：https://xs.example.com · 服务器需部署 study-platform/server 并安装 LibreOffice</div>
          <button class="btn btn-block btn-gold" data-srv-save>保存并测试连接</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.querySelector('.ps-close').addEventListener('click', () => mask.remove());
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    const btn = mask.querySelector('[data-srv-save]');
    const hint = mask.querySelector('#srv-hint');
    btn.addEventListener('click', async () => {
      const val = (mask.querySelector('#srv-input').value || '').trim().replace(/\/+$/, '');
      btn.disabled = true; btn.textContent = '测试中…';
      try {
        if (!val) {
          window.API.setBase('');
          hint.style.color = 'var(--success)'; hint.textContent = '已切换回本机模式。';
          toast('已恢复本机模式', 'ok'); render();
          return;
        }
        if (!/^https?:\/\//i.test(val)) {
          hint.style.color = 'var(--danger)'; hint.textContent = '地址需以 http:// 或 https:// 开头。';
          return;
        }
        window.API.setBase(val);
        const ok = await window.API.ping();
        if (ok) {
          hint.style.color = 'var(--success)'; hint.textContent = '连接成功！数据已切换到云端。';
          toast('云端服务器已启用', 'ok'); render();
        } else {
          hint.style.color = 'var(--danger)'; hint.textContent = '无法连接该地址，请确认服务器已部署并允许跨域访问。';
        }
      } catch (e) {
        hint.style.color = 'var(--danger)'; hint.textContent = '连接出错：' + (e && e.message || e);
      } finally {
        btn.disabled = false; btn.textContent = '保存并测试连接';
      }
    });
  }

  /* ---------- 资料中心（近十年真题 / 解析 / 听力，下载解锁后软件内在线查看） ---------- */
  const MAT_GROUP_LABEL = { cet: '大学英语（四六级）', kyyy: '考研英语', sx: '考研数学', gk: '国家公务员考试', kyzz: '考研政治' };
  const MAT_TYPE_LABEL = { zhenti: '真题', jiexi: '解析', tingli: '听力' };
  const matSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : (n || 0) + ' B';
  const matTypeBadge = t => ({ zhenti: 'badge-blue', jiexi: 'badge-green', tingli: 'badge-gold' })[t] || 'badge';
  const matTypeIcon = t => t === 'zhenti' ? '📄' : t === 'jiexi' ? '📝' : '🎧';

  function renderMaterials(u) {
    const isVip = Store.isVip(u);
    return `
      <div class="container">
        <div class="section-title">资料中心 <span class="sub">近20年真题 · 解析 · 听力 · 国考</span></div>
        <!-- 设计稿 VIP 横幅 -->
        <div class="mat-vip-banner">
          <div class="mvb-ico">${window.ICONS.vip}</div>
          <div class="mvb-main">
            <b>${isVip ? 'VIP 已解锁全部资料权限，尽情畅学' : '普通用户免费解锁 8 套，开通 VIP 解锁全部'}</b>
            <span>真题 · 答案解析 · 听力音频，下载解锁后软件内在线查看</span>
          </div>
          <div class="mvb-btn"><button class="btn btn-vip btn-sm" data-nav="vip">${isVip ? '续费 / 升级' : '开通 VIP'}</button></div>
        </div>
        <div class="card mat-notice" style="margin-bottom:14px;padding:12px 16px;font-size:13px;color:var(--text-2);display:flex;gap:10px;align-items:flex-start">
          <span style="flex:none">${window.ICONS.shield}</span>
          <span>资料<b style="color:var(--primary)">下载解锁</b>后可在软件内在线查看；资料仅限本软件内使用，请勿外传。</span>
        </div>
        <div id="materials-quota" class="mat-quota"></div>
        <div id="materials-filters" class="mat-filters"></div>
        <div id="materials-list"><div class="empty">正在加载资料清单…</div></div>
      </div>`;
  }

  async function loadMaterialsPage(u) {
    const list = document.getElementById('materials-list');
    if (!list) return;
    if (!window.API || !Store.getRemoteReady()) {
      list.innerHTML = `<div class="empty">未连接云端服务器，资料中心暂不可用。<br><a data-nav="profile" style="color:var(--primary);cursor:pointer">前往配置云端</a></div>`;
      return;
    }
    try {
      const data = await window.API.getMaterials(u.username);
      materialsState = {
        categories: data.categories || [], items: data.items || [], unlocked: new Set(data.unlocked || []),
        freeLimit: data.freeLimit || 8, isVip: !!data.isVip, unlockedCount: data.unlockedCount || 0
      };
      renderMaterialsList();
    } catch (e) {
      list.innerHTML = `<div class="empty">资料加载失败：${esc(e.message)}</div>`;
    }
  }

  function renderMaterialsList() {
    const s = materialsState;
    if (!s) return;
    const filterWrap = document.getElementById('materials-filters');
    const listBox = document.getElementById('materials-list');
    if (!filterWrap || !listBox) return;

    const groups = [['', '全部科目'], ['cet', '大学英语'], ['kyyy', '考研英语'], ['sx', '考研数学'], ['gk', '国考'], ['kyzz', '考研政治']];
    const cats = [...new Set(s.items.map(i => i.group === matFilter.group ? i.cat : ''))].filter(Boolean);
    const years = [...new Set(s.items.map(i => i.year))].sort().reverse();
    const types = [['', '全部类型'], ['zhenti', '真题'], ['jiexi', '解析'], ['tingli', '听力']];
    const chip = (k, v, label, active) =>
      `<div class="mat-chip ${active ? 'active' : ''}" data-mat-filter data-k="${k}" data-v="${v}">${esc(label)}</div>`;
    let html = `<div class="mat-chips">${groups.map(([v, l]) => chip('group', v, l, matFilter.group === v)).join('')}</div>`;
    if (matFilter.group && cats.length) {
      const catNames = { cet4: '四级', cet6: '六级', kyyy1: '英语一', kyyy2: '英语二', sx1: '数学一', sx2: '数学二', sx3: '数学三', gkxc: '行测', gksl: '申论', kyzz: '政治' };
      html += `<div class="mat-chips">${cats.map(c => chip('cat', c, catNames[c] || c, matFilter.cat === c)).join('')}</div>`;
    }
    html += `<div class="mat-chips">${years.map(y => chip('year', y, y + ' 年', matFilter.year === y)).join('')}</div>`;
    html += `<div class="mat-chips">${types.map(([v, l]) => chip('type', v, l, matFilter.type === v)).join('')}</div>`;
    filterWrap.innerHTML = html;
    filterWrap.onclick = e => {
      const b = e.target.closest('[data-mat-filter]');
      if (!b) return;
      const k = b.dataset.k, v = b.dataset.v;
      if (k === 'group') { matFilter.group = v; matFilter.cat = ''; }
      else if (k === 'cat') matFilter.cat = v;
      else matFilter[k] = v;
      renderMaterialsList();
    };

    /* 免费额度条：VIP 不限；普通用户 8 套 */
    const quotaBox = document.getElementById('materials-quota');
    if (quotaBox) {
      if (s.isVip) {
        quotaBox.innerHTML = `<div class="mat-quota-bar vip"><span>👑 VIP 会员已解锁全部资料权限，尽情畅学</span></div>`;
      } else {
        const used = Math.min(s.unlockedCount, s.freeLimit);
        const left = Math.max(0, s.freeLimit - used);
        quotaBox.innerHTML = `
          <div class="mat-quota-bar ${left <= 0 ? 'full' : ''}">
            <span>免费额度：<b>${used}/${s.freeLimit}</b> 套${left <= 0 ? '（已用完）' : `（剩余 <b>${left}</b> 套）`}</span>
            <button class="mat-btn mat-btn-vip" data-nav="vip">开通 VIP 解锁全部</button>
          </div>`;
      }
      quotaBox.onclick = e => {
        const nb = e.target.closest('[data-nav]');
        if (nb) navigate(nb.dataset.nav);
      };
    }

    const items = s.items.filter(i =>
      (!matFilter.group || i.group === matFilter.group) &&
      (!matFilter.cat || i.cat === matFilter.cat) &&
      (!matFilter.year || i.year === matFilter.year) &&
      (!matFilter.type || i.type === matFilter.type)
    ).sort((a, b) => (b.year - a.year) || (b.month || '').localeCompare(a.month || '') || (a.set || 1) - (b.set || 1));

    if (!items.length) {
      listBox.innerHTML = `<div class="empty">没有符合条件的资料，换个筛选试试～</div>`;
      return;
    }
    const left = s.isVip ? Infinity : Math.max(0, s.freeLimit - s.unlockedCount);
    listBox.innerHTML = items.map(it => {
      const unlocked = s.unlocked.has(it.id);
      const btn = unlocked
        ? `<button class="mat-btn mat-btn-view" data-mat-view data-id="${it.id}">${it.type === 'tingli' ? '播放' : '在线查看'}</button>`
        : (left <= 0
          ? `<button class="mat-btn mat-btn-vip" data-nav="vip">开通VIP解锁</button>`
          : `<button class="mat-btn mat-btn-dl" data-mat-unlock data-id="${it.id}">下载解锁</button>`);
      return `
        <div class="mat-card">
          <div class="mc-icon" style="background:${it.type === 'tingli' ? 'linear-gradient(135deg,#E8B54D,#EE9B62)' : it.type === 'jiexi' ? 'linear-gradient(135deg,#10B981,#688DDF)' : 'linear-gradient(135deg,#3043AA,#6371C8)'}">${matTypeIcon(it.type)}</div>
          <div class="mc-main">
            <b>${esc(it.title)}</b>
            <span>${esc(MAT_GROUP_LABEL[it.group] || it.group)} · <span class="badge ${matTypeBadge(it.type)}">${MAT_TYPE_LABEL[it.type] || it.type}</span> · ${matSize(it.size)} · ${unlocked ? '已解锁' : '未解锁'}</span>
          </div>
          ${btn}
        </div>`;
    }).join('');

    listBox.onclick = async e => {
      const nb = e.target.closest('[data-nav]');
      if (nb) { navigate(nb.dataset.nav); return; }
      const ub = e.target.closest('[data-mat-unlock]');
      if (ub) { unlockMaterialItem(ub.dataset.id); return; }
      const vb = e.target.closest('[data-mat-view]');
      if (vb) { viewMaterialItem(vb.dataset.id); return; }
    };
  }

  async function unlockMaterialItem(itemId) {
    const u = Store.getUser();
    if (!u || !window.API) { toast('请先登录', 'err'); return; }
    if (!Store.getRemoteReady()) { toast('未连接云端服务器', 'err'); return; }
    const btn = document.querySelector(`[data-mat-unlock][data-id="${itemId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '解锁中…'; }
    try {
      const d = await window.API.unlockMaterial(u.username, itemId);
      if (materialsState) materialsState.unlocked = new Set(d.unlocked || []);
      toast('下载解锁成功，可在软件内查看', 'ok');
      renderMaterialsList();
    } catch (e) {
      const msg = (e && e.message) || '解锁失败';
      toast(msg, 'err');
      /* 免费额度用尽：刷新配额状态，按钮转为“开通VIP解锁” */
      if (msg.indexOf('VIP') >= 0) { loadMaterialsPage(u); }
      else if (btn) { btn.disabled = false; btn.textContent = '下载解锁'; }
    }
  }

  async function viewMaterialItem(itemId) {
    const u = Store.getUser();
    if (!u || !materialsState) return;
    const item = materialsState.items.find(i => i.id === itemId);
    if (!item) return;
    if (!materialsState.unlocked.has(itemId)) { toast('请先下载解锁该资料', 'err'); return; }
    openMaterialViewer(u, item);
  }

  /* 内置阅读器：PDF 用 pdf.js 渲染，音频用 audio 播放（内容来自云端内存，不落盘） */
  async function openMaterialViewer(u, item) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.style.padding = '0';
    mask.innerHTML = `
      <style>
        .mat-viewer{display:flex;flex-direction:column;background:#050B2E;color:#e2e8f0;width:100%;height:100%;max-height:100%;border-radius:0;animation:popIn .2s}
        @media(min-width:768px){.mat-viewer{max-width:980px;height:94vh;border-radius:16px;overflow:hidden}}
        .mat-viewer-head{display:flex;align-items:center;gap:12px;padding:13px 18px;background:#0b1120;border-bottom:1px solid #1e293b;flex:none}
        .mat-viewer-title{flex:1;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mat-viewer-close{background:rgba(255,255,255,.08);border:none;color:#cbd5e1;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .mat-viewer-close svg{width:18px;height:18px}
        .mat-viewer-body{flex:1;overflow-y:auto;padding:16px;display:flex;justify-content:center}
        .mat-loading{color:#94a3b8;font-size:14px;padding:48px 0;text-align:center}
        .mat-pdf-pages{width:100%;display:flex;flex-direction:column;align-items:center;gap:14px}
        .mat-pdf-page{background:#fff;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.4);max-width:100%;height:auto}
        .mat-audio{width:100%;max-width:640px;margin-top:22vh}
        .mat-audio-tip{text-align:center;color:#94a3b8;font-size:13px;margin-top:14px}
      </style>
      <div class="mat-viewer">
        <div class="mat-viewer-head">
          <div class="mat-viewer-title">${esc(item.title)}</div>
          <button class="mat-viewer-close" data-close>${window.ICONS.close}</button>
        </div>
        <div class="mat-viewer-body" data-body><div class="mat-loading">正在加载资料…</div></div>
      </div>`;
    document.body.appendChild(mask);
    const body = mask.querySelector('[data-body]');
    const close = () => { mask.remove(); };
    mask.querySelector('[data-close]').addEventListener('click', close);
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    let objUrl = '';
    try {
      const buf = await window.API.fetchMaterialFile(u.username, item.id);
      if (/\.mp3$/i.test(item.file || '')) {
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        objUrl = URL.createObjectURL(blob);
        body.innerHTML = `<audio class="mat-audio" src="${objUrl}" controls autoplay></audio><div class="mat-audio-tip">${esc(item.title)}</div>`;
      } else {
        body.innerHTML = '';
        await renderPdfIn(body, buf);
      }
    } catch (e) {
      body.innerHTML = `<div class="mat-loading">加载失败：${esc(e.message)}</div>`;
    }
  }

  async function renderPdfIn(container, buf) {
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) { container.innerHTML = '<div class="mat-loading">缺少 PDF 渲染组件</div>'; return; }
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjs.GlobalWorkerOptions.workerSrc || './js/lib/pdf.worker.min.js';
    try {
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const wrap = document.createElement('div');
      wrap.className = 'mat-pdf-pages';
      container.appendChild(wrap);
      const avail = (window.innerWidth || 900) - 60;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.max(0.7, avail / v1.width));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        canvas.className = 'mat-pdf-page';
        wrap.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    } catch (e) {
      container.innerHTML = '<div class="mat-loading">PDF 渲染失败：' + esc(e.message) + '</div>';
    }
  }

  /* ---------- 我的题库 ---------- */
  function renderMyBanks(u) {
    const banks = Store.getPersonalBanks();
    const quota = Store.getPersonalBankQuota();
    const lv = Store.vipLevel(u);
    const pct = quota.limit ? Math.min(100, banks.length / quota.limit * 100) : 0;
    const rec = Store.getMyRecord();
    return `
      <div class="container">
        <div class="section-title">我的题库 <span class="sub">导入专属题目，分模块刷题</span></div>
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;gap:10px;flex-wrap:wrap">
            <span>已安装 <b style="color:var(--primary)">${banks.length}</b> / ${quota.limit} 个个人题库</span>
            ${lv === 'free'
              ? `<a data-nav="vip" style="color:var(--warning);font-weight:600;cursor:pointer">升级会员扩容 →</a>`
              : `<span class="badge badge-gold">${vipName(lv)} · 可装 ${quota.limit} 个</span>`}
          </div>
          <div class="progress-bar" style="height:8px;margin-top:10px"><i style="width:${pct}%"></i></div>
          <p style="font-size:12px;color:var(--text-3);margin-top:8px">普通用户可安装 ${Store.getPersonalBankLimit('free')} 个，黄金/铂金/钻石 VIP 分别可安装 10 / 50 / 100 个。</p>
        </div>
        <button class="btn btn-block btn-gold" style="margin-bottom:16px" data-action="goImport">＋ 导入新题库</button>
        ${banks.length ? `
          <div class="cat-grid">
            ${banks.map(b => {
              const r = rec?.byBank?.[b.id];
              const bpct = r && r.total ? Math.round(r.correct / r.total * 100) : 0;
              return `
                <div class="cat-card">
                  <div class="cat-icon" style="background:${colorMap[b.color] || '#688DDF'}">${window.ICONS[b.icon] || window.ICONS.book}</div>
                  <h3>${esc(b.name)}</h3>
                  <div class="cat-desc">${esc(b.desc)}</div>
                  <div class="cat-meta"><span>${b.questions.length} 题</span><span>${b.kps.length} 模块</span><span>正确率 ${bpct}%</span></div>
                  <div class="cat-progress"><div class="progress-bar"><i style="width:${bpct}%"></i></div></div>
                  <div class="cat-meta" style="margin-top:10px;gap:8px">
                    <button class="btn btn-sm" style="flex:1" data-action="trainBank" data-bank="${esc(b.id)}">开始刷题</button>
                    <button class="btn btn-sm btn-ghost" data-action="shareBank" data-bank="${esc(b.id)}" title="分享题库">分享</button>
                    <button class="btn btn-sm btn-ghost" data-action="delBank" data-bank="${esc(b.id)}" title="卸载题库">${window.ICONS.close}</button>
                  </div>
                </div>`;
            }).join('')}
          </div>` : `
          <div class="card">
            <div class="empty">
              <div class="e-icon">${window.ICONS.book}</div>
              <b>还没有个人题库</b>
              <p>导入你自己的题库文件（JSON / CSV / TXT / Markdown），自动识别格式并生成专属题库。</p>
              <button class="btn" style="margin-top:16px" data-action="goImport">立即导入</button>
            </div>
          </div>`}
      </div>`;
  }

  /* ---------- 题型工具：导入自动识别 单选/判断/填空/主观大题 ---------- */
  const TYPE_LABEL = { single: '单选题', judge: '判断题', fill: '填空题', subjective: '主观题' };
  function typeLabel(t) { return TYPE_LABEL[t] || '单选题'; }
  function typeBadgeCls(t) {
    if (t === 'subjective') return 'badge-teal';
    if (t === 'fill') return 'badge-green';
    if (t === 'judge') return 'badge-red';
    return 'badge-blue';
  }
  function normStr(s) { return String(s == null ? '' : s).replace(/[\s，。、；：,.;:！!？?（）()【】\[\]“”"''·~～-]/g, '').toLowerCase(); }
  /* 参考答案多空以 | 或 ｜ 分隔 */
  function splitBlanks(ans) { return String(ans == null ? '' : ans).split(/[|｜]/).map(s => s.trim()).filter(Boolean); }
  /* 填空判分：忽略标点/空格/大小写，多空一一对应 */
  function checkFill(ansRef, input) {
    const refs = splitBlanks(ansRef);
    if (!refs.length || input === undefined || input === null) return false;
    const ins = String(input).split(/[|｜]/).map(s => s.trim());
    if (refs.length === 1) return normStr(ins[0]) === normStr(refs[0]);
    if (ins.length !== refs.length) return normStr(String(input)) === normStr(ansRef);
    return refs.every((r, i) => normStr(ins[i] || '') === normStr(r));
  }
  /* 是否可进入下一题：主观题需先完成自评 */
  function canProceed(answers, selfJudge, q, idx) {
    const a = answers[idx];
    if (a === undefined || a === 'skip') return false;
    if (q.type === 'subjective') return !!(selfJudge && selfJudge[idx] !== undefined);
    return true;
  }
  /* 作答成功记录（免费额度保护 + 上报答题用时） */
  function recordAnswerWithQuota(q, correct) {
    const quota = Store.getQuota();
    if (quota.limit !== 9999 && quota.used >= quota.limit) {
      toast('今日免费额度已用完，开通会员不限量刷题', 'err');
      navigate('vip');
      return false;
    }
    const started = (quiz && quiz.qStartedAt) || Date.now() - 5000;
    const dt = Math.min(3600000, Math.max(0, Date.now() - started));
    Store.recordAnswer(q.id, correct, dt);
    if (quiz) quiz.qStartedAt = Date.now();
    return true;
  }

  /* ---------- 导入向导 ---------- */
  function renderImport(u) {
    const banks = Store.getPersonalBanks();
    const quota = Store.getPersonalBankQuota();
    const full = banks.length >= quota.limit;
    return `
      <div class="container" style="max-width:760px">
        <div class="section-title">导入到我的题库 <span class="sub">自动识别常见文件格式</span></div>
        <div class="card" style="background:var(--primary-light);border:1.5px solid var(--primary-light);font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.8">
          💡 这里导入的题目会进入你的<strong>「我的题库」</strong>，和系统题库分开管理。你可以在「选择题库」→「我的题库」里找到并刷题。
        </div>
        <div class="perk-banner">
          <div class="pb-ico">${window.ICONS.vip}</div>
          <div class="pb-body">
            <b>VIP 专属：大文件批量导入</b><br>
            免费版限 <b>${Store.getPersonalBankLimit('free')} 个题库位</b> · 单文件 ≤ 2MB；开通钻石 VIP 可拥有 <b>${Store.getPersonalBankLimit('vip3')} 个题库位</b>，支持大 PDF / Word 批量识别、自动清洗格式。
            <div style="margin-top:8px"><button class="btn btn-vip btn-sm" data-nav="vip">${window.ICONS.vip} ${Store.isVip(u) ? '续费 / 升级' : '立即开通'}</button></div>
          </div>
        </div>
        ${full ? `<div class="card" style="border:1.5px dashed var(--warning);background:var(--warning-light);font-size:13px;color:#8F6724;margin-bottom:14px">个人题库数量已达上限（${quota.limit} 个）。<a data-nav="vip" style="font-weight:700;color:#A97E35;cursor:pointer">升级会员</a>可扩容至更多。</div>` : ''}
        <div id="import-panel">
          ${importState ? importPreviewHtml(importState, full) : importUploadHtml(quota)}
        </div>
        <div class="section-title">支持的文件格式</div>
        <div class="card" style="font-size:13px;line-height:2.1;color:var(--text-2)">
          <div>📦 <b>JSON</b> — 题库标准格式（题目 / 选项 / 答案 / 解析）</div>
          <div>📊 <b>XLSX</b> — Excel 表格，自动识别表头列名</div>
          <div>📄 <b>CSV</b> — 逗号分隔表格，自动识别列名</div>
          <div>📝 <b>Markdown / TXT</b> — 文本题集，自动识别题号与选项</div>
          <div>📕 <b>DOCX</b> — Word 文档，自动提取段落中的题目</div>
          <div>📑 <b>PDF</b> — 文本型 PDF（扫描图片版暂不支持）</div>
          <div>🔢 <b>JSONL</b> — 每行一道 JSON 题目</div>
        </div>

        <div class="section-title">从零开始？<span class="sub">模板 & AI 生成，2 分钟建题库</span></div>
        <div class="card" style="font-size:13px;line-height:1.9;color:var(--text-2)">
          <div style="font-weight:700;color:var(--text-1);margin-bottom:8px">① 下载示例模板，照着填</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-outline" data-action="dlTemplate" data-fmt="csv">📄 下载 CSV 模板</button>
            <button class="btn btn-sm btn-outline" data-action="dlTemplate" data-fmt="md">📝 下载 Markdown 模板</button>
            <button class="btn btn-sm btn-outline" data-action="dlTemplate" data-fmt="json">📦 下载 JSON 模板</button>
          </div>
          <div style="margin-top:14px;font-weight:700;color:var(--text-1);margin-bottom:8px">② 让 AI 帮你出题（复制提示词）</div>
          <div class="ai-prompt-box" id="ai-prompt-box">请作为出题助手，为我生成 15 道「考研政治·马原」练习题，题型包含单选题（A/B/C/D 选项）、判断题、填空题，并给出答案与解析。按照下面的格式输出：
1. 题目
A. 选项 B. 选项 C. 选项 D. 选项
答案：A
解析：…</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-sm" data-action="copyAiPrompt">复制提示词</button>
            <span style="font-size:12px;color:var(--text-3);align-self:center">复制给 DeepSeek / 豆包 / ChatGPT 等，把生成的文本保存为 .md/.txt 导入即可</span>
          </div>
        </div>

        <div class="section-title">收到好友分享的题库？<span class="sub">粘贴分享码一键导入</span></div>
        <div class="card" style="font-size:13px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input id="share-code-input" class="share-code-input" placeholder="粘贴分享码（以 XS1. 开头）" style="flex:1;min-width:200px" />
            <button class="btn btn-gold" data-action="importShareCode">一键导入</button>
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:8px">在「我的题库」中点击题库卡片的「分享」按钮即可生成分享码。</div>
        </div>

        <div class="card" style="margin-top:12px;font-size:13px;line-height:2;color:var(--text-2)">
          <div>🧠 <b>题型自动识别</b> — 导入后自动判断：单选题 / 判断题 / 填空题（题干含横线、括号空位）/ 简答大题（无选项文本答案）</div>
          <div>📌 填空题多空用 <code>|</code> 分隔参考答案；主观题作答后需自评。</div>
        </div>
      </div>`;
  }
  function importUploadHtml(quota) {
    return `
      <div class="import-zone" id="import-zone">
        <input type="file" id="import-file" accept=".json,.jsonl,.csv,.txt,.md,.markdown,.docx,.xlsx,.pdf" hidden />
        <div class="iz-icon">${window.ICONS.book}</div>
        <b>点击选择文件，或将文件拖拽到此处</b>
        <p>支持 JSON / CSV / TXT / Markdown / DOCX / XLSX / PDF · 已用 ${quota.used} / ${quota.limit} 个题库位</p>
      </div>
      <div id="import-progress" hidden style="text-align:center;padding:26px 10px;color:var(--text-2);font-size:13px">
        <div style="width:180px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 10px;overflow:hidden">
          <div id="import-progress-bar" style="width:0%;height:100%;background:var(--primary);transition:width .2s"></div>
        </div>
        <span id="import-progress-text">正在解析文件…</span>
      </div>`;
  }
  function importPreviewHtml(st, full) {
    const fmtName = { json: 'JSON', jsonl: 'JSONL', csv: 'CSV', text: 'Markdown/文本', docx: 'Word 文档', xlsx: 'Excel 表格', pdf: 'PDF 文档' }[st.format] || st.format;
    const kpCount = new Set(st.questions.map(q => q.kp)).size;
    const preview = st.questions.slice(0, 3).map((q, i) => `
      <div class="preview-item">
        <div class="pv-q"><span class="badge ${typeBadgeCls(q.type)}" style="font-size:11px;padding:1px 7px">${typeLabel(q.type)}</span> ${i + 1}. ${esc(q.q)}</div>
        <div class="pv-opts">${q.opts && q.opts.length
          ? q.opts.map((o, oi) => `<span class="${oi === q.ans ? 'pv-right' : ''}">${optsLabel(oi)}. ${esc(o)}${oi === q.ans ? ' ✓' : ''}</span>`).join('')
          : `<span class="pv-type">参考答案：${esc(q.ans)}</span>`}</div>
      </div>`).join('');
    return `
      <div class="card page-anim">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div class="file-chip">📄</div>
            <b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(st.fileName)}</b>
          </div>
          <span class="badge badge-blue">识别为 ${fmtName} 格式</span>
        </div>
        <div class="pv-stat">
          <div><b>${st.questions.length}</b><span>识别题目</span></div>
          <div><b>${kpCount}</b><span>知识点模块</span></div>
        </div>
        ${full ? '' : `
          <div class="field" style="margin-top:14px"><label>题库名称</label><input id="import-name" value="${esc(st.bankName)}" maxlength="20" placeholder="给题库起个名字" /></div>
          <div class="field"><label>题库描述（可选）</label><input id="import-desc" value="${esc(st.desc || '')}" maxlength="40" placeholder="例：英语单词速记" /></div>`}
        <div class="preview-list">${preview || '<div style="color:var(--text-3);font-size:13px">前3题预览</div>'}</div>
        ${full ? '<div style="font-size:13px;color:var(--warning);margin-top:10px">已达配额上限，无法继续导入。升级会员可扩容。</div>' : ''}
        <div style="display:flex;gap:10px;margin-top:16px">
          ${full
            ? `<button class="btn btn-gold" style="flex:1" data-nav="vip">升级扩容</button>`
            : `<button class="btn btn-success" style="flex:1" data-action="doImport">确认导入</button>`}
          <button class="btn btn-ghost" style="flex:1" data-action="cancelImport">重新选择</button>
        </div>
      </div>`;
  }

  /* 选择文件 → 解析（自动识别文本/二进制） → 预览 */
  function handleImportFile(file) {
    const zone = document.querySelector('#import-zone');
    const progWrap = document.querySelector('#import-progress');
    const progBar = document.querySelector('#import-progress-bar');
    const progText = document.querySelector('#import-progress-text');
    if (zone) zone.hidden = true;
    if (progWrap) progWrap.hidden = false;
    const setProgress = (pct, msg) => {
      if (progBar) progBar.style.width = (pct || 0) + '%';
      if (progText) progText.textContent = msg || '正在解析文件…';
    };
    setProgress(5, '正在读取文件…');
    window.Importer.parseFile(file, setProgress).then(res => {
      if (!res.ok) { toast(res.msg || '未能识别该文件，请检查文件格式', 'err'); return; }
      if (!res.questions || !res.questions.length) { toast('未解析到有效题目', 'err'); return; }
      importState = { fileName: file.name, format: res.format, bankName: res.bankName, desc: res.desc || '', questions: res.questions };
      render();
      toast(`已识别 ${res.questions.length} 道题目，确认后导入`, 'ok');
    }).catch(err => {
      console.error(err);
      toast('解析文件失败：' + (err && err.message || err), 'err');
    }).finally(() => {
      if (progWrap) progWrap.hidden = true;
      if (zone) zone.hidden = false;
    });
  }

  /* 确认导入 → 生成题库并存储 */
  function doImport() {
    if (!importState) return;
    const quota = Store.getPersonalBankQuota();
    if (Store.getPersonalBanks().length >= quota.limit) {
      toast('个人题库数量已达上限，升级会员可扩容', 'err');
      navigate('vip');
      return;
    }
    const nameInput = document.getElementById('import-name');
    const descInput = document.getElementById('import-desc');
    const name = (nameInput ? nameInput.value : '').trim() || importState.bankName || '我的题库';
    const desc = (descInput ? descInput.value : '').trim() || `个人导入题库 · ${importState.questions.length} 题`;
    const bank = buildPersonalBank(name, desc, importState.questions);
    const r = Store.addPersonalBank(bank);
    if (!r.ok) { toast(r.msg, 'err'); return; }
    importState = null;
    toast(`「${bank.name}」导入成功，共 ${bank.questions.length} 题`, 'ok');
    navigate('mybanks');
  }
  function buildPersonalBank(name, desc, questions) {
    const id = 'pb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const kpSet = {};
    questions.forEach((q, i) => {
      q.id = id + '_' + (i + 1);
      q.kp = q.kp || '综合';
      kpSet[q.kp] = 1;
      q.diff = q.diff || 2;
      q.explain = q.explain || '（本题暂无解析）';
      q.type = q.type || 'single';
    });
    return {
      id, name: name.slice(0, 20), desc: desc.slice(0, 40),
      color: '#688DDF', icon: 'book', personal: true,
      importedAt: Date.now(),
      kps: Object.keys(kpSet),
      questions
    };
  }
  function delBank(id) {
    const bank = Store.getPersonalBank(id);
    if (!bank) return;
    if (!confirm(`确定卸载个人题库「${bank.name}」吗？该操作不可恢复。`)) return;
    Store.removePersonalBank(id);
    toast('已卸载题库', 'ok');
    render();
  }

  /* ---------- 题库分享（分享码） ---------- */
  /* 分享码格式：XS1.<base64(压缩JSON)>，用 fflate 压缩，避免分享码过长 */
  function encodeShareCode(bank) {
    if (!bank) return '';
    const data = {
      v: 1, name: bank.name, desc: bank.desc || '',
      icon: bank.icon || 'book', color: bank.color || '#688DDF',
      questions: bank.questions.map(q => ({
        type: q.type || 'single', q: q.q, opts: q.opts || [],
        ans: q.ans, explain: q.explain || '', kp: q.kp || '综合', diff: q.diff || 2
      }))
    };
    const json = JSON.stringify(data);
    try {
      const fflate = window.fflate;
      const bytes = fflate ? fflate.deflateSync(new TextEncoder().encode(json), { level: 6 }) : new TextEncoder().encode(json);
      let bin = '';
      bytes.forEach(b => bin += String.fromCharCode(b));
      return 'XS1.' + btoa(bin);
    } catch (e) {
      return '';
    }
  }
  function decodeShareCode(code) {
    try {
      const c = String(code || '').trim();
      if (!c.startsWith('XS1.')) return { ok: false, msg: '分享码格式不正确（应以 XS1. 开头）' };
      const b64 = c.slice(4);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const fflate = window.fflate;
      const text = fflate ? new TextDecoder().decode(fflate.inflateSync(bytes)) : new TextDecoder().decode(bytes);
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.questions) || !data.questions.length) return { ok: false, msg: '分享码中没有有效题目' };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, msg: '分享码无效或已损坏，请检查是否完整复制' };
    }
  }
  /* 分享弹窗：展示分享码 + 复制 */
  function openShareBank(bankId) {
    const bank = Store.getPersonalBank(bankId);
    if (!bank) return;
    const code = encodeShareCode(bank);
    if (!code) { toast('题库过大，分享码生成失败，请尝试导出文件', 'err'); return; }
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-head"><h3>分享题库「${esc(bank.name)}」</h3><button class="modal-close" data-close>${window.ICONS.close}</button></div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:10px">把下面的分享码发给好友，对方在「导入题库」页粘贴即可一键导入（共 ${bank.questions.length} 题）。</p>
          <div class="share-code-box" id="share-code-text">${esc(code)}</div>
          <div style="display:flex;gap:10px;margin-top:14px">
            <button class="btn btn-primary" style="flex:1" data-copy>复制分享码</button>
            <button class="btn btn-ghost" data-close>关闭</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    mask.querySelector('[data-copy]').addEventListener('click', () => {
      const box = mask.querySelector('#share-code-text');
      const ta = document.createElement('textarea');
      ta.value = box.textContent;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('分享码已复制，去发给好友吧', 'ok'); }
      catch (e) { toast('复制失败，请长按手动复制', 'err'); }
      ta.remove();
    });
  }
  /* 粘贴分享码 → 解码 → 进入导入预览 */
  function importShareCode() {
    const inp = document.getElementById('share-code-input');
    const code = inp ? inp.value.trim() : '';
    if (!code) return toast('请先粘贴分享码', 'err');
    const r = decodeShareCode(code);
    if (!r.ok) { toast(r.msg, 'err'); return; }
    const d = r.data;
    const questions = d.questions.map(q => ({
      q: q.q, opts: q.opts || [], ans: q.ans, explain: q.explain,
      kp: q.kp, diff: q.diff, type: q.type
    }));
    importState = {
      fileName: '分享码 · ' + (d.name || '好友题库'),
      format: 'share', bankName: d.name || '好友题库',
      desc: d.desc || '', questions
    };
    render();
    toast(`已解析分享题库（${questions.length} 题），确认后导入`, 'ok');
  }

  /* ---------- 模板下载 & AI 提示词 ---------- */
  const TEMPLATES = {
    csv: '题型,题干,选项A,选项B,选项C,选项D,答案,解析,知识点\n单选题,我国的根本政治制度是什么？,人民代表大会制度,多党合作制,民族区域自治,基层群众自治,A,我国的根本政治制度是人民代表大会制度。,政治常识\n判断题,光在真空中传播速度约为30万公里/秒。,对,错,,,对,真空光速是物理学基本常数。,物理常识\n填空题,我国的国歌是《____》。,,,,\n义勇军进行曲,音乐常识\n主观题,请简述中国特色社会主义进入新时代的主要矛盾。,要求分点作答、条理清晰。,,,,\n新时代我国社会主要矛盾是人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾。,政治常识\n',
    md: '# 我的题库\n\n## 单选题\n1. 我国的根本政治制度是什么？\n- A. 人民代表大会制度\n- B. 多党合作制\n- C. 民族区域自治\n- D. 基层群众自治\n\n**答案：A**\n**解析：** 我国的根本政治制度是人民代表大会制度。\n\n## 判断题\n1. 光在真空中传播速度约为30万公里/秒。（对）\n**解析：** 真空光速是物理学基本常数。\n\n## 填空题\n1. 我国的国歌是《____》。\n**答案：** 义勇军进行曲\n\n## 主观题\n1. 请简述中国特色社会主义进入新时代的主要矛盾。\n**答案：** 新时代我国社会主要矛盾是人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾。\n',
    json: '[\n  {\n    "q": "我国的根本政治制度是什么？",\n    "type": "single",\n    "opts": ["人民代表大会制度", "多党合作制", "民族区域自治", "基层群众自治"],\n    "ans": 0,\n    "explain": "我国的根本政治制度是人民代表大会制度。",\n    "kp": "政治常识",\n    "diff": 1\n  },\n  {\n    "q": "光在真空中传播速度约为30万公里/秒。",\n    "type": "judge",\n    "opts": ["对", "错"],\n    "ans": 0,\n    "explain": "真空光速是物理学基本常数。",\n    "kp": "物理常识",\n    "diff": 1\n  }\n]\n'
  };
  function downloadTemplate(fmt) {
    const text = TEMPLATES[fmt];
    if (!text) return toast('模板不存在', 'err');
    const ext = fmt === 'csv' ? 'csv' : fmt === 'md' ? 'md' : 'json';
    const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '题库模板.' + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('模板已下载，填写后导入即可', 'ok');
  }
  function copyAiPrompt() {
    const box = document.getElementById('ai-prompt-box');
    if (!box) return;
    const ta = document.createElement('textarea');
    ta.value = box.textContent.trim();
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('提示词已复制，发给 AI 出题吧', 'ok'); }
    catch (e) { toast('复制失败，请手动长按复制', 'err'); }
    ta.remove();
  }

  /* ---------- 刷题会话 ---------- */
  function startQuiz(bankId, opts = {}) {
    let list;
    if (bankId === 'random') {
      list = shuffle(allQuestions()).slice(0, opts.count || 20);
    } else if (opts.kp) {
      list = allQuestions().filter(q => q.kp === opts.kp);
    } else if (bankId === 'wrong') {
      list = Store.getWrongList().map(w => questionById(w.qid)).filter(Boolean);
      if (!list.length) return toast('错题本为空，先去刷几题吧', 'err');
    } else {
      const bank = bankById(bankId);
      if (!bank) return;
      list = shuffle(bank.questions.map(q => ({ ...q, bank: bank.id, bankName: bank.name })));
      if (opts.count) list = list.slice(0, opts.count);
    }
    if (!list.length) return toast('该题库暂无题目', 'err');
    // 免费用户额度检查
    const quota = Store.getQuota();
    if (quota.limit !== 9999 && quota.used >= quota.limit) {
      toast('今日免费额度已用完，开通会员不限量刷题', 'err');
      navigate('vip');
      return;
    }
    quiz = {
      list, idx: 0, answers: {}, mode: opts.mode || 'practice', timer: null, seconds: 0,
      title: opts.title || '刷题练习', qStartedAt: Date.now()
    };
    navigate('quiz/run');
  }

  function renderQuiz() {
    const u = Store.getUser();
    if (!quiz) { navigate('home'); return; }
    if (!quiz.qStartedAt) quiz.qStartedAt = Date.now();
    const q = quiz.list[quiz.idx];
    const doneCount = Object.keys(quiz.answers).filter(k => quiz.answers[k] !== 'skip').length;
    const isAnswered = quiz.answers[quiz.idx] !== undefined && quiz.answers[quiz.idx] !== 'skip';
    const selected = quiz.answers[quiz.idx];

    $app.innerHTML = `
      <div class="quiz-head">
        <div class="quiz-head-inner">
          <div class="brand-logo" style="width:34px;height:34px;cursor:pointer" data-nav="practice"><img src="./assets/logo.png" alt="" /></div>
          <div class="quiz-title">${esc(quiz.title)}</div>
          <div class="quiz-progress-txt">${quiz.idx + 1}/${quiz.list.length}</div>
        </div>
      </div>
      <div class="page" style="padding-bottom:120px">
        <div class="container" style="max-width:760px">
          <div class="progress-bar" style="margin:14px 0"><i style="width:${(quiz.idx + 1) / quiz.list.length * 100}%"></i></div>
          <div class="card">
            <div class="question-tags">
              <span class="badge badge-purple">${esc(q.bankName || '')}</span>
              <span class="badge badge-blue">${esc(q.kp)}</span>
              <span class="badge badge-orange">${diffLabel(q.diff)}</span>
              <span class="badge ${typeBadgeCls(q.type)}">${typeLabel(q.type)}</span>
            </div>
            <div class="quiz-tools">
              <button class="quiz-tool-btn fav ${Store.isFav(q.id) ? 'active' : ''}" data-action="toggleFav" title="收藏本题，方便日后复习">${window.ICONS.medal} 收藏</button>
              <button class="quiz-tool-btn flag ${Store.isFlagged(q.id) ? 'active' : ''}" data-action="toggleFlag" title="标记疑难，重点攻克">${window.ICONS.target} 标记疑难</button>
            </div>
            <div class="question-text">${esc(q.q)}</div>
            ${quizAnswerArea(q, isAnswered, selected)}
            ${quizAnswerPanel(q, isAnswered, selected)}
            <div class="quiz-actions">
              ${canProceed(quiz.answers, quiz.selfJudge, q, quiz.idx) ? `<button class="btn btn-block" data-action="next">${quiz.idx === quiz.list.length - 1 ? '完成' : '下一题'}</button>` : ''}
            </div>
          </div>
          <div class="card sheet-panel ${quizSheetOpen ? 'open' : ''}" style="margin-top:14px">
            <button class="sheet-head" data-action="toggleSheet" type="button">
              <span class="sheet-title">答题卡</span>
              <span class="sheet-count">已答 ${doneCount}/${quiz.list.length}</span>
              <span class="sheet-arrow">${window.ICONS.chevronDown}</span>
            </button>
            <div class="sheet-body">
              <div class="sheet-grid">
                ${quiz.list.map((qq, i) => {
                  const a = quiz.answers[i];
                  const cur = i === quiz.idx ? 'current' : '';
                  const done = a !== undefined && a !== 'skip' ? 'done' : '';
                  return `<div class="sheet-item ${cur} ${done}" data-jump="${i}">${i + 1}</div>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="quiz-actions" style="margin-top:14px">
            <button class="btn btn-ghost" data-action="quit">退出</button>
            ${!isAnswered ? `<button class="btn" data-action="skip">跳过</button>` : ''}
          </div>
        </div>
      </div>`;

    // 绑定
    $app.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        if (quiz.answers[quiz.idx] !== undefined) return;
        const idx = +el.dataset.opt;
        answerQuestion(idx);
      });
    });
    $app.querySelectorAll('[data-action="toggleFav"]').forEach(el => el.addEventListener('click', () => {
      const q = quiz.list[quiz.idx];
      if (!q.id) return toast('该题暂不支持收藏', 'err');
      const on = Store.toggleFav(q.id);
      el.classList.toggle('active', on);
      toast(on ? '⭐ 已收藏本题' : '已取消收藏');
    }));
    $app.querySelectorAll('[data-action="toggleFlag"]').forEach(el => el.addEventListener('click', () => {
      const q = quiz.list[quiz.idx];
      if (!q.id) return toast('该题暂不支持标记', 'err');
      const on = Store.toggleFlag(q.id);
      el.classList.toggle('active', on);
      toast(on ? '🚩 已标记疑难，重点复习' : '已取消标记');
    }));
    $app.querySelectorAll('[data-action="next"]').forEach(el => el.addEventListener('click', nextQuestion));
    $app.querySelectorAll('[data-action="skip"]').forEach(el => el.addEventListener('click', () => { quiz.answers[quiz.idx] = 'skip'; nextQuestion(); }));
    $app.querySelectorAll('[data-action="quit"]').forEach(el => el.addEventListener('click', () => { quiz = null; navigate('practice'); }));
    $app.querySelectorAll('[data-action="submitFill"]').forEach(el => el.addEventListener('click', submitFillAnswer));
    $app.querySelectorAll('[data-action="submitSubj"]').forEach(el => el.addEventListener('click', submitSubjAnswer));
    $app.querySelectorAll('[data-action="selfJudge"]').forEach(el => el.addEventListener('click', () => selfJudge(el.dataset.ok === '1')));
    $app.querySelectorAll('.fill-input').forEach(el => el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitFillAnswer(); }
    }));
    $app.querySelectorAll('.sheet-item[data-jump]').forEach(el => el.addEventListener('click', () => { quiz.idx = +el.dataset.jump; renderQuiz(); }));
    $app.querySelectorAll('[data-action="toggleSheet"]').forEach(el => el.addEventListener('click', () => {
      quizSheetOpen = !quizSheetOpen;
      el.closest('.sheet-panel').classList.toggle('open', quizSheetOpen);
    }));
    $app.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }

  /* 刷题页：作答区（选择/判断→选项按钮；填空→输入框；主观题→文本域） */
  function quizAnswerArea(q, isAnswered, selected) {
    if (q.type === 'fill') {
      const refs = splitBlanks(q.ans);
      if (!isAnswered) {
        const inputs = (refs.length > 1 ? refs : ['']).map((_, i) =>
          `<input class="fill-input" data-blank="${i}" placeholder="填写第 ${i + 1} 空" />`).join('');
        return `<div class="fill-wrap">${inputs}<button class="btn btn-primary" data-action="submitFill">提交答案</button></div>`;
      }
      const vals = String(selected || '').split(/[|｜]/);
      return `<div class="fill-wrap fill-done">${(refs.length > 1 ? refs : ['']).map((_, i) =>
        `<span class="fill-readonly">${esc(vals[i] || '')}</span>`).join('')}</div>`;
    }
    if (q.type === 'subjective') {
      if (!isAnswered) {
        return `<div class="fill-wrap"><textarea class="subj-input" rows="5" placeholder="请输入你的作答…"></textarea><button class="btn btn-primary" data-action="submitSubj">提交答案</button></div>`;
      }
      return `<div class="subj-done">${esc(String(selected || ''))}</div>`;
    }
    return `<div class="quiz-answer-grid" data-answered="${isAnswered}">
      ${q.opts.map((opt, i) => {
        let cls = '';
        if (isAnswered) {
          if (i === q.ans) cls = 'correct';
          else if (i === selected) cls = 'wrong';
        } else if (i === selected) cls = 'selected';
        return `<button class="quiz-option ${cls} ${isAnswered ? 'disabled' : ''}" data-opt="${i}">
          <span class="opt-key">${optsLabel(i)}</span><span>${esc(opt)}</span>
        </button>`;
      }).join('')}
    </div>`;
  }
  /* 刷题页：答案解析面板（填空题自动判分；主观题需自评） */
  /* 深度解析（会员）：基于题型/考点生成结构化学习指导，非 AI 生成 */
  function deepExplainSection(q) {
    const u = Store.getUser();
    const vip = Store.isVip(u);
    const typeName = typeLabel(q.type);
    const tips = {
      single: '先排除明显错误项，再比较剩余选项与题干的匹配度；注意绝对化表述（如"一定/必然/所有"）多为干扰项。',
      judge: '判断题多考查概念的精确边界，留意"总是/从不/全部"等绝对化词语，也要提防偷换主语或时间。',
      fill: '填空题关注关键词与限定语；多空作答时注意答案之间的逻辑衔接与顺序。',
      subjective: '主观题先答核心结论，再分点展开；按"原理+材料+结论"结构组织答案，尽量使用学科术语。'
    }[q.type] || '先抓题干关键词，再对照知识点逐项分析。';
    if (!vip) {
      return `
        <div class="explain-deep explain-deep-locked">
          <div class="ed-head">🔒 深度解析（${typeName}专练）</div>
          <div class="ed-body">
            <div class="ed-row"><span class="ed-label">解题思路</span><span>${tips}</span></div>
            <div class="ed-row"><span class="ed-label">易错点</span><span>题干关键词与选项设陷位置分析（会员可见）</span></div>
          </div>
          <div class="ed-lock-tip"><a data-nav="vip">开通会员</a> 解锁完整深度解析，刷题效率翻倍</div>
        </div>`;
    }
    return `
      <div class="explain-deep">
        <div class="ed-head">🧠 深度解析 · ${typeName}</div>
        <div class="ed-body">
          <div class="ed-row"><span class="ed-label">考查知识点</span><span>${esc(q.kp || '综合')}</span></div>
          <div class="ed-row"><span class="ed-label">解题思路</span><span>${tips}</span></div>
          <div class="ed-row"><span class="ed-label">难度等级</span><span>${diffLabel(q.diff)}</span></div>
          <div class="ed-row"><span class="ed-label">强化建议</span><span>${q.type === 'subjective'
            ? '结合本题答案要点，口述复述一遍加深记忆；同类题型建议 3 天后重练。'
            : q.type === 'fill'
              ? '把易错空位做成记忆卡片，早晚各复习一次。'
              : '错题已自动加入错题本，建议 1 / 3 / 7 天间隔复习巩固。'}</span></div>
        </div>
      </div>`;
  }

  function quizAnswerPanel(q, isAnswered, selected) {
    if (!isAnswered) return '';
    if (q.type === 'subjective') {
      const self = quiz.selfJudge && quiz.selfJudge[quiz.idx];
      if (self === undefined) {
        return `<div class="answer-panel answer-info-panel">
          <h4>已提交，请对照参考答案自评</h4>
          <div class="ref-answer"><b>参考答案：</b>${esc(q.ans)}</div>
          <div class="explain-text"><b>基础解析：</b>${esc(q.explain)}</div>
          ${deepExplainSection(q)}
          <div style="display:flex;gap:10px;margin-top:12px">
            <button class="btn btn-success" style="flex:1" data-action="selfJudge" data-ok="1">我答对了</button>
            <button class="btn btn-danger" style="flex:1" data-action="selfJudge" data-ok="0">我答错了</button>
          </div>
        </div>`;
      }
      const ok = self === true;
      return `<div class="answer-panel ${ok ? 'answer-correct-panel' : 'answer-wrong-panel'}">
        <h4>${ok ? '✓ 自评正确' : '✗ 自评错误'}</h4>
        <div class="ref-answer"><b>参考答案：</b>${esc(q.ans)}</div>
        <div class="explain-text"><b>基础解析：</b>${esc(q.explain)}</div>
        ${deepExplainSection(q)}
      </div>`;
    }
    if (q.type === 'fill') {
      const ok = checkFill(q.ans, selected);
      return `<div class="answer-panel ${ok ? 'answer-correct-panel' : 'answer-wrong-panel'}">
        <h4>${ok ? '✓ 回答正确' : '✗ 回答错误'}</h4>
        <div class="ref-answer"><b>正确答案：</b>${esc(q.ans)}</div>
        <div class="explain-text"><b>基础解析：</b>${esc(q.explain)}</div>
        ${deepExplainSection(q)}
      </div>`;
    }
    return `<div class="answer-panel ${selected === q.ans ? 'answer-correct-panel' : 'answer-wrong-panel'}">
      <h4>${selected === q.ans ? '✓ 回答正确' : '✗ 回答错误'}</h4>
      <div style="font-size:14px">正确答案：<b>${optsLabel(q.ans)}. ${esc(q.opts[q.ans])}</b></div>
      <div class="explain-text"><b>基础解析：</b>${esc(q.explain)}</div>
      ${deepExplainSection(q)}
    </div>`;
  }

  function answerQuestion(optIdx) {
    const q = quiz.list[quiz.idx];
    quiz.answers[quiz.idx] = optIdx;
    if (!recordAnswerWithQuota(q, optIdx === q.ans)) return;
    renderQuiz();
  }

  /* 填空题：多空输入 → 自动判分 */
  function submitFillAnswer() {
    const q = quiz.list[quiz.idx];
    if (quiz.answers[quiz.idx] !== undefined) return;
    const refs = splitBlanks(q.ans);
    const inputs = $app.querySelectorAll('.fill-input');
    if (!inputs.length) return;
    const vals = Array.from(inputs).map(el => (el.value || '').trim());
    if (vals.some(v => !v)) return toast('请填写全部答案后再提交', 'err');
    const ansText = refs.length > 1 ? vals.join('|') : vals[0];
    quiz.answers[quiz.idx] = ansText;
    if (!recordAnswerWithQuota(q, checkFill(q.ans, ansText))) return;
    renderQuiz();
  }
  /* 主观题：文本作答 → 提交后自评 */
  function submitSubjAnswer() {
    const q = quiz.list[quiz.idx];
    if (quiz.answers[quiz.idx] !== undefined) return;
    const ta = $app.querySelector('.subj-input');
    const val = (ta ? ta.value : '').trim();
    if (!val) return toast('请输入作答内容后再提交', 'err');
    quiz.answers[quiz.idx] = val;
    renderQuiz();
  }
  function selfJudge(correct) {
    const q = quiz.list[quiz.idx];
    if (quiz.answers[quiz.idx] === undefined || quiz.answers[quiz.idx] === 'skip') return;
    if (!quiz.selfJudge) quiz.selfJudge = {};
    quiz.selfJudge[quiz.idx] = correct;
    if (!recordAnswerWithQuota(q, correct)) return;
    renderQuiz();
  }

  function nextQuestion() {
    if (quiz.idx < quiz.list.length - 1) {
      quiz.idx++;
      quiz.qStartedAt = Date.now();
      renderQuiz();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    let correct = 0, wrong = 0, skip = 0;
    quiz.list.forEach((q, i) => {
      const a = quiz.answers[i];
      if (a === undefined || a === 'skip') { skip++; return; }
      if (q.type === 'subjective') {
        const s = quiz.selfJudge && quiz.selfJudge[i];
        if (s === true) correct++;
        else if (s === false) wrong++;
        else skip++;
      } else if (q.type === 'fill') {
        if (checkFill(q.ans, a)) correct++; else wrong++;
      } else {
        if (a === q.ans) correct++; else wrong++;
      }
    });
    const title = quiz.title;
    const total = quiz.list.length;
    window._lastQuizDetail = { list: quiz.list, answers: quiz.answers, selfJudge: quiz.selfJudge || {} };
    quiz = null;
    renderResult({ title, total, correct, wrong, skip, from: 'quiz' });
  }

  /* ---------- 模拟考试 ---------- */
  function startExam(paperId) {
    const paper = EXAM_PAPERS.find(p => p.id === paperId);
    if (!paper) return;
    if (!Store.isVip()) { toast('模拟考试为会员功能，请先开通VIP', 'err'); navigate('vip'); return; }
    const bank = bankById(paper.bank);
    exam = {
      paper, idx: 0, answers: {}, list: shuffle(bank.questions.map(q => ({ ...q, bank: bank.id, bankName: bank.name }))),
      seconds: paper.minutes * 60
    };
    navigate('exam/run');
  }

  /* 考试页：作答区（选择/判断→选项按钮；填空→输入框；主观题→文本域+自评） */
  function examAnswerArea(q, isAnswered) {
    if (q.type === 'fill') {
      if (!isAnswered) {
        const refs = splitBlanks(q.ans);
        const inputs = (refs.length > 1 ? refs : ['']).map((_, i) =>
          `<input class="fill-input" data-blank="${i}" placeholder="填写第 ${i + 1} 空" />`).join('');
        return `<div class="fill-wrap">${inputs}<button class="btn btn-primary" data-action="examSubmitFill">提交</button></div>`;
      }
      return `<div class="fill-wrap fill-done"><span class="fill-readonly">已作答 ✓</span></div>`;
    }
    if (q.type === 'subjective') {
      if (!isAnswered) {
        return `<div class="fill-wrap"><textarea class="subj-input" rows="5" placeholder="请输入你的作答…"></textarea><button class="btn btn-primary" data-action="examSubmitSubj">提交</button></div>`;
      }
      const self = exam.selfJudge && exam.selfJudge[exam.idx];
      if (self === undefined) {
        return `<div class="answer-panel answer-info-panel" style="margin-top:0">
          <h4>已提交作答，请根据掌握情况自评</h4>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-success" style="flex:1" data-action="examSelfJudge" data-ok="1">我有把握</button>
            <button class="btn btn-danger" style="flex:1" data-action="examSelfJudge" data-ok="0">不太确定</button>
          </div>
        </div>`;
      }
      return `<div class="subj-done">已作答${self ? '（自评正确）' : '（自评错误）'}</div>`;
    }
    return `<div class="quiz-answer-grid">
      ${q.opts.map((opt, i) => {
        const cls = i === isAnswered ? 'selected' : '';
        return `<button class="quiz-option ${cls}" data-opt="${i}"><span class="opt-key">${optsLabel(i)}</span><span>${esc(opt)}</span></button>`;
      }).join('')}
    </div>`;
  }
  function examNextReady() {
    const q = exam.list[exam.idx];
    const a = exam.answers[exam.idx];
    if (a === undefined) return false;
    if (q.type === 'subjective') return !!(exam.selfJudge && exam.selfJudge[exam.idx] !== undefined);
    return true;
  }
  function examSubmitFill() {
    const q = exam.list[exam.idx];
    if (exam.answers[exam.idx] !== undefined) return;
    const refs = splitBlanks(q.ans);
    const inputs = $app.querySelectorAll('.fill-input');
    if (!inputs.length) return;
    const vals = Array.from(inputs).map(el => (el.value || '').trim());
    if (vals.some(v => !v)) return toast('请填写全部答案后再提交', 'err');
    exam.answers[exam.idx] = refs.length > 1 ? vals.join('|') : vals[0];
    renderExamRun();
  }
  function examSubmitSubj() {
    if (exam.answers[exam.idx] !== undefined) return;
    const ta = $app.querySelector('.subj-input');
    const val = (ta ? ta.value : '').trim();
    if (!val) return toast('请输入作答内容后再提交', 'err');
    exam.answers[exam.idx] = val;
    renderExamRun();
  }
  function examSelfJudge(correct) {
    const q = exam.list[exam.idx];
    if (exam.answers[exam.idx] === undefined) return;
    if (!exam.selfJudge) exam.selfJudge = {};
    exam.selfJudge[exam.idx] = correct;
    renderExamRun();
  }

  function renderExamRun() {
    if (!exam) { navigate('exam'); return; }
    const q = exam.list[exam.idx];
    const isAnswered = exam.answers[exam.idx] !== undefined;
    const selected = exam.answers[exam.idx];
    const mm = Math.floor(exam.seconds / 60), ss = exam.seconds % 60;

    $app.innerHTML = `
      <div class="quiz-head">
        <div class="quiz-head-inner">
          <div class="quiz-title" style="color:var(--danger)">${window.ICONS.clock} ${esc(exam.paper.name)}</div>
          <div class="quiz-progress-txt" style="font-weight:700;color:var(--danger)">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</div>
        </div>
      </div>
      <div class="page" style="padding-bottom:120px">
        <div class="container" style="max-width:760px">
          <div class="card" style="margin-top:14px">
            <div style="font-size:13px;color:var(--text-3);margin-bottom:10px">第 ${exam.idx + 1} 题 / 共 ${exam.list.length} 题</div>
            <div class="question-tags">
              <span class="badge badge-purple">${esc(q.bankName || '')}</span>
              <span class="badge badge-blue">${esc(q.kp)}</span>
              <span class="badge ${typeBadgeCls(q.type)}">${typeLabel(q.type)}</span>
            </div>
            <div class="question-text">${esc(q.q)}</div>
            ${examAnswerArea(q, isAnswered)}
          </div>
          <div class="card sheet-panel ${examSheetOpen ? 'open' : ''}" style="margin-top:14px">
            <button class="sheet-head" data-action="toggleSheet" type="button">
              <span class="sheet-title">答题卡</span>
              <span class="sheet-count">已答 ${Object.keys(exam.answers).length}/${exam.list.length}</span>
              <span class="sheet-arrow">${window.ICONS.chevronDown}</span>
            </button>
            <div class="sheet-body">
              <div class="sheet-grid">
                ${exam.list.map((qq, i) => {
                  const cur = i === exam.idx ? 'current' : '';
                  const done = exam.answers[i] !== undefined ? 'done' : '';
                  return `<div class="sheet-item ${cur} ${done}" data-jump="${i}">${i + 1}</div>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="quiz-actions" style="margin-top:14px">
            <button class="btn btn-ghost" data-action="examQuit">放弃考试</button>
            ${!isAnswered ? `<button class="btn" data-action="examSkip">跳过</button>`
              : examNextReady()
                ? exam.idx === exam.list.length - 1
                  ? `<button class="btn btn-success" data-action="examSubmit">交卷</button>`
                  : `<button class="btn" data-action="examNext">下一题</button>`
                : ''}
          </div>
        </div>
      </div>`;

    $app.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        if (exam.answers[exam.idx] !== undefined) return;
        exam.answers[exam.idx] = +el.dataset.opt;
        renderExamRun();
      });
    });
    $app.querySelectorAll('[data-action="examNext"]').forEach(el => el.addEventListener('click', () => {
      if (exam.idx < exam.list.length - 1) { exam.idx++; renderExamRun(); }
    }));
    $app.querySelectorAll('[data-action="examSkip"]').forEach(el => el.addEventListener('click', () => {
      if (exam.idx < exam.list.length - 1) { exam.idx++; renderExamRun(); }
    }));
    $app.querySelectorAll('[data-action="examSubmit"]').forEach(el => el.addEventListener('click', submitExam));
    $app.querySelectorAll('[data-action="examSubmitFill"]').forEach(el => el.addEventListener('click', examSubmitFill));
    $app.querySelectorAll('[data-action="examSubmitSubj"]').forEach(el => el.addEventListener('click', examSubmitSubj));
    $app.querySelectorAll('[data-action="examSelfJudge"]').forEach(el => el.addEventListener('click', () => examSelfJudge(el.dataset.ok === '1')));
    $app.querySelectorAll('.fill-input').forEach(el => el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); examSubmitFill(); }
    }));
    $app.querySelectorAll('[data-action="examQuit"]').forEach(el => el.addEventListener('click', () => {
      if (confirm('确定要放弃本次考试吗？')) { exam = null; navigate('exam'); }
    }));
    $app.querySelectorAll('.sheet-item[data-jump]').forEach(el => el.addEventListener('click', () => { exam.idx = +el.dataset.jump; renderExamRun(); }));
    $app.querySelectorAll('[data-action="toggleSheet"]').forEach(el => el.addEventListener('click', () => {
      examSheetOpen = !examSheetOpen;
      el.closest('.sheet-panel').classList.toggle('open', examSheetOpen);
    }));

    // 计时器
    clearInterval(exam.timer);
    exam.timer = setInterval(() => {
      if (!exam) return clearInterval(exam.timer);
      exam.seconds--;
      const head = $app.querySelector('.quiz-progress-txt');
      if (head) {
        const mm2 = Math.floor(exam.seconds / 60), ss2 = exam.seconds % 60;
        head.textContent = `${String(mm2).padStart(2, '0')}:${String(ss2).padStart(2, '0')}`;
        if (exam.seconds <= 60) head.style.color = 'var(--danger)';
      }
      if (exam.seconds <= 0) { submitExam(); }
    }, 1000);
  }

  function submitExam() {
    if (!exam) return;
    clearInterval(exam.timer);
    let correct = 0, wrong = 0, skip = 0;
    exam.list.forEach((q, i) => {
      const a = exam.answers[i];
      if (a === undefined) { skip++; return; }
      let ok;
      if (q.type === 'subjective') {
        const s = exam.selfJudge && exam.selfJudge[i];
        if (s === true) { ok = true; correct++; }
        else if (s === false) { ok = false; wrong++; }
        else { skip++; return; }
      } else if (q.type === 'fill') {
        ok = checkFill(q.ans, a);
        if (ok) correct++; else wrong++;
      } else {
        ok = a === q.ans;
        if (ok) correct++; else wrong++;
      }
      Store.recordAnswer(q.id, ok);
    });
    const title = exam.paper.name;
    const total = exam.list.length;
    const used = exam.paper.minutes * 60 - exam.seconds;
    window._lastQuizDetail = { list: exam.list, answers: exam.answers, selfJudge: exam.selfJudge || {} };
    exam = null;
    renderResult({ title, total, correct, wrong, skip, from: 'exam', used });
  }

  function renderExamResult() {
    const r = window._lastResult;
    if (!r) { navigate('home'); return; }
    const pct = r.total ? Math.round(r.correct / r.total * 100) : 0;
    const mm = Math.floor((r.used || 0) / 60), ss = (r.used || 0) % 60;
    const circumference = 2 * Math.PI * 52;
    const ringColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
    return (window.__examResultHtml = `
      <div class="container" style="max-width:640px">
        <div class="card page-anim" style="margin-top:20px">
          <div class="result-hero">
            <div class="result-ring">
              <svg width="130" height="130"><circle cx="65" cy="65" r="52" fill="none" stroke="var(--border)" stroke-width="10"/><circle cx="65" cy="65" r="52" fill="none" stroke="${ringColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct / 100)}" style="transition:.8s"/></svg>
              <div class="rr-center"><b style="color:${ringColor}">${pct}%</b><span>正确率</span></div>
            </div>
            <h3>${esc(r.title)} 成绩单</h3>
            <div style="display:flex;justify-content:center;gap:26px;margin-top:16px;flex-wrap:wrap">
              <div style="text-align:center"><b style="font-size:22px;color:var(--success)">${r.correct}</b><div style="font-size:12px;color:var(--text-3)">答对</div></div>
              <div style="text-align:center"><b style="font-size:22px;color:var(--danger)">${r.wrong}</b><div style="font-size:12px;color:var(--text-3)">答错</div></div>
              <div style="text-align:center"><b style="font-size:22px;color:var(--text-3)">${r.skip}</b><div style="font-size:12px;color:var(--text-3)">未答</div></div>
              <div style="text-align:center"><b style="font-size:22px">${r.total}</b><div style="font-size:12px;color:var(--text-3)">总题数</div></div>
            </div>
            ${r.used !== undefined ? `<p style="font-size:13px;color:var(--text-3);margin-top:10px">用时 ${mm} 分 ${ss} 秒</p>` : ''}
            <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
              <button class="btn" data-action="reviewResult">查看全部解析</button>
              <button class="btn btn-ghost" data-action="goWrong">查看错题</button>
              <button class="btn btn-outline" data-action="backHome">返回首页</button>
            </div>
          </div>
        </div>
      </div>`);
  }

  function renderResult(r) {
    window._lastResult = r;
    renderExamResult(); // 预生成结果页 HTML
    navigate('examResult');
  }

  /* ---------- 结果页：解析/错题 ---------- */
  function renderExamResultPage() {
    // 此函数在 renderExamResult 后调用
  }

  /* ---------- 全局事件绑定 ---------- */
  function bindPage() {
    const root = document.getElementById('page-root') || $app;
    // 数据导航
    root.querySelectorAll('[data-nav]').forEach(el => {
      const nav = el.dataset.nav;
      if (['home', 'practice', 'train', 'exam', 'wrong', 'vip', 'stats', 'profile', 'mybanks', 'import', 'orders', 'contact', 'materials'].includes(nav)) {
        el.addEventListener('click', () => navigate(nav));
      } else if (nav === 'quiz') {
        el.addEventListener('click', () => startQuiz(el.dataset.bank || 'random'));
      } else if (nav === 'trainkp') {
        el.addEventListener('click', () => navigate('trainkp/' + el.dataset.bank));
      }
    });

    // 通用 action
    root.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const a = el.dataset.action;
        const u = Store.getUser();
        if (a === 'back') { back(); }
        else if (a === 'unlock') { navigate('vip'); }
        else if (a === 'train') {
          const m = el.dataset.mode;
          if (m === 'random') startQuiz('random', { title: '随机刷题', mode: 'train' });
          else if (m === 'bykp') navigate('trainkp/' + QUESTION_BANKS[0].id);
          else if (m === 'wrong') startQuiz('wrong', { title: '错题重练' });
          else if (m === 'speed') {
            if (!Store.canUse('vip1')) { toast('限时冲刺为会员功能', 'err'); navigate('vip'); return; }
            startQuiz('random', { title: '限时冲刺 · 30分钟', mode: 'speed', count: 20 });
          }
        }
        else if (a === 'startKp') { startQuiz(el.dataset.bank, { kp: el.dataset.kp, title: '专项·' + el.dataset.kp }); }
        else if (a === 'startExam') { startExam(el.dataset.paper); }
        else if (a === 'pay') { openPay(el.dataset.plan); }
        else if (a === 'redoWrong') { startQuiz('wrong', { title: '错题重练' }); }
        else if (a === 'clearWrong') {
          if (confirm('确定清空错题本吗？')) { Store.getWrongList().forEach(w => Store.removeWrong(w.qid)); toast('错题本已清空', 'ok'); render(); }
        }
        else if (a === 'redoOne') { startQuizFromWrong(el.dataset.qid); }
        else if (a === 'markOne') { startQuizFromWrong(el.dataset.qid, el.dataset.title || '巩固练习'); }
        else if (a === 'logout') { Store.logout(); render(); }
        else if (a === 'reviewResult') { openResultReview(); }
        else if (a === 'goWrong') { navigate('wrong'); }
        else if (a === 'backHome') { navigate('home'); }
        else if (a === 'goImport') { navigate('import'); }
        else if (a === 'cancelImport') { importState = null; render(); }
        else if (a === 'doImport') { doImport(); }
        else if (a === 'trainBank') { startQuiz(el.dataset.bank, { title: '我的题库 · ' + (bankById(el.dataset.bank)?.name || '刷题') }); }
        else if (a === 'delBank') { delBank(el.dataset.bank); }
        else if (a === 'shareBank') { openShareBank(el.dataset.bank); }
        else if (a === 'importShareCode') { importShareCode(); }
        else if (a === 'dlTemplate') { downloadTemplate(el.dataset.fmt); }
        else if (a === 'copyAiPrompt') { copyAiPrompt(); }
        else if (a === 'server') { openServerSettings(); }
        else if (a === 'privacy') { navigate('policy'); }
        else if (a === 'agreement') { navigate('agreement'); }
        else if (a === 'redeem') { openRedeem(); }
        else if (a === 'submitTicket') { submitTicket(); }
      });
    });

    // 删除错题 / 取消收藏 / 移除标记
    root.querySelectorAll('[data-del]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const kind = el.dataset.kind;
        if (kind === 'favs') { Store.toggleFav(el.dataset.del); toast('已取消收藏', 'ok'); }
        else if (kind === 'flags') { Store.toggleFlag(el.dataset.del); toast('已移除标记', 'ok'); }
        else { Store.removeWrong(el.dataset.del); toast('已移出错题', 'ok'); }
        render();
      });
    });

    // 角色选择
    root.querySelectorAll('[data-role]').forEach(el => {
      el.addEventListener('click', () => {
        root.querySelectorAll('[data-role]').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        const h = el.closest('.field')?.querySelector('input[name=role]');
        if (h) h.value = el.dataset.role;
      });
    });

    // 导入文件：选择 + 拖拽
    const fileInput = root.querySelector('#import-file');
    const zone = root.querySelector('#import-zone');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) handleImportFile(f);
        fileInput.value = '';
      });
    }
    if (zone) {
      zone.addEventListener('click', () => fileInput && fileInput.click());
      ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
      zone.addEventListener('drop', e => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleImportFile(f);
      });
    }
  }

  function startQuizFromWrong(qid, title) {
    const q = questionById(qid);
    if (!q) return;
    const bank = bankById(q.bank);
    quiz = {
      list: [{ ...q, bank: bank.id, bankName: bank.name }], idx: 0, answers: {}, mode: 'practice', timer: null, seconds: 0, title: title || '错题巩固', qStartedAt: Date.now()
    };
    navigate('quiz/run');
  }

  /* ---------- 结果解析弹层 ---------- */
  function openResultReview() {
    const d = window._lastQuizDetail;
    if (!d || !d.list || !d.list.length) { toast('本次会话题目未保存', ''); return; }
    const html = d.list.map((q, i) => {
      const a = d.answers[i];
      let correct = false;
      if (a !== undefined && a !== 'skip') {
        if (q.type === 'subjective') correct = !!(d.selfJudge && d.selfJudge[i] === true);
        else if (q.type === 'fill') correct = checkFill(q.ans, a);
        else correct = a === q.ans;
      }
      const status = a === undefined || a === 'skip'
        ? '<span class="badge badge-blue">未作答</span>'
        : correct
          ? '<span class="badge badge-green">正确</span>'
          : '<span class="badge badge-red">错误</span>';
      const optsHtml = q.opts && q.opts.length
        ? q.opts.map((o, oi) => {
            let mark = '';
            if (oi === q.ans) mark = '<span style="color:var(--success);font-weight:700"> ✓</span>';
            else if (a === oi) mark = '<span style="color:var(--danger);font-weight:700"> ✗</span>';
            return `<div>${optsLabel(oi)}. ${esc(o)}${mark}</div>`;
          }).join('')
        : `<div>你的答案：${a === undefined || a === 'skip' ? '未作答' : esc(a)}</div>
           <div style="margin-top:4px">参考答案：${esc(q.ans)}</div>`;
      return `
        <div style="padding:16px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <b>${i + 1}. ${esc(q.kp)}</b>${status}
            <span class="badge ${typeBadgeCls(q.type)}" style="font-size:11px;padding:1px 7px">${typeLabel(q.type)}</span>
          </div>
          <div style="font-size:14px;line-height:1.7">${esc(q.q)}</div>
          <div style="margin-top:8px;font-size:13px;color:var(--text-2)">
            ${optsHtml}
          </div>
          <div class="explain-text" style="font-size:13px"><b>解析：</b>${esc(q.explain)}</div>
        </div>`;
    }).join('');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>全部解析（${d.list.length}题）</h3><button class="pr-close" style="padding:6px;border-radius:8px">${window.ICONS.close}</button></div>
        <div class="modal-body">${html}</div>
      </div>`;
    document.body.appendChild(mask);
    mask.querySelector('.pr-close').addEventListener('click', () => mask.remove());
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  }

  /* ---------- 支付弹窗（微信支付自动到账 / 个人收款码手动核验） ---------- */
  let payPlan = null;
  let payPoll = null;
  let wxpayOn = false; // 微信支付（自动到账）是否启用
  function stopPayPoll() { if (payPoll) { clearInterval(payPoll); payPoll = null; } }
  async function detectWxpay() {
    if (!window.API || !Store.getRemoteReady()) return;
    try { wxpayOn = !!(await window.API.wxpayStatus()).enabled; } catch (e) { wxpayOn = false; }
  }
  async function openPay(planId) {
    if (planId === 'free') return;
    const plan = VIP_PLANS.find(p => p.id === planId);
    if (!plan) return;
    const u = Store.getUser();
    if (!u) { toast('请先登录后再开通会员', 'err'); return; }
    await detectWxpay();
    payPlan = plan;
    const months = { vip1: 1, vip2: 3, vip3: 12 }[plan.id] || 1;
    const remote = Store.getRemoteReady();
    const QR = { ali: './assets/qr-alipay.jpg', wx: './assets/qr-wechat.jpg' };
    let pm = wxpayOn ? 'wxpay' : 'ali';
    const PM_LABEL = { ali: '支付宝', wx: '微信' };

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>开通${esc(plan.name)}</h3><button class="pm-close" style="padding:6px;border-radius:8px">${window.ICONS.close}</button></div>
        <div class="modal-body" data-body>
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--primary-light);border-radius:12px;padding:14px 16px">
            <div><span style="font-size:13px;color:var(--text-2)">${esc(plan.desc)}</span></div>
            <div style="text-align:right"><b style="font-size:22px;color:var(--primary)">${money(plan.price)}</b><div style="font-size:11px;color:var(--text-3)">${esc(plan.tag)}</div></div>
          </div>
          <div style="font-size:13px;font-weight:600;margin:16px 0 4px">选择支付方式</div>
          <div class="pay-methods">
            ${wxpayOn ? '<div class="pay-method active" data-pm="wxpay"><div class="pm-ico">💚</div><b>微信支付</b><span>自动到账</span></div>' : ''}
            <div class="pay-method ${wxpayOn ? '' : 'active'}" data-pm="ali"><div class="pm-ico">🔵</div><b>支付宝</b><span>收款码</span></div>
            <div class="pay-method" data-pm="wx"><div class="pm-ico">💚</div><b>微信</b><span>收款码</span></div>
          </div>
          <div class="pay-qr">
            <img src="${wxpayOn ? './assets/qr-placeholder.svg' : QR.ali}" alt="收款码" data-qr-img onerror="this.onerror=null;this.src='./assets/qr-placeholder.svg'">
            <div class="pay-qr-tip" data-qr-tip>${wxpayOn ? '正在创建微信支付订单…' : '请用 <b data-pm-label>支付宝</b> 扫上方收款码转账 <b>' + money(plan.price) + '</b> 元'}</div>
          </div>
          <div class="pay-form" data-pay-form ${wxpayOn ? 'style="display:none"' : ''}>
            <label>你的微信/支付宝昵称（便于对账）</label>
            <input class="pay-input" data-pay-contact placeholder="如：张三（选填）" maxlength="20">
            <label>付款单号 / 交易号后 6 位 <b style="color:var(--danger)">*</b></label>
            <input class="pay-input" data-pay-note maxlength="12" placeholder="转账后查看账单，填写单号后 6 位">
            <div class="pay-warn">个人收款码没有自动回调，管理员核对后自动开通（通常几分钟内，夜间可能到次日）</div>
            <button class="btn btn-block btn-gold" data-pay-submit>我已付款，等待核验开通</button>
            <button class="btn btn-block btn-ghost" data-pay-cancel style="margin-top:8px">暂不支付，返回</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(mask);

    const close = () => { stopPayPoll(); mask.remove(); };
    mask.querySelector('.pm-close').addEventListener('click', close);
    mask.querySelector('[data-pay-cancel]').addEventListener('click', close);
    mask.addEventListener('click', e => { if (e.target === mask) close(); });

    /* 微信支付：创建订单 → 展示动态二维码 → 轮询自动开通 */
    let wxOutNo = '';
    async function startWxpay() {
      const img = mask.querySelector('[data-qr-img]');
      const tip = mask.querySelector('[data-qr-tip]');
      if (!img || !tip) return;
      try {
        stopPayPoll();
        const d = await window.API.wxpayCreateOrder(u.username, plan.id);
        wxOutNo = d.outTradeNo;
        img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(d.codeUrl);
        tip.innerHTML = '请用 <b>微信</b> 扫一扫支付 <b>' + money(plan.price) + '</b> 元' +
          '<br><span style="font-size:11px;color:var(--text-3)">支付完成后会员自动开通，无需填写单号</span>';
        payPoll = setInterval(async () => {
          if (!Store.getRemoteReady()) return;
          try {
            const orders = await window.API.getOrders(u.username);
            const mine = orders.find(o => o.note === wxOutNo && o.status === 'confirmed');
            if (mine) {
              stopPayPoll();
              Store.activateVip(plan.id, months);
              mask.remove();
              toast(`开通${plan.name}成功！`, 'ok');
              render();
            }
          } catch (e) { /* 网络抖动忽略 */ }
        }, 5000);
      } catch (e) {
        tip.innerHTML = '创建微信支付订单失败：' + esc(e.message || '请稍后重试') +
          '<br><span style="font-size:11px;color:var(--text-3)">可切换到支付宝 / 微信收款码人工核验</span>';
        img.src = './assets/qr-placeholder.svg';
      }
    }

    /* 支付方式切换 */
    mask.querySelectorAll('.pay-method').forEach(m => m.addEventListener('click', () => {
      mask.querySelectorAll('.pay-method').forEach(x => x.classList.remove('active'));
      m.classList.add('active');
      pm = m.dataset.pm;
      const img = mask.querySelector('[data-qr-img]');
      const tip = mask.querySelector('[data-qr-tip]');
      const form = mask.querySelector('[data-pay-form]');
      if (pm === 'wxpay') {
        form.style.display = 'none';
        img.src = './assets/qr-placeholder.svg';
        tip.innerHTML = '正在创建微信支付订单…';
        startWxpay();
      } else {
        stopPayPoll();
        form.style.display = '';
        img.src = QR[pm];
        tip.innerHTML = '请用 <b>' + PM_LABEL[pm] + '</b> 扫上方收款码转账 <b>' + money(plan.price) + '</b> 元';
      }
    }));
    /* 默认选择微信支付时自动创建订单 */
    if (pm === 'wxpay') startWxpay();

    /* 轮询订单：管理员核验通过后自动开通会员 */
    function startPoll() {
      stopPayPoll();
      payPoll = setInterval(async () => {
        if (!Store.getRemoteReady()) return;
        try {
          const orders = await window.API.getOrders(u.username);
          const mine = orders.find(o => o.planId === plan.id && o.status === 'confirmed');
          if (mine) {
            stopPayPoll();
            Store.activateVip(plan.id, months);
            mask.remove();
            toast(`开通${plan.name}成功！`, 'ok');
            render();
          }
        } catch (e) { /* 网络抖动忽略 */ }
      }, 5000);
    }
    function showWaiting() {
      const body = mask.querySelector('[data-body]');
      body.innerHTML = `
        <div class="pay-wait">
          <div class="pay-wait-ico">⏳</div>
          <h3>已提交，等待商家核验</h3>
          <p>管理员会核对你的转账记录，核对通过后会员将自动开通。<br>本页面每 5 秒自动检查一次，请勿关闭。</p>
          <div class="pay-order-ref">订单状态：<b style="color:var(--warning)">待核对</b></div>
          <button class="btn btn-block btn-ghost" data-pay-done style="margin-top:16px">我知道了，稍后查看</button>
        </div>`;
      body.querySelector('[data-pay-done]').addEventListener('click', close);
      startPoll();
    }
    function showOffline() {
      const body = mask.querySelector('[data-body]');
      body.innerHTML = `
        <div class="pay-wait">
          <div class="pay-wait-ico">📴</div>
          <h3>未连接学升服务器</h3>
          <p>当前设备未配置云端地址，无法在线核验开通。<br>请打开「设置 → 服务器地址」填入后端地址后重试，或联系管理员手动开通。</p>
          <button class="btn btn-block btn-ghost" data-pay-done style="margin-top:16px">返回</button>
        </div>`;
      body.querySelector('[data-pay-done]').addEventListener('click', close);
    }

    mask.querySelector('[data-pay-submit]').addEventListener('click', async () => {
      const note = (mask.querySelector('[data-pay-note]').value || '').trim();
      if (note.length < 4) { toast('请填写付款单号（交易号后 6 位）', 'err'); return; }
      const contact = (mask.querySelector('[data-pay-contact]').value || '').trim() || u.nickname || u.username;
      const btn = mask.querySelector('[data-pay-submit]');
      btn.disabled = true; btn.textContent = '提交中…';
      try {
        if (remote) {
          await window.API.addOrder(u.username, {
            planId: plan.id, amount: plan.price, level: plan.id, months,
            status: 'pending', note, contact
          });
          showWaiting();
        } else {
          showOffline();
        }
      } catch (e) {
        toast('提交失败：' + e.message, 'err');
        btn.disabled = false; btn.textContent = '我已付款，等待核验开通';
      }
    });
  }

  /* 启动时检查：管理员已核验的订单 → 自动开通本地会员（幂等，不会重复叠加时长） */
  async function checkOrderActivation(username) {
    if (!window.API || !Store.getRemoteReady() || !username) return;
    try {
      const orders = await window.API.getOrders(username);
      const confirmed = orders.filter(o => o.status === 'confirmed');
      if (!confirmed.length) return;
      const u = Store.getUser();
      const curExp = (u && u.vip && u.vip.expireAt) || 0;
      // 仅当「该订单赠送的时长」尚未覆盖当前到期时间时才补发
      const needApply = confirmed.some(o =>
        (o.createdAt || 0) + (o.months || 1) * 30 * 86400000 > curExp
      );
      if (!needApply) return;
      const last = confirmed[0]; // 接口按创建时间倒序，最新一笔在首位
      Store.activateVip(last.level || 'vip1', last.months || 1);
      const p = VIP_PLANS.find(x => x.id === last.level);
      render();
      toast(`会员已开通：${p ? p.name : 'VIP'}`, 'ok');
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 键盘导航（刷题/考试） ---------- */
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; // 输入框中忽略快捷键
    if (route === 'quiz/run' && quiz) {
      const q = quiz.list[quiz.idx];
      const keys = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'];
      const idx = keys.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < (q.opts || []).length && quiz.answers[quiz.idx] === undefined) { answerQuestion(idx); return; }
      if (e.key === 'Enter' && canProceed(quiz.answers, quiz.selfJudge, q, quiz.idx)) nextQuestion();
    } else if (route === 'exam/run' && exam) {
      const q = exam.list[exam.idx];
      const keys = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'];
      const idx = keys.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < (q.opts || []).length && exam.answers[exam.idx] === undefined) {
        exam.answers[exam.idx] = idx; renderExamRun();
      }
    }
  });

  function renderResultOnly() {
    renderShell();
    const root = document.getElementById('page-root');
    root.innerHTML = window.__examResultHtml || '';
    // 重新绑定 action（限定在页面区域内）
    root.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => {
      const a = el.dataset.action;
      if (a === 'reviewResult') openResultReview();
      else if (a === 'goWrong') navigate('wrong');
      else if (a === 'backHome') navigate('home');
    }));
    root.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }

  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#/', '');
    if (h) { route = h; render(); }
  });

  /* ---------- 启动 ---------- */
  // 演示模式：URL 带 ?demo=1 时自动注入测试会话，方便换肤预览
  if (/[?&]demo=1\b/.test(location.search)) {
    try {
      const u = "demo_v3_user";
      const users = {};
      users[u] = {username:u, password:"123456", role:"user", nickname:"测试用户",
        createdAt: Date.now(), vip:{level:"pro", expireAt: Date.now() + 365*86400000}, coins: 9999};
      if (!localStorage.getItem("xs_users")) localStorage.setItem("xs_users", JSON.stringify(users));
      if (!localStorage.getItem("xs_session")) localStorage.setItem("xs_session", JSON.stringify(u));
    } catch(e) {}
  }
  function init() {
    const h = location.hash.replace('#/', '');
    if (h) route = h;
    render();
  }
  /* ---------- 启动闪屏 ----------
     每次打开应用都先显示闪屏 2 秒，淡出后再渲染登录页（或已登录的主页）。
     闪屏 DOM 已在 index.html 内联，CSS 在 style.css。 */
  function hideSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('hide');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
  // init() 与 bootstrap() 均延迟到闪屏结束后再执行，确保用户先看到闪屏再进登录页
  setTimeout(() => {
    hideSplash();
    init();
    (async function bootstrap() {
      if (!window.API) return;
      await Store.detectRemote();
      if (Store.getRemoteReady()) {
        const u = Store.getUser();
        if (u) {
          await Store.pullRemote(u.username);
          await checkOrderActivation(u.username);
          Store.startHeartbeat();   // 实时心跳：同步会员/额度/封禁状态（15 秒）
          Store.flushAnswers();     // 补发离线期间积累的答题事件
          render();
        }
        toast('已连接云端数据库', 'ok');
      } else {
        /* 强制在线：后端不可达时阻止离线使用 */
        renderOnlineBlock();
      }
    })();
  }, 2000);
  /* ---------- 强制在线拦截（打包上线模式） ----------
     学升为云端同步应用：必须连接后端服务器才能使用。
     检测失败时覆盖主界面，阻止所有本地离线功能。 */
  function renderOnlineBlock() {
    const root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:linear-gradient(160deg,#f7f8ff,#eef1ff)">
        <div style="width:84px;height:84px;border-radius:24px;background:linear-gradient(135deg,#3043AA,#5B6BD6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:40px;box-shadow:0 12px 30px rgba(48,67,170,.35)">📡</div>
        <h2 style="margin:22px 0 8px;font-size:20px;color:#111">无法连接服务器</h2>
        <p style="margin:0 0 6px;font-size:14px;color:#5b6478;max-width:320px;line-height:1.7">学升为云端同步应用，所有数据实时保存到服务器。<br>请检查网络连接或稍后重试。</p>
        <p style="margin:0 0 22px;font-size:12px;color:#9aa3b5">若已部署服务器，可在下方检查服务器地址。</p>
        <div style="display:flex;gap:10px">
          <button id="online-retry" class="btn" style="padding:11px 26px;border-radius:12px;background:#3043AA;color:#fff;border:none;font-size:14px;cursor:pointer">重新连接</button>
          <button id="online-config" class="btn btn-ghost" style="padding:11px 26px;border-radius:12px;background:transparent;color:#3043AA;border:1px solid #c3cdf5;font-size:14px;cursor:pointer">服务器设置</button>
        </div>
      </div>`;
    root.querySelector('#online-retry').onclick = () => { renderOnlineBlock(); retryConnect(); };
    root.querySelector('#online-config').onclick = () => { try { openServerSettings(); } catch (e) { toast('服务器设置不可用', 'err'); } };
  }
  async function retryConnect() {
    try {
      const ok = await Store.detectRemote();
      if (!ok) return renderOnlineBlock();
      const u = Store.getUser();
      if (u) { await Store.pullRemote(u.username); Store.startHeartbeat(); Store.flushAnswers(); }
      toast('已连接云端服务器', 'ok');
      render();
    } catch (e) { renderOnlineBlock(); }
  }
  /* 运行中断线：心跳连续失败触发 → 立即覆盖为离线拦截页 */
  window.addEventListener('xs-offline', () => {
    toast('网络连接已断开', 'err');
    renderOnlineBlock();
  });
})();
