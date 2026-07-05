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
    `${BASE_URL}/historical-price-eod?symbol=${symbol}&from=${date}&to=${date}&apikey=${FMP_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0].close ?? null;
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
