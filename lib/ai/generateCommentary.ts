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
  earningsDirectionBody: string;  // 兩段式：Block A（公司介紹+法說會+新語）
  shadowJGSummaryBody: string;    // 兩段式：Block B（影子JG總結）
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

  // ── Split body into Block A + Block B ────────────────────────────────────
  const { earningsDirectionBody, shadowJGSummaryBody } = splitBody(parsed.body);

  return { ...parsed, model: MODEL, keyPoints, earningsDirectionBody, shadowJGSummaryBody };
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

function splitBody(body: string): { earningsDirectionBody: string; shadowJGSummaryBody: string } {
  const marker = '【影子JG總結】';
  const idx = body.indexOf(marker);
  if (idx === -1) {
    return { earningsDirectionBody: body, shadowJGSummaryBody: '' };
  }
  return {
    earningsDirectionBody: body.slice(0, idx).trim(),
    shadowJGSummaryBody: (marker + body.slice(idx + marker.length)).trim(),
  };
}

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
  return `你是財務分析師兼「影子JG」，負責把法說會內容和最近新聞整理成投資人看得懂的報告。

寫作規定（必須遵守）：
- 繁體中文，文字流暢自然，像人在說話
- 絕對禁止使用任何 markdown 符號：不能有 ##、###、**、---、*、_、> 這些符號
- 段落標題只能用【】括號，例如【法說會方向】
- 引用管理層原話時用「」引號
- 具體，引用數字、產品名、人名，不要說「公司正在擴展業務」這種廢話
- 不要下「買進」「賣出」等交易建議
- 沒有資料就直接說沒有，不要硬湊

輸出格式（嚴格遵守，不得更改段落名稱）：

標題：（一句話總結這次觀察的核心，像老手在說他看到什麼）

【法說會方向】
（詳細整理法說會內容，按以下結構分段，每段換行，不要用項目符號或數字列表）

公司整體方向：說明這季管理層強調的核心策略轉變或定位，2-3句

各部門業績：每個業務部門各寫一段，列出具體數字（年增率、絕對金額），引用管理層原話

下季指引：具體數字，引用管理層的說法

重大計畫與時程：產品路線、資本支出、合作案，每項列出預計時程

管理層風險提示：管理層自己說的風險，引用具體說法

競爭定位：管理層如何回應競爭對手，引用具體說法

【30天新聞比對】
（根據提供的新聞列表進行比對）
（如果有新聞：引用具體新聞標題和日期，說明與法說會方向的關係）
（如果沒有白名單新聞或新聞資料空窗：直接說「近30天內未見來自白名單來源的相關報導」，並說明這對投資人的意義——投資人目前只能依賴公司單方面陳述，無法透過第三方報導交叉驗證）

【官方申報】
（說明近期是否有8-K申報或新聞稿）
（如果有：列出申報日期和主要內容）
（如果沒有：寫「近期無8-K申報或Press Release」，並說明這意味著法說會提到的重大事項目前停留在口頭承諾階段）

【影子JG總結】
目前狀況：（有立場的整體評語，1-2句，像老手在說他的真實判斷）

對得上：（每項一行，以✅開頭，具體說哪件事正在往法說會說的方向走）
尚待觀察：（每項一行，以⚠️開頭，法說會哪些承諾新聞尚未確認，最後一行加「上面這些如果戰友有看到相關消息，記得告訴JG！」）
警訊：（每項一行，以🔴開頭，有沒有新聞與法說會矛盾；如無則寫「🔴 目前沒有看到明顯矛盾的報導」）
整體方向判斷：先給結論（加速、減緩、中性偏加速、中性偏減緩、有轉向跡象），再分「加速的部分：」和「有警示燈的部分：」（如有），最後一句「結論：」收尾`;
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

請對 ${symbol} 產出完整分析，嚴格按照 system prompt 規定的格式輸出。

重要提醒：
1. 絕對禁止使用 ##、###、**、---、*、_ 這些 markdown 符號，違反就是錯誤
2. 【法說會方向】要詳細，每個部門各寫一段，引用具體數字和管理層原話，沒有字數上限
3. 【30天新聞比對】：如果提供的新聞列表為空或來源不在白名單，直接說沒有，並解釋資訊空窗的意義
4. 【官方申報】：沒有申報就說沒有，不要略過這段
5. 【影子JG總結】是你作為影子JG的立場判斷，要有觀點，不要裝中立
不要下交易建議。`;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text: string): { title: string; body: string } {
  const titleMatch = text.match(/標題[：:]\s*(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : `${new Date().getFullYear()} Q 點評`;

  // Body = everything after the title line
  const titleLineEnd = titleMatch
    ? text.indexOf(titleMatch[0]) + titleMatch[0].length
    : 0;
  const body = text.slice(titleLineEnd).trim();

  return { title: title || `${new Date().getFullYear()} Q 點評`, body: body || text.trim() };
}
