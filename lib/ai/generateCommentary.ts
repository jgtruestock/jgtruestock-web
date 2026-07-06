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
    max_tokens: 1500,
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
  return `你是財經新聞分析師，職責是從法說會逐字稿中客觀整理重要資訊。
用繁體中文，風格如財經新聞報導，不加入個人意見或預測。
只陳述事實：公司說了什麼、數字是多少、管理層如何回應質疑。

輸出格式（必須嚴格遵守）：
標題：（一句話點出這次法說會最重要的數據或發展）
---
（正文，400-600 字，繁體中文，客觀財經新聞風格）`;
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

分析 ${symbol} 最新法說會，從以下 8 個維度提取具體內容：
1. 財務結果（營收/利潤/毛利率 vs 預期，具體數字）
2. 資本支出（金額、方向、管理層原話）
3. 產品與業務方向（時間點、具體計劃）
4. 客戶結構（數字、大客戶動態）
5. 政府/監管（有無政策影響）
6. 財務指引（下季/全年數字，上修/下修）
7. 管理層風險自述（他們說了什麼）
8. 分析師質疑 + 管理層回應

資本支出和指引佔最多篇幅，必須有管理層原話引用。整合成有觀點的段落敘述，不要分點列號。`;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text: string): { title: string; body: string } {
  const titleMatch = text.match(/標題[：:]\s*(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : `${new Date().getFullYear()} Q 點評`;

  const sepIdx = text.indexOf('---');
  const body = sepIdx >= 0 ? text.slice(sepIdx + 3).trim() : text.trim();

  return { title, body };
}
