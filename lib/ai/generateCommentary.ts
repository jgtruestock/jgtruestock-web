/**
 * PR 1 — AI 點評生成函式
 * 使用 Anthropic Claude，客觀財經新聞風格，繁體中文
 */
import Anthropic from '@anthropic-ai/sdk';
import type { EarningsTranscript, StockNewsArticle } from '@/lib/fmp';

const MODEL = 'claude-sonnet-4-5';

export interface GenerateCommentaryResult {
  title: string;
  body: string;
  model: string;
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

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(symbol, transcript, news, mentionDate, mentionClose, latestClose);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseResponse(text);

  return { ...parsed, model: MODEL };
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
