/**
 * Manipulation Engine
 * Detects Market Maker manipulation patterns to filter out fake signals
 * 
 * Key Patterns Detected:
 * 1. Liquidity Sweep Fakeout - Stop hunt without follow-through
 * 2. False Breakout (Fakeout) - BOS that immediately reverses
 * 3. Volume Anomaly - Spikes without sustained direction
 * 4. Wick Rejection - Long wicks showing lack of conviction
 * 5. Order Block Sweep - Price sweeps OB then reverses
 * 6. FVG Manipulation - Gap filled then reversed
 * 7. Time-based Manipulation - Low liquidity period traps
 */

import type { Candle, ManipulationResult, ManipulationSignal, SwingPoint, BOSEvent, FVGZone, OrderBlock, LiquidityLevel } from './types';
import { MarketStructureEngine } from './market-structure-engine';
import { FVGEngine } from './fvg-engine';
import { OrderBlockEngine } from './order-block-engine';
import { LiquidityEngine } from './liquidity-engine';
import { VolumeEngine } from './volume-engine';

export const ManipulationEngine = {
  /**
   * Main manipulation analysis
   * Returns manipulation risk score and filtered signal recommendation
   */
  analyze(
    candles: Candle[],
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE',
    bosEvents: BOSEvent[],
    fvgZones: FVGZone[],
    orderBlocks: OrderBlock[],
    liquidityLevels: LiquidityLevel[],
    volumeResult: { spike: boolean; relativeVolume: number; confirmation: boolean }
  ): ManipulationResult {
    if (candles.length < 20) {
      return this._fallback('Need at least 20 candles for manipulation analysis');
    }

    // Run all detection modules
    const liquiditySweepRisk = this._detectLiquiditySweepFakeout(candles, liquidityLevels, signal);
    const falseBreakoutRisk = this._detectFalseBreakout(candles, bosEvents, signal);
    const volumeAnomalyRisk = this._detectVolumeAnomaly(candles, volumeResult, signal);
    const wickRejectionRisk = this._detectWickRejection(candles, signal);
    const obSweepRisk = this._detectOBSweep(candles, orderBlocks, signal);
    const fvgManipulationRisk = this._detectFVGManipulation(candles, fvgZones, signal);
    const timeBasedRisk = this._detectTimeBasedManipulation(candles);

    // Calculate overall manipulation risk
    const riskFactors = [
      liquiditySweepRisk,
      falseBreakoutRisk,
      volumeAnomalyRisk,
      wickRejectionRisk,
      obSweepRisk,
      fvgManipulationRisk,
      timeBasedRisk,
    ];

    const manipulationScore = this._calcManipulationScore(riskFactors);
    const isManipulated = manipulationScore > 60;
    const confidence = this._calcConfidence(riskFactors);

    // Generate manipulation signals
    const signals = this._generateSignals(riskFactors, manipulationScore);

    // Determine if signal should be filtered
    const filteredSignal = this._filterSignal(signal, manipulationScore, riskFactors);

    const explanation = this.buildExplanation(manipulationScore, confidence, signals, riskFactors);

    return {
      manipulationScore,
      isManipulated,
      confidence,
      signals,
      filteredSignal,
      riskFactors,
      explanation,
    };
  },

  /**
   * Detect liquidity sweep fakeout
   * Market makers sweep liquidity then reverse without follow-through
   */
  _detectLiquiditySweepFakeout(
    candles: Candle[],
    liquidityLevels: LiquidityLevel[],
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  ): ManipulationSignal {
    const recentCandles = candles.slice(-10);
    const lastCandle = candles[candles.length - 1];
    const riskScore = 0;
    const details: string[] = [];

    // Check for recent liquidity sweeps
    const recentSweeps = liquidityLevels.filter(l => 
      l.type === 'LIQUIDITY_SWEEP' || l.type === 'STOP_HUNT'
    );

    for (const sweep of recentSweeps) {
      const sweepIdx = sweep.idx;
      const candlesAfterSweep = candles.slice(sweepIdx + 1);
      
      if (candlesAfterSweep.length < 3) continue;

      // Check if price reversed quickly after sweep (fakeout)
      const sweepPrice = sweep.price;
      const reversalCandle = candlesAfterSweep[0];
      const followThrough = candlesAfterSweep.slice(1, 4);

      let reversed = false;
      if (sweep.type === 'LIQUIDITY_SWEEP' || sweep.label.includes('Buy Side')) {
        // Swept below then reversed up
        reversed = reversalCandle.close > sweepPrice;
      } else {
        // Swept above then reversed down
        reversed = reversalCandle.close < sweepPrice;
      }

      // Check for lack of follow-through
      const hasFollowThrough = followThrough.some(c => {
        if (sweep.type === 'LIQUIDITY_SWEEP' || sweep.label.includes('Buy Side')) {
          return c.close > sweepPrice;
        } else {
          return c.close < sweepPrice;
        }
      });

      if (reversed && !hasFollowThrough) {
        details.push(`Liquidity sweep fakeout at ${sweepPrice.toFixed(4)} - no follow-through`);
        return {
          type: 'LIQUIDITY_SWEEP_FAKEOUT',
          riskScore: 75,
          detected: true,
          details,
          recommendation: 'WAIT',
        };
      }
    }

    return {
      type: 'LIQUIDITY_SWEEP_FAKEOUT',
      riskScore: 0,
      detected: false,
      details: ['No liquidity sweep fakeout detected'],
      recommendation: signal,
    };
  },

  /**
   * Detect false breakout (fakeout)
   * BOS that immediately reverses within 3 candles
   */
  _detectFalseBreakout(
    candles: Candle[],
    bosEvents: BOSEvent[],
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  ): ManipulationSignal {
    const details: string[] = [];
    const recentBOS = bosEvents.filter(b => b.idx >= candles.length - 10);

    for (const bos of recentBOS) {
      const candlesAfterBOS = candles.slice(bos.idx + 1);
      
      if (candlesAfterBOS.length < 3) continue;

      const breakPrice = bos.breakPrice;
      let reversed = false;
      let reversalCandleIdx = -1;

      // Check if price reversed back below/above the break level
      for (let i = 0; i < Math.min(3, candlesAfterBOS.length); i++) {
        const c = candlesAfterBOS[i];
        if (bos.type === 'bullish' && c.close < breakPrice) {
          reversed = true;
          reversalCandleIdx = i;
          break;
        }
        if (bos.type === 'bearish' && c.close > breakPrice) {
          reversed = true;
          reversalCandleIdx = i;
          break;
        }
      }

      if (reversed) {
        details.push(`False breakout at ${breakPrice.toFixed(4)} - reversed in ${reversalCandleIdx + 1} candles`);
        return {
          type: 'FALSE_BREAKOUT',
          riskScore: 80,
          detected: true,
          details,
          recommendation: 'WAIT',
        };
      }
    }

    return {
      type: 'FALSE_BREAKOUT',
      riskScore: 0,
      detected: false,
      details: ['No false breakout detected'],
      recommendation: signal,
    };
  },

  /**
   * Detect volume anomaly
   * Volume spike without sustained directional movement
   */
  _detectVolumeAnomaly(
    candles: Candle[],
    volumeResult: { spike: boolean; relativeVolume: number; confirmation: boolean },
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  ): ManipulationSignal {
    const details: string[] = [];
    const recentCandles = candles.slice(-5);

    if (!volumeResult.spike) {
      return {
        type: 'VOLUME_ANOMALY',
        riskScore: 0,
        detected: false,
        details: ['No volume spike detected'],
        recommendation: signal,
      };
    }

    // Check if volume spike led to sustained movement
    const spikeCandle = recentCandles[recentCandles.length - 1];
    const beforeSpike = candles.slice(-10, -5);
    const afterSpike = recentCandles.slice(0, -1);

    const avgBefore = beforeSpike.reduce((s, c) => s + (c.close - c.open), 0) / beforeSpike.length;
    const avgAfter = afterSpike.reduce((s, c) => s + (c.close - c.open), 0) / afterSpike.length;

    // If volume spiked but average movement is small, it's likely manipulation
    const movementRatio = Math.abs(avgAfter) / (Math.abs(avgBefore) || 0.0001);
    
    if (movementRatio < 0.5 && volumeResult.relativeVolume > 2.0) {
      details.push(`Volume spike (${volumeResult.relativeVolume.toFixed(1)}x) without sustained movement`);
      return {
        type: 'VOLUME_ANOMALY',
        riskScore: 65,
        detected: true,
        details,
        recommendation: 'WAIT',
      };
    }

    return {
      type: 'VOLUME_ANOMALY',
      riskScore: 0,
      detected: false,
      details: ['Volume spike confirmed by price movement'],
      recommendation: signal,
    };
  },

  /**
   * Detect wick rejection
   * Long wicks showing lack of buying/selling pressure
   */
  _detectWickRejection(candles: Candle[], signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'): ManipulationSignal {
    const details: string[] = [];
    const recentCandles = candles.slice(-5);

    for (const candle of recentCandles) {
      const bodySize = Math.abs(candle.close - candle.open);
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const totalRange = candle.high - candle.low;

      if (totalRange === 0) continue;

      const upperWickRatio = upperWick / totalRange;
      const lowerWickRatio = lowerWick / totalRange;

      // For LONG signal, check for bearish wick rejection
      if (signal === 'LONG' && upperWickRatio > 0.6 && bodySize / totalRange < 0.3) {
        details.push(`Bearish wick rejection at ${candle.high.toFixed(4)} - ${(upperWickRatio * 100).toFixed(0)}% upper wick`);
        return {
          type: 'WICK_REJECTION',
          riskScore: 55,
          detected: true,
          details,
          recommendation: 'WAIT',
        };
      }

      // For SHORT signal, check for bullish wick rejection
      if (signal === 'SHORT' && lowerWickRatio > 0.6 && bodySize / totalRange < 0.3) {
        details.push(`Bullish wick rejection at ${candle.low.toFixed(4)} - ${(lowerWickRatio * 100).toFixed(0)}% lower wick`);
        return {
          type: 'WICK_REJECTION',
          riskScore: 55,
          detected: true,
          details,
          recommendation: 'WAIT',
        };
      }
    }

    return {
      type: 'WICK_REJECTION',
      riskScore: 0,
      detected: false,
      details: ['No significant wick rejection detected'],
      recommendation: signal,
    };
  },

  /**
   * Detect order block sweep
   * Price sweeps through OB then reverses
   */
  _detectOBSweep(
    candles: Candle[],
    orderBlocks: OrderBlock[],
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  ): ManipulationSignal {
    const details: string[] = [];
    const recentCandles = candles.slice(-8);

    for (const ob of orderBlocks) {
      if (ob.state !== 'ACTIVE') continue;

      const obTop = ob.zoneTop;
      const obBottom = ob.zoneBottom;

      for (const candle of recentCandles) {
        // Check if price swept through OB
        const sweptThrough = (ob.type === 'BULLISH_OB' && candle.low < obBottom) ||
                            (ob.type === 'BEARISH_OB' && candle.high > obTop);

        if (sweptThrough) {
          // Check if it reversed
          const reversed = (ob.type === 'BULLISH_OB' && candle.close > obBottom) ||
                          (ob.type === 'BEARISH_OB' && candle.close < obTop);

          if (reversed) {
            details.push(`OB sweep at ${obBottom.toFixed(4)}-${obTop.toFixed(4)} - potential trap`);
            return {
              type: 'OB_SWEEP',
              riskScore: 60,
              detected: true,
              details,
              recommendation: 'WAIT',
            };
          }
        }
      }
    }

    return {
      type: 'OB_SWEEP',
      riskScore: 0,
      detected: false,
      details: ['No OB sweep detected'],
      recommendation: signal,
    };
  },

  /**
   * Detect FVG manipulation
   * Price fills FVG then reverses direction
   */
  _detectFVGManipulation(
    candles: Candle[],
    fvgZones: FVGZone[],
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  ): ManipulationSignal {
    const details: string[] = [];
    const recentCandles = candles.slice(-8);

    for (const fvg of fvgZones) {
      if (fvg.state === 'FILLED') continue;

      for (const candle of recentCandles) {
        const filledFVG = (fvg.type === 'bullish' && candle.low <= fvg.bottom) ||
                         (fvg.type === 'bearish' && candle.high >= fvg.top);

        if (filledFVG) {
          // Check if price reversed after filling
          const nextCandle = candles[candles.indexOf(candle) + 1];
          if (nextCandle) {
            const reversed = (fvg.type === 'bullish' && nextCandle.close > fvg.bottom) ||
                            (fvg.type === 'bearish' && nextCandle.close < fvg.top);

            if (reversed) {
              details.push(`FVG manipulation at ${fvg.bottom.toFixed(4)}-${fvg.top.toFixed(4)} - filled then reversed`);
              return {
                type: 'FVG_MANIPULATION',
                riskScore: 70,
                detected: true,
                details,
                recommendation: 'WAIT',
              };
            }
          }
        }
      }
    }

    return {
      type: 'FVG_MANIPULATION',
      riskScore: 0,
      detected: false,
      details: ['No FVG manipulation detected'],
      recommendation: signal,
    };
  },

  /**
   * Detect time-based manipulation
   * Low liquidity periods are prone to manipulation
   */
  _detectTimeBasedManipulation(candles: Candle[], signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE' = 'WAIT'): ManipulationSignal {
    const details: string[] = [];
    const lastCandle = candles[candles.length - 1];
    const time = new Date(lastCandle.time);
    const hour = time.getUTCHours();

    // Low liquidity periods (Asian session, lunch hours)
    const lowLiquidityHours = [0, 1, 2, 3, 4, 5, 6, 7, 12, 13];

    if (lowLiquidityHours.includes(hour)) {
      details.push(`Low liquidity period (${hour}:00 UTC) - higher manipulation risk`);
      return {
        type: 'TIME_BASED_MANIPULATION',
        riskScore: 40,
        detected: true,
        details,
        recommendation: 'WAIT',
      };
    }

    return {
      type: 'TIME_BASED_MANIPULATION',
      riskScore: 0,
      detected: false,
      details: ['Normal liquidity period'],
      recommendation: 'WAIT',
    };
  },

  /**
   * Calculate overall manipulation score
   */
  _calcManipulationScore(riskFactors: ManipulationSignal[]): number {
    const totalRisk = riskFactors.reduce((sum, factor) => sum + factor.riskScore, 0);
    const detectedCount = riskFactors.filter(f => f.detected).length;
    
    // Weight by number of detected factors
    const weightedScore = totalRisk / riskFactors.length;
    const detectionBonus = detectedCount * 5;
    
    return Math.min(100, Math.round(weightedScore + detectionBonus));
  },

  /**
   * Calculate confidence in manipulation detection
   */
  _calcConfidence(riskFactors: ManipulationSignal[]): number {
    const detectedFactors = riskFactors.filter(f => f.detected);
    if (detectedFactors.length === 0) return 0;
    
    const avgRisk = detectedFactors.reduce((s, f) => s + f.riskScore, 0) / detectedFactors.length;
    const countBonus = Math.min(20, detectedFactors.length * 5);
    
    return Math.min(100, Math.round(avgRisk + countBonus));
  },

  /**
   * Generate manipulation signals
   */
  _generateSignals(riskFactors: ManipulationSignal[], manipulationScore: number): ManipulationSignal[] {
    return riskFactors.filter(f => f.detected && f.riskScore > 30);
  },

  /**
   * Filter signal based on manipulation risk
   */
  _filterSignal(
    signal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE',
    manipulationScore: number,
    riskFactors: ManipulationSignal[]
  ): 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE' {
    if (manipulationScore > 70) {
      return 'WAIT';
    }

    if (manipulationScore > 50) {
      // Check if any high-risk factor is present
      const highRiskFactors = riskFactors.filter(f => f.riskScore > 60);
      if (highRiskFactors.length > 0) {
        return 'WAIT';
      }
    }

    return signal;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    manipulationScore: number,
    confidence: number,
    signals: ManipulationSignal[],
    riskFactors: ManipulationSignal[]
  ): string {
    const parts: string[] = [];
    parts.push(`Manipulation Analysis:`);
    parts.push(`Manipulation Score: ${manipulationScore}/100`);
    parts.push(`Detection Confidence: ${confidence}%`);
    parts.push(`Risk Factors: ${riskFactors.filter(f => f.detected).length}/${riskFactors.length}`);

    if (signals.length > 0) {
      parts.push(`Warnings: ${signals.map(s => s.type).join(', ')}`);
    }

    if (manipulationScore > 70) {
      parts.push('HIGH MANIPULATION RISK - Signal filtered');
    } else if (manipulationScore > 50) {
      parts.push('MODERATE MANIPULATION RISK - Proceed with caution');
    } else {
      parts.push('LOW MANIPULATION RISK - Signal appears valid');
    }

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(reason: string): ManipulationResult {
    return {
      manipulationScore: 0,
      isManipulated: false,
      confidence: 0,
      signals: [],
      filteredSignal: 'WAIT',
      riskFactors: [],
      explanation: reason,
    };
  },
};
