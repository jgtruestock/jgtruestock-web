# SPEC-GURU-TRACKER.md

> **JGTrueStock — 大神追蹤功能規格書**
> 最後更新：2026-07-05
> 作者：吉利 🏮

---

## 目錄

- [1. 功能概述](#1-功能概述)
- [2. 設計原則](#2-設計原則)
- [3. 資料模型](#3-資料模型)
- [4. YouTube RSS 抓取（Phase 1）](#4-youtube-rss-抓取phase-1)
- [5. X 追蹤 — dataUrl 模式](#5-x-追蹤--dataurl-模式)
- [6. Substack RSS 抓取（Phase 2）](#6-substack-rss-抓取phase-2)
- [7. Podcast 抓取策略](#7-podcast-抓取策略)
- [8. AI 摘要生成](#8-ai-摘要生成)
- [9. 統一時間軸（guru_content + jg_commentary）](#9-統一時間軸guru_content--jg_commentary)
- [10. API Routes](#10-api-routes)
- [11. Cron Job](#11-cron-job)
- [12. 後台 UI：`/admin/gurus`](#12-後台-uiadmingurus)
- [13. 檔案清單](#13-檔案清單)
- [14. 新增依賴](#14-新增依賴)
- [15. Phase 分期與優先順序](#15-phase-分期與優先順序)

---

## 1. 功能概述

自動抓取 JG 關注的投資大神（YouTube、X/Twitter、Substack）最新內容，用 AI 生成中文摘要，讓 JG 在後台一站式瀏覽，不用每天翻 17 個來源。

### 現有基礎

- **DB**: `jgtruestock.guru_channels` collection 已存在，含 17 個來源（10 YouTube + 4 X + 3 Substack）
- **DB**: `jgtruestock.jg_commentary` collection 已存在，存放股票 earnings call AI 點評
- 兩個 collection 的內容在後台統一時間軸中混排顯示

### 使用者故事

1. **系統（Cron）** 每天自動抓取所有啟用頻道的新內容、生成 AI 摘要
2. **JG（Admin）** 打開後台時間軸，一次看到所有大神新內容 + 法說會點評
3. **JG** 決定是否將某篇法說會點評發布給會員（唯一需要 JG 手動做的事）
4. **Guru content（大神內容）** 不需要 JG 審閱發布，直接可看

### 「JG 不方便最小化」原則

- 後台 **完全不需要手動觸發**，所有抓取/摘要全自動
- JG 唯一需要做的事：**看時間軸 → 決定要不要把某篇法說會點評發布給會員**
- 大神內容不需要 JG 審閱發布，自動進入時間軸即可

---

## 2. 設計原則

### 2.1 AI 摘要風格 — 客觀財經新聞

> **所有 AI 生成的摘要都用「財經新聞分析師」語氣。**

- ✅ 只陳述事實和觀點歸屬（「Druckenmiller 認為…」「報告指出…」）
- ✅ 客觀整理原作者說了什麼，不加額外意見
- ❌ 不用「我覺得」「我認為」
- ❌ 不用 JG 的口吻或第一人稱
- ❌ 不加主觀評價（「這個觀點很有道理」）

此原則同時適用於：
- `guru_content` 的 AI 摘要
- `jg_commentary` 的法說會 AI 點評
- 未來任何 AI 生成的文字內容

### 2.2 Phase 分期

| Phase | 範圍 | 原因 |
|-------|------|------|
| **Phase 1** | YouTube RSS + Serenity X (dataUrl) | RSS 免費穩定；Serenity 有現成 JSON API |
| **Phase 2** | 其他 X 帳號（placeholder）+ Substack RSS | X 其他帳號暫無追蹤源，先留架構 |

---

## 3. 資料模型

### Database: `jgtruestock`

### Collection: `guru_channels`（已存在，補充預期 schema）

```typescript
// types/guru-tracker.ts

import { ObjectId } from 'mongodb';

export type GuroPlatform = 'youtube' | 'x' | 'substack' | 'podcast';

export interface GuruChannel {
  _id: ObjectId;
  name: string;                    // 顯示名稱，e.g. "Stanley Druckenmiller Updates"
  platform: GuroPlatform;

  // 平台識別
  channelId: string;               // YouTube channel ID / X handle / Substack subdomain
  url: string;                     // 頻道/帳號主頁 URL
  rssUrl: string | null;           // RSS feed URL（YouTube/Substack 有）

  // X 專用：第三方資料源
  dataUrl: string | null;          // e.g. "https://www.trackserenity.com/data/signals.json"

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
export type GuruContentType = 'video' | 'tweet' | 'article' | 'podcast';

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
  rawContent: string | null;       // 推文全文（含 quotedTweet）/ 文章全文
  thumbnailUrl: string | null;     // 影片/文章封面圖
  duration: string | null;         // 影片長度 "12:34"（YouTube 限定）

  // YouTube 特有
  viewCount: number | null;
  likeCount: number | null;

  // AI 摘要
  summary: string | null;          // 中文摘要（200-400 字），客觀財經分析師語氣
  summaryModel: string | null;     // e.g. "gemini-2.0-flash"
  summaryGeneratedAt: Date | null;

  // AI 提取的關聯股票
  mentionedTickers: string[];      // e.g. ["NVDA", "TSMC"]（推文 cashtags 直接存這裡）

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

> **⚠️ 欄位更名**：原 `mentionedSymbols` → `mentionedTickers`，統一命名。推文的 `$CASHTAG` 直接存入此欄位。

### Collection: `jg_commentary`（已存在）

法說會 AI 點評，已有既存 schema。在統一時間軸中與 `guru_content` 混排。

> 時間軸 API 需 JOIN 這兩個 collection，詳見 [§9](#9-統一時間軸guru_content--jg_commentary)。

### 索引設計（guru_content）

```
{ externalId: 1, platform: 1 }       // unique，防重複抓取
{ channelId: 1, publishedAt: -1 }    // 某大神的內容按時間排
{ platform: 1, publishedAt: -1 }     // 按平台瀏覽
{ publishedAt: -1 }                  // 全部內容時間排序（時間軸用）
{ status: 1 }                        // 找未摘要的
{ mentionedTickers: 1 }              // 按股票查相關大神內容
{ isStarred: 1, publishedAt: -1 }    // JG 收藏列表
```

---

## 4. YouTube RSS 抓取（Phase 1）

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

import { parseStringPromise } from 'xml2js';

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

## 5. X 追蹤 — dataUrl 模式

### 5.1 為什麼不用 X API

- X API Free tier **不支援搜尋**（已確認）
- 直接打 X API 成本高、rate limit 嚴
- 改用第三方追蹤網站的公開資料作為資料源

### 5.2 架構：dataUrl 欄位

`guru_channels` 新增 `dataUrl` 欄位，存放第三方追蹤網站的 JSON endpoint。

- 每個 X 類型的 channel 可以有不同的 `dataUrl`（不同追蹤網站）
- 如果某帳號沒有可用的追蹤網站，`dataUrl` 留 `null`，該 channel 自動跳過
- **不設計成強依賴 X API**，X fetcher 統一走 `dataUrl` 模式

### 5.3 Serenity X 追蹤（Phase 1 已可用）

Serenity（`@SerenityFund`）使用 TrackSerenity.com 追蹤：

- **API endpoint**: `https://www.trackserenity.com/data/signals.json`
- **回傳格式**: JSON array，每則推文一筆
- **createdAt 格式**: `"Sun Jul 05 13:38:44 +0000 2026"`（Twitter API 標準格式）

### 抓取邏輯

```typescript
// lib/guru/fetchX.ts

export interface TrackSerenitySignal {
  id: string;                      // Tweet ID
  text: string;                    // 推文全文
  createdAt: string;               // "Sun Jul 05 13:38:44 +0000 2026"
  cashtags?: string[];             // ["NVDA", "TSMC"]
  quotedTweet?: {
    text: string;
    // ... 其他欄位
  };
}

export async function fetchXFromDataUrl(
  dataUrl: string
): Promise<TrackSerenitySignal[]> {
  const res = await fetch(dataUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`X dataUrl fetch failed: ${res.status}`);
  return res.json();
}
```

### 資料對應

每則推文 → 一筆 `guru_content`：

| guru_content 欄位 | 來源 |
|--------------------|------|
| `externalId` | Tweet ID (`signal.id`) |
| `title` | 推文前 100 字 |
| `url` | `https://x.com/SerenityFund/status/{id}` |
| `publishedAt` | 解析 `createdAt`（Twitter 時間格式） |
| `rawContent` | 完整推文原文（含 `quotedTweet.text` 如果有） |
| `mentionedTickers` | `cashtags` 欄位直接存入 |
| `contentType` | `'tweet'` |
| `platform` | `'x'` |

### createdAt 解析

```typescript
// Twitter API 時間格式解析
// "Sun Jul 05 13:38:44 +0000 2026"
function parseTwitterDate(dateStr: string): Date {
  return new Date(dateStr);  // JS Date 原生支援此格式
}
```

### 其他 X 帳號（Phase 2 placeholder）

- Dylan Patel、Mark Minervini 等 X 帳號目前**沒有對應的追蹤網站**
- `dataUrl` 留 `null`，Cron 自動跳過
- 未來如果找到新的追蹤源，只要填入 `dataUrl` 即可啟用，不需改 code

---

## 6. Substack RSS 抓取（Phase 2）

### RSS Feed 格式

```
https://{subdomain}.substack.com/feed
```

- 標準 RSS 2.0 格式
- 文章全文可從 `<content:encoded>` 取得
- 解析方式同 YouTube RSS，但 entry 結構不同

### 抓取邏輯

```typescript
// lib/guru/fetchSubstack.ts

export async function fetchSubstackRSS(
  subdomain: string
): Promise<SubstackEntry[]> {
  const feedUrl = `https://${subdomain}.substack.com/feed`;
  // ... RSS 解析，類似 YouTube
}
```

---

## 7. Podcast 抓取策略

### 優先順序

1. **先找 YouTube 版** — 許多 Podcast 同時上傳 YouTube，YouTube 影片有自動字幕/逐字稿，可直接作為摘要來源
2. **有 YouTube 版 → 走 YouTube RSS 抓取**，跟一般影片一樣處理
3. **只有音檔 → Whisper 本地轉錄**（備案，Phase 2+）

### Whisper 備案流程

```
RSS 取得音檔 URL → 下載 mp3 → Whisper CLI 轉文字 → AI 摘要
```

- 使用 OpenAI Whisper CLI（本地，免費）
- 僅用在「確定沒有 YouTube 版」的 Podcast
- Whisper 處理時間較長（~1x 即時），排在 Cron 最後執行

---

## 8. AI 摘要生成

### 摘要 Prompt

```typescript
// lib/ai/summarizeGuruContent.ts

export async function summarizeGuruContent(
  content: {
    title: string;
    description: string;        // YouTube description / 文章全文 / 推文全文
    platform: string;
    authorName: string;
  }
): Promise<{
  summary: string;
  mentionedTickers: string[];
}> { ... }
```

**System Prompt**：

```
你是一位客觀的財經新聞分析師，正在整理投資專家的最新觀點。

規則：
1. 用繁體中文寫一段 200-400 字的摘要
2. 以客觀第三人稱報導，只陳述原作者的觀點和事實
3. 重點：這位專家在講什麼觀點？對哪些股票/產業有看法？結論是什麼？
4. 如果內容提到具體股票，列出所有提到的股票代號（美股 ticker）
5. 不要加任何主觀意見、不要用「我覺得」「我認為」
6. 不要評價原作者觀點的好壞對錯

語氣範例：
✅ 「Druckenmiller 指出，NVDA 目前估值仍屬合理區間，主因 AI 基礎建設需求持續成長。」
✅ 「該報告認為半導體產業將在 Q3 迎來修正。」
❌ 「我覺得這個分析很有道理。」
❌ 「Druckenmiller 的觀點非常精闢。」

輸出 JSON：
{
  "summary": "...",
  "mentionedTickers": ["NVDA", "TSMC"]
}
```

### 摘要時機

- 抓取後不立即摘要（description 太短可能品質差）
- Cron 中抓完所有來源後，對 `status: 'fetched'` 的新內容批次生成摘要
- 每次最多處理 10 筆（控制 Gemini API 用量）

---

## 9. 統一時間軸（guru_content + jg_commentary）

### 9.1 概念

後台 `/admin/gurus` 的首頁是一個 **統一時間軸**，混排兩種內容：

| 來源 | Collection | 時間欄位 | 說明 |
|------|-----------|----------|------|
| 大神內容 | `guru_content` | `publishedAt` | YouTube/X/Substack 新內容 |
| 法說會點評 | `jg_commentary` | `createdAt`（或對應時間欄位） | 股票 earnings call AI 點評 |

兩種內容按時間倒序混排，JG 一打開就看到最新的所有資訊流。

### 9.2 Timeline API

```
GET /api/admin/gurus/timeline
```

**功能**：JOIN `guru_content` + `jg_commentary` 兩個 collection，按時間倒序回傳統一列表。

**Query Params**：

| Param | Type | Default | 說明 |
|-------|------|---------|------|
| `page` | number | 1 | 頁碼 |
| `limit` | number | 20 | 每頁筆數 |
| `source` | string | `all` | 篩選：`all` / `guru` / `commentary` |
| `platform` | string | — | 篩選平台：`youtube` / `x` / `substack` |

**Response**：

```json
{
  "items": [
    {
      "type": "guru_content",
      "data": {
        "_id": "...",
        "channelName": "Stanley Druckenmiller Updates",
        "platform": "youtube",
        "title": "Why I'm Buying NVDA Aggressively",
        "publishedAt": "2026-07-05T14:30:00Z",
        "summary": "Druckenmiller 指出...",
        "mentionedTickers": ["NVDA", "AMD"],
        "status": "summarized",
        "url": "https://youtube.com/watch?v=..."
      }
    },
    {
      "type": "jg_commentary",
      "data": {
        "_id": "...",
        "symbol": "NVDA",
        "title": "NVDA Q2 2026 法說會點評",
        "createdAt": "2026-07-04T22:00:00Z",
        "summary": "NVIDIA 第二季營收達...",
        "isPublished": false
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "totalPages": 5
  }
}
```

### 9.3 MongoDB 實作策略

使用 `$unionWith` aggregation 合併兩個 collection：

```typescript
// lib/db/timeline.ts

export async function getTimeline(opts: {
  page: number;
  limit: number;
  source?: 'all' | 'guru' | 'commentary';
  platform?: string;
}) {
  const db = await getDb();
  const skip = (opts.page - 1) * opts.limit;

  const pipeline: any[] = [];

  if (opts.source !== 'commentary') {
    // guru_content 部分
    pipeline.push(
      { $match: { status: { $ne: 'hidden' }, ...(opts.platform ? { platform: opts.platform } : {}) } },
      { $addFields: { type: 'guru_content', sortDate: '$publishedAt' } }
    );
  }

  if (opts.source !== 'guru') {
    // $unionWith jg_commentary
    pipeline.push({
      $unionWith: {
        coll: 'jg_commentary',
        pipeline: [
          { $addFields: { type: 'jg_commentary', sortDate: '$createdAt' } }
        ]
      }
    });
  }

  pipeline.push(
    { $sort: { sortDate: -1 } },
    { $skip: skip },
    { $limit: opts.limit }
  );

  return db.collection('guru_content').aggregate(pipeline).toArray();
}
```

### 9.4 法說會點評發布

- `jg_commentary` 有 `isPublished` 欄位（布林值）
- JG 在時間軸中看到法說會點評後，可以點「發布」按鈕 → PATCH 設定 `isPublished: true`
- **這是 JG 在整個系統中唯一需要手動做的事**
- Guru content 不需要發布動作，直接可看

---

## 10. API Routes

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

### `GET /api/admin/gurus/timeline`

統一時間軸 — JOIN `guru_content` + `jg_commentary`，按時間倒序。

詳見 [§9.2](#92-timeline-api)。

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
      "summary": "Druckenmiller 指出 NVDA 目前估值合理...",
      "mentionedTickers": ["NVDA", "AMD"],
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

### `PATCH /api/admin/commentary/[id]/publish`

發布/取消發布法說會點評。

| Body Field | Type | 說明 |
|------------|------|------|
| `isPublished` | boolean | 設定發布狀態 |

---

### `POST /api/admin/gurus/[id]/fetch`

手動觸發單一頻道的內容抓取（備用，正常流程自動）。

---

## 11. Cron Job

### `/api/cron/update-guru-content`

| 欄位 | 值 |
|------|-----|
| Schedule | `30 22 * * *` (UTC 22:30 = 台灣 06:30，錯開 update-prices) |
| Auth | `Bearer CRON_SECRET` |

**流程**：

```
1. 從 guru_channels 取出 active=true 的頻道

2. YouTube 頻道（platform="youtube"）：
   a. 逐頻道抓取 RSS（batch 3，間隔 500ms）
   b. 過濾：只保留 publishedAt 在過去 14 天內的
   c. 去重：externalId + platform 已存在則 skip
   d. 新內容寫入 guru_content（status: 'fetched'）
   e. 更新 guru_channels.lastFetchedAt / lastContentDate / contentCount

3. X 頻道（platform="x", dataUrl 不為 null）：
   a. 用 dataUrl 抓取 JSON（如 trackserenity.com）
   b. 解析每則推文 → 逐筆寫入 guru_content
   c. rawContent = 完整推文原文 + quotedTweet（如果有）
   d. cashtags → mentionedTickers
   e. 去重同上

4. X 頻道（dataUrl 為 null）：skip，log "no dataUrl"

5. 對所有 status='fetched' 的新內容批次生成 AI 摘要（最多 10 筆/次）

6. 更新所有頻道的統計欄位

7. 回傳報告
```

**Phase 2 擴充**：

```
Substack（Phase 2）：
- RSS feed: https://{subdomain}.substack.com/feed
- 文章全文可從 RSS <content:encoded> 取得
- 解析方式同 YouTube RSS，但 entry 結構不同

Podcast（Phase 2+）：
- 先檢查是否有 YouTube 版（用 RSS）
- 只有音檔 → Whisper CLI 轉文字 → AI 摘要
```

**vercel.json**：
```json
{
  "crons": [
    { "path": "/api/cron/update-prices", "schedule": "0 22 * * *" },
    { "path": "/api/cron/update-news", "schedule": "0 0 * * *" },
    { "path": "/api/cron/verify-promises", "schedule": "0 6 * * 1" },
    { "path": "/api/cron/update-guru-content", "schedule": "30 22 * * *" }
  ]
}
```

---

## 12. 後台 UI：`/admin/gurus`

### 12.1 首頁：統一時間軸

> JG 打開 `/admin/gurus` 的第一個畫面就是時間軸。

```
┌─────────────────────────────────────────────────────┐
│ Navbar                                              │
├─────────────────────────────────────────────────────┤
│ 大神追蹤                               [頻道管理 →] │
│                                                     │
│ [全部] [大神內容] [法說會點評]   [YouTube▾] [X▾]     │
│                                                     │
│ ── 2026-07-05 ─────────────────────────────────────│
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🐦 SerenityFund · X · 14:38                     │ │
│ │ $NVDA looking strong above 200-day MA...        │ │
│ │ 📝 Serenity 指出 NVDA 站穩 200 日均線上方...      │ │
│ │ 📌 NVDA                                         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🎬 Stanley Druckenmiller · YouTube · 10:30      │ │
│ │ Why I'm Buying NVDA Aggressively  · 18:42       │ │
│ │ 📝 Druckenmiller 指出 NVDA 估值合理...            │ │
│ │ 📌 NVDA, AMD, TSMC                    [⭐] [🔗]  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ── 2026-07-04 ─────────────────────────────────────│
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📊 NVDA Q2 2026 法說會點評            jg_commentary│
│ │ NVIDIA 第二季營收達 $42B，超越市場預期...          │ │
│ │                                                 │ │
│ │ 狀態：未發布                                      │
│ │                          [發布給會員] [編輯] [🔗] │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [載入更多]                                           │
└─────────────────────────────────────────────────────┘
```

### 12.2 頻道管理頁（次要入口）

從時間軸右上角「頻道管理」進入。

```
┌─────────────────────────────────────────────────────┐
│ ← 返回時間軸   頻道管理                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [全部 17] [YouTube 10] [X 4] [Substack 3]           │
│                                                     │
│ ┌──────────────────────────────────────────────────┐│
│ │ 🎬 Stanley Druckenmiller Updates      YouTube    ││
│ │    23 篇內容 · 最新 2026-07-03 · 上次抓取 06:30  ││
│ │    Tags: macro, hedge_fund                       ││
│ │                               [瀏覽內容] [抓取]  ││
│ ├──────────────────────────────────────────────────┤│
│ │ 🐦 SerenityFund                          X       ││
│ │    dataUrl: trackserenity.com ✅                  ││
│ │    45 篇內容 · 最新 2026-07-05                    ││
│ │                               [瀏覽內容] [抓取]  ││
│ ├──────────────────────────────────────────────────┤│
│ │ 🐦 @dyaborin（Dylan Patel）               X      ││
│ │    dataUrl: 無 ⚠️ 暫無追蹤源                      ││
│ │                                    [瀏覽內容]    ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 12.3 內容瀏覽頁（點入某大神後）

```
┌─────────────────────────────────────────────────────┐
│ ← 返回   Stanley Druckenmiller Updates              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [封面圖]  Why I'm Buying NVDA Aggressively      │ │
│ │           2026-07-03 · 18:42 · ⭐                │ │
│ │                                                 │ │
│ │ 📝 AI 摘要：                                     │ │
│ │ Druckenmiller 指出 NVDA 目前估值合理，主因...     │ │
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

### 12.4 UI 設計原則

- 沿用現有設計語言：`#FAFAF8` 背景、`Noto Serif TC` 標題、`Noto Sans TC` 內文
- YouTube 封面圖用 `thumbnailUrl`，寬度 160px
- 摘要展開/收合（預設展開最新 3 筆）
- 時間軸按日期分組，日期分隔線
- 法說會點評用不同底色或標記區分（如左邊框線 `#c9a84c`）
- 「發布給會員」按鈕僅出現在 `jg_commentary` 且 `isPublished=false` 的項目
- X 無 dataUrl 的頻道顯示灰色 + ⚠️ 標記

---

## 13. 檔案清單

| 檔案路徑 | 說明 | Phase |
|----------|------|-------|
| `types/guru-tracker.ts` | TypeScript types（含 GuruChannel, GuruContent, TimelineItem） | 1 |
| `lib/db/gurus.ts` | DB CRUD helpers（channels + content） | 1 |
| `lib/db/timeline.ts` | 統一時間軸查詢（$unionWith guru_content + jg_commentary） | 1 |
| `lib/guru/fetchYouTube.ts` | YouTube RSS 抓取 + 解析 | 1 |
| `lib/guru/fetchX.ts` | X dataUrl 抓取（Phase 1: Serenity） | 1 |
| `lib/ai/summarizeGuruContent.ts` | AI 摘要生成（客觀財經分析師語氣） | 1 |
| `app/api/admin/gurus/route.ts` | GET 頻道列表 | 1 |
| `app/api/admin/gurus/timeline/route.ts` | GET 統一時間軸 | 1 |
| `app/api/admin/gurus/[id]/content/route.ts` | GET 內容列表 | 1 |
| `app/api/admin/gurus/[id]/content/[contentId]/route.ts` | PATCH 編輯內容 | 1 |
| `app/api/admin/gurus/[id]/fetch/route.ts` | POST 手動抓取 | 1 |
| `app/api/admin/commentary/[id]/publish/route.ts` | PATCH 發布/取消發布法說會點評 | 1 |
| `app/api/cron/update-guru-content/route.ts` | Cron 自動抓取 + 摘要 | 1 |
| `app/admin/gurus/page.tsx` | 後台統一時間軸頁 | 1 |
| `app/admin/gurus/channels/page.tsx` | 後台頻道管理頁 | 1 |
| `app/admin/gurus/[id]/page.tsx` | 後台單一頻道內容瀏覽頁 | 1 |
| `lib/guru/fetchSubstack.ts` | Substack RSS 抓取 | 2 |

---

## 14. 新增依賴

```bash
npm install xml2js
npm install -D @types/xml2js
```

---

## 15. Phase 分期與優先順序

```
Phase 1（立即可做）
  ├── YouTube RSS 抓取
  ├── Serenity X 抓取（trackserenity.com dataUrl）
  ├── AI 摘要（客觀財經分析師語氣）
  ├── 統一時間軸 API（guru_content + jg_commentary JOIN）
  ├── 法說會點評發布功能
  ├── Cron 自動抓取
  └── 後台 UI（時間軸 + 頻道管理 + 內容瀏覽）

Phase 2
  ├── Substack RSS 抓取
  ├── 其他 X 帳號（等有追蹤源再啟用）
  └── Podcast（先找 YouTube 版，Whisper 備案）
```

### AI 模型用量估算

| 功能 | 呼叫頻率 | 每次 token 估算 | 月估算 |
|------|----------|----------------|--------|
| 大神摘要 | 每天 ~5-8 篇新內容 | ~2K input + ~500 output | ~375K-600K tokens |

Gemini 2.0 Flash 免費額度 1,500 req/day，完全夠用。

---

> **End of spec.** 🏮
