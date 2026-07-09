// API route to serve signals from crypto-scanner signals.json
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Path to the crypto-scanner signals.json file
    const signalsPath = path.join('/Users/radityakusuma/Documents/crypto-scanner', 'signals.json');
    
    // Check if file exists
    if (!fs.existsSync(signalsPath)) {
      return NextResponse.json(
        { error: 'Signals file not found' },
        { status: 404 }
      );
    }

    // Read and parse the signals file
    const data = fs.readFileSync(signalsPath, 'utf-8');
    const signals = JSON.parse(data);

    // Filter signals from last 24 hours only
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentSignals = signals.filter((signal: any) => 
      new Date(signal.timestamp).getTime() > twentyFourHoursAgo
    );

    // Limit to top 50 signals by confidence
    const topSignals = recentSignals
      .sort((a: any, b: any) => b.confidence - a.confidence)
      .slice(0, 50);

    return NextResponse.json(topSignals);

  } catch (error) {
    console.error('Error reading signals file:', error);
    return NextResponse.json(
      { error: 'Failed to read signals data' },
      { status: 500 }
    );
  }
}
