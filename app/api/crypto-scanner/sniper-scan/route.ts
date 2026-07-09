import { NextResponse } from 'next/server';

interface SniperCoin {
  symbol: string;
  signal: string;
  price: number;
  ch24h: number;
  score: number;
  rsi: number;
  volRatio: number;
  signals: {
    [key: string]: {
      active: boolean;
      label: string;
    };
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tf = searchParams.get('tf') || '1h';
    const limit = parseInt(searchParams.get('limit') || '100');

    // This would normally fetch from a real API endpoint
    // For now, we'll simulate the crypto-scanner sniper scan functionality
    
    // Simulate scanning top pairs and calculating confluence scores
    const coins: SniperCoin[] = [
      {
        symbol: 'BTC',
        signal: 'Bullish Divergence',
        price: 65000,
        ch24h: 2.5,
        score: 85,
        rsi: 28,
        volRatio: 3.2,
        signals: {
          divergence: { active: true, label: 'Divergence' },
          oversold: { active: true, label: 'Oversold' },
          volume: { active: true, label: 'Volume Spike' },
          support: { active: true, label: 'Support Test' },
          momentum: { active: false, label: 'Momentum' },
          breakout: { active: false, label: 'Breakout' }
        }
      },
      {
        symbol: 'ETH',
        signal: 'Support Bounce',
        price: 3500,
        ch24h: 1.8,
        score: 72,
        rsi: 32,
        volRatio: 2.1,
        signals: {
          divergence: { active: false, label: 'Divergence' },
          oversold: { active: true, label: 'Oversold' },
          volume: { active: true, label: 'Volume Spike' },
          support: { active: true, label: 'Support Test' },
          momentum: { active: false, label: 'Momentum' },
          breakout: { active: false, label: 'Breakout' }
        }
      },
      {
        symbol: 'SOL',
        signal: 'Volume Breakout',
        price: 180,
        ch24h: 4.2,
        score: 65,
        rsi: 45,
        volRatio: 4.8,
        signals: {
          divergence: { active: false, label: 'Divergence' },
          oversold: { active: false, label: 'Oversold' },
          volume: { active: true, label: 'Volume Spike' },
          support: { active: false, label: 'Support Test' },
          momentum: { active: true, label: 'Momentum' },
          breakout: { active: true, label: 'Breakout' }
        }
      },
      {
        symbol: 'AVAX',
        signal: 'RSI Oversold',
        price: 42,
        ch24h: -1.2,
        score: 58,
        rsi: 26,
        volRatio: 1.8,
        signals: {
          divergence: { active: false, label: 'Divergence' },
          oversold: { active: true, label: 'Oversold' },
          volume: { active: false, label: 'Volume Spike' },
          support: { active: true, label: 'Support Test' },
          momentum: { active: false, label: 'Momentum' },
          breakout: { active: false, label: 'Breakout' }
        }
      },
      {
        symbol: 'DOT',
        signal: 'Trend Reversal',
        price: 8.5,
        ch24h: 3.1,
        score: 45,
        rsi: 38,
        volRatio: 1.5,
        signals: {
          divergence: { active: true, label: 'Divergence' },
          oversold: { active: false, label: 'Oversold' },
          volume: { active: false, label: 'Volume Spike' },
          support: { active: true, label: 'Support Test' },
          momentum: { active: false, label: 'Momentum' },
          breakout: { active: false, label: 'Breakout' }
        }
      }
    ];

    // Filter based on timeframe and limit
    const filteredCoins = coins.slice(0, limit);

    return NextResponse.json({
      ok: true,
      coins: filteredCoins,
      scannedAt: new Date().toISOString(),
      totalScanned: filteredCoins.length,
      timeframe: tf,
      limit: limit
    });

  } catch (error) {
    console.error('Sniper scan error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to scan sniper setups' },
      { status: 500 }
    );
  }
}