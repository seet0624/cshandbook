// 全站访问密码：浏览器弹出登录框，用户名随意，密码等于环境变量 SITE_PASSWORD。
// Netlify 免费版没有站点密码功能，用 Edge Function 实现同样效果。
import type { Config, Context } from "@netlify/edge-functions";

const REALM = 'Basic realm="SHUYI CS Portal", charset="UTF-8"';

function decodeBasic(header: string): string | null {
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return null;
  }
}

// 逐字符比较完再返回，避免按响应时间猜密码
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (request: Request, context: Context) => {
  const password = Netlify.env.get("SITE_PASSWORD");
  // 没配密码时拒绝访问，而不是放行
  if (!password) {
    return new Response("站点尚未设置访问密码（SITE_PASSWORD）。", { status: 503 });
  }
  const given = decodeBasic(request.headers.get("authorization") ?? "");
  if (given !== null && safeEqual(given, password)) {
    return context.next();
  }
  return new Response("需要密码才能访问客服业务门户。", {
    status: 401,
    headers: { "WWW-Authenticate": REALM, "Content-Type": "text/plain; charset=utf-8" },
  });
};

export const config: Config = { path: "/*" };
