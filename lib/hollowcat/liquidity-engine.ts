/**
 * Liquidity Engine
 * Detects Buy Side Liquidity, Sell Side Liquidity
 * Liquidity Sweep, Liquidity Grab, Stop Hunt
 */

import type { Candle, LiquidityLevel, LiquidityResult } from './types';

export const LiquidityEngine = {
  /**
   * Main liquidity analysis
   */
  analyze(candles: Candle[]): LiquidityResult {
    if (candles.length < 10) {
      return {
        levels: [],
        buySideLiquidity: [],
        sellSideLiquidity: [],
        sweeps: [],
        explanation: 'Need at least 10 candles for liquidity analysis',
      };
    }

    const levels = this.detectLiquidity(candles);
    const buySideLiquidity = levels.filter(l => l.type === 'BUY_SIDE_LIQUIDITY');
    const sellSideLiquidity = levels.filter(l => l.type === 'SELL_SIDE_LIQUIDITY');
    const sweeps = levels.filter(l => l.type === 'LIQUIDITY_SWEEP' || l.type === 'STOP_HUNT');

    const explanation = this.buildExplanation(levels, buySideLiquidity, sellSideLiquidity, sweeps);

    return {
      levels,
      buySideLiquidity,
      sellSideLiquidity,
      sweeps,
      explanation,
    };
  },

  /**
   * Detect liquidity levels from swing points and price action
   */
  detectLiquidity(candles: Candle[]): LiquidityLevel[] {
    const levels: LiquidityLevel[] = [];
    const lookback = 10;

    // Find swing lows (buy side liquidity pools)
    for (let i = lookback; i < candles.length - 1; i++) {
      const c = candles[i];
      let isSwingLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].low <= c.low) isSwingLow = false;
        if (candles[i + j] && candles[i + j].low <= c.low) isSwingLow = false;
      }

      if (isSwingLow) {
        // Check if price swept below this low (liquidity grab)
        const swept = this._checkLiquiditySweep(candles, i, 'below');
        const strength = this._calcLiquidityStrength(c, candles, 'buy');

        levels.push({
          type: swept ? 'LIQUIDITY_SWEEP' : 'BUY_SIDE_LIQUIDITY',
          price: c.low,
          idx: i,
          time: c.time,
          strength,
          label: swept ? 'Liquidity Sweep (Buy Side)' : 'Buy Side Liquidity',
          explanation: swept
            ? `Buy side liquidity swept at ${c.low.toFixed(4)} on ${c.time} - stop hunt detected`
            : `Buy side liquidity pool at ${c.low.toFixed(4)} on ${c.time}`,
        });
      }
    }

    // Find swing highs (sell side liquidity pools)
    for (let i = lookback; i < candles.length - 1; i++) {
      const c = candles[i];
      let isSwingHigh = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= c.high) isSwingHigh = false;
        if (candles[i + j] && candles[i + j].high >= c.high) isSwingHigh = false;
      }

      if (isSwingHigh) {
        const swept = this._checkLiquiditySweep(candles, i, 'above');
        const strength = this._calcLiquidityStrength(c, candles, 'sell');

        levels.push({
          type: swept ? 'LIQUIDITY_SWEEP' : 'SELL_SIDE_LIQUIDITY',
          price: c.high,
          idx: i,
          time: c.time,
          strength,
          label: swept ? 'Liquidity Sweep (Sell Side)' : 'Sell Side Liquidity',
          explanation: swept
            ? `Sell side liquidity swept at ${c.high.toFixed(4)} on ${c.time} - stop hunt detected`
            : `Sell side liquidity pool at ${c.high.toFixed(4)} on ${c.time}`,
        });
      }
    }

    // Detect stop hunts (price briefly moves through liquidity then reverses)
    const stopHunts = this._detectStopHunts(candles, levels);
    levels.push(...stopHunts);

    return levels.sort((a, b) => b.strength - a.strength);
  },

  /**
   * Check if price swept through a liquidity level
   */
  _checkLiquiditySweep(candles: Candle[], swingIdx: number, direction: 'above' | 'below'): boolean {
    const swingPrice = direction === 'below'
      ? candles[swingIdx].low
      : candles[swingIdx].high;

    // Check if price went beyond the swing point after it formed
    for (let i = swingIdx + 1; i < Math.min(swingIdx + 10, candles.length); i++) {
      const c = candles[i];
      if (direction === 'below' && c.low < swingPrice) return true;
      if (direction === 'above' && c.high > swingPrice) return true;
    }

    return false;
  },

  /**
   * Calculate liquidity strength based on volume and time since formation
   */
  _calcLiquidityStrength(candle: Candle, candles: Candle[], side: 'buy' | 'sell'): number {
    const volume = candle.volume || 1;
    const avgVolume = candles.slice(-20).reduce((s, c) => s + (c.volume || 0), 0) / 20;
    const volRatio = volume / (avgVolume || 1);

    // More recent and higher volume = stronger liquidity
    const recency = 1 / (candles.length - candle.time.length + 1);
    const strength = Math.min(100, Math.round(volRatio * 20 + recency * 30));

    return strength;
  },

  /**
   * Detect stop hunts - price moves through liquidity then quickly reverses
   */
  _detectStopHunts(candles: Candle[], levels: LiquidityLevel[]): LiquidityLevel[] {
    const stopHunts: LiquidityLevel[] = [];

    for (const level of levels) {
      if (level.type !== 'BUY_SIDE_LIQUIDITY' && level.type !== 'SELL_SIDE_LIQUIDITY') continue;

      const levelIdx = level.idx;
      const levelPrice = level.price;

      // Check for a quick sweep and reversal
      for (let i = levelIdx + 1; i < Math.min(levelIdx + 5, candles.length); i++) {
        const c = candles[i];

        if (level.type === 'BUY_SIDE_LIQUIDITY' && c.low < levelPrice && c.close > levelPrice) {
          // Price swept below buy side liquidity but closed back above - stop hunt
          stopHunts.push({
            type: 'STOP_HUNT',
            price: levelPrice,
            idx: levelIdx,
            time: c.time,
            strength: level.strength + 10,
            label: 'Stop Hunt (Buy Side)',
            explanation: `Stop hunt detected at ${levelPrice.toFixed(4)} on ${c.time} - price swept below then reversed`,
          });
          break;
        }

        if (level.type === 'SELL_SIDE_LIQUIDITY' && c.high > levelPrice && c.close < levelPrice) {
          stopHunts.push({
            type: 'STOP_HUNT',
            price: levelPrice,
            idx: levelIdx,
            time: c.time,
            strength: level.strength + 10,
            label: 'Stop Hunt (Sell Side)',
            explanation: `Stop hunt detected at ${levelPrice.toFixed(4)} on ${c.time} - price swept above then reversed`,
          });
          break;
        }
      }
    }

    return stopHunts;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    levels: LiquidityLevel[],
    buySide: LiquidityLevel[],
    sellSide: LiquidityLevel[],
    sweeps: LiquidityLevel[]
  ): string {
    const parts: string[] = [];
    parts.push(`Liquidity Analysis: ${levels.length} levels detected`);
    parts.push(`Buy Side Liquidity: ${buySide.length}`);
    parts.push(`Sell Side Liquidity: ${sellSide.length}`);
    parts.push(`Liquidity Sweeps/Stop Hunts: ${sweeps.length}`);

    if (sweeps.length > 0) {
      const strongest = sweeps.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Sweep: ${strongest.label} at ${strongest.price.toFixed(4)}`);
    }

    return parts.join(' | ');
  },
};
