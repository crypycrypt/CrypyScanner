/**
 * Volume Engine
 * Calculates Volume Spike, Relative Volume, Volume Strength, Confirmation
 */

import type { Candle, VolumeResult } from './types';

export const VolumeEngine = {
  /**
   * Main volume analysis
   */
  analyze(candles: Candle[]): VolumeResult {
    if (candles.length < 5) {
      return {
        spike: false,
        relativeVolume: 0,
        volumeStrength: 0,
        confirmation: false,
        breakoutConfirmation: false,
        explanation: 'Need at least 5 candles for volume analysis',
      };
    }

    const relativeVolume = this._calcRelativeVolume(candles);
    const spike = relativeVolume > 1.5;
    const volumeStrength = this._calcVolumeStrength(candles, relativeVolume);
    const confirmation = this._checkVolumeConfirmation(candles, relativeVolume);
    const breakoutConfirmation = this._checkBreakoutConfirmation(candles, relativeVolume);

    const explanation = this.buildExplanation(spike, relativeVolume, volumeStrength, confirmation, breakoutConfirmation);

    return {
      spike,
      relativeVolume,
      volumeStrength,
      confirmation,
      breakoutConfirmation,
      explanation,
    };
  },

  /**
   * Calculate relative volume compared to 20-candle average
   */
  _calcRelativeVolume(candles: Candle[]): number {
    const currentVolume = candles[candles.length - 1].volume || 0;
    const lookback = Math.min(20, candles.length - 1);
    const startIdx = candles.length - 1 - lookback;

    let sum = 0;
    for (let i = startIdx; i < candles.length - 1; i++) {
      sum += candles[i].volume || 0;
    }

    const avgVolume = sum / lookback || 1;
    return currentVolume / avgVolume;
  },

  /**
   * Calculate volume strength score (0-100)
   */
  _calcVolumeStrength(candles: Candle[], relativeVolume: number): number {
    const lookback = Math.min(20, candles.length);
    const startIdx = candles.length - lookback;

    // Calculate volume trend
    let volTrend = 0;
    for (let i = startIdx + 1; i < candles.length; i++) {
      const curr = candles[i].volume || 0;
      const prev = candles[i - 1].volume || 1;
      volTrend += (curr - prev) / prev;
    }
    const avgTrend = volTrend / (lookback - 1);

    // Score based on relative volume and trend
    const volScore = Math.min(50, relativeVolume * 20);
    const trendScore = Math.min(50, Math.max(0, avgTrend * 100 + 50));

    return Math.min(100, Math.round(volScore + trendScore));
  },

  /**
   * Check if volume confirms the current trend
   */
  _checkVolumeConfirmation(candles: Candle[], relativeVolume: number): boolean {
    if (candles.length < 3) return false;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Volume confirms bullish move if volume is high and price went up
    if (last.close > prev.close && relativeVolume > 1.0) return true;

    // Volume confirms bearish move if volume is high and price went down
    if (last.close < prev.close && relativeVolume > 1.0) return true;

    return false;
  },

  /**
   * Check if volume confirms a breakout
   */
  _checkBreakoutConfirmation(candles: Candle[], relativeVolume: number): boolean {
    if (candles.length < 5) return false;

    const last = candles[candles.length - 1];
    const prevHigh = Math.max(...candles.slice(-5, -1).map(c => c.high));
    const prevLow = Math.min(...candles.slice(-5, -1).map(c => c.low));

    // Breakout above recent highs with high volume
    if (last.close > prevHigh && relativeVolume > 1.2) return true;

    // Breakout below recent lows with high volume
    if (last.close < prevLow && relativeVolume > 1.2) return true;

    return false;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    spike: boolean,
    relativeVolume: number,
    volumeStrength: number,
    confirmation: boolean,
    breakoutConfirmation: boolean
  ): string {
    const parts: string[] = [];
    parts.push(`Volume Analysis:`);
    parts.push(`Relative Volume: ${relativeVolume.toFixed(2)}x average`);
    parts.push(`Volume Spike: ${spike ? 'YES' : 'NO'}`);
    parts.push(`Volume Strength: ${volumeStrength}/100`);
    parts.push(`Volume Confirmation: ${confirmation ? 'YES' : 'NO'}`);
    parts.push(`Breakout Confirmation: ${breakoutConfirmation ? 'YES' : 'NO'}`);

    if (spike) {
      parts.push('Significant volume spike detected - strong participation');
    }

    if (confirmation) {
      parts.push('Volume confirms the current price direction');
    }

    return parts.join(' | ');
  },
};
