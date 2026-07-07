const FMP_API_KEY = process.env.FMP_API_KEY!;
const BASE_URL = 'https://financialmodelingprep.com/stable';

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  exchange: string;
}

export interface FMPHistoricalPrice {
  date: string;
  close: number;
}

export async function searchSymbol(query: string): Promise<FMPQuote[]> {
  const res = await fetch(
    `${BASE_URL}/search?query=${encodeURIComponent(query)}&limit=10&apikey=${FMP_API_KEY}`
  );
  if (!res.ok) throw new Error('FMP search failed');
  const data = await res.json();
  return data.slice(0, 10).map((item: any) => ({
    symbol: item.symbol,
    name: item.name,
    price: item.price || 0,
    exchange: item.stockExchange || item.exchange || '',
  }));
}

export async function getHistoricalPrice(
  symbol: string,
  date: string
): Promise<number | null> {
  const res = await fetch(
    `${BASE_URL}/historical-price-eod/full?symbol=${symbol}&from=${date}&to=${date}&apikey=${FMP_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    // 找最接近指定日期的交易日（可能剛好是節假日，取最近一筆）
    const sorted = data.sort((a: any, b: any) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1]?.close ?? null;
  }
  return null;
}

export async function getCurrentPrice(symbol: string): Promise<number | null> {
  const res = await fetch(
    `${BASE_URL}/quote?symbol=${symbol}&apikey=${FMP_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0].price ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Commentary-feature: new endpoints
// ─────────────────────────────────────────────────────────────────

export interface EarningsTranscript {
  symbol: string;
  quarter: number;
  year: number;
  date: string;
  content: string;
}

export interface StockNewsArticle {
  title: string;
  url: string;
  publishedDate: string;
  site: string;
  text: string;
  symbol: string;
}

export interface SecFiling {
  symbol: string;
  cik: string;
  type: string;
  link: string;
  finalLink: string;
  acceptedDate: string;
  fillingDate: string;
}

/**
 * Fetch the latest earnings call transcript for a symbol.
 * FMP endpoint: GET /stable/earning-call-transcript?symbol={symbol}&year={year}&quarter={quarter}
 * Auto-detects the most recent available quarter (tries up to 6 quarters back).
 */
export async function fetchEarningsTranscript(
  symbol: string
): Promise<EarningsTranscript[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // Estimate current fiscal quarter
  let startQuarter = currentMonth <= 3 ? 1 : currentMonth <= 6 ? 2 : currentMonth <= 9 ? 3 : 4;
  let startYear = currentYear;

  // Try up to 6 quarters back to find the latest available transcript
  for (let attempt = 0; attempt < 6; attempt++) {
    let q = startQuarter - attempt;
    let y = startYear;
    while (q <= 0) { q += 4; y -= 1; }
    try {
      const res = await fetch(
        `${BASE_URL}/earning-call-transcript?symbol=${encodeURIComponent(symbol)}&year=${y}&quarter=${q}&apikey=${FMP_API_KEY}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (err) {
      console.error(`[FMP] fetchEarningsTranscript ${symbol} ${y}Q${q} error:`, err);
    }
  }
  console.warn(`[FMP] fetchEarningsTranscript ${symbol} → no transcript found in last 6 quarters`);
  return [];
}

/**
 * Fetch recent news articles for a symbol.
 * FMP endpoint: GET /stable/news/stock?symbols={symbol}&limit={limit}
 */
export async function fetchStockNews(
  symbol: string,
  limit = 50
): Promise<StockNewsArticle[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/news/stock?symbols=${encodeURIComponent(symbol)}&limit=${limit}&apikey=${FMP_API_KEY}`
    );
    if (!res.ok) {
      console.error(`[FMP] fetchStockNews ${symbol} → HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[FMP] fetchStockNews ${symbol} error:`, err);
    return [];
  }
}

/**
 * Fetch recent SEC filings (8-K by default) for a symbol.
 * FMP endpoint: GET /stable/sec_filings?symbol={symbol}&type=8-K&limit={limit}
 */
export async function fetchSecFilings(
  symbol: string,
  type = '8-K',
  limit = 5
): Promise<SecFiling[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/sec_filings?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}&limit=${limit}&apikey=${FMP_API_KEY}`
    );
    if (!res.ok) {
      console.error(`[FMP] fetchSecFilings ${symbol} → HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[FMP] fetchSecFilings ${symbol} error:`, err);
    return [];
  }
}

export async function getCompanyProfile(symbol: string): Promise<{ name: string; exchange: string } | null> {
  const res = await fetch(
    `${BASE_URL}/profile?symbol=${symbol}&apikey=${FMP_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return {
      name: data[0].companyName || symbol,
      exchange: data[0].exchangeShortName || '',
    };
  }
  return null;
}
