#!/usr/bin/env node
// 检查 content/ 里的内容文件：语法、跳转链接、图标、汇率是否一致等。
// 用法：node tools/check_content.mjs      （有错误时退出码为 1，GitHub 会发邮件提醒）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['content/首页.js', 'content/章节.js', 'content/汇率与工期.js'];
const errors = [];
const warnings = [];

// ── 1. 加载内容文件（和浏览器一样，往同一个 CS 里填） ──
const CS = {};
const ctx = vm.createContext({ CS, window: { CS } });
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (e) {
    const where = (e.stack || '').match(new RegExp(f.replace(/[.]/g, '\\.') + ':(\\d+)'));
    errors.push(`${f}${where ? ' 第 ' + where[1] + ' 行' : ''}：${e.message}（常见原因：漏了逗号、引号没配对）`);
  }
}
// 有文件没加载成功时，后面的检查只会连带报一堆假问题，先只报语法错误
if (errors.length) report();

// ── 2. 从 index.html 读出可用的图标名和内容块类型 ──
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const iconsSrc = index.slice(index.indexOf('ICONS = {'), index.indexOf('\n  };', index.indexOf('ICONS = {')));
const ICONS = new Set([...iconsSrc.matchAll(/^\s*'([\w-]+)':/gm)].map(m => m[1]));
const BLOCK_TYPES = new Set([...index.matchAll(/b\.k==='([\w-]+)'/g)].map(m => m[1]));

const arr = (k) => (Array.isArray(CS[k]) ? CS[k] : (errors.push(`缺少 CS.${k}，或它不是 [ … ] 列表`), []));
const modules = arr('modules');

// ── 3. 章节结构 ──
const sectionIds = new Map();
const checkIcon = (name, where) => {
  if (name && !ICONS.has(name)) errors.push(`${where}：图标「${name}」不存在（可用的图标见 index.html 的 ICONS）`);
};
modules.forEach((m, mi) => {
  const mw = `章节.js 模块「${m.title || '#' + (mi + 1)}」`;
  if (!m.id || !m.title) errors.push(`${mw}：缺少 id 或 title`);
  checkIcon(m.icon, mw);
  (m.sections || []).forEach((s) => {
    const sw = `章节.js「${s.title || s.id}」`;
    if (!s.id || !s.title) errors.push(`${sw}：缺少 id 或 title`);
    if (sectionIds.has(s.id)) errors.push(`${sw}：章节 id「${s.id}」重复了，和「${sectionIds.get(s.id)}」一样`);
    sectionIds.set(s.id, s.title);
    (s.blocks || []).forEach((b, bi) => {
      const bw = `${sw} 第 ${bi + 1} 个内容块`;
      if (!BLOCK_TYPES.has(b.k)) errors.push(`${bw}：类型 k:'${b.k}' 不认识`);
      for (const list of [b.steps, b.items]) {
        (Array.isArray(list) ? list : []).forEach((it) => it && typeof it === 'object' && checkIcon(it.i, bw));
      }
      if (b.k === 'qa') {
        (b.items || []).forEach((qa, qi) => {
          if (!qa.q || !qa.a) errors.push(`${bw} 第 ${qi + 1} 条问答：问题 q 或回答 a 是空的`);
        });
      }
    });
  });
});

// ── 4. 首页链接都要能跳到真实章节 ──
const checkGo = (go, where) => {
  if (go !== 'phrases' && !sectionIds.has(go)) errors.push(`${where}：go:'${go}' 找不到这个章节 id`);
};
arr('announcements').forEach((a, i) => { checkGo(a.go, `首页.js 第 ${i + 1} 条公告`); if (!a.text) errors.push(`首页.js 第 ${i + 1} 条公告：text 是空的`); });
arr('quicklinks').forEach((q) => { checkGo(q.go, `首页.js 快捷入口「${q.title}」`); checkIcon(q.icon, `首页.js 快捷入口「${q.title}」`); });
arr('tasks').forEach((t) => { checkGo(t.go, `首页.js「${t.t}」`); checkIcon(t.icon, `首页.js「${t.t}」`); });
arr('week').forEach((w) => { if (!sectionIds.has(w.id)) errors.push(`首页.js 五课「${w.t}」：id:'${w.id}' 找不到这个章节`); });

// ── 5. 汇率与工期 ──
const fx = arr('fx');
const seen = new Set();
fx.forEach((x) => {
  const w = `汇率与工期.js 币别「${x.c}」`;
  if (seen.has(x.c)) errors.push(`${w}：重复了`);
  seen.add(x.c);
  if (typeof x.r !== 'number' || !(x.r > 0)) errors.push(`${w}：汇率 r 必须是大于 0 的数字（不要加引号）`);
  if (x.cc !== 'eu' && !fs.existsSync(path.join(ROOT, 'assets/img/flags', x.cc + '.png'))) {
    errors.push(`${w}：找不到国旗 assets/img/flags/${x.cc}.png`);
  }
});
arr('leadTools').forEach((t) => {
  if (!(t.min <= t.max)) errors.push(`汇率与工期.js 工具「${t.n}」：min 不能大于 max`);
});
arr('leadRegions').forEach((r) => {
  if (!Array.isArray(r.ship) || !(r.ship[0] <= r.ship[1])) errors.push(`汇率与工期.js 地区「${r.n}」：ship 要写成 [最少天数, 最多天数]`);
});

// 服务中心判定器里另有一份汇率，两边对不上时提醒（数据不一致不会让页面出错，所以只提醒不报错）
const sc = fs.readFileSync(path.join(ROOT, '服务中心判定器.dc.html'), 'utf8').match(/D0 = (\{.*?\});?\s*$/m);
if (sc) {
  const fxByCode = new Map(fx.map((x) => [x.c, x.r]));
  for (const c of JSON.parse(sc[1]).cur || []) {
    if (fxByCode.has(c.c) && fxByCode.get(c.c) !== c.r) {
      warnings.push(`汇率不一致：${c.c} 在汇率与工期.js 是 ${fxByCode.get(c.c)}，在服务中心判定器.dc.html 是 ${c.r}`);
    }
  }
} else {
  warnings.push('没在 服务中心判定器.dc.html 里找到 D0 数据，跳过汇率比对');
}

// ── 6. 业务规则（按客服实际要求补充） ──
// 上面检查的是「格式对不对」；这里检查「内容合不合规矩」。
// 每发现一个问题，就 push 一条中文提示到 problems，例如：
//   problems.push('首页.js 第 2 条公告：标签缺少日期');
function businessRules(CS, problems) {
  // TODO
}
businessRules(CS, errors);

// ── 输出 ──
function report() {
  for (const w of warnings) console.log('提醒：' + w);
  if (!errors.length) return;
  console.log(`\n发现 ${errors.length} 个问题：`);
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
}
report();
console.log(`内容检查通过：${modules.length} 个模块，${sectionIds.size} 个章节，${fx.length} 个币别。`);
