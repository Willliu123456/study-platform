#!/usr/bin/env node
/* ============================================================
   把上级目录（study-platform）的网页前端同步到 ./www
   Capacitor 的 webDir 指向 www，Android 打包前先跑本脚本
   用法：node sync-www.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..');          // study-platform 根目录
const DST = path.join(__dirname, 'www');            // Capacitor webDir

// 需要同步的顶层条目（目录/文件）
const ENTRIES = [
  'index.html',
  'admin.html',
  'manifest.json',
  'sw.js',
  'css',
  'assets',
  'js',        // 含 data*.js / store.js / api.js / app.js / importer.js / lib/
];

// 复制时忽略的内容（glob 简化为包含判断）
const IGNORE_PARTS = [
  'node_modules', '.git',
];

// 资料实体文件（5.3GB）不进移动端包：Android 端资料清单/文件均通过
// 服务端 API（/api/materials/*）按需拉取并鉴权，避免 APK 体积爆炸与资料外泄。
function isIgnored(srcParent, name) {
  if (IGNORE_PARTS.some((ig) => name === ig)) return true;
  if (name === 'materials' && path.basename(srcParent) === 'assets') return true;
  return false;
}

function rmRf(p) {
  /* 兼容性：部分运行环境的安全钩子会拦截递归删除；
     删除失败不中断——后续 copyDir 用 force 覆盖旧文件，结果一致 */
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (e) {
    console.warn('[sync] 旧目录删除失败（忽略）:', p);
  }
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (isIgnored(src, name)) continue;
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 清理旧 www，只保留 Capacitor 需要的结构
rmRf(DST);
fs.mkdirSync(DST, { recursive: true });

let copied = 0;
for (const entry of ENTRIES) {
  const s = path.join(SRC, entry);
  if (!fs.existsSync(s)) { console.warn('[sync] 跳过（不存在）:', entry); continue; }
  const d = path.join(DST, entry);
  const st = fs.statSync(s);
  if (st.isDirectory()) {
    copyDir(s, d);
    const n = countFiles(d);
    copied += n;
    console.log(`[sync] 目录 ${entry}/ -> www/${entry}/ (${n} 文件)`);
  } else {
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(s, d);
    copied++;
    console.log(`[sync] 文件 ${entry} -> www/${entry}`);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}

console.log(`\n[sync] 完成，共 ${copied} 个文件 -> www/`);
console.log('[sync] 下一步：npx cap sync android  →  npx cap open android');
