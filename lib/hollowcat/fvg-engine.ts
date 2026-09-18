/**
 * FVG Engine - Fair Value Gap Detection
 * Detects Bullish and Bearish FVGs with state tracking
 * States: Fresh, Partially Filled, Filled, Invalid
 */

import type { Candle, FVGZone, FVGResult } from './types';

export const FVGEngine = {
  /**
   * Main FVG analysis
   */
  analyze(candles: Candle[], minGapMultiplier: number = 0.5): FVGResult {
    if (candles.length < 5) {
      return {
        zones: [],
        freshBullish: [],
        freshBearish: [],
        explanation: 'Need at least 5 candles for FVG detection',
      };
    }

    const zones = this.detectFVG(candles, minGapMultiplier);
    this.updateFVGStates(zones, candles);
    this.removeInvalidZones(zones, candles);

    const freshBullish = zones.filter(z => z.type === 'bullish' && z.state === 'FRESH');
    const freshBearish = zones.filter(z => z.type === 'bearish' && z.state === 'FRESH');

    const explanation = this.buildExplanation(zones, freshBullish, freshBearish);

    return {
      zones,
      freshBullish,
      freshBearish,
      explanation,
    };
  },

  /**
   * Detect Fair Value Gaps
   * Bullish FVG: gap between prev high and next low
   * Bearish FVG: gap between next high and prev low
   */
  detectFVG(candles: Candle[], minGapMultiplier: number): FVGZone[] {
    const zones: FVGZone[] = [];
    const atr = this._calcATR(candles.slice(0, Math.min(14, candles.length)));

    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const next = candles[i + 1];

      // Bullish FVG: gap between prev high and next low
      const bullishGap = next.low - prev.high;
      if (bullishGap >= atr * minGapMultiplier) {
        zones.push({
          type: 'bullish',
          bottom: prev.high,
          top: next.low,
          gapSize: bullishGap,
          strength: bullishGap / atr,
          candleIdx: i,
          time: curr.time,
          state: 'FRESH',
          fillPercentage: 0,
          explanation: `Bullish FVG detected at ${curr.time}: gap of ${bullishGap.toFixed(4)} (${(bullishGap / atr).toFixed(1)}x ATR)`,
        });
      }

      // Bearish FVG: gap between next high and prev low
      const bearishGap = prev.low - next.high;
      if (bearishGap >= atr * minGapMultiplier) {
        zones.push({
          type: 'bearish',
          bottom: next.high,
          top: prev.low,
          gapSize: bearishGap,
          strength: bearishGap / atr,
          candleIdx: i,
          time: curr.time,
          state: 'FRESH',
          fillPercentage: 0,
          explanation: `Bearish FVG detected at ${curr.time}: gap of ${bearishGap.toFixed(4)} (${(bearishGap / atr).toFixed(1)}x ATR)`,
        });
      }
    }

    return zones;
  },

  /**
   * Update FVG states based on price action
   */
  updateFVGStates(zones: FVGZone[], candles: Candle[]): void {
    for (const zone of zones) {
      for (let i = zone.candleIdx + 1; i < candles.length; i++) {
        const c = candles[i];

        if (zone.state === 'FILLED') break;

        if (zone.type === 'bullish') {
          // Bullish FVG is filled when price closes below the bottom
          if (c.close <= zone.bottom) {
            const fillProgress = (zone.top - c.close) / zone.gapSize;
            zone.fillPercentage = Math.min(100, Math.max(0, fillProgress * 100));
            if (c.close < zone.bottom) {
              zone.state = 'FILLED';
              zone.filledAt = c.time;
            } else {
              zone.state = 'PARTIALLY_FILLED';
            }
          }
        } else {
          // Bearish FVG is filled when price closes above the top
          if (c.close >= zone.top) {
            const fillProgress = (c.close - zone.bottom) / zone.gapSize;
            zone.fillPercentage = Math.min(100, Math.max(0, fillProgress * 100));
            if (c.close > zone.top) {
              zone.state = 'FILLED';
              zone.filledAt = c.time;
            } else {
              zone.state = 'PARTIALLY_FILLED';
            }
          }
        }
      }
    }
  },

  /**
   * Remove invalid FVG zones (too small, already filled, or conflicting)
   */
  removeInvalidZones(zones: FVGZone[], candles: Candle[]): void {
    const lastClose = candles[candles.length - 1].close;

    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];

      // Remove zones that are already filled
      if (zone.state === 'FILLED') {
        zones.splice(i, 1);
        continue;
      }

      // Remove zones that are too small (less than 0.3x ATR)
      const atr = this._calcATR(candles.slice(-14));
      if (zone.gapSize < atr * 0.3) {
        zones.splice(i, 1);
        continue;
      }

      // Remove bearish FVGs that are above current price (irrelevant for longs)
      if (zone.type === 'bearish' && lastClose > zone.top) {
        zones.splice(i, 1);
        continue;
      }

      // Remove bullish FVGs that are below current price (irrelevant for shorts)
      if (zone.type === 'bullish' && lastClose < zone.bottom) {
        zones.splice(i, 1);
        continue;
      }
    }
  },

  /**
   * Calculate ATR for FVG detection
   */
  _calcATR(candles: Candle[]): number {
    if (candles.length < 2) return 1;
    let sum = 0;
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    return sum / (candles.length - 1) || 1;
  },

  /**
   * Build explanation string
   */
  buildExplanation(zones: FVGZone[], freshBullish: FVGZone[], freshBearish: FVGZone[]): string {
    const parts: string[] = [];
    parts.push(`FVG Analysis: ${zones.length} zones detected`);
    parts.push(`Fresh Bullish FVGs: ${freshBullish.length}`);
    parts.push(`Fresh Bearish FVGs: ${freshBearish.length}`);

    if (freshBullish.length > 0) {
      const strongest = freshBullish.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Bullish FVG: ${strongest.gapSize.toFixed(4)} at ${strongest.time}`);
    }

    if (freshBearish.length > 0) {
      const strongest = freshBearish.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Bearish FVG: ${strongest.gapSize.toFixed(4)} at ${strongest.time}`);
    }

    return parts.join(' | ');
  },
};
