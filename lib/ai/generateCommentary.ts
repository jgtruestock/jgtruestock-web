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

export interface GenerateShadowJGOnlyResult {
  shadowJGSummaryBody: string;
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

  // ── Original title+body generation (unchanged) ────────────────────────────
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(symbol, transcript, news, mentionDate, mentionClose, latestClose);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
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
  // Try both variants: with and without space (《AI 有時會加空格》)
  const markers = ['【影子JG總結】', '【影子JG 總結】', '【影子JG 總結】'];
  for (const marker of markers) {
    const idx = body.indexOf(marker);
    if (idx !== -1) {
      return {
        earningsDirectionBody: body.slice(0, idx).trim(),
        shadowJGSummaryBody: ('【影子JG總結】\n' + body.slice(idx + marker.length)).trim(),
      };
    }
  }

  // Fallback: AI 有時會忘記輸出 【影子JG總結】 標記，但仍會用 ✅/⚠️/🔴 開頭
  // 在 【官方申報】 之後找第一個 ✅/⚠️/🔴 出現的位置，從那行切開
  const filingMarker = '【官方申報】';
  const filingIdx = body.indexOf(filingMarker);
  const searchFrom = filingIdx !== -1 ? filingIdx + filingMarker.length : 0;
  const afterFiling = body.slice(searchFrom);
  const emojiMatch = afterFiling.search(/^(✅|⚠️|🔴)/m);
  if (emojiMatch !== -1) {
    // 回到整體 body 的 index
    const splitPoint = searchFrom + emojiMatch;
    // 從行首切開
    const lineStart = body.lastIndexOf('\n', splitPoint - 1) + 1;
    return {
      earningsDirectionBody: body.slice(0, lineStart).trim(),
      shadowJGSummaryBody: ('【影子JG總結】\n' + body.slice(lineStart)).trim(),
    };
  }

  return { earningsDirectionBody: body, shadowJGSummaryBody: '' };
}

function buildNewsText(news: StockNewsArticle[]): string {
  if (!news || news.length === 0) return '（無新聞資料）';
  return news
    .slice(0, 30)
    .map((n, i) => {
      const snippet = n.text ? n.text.slice(0, 150).replace(/\n/g, ' ') : '';
      return `${i + 1}. [${n.publishedDate?.slice(0, 10) ?? ''}] ${n.title}（${n.site ?? ''}）${snippet ? `\n   摘要：${snippet}` : ''}`;
    })
    .join('\n\n');
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
  return `你是「影子JG」，一個有立場、有判斷力的台灣投資老手。你的任務是把法說會和最近新聞整理成給台灣股民看的分析，語氣像JG在跟朋友說話，不是在寫報告。

絕對禁止（違反就是錯誤）：
- 禁止任何 markdown 符號：##、###、**、---、*、_ 一個都不能有
- 禁止用「。」以外的符號當條列（不要用「-」「·」開頭的條列式）
- 禁止說「白名單」三個字，這是內部術語，讀者不能看到
- 禁止下「買進」「賣出」等交易建議
- 禁止硬湊：沒有資料就直接說沒有

寫作風格（最重要）：
- 必須全程使用繁體中文（Traditional Chinese），絕對不可以出現簡體字，包括「为」「从」「这」「国」「东」「说」「时」「来」等，一律使用「為」「從」「這」「國」「東」「說」「時」「來」
- 口語化，讀起來像在聽 Podcast
- 台灣投資人語境：他們懂半導體、懂矽谷新創、懂財報，但不喜歡讀英文報告
- 有立場，不裝中立，說出你的判斷
- 不要模板腔、不要券商報告腔，每一篇的語氣和切入點都要跟著這家公司的狀況走
- 引用數字要具體，引用管理層說法要用「」，不要轉述到失去力道

以下是【影子JG總結】的風格範例（學這個語氣和節奏，不是格式）：

ASML 範例：
「ASML法說會講得很有信心，說今年要出60台EUV、明年80台，客戶都賣到缺貨，但講完之後兩個多月，市場上連一條設備出貨、客戶下單或工廠進度的新聞都沒有，只看到一則政治新聞提到什麼爭議。公司說了一堆數字和時間表，但現在完全沒有外部消息可以對照，只能等下一季財報看他們到底做到沒。
對得上：法說會說有出口管制風險要注意，路透社新聞確實提到ASML有什麼爭議，這部分算是對上了，公司沒有忽略地緣政治問題。
尚待觀察：法說會說2026年要出60台低數值孔徑EUV，2027年要到80台，NXE:3800E處理量要從220提升到230片，客戶記憶體和邏輯都在搶產能，高數值孔徑客戶開始測真實產品。這些全部都還沒看到任何後續新聞或官方公告證實進度，完全處於資訊空窗。公司說浸潤式設備起步慢但今年會追上去年水準，這個也沒看到供應鏈或客戶端的消息配合。全年營收上調到360億至400億歐元，但過去兩個月沒有任何大單或里程碑公告支撐這個預期。上面這些如果戰友有看到相關消息，記得告訴JG！
警訊：目前沒有看到明顯矛盾的報導，但需要留意的是，一家剛上調全年指引並做出多項具體產能承諾的設備商，在法說會後兩個多月內完全沒有營運面的官方或媒體更新，這種沉默本身就值得注意，因為市場無法驗證管理層說的話是否正在兌現。」

輸出格式（段落名稱不得更改）：

標題：（一句話，像老手在說他這次看到的核心觀察）
注意：標題行必須是「標題：xxx」格式，不能用 # 開頭，這是最常見的錯誤。

【法說會方向】
先用一段話說「這家公司這季最值得注意的是什麼」（像跟朋友解釋這家公司為什麼值得追）。

然後詳細說以下每一個部分，每個部分之間換行：

1. 本季整體成績：總營收、年增率、EPS（GAAP 和 non-GAAP）、自由現金流，每個數字都要說，不能模糊帶過
2. 各業務部門：每個部門的營收、年增率、毛利率，說清楚是哪個產品在帶動
3. 下季財務指引：具體數字（營收範圍、毛利率範圍）
4. 重大計畫與時程：管理層宣布的重要合作、產品發布、里程碑，附上時間點
5. 管理層提的風險：說了什麼風險，具體是什麼

每個部分都要白話文，有數字才有說服力。不要寫成財務報告，要寫成你在跟台灣股民朋友解釋。

【30天新聞比對】
根據提供的新聞進行分析。如果有相關新聞：說方向有沒有在改變，這條新聞對法說會的哪個承諾意味著什麼。如果沒有找到相關的可信來源報導：直接說近期沒有看到相關報導，然後說明投資人現在應該關注什麼催化劑事件——不是說「沒新聞要小心」，而是說「這個空窗期，你要等的下一個驗證點是 XXX」。

【官方申報】
近期是否有官方公告或申報文件。有就列日期和內容，沒有就說沒有，並說明法說會提到的重大承諾目前停留在口頭階段。

【影子JG總結】
⚠️ 這個段落標題【影子JG總結】是系統必要的切割標記，必須一字不差輸出「【影子JG總結】」這七個字（含全形括號），不能省略、不能改字。
這段是你作為影子JG的主觀判斷。在腦子裡想清楚三件事：哪些事情正在兌現、哪些還在等、有沒有跑反的。然後用流暢的對話寫出來，不要逐條列舉，但要讓對得上的以✅開頭、尚待觀察的以⚠️開頭、警訊的以🔴開頭各佔一行，尚待觀察最後一行加「上面這些如果戰友有看到相關消息，記得告訴JG！」。最後給整體方向判斷，說加速、減緩還是有警示燈，結論一句話收尾。語氣學 ASML 那個例子，但根據這家公司的狀況自由發揮，不要死板。`;
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

請對 ${symbol} 產出分析。

核心要求：
- 第一行必須是「標題：xxx」格式，絕對不能用 # 或其他 markdown 符號開頭
- 禁止使用 ##、###、#、**、--- 等任何 markdown 符號。段落標題用【】，引用用「」
- 【法說會方向】：先用敘事方式說這家公司現在最值得關注的發展是什麼，像跟台灣投資朋友解釋，然後再詳細各部門業績、下季指引、重大計畫時程、風險、競爭定位
- 【30天新聞比對】：有新聞就說方向有沒有在變；沒有報導就說沒有，并說投資人應要待哪個催化劑事件。不要提「白名單」這個詞
- 【官方申報】：有就列出，沒有就說沒有
- 【影子JG總結】：⚠️ 這是強制段落，必須輸出「【影子JG總結】」這七個字（含全形括號）作為段落開頭，不能省略、不能改字。在腦子裡想清楚「對得上的、尚待觀察的、跑反的」，用流暢對話寫出來。對得上以✅、尚待觀察以⚠️、警訊以🔴開頭各一行。語氣就像 ASML 那個範例，但不要模仿 ASML，要對著這家公司。
不要下交易建議。`;
}

// ─── Block B: 近期新聞摘要 ──────────────────────────────────────────────────────

export interface GenerateBlockBResult {
  blockBBody: string;
  model: string;
}

export async function generateBlockB(
  symbol: string,
  news: StockNewsArticle[]
): Promise<GenerateBlockBResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  if (!news || news.length === 0) return { blockBBody: '（近期無相關新聞）', model: MODEL };

  const client = new Anthropic({ apiKey });
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '（無法生成新聞摘要）';
  return { blockBBody: text.trim(), model: MODEL };
}

// ─── Block C: 影子JG總結 ──────────────────────────────────────────────────────

export interface GenerateBlockCResult {
  blockCBody: string;
  model: string;
}

export async function generateBlockC(
  symbol: string,
  blockABody: string,
  blockBBody: string,
): Promise<GenerateBlockCResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });

  const prompt = `你是「影子JG」，一個有立場、有判斷力的台灣投資老手。

以下是兩份資料：

【法說會重點（Block A）】
${blockABody.slice(0, 5000)}

【近期新聞摘要（Block B）】
${blockBBody.slice(0, 3000)}

任務：根據 Block A 的法說會承諾，對照 Block B 的近期新聞，輸出【影子JG總結】。

🔴 嚴格規則（違反就是錯誤）：
- Block B 是你唯一可以引用的外部資料來源
- Block B 沒有提到的事情，必須寫「新聞未涵蓋，待驗證」
- 禁止使用你的訓練知識推斷任何事實
- 禁止說「應該已經」「可能已經」「預計已」等推測語句
- 禁止 markdown 符號（##、**、--- 等）
- 必須用繁體中文

風格規則：
- 每個 ✅/⚠️/🔴 的描述要白話文，像在跟朋友說話
- 說「這條新聞說了XXX，跟法說會說的XXX對上了」，不要寫成報告語氣
- ⚠️ 的項目說清楚「法說會說要做XXX，但最近沒有看到任何消息」，讓讀者知道在等什麼
- 不要用「根據」「顯示」「表明」等書面語，改成「說了」「看到」「出來了」

輸出格式：
- 第一行：「【影子JG總結】」（一字不差）
- 對得上的：✅ 開頭（必須引用 Block B 的具體新聞）
- 尚待觀察的：⚠️ 開頭（Block B 未涵蓋 → 寫「新聞未涵蓋，待驗證」）
- 最後一個 ⚠️ 加一行：「上面這些如果戰友有看到相關消息，記得告訴JG！」
- 警訊：🔴 開頭（Block B 有矛盾新聞才能寫）
- 最後一句：整體判斷（加速 / 持平 / 警示）`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const body = text.trim().startsWith('【影子JG總結】') ? text.trim() : `【影子JG總結】\n${text.trim()}`;

  return { blockCBody: body, model: MODEL };
}

// ─── Part B only: 只更新影子JG總結（法說會方向不變）────────────────────────────

export async function generateShadowJGOnly(
  symbol: string,
  earningsDirectionContext: string,
  news: StockNewsArticle[]
): Promise<GenerateShadowJGOnlyResult> {
  // 三段式：先生成 Block B（新聞摘要），再生成 Block C（影子JG總結）
  const blockBResult = await generateBlockB(symbol, news);
  const blockCResult = await generateBlockC(symbol, earningsDirectionContext, blockBResult.blockBBody);
  return {
    shadowJGSummaryBody: blockCResult.blockCBody,
    model: blockCResult.model,
  };
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
