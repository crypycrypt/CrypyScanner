/**
 * Dashboard Engine
 * Aggregates all engine results into a unified dashboard data structure
 * Provides the floating dashboard with all indicators
 * Includes market maker manipulation detection
 */

import type { Candle, DashboardData, HollowcatAnalysis, AlertConfig, RSIDivergenceResult } from './types';
import { TrendEngine } from './trend-engine';
import { MarketStructureEngine } from './market-structure-engine';
import { FVGEngine } from './fvg-engine';
import { OrderBlockEngine } from './order-block-engine';
import { LiquidityEngine } from './liquidity-engine';
import { VolumeEngine } from './volume-engine';
import { RegressionEngine } from './regression-engine';
import { ProbabilityEngine } from './probability-engine';
import { RiskEngine } from './risk-engine';
import { QualityEngine } from './quality-engine';
import { EntryEngine } from './entry-engine';
import { BacktestEngine } from './backtest-engine';
import { AlertEngine } from './alert-engine';
import { RSIDivergenceEngine } from './rsi-divergence-engine';
import { ManipulationEngine } from './manipulation-engine';

export const DashboardEngine = {
  /**
   * Generate complete dashboard data
   */
  generate(candles: Candle[], symbol: string = 'BTC/USDT', timeframe: string = '1h', alertConfigs: AlertConfig[] = []): DashboardData {
    // Run all engines
    const trend = TrendEngine.analyze(candles);
    const marketStructure = MarketStructureEngine.analyze(candles);
    const fvg = FVGEngine.analyze(candles);
    const orderBlocks = OrderBlockEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const volume = VolumeEngine.analyze(candles);
    const regression = RegressionEngine.analyze(candles);
    const probability = ProbabilityEngine.analyze(candles);
    const risk = RiskEngine.analyze(candles, probability, probability.longProbability > probability.shortProbability ? 'LONG' : 'SHORT');
    const quality = QualityEngine.analyze(
      probability, risk, trend, marketStructure, volume, fvg, orderBlocks, liquidity
    );
    const entry = EntryEngine.analyze(candles, 55);

    // Run manipulation detection
    const manipulation = ManipulationEngine.analyze(
      candles,
      entry.signal,
      marketStructure.bosEvents,
      fvg.zones,
      orderBlocks.orderBlocks,
      liquidity.levels,
      volume
    );

    // Determine candle color based on confidence
    const candleColor = this._getCandleColor(probability);

    // Determine market regime
    const marketRegime = this._determineRegime(trend, volume, probability);

    return {
      trend,
      marketStructure,
      fvg,
      bos: marketStructure.bosEvents,
      choch: marketStructure.chochEvents,
      liquidity,
      volume,
      regression,
      probability,
      risk,
      quality,
      manipulation,
      entry,
      marketRegime,
      candleColor,
    };
  },

  /**
   * Generate full analysis with backtest, alerts, and RSI divergence
   */
  generateFullAnalysis(
    candles: Candle[],
    symbol: string = 'BTC/USDT',
    timeframe: string = '1h',
    alertConfigs: AlertConfig[] = [],
    runBacktest: boolean = false
  ): HollowcatAnalysis {
    const dashboard = this.generate(candles, symbol, timeframe, alertConfigs);

    // Run RSI divergence analysis
    const rsiDivergence = RSIDivergenceEngine.analyze(candles);

    // Run backtest if requested
    let backtest;
    if (runBacktest && candles.length >= 100) {
      backtest = BacktestEngine.run(candles, 50);
    }

    // Check alerts
    const alerts = AlertEngine.checkAlerts(candles, alertConfigs);

    return {
      symbol,
      timeframe,
      analyzedAt: new Date().toISOString(),
      dashboard,
      rsiDivergence,
      backtest,
      alerts,
    };
  },

  /**
   * Determine candle color based on probability confidence
   */
  _getCandleColor(probability: { longProbability: number; shortProbability: number; confidenceScore: number }): 'DARK_GREEN' | 'LIGHT_GREEN' | 'GRAY' | 'ORANGE' | 'RED' {
    const diff = probability.longProbability - probability.shortProbability;
    const confidence = probability.confidenceScore;

    if (confidence < 30) return 'GRAY';

    if (diff > 20) {
      // Strong LONG
      if (confidence > 80) return 'DARK_GREEN';
      return 'LIGHT_GREEN';
    }

    if (diff < -20) {
      // Strong SHORT
      if (confidence > 80) return 'RED';
      return 'ORANGE';
    }

    // Neutral or weak signal
    if (confidence > 60) return 'LIGHT_GREEN';
    return 'GRAY';
  },

  /**
   * Determine market regime
   */
  _determineRegime(
    trend: { direction: string; strength: number },
    volume: { spike: boolean; relativeVolume: number },
    probability: { longProbability: number; shortProbability: number }
  ): 'TRENDING' | 'SIDEWAYS' | 'EXPANSION' | 'COMPRESSION' | 'ACCUMULATION' | 'DISTRIBUTION' {
    const diff = Math.abs(probability.longProbability - probability.shortProbability);

    // Trending: strong directional bias
    if (trend.strength > 60 && diff > 30) return 'TRENDING';

    // Expansion: high volume with trending
    if (volume.spike && trend.strength > 50) return 'EXPANSION';

    // Compression: low volume, low volatility
    if (!volume.spike && trend.strength < 30) return 'COMPRESSION';

    // Accumulation: bullish bias with low volume
    if (probability.longProbability > 55 && !volume.spike) return 'ACCUMULATION';

    // Distribution: bearish bias with high volume
    if (probability.shortProbability > 55 && volume.spike) return 'DISTRIBUTION';

    // Default: sideways
    return 'SIDEWAYS';
  },
};
