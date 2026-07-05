import { ObjectId } from 'mongodb';

// ─────────────────────────────────────────────────────────
// jg_commentary collection  (in "jgtruestock" DB)
// ─────────────────────────────────────────────────────────
export interface JGCommentary {
  _id: ObjectId;
  symbol: string; // unique index

  // AI-generated draft
  draftTitle: string;
  draftBody: string;
  draftGeneratedAt: Date;
  draftModel: string;

  // JG-approved published version
  publishedTitle: string | null;
  publishedBody: string | null;
  publishedAt: Date | null;

  // status
  status: 'draft' | 'published' | 'stale';

  // source summary (debug)
  sourcesSummary: {
    earningsTranscriptCount: number;
    newsCount: number;
    filingsCount: number;
    latestEarningsDate: string | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

export type JGCommentaryStatus = JGCommentary['status'];

// ─────────────────────────────────────────────────────────
// jg_stock_news collection  (in "jgtruestock" DB)
// ─────────────────────────────────────────────────────────
export interface JGStockNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedDate: string; // ISO 8601
  snippet: string;
  sentiment: string | null;
}

export interface JGStockNews {
  _id: ObjectId;
  symbol: string; // unique index

  articles: JGStockNewsArticle[];

  fetchedAt: Date;
  articleCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────
// jg_stock_filings collection  (in "jgtruestock" DB)
// ─────────────────────────────────────────────────────────
export type JGStockFilingType =
  | 'earnings_transcript'
  | '8k'
  | '10q'
  | '10k'
  | 'press_release';

export interface JGStockFiling {
  _id: ObjectId;
  symbol: string;
  filingType: JGStockFilingType;

  title: string;
  content: string;
  date: string; // ISO 8601
  quarter: string | null;
  year: number | null;

  fmpId: string | null;

  processedForCommentary: boolean;

  fetchedAt: Date;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// API response shapes (used in frontend)
// ─────────────────────────────────────────────────────────
export interface CommentaryAPIResponse {
  symbol: string;
  hasCommentary: false;
}

export interface CommentaryAPIResponsePublished {
  symbol: string;
  hasCommentary: true;
  title: string;
  body: string;
  publishedAt: string;
}

export type CommentaryResponse = CommentaryAPIResponse | CommentaryAPIResponsePublished;

export interface NewsAPIResponse {
  symbol: string;
  articles: JGStockNewsArticle[];
  lastUpdated: string | null;
}
