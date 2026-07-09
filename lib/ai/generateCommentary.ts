/**
 * PR 1 — AI 點評生成函式（升級：兩段式分析）
 * 使用 Anthropic Claude，客觀財經新聞風格，繁體中文
 */
import Anthropic from '@anthropic-ai/sdk';
import type { EarningsTranscript, StockNewsArticle } from '@/lib/fmp';

const MODEL = 'claude-sonnet-4-5';

// ─── KeyPoint types ───────────────────────────────────────────────────────────

export type PromiseCategory =
  | 'revenue'           // 營收目標
  | 'margin'            // 毛利率/淨利率
  | 'capex'             // 資本支出
  | 'product'           // 產品/技術里程碑
  | 'headcount'         // 人力計畫
  | 'guidance'          // 財務指引
  | 'market_expansion'; // 市場拓展

export type PromiseStatus = 'pending' | 'fulfilled' | 'partially' | 'broken' | 'unclear';

export interface KeyPoint {
  category: PromiseCategory;
  summary: string;        // 一句話中文摘要
  originalText: string;   // 英文原文引用（50字內）
  targetQuarter: string | null;  // 預計兌現季度 e.g. "2026-Q3"
  status: PromiseStatus;  // AI 根據新聞判斷
  statusNote: string;     // 中文說明（1-2句，引用具體新聞）
  newsEvidence: string;   // 哪條新聞是依據
}

export interface GenerateCommentaryResult {
  title: string;
  body: string;           // 原有的敘述式摘要（保留）
  model: string;
  keyPoints: KeyPoint[];  // 新增：結構化要點
}

export async function generateCommentary(
  symbol: string,
  transcript: EarningsTranscript | null,
  news: StockNewsArticle[],
  mentionDate: string,
  mentionClose: number,
  latestClose: number
): Promise<GenerateCommentaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });

  // ── Original title+body generation (unchanged) ────────────────────────────
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(symbol, transcript, news, mentionDate, mentionClose, latestClose);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseResponse(text);

  // ── Two-step KeyPoint extraction ─────────────────────────────────────────
  const keyPoints = await generateKeyPoints(client, transcript, news);

  return { ...parsed, model: MODEL, keyPoints };
}

// ─── Two-step KeyPoint generation ────────────────────────────────────────────

async function generateKeyPoints(
  client: Anthropic,
  transcript: EarningsTranscript | null,
  news: StockNewsArticle[]
): Promise<KeyPoint[]> {
  // If no transcript, return empty array immediately
  if (!transcript) return [];

  const transcriptText = transcript.content ?? '';
  const newsText = buildNewsText(news);

  // ── Step 1: Extract structured key points from transcript ─────────────────
  let step1Results: Array<{
    category: string;
    summary: string;
    originalText: string;
    targetQuarter: string | null;
  }> = [];

  try {
    const step1Prompt = `你是財務分析師。從以下法說會逐字稿提取管理層的可驗證要點。

要提取的分類（全部）：
- revenue: 具體營收目標或結果
- margin: 毛利率/淨利率目標
- capex: 資本支出計畫（金額+用途）
- product: 產品發佈時程（有時間點的）
- headcount: 人力擴張/縮減計畫
- guidance: 下季/全年財務指引
- market_expansion: 市場進入/拓展計畫

輸出純 JSON array（不要 markdown code block），每筆：
{
  "category": "...",
  "summary": "一句話中文摘要",
  "originalText": "原文引用（英文，50字內）",
  "targetQuarter": "2026-Q3" 或 null
}

只提取有具體數字或時程的要點。模糊表態不算。
最多 8 個要點。

法說會逐字稿：
---
${transcriptText.slice(0, 8000)}
---`;

    const step1Response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: step1Prompt }],
    });

    const step1Text = step1Response.content[0].type === 'text' ? step1Response.content[0].text : '[]';
    step1Results = parseJsonSafe(step1Text, []);
  } catch (err) {
    console.error('[generateKeyPoints] Step 1 failed:', err);
    return [];
  }

  if (!step1Results || step1Results.length === 0) return [];

  // ── Step 2: Match key points against recent news ──────────────────────────
  try {
    const step2Prompt = `你是財務分析師。以下是一家公司法說會的要點，以及最近 30 天的新聞。

請對每個要點判斷「目前狀態」：
- pending: 時間未到，新聞無法確認
- fulfilled: 新聞顯示已達成
- partially: 部分達成
- broken: 新聞顯示未達成或下調
- unclear: 新聞資訊不足

每個要點輸出純 JSON array（不要 markdown code block），每筆：
{
  "category": "...",（與輸入相同）
  "status": "pending|fulfilled|partially|broken|unclear",
  "statusNote": "中文說明，引用具體新聞標題或數字",
  "newsEvidence": "用哪條新聞判斷（標題，如無則填「—」）"
}

法說會要點：
${JSON.stringify(step1Results, null, 2)}

最近 30 天新聞：
${newsText}`;

    const step2Response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: step2Prompt }],
    });

    const step2Text = step2Response.content[0].type === 'text' ? step2Response.content[0].text : '[]';
    const step2Results: Array<{
      category: string;
      status: string;
      statusNote: string;
      newsEvidence: string;
    }> = parseJsonSafe(step2Text, []);

    // Merge step1 + step2 by index
    const keyPoints: KeyPoint[] = step1Results.map((item, i) => {
      const match = step2Results[i] ?? {};
      return {
        category: (item.category ?? 'guidance') as PromiseCategory,
        summary: item.summary ?? '',
        originalText: item.originalText ?? '',
        targetQuarter: item.targetQuarter ?? null,
        status: (match.status ?? 'unclear') as PromiseStatus,
        statusNote: match.statusNote ?? '新聞資訊不足',
        newsEvidence: match.newsEvidence ?? '—',
      };
    });

    return keyPoints;
  } catch (err) {
    console.error('[generateKeyPoints] Step 2 failed:', err);
    // Return step1 results with default status
    return step1Results.map((item) => ({
      category: (item.category ?? 'guidance') as PromiseCategory,
      summary: item.summary ?? '',
      originalText: item.originalText ?? '',
      targetQuarter: item.targetQuarter ?? null,
      status: 'unclear' as PromiseStatus,
      statusNote: '新聞比對失敗',
      newsEvidence: '—',
    }));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNewsText(news: StockNewsArticle[]): string {
  if (!news || news.length === 0) return '（無新聞資料）';
  return news
    .slice(0, 30)
    .map((n, i) => `${i + 1}. [${n.publishedDate?.slice(0, 10) ?? ''}] ${n.title}（${n.site ?? ''}）`)
    .join('\n');
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find JSON array in the text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `你是「影子JG」——一個有立場、有判斷力的台灣投資老手。
你的工作是把法說會內容和最近新聞對比，用直白有力的方式讓一般投資人讀懂。

寫作風格規定（最重要，必須遵守）：
- 繁體中文，口語化，不要學術腔、不要券商報告腔
- 用生動的比喻和類比（例如：「太空界的富士康加聯邦快遞」「端到端太空公司」）
- 有立場，不裝中立，說出你的真實判斷
- 具體，引用數字、產品名、人名，不要說「公司正在擴展業務」這種廢話
- 不要下「買進」「賣出」等交易建議

以下是「【公司現在在做什麼（白話）】」的寫作範本（RKLB 版本，學這個風格，不要用券商報告風格）：

Rocket Lab 原本是做小型火箭發射的公司，現在想變成「太空界的富士康加聯邦快遞」。他們不只幫客戶把衛星送上太空，還自己製造衛星、衛星零組件、甚至火星探測車用的機械臂，從設計到發射全包。最重要的是，他們正在準備年底發射中型火箭 Neutron，可以跟 SpaceX 的 Falcon 9 正面競爭，而且設計成能回收重複使用。
JG 認為這家公司值得追蹤，是因為他們是唯一能跟 SpaceX 打對台的端到端太空公司。小火箭 Electron 已經證明可以穩定賺錢，衛星製造業務拿到美國國防部大單，現在就等 Neutron 首飛成功，一旦驗證技術，整個商業模式就打通了。

以下是「整體方向判斷」的寫作範本（RKLB 版本，學這個結構和語氣）：

30 天新聞下來，RKLB 在法說會描述的那條「端到端太空公司」戰略路上——整體是中性偏加速，但有一個關鍵方向出現警示燈。
加速的部分：Electron 發射業務確實在加快節奏（太空軍任務「破紀錄」驗證了快速響應能力），國防訂單線穩固，這條路是在往前走的。
有警示燈的部分：Neutron 是整個戰略的核心轉折點，但兩個月完全沒有進度更新。法說會說的「年底首飛」如果實現，公司從小火箭公司變中型火箭公司的轉型就成了。如果延遲，整個戰略節奏就慢下來。
結論：大方向沒有轉向，但最關鍵的一步（Neutron）還在懸空，現在無法確認戰略轉型是否按計畫推進。

必須嚴格遵守輸出格式：
標題：（一句話總結，像一個老手在說他這次觀察到什麼）
---
【公司現在在做什麼（白話）】
（第一段：3-4 句白話，說公司在做什麼、怎麼賺錢，用生動比喻和類比）
（第二段：以「JG 認為這家公司值得追蹤，是因為⋯」開頭，說投資人關注的核心理由和轉折點是什麼）

【法說會方向】
（引用具體數字和管理層原話，150-200字）

【最近官方動態】
（引用具體新聞標題和日期，150-200字）

【影子JG總結】
目前狀況：（有立場的整體評語，1-2句）

✅ 對得上：（每點一行，具體說哪件事對上了）
⚠️ 尚待觀察：（每點一行，最後加「上面這些如果戰友有看到相關消息，記得告訴JG！」）
🔴 警訊：（如無則寫「目前沒有看到明顯矛盾的報導」）
整體方向判斷：（先給結論：加速/減緩/中性偏加速/中性偏減緩/有轉向跡象。然後拆成「加速的部分：」和「有警示燈的部分：」（如有）。最後一句「結論：」收尾。）`;
}

function buildUserPrompt(
  symbol: string,
  transcript: EarningsTranscript | null,
  news: StockNewsArticle[],
  mentionDate: string,
  mentionClose: number,
  latestClose: number
): string {
  const priceDiffPct =
    mentionClose > 0
      ? (((latestClose - mentionClose) / mentionClose) * 100).toFixed(1)
      : 'N/A';
  const priceDirection = parseFloat(priceDiffPct) >= 0 ? '上漲' : '下跌';

  const stockInfo = `【股票】${symbol}
【參考日期】${mentionDate}
【參考股價】$${mentionClose}
【目前股價】$${latestClose}（${priceDirection} ${Math.abs(parseFloat(priceDiffPct))}%）`;

  const transcriptSection = transcript
    ? `【最新法說會】${transcript.year} 年 Q${transcript.quarter}（${transcript.date}）
完整逐字稿：
---
${transcript.content}
---`
    : `【法說會資料】本期暫無法說會逐字稿，請根據新聞進行分析。`;

  const newsSection =
    news.length > 0
      ? `【近期重要新聞】（最新 ${Math.min(news.length, 15)} 則）
${news
  .slice(0, 15)
  .map((n, i) => `${i + 1}. [${n.publishedDate?.slice(0, 10)}] ${n.title}（來源：${n.site}）`)
  .join('\n')}`
      : `【近期新聞】暫無新聞資料。`;

  return `${stockInfo}

${transcriptSection}

${newsSection}

請對 ${symbol} 產出以下四段式分析，一字不改地屬守輸出格式：

【公司現在在做什麼（白話）】
白話說明這家公司的策略方向和獲利模式。最後一句用「JG 認為這家公司值得追蹤，是因為⋯」作收。

【法說會方向】
最新一季管理層陳述的經營方向：包括財務結果、資本支出計畫、產品路線、下季指引。
必須引用具體數字和管理層原話。

【最近官方動態】
根據法說會方向，查找最近 30 天新聞中與法說會相關的具體發展或變化。
必須引用具體新聞標題和發佈日期作為依據。

【影子JG總結】
有立場地給出以下四點：
- 目前狀況：整體評語，像一個老手在說他的觀察
- ✅ 對得上：法說會哪些方向正在往對的方向前進
- ⚠️ 尚待觀察：法說會哪些方向新聞尚未確認（最後加「上面這些如果戰友有看到相關消息，記得告訴JG！」）
- 🔴 警訊：有沒有新聞與法說會矛盾（如無則寫「目前沒有看到明顯矛盾的報導」）
- 整體方向判斷：30 天新聞下來，公司在法說會描述的那條戰略路上是加速、減緩、中性偏加速、中性偏減緩，還是有轉向跡象？說明判斷依據和目前最關鍵的一個觀察點。
不要下交易建議。`;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text: string): { title: string; body: string } {
  const titleMatch = text.match(/標題[：:]\s*(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : `${new Date().getFullYear()} Q 點評`;

  const sepIdx = text.indexOf('---');
  const body = sepIdx >= 0 ? text.slice(sepIdx + 3).trim() : text.trim();

  // Ensure the three sections are present in body
  // If AI returned without ---，try to extract from full text
  if (!body && text) {
    return { title, body: text.trim() };
  }

  return { title, body };
}
