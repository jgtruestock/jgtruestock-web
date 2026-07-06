# SPEC-PROMISE-TRACKER.md

> **JGTrueStock 新功能規格書**
> 最後更新：2026-07-05
> 作者：吉利 🏮

---

## 目錄

- [Part 1 — 管理層承諾比對](#part-1--管理層承諾比對-management-promise-tracker)
- [Part 2 — 大神追蹤](#part-2--大神追蹤-guru-tracker)
- [附錄 A — 共用基礎設施](#附錄-a--共用基礎設施)

---

# Part 1 — 管理層承諾比對 (Management Promise Tracker)

## 1.1 功能概述

追蹤上市公司管理層在法說會中做出的承諾（營收目標、產品時程、資本支出計畫等），並在後續季度自動比對實際結果，產出「說到做到」評分。

**核心價值**：讓 JG 的付費會員一眼看出哪些公司管理層可信、哪些在畫大餅。

### 使用者故事

1. **JG（Admin）** 在後台觸發某檔股票的承諾提取 → AI 從法說會逐字稿中自動抽出承諾
2. **JG** 審核 AI 抽出的承諾，可以編輯、刪除、手動新增
3. **系統（Cron）** 每季法說會後自動比對舊承諾 vs 新財報結果
4. **會員（前台）** 在個股頁看到「管理層信用分數」和承諾歷史

---

## 1.2 資料模型

### Database: `jgtruestock`

#### Collection: `mgmt_promises`

存放從法說會中提取的個別承諾。

```typescript
// types/promise-tracker.ts

import { ObjectId } from 'mongodb';

export type PromiseCategory =
  | 'revenue'          // 營收目標
  | 'margin'           // 毛利率/淨利率目標
  | 'capex'            // 資本支出計畫
  | 'product'          // 產品/技術里程碑
  | 'headcount'        // 人力/組織計畫
  | 'guidance'         // 財務指引
  | 'market_expansion' // 市場拓展
  | 'other';

export type PromiseStatus =
  | 'pending'      // 尚未到期
  | 'fulfilled'    // 已兌現
  | 'partially'    // 部分兌現
  | 'broken'       // 未兌現
  | 'unclear';     // 無法判定

export interface MgmtPromise {
  _id: ObjectId;
  symbol: string;                // e.g. "NVDA" — indexed

  // 承諾內容
  promiseText: string;           // 原文摘錄（英文）
  promiseSummary: string;        // AI 濃縮的一句話中文摘要
  category: PromiseCategory;
  
  // 來源
  sourceType: 'earnings_call' | 'sec_filing' | 'press_release' | 'manual';
  sourceQuarter: string;         // e.g. "2025-Q4"
  sourceDate: string;            // ISO 8601
  sourceExcerpt: string;         // 原文上下文（±200 字）

  // 承諾時間框架
  targetQuarter: string | null;  // 預計兌現季度，e.g. "2026-Q2"
  targetDate: string | null;     // 更精確的日期（如有）
  isOpenEnded: boolean;          // 沒有明確時間框架

  // 比對結果
  status: PromiseStatus;
  verificationNote: string | null;     // AI 或人工的比對說明
  verificationSource: string | null;   // 比對依據來源
  verifiedAt: Date | null;
  verifiedBy: 'ai' | 'admin' | null;

  // 管理
  isApproved: boolean;           // JG 是否已審核通過
  isHidden: boolean;             // 隱藏（不在前台顯示）
  adminNote: string | null;      // JG 的備註

  // 元資料
  extractedBy: string;           // model name, e.g. "gemini-2.0-flash"
  createdAt: Date;
  updatedAt: Date;
}
```

**索引設計**：
```
{ symbol: 1, sourceQuarter: -1 }       // 主查詢：某股票的所有承諾
{ symbol: 1, status: 1 }              // 篩選：某股票的待驗證承諾
{ status: 1, targetQuarter: 1 }       // Cron：找出本季到期的承諾
{ symbol: 1, isApproved: 1 }          // 前台：只顯示已審核的
```

#### Collection: `mgmt_promise_scores`

每檔股票的聚合「信用分數」快照。

```typescript
export interface MgmtPromiseScore {
  _id: ObjectId;
  symbol: string;                // unique index

  // 聚合分數
  totalPromises: number;
  fulfilledCount: number;
  partiallyCount: number;
  brokenCount: number;
  pendingCount: number;
  unclearCount: number;

  // 信用分數：0-100
  // 計算公式：(fulfilled*1.0 + partially*0.5) / (fulfilled + partially + broken) * 100
  // pending 和 unclear 不計入
  credibilityScore: number | null;  // null = 樣本不足（已結案 < 3）

  // 趨勢
  scoreHistory: Array<{
    quarter: string;              // e.g. "2026-Q2"
    score: number;
    calculatedAt: string;         // ISO 8601
  }>;

  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 1.3 AI 承諾提取

### 提取 Prompt 設計

使用現有的 Gemini 2.0 Flash（同 `generateCommentary.ts` 的 provider）。

```typescript
// lib/ai/extractPromises.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedPromise {
  promiseText: string;
  promiseSummary: string;
  category: PromiseCategory;
  sourceExcerpt: string;
  targetQuarter: string | null;
  targetDate: string | null;
  isOpenEnded: boolean;
  confidence: number;            // 0-1, AI 自評信心度
}

export async function extractPromises(
  symbol: string,
  transcriptContent: string,
  quarter: string,
  date: string
): Promise<ExtractedPromise[]> { ... }
```

**System Prompt 核心邏輯**：

```
你是一位專業的財務分析師，正在閱讀法說會逐字稿。
你的任務是提取管理層做出的「可驗證承諾」。

什麼算承諾：
- 具體的數字目標（營收、毛利率、EPS）
- 產品發佈時程（「Q3 推出新產品」）
- 資本支出計畫（「明年 capex $X billion」）
- 市場拓展承諾（「年底前進入 X 市場」）
- 人力計畫（「年底增聘 X 人」）

什麼不算承諾：
- 模糊的願景（「我們對未來很樂觀」）
- 過去的陳述（「上季我們做到了...」）
- 分析師的預測或觀點
- 免責聲明

輸出格式：JSON array，每個元素包含：
- promiseText: 原文逐字引用（英文）
- promiseSummary: 一句話中文摘要
- category: revenue | margin | capex | product | headcount | guidance | market_expansion | other
- sourceExcerpt: 原文前後 ±200 字上下文
- targetQuarter: 預計兌現季度（如 "2026-Q2"），無法判斷則 null
- targetDate: 更精確日期（如有），否則 null
- isOpenEnded: 沒有明確時間框架則 true
- confidence: 0-1 信心度
```

### 承諾比對 Prompt 設計

```typescript
// lib/ai/verifyPromises.ts

export interface VerificationResult {
  promiseId: string;
  status: PromiseStatus;
  verificationNote: string;      // 中文說明
  verificationSource: string;    // 依據來源描述
  confidence: number;
}

export async function verifyPromises(
  symbol: string,
  promises: MgmtPromise[],
  latestTranscript: string,
  recentNews: StockNewsArticle[]
): Promise<VerificationResult[]> { ... }
```

**System Prompt 核心邏輯**：

```
你正在比對管理層過去的承諾與最新的實際結果。

判定標準：
- fulfilled: 完全或超額達成（±5% 容差）
- partially: 部分達成（達成 50-95%）或延遲但仍在進行
- broken: 明確未達成、被取消、或大幅落後
- unclear: 新資料不足以判定

每個判定必須附上具體依據（引用數字或事實），不可猜測。
```

---

## 1.4 API Routes

### `GET /api/admin/promises`

列出所有承諾（後台管理用）。

| Param | Type | Default | 說明 |
|-------|------|---------|------|
| `symbol` | query string | — | 篩選特定股票 |
| `status` | query string | — | 篩選狀態：pending/fulfilled/partially/broken/unclear |
| `approved` | query string | — | `true`/`false` 篩選審核狀態 |

**Response**:
```json
{
  "promises": [ MgmtPromise[] ],
  "stats": {
    "total": 42,
    "pending": 15,
    "fulfilled": 18,
    "broken": 5,
    "partially": 3,
    "unclear": 1,
    "unapproved": 8
  }
}
```

**Auth**: Admin only（同現有 `isAdmin()` 檢查）。

---

### `POST /api/admin/promises/extract`

觸發 AI 提取某股票的承諾。

| Body Field | Type | Required | 說明 |
|------------|------|----------|------|
| `symbol` | string | ✅ | 股票代號 |
| `quarter` | string | — | 指定季度，預設自動偵測最新 |

**流程**：
1. 從 `jg_stock_filings` 取得法說會逐字稿（或呼叫 `fetchEarningsTranscript`）
2. 呼叫 `extractPromises()` AI 函式
3. 將結果寫入 `mgmt_promises`（`isApproved: false`）
4. 回傳提取數量

**Response**:
```json
{
  "success": true,
  "symbol": "NVDA",
  "quarter": "2026-Q1",
  "extractedCount": 7,
  "promises": [ ExtractedPromise[] ]
}
```

---

### `PATCH /api/admin/promises/[id]`

編輯單筆承諾（審核、修改、標記狀態）。

| Body Field | Type | 說明 |
|------------|------|------|
| `promiseSummary` | string | 修改中文摘要 |
| `category` | string | 修改分類 |
| `status` | string | 手動設定狀態 |
| `isApproved` | boolean | 審核通過 |
| `isHidden` | boolean | 隱藏 |
| `adminNote` | string | JG 備註 |
| `verificationNote` | string | 手動比對說明 |

---

### `DELETE /api/admin/promises/[id]`

刪除單筆承諾。

---

### `POST /api/admin/promises/verify`

手動觸發承諾比對。

| Body Field | Type | Required | 說明 |
|------------|------|----------|------|
| `symbol` | string | ✅ | 股票代號 |

**流程**：
1. 找出該股票所有 `status: 'pending'` 且 `targetQuarter <= currentQuarter` 的承諾
2. 取得最新法說會逐字稿 + 近期新聞
3. 呼叫 `verifyPromises()` AI 函式
4. 更新 `mgmt_promises` 各筆狀態
5. 重新計算 `mgmt_promise_scores`

---

### `GET /api/stocks/[symbol]/promises`

前台用：取得某股票的已審核承諾和信用分數。

**Response**:
```json
{
  "symbol": "NVDA",
  "credibilityScore": 82,
  "totalResolved": 15,
  "promises": [
    {
      "promiseSummary": "2026 年 Q2 資料中心營收將達 $XX billion",
      "category": "revenue",
      "sourceQuarter": "2025-Q4",
      "status": "fulfilled",
      "verificationNote": "實際營收 $XX.X billion，超標 3%"
    }
  ],
  "scoreHistory": [
    { "quarter": "2025-Q3", "score": 78 },
    { "quarter": "2026-Q1", "score": 82 }
  ]
}
```

**Auth**: 公開（或未來接會員驗證）。

---

## 1.5 Cron Job

### `/api/cron/verify-promises`

| 欄位 | 值 |
|------|-----|
| Schedule | `0 6 * * 1` (每週一 UTC 06:00 = 台灣 14:00) |
| Auth | `Bearer CRON_SECRET` |

**流程**：
1. 查詢 `mgmt_promises` 中 `status: 'pending'` 且 `targetQuarter <= currentQuarter`
2. 按 symbol 分組
3. 逐股票呼叫 `verifyPromises()`（batch 3 檔，間隔 1 秒）
4. 更新承諾狀態 + 重算信用分數
5. 回傳報告

**vercel.json 新增**：
```json
{
  "path": "/api/cron/verify-promises",
  "schedule": "0 6 * * 1"
}
```

---

## 1.6 後台 UI：`/admin/promises`

### 頁面結構

```
┌─────────────────────────────────────────────────┐
│ Navbar                                          │
├─────────────────────────────────────────────────┤
│ 管理層承諾追蹤                                    │
│                                                 │
│ [全部 42] [待驗證 15] [已兌現 18] [未兌現 5]       │
│ [待審核 8]                                       │
│                                                 │
│ 🔍 搜尋股票代號 [________] [提取承諾] [批次比對]    │
│                                                 │
│ ┌─ NVDA ── 信用分數：82 ──────────────────────┐ │
│ │ ✅ Q4 資料中心營收達 $35B      revenue  2025Q4│ │
│ │ ⏳ 2026 推出 Rubin 架構       product  2025Q4│ │
│ │ ❌ 毛利率維持 78%             margin   2025Q3│ │
│ │                          [審核] [編輯] [隱藏] │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ TSMC ── 信用分數：91 ──────────────────────┐ │
│ │ ...                                          │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 互動功能

- **提取承諾按鈕**：輸入股票代號 → POST `/api/admin/promises/extract`
- **批次比對按鈕**：一鍵觸發所有到期承諾的比對
- **單筆審核**：點擊 ✅ 切換 `isApproved`
- **單筆編輯**：點擊後展開 inline 編輯表單
- **狀態手動覆寫**：下拉選單切換 fulfilled/broken/partially

---

## 1.7 前台 UI：個股頁整合

在現有 `/stocks/[symbol]` 頁面新增「管理層信用」區塊：

```
┌─────────────────────────────────────┐
│ 管理層說到做到指數                     │
│                                     │
│ ███████████░░░ 82/100               │
│ 15 項承諾已結案 · 12 項兌現           │
│                                     │
│ 最近承諾：                            │
│ ✅ Q4 營收達標（$35.1B vs 目標 $35B） │
│ ⏳ Rubin 架構 Q3 量產（待驗證）        │
│ ❌ 毛利率未達 78%（實際 75.2%）       │
└─────────────────────────────────────┘
```

---

## 1.8 檔案清單（實作用）

| 檔案路徑 | 說明 |
|----------|------|
| `types/promise-tracker.ts` | TypeScript types |
| `lib/db/promises.ts` | DB CRUD helpers |
| `lib/ai/extractPromises.ts` | AI 承諾提取 |
| `lib/ai/verifyPromises.ts` | AI 承諾比對 |
| `app/api/admin/promises/route.ts` | GET 列表 |
| `app/api/admin/promises/extract/route.ts` | POST 提取 |
| `app/api/admin/promises/[id]/route.ts` | PATCH / DELETE 單筆 |
| `app/api/admin/promises/verify/route.ts` | POST 手動比對 |
| `app/api/cron/verify-promises/route.ts` | Cron 自動比對 |
| `app/api/stocks/[symbol]/promises/route.ts` | 前台 API |
| `app/admin/promises/page.tsx` | 後台管理頁 |

---

# Part 2 — 大神追蹤 (Guru Tracker)

## 2.1 功能概述

自動抓取 JG 關注的投資大神（YouTube、X/Twitter、Substack）最新內容，用 AI 生成中文摘要，讓 JG 在後台一站式瀏覽，不用每天翻 17 個來源。

### 現有基礎

- **DB**: `jgtruestock.guru_channels` collection 已存在，含 17 個來源（10 YouTube + 4 X + 3 Substack）
- **推測 schema**（需確認）：每筆含 `name`, `platform`, `url`/`channelId`, `active` 等欄位

### Phase 分期

| Phase | 範圍 | 原因 |
|-------|------|------|
| **Phase 1** | YouTube RSS 抓取 | RSS 免費、穩定、無 API key 限制 |
| **Phase 2** | X（用 xurl）+ Substack RSS | X 需要認證、rate limit 較嚴 |

---

## 2.2 資料模型

### Collection: `guru_channels`（已存在，補充預期 schema）

```typescript
// types/guru-tracker.ts

import { ObjectId } from 'mongodb';

export type GuroPlatform = 'youtube' | 'x' | 'substack';

export interface GuruChannel {
  _id: ObjectId;
  name: string;                    // 顯示名稱，e.g. "Warren Buffett"
  platform: GuroPlatform;
  
  // 平台識別
  channelId: string;               // YouTube channel ID / X handle / Substack subdomain
  url: string;                     // 頻道/帳號主頁 URL
  rssUrl: string | null;           // RSS feed URL（YouTube/Substack 有，X 無）

  // 狀態
  active: boolean;
  lastFetchedAt: Date | null;
  lastContentDate: Date | null;    // 最新一篇內容的日期
  contentCount: number;            // guru_content 中的總筆數

  // 元資料
  avatarUrl: string | null;
  description: string | null;
  tags: string[];                  // e.g. ["macro", "value", "tech"]

  createdAt: Date;
  updatedAt: Date;
}
```

### Collection: `guru_content`（新建）

存放每一篇抓到的內容（影片/推文/文章）。

```typescript
export type GuruContentType = 'video' | 'tweet' | 'article';

export type GuruContentStatus = 
  | 'fetched'        // 已抓取，尚未生成摘要
  | 'summarized'     // AI 摘要已生成
  | 'failed'         // 摘要生成失敗
  | 'hidden';        // JG 手動隱藏

export interface GuruContent {
  _id: ObjectId;
  channelId: ObjectId;             // ref → guru_channels._id
  channelName: string;             // 冗餘，方便查詢顯示
  platform: GuroPlatform;
  contentType: GuruContentType;

  // 內容基本資訊
  externalId: string;              // YouTube video ID / Tweet ID / Article URL slug
  title: string;                   // 影片標題 / 推文前 100 字 / 文章標題
  url: string;                     // 原始連結
  publishedAt: Date;               // 原始發佈時間
  
  // 原始內容（視平台不同）
  rawContent: string | null;       // 推文全文 / 文章全文（如可抓到）
  thumbnailUrl: string | null;     // 影片/文章封面圖
  duration: string | null;         // 影片長度 "12:34"（YouTube 限定）
  
  // YouTube 特有
  viewCount: number | null;
  likeCount: number | null;

  // AI 摘要
  summary: string | null;          // 中文摘要（200-400 字）
  summaryModel: string | null;     // e.g. "gemini-2.0-flash"
  summaryGeneratedAt: Date | null;
  
  // AI 提取的關聯股票
  mentionedSymbols: string[];      // e.g. ["NVDA", "TSMC"]

  // 管理
  status: GuruContentStatus;
  isStarred: boolean;              // JG 標記重要
  adminNote: string | null;

  // 元資料
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**索引設計**：
```
{ externalId: 1, platform: 1 }       // unique，防重複抓取
{ channelId: 1, publishedAt: -1 }    // 某大神的內容按時間排
{ platform: 1, publishedAt: -1 }     // 按平台瀏覽
{ publishedAt: -1 }                  // 全部內容時間排序
{ status: 1 }                        // 找未摘要的
{ mentionedSymbols: 1 }              // 按股票查相關大神內容
{ isStarred: 1, publishedAt: -1 }    // JG 收藏列表
```

---

## 2.3 YouTube RSS 抓取（Phase 1）

### RSS Feed 格式

YouTube 頻道 RSS URL 格式：
```
https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
```

回傳 Atom XML，每個 `<entry>` 包含：
- `<yt:videoId>` — 影片 ID
- `<title>` — 標題
- `<link href="...">` — 影片 URL
- `<published>` — 發佈時間（ISO 8601）
- `<media:group>` → `<media:thumbnail>` — 封面圖
- `<media:group>` → `<media:description>` — 影片描述

### 抓取邏輯

```typescript
// lib/guru/fetchYouTube.ts

import { parseStringPromise } from 'xml2js';  // 需新增 dependency

export interface YouTubeRSSEntry {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnailUrl: string;
  description: string;
}

export async function fetchYouTubeRSS(
  channelId: string
): Promise<YouTubeRSSEntry[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(feedUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`);
  
  const xml = await res.text();
  const parsed = await parseStringPromise(xml);
  const entries = parsed.feed?.entry || [];
  
  return entries.map((entry: any) => ({
    videoId: entry['yt:videoId']?.[0] || '',
    title: entry.title?.[0] || '',
    url: entry.link?.[0]?.$.href || '',
    publishedAt: entry.published?.[0] || '',
    thumbnailUrl: entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$.url || '',
    description: entry['media:group']?.[0]?.['media:description']?.[0] || '',
  }));
}
```

### 14 天過濾

只保留 `publishedAt` 在過去 14 天內的 entry。超過 14 天的不入庫（RSS 本身通常只回傳最近 15 筆，天然就是近期的）。

### 去重

寫入前用 `externalId + platform` 做 unique 查詢，已存在則 skip。

---

## 2.4 AI 摘要生成

### 摘要 Prompt

```typescript
// lib/ai/summarizeGuruContent.ts

export async function summarizeGuruContent(
  content: {
    title: string;
    description: string;        // YouTube description 或文章全文
    platform: string;
    authorName: string;
  }
): Promise<{
  summary: string;
  mentionedSymbols: string[];
}> { ... }
```

**System Prompt**：
```
你是 JG 的研究助手，正在幫 JG 快速掃描投資大神的最新內容。

任務：
1. 用繁體中文寫一段 200-400 字的摘要
2. 重點：這個人在講什麼觀點？對哪些股票/產業有看法？結論是什麼？
3. 如果內容提到具體股票，列出所有提到的股票代號（美股 ticker）
4. 不要加你自己的觀點，純粹整理他說了什麼

輸出格式：
{
  "summary": "...",
  "mentionedSymbols": ["NVDA", "TSMC"]
}
```

### 摘要時機

- **Phase 1 策略**：抓取後不立即摘要（description 太短可能品質差）
- 在 Cron 中抓完 RSS 後，對 `status: 'fetched'` 的新內容批次生成摘要
- 每次最多處理 10 筆（控制 Gemini API 用量）

---

## 2.5 API Routes

### `GET /api/admin/gurus`

列出所有大神頻道（後台管理列表用）。

**Response**:
```json
{
  "channels": [
    {
      "_id": "...",
      "name": "Stanley Druckenmiller Updates",
      "platform": "youtube",
      "url": "https://youtube.com/...",
      "active": true,
      "lastFetchedAt": "2026-07-05T06:00:00Z",
      "lastContentDate": "2026-07-03T14:30:00Z",
      "contentCount": 23,
      "tags": ["macro", "hedge_fund"]
    }
  ],
  "stats": {
    "total": 17,
    "youtube": 10,
    "x": 4,
    "substack": 3,
    "active": 15,
    "totalContent": 342
  }
}
```

**Auth**: Admin only。

---

### `GET /api/admin/gurus/[id]/content`

取得某大神的所有內容（分頁）。

| Param | Type | Default | 說明 |
|-------|------|---------|------|
| `page` | query number | 1 | 頁碼 |
| `limit` | query number | 20 | 每頁筆數 |
| `status` | query string | — | 篩選狀態 |

**Response**:
```json
{
  "channel": {
    "_id": "...",
    "name": "Stanley Druckenmiller Updates",
    "platform": "youtube"
  },
  "content": [
    {
      "_id": "...",
      "title": "Why I'm Buying NVDA Aggressively",
      "url": "https://youtube.com/watch?v=...",
      "publishedAt": "2026-07-03T14:30:00Z",
      "thumbnailUrl": "https://i.ytimg.com/...",
      "duration": "18:42",
      "summary": "Druckenmiller 認為 NVDA 目前估值合理...",
      "mentionedSymbols": ["NVDA", "AMD"],
      "status": "summarized",
      "isStarred": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 23,
    "totalPages": 2
  }
}
```

**Auth**: Admin only。

---

### `PATCH /api/admin/gurus/[id]/content/[contentId]`

編輯單筆內容（標星、隱藏、修改摘要）。

| Body Field | Type | 說明 |
|------------|------|------|
| `isStarred` | boolean | 切換收藏 |
| `status` | string | 手動設定狀態（hidden） |
| `summary` | string | 手動修改摘要 |
| `adminNote` | string | JG 備註 |

---

### `POST /api/admin/gurus/[id]/fetch`

手動觸發單一頻道的內容抓取。

---

## 2.6 Cron Job

### `/api/cron/update-guru-content`

| 欄位 | 值 |
|------|-----|
| Schedule | `0 22 * * *` (UTC 22:00 = 台灣 06:00) |
| Auth | `Bearer CRON_SECRET` |

**流程**：

```
Phase 1（YouTube only）:

1. 從 guru_channels 取出 active=true 且 platform="youtube" 的頻道
2. 逐頻道抓取 RSS（batch 3，間隔 500ms）
3. 過濾：只保留 publishedAt 在過去 14 天內的
4. 去重：externalId + platform 已存在則 skip
5. 新內容寫入 guru_content（status: 'fetched'）
6. 更新 guru_channels.lastFetchedAt / lastContentDate / contentCount
7. 對所有 status='fetched' 的內容批次生成 AI 摘要（最多 10 筆/次）
8. 回傳報告
```

**Phase 2 擴充（X + Substack）**：

```
X（使用 xurl）:
- xurl search --from={handle} --since=14d
- 解析推文內容 → 寫入 guru_content
- Rate limit: 逐帳號，間隔 2 秒

Substack:
- RSS feed: https://{subdomain}.substack.com/feed
- 解析方式同 YouTube RSS，但 entry 結構不同
- 文章全文可從 RSS <content:encoded> 取得
```

**vercel.json 新增**：
```json
{
  "path": "/api/cron/update-guru-content",
  "schedule": "0 22 * * *"
}
```

---

## 2.7 後台 UI：`/admin/gurus`

### 頁面結構：頻道列表

```
┌─────────────────────────────────────────────────────┐
│ Navbar                                              │
├─────────────────────────────────────────────────────┤
│ 大神追蹤                                             │
│                                                     │
│ [全部 17] [YouTube 10] [X 4] [Substack 3]           │
│                                                     │
│ ┌──────────────────────────────────────────────────┐│
│ │ 🎬 Stanley Druckenmiller Updates      YouTube    ││
│ │    23 篇內容 · 最新 2026-07-03 · 上次抓取 06:00  ││
│ │    Tags: macro, hedge_fund                       ││
│ │                               [瀏覽內容] [抓取]  ││
│ ├──────────────────────────────────────────────────┤│
│ │ 🎬 Cathie Wood ARK Invest             YouTube    ││
│ │    18 篇內容 · 最新 2026-07-04                    ││
│ │                               [瀏覽內容] [抓取]  ││
│ ├──────────────────────────────────────────────────┤│
│ │ 🐦 @mark_minervini（Phase 2）            X       ││
│ │    ⚠️ 尚未啟用                                    ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 頁面結構：內容瀏覽（點入某大神後）

```
┌─────────────────────────────────────────────────────┐
│ ← 返回大神列表   Stanley Druckenmiller Updates       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [封面圖]  Why I'm Buying NVDA Aggressively      │ │
│ │           2026-07-03 · 18:42 · ⭐                │ │
│ │                                                 │ │
│ │ 📝 AI 摘要：                                     │ │
│ │ Druckenmiller 認為 NVDA 目前估值合理，主要因為... │ │
│ │                                                 │ │
│ │ 📌 提到的股票：NVDA, AMD, TSMC                   │ │
│ │                          [開啟原文] [⭐] [隱藏]  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [封面圖]  Market Outlook Q3 2026                │ │
│ │           2026-06-28 · 24:11                    │ │
│ │                                                 │ │
│ │ 📝 AI 摘要：                                     │ │
│ │ ...                                             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [載入更多]                                           │
└─────────────────────────────────────────────────────┘
```

### UI 設計原則

- 沿用現有設計語言：`#FAFAF8` 背景、`Noto Serif TC` 標題、`Noto Sans TC` 內文
- Phase 2 平台（X / Substack）在 Phase 1 顯示但標記「尚未啟用」，灰色
- YouTube 封面圖用 `thumbnailUrl`，寬度 160px
- 摘要展開/收合（預設展開最新 3 筆）

---

## 2.8 檔案清單（實作用）

| 檔案路徑 | 說明 | Phase |
|----------|------|-------|
| `types/guru-tracker.ts` | TypeScript types | 1 |
| `lib/db/gurus.ts` | DB CRUD helpers（channels + content） | 1 |
| `lib/guru/fetchYouTube.ts` | YouTube RSS 抓取 + 解析 | 1 |
| `lib/ai/summarizeGuruContent.ts` | AI 摘要生成 | 1 |
| `app/api/admin/gurus/route.ts` | GET 頻道列表 | 1 |
| `app/api/admin/gurus/[id]/content/route.ts` | GET 內容列表 | 1 |
| `app/api/admin/gurus/[id]/content/[contentId]/route.ts` | PATCH 編輯內容 | 1 |
| `app/api/admin/gurus/[id]/fetch/route.ts` | POST 手動抓取 | 1 |
| `app/api/cron/update-guru-content/route.ts` | Cron 自動抓取 | 1 |
| `app/admin/gurus/page.tsx` | 後台頻道列表頁 | 1 |
| `app/admin/gurus/[id]/page.tsx` | 後台內容瀏覽頁 | 1 |
| `lib/guru/fetchX.ts` | X 抓取（用 xurl） | 2 |
| `lib/guru/fetchSubstack.ts` | Substack RSS 抓取 | 2 |

---

## 2.9 新增依賴

```bash
npm install xml2js
npm install -D @types/xml2js
```

---

# 附錄 A — 共用基礎設施

## A.1 新增 vercel.json cron 總覽

```json
{
  "crons": [
    { "path": "/api/cron/update-prices", "schedule": "0 22 * * *" },
    { "path": "/api/cron/update-news", "schedule": "0 0 * * *" },
    { "path": "/api/cron/verify-promises", "schedule": "0 6 * * 1" },
    { "path": "/api/cron/update-guru-content", "schedule": "0 22 * * *" }
  ]
}
```

> ⚠️ `update-prices` 和 `update-guru-content` 同為 UTC 22:00。
> 建議 `update-guru-content` 改為 `30 22 * * *`（22:30）錯開。

## A.2 AI 模型用量估算

| 功能 | 呼叫頻率 | 每次 token 估算 | 月估算 |
|------|----------|----------------|--------|
| 承諾提取 | 手動觸發 ~5 次/月 | ~50K input + ~2K output | ~260K tokens |
| 承諾比對 | 每週一次（~10 股） | ~30K input + ~1K output | ~1.2M tokens |
| 大神摘要 | 每天 ~5 篇新內容 | ~2K input + ~500 output | ~375K tokens |
| **合計** | | | **~1.8M tokens/月** |

Gemini 2.0 Flash 免費額度 1,500 req/day，完全夠用。

## A.3 實作優先順序

```
Phase 1A — 大神追蹤 YouTube（最低風險，立即可做）
  1. types/guru-tracker.ts
  2. lib/db/gurus.ts
  3. lib/guru/fetchYouTube.ts
  4. lib/ai/summarizeGuruContent.ts
  5. API routes（4 支）
  6. Cron
  7. 後台 UI（2 頁）

Phase 1B — 管理層承諾（需要更多 prompt 調校）
  1. types/promise-tracker.ts
  2. lib/db/promises.ts
  3. lib/ai/extractPromises.ts + verifyPromises.ts
  4. API routes（6 支）
  5. Cron
  6. 後台 UI
  7. 前台整合

Phase 2 — X + Substack 抓取
  1. lib/guru/fetchX.ts（xurl）
  2. lib/guru/fetchSubstack.ts（RSS）
  3. Cron 擴充
```

---

> **End of spec. 有任何問題或要調整的地方，隨時跟 JG 確認。** 🏮
