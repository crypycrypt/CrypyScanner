// Signal Bot API for real-time signal generation matching crypto-scanner
// This reads from the signals.json file and provides real-time trading signals

import fs from 'fs';
import path from 'path';

// Signal data structure matching crypto-scanner
interface SignalData {
  timestamp: string;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  signalReason: string;
  bullish: number;
  bearish: number;
  confidence: number;
  confidenceRaw: number;
  bayesianPLong: number;
  bayesianPShort: number;
  evidenceCount: number;
  weightsMode: string;
  kellyFraction: number;
  expectedValue: number;
  htfTrend: string;
  htfAligned: boolean;
  mtfReason: string;
  marketRegime: string;
  regimeScore: number;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  volatilityScore: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: number;
  trend: string;
  bos: string;
  whaleBias: string;
  whaleScore: number;
  volPhase: string;
  mcProbUp: number;
  subScores: Array<{
    label: string;
    score: number;
    weight: number;
  }>;
}

// Signal Bot API class
class SignalBotAPI {
  private signalsPath: string;
  private signals: SignalData[] = [];
  private lastUpdate: number = 0;
  private updateInterval: number = 30000; // 30 seconds

  constructor() {
    this.signalsPath = path.join('/Users/radityakusuma/Documents/crypto-scanner', 'signals.json');
    this.loadSignals();
  }

  private loadSignals(): void {
    try {
      if (fs.existsSync(this.signalsPath)) {
        const data = fs.readFileSync(this.signalsPath, 'utf-8');
        this.signals = JSON.parse(data);
        this.lastUpdate = Date.now();
        console.log(`Loaded ${this.signals.length} signals from crypto-scanner`);
      } else {
        console.warn('Signals file not found, using empty signals array');
        this.signals = [];
      }
    } catch (error) {
      console.error('Error loading signals:', error);
      this.signals = [];
    }
  }

  private shouldReload(): boolean {
    return Date.now() - this.lastUpdate > this.updateInterval;
  }

  // Get all active signals (signals from last 24 hours)
  getActiveSignals(): SignalData[] {
    if (this.shouldReload()) {
      this.loadSignals();
    }

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.signals.filter(signal => 
      new Date(signal.timestamp).getTime() > twentyFourHoursAgo
    );
  }

  // Get signals by type (LONG/SHORT/NEUTRAL)
  getSignalsByType(type: 'LONG' | 'SHORT' | 'NEUTRAL'): SignalData[] {
    const activeSignals = this.getActiveSignals();
    return activeSignals.filter(signal => signal.signal === type);
  }

  // Get top signals by confidence
  getTopSignals(limit: number = 10): SignalData[] {
    const activeSignals = this.getActiveSignals();
    return activeSignals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  // Get signal summary statistics
  getSignalStats() {
    const activeSignals = this.getActiveSignals();
    const longSignals = activeSignals.filter(s => s.signal === 'LONG').length;
    const shortSignals = activeSignals.filter(s => s.signal === 'SHORT').length;
    const neutralSignals = activeSignals.filter(s => s.signal === 'NEUTRAL').length;
    
    const avgConfidence = activeSignals.length > 0 
      ? activeSignals.reduce((sum, s) => sum + s.confidence, 0) / activeSignals.length
      : 0;

    return {
      totalSignals: activeSignals.length,
      longSignals,
      shortSignals,
      neutralSignals,
      avgConfidence: Math.round(avgConfidence),
      lastUpdate: this.lastUpdate
    };
  }

  // Get signal for specific coin
  getSignalForCoin(coinSymbol: string): SignalData | null {
    const activeSignals = this.getActiveSignals();
    const coinSignal = activeSignals.find(signal => 
      signal.coinSymbol.toLowerCase() === coinSymbol.toLowerCase()
    );
    
    return coinSignal || null;
  }

  // Get signals with high confidence (>80%)
  getHighConfidenceSignals(): SignalData[] {
    const activeSignals = this.getActiveSignals();
    return activeSignals.filter(signal => signal.confidence > 80);
  }

  // Get signals aligned with higher timeframe trend
  getHTFAlignedSignals(): SignalData[] {
    const activeSignals = this.getActiveSignals();
    return activeSignals.filter(signal => signal.htfAligned);
  }
}

// Create singleton instance
export const signalBotAPI = new SignalBotAPI();

export default signalBotAPI;