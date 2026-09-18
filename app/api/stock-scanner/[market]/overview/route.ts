// API route — live market overview for the Stock scanner pages:
// real index quote(s), real exchange session status, and real top
// gainers/losers/most-active straight from the TradingView public screener.
// Nothing here is hardcoded or mocked. Route param: market = 'idx' | 'us'
import { NextRequest, NextResponse } from 'next/server';
import { getTopMovers, getIndexQuotes, getMarketSessions, getStockWatchlist, StockMarket } from '@/lib/stockSignalEngine';

export const dynamic = 'force-dynamic';

function parseMarket(raw: string): StockMarket | null {
  const m = raw.toLowerCase();
  if (m === 'idx') return 'IDX';
  if (m === 'us') return 'US';
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ market: string }> }) {
  const { market: marketParam } = await params;
  const market = parseMarket(marketParam);
  if (!market) {
    return NextResponse.json({ error: `Unknown market "${marketParam}" — expected "idx" or "us"` }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';

    const [movers, indices] = await Promise.all([
      getTopMovers(market, force),
      getIndexQuotes(market),
    ]);
    const sessions = getMarketSessions(market);
    const watchlist = getStockWatchlist(market);

    return NextResponse.json({ movers, indices, sessions, watchlist });
  } catch (error) {
    console.error(`Error serving stock market overview (${market}):`, error);
    return NextResponse.json(
      { error: 'Failed to fetch market overview' },
      { status: 500 }
    );
  }
}
