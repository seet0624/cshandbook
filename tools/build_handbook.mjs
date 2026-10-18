#!/usr/bin/env node
// 把 content/ 里的手册内容整理成纯文字，给「数易助手」后端当参考资料。
// Netlify 每次部署时自动运行（见 netlify.toml），生成 netlify/functions/ask/handbook.mjs。
// 本地查看：node tools/build_handbook.mjs --print
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['content/首页.js', 'content/章节.js', 'content/汇率与工期.js'];
const OUT = path.join(ROOT, 'netlify/functions/ask/handbook.mjs');

export function loadContent() {
  const CS = {};
  const ctx = vm.createContext({ CS, window: { CS } });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return CS;
}

const list = (a) => (Array.isArray(a) ? a : []);

function blockText(b, CS) {
  const out = [];
  if (b.title) out.push(`### ${b.title}`);
  switch (b.k) {
    case 'flow':
      list(b.steps).forEach((s) => out.push(`${s.n}. ${s.t}：${s.d || ''}`));
      break;
    case 'note':
      out.push(`【${b.t || '备注'}】${b.d}`);
      break;
    case 'list':
      list(b.items).forEach((t) => out.push(`- ${t}`));
      break;
    case 'meta':
      list(b.items).forEach((x) => out.push(`- ${x.l}：${x.v}`));
      break;
    case 'text':
      list(b.paras).forEach((p) => out.push(p));
      break;
    case 'qa':
      list(b.groups).forEach((g) => {
        out.push(`【${g.t}】`);
        list(g.items).forEach((qa) => out.push(`问：${qa.q}\n答：${qa.a}`));
      });
      break;
    case 'price':
      list(b.rows).forEach((r) => {
        out.push(`- ${r.name}${r.unify ? '（' + r.unify + '）' : ''}：` + list(r.items).map((it) => `${it.l} ${it.p}`).join('；'));
      });
      break;
    case 'roles':
      list(b.items).forEach((x) => out.push(`- ${x.t}：${x.d}`));
      break;
    case 'team':
      list(b.items).forEach((x) => out.push(`- ${x.name}：${list(x.duties).join('；')}`));
      break;
    case 'matrix':
      out.push('| ' + list(b.head).join(' | ') + ' |');
      list(b.rows).forEach((r) => out.push(r.g ? `【${r.g}】` : '| ' + list(r.c).map((v) => String(v).replace(/\n/g, '；')).join(' | ') + ' |'));
      break;
    case 'image':
      if (b.cap) out.push(`（图）${b.cap}`);
      break;
    case 'fx':
      out.push('固定汇率（1 美金兑换）：' + list(CS.fx).map((x) => `${x.n} ${x.c} ${x.r}`).join('；'));
      break;
    case 'timeline':
      list(b.marks).forEach((m) => out.push(`- ${m.t} ${m.l}`));
      if (b.legendA || b.legendB) out.push(`（${[b.legendA, b.legendB].filter(Boolean).join('；')}）`);
      break;
    case 'branch':
      list(b.steps).forEach((s) => out.push(`${s.n}. ${s.t}${s.d ? '：' + s.d : ''}${s.who ? '（' + s.who + '）' : ''}`));
      if (b.q) out.push(`判定：${b.q}`);
      out.push(`${b.yesLabel || '是'}：` + list(b.yes).map((y) => y.t + (y.d ? '（' + y.d + '）' : '')).join(' → '));
      out.push(`${b.noLabel || '否'}：` + list(b.no).map((y) => y.t + (y.d ? '（' + y.d + '）' : '')).join(' → '));
      break;
    case 'lane':
      list(b.lanes).forEach((l) => {
        const steps = list(b.stages).map((st, i) => (list(l.cells)[i] ? `${st}：${l.cells[i]}` : null)).filter(Boolean);
        out.push(`- ${l.name}：${steps.join('；')}`);
      });
      break;
    case 'approval':
      out.push('审批顺序：' + list(b.steps).join(' → ') + (b.cc ? `；抄送：${b.cc}` : ''));
      break;
    case 'duration':
      list(b.bars).forEach((x) => out.push(`- ${x.l}：${x.r}`));
      break;
    case 'check':
      list(b.items).forEach((t) => out.push(`- [ ] ${t}`));
      break;
    case 'formula':
      out.push(list(b.parts).map((p) => (p.op ? p.op + ' ' : '') + p.t + (p.d ? '（' + p.d + '）' : '')).join(' '));
      if (b.note) out.push(b.note);
      break;
    case 'stages':
      list(b.items).forEach((s) => out.push(`- ${s.when}：${s.what}${s.who ? '（' + s.who + '）' : ''}${s.cost ? '，费用：' + s.cost : ''}`));
      break;
    default:
      out.push(JSON.stringify(b));
  }
  return out.join('\n');
}

export function buildHandbook(CS = loadContent()) {
  const parts = [];
  list(CS.modules).forEach((m) => {
    parts.push(`# 模块：${m.title}`);
    list(m.sections).forEach((s) => {
      parts.push(`<section id="${s.id}" num="${s.num || ''}" title="${s.title}">`);
      if (s.intro) parts.push(s.intro);
      list(s.blocks).forEach((b) => parts.push(blockText(b, CS)));
      parts.push('</section>');
    });
  });
  parts.push('# 工期判定器数据');
  parts.push('寄送到手：' + list(CS.leadRegions).map((r) => `${r.n} ${r.ship[0]}–${r.ship[1]} 天`).join('；'));
  parts.push('工具（工作日）：' + list(CS.leadTools).map((t) => `${t.n} 排单确认 ${t.cfg} 内，制作出货 ${t.min === t.max ? t.min : t.min + '–' + t.max}`).join('；'));
  parts.push('# 首页公告');
  list(CS.announcements).forEach((a) => parts.push(`- [${a.tag}] ${a.text}`));
  return parts.join('\n\n');
}

export function sectionIndex(CS = loadContent()) {
  const idx = {};
  list(CS.modules).forEach((m) => list(m.sections).forEach((s) => { idx[s.id] = { num: s.num || '', title: s.title }; }));
  return idx;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const CS = loadContent();
  const text = buildHandbook(CS);
  if (process.argv.includes('--print')) {
    process.stdout.write(text + '\n');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, '// 自动生成，请勿手改：由 tools/build_handbook.mjs 从 content/ 生成\n'
      + 'export const HANDBOOK = ' + JSON.stringify(text) + ';\n'
      + 'export const SECTIONS = ' + JSON.stringify(sectionIndex(CS)) + ';\n');
    console.log(`handbook: ${text.length} 字 → ${path.relative(ROOT, OUT)}`);
  }
}
