/**
 * Strategy Engine
 * Orchestrates all engines and provides strategy-level decisions
 * Combines multiple timeframes and signals for robust trading decisions
 */

import type { Candle, DashboardData, HollowcatAnalysis, AlertConfig } from './types';
import { DashboardEngine } from './dashboard-engine';
import { BacktestEngine } from './backtest-engine';
import { AlertEngine } from './alert-engine';

export const StrategyEngine = {
  /**
   * Run complete Hollowcat analysis
   */
  analyze(
    candles: Candle[],
    symbol: string = 'BTC/USDT',
    timeframe: string = '1h',
    alertConfigs: AlertConfig[] = [],
    runBacktest: boolean = false
  ): HollowcatAnalysis {
    return DashboardEngine.generateFullAnalysis(candles, symbol, timeframe, alertConfigs, runBacktest);
  },

  /**
   * Multi-timeframe analysis
   */
  multiTimeframe(
    candles1h: Candle[],
    candles4h: Candle[],
    candles1d: Candle[]
  ): {
    h1: DashboardData;
    h4: DashboardData;
    d1: DashboardData;
    alignment: string;
    finalSignal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
  } {
    const h1 = DashboardEngine.generate(candles1h, 'BTC/USDT', '1h');
    const h4 = DashboardEngine.generate(candles4h, 'BTC/USDT', '4h');
    const d1 = DashboardEngine.generate(candles1d, 'BTC/USDT', '1d');

    // Check alignment across timeframes
    const longSignals = [
      h1.probability.longProbability > 55,
      h4.probability.longProbability > 55,
      d1.probability.longProbability > 55,
    ].filter(Boolean).length;

    const shortSignals = [
      h1.probability.shortProbability > 55,
      h4.probability.shortProbability > 55,
      d1.probability.shortProbability > 55,
    ].filter(Boolean).length;

    let alignment: string;
    let finalSignal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';

    if (longSignals >= 2 && longSignals > shortSignals) {
      alignment = 'BULLISH_ALIGNMENT';
      finalSignal = 'LONG';
    } else if (shortSignals >= 2 && shortSignals > longSignals) {
      alignment = 'BEARISH_ALIGNMENT';
      finalSignal = 'SHORT';
    } else if (longSignals === shortSignals) {
      alignment = 'NEUTRAL_ALIGNMENT';
      finalSignal = 'NO_TRADE';
    } else {
      alignment = 'MIXED_SIGNALS';
      finalSignal = 'WAIT';
    }

    return {
      h1,
      h4,
      d1,
      alignment,
      finalSignal,
    };
  },

  /**
   * Get strategy summary for dashboard
   */
  getSummary(analysis: HollowcatAnalysis): Record<string, any> {
    const d = analysis.dashboard;

    return {
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      analyzedAt: analysis.analyzedAt,
      signal: analysis.dashboard.entry.signal,
      confidence: d.probability.confidenceScore,
      longProb: d.probability.longProbability,
      shortProb: d.probability.shortProbability,
      rating: d.quality.rating,
      expectedRR: d.risk.expectedRR,
      riskPercent: d.risk.riskPercent,
      trend: d.trend.direction,
      regime: d.marketRegime,
      candleColor: d.candleColor,
      backtest: analysis.backtest ? {
        winRate: analysis.backtest.winRate,
        profitFactor: analysis.backtest.profitFactor,
        totalTrades: analysis.backtest.totalTrades,
        totalPnL: analysis.backtest.totalPnL,
      } : null,
      alertsTriggered: analysis.alerts.filter(a => a.triggered).length,
    };
  },
};
