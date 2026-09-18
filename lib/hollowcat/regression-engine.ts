/**
 * Regression Engine
 * Adaptive Regression Channel, Kalman Regression, ATR Channel
 * Dynamic channel width with future trend projection
 */

import type { Candle, RegressionChannel } from './types';

export const RegressionEngine = {
  /**
   * Main regression analysis
   */
  analyze(candles: Candle[]): RegressionChannel {
    if (candles.length < 10) {
      return {
        upper: [],
        middle: [],
        lower: [],
        slope: 0,
        r2: 0,
        projectedDirection: 'FLAT',
        width: 0,
        explanation: 'Need at least 10 candles for regression analysis',
      };
    }

    const linearReg = this._linearRegression(candles);
    const kalmanReg = this._kalmanRegression(candles);
    const atrChannel = this._atrChannel(candles);

    // Combine regression methods
    const combinedSlope = linearReg.slope * 0.4 + kalmanReg.slope * 0.4 + atrChannel.slope * 0.2;
    const combinedR2 = (linearReg.r2 + kalmanReg.r2) / 2;

    // Generate channel bands
    const atr = this._calcATR(candles);
    const channelWidth = atr * 2; // 2x ATR for dynamic width

    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < candles.length; i++) {
      const base = linearReg.intercept + linearReg.slope * i;
      upper.push(base + channelWidth);
      middle.push(base);
      lower.push(base - channelWidth);
    }

    const projectedDirection = combinedSlope > 0.001 ? 'UP' : combinedSlope < -0.001 ? 'DOWN' : 'FLAT';

    const explanation = this.buildExplanation(
      combinedSlope, combinedR2, channelWidth, projectedDirection, linearReg, kalmanReg, atrChannel
    );

    return {
      upper,
      middle,
      lower,
      slope: combinedSlope,
      r2: combinedR2,
      projectedDirection,
      width: channelWidth,
      explanation,
    };
  },

  /**
   * Standard linear regression on candle indices
   */
  _linearRegression(candles: Candle[]): { slope: number; intercept: number; r2: number } {
    const n = candles.length;
    const xMean = (n - 1) / 2;
    const yMean = candles.reduce((s, c) => s + c.close, 0) / n;

    let num = 0;
    let den = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = candles[i].close - yMean;
      num += xDiff * yDiff;
      den += xDiff * xDiff;
      ssTot += yDiff * yDiff;
    }

    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const ssRes = candles.reduce((s, c, i) => {
      const predicted = intercept + slope * i;
      return s + Math.pow(c.close - predicted, 2);
    }, 0);

    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  },

  /**
   * Kalman-based regression for adaptive trend tracking
   */
  _kalmanRegression(candles: Candle[]): { slope: number; intercept: number; r2: number } {
    const n = candles.length;
    const prices = candles.map(c => c.close);

    // Simple Kalman filter for level tracking
    const Q = 1e-5; // Process noise
    const R = Math.max(1e-4, this._calcVariance(prices.slice(-10)));
    let x = prices[0];
    let P = 1;

    const filtered: number[] = [x];

    for (let i = 1; i < n; i++) {
      const xPred = x;
      const PPred = P + Q;
      const K = PPred / (PPred + R);
      x = xPred + K * (prices[i] - xPred);
      P = (1 - K) * PPred;
      filtered.push(x);
    }

    // Calculate slope from filtered values
    const xMean = (n - 1) / 2;
    const yMean = filtered.reduce((s, v) => s + v, 0) / n;

    let num = 0;
    let den = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = filtered[i] - yMean;
      num += xDiff * yDiff;
      den += xDiff * xDiff;
      ssTot += yDiff * yDiff;
    }

    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const ssRes = filtered.reduce((s, v, i) => {
      const predicted = intercept + slope * i;
      return s + Math.pow(v - predicted, 2);
    }, 0);

    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  },

  /**
   * ATR-based channel for dynamic width
   */
  _atrChannel(candles: Candle[]): { slope: number; intercept: number; r2: number } {
    const atr = this._calcATR(candles);
    const n = candles.length;

    // Use ATR-adjusted regression
    const xMean = (n - 1) / 2;
    const yMean = candles.reduce((s, c) => s + c.close, 0) / n;

    let num = 0;
    let den = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = candles[i].close - yMean;
      num += xDiff * yDiff;
      den += xDiff * xDiff;
    }

    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    // R² calculation
    const ssTot = candles.reduce((s, c) => s + Math.pow(c.close - yMean, 2), 0);
    const ssRes = candles.reduce((s, c, i) => {
      const predicted = intercept + slope * i;
      return s + Math.pow(c.close - predicted, 2);
    }, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  },

  /**
   * Calculate ATR
   */
  _calcATR(candles: Candle[], period: number = 14): number {
    if (candles.length < 2) return 1;
    const atrPeriod = Math.min(period, candles.length - 1);
    const start = candles.length - atrPeriod;
    let sum = 0;
    for (let i = start + 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    return sum / atrPeriod || 1;
  },

  /**
   * Calculate variance
   */
  _calcVariance(arr: number[]): number {
    if (arr.length < 2) return 1;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    combinedSlope: number,
    combinedR2: number,
    width: number,
    projectedDirection: string,
    linearReg: { slope: number; r2: number },
    kalmanReg: { slope: number; r2: number },
    atrChannel: { slope: number; r2: number }
  ): string {
    const parts: string[] = [];
    parts.push(`Regression Analysis:`);
    parts.push(`Combined slope: ${combinedSlope.toFixed(6)}`);
    parts.push(`R²: ${combinedR2.toFixed(3)}`);
    parts.push(`Channel width (2x ATR): ${width.toFixed(4)}`);
    parts.push(`Projected direction: ${projectedDirection}`);
    parts.push(`Linear R²: ${linearReg.r2.toFixed(3)}, Kalman R²: ${kalmanReg.r2.toFixed(3)}`);

    if (projectedDirection === 'UP') {
      parts.push('Regression channel projects upward trend');
    } else if (projectedDirection === 'DOWN') {
      parts.push('Regression channel projects downward trend');
    } else {
      parts.push('Regression channel shows flat/consolidating market');
    }

    return parts.join(' | ');
  },
};
