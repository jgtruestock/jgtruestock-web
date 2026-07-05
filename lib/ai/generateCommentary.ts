/**
 * PR 6 — AI 點評生成函式
 * 使用 Gemini 2.0 Flash，以 JG 口吻生成繁體中文投資點評
 */
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import type { EarningsTranscript, StockNewsArticle } from '@/lib/fmp';

const MODEL_NAME = 'gemini-2.0-flash';

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
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    symbol,
    transcript,
    news,
    mentionDate,
    mentionClose,
    latestClose
  );

  const result = await model.generateContent([
    { text: systemPrompt + '\n\n' + userPrompt },
  ]);

  const text = result.response.text() ?? '';
  const parsed = parseResponse(text);

  return { ...parsed, model: MODEL_NAME };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────
// TODO(Hopper): 補上正式的 system prompt 和 user prompt 設計

function buildSystemPrompt(): string {
  // PLACEHOLDER — 等 Hopper 確認 JG 風格後補上
  return 'You are a stock investment analyst. Write concise commentary in Traditional Chinese.';
}

function buildUserPrompt(
  symbol: string,
  transcript: EarningsTranscript | null,
  news: StockNewsArticle[],
  mentionDate: string,
  mentionClose: number,
  latestClose: number
): string {
  // PLACEHOLDER — 等 Hopper 確認格式後補上完整 prompt
  const priceDiffPct = mentionClose > 0
    ? (((latestClose - mentionClose) / mentionClose) * 100).toFixed(1)
    : 'N/A';

  const transcriptSnippet = transcript
    ? `${transcript.year} Q${transcript.quarter} transcript available (${transcript.date}).`
    : 'No earnings transcript available.';

  const newsHeadlines = news
    .slice(0, 10)
    .map((n, i) => `${i + 1}. ${n.title} (${n.site}, ${n.publishedDate?.slice(0, 10)})`)
    .join('\n');

  return `[PLACEHOLDER PROMPT]\nSymbol: ${symbol}\nMention date: ${mentionDate} @ $${mentionClose}, now $${latestClose} (${priceDiffPct}%)\n${transcriptSnippet}\nRecent news:\n${newsHeadlines || 'none'}\n\nReply format:\n標題：（title）\n---\n（body in Traditional Chinese, 200-400 chars）`;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text: string): { title: string; body: string } {
  // Match "標題：XXX"
  const titleMatch = text.match(/標題[：:]\s*(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : `點評`;

  // Everything after the first "---"
  const sepIdx = text.indexOf('---');
  const body = sepIdx >= 0 ? text.slice(sepIdx + 3).trim() : text.trim();

  return { title, body };
}
