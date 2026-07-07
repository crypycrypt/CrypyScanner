import { NextResponse } from 'next/server';
import { SmcEngine } from './smc-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body.candles || !Array.isArray(body.candles)) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid candles data' },
        { status: 400 }
      );
    }

    // Analyze candles using SMC engine
    const result = SmcEngine.analyze(body.candles, {
      minGapMultiplier: body.minGapMultiplier || 0.5,
      swingLookback: body.swingLookback || 2
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
