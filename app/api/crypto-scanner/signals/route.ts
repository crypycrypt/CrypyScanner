// API route — serves REAL live signals from lib/signalEngine.ts
// (13-engine quant scanner on live Binance data, ported from crypto-scanner signal-bot).
// Response shape: bare JSON array of signal objects (compatible with
// MemeDashboard, SignalTerminal, useSignalBotRealTime, useSignalBot).
// Optional query params:
//   ?report=1  → returns { signals, report } with full scan log lines
//   ?force=1   → forces a fresh scan instead of using cache
import { NextRequest, NextResponse } from 'next/server';
import { getLiveSignals, getLiveScanReport, peekLiveSignals } from '@/lib/signalEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wantReport = searchParams.get('report') === '1';
    const force = searchParams.get('force') === '1';

    if (wantReport) {
      const { signals, report } = await getLiveScanReport(force);
      return NextResponse.json({ signals, report });
    }

    // Fast path: serve cached signals immediately (background rescan is
    // kicked off automatically by peekLiveSignals when the cache is stale).
    if (!force) {
      const peek = peekLiveSignals();
      if (peek.signals.length > 0) {
        return NextResponse.json(peek.signals);
      }
    }

    // Cold start (or forced): await the live scan.
    const signals = await getLiveSignals(force);
    return NextResponse.json(signals);
  } catch (error) {
    console.error('Error serving live signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live signals' },
      { status: 500 }
    );
  }
}
