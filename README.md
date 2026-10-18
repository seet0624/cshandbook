# 数易 · 客服业务门户

客服内部业务手册：标准流程、话术库、布告栏速查、判定器工具。纯静态站点，通过 GitHub Pages 发布在
<https://seet0624.github.io/cshandbook/>。

> 站点是公开的：页面带 `noindex`，搜索引擎不会收录，但知道网址的人都能打开，仓库源码也公开。
> 不要往这里放学员个人信息、账号密码等敏感内容。

## 改内容（不用懂代码）

所有文字内容都在 `content/` 目录里，按改动频率分成三个文件：

| 文件 | 内容 |
|---|---|
| `content/首页.js` | 公告、常用快捷入口、「我现在要办什么」、新手第一周五课 |
| `content/章节.js` | 侧栏的全部模块、章节和正文（话术总库会自动从这里的问答汇总） |
| `content/汇率与工期.js` | 固定汇率表、工期判定器的天数 |

步骤：

1. 在 GitHub 上打开要改的文件，点右上角铅笔图标 ✏️。
2. 照着文件开头的说明改文字。
3. 点 **Commit changes**，几分钟后网站自动更新（看不到新内容时按 Ctrl+Shift+R 强制刷新）。

改坏了怎么办：

- 网站顶部会出现红色提示，写明是哪个文件、第几行出错，其余部分照常显示。
- GitHub 会自动检查每次修改，有问题时提交旁边显示红叉 ❌，并发邮件给提交的人。
  点红叉 → **Details** 能看到中文的错误说明，比如「第 38 行：漏了逗号」「go:'xxx' 找不到这个章节」。
- 改回去最快的办法：在文件页面点 **History**，找到上一个版本复制回来。

服务中心判定器（补 PV 计算）的工具价格、档位和汇率在 `服务中心判定器.dc.html` 末尾的 `D0` 里，
改汇率时要和 `content/汇率与工期.js` 一起改，两边对不上时自动检查会提醒。

## 目录结构

| 路径 | 内容 |
|---|---|
| `content/` | 内容数据（见上） |
| `index.html` | 门户页面结构与交互逻辑，开头加载 `content/` 里的文件 |
| `改线判定器.dc.html`、`服务中心判定器.dc.html` | 两个判定器组件 |
| `assets/` | 字体（按字符分片按需加载）、图片、dc-runtime 与 React（本地托管，不依赖外部 CDN） |
| `tools/check_content.mjs` | 内容检查脚本，GitHub Actions 每次改动自动运行 |
| `netlify/`、`netlify.toml`、`package.json` | 数易助手的 AI 后端（Netlify Functions），见下 |
| `tools/build_handbook.mjs` | 把 `content/` 整理成纯文字给 AI 助手当资料，Netlify 部署时自动运行 |
| `tools/unbundle.py` | 把 Claude Design 导出的单文件打包页拆成静态文件（只用于首次迁移，见下） |
| `.nojekyll` | 让 GitHub Pages 原样发布文件，跳过 Jekyll 处理 |

## 数易助手（AI 问答）

右下角的「问数易助手」按钮，以及首页的「开始提问」，会打开助手面板。

- **后端**：`netlify/functions/ask/ask.mjs`，部署在 Netlify，接口是 `/api/ask`。它调用 Claude API，只根据客服手册回答，每条回答附章节出处，适合时附一段可直接发给学员的回复。
- **手册资料自动同步**：Netlify 每次部署都会从 `content/` 重新整理手册（`tools/build_handbook.mjs`）。Netlify 连接了这个 GitHub 仓库时，改完内容会自动重新部署，助手也跟着更新。
- **接口地址**：`index.html` 开头的 `window.ASSISTANT_ENDPOINT`，目前是 `https://shuyi-assistant.netlify.app/api/ask`（Netlify 项目 shuyi-assistant）。
- **离线模式**：`index.html` 里的 `window.ASSISTANT_ENDPOINT` 留空，或者后端连不上时，助手改用内置的关键词库，并按全站搜索推荐相关章节。
- **Netlify 环境变量**（Site configuration → Environment variables，作用范围要包含 Functions）：

  | 变量 | 说明 |
  |---|---|
  | `ANTHROPIC_API_KEY` | 必填。Claude API Key，在 console.anthropic.com 申请；只放这里，不要写进代码或发在聊天里 |
  | `ASSISTANT_MODEL` | 可选，默认 `claude-opus-5-5`。想省钱可改成 `claude-sonnet-5-5` 或 `claude-haiku-5-5` |
  | `ASSISTANT_EFFORT` | 可选，默认 `low`（回答快）。可改成 `medium` |
  | `ALLOWED_ORIGINS` | 可选，默认 `https://seet0624.github.io`，只有这个网站能调用接口 |

- **问题记录**：每次提问会在 Netlify 函数日志（Logs → Functions → ask）记一行 `[ask]`，内容是问题文字（电话、电邮、编号已自动遮掉）和引用的章节，用来了解同事怎么问、改进助手。日志保留时间按 Netlify 方案而定。
- **防滥用**：每个 IP 每分钟最多 10 次、问题最长 500 字。接口地址是公开的，建议在 Anthropic Console 设置每月用量上限。

## 本地预览与检查

```bash
python3 -m http.server 8000      # 打开 http://localhost:8000
node tools/check_content.mjs     # 检查内容文件
```

## 关于 Claude Design 重新导出

内容拆到 `content/` 之后，**这个仓库就是唯一的内容来源**。Claude Design 里那份设计稿的内容不会再同步更新，
重新导出的文件里还是旧内容，所以 `tools/unbundle.py` 发现 `content/` 已存在时会拒绝覆盖。
需要改版式时，直接改 `index.html`，或者在 Claude Design 改好后只把样式部分手动合并过来。
