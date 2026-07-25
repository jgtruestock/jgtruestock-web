/**
 * 測試 AMD 三段式生成
 * node scripts/test-amd-blocks.mjs
 */
import { readFileSync } from 'fs';

// Load .env.local manually
const env = readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

const FMP_KEY = process.env.FMP_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const MODEL = 'claude-sonnet-4-5';

// ── FMP helpers ─────────────────────────────────────────────────────────────

async function fetchTranscript(symbol) {
  const now = new Date();
  const year = now.getFullYear();
  const quarters = [];
  for (let y = year; y >= year - 1; y--) {
    for (let q = 4; q >= 1; q--) {
      quarters.push([y, q]);
    }
  }
  for (const [y, q] of quarters) {
    try {
      const url = `${FMP_BASE}/earning_call_transcript?symbol=${symbol}&year=${y}&quarter=${q}&apikey=${FMP_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      const t = arr.find(d => d && d.content && d.content.length > 100);
      if (t) {
        console.log(`✅ 找到逐字稿 ${symbol} ${y}Q${q}（${t.content.length} 字）`);
        return t;
      }
    } catch {}
  }
  return null;
}

async function fetchNews(symbol) {
  const url = `${FMP_BASE}/news/stock?symbols=${symbol}&limit=30&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── News text builder（新版，含 snippet）─────────────────────────────────────

function buildNewsText(news) {
  if (!news || news.length === 0) return '（無新聞資料）';
  return news.slice(0, 20).map((n, i) => {
    const snippet = n.text ? n.text.slice(0, 150).replace(/\n/g, ' ') : '';
    return `${i + 1}. [${(n.publishedDate ?? '').slice(0, 10)}] ${n.title}（${n.site ?? ''}）${snippet ? `\n   摘要：${snippet}` : ''}`;
  }).join('\n\n');
}

// ── Anthropic client ─────────────────────────────────────────────────────────

async function callClaude(prompt, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ── Block B：純新聞整理 ────────────────────────────────────────────────────────

async function generateBlockB(symbol, news) {
  if (!news || news.length === 0) return '（近期無相關新聞）';
  const newsText = buildNewsText(news);

  const prompt = `你是財務新聞整理員。以下是 ${symbol} 最近 30 天的新聞。

任務：純粹整理「新聞裡說了什麼事」，條列輸出。

規則：
- 每條新聞一行，格式：「[日期] 事件描述（來源）」
- 只描述新聞裡有的事實，不加評斷、不做比對
- 不提財報數字（除非新聞本身有提）
- 禁止使用你的訓練知識補充任何內容
- 沒有相關新聞就說「近期無相關新聞」
- 使用繁體中文

最近 30 天新聞：
${newsText}`;

  return await callClaude(prompt, 1500);
}

// ── Block C：比對總結 ────────────────────────────────────────────────────────

async function generateBlockC(symbol, blockABody, blockBBody) {
  const prompt = `你是「影子JG」，一個有立場、有判斷力的台灣投資老手。

以下是兩份資料：

【法說會重點（Block A）】
${blockABody.slice(0, 4000)}

【近期新聞摘要（Block B）】
${blockBBody.slice(0, 2000)}

任務：根據 Block A 的法說會承諾，對照 Block B 的近期新聞，輸出【影子JG總結】。

🔴 嚴格規則（違反就是錯誤）：
- Block B 是你唯一可以引用的外部資料來源
- Block B 沒有提到的事情，必須寫「新聞未涵蓋，待驗證」，不能推測
- 禁止使用你的訓練知識推斷任何事實
- 禁止說「應該已經」「可能已經」「預計已」等推測語句
- 禁止 markdown 符號
- 必須用繁體中文

輸出格式：
- 第一行：「【影子JG總結】」（一字不差）
- 對得上的：✅ 開頭（必須引用 Block B 的具體新聞）
- 尚待觀察的：⚠️ 開頭（Block B 未涵蓋 → 寫「新聞未涵蓋，待驗證」）
- 最後一個 ⚠️ 後加：「上面這些如果戰友有看到相關消息，記得告訴JG！」
- 警訊：🔴 開頭（Block B 有矛盾新聞才能寫）
- 最後一句：整體判斷（加速 / 持平 / 警示）`;

  const text = await callClaude(prompt, 2000);
  return text.trim().startsWith('【影子JG總結】') ? text.trim() : `【影子JG總結】\n${text.trim()}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const SYMBOL = 'AMD';

console.log(`\n🔍 開始測試 ${SYMBOL} 三段式生成...\n`);

const [transcript, news] = await Promise.all([
  fetchTranscript(SYMBOL),
  fetchNews(SYMBOL),
]);

console.log(`📰 新聞數量：${news.length} 則\n`);

// Block A = 從現有 DB 取（這裡用逐字稿前半段模擬）
const blockABody = transcript
  ? `【法說會方向】（${transcript.year} Q${transcript.quarter}）\n${transcript.content.slice(0, 3000)}`
  : '（無逐字稿）';

console.log('--- Block A（法說會，前 200 字）---');
console.log(blockABody.slice(0, 200) + '...\n');

console.log('⏳ 生成 Block B（新聞整理）...');
const blockBBody = await generateBlockB(SYMBOL, news);
console.log('\n--- Block B（近期新聞）---');
console.log(blockBBody);

console.log('\n⏳ 生成 Block C（影子JG總結）...');
const blockCBody = await generateBlockC(SYMBOL, blockABody, blockBBody);
console.log('\n--- Block C（影子JG總結）---');
console.log(blockCBody);

console.log('\n✅ 完成');
