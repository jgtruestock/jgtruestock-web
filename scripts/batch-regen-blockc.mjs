/**
 * 批次重生成 Block C（影子JG總結）
 * 對所有股票：Block A 不動，用新版 prompt 重新生成 Block C
 */
import { readFileSync } from 'fs';

// Load .env.local
const env = readFileSync('/Users/jgtruestock/repos/jgtruestock-web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

import { MongoClient } from 'mongodb';

const FMP_KEY = process.env.FMP_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-5';
const MONGO_URI = process.env.MONGODB_URI;

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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function buildNewsText(news) {
  if (!news || news.length === 0) return '（無新聞資料）';
  return news.slice(0, 20).map((n, i) => {
    const snippet = n.text ? n.text.slice(0, 150).replace(/\n/g, ' ') : '';
    return `${i + 1}. [${(n.publishedDate ?? '').slice(0, 10)}] ${n.title}（${n.site ?? ''}）${snippet ? `\n   摘要：${snippet}` : ''}`;
  }).join('\n\n');
}

async function fetchNews(symbol) {
  try {
    const res = await fetch(`https://financialmodelingprep.com/stable/news/stock?symbols=${symbol}&limit=20&apikey=${FMP_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function generateBlockB(symbol, news) {
  if (!news || news.length === 0) return '（近期無相關新聞）';
  const newsText = buildNewsText(news);
  const prompt = `你是財務新聞整理員。以下是 ${symbol} 最近 30 天的新聞。

任務：純粹整理「新聞裡說了什麼事」，條列輸出。

規則：
- 每條新聞一行，格式：「[日期] 事件描述（來源）」
- 只描述新聞裡有的事實，不加評斷、不做比對
- 禁止使用你的訓練知識補充任何內容
- 使用繁體中文

最近 30 天新聞：
${newsText}`;
  return await callClaude(prompt, 1200);
}

async function generateBlockC(symbol, blockABody, blockBBody) {
  const prompt = `你是「影子JG」，一個有立場、有判斷力的台灣投資老手。

【法說會重點（Block A）】
${blockABody.slice(0, 4000)}

【近期新聞摘要（Block B）】
${blockBBody.slice(0, 2000)}

任務：根據 Block A 的法說會承諾，對照 Block B 的近期新聞，輸出【影子JG總結】。

🔴 嚴格規則：
- Block B 是你唯一可以引用的外部資料來源
- Block B 沒有提到的事情，說「目前尚未看到相關消息，後續關注」，不能推測
- 禁止說「應該已經」「可能已經」「預計已」等推測語句
- 禁止 markdown 符號，必須用繁體中文

風格規則：
- 整體是流暢的對話，像跟朋友說話，不是逐條報告
- 多個相關的好消息整合成一段說，不用每個都獨立一條
- ✅ 口語自然，說「XXX的事出來了，跟法說會說的對上了」
- ⚠️ 語氣必須中性：「法說會提到 XXX，目前尚未看到相關消息，後續關注」
  禁止說「連消息都沒看到」「完全沒有」等帶驚訝感的措辭
  法說會沒有承諾任何時間點，沒有消息是正常的
- 🔴 只在新聞明確與法說會矛盾時才寫，不要輕易用
- 最後整體判斷一段話，說清楚現在的狀況和要等什麼

格式：
- 第一行：「【影子JG總結】」（一字不差）
- ✅/⚠️/🔴 整合式段落
- 最後一個 ⚠️ 後加：「上面這些如果戰友有看到相關消息，記得告訴JG！」
- 整體判斷一段（說清楚，不只一句話）`;

  const text = await callClaude(prompt, 2000);
  return text.trim().startsWith('【影子JG總結】') ? text.trim() : `【影子JG總結】\n${text.trim()}`;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('jgtruestock');

  const all = await db.collection('jg_commentary').find({}).toArray();
  console.log(`開始批次更新 ${all.length} 支股票 Block C...\n`);

  let success = 0, failed = 0;
  const failedSymbols = [];

  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    const symbol = c.symbol;
    const blockABody = c.earningsDirection?.body ?? '';

    console.log(`[${i + 1}/${all.length}] ${symbol}...`);

    try {
      // Fetch news
      const news = await fetchNews(symbol);
      
      // Generate Block B
      const blockBBody = await generateBlockB(symbol, news);
      
      // Generate Block C
      const blockCBody = await generateBlockC(symbol, blockABody, blockBBody);

      // Compose new draftBody
      const newBody = blockABody + '\n\n' + blockCBody;

      // Update DB
      const now = new Date();
      await db.collection('jg_commentary').updateOne(
        { symbol },
        {
          $set: {
            newsDigest: { body: blockBBody, generatedAt: now },
            shadowJGSummary: { body: blockCBody, generatedAt: now },
            draftBody: newBody,
            ...(c.status !== 'published' ? {} : { publishedBody: newBody }),
          }
        }
      );

      console.log(`  ✅ ${symbol} 完成（新聞 ${news.length} 則）`);
      success++;
    } catch (err) {
      console.log(`  ❌ ${symbol} 失敗: ${err.message}`);
      failed++;
      failedSymbols.push(symbol);
    }

    // Rate limit: 15秒間隔（避免 Anthropic API 限流）
    if (i < all.length - 1) await sleep(15000);
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功：${success} 支`);
  console.log(`失敗：${failed} 支 ${failedSymbols.length ? '→ ' + failedSymbols.join(', ') : ''}`);

  await client.close();
}

main().catch(console.error);
