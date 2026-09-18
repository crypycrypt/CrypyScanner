// API route — serves live stock signals from lib/stockSignalEngine.ts
// (same 13-engine quant scanner as crypto-scanner, ported for equities).
// Route param: market = 'idx' | 'us'
// Optional query params:
//   ?report=1  → returns { signals, watchlist, report } with full scan log lines
//   ?force=1   → forces a fresh scan instead of using cache
import { NextRequest, NextResponse } from 'next/server';
import { getLiveStockSignals, getLiveStockScanReport, peekLiveStockSignals, StockMarket } from '@/lib/stockSignalEngine';

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
    const wantReport = searchParams.get('report') === '1';
    const force = searchParams.get('force') === '1';

    if (wantReport) {
      const { signals, watchlist, report } = await getLiveStockScanReport(market, force);
      return NextResponse.json({ signals, watchlist, report });
    }

    if (!force) {
      const peek = peekLiveStockSignals(market);
      if (peek.signals.length > 0) {
        return NextResponse.json(peek.signals);
      }
    }

    const signals = await getLiveStockSignals(market, force);
    return NextResponse.json(signals);
  } catch (error) {
    console.error(`Error serving live stock signals (${market}):`, error);
    return NextResponse.json(
      { error: 'Failed to fetch live stock signals' },
      { status: 500 }
    );
  }
}
