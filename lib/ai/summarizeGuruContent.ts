import Anthropic from '@anthropic-ai/sdk';

export interface GuruSummary {
  summary: string;
  mentionedTickers: string[];
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function summarizeGuruContent(
  title: string,
  transcript: string
): Promise<GuruSummary> {
  // Limit transcript to 30000 chars
  const truncatedTranscript = transcript.slice(0, 30000);

  const prompt = `以下是一段 YouTube 影片的標題和逐字稿。請提供：

1. **中文摘要**（200-400字）：重點整理影片的核心觀點，特別關注：
   - 具體的股票、產業、公司觀點
   - 投資邏輯和市場判斷
   - 重要的數據或預測

2. **提到的股票代碼**：列出影片中提到的股票 ticker（如 NVDA、AAPL、TSM 等），用 JSON array 格式

影片標題：${title}

逐字稿：
${truncatedTranscript}

請以 JSON 格式回應：
{
  "summary": "中文摘要內容",
  "mentionedTickers": ["AAPL", "NVDA"]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: '你是 JG 的研究助理，幫忙整理大神觀點，繁體中文，重視股票和產業洞見。只回傳 JSON，不要其他文字。',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Extract JSON from response
  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    summary: parsed.summary || '',
    mentionedTickers: Array.isArray(parsed.mentionedTickers) ? parsed.mentionedTickers : [],
  };
}
