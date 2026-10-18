// 数易助手后端：POST /api/ask  { question, history? } → { answer, reply, sources }
// 只根据客服手册（content/ 生成的 handbook.mjs）回答。API Key 放在 Netlify 环境变量 ANTHROPIC_API_KEY。
import Anthropic from '@anthropic-ai/sdk';
import { HANDBOOK, SECTIONS } from './handbook.mjs';

const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];

// 默认用最强的模型；想省钱可在 Netlify 环境变量里设 ASSISTANT_MODEL=claude-sonnet-5-5 或 claude-haiku-5-5
const MODEL = env('ASSISTANT_MODEL') || 'claude-opus-5-5';
const EFFORT = env('ASSISTANT_EFFORT') || 'low';
const ALLOWED_ORIGINS = (env('ALLOWED_ORIGINS') || 'https://seet0624.github.io').split(',').map((s) => s.trim()).filter(Boolean);

const MAX_QUESTION = 500;
const MAX_HISTORY = 8;
const MAX_HISTORY_CHARS = 1500;

const SYSTEM = `你是「数易助手」，数易客服团队内部使用的问答助手。提问的人是客服同事，他们在回复学员（客户）或服务中心时来查手册。

规则：
1. 只根据下面 <handbook> 里的客服手册回答。手册没写的，不要猜、不要用常识补，直接说「手册里没有写到」，并建议问主管。
2. 涉及费用、时限、是否清零、要不要报价、谁审批这类规定，按手册原文的数字和条件回答，条件分支要讲清楚。
3. answer：写给客服同事看，简体中文，先给结论，再列关键条件或步骤，通常 2–6 行，不用 Markdown 标题和粗体。
4. reply：如果这个问题适合直接回复学员，写一段可以原样发给学员的礼貌回复（以「您好，」开头，不提内部流程细节和同事姓名）；不适合就留空字符串。
5. sources：列出答案依据的章节 id（就是 <section id="..."> 里的 id），最多 3 个，按相关度排序；手册里没有答案时给空列表。
6. 问题和客服工作无关时，礼貌说明你只回答客服手册相关的问题。
回答要快，直接开始给出答案。

<handbook>
${HANDBOOK}
</handbook>`;

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    reply: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'reply', 'sources'],
  additionalProperties: false,
};

const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 1, timeout: 50_000 });

function corsHeaders(origin) {
  const h = { 'Vary': 'Origin' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

const json = (body, status, headers) => Response.json(body, { status, headers });

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const msgs = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
  // 消息必须 user 开头、user/assistant 交替
  const out = [];
  for (const m of msgs) {
    if (!out.length && m.role !== 'user') continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = m;
    else out.push(m);
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop();
  return out;
}

export async function answer(question, history = []) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [...cleanHistory(history), { role: 'user', content: question }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
  });

  if (response.stop_reason === 'refusal') {
    return { answer: '这个问题我没办法回答。请换个说法，或直接问主管。', reply: '', sources: [] };
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('回答太长被截断了');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const data = JSON.parse(text);
  return {
    answer: String(data.answer || '').trim(),
    reply: String(data.reply || '').trim(),
    sources: (Array.isArray(data.sources) ? data.sources : []).filter((id) => SECTIONS[id]).slice(0, 3),
  };
}

export default async (req, context) => {
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: '只接受 POST' }, 405, cors);
  if (!cors['Access-Control-Allow-Origin']) return json({ error: '来源网站不在允许名单' }, 403, cors);
  if (!env('ANTHROPIC_API_KEY')) return json({ error: '助手还没设置 API Key' }, 503, cors);

  let body;
  try { body = await req.json(); } catch { return json({ error: '请求格式不对' }, 400, cors); }
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) return json({ error: '问题是空的' }, 400, cors);
  if (question.length > MAX_QUESTION) return json({ error: `问题太长了，请控制在 ${MAX_QUESTION} 字以内` }, 400, cors);

  try {
    return json(await answer(question, body.history), 200, cors);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: '现在问的人太多，请稍等一分钟再试。' }, 429, cors);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY 无效');
      return json({ error: '助手的 API Key 无效，请联系管理员。' }, 503, cors);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}: ${error.message}`);
      return json({ error: 'AI 服务暂时出错，请稍后再试。' }, 502, cors);
    }
    console.error('ask failed:', error);
    return json({ error: 'AI 暂时连不上，请稍后再试。' }, 500, cors);
  }
};

export const config = {
  path: '/api/ask',
  method: ['POST', 'OPTIONS'],
  // 每个 IP 每分钟最多 10 次，超出返回 429
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 10 },
};
