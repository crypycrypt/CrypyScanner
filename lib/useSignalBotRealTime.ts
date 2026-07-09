// Real-time Signal Bot hook that reads from crypto-scanner signals.json
"use client"

import { useQuery } from '@tanstack/react-query'

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

// API endpoint to fetch signals from crypto-scanner
async function fetchSignalsFromScanner(): Promise<SignalData[]> {
  try {
    // This would be an API route that reads from the signals.json file
    const response = await fetch('/api/crypto-scanner/signals');
    if (!response.ok) {
      throw new Error('Failed to fetch signals');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching signals:', error);
    // Fallback to mock data if API fails
    return getMockSignals();
  }
}

// Mock data that matches crypto-scanner structure (fallback)
function getMockSignals(): SignalData[] {
  return [
    {
      timestamp: new Date().toISOString(),
      coinId: 'spell-token',
      coinSymbol: 'spell',
      coinName: 'Spell',
      signal: 'LONG',
      signalReason: 'Bullish 68% (conf 36%)',
      bullish: 68,
      bearish: 32,
      confidence: 71,
      confidenceRaw: 36,
      bayesianPLong: 0.6783,
      bayesianPShort: 0.3217,
      evidenceCount: 5,
      weightsMode: 'ADAPTIVE',
      kellyFraction: 0.04,
      expectedValue: 0.6947,
      htfTrend: 'downtrend',
      htfAligned: false,
      mtfReason: 'HTF downtrend (kontra LONG)',
      marketRegime: 'bull',
      regimeScore: 100,
      currentPrice: 0.00010726,
      priceChange24h: 21.45,
      volume24h: 83381348,
      volatilityScore: 21.4,
      entryLow: 0.00008972,
      entryHigh: 0.00010644,
      stopLoss: 0.00008837,
      tp1: 0.00013560,
      tp2: 0.00015449,
      tp3: 0.00013472,
      rr: 1.5,
      trend: 'consolidation',
      bos: 'none',
      whaleBias: 'accumulation',
      whaleScore: 65,
      volPhase: 'high_expansion',
      mcProbUp: 40,
      subScores: [
        { label: 'Market Structure', score: 50, weight: 0.1939 },
        { label: 'BOS / CHoCH', score: 50, weight: 0.1218 },
        { label: 'Liquidity', score: 50, weight: 0.1218 },
        { label: 'Supply/Demand', score: 50, weight: 0.1218 },
        { label: 'Volume Profile', score: 50, weight: 0.1218 },
        { label: 'Order Flow', score: 50, weight: 0.1218 },
        { label: 'Whale Activity', score: 65, weight: 0.1218 },
        { label: 'Volatility', score: 21, weight: 0.1218 },
        { label: 'Monte Carlo', score: 40, weight: 0.1218 },
        { label: 'Technical', score: 50, weight: 0.1218 }
      ]
    },
    {
      timestamp: new Date().toISOString(),
      coinId: 'ethereum',
      coinSymbol: 'eth',
      coinName: 'Ethereum',
      signal: 'NEUTRAL',
      signalReason: 'Neutral 52% (conf 45%)',
      bullish: 52,
      bearish: 48,
      confidence: 45,
      confidenceRaw: 45,
      bayesianPLong: 0.52,
      bayesianPShort: 0.48,
      evidenceCount: 7,
      weightsMode: 'ADAPTIVE',
      kellyFraction: 0.02,
      expectedValue: 0.51,
      htfTrend: 'sideways',
      htfAligned: true,
      mtfReason: 'HTF sideways (aligned)',
      marketRegime: 'neutral',
      regimeScore: 60,
      currentPrice: 2850.42,
      priceChange24h: -1.23,
      volume24h: 1250000000,
      volatilityScore: 15.2,
      entryLow: 2800.00,
      entryHigh: 2900.00,
      stopLoss: 2750.00,
      tp1: 3000.00,
      tp2: 3100.00,
      tp3: 3200.00,
      rr: 1.2,
      trend: 'sideways',
      bos: 'none',
      whaleBias: 'neutral',
      whaleScore: 50,
      volPhase: 'normal',
      mcProbUp: 48,
      subScores: [
        { label: 'Market Structure', score: 50, weight: 0.1939 },
        { label: 'BOS / CHoCH', score: 50, weight: 0.1218 },
        { label: 'Liquidity', score: 50, weight: 0.1218 },
        { label: 'Supply/Demand', score: 50, weight: 0.1218 },
        { label: 'Volume Profile', score: 50, weight: 0.1218 },
        { label: 'Order Flow', score: 50, weight: 0.1218 },
        { label: 'Whale Activity', score: 50, weight: 0.1218 },
        { label: 'Volatility', score: 15, weight: 0.1218 },
        { label: 'Monte Carlo', score: 48, weight: 0.1218 },
        { label: 'Technical', score: 50, weight: 0.1218 }
      ]
    },
    {
      timestamp: new Date().toISOString(),
      coinId: 'bitcoin',
      coinSymbol: 'btc',
      coinName: 'Bitcoin',
      signal: 'SHORT',
      signalReason: 'Bearish 62% (conf 58%)',
      bullish: 38,
      bearish: 62,
      confidence: 58,
      confidenceRaw: 58,
      bayesianPLong: 0.38,
      bayesianPShort: 0.62,
      evidenceCount: 6,
      weightsMode: 'ADAPTIVE',
      kellyFraction: 0.03,
      expectedValue: 0.39,
      htfTrend: 'downtrend',
      htfAligned: true,
      mtfReason: 'HTF downtrend (aligned SHORT)',
      marketRegime: 'bear',
      regimeScore: 70,
      currentPrice: 42000.00,
      priceChange24h: -3.45,
      volume24h: 25000000000,
      volatilityScore: 18.7,
      entryLow: 41500.00,
      entryHigh: 42500.00,
      stopLoss: 43000.00,
      tp1: 40000.00,
      tp2: 39000.00,
      tp3: 38000.00,
      rr: 1.3,
      trend: 'downtrend',
      bos: 'breakdown',
      whaleBias: 'distribution',
      whaleScore: 68,
      volPhase: 'high_expansion',
      mcProbUp: 35,
      subScores: [
        { label: 'Market Structure', score: 40, weight: 0.1939 },
        { label: 'BOS / CHoCH', score: 60, weight: 0.1218 },
        { label: 'Liquidity', score: 45, weight: 0.1218 },
        { label: 'Supply/Demand', score: 55, weight: 0.1218 },
        { label: 'Volume Profile', score: 60, weight: 0.1218 },
        { label: 'Order Flow', score: 65, weight: 0.1218 },
        { label: 'Whale Activity', score: 68, weight: 0.1218 },
        { label: 'Volatility', score: 19, weight: 0.1218 },
        { label: 'Monte Carlo', score: 35, weight: 0.1218 },
        { label: 'Technical', score: 55, weight: 0.1218 }
      ]
    }
  ];
}

// Main hook for real-time Signal Bot data
export function useSignalBotRealTime() {
  return useQuery({
    queryKey: ['signalBotRealTime'],
    queryFn: fetchSignalsFromScanner,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  });
}

// Hook for signal statistics
export function useSignalStats() {
  return useQuery({
    queryKey: ['signalStats'],
    queryFn: async () => {
      const signals = await fetchSignalsFromScanner();
      const longSignals = signals.filter(s => s.signal === 'LONG').length;
      const shortSignals = signals.filter(s => s.signal === 'SHORT').length;
      const neutralSignals = signals.filter(s => s.signal === 'NEUTRAL').length;
      
      const avgConfidence = signals.length > 0 
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
        : 0;

      return {
        totalSignals: signals.length,
        longSignals,
        shortSignals,
        neutralSignals,
        avgConfidence: Math.round(avgConfidence),
        lastUpdate: new Date().toISOString()
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// Hook for high confidence signals only
export function useHighConfidenceSignals() {
  return useQuery({
    queryKey: ['highConfidenceSignals'],
    queryFn: async () => {
      const signals = await fetchSignalsFromScanner();
      return signals.filter(signal => signal.confidence > 80);
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// Hook for HTF aligned signals only
export function useHTFAlignedSignals() {
  return useQuery({
    queryKey: ['htfAlignedSignals'],
    queryFn: async () => {
      const signals = await fetchSignalsFromScanner();
      return signals.filter(signal => signal.htfAligned);
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}