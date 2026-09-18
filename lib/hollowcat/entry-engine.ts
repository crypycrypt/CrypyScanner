/**
 * Entry Engine
 * Determines when to enter a trade based on multiple confirmations
 * Entry only when: Trend confirmed, BOS confirmed, Liquidity confirmed,
 * Fresh FVG available, Volume confirmation, Minimum probability above threshold,
 * NO market maker manipulation detected
 * Otherwise: WAIT or NO TRADE
 */

import type {
  Candle, EntryResult, EntrySignal, ProbabilityResult, RiskResult, TradeQualityResult,
  TrendResult, MarketStructureResult, VolumeResult, FVGResult, OrderBlockResult, LiquidityResult,
  ManipulationResult,
} from './types';
import { TrendEngine } from './trend-engine';
import { MarketStructureEngine } from './market-structure-engine';
import { FVGEngine } from './fvg-engine';
import { OrderBlockEngine } from './order-block-engine';
import { LiquidityEngine } from './liquidity-engine';
import { VolumeEngine } from './volume-engine';
import { ProbabilityEngine } from './probability-engine';
import { RiskEngine } from './risk-engine';
import { QualityEngine } from './quality-engine';
import { ManipulationEngine } from './manipulation-engine';

// Re-export types for convenience
export type { Candle, EntryResult, EntrySignal, ProbabilityResult, RiskResult, TradeQualityResult };

export const EntryEngine = {
  /**
   * Main entry signal determination with anti-manipulation filters
   */
  analyze(candles: Candle[], minProbability: number = 60): EntryResult {
    if (candles.length < 20) {
      return this._fallback('Need at least 20 candles for entry analysis');
    }

    // Run all sub-engines
    const trend = TrendEngine.analyze(candles);
    const structure = MarketStructureEngine.analyze(candles);
    const fvg = FVGEngine.analyze(candles);
    const orderBlocks = OrderBlockEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const volume = VolumeEngine.analyze(candles);
    const preliminaryProbability = ProbabilityEngine.analyze(candles);
    
    // Determine preliminary entry signal
    const preliminarySignal = this._determineSignal(
      preliminaryProbability, trend, structure, volume, fvg, orderBlocks, liquidity, minProbability
    );

    // Run manipulation detection
    const manipulation = ManipulationEngine.analyze(
      candles,
      preliminarySignal,
      structure.bosEvents,
      fvg.zones,
      orderBlocks.orderBlocks,
      liquidity.levels,
      volume
    );

    // Re-run probability with manipulation penalty
    const probability = ProbabilityEngine.analyze(candles, manipulation);
    const risk = RiskEngine.analyze(candles, probability, probability.longProbability > probability.shortProbability ? 'LONG' : 'SHORT');
    const quality = QualityEngine.analyze(probability, risk, trend, structure, volume, fvg, orderBlocks, liquidity, manipulation);

    // Final signal after manipulation filter
    const signal = manipulation.filteredSignal;

    // Build reasons
    const reasons = this._buildReasons(signal, probability, trend, structure, volume, fvg, orderBlocks, liquidity, manipulation);

    const explanation = this.buildExplanation(signal, probability, risk, quality, reasons, manipulation);

    return {
      signal,
      probability,
      risk,
      quality,
      manipulation,
      entryPrice: signal === 'LONG' || signal === 'SHORT' ? candles[candles.length - 1].close : 0,
      explanation,
      reasons,
    };
  },

  /**
   * Determine entry signal based on all confirmations
   */
  _determineSignal(
    probability: ProbabilityResult,
    trend: TrendResult,
    structure: MarketStructureResult,
    volume: VolumeResult,
    fvg: FVGResult,
    orderBlocks: OrderBlockResult,
    liquidity: LiquidityResult,
    minProbability: number
  ): EntrySignal {
    const longProb = probability.longProbability;
    const shortProb = probability.shortProbability;

    // Check minimum probability threshold
    const maxProb = Math.max(longProb, shortProb);
    if (maxProb < minProbability) {
      return 'WAIT';
    }

    // Check trend confirmation
    const trendConfirmed = trend.strength > 40;
    if (!trendConfirmed) {
      return 'WAIT';
    }

    // Check BOS confirmation
    const bosConfirmed = structure.bosEvents.length > 0;
    if (!bosConfirmed) {
      return 'WAIT';
    }

    // Check liquidity confirmation
    const liquidityConfirmed = liquidity.levels.length > 0;
    if (!liquidityConfirmed) {
      return 'WAIT';
    }

    // Check fresh FVG availability
    const fvgAvailable = fvg.freshBullish.length > 0 || fvg.freshBearish.length > 0;
    if (!fvgAvailable) {
      return 'WAIT';
    }

    // Check volume confirmation
    const volumeConfirmed = volume.confirmation;
    if (!volumeConfirmed) {
      return 'WAIT';
    }

    // Determine direction
    if (longProb > shortProb + 10) {
      return 'LONG';
    }
    if (shortProb > longProb + 10) {
      return 'SHORT';
    }

    // Probabilities too close
    return 'NO_TRADE';
  },

  /**
   * Build list of reasons for the signal
   */
  _buildReasons(
    signal: EntrySignal,
    probability: ProbabilityResult,
    trend: TrendResult,
    structure: MarketStructureResult,
    volume: VolumeResult,
    fvg: FVGResult,
    orderBlocks: OrderBlockResult,
    liquidity: LiquidityResult,
    manipulation: ManipulationResult
  ): string[] {
    const reasons: string[] = [];

    if (signal === 'LONG' || signal === 'SHORT') {
      reasons.push(`✓ Signal: ${signal} at ${probability.confidenceScore}% confidence`);
      reasons.push(`✓ Trend: ${trend.direction} (strength: ${trend.strength}/100)`);
      reasons.push(`✓ BOS confirmed: ${structure.bosEvents.length} events detected`);
      reasons.push(`✓ Volume confirmation: ${volume.confirmation ? 'YES' : 'NO'} (${volume.relativeVolume.toFixed(1)}x avg)`);

      if (fvg.freshBullish.length > 0 && signal === 'LONG') {
        reasons.push(`✓ Fresh Bullish FVG available`);
      }
      if (fvg.freshBearish.length > 0 && signal === 'SHORT') {
        reasons.push(`✓ Fresh Bearish FVG available`);
      }

      if (orderBlocks.activeOBs.length > 0) {
        reasons.push(`✓ Active Order Block present`);
      }

      if (liquidity.levels.length > 0) {
        reasons.push(`✓ Liquidity levels detected (${liquidity.levels.length} zones)`);
      }

      reasons.push(`Probability: LONG ${probability.longProbability}% / SHORT ${probability.shortProbability}%`);
      
      // Manipulation check
      if (manipulation.manipulationScore < 30) {
        reasons.push(`✓ Anti-manipulation: CLEAN (score: ${manipulation.manipulationScore}/100)`);
      } else if (manipulation.manipulationScore < 60) {
        reasons.push(`⚠ Anti-manipulation: CAUTION (score: ${manipulation.manipulationScore}/100)`);
      } else {
        reasons.push(`✗ Anti-manipulation: HIGH RISK (score: ${manipulation.manipulationScore}/100)`);
      }
    } else if (signal === 'WAIT') {
      reasons.push('⏳ WAIT - Conditions not yet met for entry');
      if (probability.confidenceScore < 60) {
        reasons.push(`- Confidence too low (${probability.confidenceScore}%)`);
      }
      if (trend.strength <= 40) {
        reasons.push(`- Trend not confirmed (strength: ${trend.strength}/100)`);
      }
      if (structure.bosEvents.length === 0) {
        reasons.push(`- No BOS detected`);
      }
      if (!volume.confirmation) {
        reasons.push(`- Volume confirmation missing`);
      }
      if (manipulation.manipulationScore > 50) {
        reasons.push(`- Manipulation risk too high (${manipulation.manipulationScore}/100)`);
      }
    } else {
      reasons.push('🚫 NO TRADE - Probabilities too close, no clear edge');
    }

    return reasons;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    signal: EntrySignal,
    probability: ProbabilityResult,
    risk: RiskResult,
    quality: TradeQualityResult,
    reasons: string[],
    manipulation: ManipulationResult
  ): string {
    const parts: string[] = [];
    parts.push(`Entry Engine Analysis:`);
    parts.push(`Signal: ${signal}`);
    parts.push(`Confidence: ${probability.confidenceScore}%`);
    parts.push(`Trade Rating: ${quality.rating}`);
    parts.push(`Expected RR: ${risk.expectedRR.toFixed(2)}`);
    parts.push(`Risk: ${risk.riskPercent.toFixed(2)}%`);
    parts.push(`Manipulation Score: ${manipulation.manipulationScore}/100`);

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(reason: string): EntryResult {
    return {
      signal: 'WAIT',
      probability: { longProbability: 50, shortProbability: 50, confidenceScore: 0, scores: { trend: 50, volume: 50, liquidity: 50, structure: 50, regression: 50, fvg: 50, orderBlock: 50, momentum: 50, atr: 50, vwap: 50 }, explanation: reason },
      risk: { entry: 0, stopLoss: 0, tp1: 0, tp2: 0, tp3: 0, expectedRR: 0, riskPercent: 0, positionSize: 0, explanation: reason },
      quality: { rating: 'D', score: 0, factors: {}, explanation: reason },
      manipulation: { manipulationScore: 0, isManipulated: false, confidence: 0, signals: [], filteredSignal: 'WAIT', riskFactors: [], explanation: reason },
      entryPrice: 0,
      explanation: reason,
      reasons: [reason],
    };
  },
};
