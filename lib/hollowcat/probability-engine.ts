/**
 * Probability Engine
 * Calculates weighted LONG/SHORT probability from all modules
 * Weights: Trend 20%, Volume 15%, Liquidity 15%, Structure 15%,
 * Regression 10%, FVG 10%, Order Block 10%, Momentum 5%, ATR 5%, VWAP 5%
 * Includes market maker manipulation risk adjustment
 */

import type { Candle, ProbabilityResult, ProbabilityScores, TrendResult, MarketStructureResult, FVGResult, OrderBlockResult, LiquidityResult, VolumeResult, RegressionChannel, ManipulationResult } from './types';
import { TrendEngine } from './trend-engine';
import { MarketStructureEngine } from './market-structure-engine';
import { FVGEngine } from './fvg-engine';
import { OrderBlockEngine } from './order-block-engine';
import { LiquidityEngine } from './liquidity-engine';
import { VolumeEngine } from './volume-engine';
import { RegressionEngine } from './regression-engine';

export const ProbabilityEngine = {
  /**
   * Main probability calculation combining all modules
   */
  analyze(candles: Candle[], manipulation?: ManipulationResult): ProbabilityResult {
    if (candles.length < 20) {
      return this._fallback('Need at least 20 candles for probability analysis');
    }

    // Run all sub-engines
    const trend = TrendEngine.analyze(candles);
    const structure = MarketStructureEngine.analyze(candles);
    const fvg = FVGEngine.analyze(candles);
    const orderBlocks = OrderBlockEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const volume = VolumeEngine.analyze(candles);
    const regression = RegressionEngine.analyze(candles);

    // Calculate individual scores (0-100)
    const scores = this._calculateScores(trend, structure, fvg, orderBlocks, liquidity, volume, regression, candles);

    // Apply manipulation penalty if present
    const adjustedScores = manipulation ? this._applyManipulationPenalty(scores, manipulation) : scores;

    // Weighted probability calculation
    const longProbability = this._calcLongProbability(adjustedScores);
    const shortProbability = this._calcShortProbability(adjustedScores);
    const confidenceScore = this._calcConfidence(adjustedScores, longProbability, shortProbability);

    const explanation = this.buildExplanation(adjustedScores, longProbability, shortProbability, confidenceScore, manipulation);

    return {
      longProbability,
      shortProbability,
      confidenceScore,
      scores: adjustedScores,
      explanation,
    };
  },

  /**
   * Calculate individual module scores
   */
  _calculateScores(
    trend: TrendResult,
    structure: MarketStructureResult,
    fvg: FVGResult,
    orderBlocks: OrderBlockResult,
    liquidity: LiquidityResult,
    volume: VolumeResult,
    regression: RegressionChannel,
    candles: Candle[]
  ): ProbabilityScores {
    // Trend Score (0-100) - 20% weight
    let trendScore = 50;
    if (trend.direction.includes('BULLISH')) trendScore = Math.min(100, trend.strength + 20);
    if (trend.direction.includes('BEARISH')) trendScore = Math.max(0, 100 - trend.strength - 20);
    if (trend.direction === 'SIDEWAYS') trendScore = 50;

    // Volume Score (0-100) - 15% weight
    const volumeScore = volume.volumeStrength;

    // Liquidity Score (0-100) - 15% weight
    let liquidityScore = 50;
    const buyLiqCount = liquidity.buySideLiquidity.length;
    const sellLiqCount = liquidity.sellSideLiquidity.length;
    if (buyLiqCount > sellLiqCount) liquidityScore = Math.min(100, 50 + buyLiqCount * 5);
    if (sellLiqCount > buyLiqCount) liquidityScore = Math.max(0, 50 - sellLiqCount * 5);

    // Structure Score (0-100) - 15% weight
    let structureScore = 50;
    if (structure.currentStructure === 'BULLISH') structureScore = 70 + structure.bosEvents.length * 3;
    if (structure.currentStructure === 'BEARISH') structureScore = 30 - structure.bosEvents.length * 3;
    structureScore = Math.max(0, Math.min(100, structureScore));

    // Regression Score (0-100) - 10% weight
    const regressionScore = Math.min(100, Math.max(0, regression.r2 * 100 + (regression.projectedDirection === 'UP' ? 10 : regression.projectedDirection === 'DOWN' ? -10 : 0)));

    // FVG Score (0-100) - 10% weight
    let fvgScore = 50;
    const freshFvgCount = fvg.freshBullish.length + fvg.freshBearish.length;
    if (freshFvgCount > 0) {
      const strongestFvg = [...fvg.freshBullish, ...fvg.freshBearish].sort((a, b) => b.strength - a.strength)[0];
      fvgScore = Math.min(100, strongestFvg.strength * 10);
    }

    // Order Block Score (0-100) - 10% weight
    let obScore = 50;
    const activeOBs = orderBlocks.activeOBs;
    if (activeOBs.length > 0) {
      const strongestOB = activeOBs.sort((a, b) => b.strength - a.strength)[0];
      obScore = Math.min(100, strongestOB.strength);
    }

    // Momentum Score (0-100) - 5% weight
    const momentumScore = Math.min(100, Math.abs(trend.kalmanSlope) * 5000);

    // ATR Score (0-100) - 5% weight
    const atrScore = Math.min(100, trend.atr * 100);

    // VWAP Score (0-100) - 5% weight (approximated using regression middle)
    const lastClose = candles[candles.length - 1].close;
    const vwapApprox = regression.middle[regression.middle.length - 1] || lastClose;
    const vwapScore = Math.abs(lastClose - vwapApprox) / vwapApprox < 0.01 ? 80 : 40;

    return {
      trend: trendScore,
      volume: volumeScore,
      liquidity: liquidityScore,
      structure: structureScore,
      regression: regressionScore,
      fvg: fvgScore,
      orderBlock: obScore,
      momentum: momentumScore,
      atr: atrScore,
      vwap: vwapScore,
    };
  },

  /**
   * Apply manipulation penalty to scores
   * High manipulation risk reduces confidence across all factors
   */
  _applyManipulationPenalty(scores: ProbabilityScores, manipulation: ManipulationResult): ProbabilityScores {
    const penalty = manipulation.manipulationScore / 100;
    const penaltyFactor = 1 - (penalty * 0.5); // Max 50% reduction

    return {
      trend: Math.round(scores.trend * penaltyFactor),
      volume: Math.round(scores.volume * penaltyFactor),
      liquidity: Math.round(scores.liquidity * penaltyFactor),
      structure: Math.round(scores.structure * penaltyFactor),
      regression: Math.round(scores.regression * penaltyFactor),
      fvg: Math.round(scores.fvg * penaltyFactor),
      orderBlock: Math.round(scores.orderBlock * penaltyFactor),
      momentum: Math.round(scores.momentum * penaltyFactor),
      atr: Math.round(scores.atr * penaltyFactor),
      vwap: Math.round(scores.vwap * penaltyFactor),
    };
  },

  /**
   * Calculate LONG probability from weighted scores
   */
  _calcLongProbability(scores: ProbabilityScores): number {
    const weights = {
      trend: 0.20,
      volume: 0.15,
      liquidity: 0.15,
      structure: 0.15,
      regression: 0.10,
      fvg: 0.10,
      orderBlock: 0.10,
      momentum: 0.05,
      atr: 0.05,
      vwap: 0.05,
    };

    // For LONG: bullish indicators increase probability
    const weightedScore =
      scores.trend * weights.trend +
      scores.volume * weights.volume +
      scores.liquidity * weights.liquidity +
      scores.structure * weights.structure +
      scores.regression * weights.regression +
      scores.fvg * weights.fvg +
      scores.orderBlock * weights.orderBlock +
      scores.momentum * weights.momentum +
      scores.atr * weights.atr +
      scores.vwap * weights.vwap;

    return Math.min(100, Math.max(0, Math.round(weightedScore)));
  },

  /**
   * Calculate SHORT probability from weighted scores
   */
  _calcShortProbability(scores: ProbabilityScores): number {
    const weights = {
      trend: 0.20,
      volume: 0.15,
      liquidity: 0.15,
      structure: 0.15,
      regression: 0.10,
      fvg: 0.10,
      orderBlock: 0.10,
      momentum: 0.05,
      atr: 0.05,
      vwap: 0.05,
    };

    // For SHORT: bearish indicators increase probability
    const bearishTrend = 100 - scores.trend;
    const bearishStructure = 100 - scores.structure;
    const bearishRegression = scores.regression < 50 ? 100 - scores.regression : 0;

    const weightedScore =
      bearishTrend * weights.trend +
      scores.volume * weights.volume +
      (100 - scores.liquidity) * weights.liquidity +
      bearishStructure * weights.structure +
      bearishRegression * weights.regression +
      (100 - scores.fvg) * weights.fvg +
      (100 - scores.orderBlock) * weights.orderBlock +
      (100 - scores.momentum) * weights.momentum +
      (100 - scores.atr) * weights.atr +
      (100 - scores.vwap) * weights.vwap;

    return Math.min(100, Math.max(0, Math.round(weightedScore)));
  },

  /**
   * Calculate confidence score
   */
  _calcConfidence(scores: ProbabilityScores, longProb: number, shortProb: number): number {
    // Confidence is higher when probabilities are more extreme (not 50/50)
    const spread = Math.abs(longProb - shortProb);
    const avgScore = Object.values(scores).reduce((s, v) => s + v, 0) / Object.values(scores).length;

    // Combine spread and average score
    const confidence = (spread * 0.6 + avgScore * 0.4);
    return Math.min(100, Math.max(0, Math.round(confidence)));
  },

  /**
   * Build explanation string
   */
  buildExplanation(scores: ProbabilityScores, longProb: number, shortProb: number, confidence: number, manipulation?: ManipulationResult): string {
    const parts: string[] = [];
    parts.push(`Probability Analysis:`);
    parts.push(`LONG: ${longProb}% | SHORT: ${shortProb}% | Confidence: ${confidence}%`);
    parts.push(`Scores - Trend: ${scores.trend}, Volume: ${scores.volume}, Liquidity: ${scores.liquidity}`);
    parts.push(`Structure: ${scores.structure}, Regression: ${scores.regression}, FVG: ${scores.fvg}`);
    parts.push(`Order Block: ${scores.orderBlock}, Momentum: ${scores.momentum}, ATR: ${scores.atr}, VWAP: ${scores.vwap}`);

    if (manipulation && manipulation.manipulationScore > 30) {
      parts.push(`⚠ Manipulation risk: ${manipulation.manipulationScore}/100 - probabilities adjusted`);
    }

    if (longProb > shortProb + 20) {
      parts.push(`Strong LONG bias with ${longProb - shortProb}% probability edge`);
    } else if (shortProb > longProb + 20) {
      parts.push(`Strong SHORT bias with ${shortProb - longProb}% probability edge`);
    } else {
      parts.push(`Neutral market - no strong directional bias`);
    }

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(reason: string): ProbabilityResult {
    return {
      longProbability: 50,
      shortProbability: 50,
      confidenceScore: 0,
      scores: { trend: 50, volume: 50, liquidity: 50, structure: 50, regression: 50, fvg: 50, orderBlock: 50, momentum: 50, atr: 50, vwap: 50 },
      explanation: reason,
    };
  },
};
