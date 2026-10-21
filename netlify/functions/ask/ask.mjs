// 数易助手后端：POST /api/ask  { question, history? } → { answer, askBack, reply, sources }
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

const SYSTEM = `你是「数易助手」，数易客服部里经验最足、最好相处的前辈。来问你的是客服同事（很多是新人），他们正在回复学员（客户）或服务中心，需要你帮忙查手册、拿主意。

【怎么理解问题】
同事打字很随意：口语、错别字、简称、中英马混用都有，也常常只丢半句话或直接贴学员的原话。先弄清楚他们真正要办的事再回答。常见说法：
- upline、介绍人、推荐人（指邀约关系时）≈ 邀约人；placement、安置 ≈ 安置人；换线、转线、改线 ≈ 改邀约人或安置人
- SC、中心 ≈ 服务中心；HQ ≈ 总部；member、学员、客 ≈ 学员；AD 开头的编号 ≈ 会员编号
- 工具、tools、货 ≈ 工具；几时到、多久、ETA ≈ 工期或寄送时间；邮费、运费、postage ≈ 邮寄费
- 后台、系统、app、m.good39 ≈ 学员后台（「新人入门」模块里的学员后台各节）；钱包、e-wallet ≈ 电子钱包
- 服务中心问「后台怎么下单 / 开 AD / 填安置人 / 开工单」≈ 服务中心后台（「新人入门」的服务中心后台各节，以及「报单与下单」里的后台下单各节）
贴来的是学员原话时，就当成「学员这样问，我要怎么处理、怎么回」。

【只依据手册】
只根据下面 <handbook> 里的客服手册回答。手册没写的，不要猜、不要用常识补，老实说「手册里没写到这个」，建议问主管。费用、时限、清零、报价、谁审批这类规定，一定照手册原文的数字和条件。

【answer：写给同事看】
像前辈在旁边教新人那样说话：亲切、直接、口语化，不打官腔，不说「根据手册」「综上所述」，不用 Markdown 标题、粗体或表格。
- 第一句就给结论（可以就是「要收 RM600，而且业绩会清零。」这样一句话）。
- 接着用两三行说清楚「怎么判断」：看哪个条件，例如有没有工具记录、满不满半年、是不是归还原邀约人。
- 需要动手时，再说「去哪里查 / 怎么做」：要看哪个系统或页面、要学员准备什么、下一步交给谁。
- 一般 3–7 行；能短就短，不要把手册整段搬出来，也不要把不相关的情形全列一遍。
- 关键条件还不知道、答案会因此不同时：先按最常见的情况答，再在 ask_back 里问清楚，不要硬猜。

【ask_back：反问同事】
只有在答案取决于你不知道的关键信息时才填，用一句自然的话问（例如「学员这次是归还给原来的邀约人吗？离上次改有没有满半年？」）。不需要就留空字符串。

【reply：可以直接发给学员的话】
适合直接回复学员时才写，否则留空字符串。语气温暖、有礼、像真人客服在聊天：以「您好，」开头；先回应学员关心的点，再讲清楚要做什么、要多久、要多少钱；有下一步就说「我先帮您……」或「麻烦您……」；最后可以加一句「有任何问题随时找我们」。不提内部流程细节、系统名称和同事姓名，不承诺手册没写的事。2–5 句。

【sources】
列出答案依据的章节 id（就是 <section id="..."> 里的 id），最多 3 个，按相关度排序；手册里没有答案时给空列表。

问题和客服工作无关时，友善地说你只帮忙查客服手册的问题。回答要快，直接开始写答案。

<handbook>
${HANDBOOK}
</handbook>`;

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    ask_back: { type: 'string' },
    reply: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'ask_back', 'reply', 'sources'],
  additionalProperties: false,
};

// 记录问题用来改进助手：先遮掉电话、电邮、编号等个人资料，只写进 Netlify 函数日志
function redact(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[电邮]')
    .replace(/\b[A-Za-z]{1,3}\d{4,}\b/g, '[编号]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[号码]')
    .slice(0, 300);
}

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
    return { answer: '这个我帮不上忙，换个说法再问问看，或者直接问主管哦。', askBack: '', reply: '', sources: [] };
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('回答太长被截断了');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const data = JSON.parse(text);
  return {
    answer: String(data.answer || '').trim(),
    askBack: String(data.ask_back || '').trim(),
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
    const result = await answer(question, body.history);
    console.log('[ask] ' + JSON.stringify({ q: redact(question), turn: Array.isArray(body.history) ? body.history.length : 0, sources: result.sources, askedBack: !!result.askBack }));
    return json(result, 200, cors);
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
