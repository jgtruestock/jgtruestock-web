import { ObjectId } from 'mongodb';
import type { KeyPoint } from '@/lib/ai/generateCommentary';
export type { KeyPoint } from '@/lib/ai/generateCommentary';

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

  // earnings version tracking (for dedup in check-earnings cron)
  latestEarningsYear: number | null;
  latestEarningsQuarter: number | null;  // legacy (may be undefined from FMP)
  latestEarningsPeriod: string | null;   // e.g. "Q3" from FMP period field

  // key points from two-step AI analysis
  keyPoints?: KeyPoint[];

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

// ─────────────────────────────────────────────────────────
// SEC Filings & Press Releases (FMP API response shapes)
// ─────────────────────────────────────────────────────────
export interface SecFiling {
  symbol: string;
  fillingDate: string;
  acceptedDate?: string;
  type: string;
  link: string;
  finalLink?: string;
}

export interface PressRelease {
  symbol: string;
  date: string;
  title: string;
  text?: string;
}

// ─────────────────────────────────────────────────────────
// jg_stock_filings_8k collection  (in "jgtruestock" DB)
// ─────────────────────────────────────────────────────────
export interface JGStockFilings8K {
  symbol: string;
  filings: SecFiling[];
  fetchedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// jg_stock_press_releases collection  (in "jgtruestock" DB)
// ─────────────────────────────────────────────────────────
export interface JGStockPressReleases {
  symbol: string;
  releases: PressRelease[];
  fetchedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

export interface FilingsAPIResponse {
  symbol: string;
  filings: SecFiling[];
  lastUpdated: string | null;
}

export interface PressReleasesAPIResponse {
  symbol: string;
  releases: PressRelease[];
  lastUpdated: string | null;
}
