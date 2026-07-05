import { ObjectId } from 'mongodb';

export interface JGMentionRecord {
  _id: ObjectId;
  symbol: string;
  companyName: string;
  exchange: string;
  mentionDate: Date;
  priceAtMention: number;
  currentPrice: number;
  gainPct: number;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JGMentionRecordJSON {
  _id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  mentionDate: string;
  priceAtMention: number;
  currentPrice: number;
  gainPct: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
  mentionCount?: number;
}

export interface MentionsStats {
  total: number;
  avgGainPct: number;
  positiveCount: number;
  positiveRate: number;
}
