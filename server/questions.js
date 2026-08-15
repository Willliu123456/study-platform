/* ============ 学升·系统题库索引（服务端） ============ */
/* 加载前端 js/data.js ~ data9.js（顺序与 index.html 一致）中的系统题库，
   提取题目 id → 题库/知识点 映射，用于答题事件上报时校验题目合法性（防提交未知题目刷分）。
   注意：data2~data9 通过 IIFE 将 EXTRA 追加到 QUESTION_BANKS 对应题库中，
   若此处只加载 data.js，则真题库题目会被判定为「未知题目」累积风控分，导致误封。 */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const DATA_FILES = ['data.js', 'data2.js', 'data3.js', 'data4.js', 'data5.js',
  'data6.js', 'data7.js', 'data8.js', 'data9.js'];
const SYSTEM = {}; // qid -> { bank, kp }

function buildIndex() {
  const parts = [];
  for (const f of DATA_FILES) {
    try {
      parts.push(fs.readFileSync(path.join(JS_DIR, f), 'utf8'));
    } catch (e) {
      console.warn('[questions] 跳过缺失数据文件:', f, e.message);
    }
  }
  if (!parts.length) {
    console.error('[questions] 未找到任何题库数据文件');
    return;
  }
  const code = parts.join('\n') + '\n;globalThis.__XS_BANKS = QUESTION_BANKS;';
  const sandbox = {};
  try {
    vm.runInNewContext(code, sandbox, { timeout: 8000 });
  } catch (e) {
    console.error('[questions] 系统题库索引加载失败:', e.message);
    return;
  }
  for (const b of (sandbox.__XS_BANKS || [])) {
    for (const q of (b.questions || [])) {
      if (q && q.id) SYSTEM[q.id] = { bank: b.id || '', kp: q.kp || '' };
    }
  }
}

buildIndex();

function systemQuestion(qid) {
  return SYSTEM[qid] || null;
}

module.exports = { systemQuestion, count: () => Object.keys(SYSTEM).length };
