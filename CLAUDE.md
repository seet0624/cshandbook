# 给 Claude 的规则

## 改这里，就要一起改「数易 · 知行堂」（老板的规定）

海外门户已搬进「数易 · 知行堂」（`seet0624/internalanalysis` 的 `handbook/`）。同事看到的是云端 Supabase（项目 `shuyi-hq`）`public.cs_docs` 里 `key = 'os_handbook'` 那一行，不是这个仓库。

这个仓库的 `content/` 只给「数易助手」用。所以每次改手册内容（`content/`）或判定器：

1. 改 `content/` → commit、push 到 main（Netlify 部署后助手更新）。
2. **同一次一起更新知行堂**：
   - 判定器源码不放在公开仓库。要改判定器，先从云端现有内容取出来（或从 git 历史 `改线判定器.dc.html` / `服务中心判定器.dc.html` 取最后一版再套上之后的改动），放到暂存目录。
   - `node tools/build_os_handbook.mjs <判定器目录> <输出目录>` 生成内容与分段 md5。
   - 用 Supabase 的 SQL：先写进暂存行 `os_handbook_next`（audience `os`），一段一段追加并核对每段 md5；全部 md5 对上后，再在一条语句里把 `os_handbook` 换成暂存内容并删掉暂存行（`where md5(旧内容) = 原来的 md5`，避免盖掉别人刚改的）。
3. 回报时说清楚两边都改了。

格式：`data = { v: 1, gz: base64(gzip(JSON)) }`，JSON 是 `{ CS: {announcements, quicklinks, tasks, week, modules, fx, leadRegions, leadTools}, tools: { 改线判定器: html, 服务中心判定器: html } }`。
