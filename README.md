# 数易 · 客服业务门户

客服内部业务手册：标准流程、话术库、布告栏速查、判定器工具。纯静态站点，部署在 Netlify，全站密码保护。

## 目录结构

| 路径 | 内容 |
|---|---|
| `index.html` | 门户主模板：页面结构、全部章节内容与交互逻辑（`<script type="text/x-dc">` 内） |
| `改线判定器.dc.html` | 改线 / 团队变更判定器组件 |
| `服务中心判定器.dc.html` | 服务中心档位与补 PV 计算组件 |
| `assets/fonts.css`、`assets/fonts/` | 思源宋体、思源黑体、Cormorant Garamond，按字符分片按需加载 |
| `assets/img/` | logo、国旗等图片 |
| `assets/vendor/` | dc-runtime 与 React（本地托管，不依赖外部 CDN） |
| `netlify.toml`、`netlify/edge-functions/basic-auth.ts` | Netlify 配置与全站访问密码 |
| `tools/unbundle.py` | 把 Claude Design 导出的单文件打包页拆成上面的结构 |

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

本地预览不经过 Edge Function，不需要密码。

## 访问密码

在 Netlify 项目的 **Site configuration → Environment variables** 里设置 `SITE_PASSWORD`。
访问时浏览器会弹出登录框：用户名随意填，密码填 `SITE_PASSWORD` 的值。
没设置这个变量时，站点一律拒绝访问。

## 从 Claude Design 重新导出后更新

```bash
python3 tools/unbundle.py ~/Downloads/导出的文件.html
git diff --stat   # 确认改动
```

脚本会覆盖 `index.html`、组件文件和 `assets/`。字体按内容哈希命名，内容没变的文件不会出现在 diff 里。
