#!/usr/bin/env python3
"""把 Claude Design 导出的单文件打包页（Bundled Page）拆成可编辑的静态站点。

用法：
    python3 tools/unbundle.py <导出的 bundle.html> [输出目录，默认仓库根目录]

产出：
    index.html                  门户主模板（dc-runtime 格式，可直接编辑）
    <组件名>.dc.html             子组件（判定器等），运行时按 ./<名字>.dc.html 读取
    assets/fonts.css            全部 @font-face，字体按 unicode-range 分片按需加载
    assets/fonts/*.woff2        字体分片（同内容去重，按内容哈希命名）
    assets/img/...              logo、国旗等图片
    assets/vendor/...           dc-runtime、React（本地托管，不依赖 unpkg）

打包时缺失的 Noto Serif SC 字体分片，会按 unicode-range 去 Google Fonts 补齐（需要联网；
补不到时保留原状，浏览器对那部分字符回退到系统字体）。
"""
import base64
import gzip
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
CHROME_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/120 Safari/537.36")
EXT = {"image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg",
       "image/webp": "webp", "font/woff2": "woff2", "text/javascript": "js",
       "text/css": "css", "text/html": "html"}
# 没有 ext_resources id 的资源，按 uuid 指定可读文件名
NAMES = {"37ec551c-d1b8-45be-9a0a-8b3f0e007f7c": "img/logo.png"}
VENDOR = {"react.production.min.js", "react-dom.production.min.js"}


def script_block(src, kind):
    m = re.search(r'<script type="__bundler/%s">(.*?)</script>' % re.escape(kind), src, re.S)
    return json.loads(m.group(1)) if m else None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_range(r):
    return re.sub(r"\s+", "", r).lower()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": CHROME_UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    bundle = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
    src = bundle.read_text(encoding="utf-8")

    manifest = script_block(src, "manifest")
    template = script_block(src, "template")
    ext_resources = script_block(src, "ext_resources") or []
    if manifest is None or template is None:
        sys.exit("不是 Bundled Page：找不到 manifest / template")

    blobs = {}
    for uuid, entry in manifest.items():
        data = base64.b64decode(entry["data"])
        blobs[uuid] = (entry["mime"], gzip.decompress(data) if entry.get("compressed") else data)

    paths = {}       # uuid -> 站内相对路径
    written = {}     # 内容哈希 -> 路径（去重）

    def write(rel, data):
        digest = hashlib.sha1(data).hexdigest()
        if digest in written:
            return written[digest]
        p = out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        written[digest] = rel
        return rel

    # ext_resources：带 id 的资源（国旗、子组件、CDN 脚本）
    resources = {}
    for r in ext_resources:
        rid, uuid = r["id"], r["uuid"]
        mime, data = blobs[uuid]
        if rid.endswith(".dc.html"):
            # 子组件放在根目录，运行时会自己 fetch ./<名字>.dc.html
            name = urllib.parse.unquote(rid.split("/")[-1])
            (out / name).write_text(data.decode("utf-8"), encoding="utf-8")
            paths[uuid] = name
            continue
        if rid.startswith("http"):
            base = rid.rsplit("/", 1)[-1]
            rel = "assets/vendor/" + base if base in VENDOR else "assets/vendor/" + slug(base)
        elif rid.startswith("flag_"):
            rel = "assets/img/flags/%s.%s" % (rid[5:], EXT[mime])
        else:
            rel = "assets/img/%s.%s" % (slug(rid), EXT[mime])
        paths[uuid] = resources[rid] = write(rel, data)

    # 字体：从模板里抽出 @font-face 样式块
    font_css_m = re.search(r"<style>(\s*/\*[^*]*\*/\s*@font-face.*?)</style>", template, re.S)
    font_css = font_css_m.group(1) if font_css_m else ""
    rule_re = re.compile(r"@font-face\s*\{[^}]*?font-family:\s*'([^']+)'[^}]*?src:\s*url\(\"(%s)\"\)"
                         r"[^}]*?unicode-range:\s*([^;]+);" % UUID, re.S)
    google_cache = {}

    def google_rules(family):
        if family not in google_cache:
            weights = sorted(set(re.findall(
                r"font-family:\s*'%s';[^}]*?font-weight:\s*(\d+)" % re.escape(family), font_css)))
            url = ("https://fonts.googleapis.com/css2?family=%s:wght@%s&display=swap"
                   % (family.replace(" ", "+"), ";".join(weights)))
            try:
                css = fetch(url).decode("utf-8")
                google_cache[family] = {
                    norm_range(rng): u for u, rng in re.findall(
                        r"src:\s*url\(([^)]+)\)[^;]*;\s*unicode-range:\s*([^;]+);", css)}
            except Exception as e:  # 离线也能拆包，只是缺的分片补不上
                print("  ! 无法从 Google Fonts 补齐 %s：%s" % (family, e))
                google_cache[family] = {}
        return google_cache[family]

    missing, filled = 0, 0
    for family, uuid, rng in rule_re.findall(font_css):
        if uuid in paths:
            continue
        if uuid in blobs:
            paths[uuid] = write("assets/fonts/%s-%s.woff2" % (
                slug(family), hashlib.sha1(blobs[uuid][1]).hexdigest()[:8]), blobs[uuid][1])
            continue
        missing += 1
        url = google_rules(family).get(norm_range(rng))
        if url:
            data = fetch(url)
            paths[uuid] = write("assets/fonts/%s-%s.woff2" % (
                slug(family), hashlib.sha1(data).hexdigest()[:8]), data)
            filled += 1

    # 其余资源（logo、运行时脚本等）
    for uuid, (mime, data) in blobs.items():
        if uuid in paths:
            continue
        if uuid in NAMES:
            rel = "assets/" + NAMES[uuid]
        elif mime == "text/javascript" and b"dc-runtime" in data[:200]:
            rel = "assets/vendor/dc-runtime.js"
        else:
            rel = "assets/misc/%s.%s" % (uuid[:8], EXT.get(mime, "bin"))
        paths[uuid] = write(rel, data)

    # 字体 CSS 单独成文件；路径相对 assets/
    for uuid, rel in paths.items():
        font_css = font_css.replace(uuid, rel[len("assets/"):] if rel.startswith("assets/") else "../" + rel)
    (out / "assets").mkdir(parents=True, exist_ok=True)
    (out / "assets/fonts.css").write_text(font_css.strip() + "\n", encoding="utf-8")

    if font_css_m:
        template = template.replace(font_css_m.group(0),
                                    '<link rel="stylesheet" href="assets/fonts.css">', 1)
    # 字体已本地托管，Google Fonts 的预连接没用了
    template = re.sub(r'\s*<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>',
                      "", template)
    for uuid, rel in paths.items():
        template = template.replace(uuid, rel)

    # 运行时通过 window.__resources 按 id 查资源（国旗、React）
    resource_script = "<script>window.__resources = %s;</script>" % json.dumps(
        resources, ensure_ascii=False, indent=1).replace("</", "<\\/")
    head = re.search(r"<head[^>]*>", template)
    template = template[:head.end()] + "\n" + resource_script + template[head.end():]
    template = template.replace("<head>", "<head>\n<title>数易 · 客服业务门户</title>", 1) \
        if "<title>" not in template else template
    (out / "index.html").write_text(template, encoding="utf-8")

    leftover = set(re.findall(UUID, template)) & set(manifest)
    print("拆包完成 → %s" % out)
    print("  资源 %d 个，写出文件 %d 个（去重后）" % (len(paths), len(written)))
    print("  缺失字体分片 %d 条规则，已补齐 %d 条" % (missing, filled))
    if leftover:
        print("  ! 模板里仍有未替换的 uuid：%s" % ", ".join(sorted(leftover)))


if __name__ == "__main__":
    main()
