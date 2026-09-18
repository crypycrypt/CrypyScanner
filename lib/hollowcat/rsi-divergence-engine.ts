/**
 * RSI Momentum Divergence Engine
 * Detects bullish and bearish RSI divergence zones
 * Similar to ChartPrime's RSI Momentum Divergence Zones
 */

import type { Candle } from './types';

export interface DivergenceLevel {
  type: 'bullish' | 'bearish';
  price: number;
  rsi: number;
  idx: number;
  time: string;
  strength: number;
  label: string;
}

export interface RSIDivergenceResult {
  rsi: number[];
  rsiLine: number;
  bullishDivergences: DivergenceLevel[];
  bearishDivergences: DivergenceLevel[];
  explanation: string;
}

export const RSIDivergenceEngine = {
  /**
   * Main RSI divergence analysis
   */
  analyze(candles: Candle[], rsiLength: number = 14, lookback: number = 5): RSIDivergenceResult {
    if (candles.length < rsiLength + lookback + 10) {
      return {
        rsi: [],
        rsiLine: 50,
        bullishDivergences: [],
        bearishDivergences: [],
        explanation: 'Need sufficient candles for RSI divergence analysis',
      };
    }

    // Calculate RSI
    const rsiValues = this._calcRSI(candles, rsiLength);
    const rsiLine = rsiValues[rsiValues.length - 1] || 50;

    // Detect divergences
    const bullishDivergences = this._detectBullishDivergence(candles, rsiValues, lookback);
    const bearishDivergences = this._detectBearishDivergence(candles, rsiValues, lookback);

    const explanation = this.buildExplanation(rsiLine, bullishDivergences, bearishDivergences);

    return {
      rsi: rsiValues,
      rsiLine,
      bullishDivergences,
      bearishDivergences,
      explanation,
    };
  },

  /**
   * Calculate RSI using momentum
   */
  _calcRSI(candles: Candle[], period: number): number[] {
    const rsiValues: number[] = [];
    const momentum = candles.map((c, i) => {
      if (i === 0) return 0;
      return c.close - candles[i - 1].close;
    });

    for (let i = period; i < candles.length; i++) {
      let gains = 0;
      let losses = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const m = momentum[j];
        if (m > 0) gains += m;
        else losses += Math.abs(m);
      }

      const avgGain = gains / period;
      const avgLoss = losses / period;

      if (avgLoss === 0) {
        rsiValues.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }

    return rsiValues;
  },

  /**
   * Detect bullish divergence: Price makes lower low, RSI makes higher low
   */
  _detectBullishDivergence(candles: Candle[], rsiValues: number[], lookback: number): DivergenceLevel[] {
    const divergences: DivergenceLevel[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      // Check for pivot low in RSI
      const rsiPivotLow = this._isPivotLow(rsiValues, i, lookback, lookback);
      if (!rsiPivotLow) continue;

      // Check if this is a higher low in RSI compared to previous pivot low
      const prevPivotIdx = this._findPrevPivotLow(rsiValues, i, lookback);
      if (prevPivotIdx === -1) continue;

      const rsiHL = rsiValues[i] > rsiValues[prevPivotIdx];

      // Check for lower low in price
      const priceLL = candles[i].low < candles[prevPivotIdx].low;

      if (rsiHL && priceLL) {
        divergences.push({
          type: 'bullish',
          price: candles[i].low,
          rsi: rsiValues[i],
          idx: i,
          time: candles[i].time,
          strength: Math.min(100, (rsiValues[i] - rsiValues[prevPivotIdx]) * 5),
          label: 'Bullish Divergence ▲',
        });
      }
    }

    return divergences;
  },

  /**
   * Detect bearish divergence: Price makes higher high, RSI makes lower high
   */
  _detectBearishDivergence(candles: Candle[], rsiValues: number[], lookback: number): DivergenceLevel[] {
    const divergences: DivergenceLevel[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      // Check for pivot high in RSI
      const rsiPivotHigh = this._isPivotHigh(rsiValues, i, lookback, lookback);
      if (!rsiPivotHigh) continue;

      // Check if this is a lower high in RSI compared to previous pivot high
      const prevPivotIdx = this._findPrevPivotHigh(rsiValues, i, lookback);
      if (prevPivotIdx === -1) continue;

      const rsiLH = rsiValues[i] < rsiValues[prevPivotIdx];

      // Check for higher high in price
      const priceHH = candles[i].high > candles[prevPivotIdx].high;

      if (rsiLH && priceHH) {
        divergences.push({
          type: 'bearish',
          price: candles[i].high,
          rsi: rsiValues[i],
          idx: i,
          time: candles[i].time,
          strength: Math.min(100, (rsiValues[prevPivotIdx] - rsiValues[i]) * 5),
          label: 'Bearish Divergence ▼',
        });
      }
    }

    return divergences;
  },

  /**
   * Check if index is a pivot low
   */
  _isPivotLow(values: number[], idx: number, left: number, right: number): boolean {
    for (let i = 1; i <= left; i++) {
      if (values[idx - i] <= values[idx]) return false;
    }
    for (let i = 1; i <= right; i++) {
      if (values[idx + i] <= values[idx]) return false;
    }
    return true;
  },

  /**
   * Check if index is a pivot high
   */
  _isPivotHigh(values: number[], idx: number, left: number, right: number): boolean {
    for (let i = 1; i <= left; i++) {
      if (values[idx - i] >= values[idx]) return false;
    }
    for (let i = 1; i <= right; i++) {
      if (values[idx + i] >= values[idx]) return false;
    }
    return true;
  },

  /**
   * Find previous pivot low
   */
  _findPrevPivotLow(values: number[], idx: number, lookback: number): number {
    for (let i = idx - lookback; i >= 0; i--) {
      if (this._isPivotLow(values, i, lookback, lookback)) return i;
    }
    return -1;
  },

  /**
   * Find previous pivot high
   */
  _findPrevPivotHigh(values: number[], idx: number, lookback: number): number {
    for (let i = idx - lookback; i >= 0; i--) {
      if (this._isPivotHigh(values, i, lookback, lookback)) return i;
    }
    return -1;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    rsiLine: number,
    bullishDivs: DivergenceLevel[],
    bearishDivs: DivergenceLevel[]
  ): string {
    const parts: string[] = [];
    parts.push(`RSI Divergence Analysis:`);
    parts.push(`RSI: ${rsiLine.toFixed(1)}`);
    parts.push(`Bullish Divergences: ${bullishDivs.length}`);
    parts.push(`Bearish Divergences: ${bearishDivs.length}`);

    if (bullishDivs.length > 0) {
      const strongest = bullishDivs.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Bullish: ${strongest.strength.toFixed(0)}% at ${strongest.price.toFixed(4)}`);
    }

    if (bearishDivs.length > 0) {
      const strongest = bearishDivs.sort((a, b) => b.strength - a.strength)[0];
      parts.push(`Strongest Bearish: ${strongest.strength.toFixed(0)}% at ${strongest.price.toFixed(4)}`);
    }

    return parts.join(' | ');
  },
};
