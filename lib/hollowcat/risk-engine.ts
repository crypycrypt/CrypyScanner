/**
 * Risk Engine
 * Automatically calculates Entry, Stop Loss, TP1/TP2/TP3, Expected RR, Risk %
 */

import type { Candle, RiskResult, ProbabilityResult, TradeRating } from './types';
import { TrendEngine } from './trend-engine';
import { LiquidityEngine } from './liquidity-engine';
import { FVGEngine } from './fvg-engine';

export const RiskEngine = {
  /**
   * Main risk calculation
   */
  analyze(
    candles: Candle[],
    probability: ProbabilityResult,
    direction: 'LONG' | 'SHORT'
  ): RiskResult {
    if (candles.length < 5) {
      return this._fallback('Need at least 5 candles for risk calculation');
    }

    const trend = TrendEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const fvg = FVGEngine.analyze(candles);

    const lastClose = candles[candles.length - 1].close;
    const atr = trend.atr;

    // Calculate entry, stop loss, and take profits
    const { entry, stopLoss, tp1, tp2, tp3 } = this._calculateLevels(
      candles, lastClose, atr, direction, liquidity, fvg
    );

    // Calculate expected risk-reward
    const expectedRR = this._calcExpectedRR(entry, stopLoss, tp1, tp2, tp3, direction);

    // Calculate risk percentage
    const riskPercent = this._calcRiskPercent(entry, stopLoss, lastClose);

    // Calculate position size (assuming $10,000 account, 1% risk)
    const positionSize = this._calcPositionSize(entry, stopLoss, riskPercent);

    const explanation = this.buildExplanation(entry, stopLoss, tp1, tp2, tp3, expectedRR, riskPercent, direction, atr);

    return {
      entry,
      stopLoss,
      tp1,
      tp2,
      tp3,
      expectedRR,
      riskPercent,
      positionSize,
      explanation,
    };
  },

  /**
   * Calculate entry, stop loss, and take profit levels
   */
  _calculateLevels(
    candles: Candle[],
    lastClose: number,
    atr: number,
    direction: 'LONG' | 'SHORT',
    liquidity: { buySideLiquidity: any[]; sellSideLiquidity: any[] },
    fvg: { freshBullish: any[]; freshBearish: any[] }
  ): { entry: number; stopLoss: number; tp1: number; tp2: number; tp3: number } {
    let entry: number;
    let stopLoss: number;
    let tp1: number;
    let tp2: number;
    let tp3: number;

    if (direction === 'LONG') {
      // Entry: at current price or FVG zone
      const freshBullishFvg = fvg.freshBullish[0];
      if (freshBullishFvg && lastClose >= freshBullishFvg.bottom && lastClose <= freshBullishFvg.top) {
        entry = lastClose; // Enter in FVG zone
      } else {
        entry = lastClose; // Enter at market
      }

      // Stop Loss: below recent swing low or ATR-based
      const recentLow = Math.min(...candles.slice(-20).map(c => c.low));
      const atrStop = entry - atr * 1.5;
      stopLoss = Math.min(recentLow - 0.001, atrStop);

      // Take Profits based on ATR multiples and liquidity levels
      tp1 = entry + atr * 1.0;
      tp2 = entry + atr * 2.0;
      tp3 = entry + atr * 3.0;

      // Adjust TPs if there are sell-side liquidity levels nearby (use as TP targets)
      const sellLiq = liquidity.sellSideLiquidity
        .filter(l => l.price > entry)
        .sort((a, b) => a.price - b.price);

      if (sellLiq.length > 0) {
        tp1 = Math.max(tp1, sellLiq[0].price * 0.99);
        if (sellLiq.length > 1) {
          tp2 = Math.max(tp2, sellLiq[1].price * 0.99);
        }
        if (sellLiq.length > 2) {
          tp3 = Math.max(tp3, sellLiq[2].price * 0.99);
        }
      }
    } else {
      // SHORT direction
      const freshBearishFvg = fvg.freshBearish[0];
      if (freshBearishFvg && lastClose >= freshBearishFvg.bottom && lastClose <= freshBearishFvg.top) {
        entry = lastClose;
      } else {
        entry = lastClose;
      }

      // Stop Loss: above recent swing high or ATR-based
      const recentHigh = Math.max(...candles.slice(-20).map(c => c.high));
      const atrStop = entry + atr * 1.5;
      stopLoss = Math.max(recentHigh + 0.001, atrStop);

      // Take Profits
      tp1 = entry - atr * 1.0;
      tp2 = entry - atr * 2.0;
      tp3 = entry - atr * 3.0;

      // Adjust TPs if there are buy-side liquidity levels nearby (use as TP targets)
      const buyLiq = liquidity.buySideLiquidity
        .filter(l => l.price < entry)
        .sort((a, b) => b.price - a.price);

      if (buyLiq.length > 0) {
        tp1 = Math.min(tp1, buyLiq[0].price * 1.01);
        if (buyLiq.length > 1) {
          tp2 = Math.min(tp2, buyLiq[1].price * 1.01);
        }
        if (buyLiq.length > 2) {
          tp3 = Math.min(tp3, buyLiq[2].price * 1.01);
        }
      }
    }

    return { entry, stopLoss, tp1, tp2, tp3 };
  },

  /**
   * Calculate expected risk-reward ratio
   */
  _calcExpectedRR(entry: number, stopLoss: number, tp1: number, tp2: number, tp3: number, direction: 'LONG' | 'SHORT'): number {
    const risk = Math.abs(entry - stopLoss);
    if (risk === 0) return 0;

    // Weighted average RR considering probability of hitting each TP
    const rr1 = Math.abs(tp1 - entry) / risk;
    const rr2 = Math.abs(tp2 - entry) / risk;
    const rr3 = Math.abs(tp3 - entry) / risk;

    // Weighted average: 50% TP1, 30% TP2, 20% TP3
    const expectedRR = rr1 * 0.5 + rr2 * 0.3 + rr3 * 0.2;

    return Math.round(expectedRR * 100) / 100;
  },

  /**
   * Calculate risk percentage
   */
  _calcRiskPercent(entry: number, stopLoss: number, lastClose: number): number {
    const riskAmount = Math.abs(entry - stopLoss);
    const riskPercent = (riskAmount / lastClose) * 100;
    return Math.min(10, Math.max(0.1, Math.round(riskPercent * 100) / 100));
  },

  /**
   * Calculate position size based on risk
   */
  _calcPositionSize(entry: number, stopLoss: number, riskPercent: number): number {
    const accountSize = 10000; // $10,000 default account
    const riskAmount = accountSize * (riskPercent / 100);
    const priceRisk = Math.abs(entry - stopLoss);
    if (priceRisk === 0) return 0;
    return Math.round((riskAmount / priceRisk) * 100) / 100;
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    entry: number,
    stopLoss: number,
    tp1: number,
    tp2: number,
    tp3: number,
    expectedRR: number,
    riskPercent: number,
    direction: 'LONG' | 'SHORT',
    atr: number
  ): string {
    const parts: string[] = [];
    parts.push(`Risk Management (${direction}):`);
    parts.push(`Entry: ${entry.toFixed(4)}`);
    parts.push(`Stop Loss: ${stopLoss.toFixed(4)}`);
    parts.push(`TP1: ${tp1.toFixed(4)} | TP2: ${tp2.toFixed(4)} | TP3: ${tp3.toFixed(4)}`);
    parts.push(`Expected RR: ${expectedRR.toFixed(2)}`);
    parts.push(`Risk: ${riskPercent.toFixed(2)}%`);
    parts.push(`ATR: ${atr.toFixed(4)}`);

    if (expectedRR >= 2) {
      parts.push('Favorable risk-reward ratio');
    } else if (expectedRR >= 1) {
      parts.push('Moderate risk-reward ratio');
    } else {
      parts.push('Unfavorable risk-reward - consider waiting');
    }

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(reason: string): RiskResult {
    return {
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      tp3: 0,
      expectedRR: 0,
      riskPercent: 0,
      positionSize: 0,
      explanation: reason,
    };
  },
};
