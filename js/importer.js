/* ============ 学升·个人题库导入解析器 ============ */
/* 支持自动识别：
     - 文本类：JSON（题库标准格式）/ JSONL / CSV / Markdown / 纯文本
     - 二进制类：DOCX（Word）/ XLSX（Excel）/ PDF（文本型）
   统一输出题目结构：{ q, opts[], ans, explain, kp, diff, type }
   依赖（js/lib/）：fflate.min.js（解压 ZIP）、pdf.min.js + pdf.worker.min.js（PDF 文本提取）
*/
window.Importer = (() => {
  const asStr = v => String(v === undefined || v === null ? '' : v).trim();
  /* 从对象中按候选键名取值（中文键优先） */
  const PICK = (o, keys, def) => {
    if (!o || typeof o !== 'object') return def;
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return def;
  };
  /* 选项文本去掉 "A." / "A、" / "A " / "1." 等前缀（数字前缀必须带分隔符，避免误删 "6V"） */
  const stripOptPrefix = s => asStr(s).replace(/^[A-Ha-h](?:[.、)）．:：]\s*|\s+)/, '').replace(/^\d{1,2}\s*[.、)）．:：]\s*/, '');

  /* ---------- 答案解析：返回选项索引（0 起），失败返回 -1 ---------- */
  function parseAnswer(a, optCount) {
    if (a === undefined || a === null) return -1;
    if (typeof a === 'number') {
      a = Math.floor(a);
      if (a === 0) return 0;                    /* 0 视为 0 基索引 */
      if (a >= 1 && a <= optCount) return a - 1; /* 数字答案按 1 基（第几个选项） */
      if (a >= 0 && a < optCount) return a;      /* 越界回退为 0 基 */
      return -1;
    }
    const s = asStr(a);
    if (!s) return -1;
    /* 字母："A" "A." "A、A)" 等 */
    const m = s.match(/^\s*([A-Ha-h])\s*[.、)．:：]?\s*$/);
    if (m) { const i = m[1].toUpperCase().charCodeAt(0) - 65; return i < optCount ? i : -1; }
    /* 数字（从 1 开始；0 视为 0 基） */
    const m2 = s.match(/^\s*(\d{1,2})\s*[.、)．:：]?\s*$/);
    if (m2) {
      const n = parseInt(m2[1], 10);
      const i = n === 0 ? 0 : n - 1;
      return (i >= 0 && i < optCount) ? i : -1;
    }
    /* 判断题：对/正确/√/是/T/True → 0；错/错误/×/否/F/False → 1 */
    if (optCount === 2) {
      if (/^(对|正确|是|√|✓|T|True|TRUE|Yes|YES|Y)$/.test(s)) return 0;
      if (/^(错|错误|否|×|✗|F|False|FALSE|No|NO|N)$/.test(s)) return 1;
    }
    return -1;
  }

  /* 判断词选项 / 判断词答案 */
  const JUDGE_WORDS = ['对', '错', '正确', '错误', '√', '×', '是', '否', 'T', 'F', 'true', 'false', 'True', 'False', 'TRUE', 'FALSE', 'yes', 'no', 'YES', 'NO', 'Y', 'N'];
  const isJudgeOpts = opts => opts.length === 2 && (
    (opts[0] === '对' && opts[1] === '错') ||
    (opts[0] === '正确' && opts[1] === '错误') ||
    (opts[0] === '√' && opts[1] === '×') ||
    (opts[0] === '是' && opts[1] === '否') ||
    (opts[0] === 'T' && opts[1] === 'F') ||
    (opts[0] === 'true' && opts[1] === 'false')
  );
  const judgeTrue = s => /^(对|正确|√|是|T|t|true|TRUE|True|yes|YES|Y|y)$/.test(s);
  /* 题干含空位占位符 → 填空题 */
  const BLANK_RE = /_{2,}|＿{2,}|[（(]\s*[)）]|□|【\s*】/;

  /* 根据题型标签/字符串自动判断题型：single 单选 / judge 判断 / fill 填空 / subjective 主观大题 */
  function typeFromStr(s) {
    s = asStr(s);
    if (/填空|fill|blank|cloze/i.test(s)) return 'fill';
    if (/简答|问答|解答|大题|主观|论述|作文|essay|short.?answer|subjective|应用题|综合题|分析题/i.test(s)) return 'subjective';
    if (/判|对错|judge|bool|boolean/i.test(s)) return 'judge';
    return 'single';
  }
  /* 文本中「【判断题】/【填空题】/【简答题】」等段落标签 → 题型 */
  function typeFromTag(tag) {
    if (/判断/.test(tag)) return 'judge';
    if (/填空/.test(tag)) return 'fill';
    if (/选择|单选|多选/.test(tag)) return 'single';
    if (/简答|问答|解答|大题|主观|论述|作文|应用|计算/.test(tag)) return 'subjective';
    return '';
  }
  function isJudgeTrue(mark) { return /对|正确|√|是/.test(mark); }
  /* 是否为题型标题行（「填空」「2．判断」「一、选择题」「四. 简答题」）：
     必须是去掉序号前缀后的短文本且以题型词结尾，避免误判题干中含"选择/应用"等词的题目行 */
  function isTypeTitle(s) {
    const t = asStr(s).replace(/^第?[一二三四五六七八九十0-9]+[、.．:：\s]*/, '').trim();
    return t.length <= 8 && /^(填空|判断|选择|单选|多选|简答|问答|解答|主观|论述|作文|应用|计算|填空题|判断题|选择题|简答题|计算题|单选题|多选题|单项选择题|多项选择题)$/.test(t);
  }
  /* 是否为章节/页面标题（「第二章 ...」「第一部分（5道）」「自测题」「单元练习」），应直接跳过 */
  function isChapterTitle(s) {
    const t = asStr(s);
    return /^(第[一二三四五六七八九十0-9]+[章单元部篇]|自测题|单元练习|复习题|练习题|习题|综合练习|本章小结|课后习题)/.test(t) ||
           /^(电工电子|电路的|正弦交流|三相交流|半导体|基本.*定律)/.test(t);
  }
  /* 清理 Word OLE 公式占位符："EMBED Equation.DSMT4" 等 */
  function cleanOle(s) {
    return asStr(s).replace(/[\x13\x14]\s*EMBED\s+[^\x15]*[\x14\x15]/g, ' ').replace(/[\x13\x14\x15]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- 公共组装：题干 + 选项 + 答案 → 题目对象（自动识别选择/判断/填空/主观大题） ---------- */
  function buildQuestion(q, opts, ansRaw, exp, kp, type) {
    q = cleanOle(q).replace(/^\d{1,3}[.、)）．]\s*/, '');
    if (!q) return null;
    opts = (Array.isArray(opts) ? opts : []).map(o => cleanOle(stripOptPrefix(o))).filter(o => o);
    /* 选项不足 2 个时，尝试从题干内联选项提取：如 "题干（ A ）。 B. xxx C. xxx D. xxx" */
    if (opts.length < 2) {
      const inl = splitInlineOpts(q);
      if (inl && inl.length >= 2) {
        opts = inl;
        // 从内联选项出现的位置截断题干
        const firstOpt = q.match(/(?:^|\s)([A-Ha-h])\s*[.、)）．:：]?\s+/);
        if (firstOpt) q = q.slice(0, firstOpt.index).trim().replace(/[（(]\s*[A-Ha-h]?\s*[)）]\s*[。.？！]?\s*$/, '').trim();
      }
    }
    const ansText = asStr(ansRaw);
    /* 显式标注的填空 / 主观（大题、简答、问答）题型：以文本答案保存，不依赖选项 */
    if (type === 'fill' || type === 'subjective') {
      let qClean = q, ans = ansText;
      /* 简答题答案内嵌在题干中：如"...是什么?(1)答1;(2)答2" 或 "[解] ..." */
      if (!ans && type === 'subjective') {
        const am = q.match(/[(（]\s*[1-9]\d?\s*[)）].*|^[（(]?解[）)]?\s*[:：]/);
        if (am) {
          ans = am[0].trim();
          qClean = q.slice(0, am.index).trim().replace(/[?？]\s*$/, '');
        }
      }
      /* 填空题：答案在题干括号中，如"电阻R上的电压为（ 6V ）" */
      if (!ans && type === 'fill') {
        const matches = [];
        let m;
        const re = /[（(]\s*([^（）()\s][^（）()]*)\s*[)）]/g;
        while ((m = re.exec(q))) matches.push(m[1].trim());
        if (matches.length) {
          ans = matches.join(' / ');
          qClean = q.replace(/[（(]\s*[^（）()]*\s*[)）]/g, '（　）');
        }
      }
      return {
        q: qClean, opts: [], ans,
        explain: exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type
      };
    }
    /* 判断题：题干带（对/错/√/×）且无选项；标记后可跟解析文字（如「（ × ）左右写反」） */
    if (!opts.length) {
      const jm = q.match(/[（(]\s*(对|正确|√|是|错|错误|×|否)\s*[)）]/);
      if (jm) {
        const mark = jm[0];
        const mk = q.indexOf(mark);
        /* 题干取标记之前的部分；标记后（含换行）一律视为解析 */
        const rest = q.slice(mk + mark.length).trim();
        const qClean = q.slice(0, mk).trim().replace(/[，,、；;\s]+$/, '');
        return {
          q: qClean, opts: ['正确', '错误'], ans: judgeTrue(jm[1]) ? 0 : 1,
          explain: rest || exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type: 'judge'
        };
      }
      /* 无选项但答案为判断词 → 判断题 */
      if (ansRaw !== undefined && ansRaw !== null && JUDGE_WORDS.includes(ansText)) {
        return {
          q, opts: ['正确', '错误'], ans: judgeTrue(ansText) ? 0 : 1,
          explain: exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type: 'judge'
        };
      }
      /* 无选项：题干含空位 → 填空题；否则有答案文本 → 主观题（简答/问答/大题） */
      if (BLANK_RE.test(q)) {
        return {
          q, opts: [], ans: ansText,
          explain: exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type: 'fill'
        };
      }
      if (ansText) {
        return {
          q, opts: [], ans: ansText,
          explain: exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type: 'subjective'
        };
      }
      /* 题型章节明确为填空时，无选项无答案的题干也保留为填空题（答案可稍后补充） */
      if (type === 'fill') {
        return {
          q, opts: [], ans: ansText,
          explain: exp || '（本题暂无解析）', kp: kp || '综合', diff: 2, type: 'fill'
        };
      }
      return null;
    }
    /* 题干中带答案标记「（B）」/「（ B ）」→ 提取为答案并从题干移除（不限于末尾） */
    if (opts.length >= 2 && (!asStr(ansRaw) || parseAnswer(ansRaw, opts.length) < 0)) {
      const pm = q.match(/[（(]\s*([A-Ha-h])\s*[)）]/);
      if (pm) {
        ansRaw = pm[1].toUpperCase();
        q = (q.slice(0, pm.index) + q.slice(pm.index + pm[0].length)).replace(/[，,、。.;；：:\s]+$/, '').trim();
      }
    }
    /* 有选项 → 选择 / 判断 */
    let ans = parseAnswer(ansRaw, opts.length);
    if (ans < 0 && ansText) {
      /* 尝试答案文本匹配选项内容 */
      const t = ansText;
      const fi = opts.findIndex(o => o === t || (t.length > 1 && (o.includes(t) || t.includes(o))));
      if (fi >= 0) ans = fi;
    }
    /* 未识别到答案仍保留题目，答案索引记为 -1，导入后可在前端补录 */
    if (ans < 0) ans = -1;
    return {
      q, opts, ans,
      explain: exp || '（本题暂无解析）', kp: kp || '综合',
      diff: 2, type: type === 'judge' || isJudgeOpts(opts) ? 'judge' : 'single'
    };
  }

  /* ---------- 从 JSON 对象规范化题目 ---------- */
  function normJsonQuestion(raw) {
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const q = PICK(raw, ['q', 'stem', 'question', 'title', 'content', '题干', '题目', '题目内容', 'text']);
    if (!q) return null;
    /* 选项：数组 / 对象 / 文本块 */
    let opts = PICK(raw, ['opts', 'options', 'choices', 'optionList', '选项', '答案选项'], []);
    if (typeof opts === 'string') {
      opts = parseOptionBlock(opts);
    } else if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
      opts = Object.keys(opts).sort().map(k => opts[k]).map(v => asStr(v)).filter(v => v);
    }
    if (!Array.isArray(opts)) opts = [];
    const ansRaw = PICK(raw, ['ans', 'answer', 'correct', 'correctAnswer', 'correct_answer', 'key', 'right', '答案', '参考答案'], '');
    const exp = PICK(raw, ['explain', 'explanation', 'analysis', '解析', '答案解析', 'note'], '');
    const kp = kpOf(raw);
    const type = typeOf(raw);
    /* 题干里可能自带选项行（至少 2 个选项才提取） */
    if (opts.length < 2) {
      const block = parseOptionBlock(String(q));
      if (block.length >= 2) {
        const qClean = String(q).split('\n').map(l => l.trim())
          .filter(l => !/^[A-Ha-h][.、)．:：]/.test(l)).join('\n');
        return buildQuestion(qClean, block, ansRaw, exp, kp, type);
      }
    }
    return buildQuestion(q, opts, ansRaw, exp, kp, type);
  }
  function kpOf(o) {
    return asStr(PICK(o, ['kp', 'knowledge', 'knowledgePoint', 'knowledge_point', 'category', 'topic', 'section', 'tag', '考点', '知识点', '章节', '分类'], '综合'));
  }
  function typeOf(o) {
    return typeFromStr(PICK(o, ['type', 'questionType', '题型'], ''));
  }

  /* ---------- 解析选项文本块："A. xxx\nB. xxx" / "1. xxx\n2. xxx" ---------- */
  function parseOptionBlock(text) {
    const lines = String(text).split('\n');
    const out = [];
    for (const ln of lines) {
      const m = ln.trim().match(/^([A-Ha-h]|\d{1,2})\s*[.、)）．:：]?\s+(.+)$/);
      if (m && m[2].trim()) out.push(m[2].trim());
    }
    return out;
  }

  /* 拆分同行内联选项："A. 3个 B. 8个 C. 10个 D. 14个" → ["3个","8个","10个","14个"] */
  function splitInlineOpts(text) {
    const marks = [];
    const re = /(?:^|\s)([A-Ha-h])\s*[.、)）．:：]?\s+/g;
    let m;
    while ((m = re.exec(text))) {
      marks.push({
        i: m.index + (/^\s/.test(m[0]) ? 1 : 0),   /* 选项文本起始位置 */
        label: m[1].toUpperCase(),
        end: m.index + m[0].length
      });
    }
    if (marks.length < 2) return null;
    for (let i = 1; i < marks.length; i++) {
      if (marks[i].label.charCodeAt(0) !== marks[i - 1].label.charCodeAt(0) + 1) return null;
    }
    const out = [];
    for (let i = 0; i < marks.length; i++) {
      const s = marks[i].end;
      const e = i + 1 < marks.length ? marks[i + 1].i : text.length;
      const v = text.slice(s, e).trim();
      if (v) out.push(v);
    }
    return out.length >= 2 ? out : null;
  }

  /* ---------- JSON ---------- */
  function parseJson(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, msg: 'JSON 解析失败：' + e.message }; }
    let qs = null, bankName = '', desc = '';
    if (Array.isArray(data)) qs = data;
    else if (data && typeof data === 'object') {
      qs = PICK(data, ['questions', 'list', 'items', 'questionList', '题库', '题目', 'data'], null);
      /* 嵌套包装 { data: { questions: [] } } 或 { data: [] } */
      if (qs && typeof qs === 'object' && !Array.isArray(qs)) qs = PICK(qs, ['questions', 'list', 'items', '题库', '题目'], null);
      if ((!Array.isArray(qs)) && data.data && typeof data.data === 'object') {
        qs = Array.isArray(data.data) ? data.data : PICK(data.data, ['questions', 'list', 'items'], null);
      }
      if (!Array.isArray(qs)) qs = null;
      bankName = asStr(PICK(data, ['name', 'title', 'bankName', 'bank_name', '题库名', '题库名称'], ''));
      desc = asStr(PICK(data, ['desc', 'description', '简介', '描述', 'note'], ''));
    }
    if (!qs) return { ok: false, msg: '未在文件中找到题目列表（questions）' };
    const questions = [];
    qs.forEach(raw => { const q = normJsonQuestion(raw); if (q) questions.push(q); });
    if (!questions.length) return { ok: false, msg: '未能从 JSON 中解析出有效题目，请检查字段格式' };
    return { ok: true, format: 'json', bankName, desc, questions };
  }

  /* ---------- JSONL ---------- */
  function parseJsonl(text) {
    const questions = [];
    for (const ln of String(text).split('\n')) {
      const t = ln.trim();
      if (!t || !/^[\[{]/.test(t)) continue;
      try {
        const raw = JSON.parse(t);
        if (Array.isArray(raw)) raw.forEach(r => { const q = normJsonQuestion(r); if (q) questions.push(q); });
        else { const q = normJsonQuestion(raw); if (q) questions.push(q); }
      } catch (e) { /* 跳过坏行 */ }
    }
    if (!questions.length) return { ok: false, msg: '未能从 JSONL 中解析出有效题目' };
    return { ok: true, format: 'jsonl', bankName: '', desc: '', questions };
  }

  /* ---------- CSV（支持带引号字段） ---------- */
  function parseCsvRows(text) {
    const rows = [];
    let cur = '', row = [], inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cur); cur = '';
          rows.push(row); row = [];
        } else cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => asStr(c)));
  }
  const ANS_CELL_RE = /^(?:[A-Ha-h]|[1-8]|对|错|正确|错误|√|×|是|否|T|F)$/;

  function parseCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) return { ok: false, msg: 'CSV 内容为空' };
    const head = rows[0].map(h => asStr(h).replace(/^\ufeff/, ''));
    const hasHeader = head.some(h => /^(题干|题目|题目内容|question|stem|q)$/i.test(h)) || head.some(h => /^(答案|参考答案|answer|ans|key|correct)$/i.test(h));
    const findCol = keys => head.findIndex(h => keys.some(k => h.toLowerCase() === k.toLowerCase() || h.toLowerCase().includes(k.toLowerCase())));
    const colQ = findCol(['题干', '题目', '题目内容', 'question', 'stem', 'q']);
    const colA = findCol(['选项A', '选项a', '选项1', 'optiona', 'opta']);
    const colB = findCol(['选项B', '选项b', '选项2', 'optionb', 'optb']);
    const colC = findCol(['选项C', '选项c', '选项3', 'optionc', 'optc']);
    const colD = findCol(['选项D', '选项d', '选项4', 'optiond', 'optd']);
    const colE = findCol(['选项E', '选项e', '选项5', 'optione', 'opte']);
    const colAns = findCol(['答案', '参考答案', 'answer', 'ans', 'key', 'correct']);
    const colExp = findCol(['解析', '答案解析', 'explain', 'explanation', 'analysis']);
    const colKp = findCol(['知识点', '考点', '章节', '分类', 'kp', 'knowledge']);
    const colType = findCol(['题型', '类型', 'questionType', 'type']);

    const questions = [];
    rows.forEach((r, ri) => {
      if (hasHeader && ri === 0) return;
      const cell = i => (r[i] !== undefined ? asStr(r[i]) : '');
      let q, opts, ansRaw, exp, kp;
      if (hasHeader && colQ >= 0) {
        q = cell(colQ);
        opts = [colA, colB, colC, colD, colE].map(i => (i >= 0 ? cell(i) : '')).filter(Boolean);
        ansRaw = colAns >= 0 ? cell(colAns) : '';
        exp = colExp >= 0 ? cell(colExp) : '';
        kp = colKp >= 0 ? cell(colKp) : '';
      } else {
        /* 无表头：0=题干，随后为选项，答案特征列及其后为 答案/解析/知识点 */
        q = cell(0);
        const cells = [];
        for (let i = 1; i < r.length; i++) cells.push(cell(i));
        const isLetter = c => /^[A-Ha-h]$/.test(c);
        const isJudge = c => /^(对|错|正确|错误|√|×|是|否|T|F)$/.test(c);
        const isNum = c => /^[1-8]$/.test(c);
        let ansIdx = -1;
        /* 优先：常规导出「题干,选项...,答案,解析」，答案在倒数第2列 */
        if (cells.length >= 2 && (isLetter(cells[cells.length - 2]) || isJudge(cells[cells.length - 2]))) ansIdx = cells.length - 2;
        /* 其次：答案在最后一列 */
        if (ansIdx < 0 && cells.length >= 1 && (isLetter(cells[cells.length - 1]) || isJudge(cells[cells.length - 1]))) ansIdx = cells.length - 1;
        /* 再次：第一个字母/判断词单元格（跳过数字，避免与数字选项冲突） */
        if (ansIdx < 0) ansIdx = cells.findIndex(c => isLetter(c) || isJudge(c));
        /* 兜底：第一列数字答案 */
        if (ansIdx < 0) ansIdx = cells.findIndex(isNum);
        if (ansIdx >= 0) {
          opts = cells.slice(0, ansIdx).filter(Boolean);
          ansRaw = cells[ansIdx];
          exp = cells[ansIdx + 1] || '';
          kp = cells[ansIdx + 2] || '';
        } else {
          opts = cells.slice(0, Math.max(0, cells.length - 2)).filter(Boolean);
          ansRaw = cells[cells.length - 2] || '';
          exp = cells[cells.length - 1] || '';
        }
      }
      const qObj = buildQuestion(q, opts, ansRaw, exp, kp, hasHeader && colType >= 0 ? typeFromStr(cell(colType)) : undefined);
      if (qObj) questions.push(qObj);
    });
    if (!questions.length) return { ok: false, msg: '未能从 CSV 中解析出有效题目，请确认列名（题干/选项/答案）' };
    return { ok: true, format: 'csv', bankName: '', desc: '', questions };
  }

  /* ---------- Markdown / 纯文本 ---------- */
  function parseText(text) {
    const lines = String(text).split('\n');
    const questions = [];
    let qLines = [], opts = [], ansRaw = '', exp = '', kp = '', curType = '';
    let pendingStart = false;  /* 新题已开始但题干为空（如听力题「（1）」后直接选项） */
    let lastOptLabel = '';     /* 最近收集选项的字母，用于选项回绕（无题号新题）检测 */
    const flush = () => {
      let qText = qLines.join('\n').trim();
      if (!qText && opts.length) qText = '（题干缺失，请补充）';
      if (!qText && !opts.length && !ansRaw) {
        qLines = []; opts = []; ansRaw = ''; exp = ''; kp = '';
        pendingStart = false; lastOptLabel = '';
        return;
      }
      const q = buildQuestion(qText, opts, ansRaw, exp, kp, curType);
      if (q) questions.push(q);
      qLines = []; opts = []; ansRaw = ''; exp = ''; kp = '';
      pendingStart = false; lastOptLabel = '';
      /* 注意：curType（当前章节题型）跨题保持，直到遇到下一个题型标题 */
    };
    for (let i = 0; i < lines.length; i++) {
      const t = cleanOle(lines[i]);
      if (!t) {
        /* 空段落（题目间空行）：题目已有选项或答案时收尾；
           只有题干（如电工电子 "题干（ A ）" 后接解析）时不收尾，避免误拆 */
        if ((qLines.length && (opts.length || ansRaw)) || (pendingStart && opts.length)) flush();
        /* 空行后紧跟选项行且当前无任何内容 → 新题开始（题干缺失，如听力第 2 题） */
        if (!qLines.length && !opts.length && !pendingStart) {
          const next = cleanOle(lines[i + 1] || '');
          if (/^[A-Ha-h]\s*(?:[.、)）．:：]\s*|\s+)/.test(next)) pendingStart = true;
        }
        continue;
      }
      /* 章节标题直接跳过 */
      if (isChapterTitle(t)) continue;
      /* 元信息行 */
      const mAns = t.match(/^(?:答案|参考答案|答|解|Answer|answer)\s*[:：]?\s*(.+)$/) || t.match(/^\[\s*解\s*\]\s*(.+)$/);
      const mExp = t.match(/^(?:解析|答案解析|解释|Explanation|explanation)\s*[:：]\s*(.+)$/) || t.match(/^（解析[:：]\s*(.+)）$/);
      const mKp = t.match(/^(?:考点|知识点|章节|分类|专题)\s*[:：]\s*(.+)$/);
      const mOpt = t.match(/^([A-Ha-h])\s*(?:[.、)）．:：]\s*|\s+)(.+)$/);
      if (mAns) { ansRaw = mAns[1].trim(); continue; }
      if (mExp) { exp = mExp[1].trim(); continue; }
      if (mKp) { kp = mKp[1].trim(); continue; }
      /* 纯题号行（题干在音频/别处，如听力题）："（1）" "(8)" "(9）" → 新题边界，后续行作为选项 */
      const mPureNum = t.match(/^[(（]\s*(\d{1,4})\s*[)）]\s*$/);
      if (mPureNum) {
        if (qLines.length || opts.length || ansRaw) flush();
        pendingStart = true;
        continue;
      }
      /* 无题号新题（如听力第 2 题直接以 "A. ..." 开头）：选项字母回绕到 A 且已有 ≥2 个选项 → 收尾上一题 */
      if (mOpt && opts.length >= 2 && mOpt[1].toUpperCase() === 'A') {
        const prevT = cleanOle(lines[i - 1] || '');
        const prevIsOpt = opts.length >= 3 || /^[B-Hb-h]\s*(?:[.、)）．:：]\s*|\s+)/.test(prevT);
        if (prevIsOpt) { flush(); pendingStart = true; }
      }
      if (mOpt && (qLines.length || opts.length || pendingStart)) {
        /* 同行内联多个选项：A. xxx B. xxx C. xxx D. xxx（mOpt 已吞掉行首字母，需补回再拆分） */
        const inl = splitInlineOpts(mOpt[1].toUpperCase() + '. ' + mOpt[2]);
        if (inl) {
          opts.push(...inl);
          lastOptLabel = String.fromCharCode(65 + inl.length - 1);
        } else {
          /* 保留整行（含前缀标签），由 buildQuestion 统一 stripOptPrefix 剥离一次，
             避免选项内容本身以 "A " 开头时（如 "D. A good job."）被二次剥前缀 */
          opts.push(t);
          lastOptLabel = mOpt[1].toUpperCase();
        }
        continue;
      }
      /* 无前缀短选项：当已处于选择题且行较短时，把 "减小/增大/不变/不定" 这类也当选项；
         超过 4 个说明是图注/电路符号列表，清空并跳过 */
      const isShortOptCandidate = curType === 'single' && qLines.length && t.length <= 18 && t.length >= 1 &&
        !t.includes('（') && !t.includes('）') && !t.includes('(') && !t.includes(')') &&
        !/^\d{1,2}[.、)）．:：]/.test(t) && !isTypeTitle(t) && !mAns && !mExp && !mKp;
      if (isShortOptCandidate) {
        if (opts.length < 4) { opts.push(t); continue; }
        else { opts = []; continue; }
      }
      /* 新题目开始：数字题号 或 【】题型 或 "题目：" 或 "(单选题)题干" */
      const mNum = t.match(/^(\d{1,4})\s*[.、)）．:：]\s*(.+)$/);
      const mJudgeNum = t.match(/^([对错√×])\s*(\d{1,4})\s*[.、)）．:：]\s*(.+)$/);
      const mBrace = t.match(/^【\s*([^】]*)\s*】\s*(.*)$/);
      const mQmark = t.match(/^(?:题目|第\s*\d{1,4}\s*题)\s*[:：]?\s*(.+)$/);
      const mTypePrefix = t.match(/^[(（]\s*(单选题|多选题|判断题|填空题|简答题|选择题|单选|多选|判断|填空|简答)\s*[)）]\s*(.*)$/);
      /* 「错1. ...」「对2. ...」判断题：直接收尾并新建判断题 */
      if (mJudgeNum) {
        if (qLines.length || opts.length || ansRaw) flush();
        curType = 'judge';
        qLines = [mJudgeNum[3]];
        ansRaw = mJudgeNum[1];
        continue;
      }
      /* 「1．填空」「2．判断」等题型标题行：先收尾当前题，再切换题型 */
      if (mNum && isTypeTitle(mNum[2])) {
        if (qLines.length || opts.length || ansRaw) flush();
        curType = typeFromTag(mNum[2]);
        continue;
      }
      /* 「四. 简答题」「一、单选题」等中文数字序号题型标题 */
      const bareTitle = t.replace(/^第?[一二三四五六七八九十0-9]+[、.．:：\s]*/, '').trim();
      if (isTypeTitle(bareTitle)) {
        if (qLines.length || opts.length || ansRaw) flush();
        curType = typeFromTag(bareTitle);
        continue;
      }
      /* 「(单选题)题干」「（单选题)题干」等前缀题型标记：先收尾当前题，再开新题 */
      if (mTypePrefix) {
        if (qLines.length || opts.length || ansRaw) flush();
        curType = typeFromTag(mTypePrefix[1]);
        if (mTypePrefix[2].trim()) qLines = [mTypePrefix[2]];
        continue;
      }
      /* 无题号新题：当前行含答案标记「（ B ）」或填空括号「（ 6 ）」且已有题目时，先收尾 */
      if (qLines.length && (curType === 'single' || curType === 'fill' || curType === 'judge') && /[（(]\s*[^（）()]*\s*[)）]/.test(t) && !isTypeTitle(bareTitle)) {
        flush();
      }
      if ((mNum || mBrace || mQmark) && (qLines.length || opts.length || ansRaw)) flush();
      if (mNum) {
        let rest = mNum[2].trim();
        /* 处理 "21.(简答题)什么是..." 这种数字题号后的题型前缀 */
        const tp = rest.match(/^[(（]\s*(单选题|多选题|判断题|填空题|简答题|选择题|单选|多选|判断|填空|简答)\s*[)）]\s*(.*)$/);
        if (tp) { curType = typeFromTag(tp[1]); rest = tp[2].trim(); }
        if (rest) qLines = [rest];
      }
      else if (mBrace) { curType = typeFromTag(mBrace[1]); if (mBrace[2].trim()) qLines = [mBrace[2]]; }
      else if (mQmark) { qLines = [mQmark[1]]; }
      else if (ansRaw) ansRaw += '\n' + t;   /* 多行答案（如简答题的分点答案） */
      else if (qLines.length) qLines.push(t);
      else qLines = [t];
    }
    flush();
    if (!questions.length) return { ok: false, msg: '未能从文本中解析出有效题目，请参考「题目 + 选项 + 答案」格式' };
    return { ok: true, format: 'text', bankName: '', desc: '', questions };
  }

  /* ---------- 格式识别 ---------- */
  function detectFormat(filename, text) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (ext === 'json') return 'json';
    if (ext === 'jsonl') return 'jsonl';
    if (ext === 'csv') return 'csv';
    if (ext === 'md' || ext === 'markdown') return 'text';
    if (ext === 'txt') return 'text';
    const t = asStr(text);
    if (/^[\[{]/.test(t)) return 'json';
    const lines = t.split('\n').filter(l => l.trim());
    if (lines.length && lines.every(l => l.includes(','))) return 'csv';
    return 'text';
  }

  /* ---------- 主入口（文本） ---------- */
  function parse(text, filename) {
    const fmt = detectFormat(filename, text);
    let res;
    if (fmt === 'json') res = parseJson(text);
    else if (fmt === 'jsonl') res = parseJsonl(text);
    else if (fmt === 'csv') res = parseCsv(text);
    else res = parseText(text);
    if (!res.ok) return res;
    res.format = fmt;
    if (!res.bankName) res.bankName = asStr((filename || '').replace(/\.\w+$/, '')) || '我的题库';
    return res;
  }

  /* ================= 二进制格式（DOCX / XLSX / PDF） ================= */
  const getLib = name => {
    const g = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!g) return null;
    return name === 'fflate' ? (g.fflate || null) : name === 'pdfjs' ? (g.pdfjsLib || null) : null;
  };
  const decodeXml = s => String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

  /* ---------- DOCX：解压 → 提取 word/document.xml 段落文本 → 走文本解析 ---------- */
  function parseDocx(arrayBuffer) {
    const fflate = getLib('fflate');
    if (!fflate) return { ok: false, msg: '缺少解压组件（js/lib/fflate.min.js）' };
    let files;
    try { files = fflate.unzipSync(new Uint8Array(arrayBuffer)); }
    catch (e) { return { ok: false, msg: '不是有效的 DOCX 文件（解压失败：' + e.message + '）' }; }
    const docKey = Object.keys(files).find(k => /^word\/document\.xml$/.test(k));
    if (!docKey) return { ok: false, msg: 'DOCX 中未找到正文（word/document.xml）' };
    const xml = new TextDecoder().decode(files[docKey]);
    const lines = [];
    const paraRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let m;
    while ((m = paraRe.exec(xml))) {
      const para = m[1];
      let text = '';
      /* 注意：<w:tbl>/<w:tabs>/<w:tc> 等标签不能被 <w:t[^>]*> 误吞，须用严格形式 */
      const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?\s*>|<w:br\s*\/?\s*>|<w:cr\s*\/?\s*>/g;
      let t;
      while ((t = tRe.exec(para))) {
        if (t[1] !== undefined) text += t[1];
        else if (/w:tab/.test(t[0])) text += '\t';
        else text += '\n';
      }
      lines.push(decodeXml(text).trim());
    }
    if (!lines.length) return { ok: false, msg: 'DOCX 中未提取到文字（可能为空白文档）' };
    const res = parseText(lines.join('\n'));
    if (res.ok) return { ...res, format: 'docx' };
    return { ok: false, msg: 'DOCX 文本提取完成，但未能识别出题目：' + res.msg };
  }

  /* ---------- XLSX：解压 → sharedStrings + 工作表 → 转 CSV → 走 CSV 解析 ---------- */
  const colToNum = c => c.split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0);
  const csvEscape = s => /[",\n\r]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);

  function parseXlsx(arrayBuffer) {
    const fflate = getLib('fflate');
    if (!fflate) return { ok: false, msg: '缺少解压组件（js/lib/fflate.min.js）' };
    let files;
    try { files = fflate.unzipSync(new Uint8Array(arrayBuffer)); }
    catch (e) { return { ok: false, msg: '不是有效的 XLSX 文件（解压失败：' + e.message + '）' }; }
    /* 共享字符串表 */
    const shared = [];
    if (files['xl/sharedStrings.xml']) {
      const ssXml = new TextDecoder().decode(files['xl/sharedStrings.xml']);
      const siRe = /<si>([\s\S]*?)<\/si>/g;
      let m;
      while ((m = siRe.exec(ssXml))) {
        const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let text = '', t;
        while ((t = tRe.exec(m[1]))) text += t[1];
        shared.push(decodeXml(text));
      }
    }
    /* 遍历所有工作表，取第一个能解析出题目的 */
    const sheetKeys = Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
    if (!sheetKeys.length) return { ok: false, msg: 'XLSX 中未找到工作表' };
    for (const sk of sheetKeys) {
      const xml = new TextDecoder().decode(files[sk]);
      const rows = {};
      const cRe = /<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)(\d+)"([^>]*)\s*\/>/g;
      let m;
      while ((m = cRe.exec(xml))) {
        const col = m[1] || m[5];
        const rowNum = parseInt(m[2] || m[6], 10);
        const attrs = m[3] || m[7] || '';
        const inner = m[4] || '';
        const tm = attrs.match(/\bt="([^"]+)"/);
        const type = tm ? tm[1] : '';
        let val = '';
        if (type === 's') {
          const v = inner.match(/<v>([\s\S]*?)<\/v>/);
          if (v) val = shared[parseInt(v[1], 10)] || '';
        } else if (type === 'inlineStr') {
          const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          if (t) val = decodeXml(t[1]);
        } else {
          const v = inner.match(/<v>([\s\S]*?)<\/v>/);
          if (v) val = decodeXml(v[1]);
        }
        if (!rows[rowNum]) rows[rowNum] = {};
        rows[rowNum][col] = val;
      }
      if (!Object.keys(rows).length) continue;
      const cols = [...new Set(Object.values(rows).flatMap(r => Object.keys(r)))].sort((a, b) => colToNum(a) - colToNum(b));
      const rowNums = Object.keys(rows).map(Number).sort((a, b) => a - b);
      const lines = [];
      for (const rn of rowNums) {
        const cells = cols.map(c => rows[rn][c] || '');
        if (cells.some(c => c)) lines.push(cells.map(csvEscape).join(','));
      }
      const csv = lines.join('\n');
      if (!csv.trim()) continue;
      const res = parseCsv(csv);
      if (res.ok) return { ...res, format: 'xlsx' };
    }
    return { ok: false, msg: '未能从 XLSX 中解析出有效题目，请确认包含题干/选项/答案列' };
  }

  /* ---------- PDF：pdf.js 逐页提取文本 → 走文本解析 ---------- */
  async function parsePdf(arrayBuffer, onProgress) {
    const pdfjs = getLib('pdfjs');
    if (!pdfjs) return { ok: false, msg: '缺少 PDF 解析组件（js/lib/pdf.min.js）' };
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjs.GlobalWorkerOptions.workerSrc || './js/lib/pdf.worker.min.js';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const total = doc.numPages;
      let text = '';
      for (let i = 1; i <= total; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let pageText = '', lastY = null;
        for (const it of content.items) {
          const y = it.transform ? it.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) pageText += '\n';
          pageText += (it.str !== undefined ? it.str : '');
          if (y !== null) lastY = y;
        }
        text += pageText + '\n';
        if (onProgress) onProgress(Math.round(i / total * 100), '正在解析 PDF 第 ' + i + '/' + total + ' 页…');
      }
      if (!text.trim()) return { ok: false, msg: 'PDF 中未提取到文字（可能是扫描图片版，暂不支持 OCR）' };
      const res = parseText(text);
      if (res.ok) return { ...res, format: 'pdf' };
      return { ok: false, msg: 'PDF 文本提取完成，但未能识别出题目：' + res.msg };
    } catch (e) {
      return { ok: false, msg: 'PDF 解析失败：' + (e && e.message || e) };
    }
  }

  /* ---------- 旧版 .doc：调用本地后端（Windows Word/WPS COM）自动转成 .docx 再解析 ---------- */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        const i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(new Error('文件读取失败'));
      r.readAsDataURL(file);
    });
  }
  function base64ToArrayBuffer(b64) {
    try {
      const bin = atob(String(b64).replace(/\s+/g, ''));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    } catch (e) { return null; }
  }
  async function convertDocViaServer(file) {
    let b64;
    try { b64 = await fileToBase64(file); }
    catch (e) { return { ok: false, msg: '读取 .doc 文件失败：' + (e && e.message || e) }; }
    try {
      /* 优先使用 api.js 中配置的云端地址；未配置时同源访问本机后端 */
      let base = '';
      let tk = '';
      try { if (window.API && typeof window.API.getBase === 'function') base = window.API.getBase() || ''; } catch (e) { /* ignore */ }
      /* 安全修复（第四轮）：转换接口需携带登录 token（服务端强制校验） */
      try { if (window.API && typeof window.API.getToken === 'function') tk = window.API.getToken() || ''; } catch (e) { /* ignore */ }
      const resp = await fetch(base + '/api/convert-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': tk },
        body: JSON.stringify({ name: file.name, base64: b64 })
      });
      let data = null;
      try { data = await resp.json(); } catch (e) { /* ignore */ }
      if (!data || !data.ok) {
        const reason = (data && data.msg) || ('后端返回 HTTP ' + resp.status);
        return { ok: false, msg: '旧版 .doc 自动转换失败：' + reason + '。请用 Word/WPS 打开后另存为 .docx，再重新导入。' };
      }
      const bin = base64ToArrayBuffer(data.base64);
      if (!bin || !bin.byteLength) return { ok: false, msg: '后端返回的转换结果为空，请用 Word/WPS 另存为 .docx 后导入。' };
      return { ok: true, buf: bin };
    } catch (e) {
      return { ok: false, msg: '未能连接转换服务（' + (e && e.message || e) + '）。旧版 .doc 请先用 Word/WPS 打开并另存为 .docx，再重新导入。' };
    }
  }

  /* ---------- 统一文件入口：按扩展名自动选择解析方式（二进制/文本） ---------- */
  async function parseFile(file, onProgress) {
    if (!file) return { ok: false, msg: '未选择文件' };
    const name = asStr(file.name);
    const ext = name.split('.').pop().toLowerCase();
    let res;
    if (ext === 'doc') {
      /* 旧版 Word .doc：先尝试本地后端自动转换，失败再引导手动另存 */
      if (onProgress) onProgress(10, '正在调用本地服务转换 .doc → .docx…');
      const conv = await convertDocViaServer(file);
      if (!conv.ok) return conv;
      if (onProgress) onProgress(35, '转换完成，正在识别题目…');
      try {
        res = parseDocx(conv.buf);
      } catch (e) {
        return { ok: false, msg: '文档已转换，但解析失败：' + (e && e.message || e) };
      }
      if (!res.ok) return { ok: false, msg: '文档已转换，但未能识别出题目：' + res.msg };
    } else if (ext === 'docx' || ext === 'xlsx' || ext === 'pdf') {
      try {
        const buf = await file.arrayBuffer();
        if (ext === 'docx') res = parseDocx(buf);
        else if (ext === 'xlsx') res = parseXlsx(buf);
        else res = await parsePdf(buf, onProgress);
      } catch (e) {
        return { ok: false, msg: '读取文件失败：' + (e && e.message || e) };
      }
    } else {
      /* 文本类 */
      let text;
      try {
        text = await readFileText(file);
      } catch (e) {
        return { ok: false, msg: '读取文件失败：' + (e && e.message || e) };
      }
      if (onProgress) onProgress(40, '正在识别格式…');
      res = parse(text, name);
    }
    if (res && res.ok && !res.bankName) {
      res.bankName = name.replace(/\.\w+$/, '') || '我的题库';
    }
    return res;
  }
  async function readFileText(file) {
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('文件读取失败'));
        r.readAsText(file, 'utf-8');
      });
    }
    if (typeof file.text === 'function') return await file.text();
    if (typeof file.arrayBuffer === 'function') {
      return new TextDecoder().decode(await file.arrayBuffer());
    }
    throw new Error('无法读取该文件');
  }

  return { parse, parseFile, parseDocx, parseXlsx, parsePdf, detectFormat };
})();
