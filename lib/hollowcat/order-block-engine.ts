/**
 * Order Block Engine
 * Detects Bullish and Bearish Order Blocks
 * Tracks mitigation and invalidation
 */

import type { Candle, OrderBlock, OrderBlockResult } from './types';

export const OrderBlockEngine = {
  /**
   * Main order block analysis
   */
  analyze(candles: Candle[]): OrderBlockResult {
    if (candles.length < 10) {
      return {
        orderBlocks: [],
        activeOBs: [],
        explanation: 'Need at least 10 candles for order block detection',
      };
    }

    const orderBlocks = this.detectOrderBlocks(candles);
    this.updateOBStates(orderBlocks, candles);
    const activeOBs = orderBlocks.filter(ob => ob.state === 'ACTIVE');

    const explanation = this.buildExplanation(orderBlocks, activeOBs);

    return {
      orderBlocks,
      activeOBs,
      explanation,
    };
  },

  /**
   * Detect order blocks from swing points
   * Bullish OB: last bearish candle before a bullish move
   * Bearish OB: last bullish candle before a bearish move
   */
  detectOrderBlocks(candles: Candle[]): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - 1; i++) {
      // Bullish Order Block: bearish candle followed by bullish breakout
      const prevCandle = candles[i];
      const nextCandle = candles[i + 1];

      // Bullish OB: bearish candle (close < open) followed by bullish close above high
      if (prevCandle.close < prevCandle.open) {
        // Check if next candle breaks above the OB high
        const obHigh = prevCandle.high;
        const obLow = prevCandle.low;
        const zoneHeight = obHigh - obLow;

        if (nextCandle.close > obHigh && zoneHeight > 0) {
          const strength = this._calcOBStrength(prevCandle, nextCandle, zoneHeight);
          orderBlocks.push({
            type: 'BULLISH_OB',
            idx: i,
            time: prevCandle.time,
            zoneTop: obHigh,
            zoneBottom: obLow,
            zoneHeight,
            strength,
            state: 'ACTIVE',
            explanation: `Bullish OB at ${prevCandle.time}: zone ${obLow.toFixed(4)}-${obHigh.toFixed(4)}, strength ${strength.toFixed(0)}%`,
          });
        }
      }

      // Bearish Order Block: bullish candle (close > open) followed by bearish breakdown
      if (prevCandle.close > prevCandle.open) {
        const obHigh = prevCandle.high;
        const obLow = prevCandle.low;
        const zoneHeight = obHigh - obLow;

        if (nextCandle.close < obLow && zoneHeight > 0) {
          const strength = this._calcOBStrength(prevCandle, nextCandle, zoneHeight);
          orderBlocks.push({
            type: 'BEARISH_OB',
            idx: i,
            time: prevCandle.time,
            zoneTop: obHigh,
            zoneBottom: obLow,
            zoneHeight,
            strength,
            state: 'ACTIVE',
            explanation: `Bearish OB at ${prevCandle.time}: zone ${obLow.toFixed(4)}-${obHigh.toFixed(4)}, strength ${strength.toFixed(0)}%`,
          });
        }
      }
    }

    return orderBlocks;
  },

  /**
   * Calculate order block strength based on candle properties
   */
  _calcOBStrength(prevCandle: Candle, nextCandle: Candle, zoneHeight: number): number {
    // Factors: body size relative to zone, volume, breakout size
    const bodySize = Math.abs(prevCandle.close - prevCandle.open);
    const bodyRatio = bodySize / (zoneHeight || 0.0001);
    const breakoutSize = Math.abs(nextCandle.close - prevCandle.high);
    const breakoutRatio = breakoutSize / (zoneHeight || 0.0001);

    // Higher body ratio and breakout ratio = stronger OB
    const strength = Math.min(100, Math.round(
      (bodyRatio * 30) +
      (Math.min(1, breakoutRatio) * 40) +
      (Math.min(1, (prevCandle.volume || 0) / 1000000) * 30)
    ));

    return strength;
  },

  /**
   * Update order block states based on price action
   */
  updateOBStates(orderBlocks: OrderBlock[], candles: Candle[]): void {
    const lastClose = candles[candles.length - 1].close;

    for (const ob of orderBlocks) {
      if (ob.state !== 'ACTIVE') continue;

      if (ob.type === 'BULLISH_OB') {
        // Bullish OB is mitigated when price closes below the zone bottom
        if (lastClose < ob.zoneBottom) {
          ob.state = 'MITIGATED';
          ob.mitigatedAt = candles[candles.length - 1].time;
        }
      } else {
        // Bearish OB is mitigated when price closes above the zone top
        if (lastClose > ob.zoneTop) {
          ob.state = 'MITIGATED';
          ob.mitigatedAt = candles[candles.length - 1].time;
        }
      }

      // Check for invalidation (opposite side break)
      if (ob.type === 'BULLISH_OB' && lastClose > ob.zoneTop) {
        ob.state = 'INVALID';
      }
      if (ob.type === 'BEARISH_OB' && lastClose < ob.zoneBottom) {
        ob.state = 'INVALID';
      }
    }
  },

  /**
   * Build explanation string
   */
  buildExplanation(orderBlocks: OrderBlock[], activeOBs: OrderBlock[]): string {
    const parts: string[] = [];
    parts.push(`Order Block Analysis: ${orderBlocks.length} OBs detected`);
    parts.push(`Active OBs: ${activeOBs.length}`);

    const bullishOBs = orderBlocks.filter(ob => ob.type === 'BULLISH_OB' && ob.state === 'ACTIVE');
    const bearishOBs = orderBlocks.filter(ob => ob.type === 'BEARISH_OB' && ob.state === 'ACTIVE');

    parts.push(`Active Bullish OBs: ${bullishOBs.length}`);
    parts.push(`Active Bearish OBs: ${bearishOBs.length}`);

    if (activeOBs.length > 0) {
      const strongest = activeOBs.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Active OB: ${strongest.type} at ${strongest.zoneBottom.toFixed(4)}-${strongest.zoneTop.toFixed(4)} (strength: ${strongest.strength}%)`);
    }

    return parts.join(' | ');
  },
};
