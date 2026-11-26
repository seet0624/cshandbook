#!/usr/bin/env node
// 生成「数易 · 知行堂」海外门户的云端内容（Supabase cs_docs.os_handbook 的 data.gz）。
// 用法：node tools/build_os_handbook.mjs <判定器目录> <输出目录>
//   判定器目录里要有 改线判定器.dc.html、服务中心判定器.dc.html（这两个不放在公开仓库）。
//   输出：<输出目录>/os_handbook.b64，以及切成 18200 字的 part.N，方便分段上传后用 md5 核对。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { loadContent } from './build_handbook.mjs';

const [toolsDir, outDir] = process.argv.slice(2);
if (!toolsDir || !outDir) { console.error('用法：node tools/build_os_handbook.mjs <判定器目录> <输出目录>'); process.exit(1); }

const tools = {};
for (const name of ['改线判定器', '服务中心判定器']) tools[name] = fs.readFileSync(path.join(toolsDir, name + '.dc.html'), 'utf8');
const json = JSON.stringify({ CS: loadContent(), tools });
const gz = zlib.gzipSync(Buffer.from(json), { level: 9 }).toString('base64');
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'os_handbook.b64'), gz);
console.log(`os_handbook.b64：${gz.length} 字，md5 ${md5(gz)}`);
for (let i = 0; i * 18200 < gz.length; i++) {
  const part = gz.slice(i * 18200, (i + 1) * 18200);
  fs.writeFileSync(path.join(outDir, `part.${i}`), part);
  console.log(`part.${i}：${part.length} 字，md5 ${md5(part)}`);
}
