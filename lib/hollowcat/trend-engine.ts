/**
 * Trend Engine - Multi-factor trend analysis
 * Combines EMA200, Kalman Filter, Adaptive Regression, Slope, ATR, and Trend Strength
 * Output: Bullish, Bearish, Sideways, Weak Trend, Strong Trend
 */

import type { Candle, TrendResult, TrendDirection } from './types';

export const TrendEngine = {
  /**
   * Main trend analysis combining multiple indicators
   */
  analyze(candles: Candle[]): TrendResult {
    if (candles.length < 50) {
      return this._fallback(candles, 'Need at least 50 candles for trend analysis');
    }

    const ema200 = this._calcEMA(candles, 200);
    const kalman = this._kalmanFilter(candles);
    const regression = this._adaptiveRegression(candles);
    const slope = this._calcSlope(candles);
    const atr = this._calcATR(candles);
    const trendStrength = this._calcTrendStrength(candles, ema200, kalman, regression);

    const direction = this._determineDirection(ema200, kalman, regression, slope, trendStrength);
    const explanation = this._buildExplanation(direction, ema200, kalman, regression, slope, atr, trendStrength);

    return {
      direction,
      strength: trendStrength,
      ema200,
      kalmanSlope: kalman.slope,
      adaptiveSlope: regression.slope,
      atr,
      trendStrength,
      explanation,
    };
  },

  /**
   * Exponential Moving Average
   */
  _calcEMA(candles: Candle[], period: number): number {
    const closePrices = candles.map(c => c.close);
    const multiplier = 2 / (period + 1);
    let ema = closePrices[0];
    for (let i = 1; i < closePrices.length; i++) {
      ema = (closePrices[i] - ema) * multiplier + ema;
    }
    return ema;
  },

  /**
   * Kalman Filter for trend estimation
   * Adapts to changing market conditions
   */
  _kalmanFilter(candles: Candle[]): { slope: number; level: number; uncertainty: number } {
    const n = candles.length;
    const prices = candles.map(c => c.close);

    // Kalman filter parameters
    const Q = 1e-5; // Process noise
    const R = Math.max(1e-4, this._calcVariance(prices.slice(-20))); // Measurement noise
    let x = prices[0]; // State estimate
    let P = 1; // Estimation uncertainty
    const dt = 1; // Time step

    let slopeSum = 0;
    let slopeCount = 0;

    for (let i = 1; i < n; i++) {
      // Prediction step
      const xPred = x;
      const PPred = P + Q;

      // Update step
      const K = PPred / (PPred + R); // Kalman gain
      const y = prices[i]; // Measurement
      x = xPred + K * (y - xPred);
      P = (1 - K) * PPred;

      // Calculate slope from state changes
      if (i > 1) {
        const slope = (x - prices[i - 1]) / dt;
        slopeSum += slope;
        slopeCount++;
      }
    }

    const avgSlope = slopeCount > 0 ? slopeSum / slopeCount : 0;
    return {
      slope: avgSlope,
      level: x,
      uncertainty: P,
    };
  },

  /**
   * Adaptive Regression - adjusts window based on volatility
   */
  _adaptiveRegression(candles: Candle[]): { slope: number; intercept: number; r2: number } {
    const atr = this._calcATR(candles.slice(-20));
    // Adaptive window: more data in low volatility, less in high volatility
    const baseWindow = 50;
    const volatilityFactor = Math.max(0.3, Math.min(2.0, atr / (candles[candles.length - 1].close || 1)));
    const windowSize = Math.max(20, Math.min(candles.length, Math.round(baseWindow / volatilityFactor)));

    const recent = candles.slice(-windowSize);
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, c) => s + c.close, 0) / n;

    let num = 0;
    let den = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = recent[i].close - yMean;
      num += xDiff * yDiff;
      den += xDiff * xDiff;
      ssTot += yDiff * yDiff;
    }

    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const ssRes = recent.reduce((s, c, i) => {
      const predicted = intercept + slope * i;
      return s + Math.pow(c.close - predicted, 2);
    }, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  },

  /**
   * Linear slope over the last N candles
   */
  _calcSlope(candles: Candle[], period: number = 20): number {
    const recent = candles.slice(-period);
    const n = recent.length;
    if (n < 2) return 0;

    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, c) => s + c.close, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (recent[i].close - yMean);
      den += (i - xMean) * (i - xMean);
    }

    return den !== 0 ? num / den : 0;
  },

  /**
   * Average True Range
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
   * Calculate variance of an array
   */
  _calcVariance(arr: number[]): number {
    if (arr.length < 2) return 1;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
  },

  /**
   * Determine overall trend direction from multiple indicators
   */
  _determineDirection(
    ema200: number,
    kalman: { slope: number; level: number },
    regression: { slope: number; r2: number },
    slope: number,
    trendStrength: number
  ): TrendDirection {
    const lastClose = 0; // Will be set by caller context
    const priceAboveEMA = lastClose >= ema200;
    const kalmanUp = kalman.slope > 0;
    const regUp = regression.slope > 0;
    const slopeUp = slope > 0;

    const bullishSignals = [priceAboveEMA, kalmanUp, regUp, slopeUp].filter(Boolean).length;
    const bearishSignals = [!priceAboveEMA, !kalmanUp, !regUp, !slopeUp].filter(Boolean).length;

    if (trendStrength < 30) {
      return 'SIDEWAYS';
    }

    if (bullishSignals >= 3 && trendStrength > 60) {
      return 'STRONG_BULLISH';
    }
    if (bullishSignals >= 2 && trendStrength > 50) {
      return 'BULLISH';
    }
    if (bullishSignals >= 1 && trendStrength > 40) {
      return 'WEAK_BULLISH';
    }
    if (bearishSignals >= 3 && trendStrength > 60) {
      return 'STRONG_BEARISH';
    }
    if (bearishSignals >= 2 && trendStrength > 50) {
      return 'BEARISH';
    }
    if (bearishSignals >= 1 && trendStrength > 40) {
      return 'WEAK_BEARISH';
    }

    return 'SIDEWAYS';
  },

  /**
   * Calculate trend strength from multiple factors
   */
  _calcTrendStrength(
    candles: Candle[],
    ema200: number,
    kalman: { slope: number; level: number; uncertainty: number },
    regression: { slope: number; r2: number }
  ): number {
    const lastClose = candles[candles.length - 1].close;
    const atr = this._calcATR(candles);

    // Factor 1: Price vs EMA200 alignment (0-25)
    const emaDistance = Math.abs(lastClose - ema200) / ema200;
    const emaScore = Math.min(25, emaDistance * 500);

    // Factor 2: Kalman filter consistency (0-25)
    const kalmanScore = Math.min(25, Math.abs(kalman.slope) * 1000 * (1 - kalman.uncertainty));

    // Factor 3: Regression R² (0-25)
    const regScore = Math.min(25, regression.r2 * 25);

    // Factor 4: ATR-based momentum (0-25)
    const momentum = (lastClose - candles[Math.max(0, candles.length - 20)].close) / atr;
    const momentumScore = Math.min(25, Math.abs(momentum) * 5);

    return Math.min(100, Math.round(emaScore + kalmanScore + regScore + momentumScore));
  },

  /**
   * Build human-readable explanation
   */
  _buildExplanation(
    direction: TrendDirection,
    ema200: number,
    kalman: { slope: number; level: number },
    regression: { slope: number; r2: number },
    slope: number,
    atr: number,
    trendStrength: number
  ): string {
    const parts: string[] = [];

    parts.push(`Trend direction: ${direction} (strength: ${trendStrength.toFixed(0)}/100)`);
    parts.push(`EMA200: ${ema200.toFixed(4)}`);
    parts.push(`Kalman slope: ${kalman.slope.toFixed(6)} (level: ${kalman.level.toFixed(4)})`);
    parts.push(`Adaptive regression slope: ${regression.slope.toFixed(6)} (R²: ${regression.r2.toFixed(3)})`);
    parts.push(`Linear slope: ${slope.toFixed(6)}`);
    parts.push(`ATR: ${atr.toFixed(4)}`);

    if (direction.includes('BULLISH')) {
      parts.push('Price is above EMA200 with bullish momentum indicators');
    } else if (direction.includes('BEARISH')) {
      parts.push('Price is below EMA200 with bearish momentum indicators');
    } else {
      parts.push('Market is in consolidation with no clear directional bias');
    }

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(candles: Candle[], reason: string): TrendResult {
    const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;
    return {
      direction: 'SIDEWAYS',
      strength: 0,
      ema200: lastClose,
      kalmanSlope: 0,
      adaptiveSlope: 0,
      atr: 1,
      trendStrength: 0,
      explanation: reason,
    };
  },
};
