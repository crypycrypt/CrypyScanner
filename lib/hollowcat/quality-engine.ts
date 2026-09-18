/**
 * Quality Engine
 * Rates every trade setup from A+ to AVOID
 * Based on probability, risk-reward, trend strength, volume, structure
 * Includes market maker manipulation quality assessment
 */

import type { ProbabilityResult, RiskResult, TrendResult, MarketStructureResult, VolumeResult, FVGResult, OrderBlockResult, LiquidityResult, TradeQualityResult, TradeRating, ManipulationResult } from './types';

export const QualityEngine = {
  /**
   * Main quality assessment
   */
  analyze(
    probability: ProbabilityResult,
    risk: RiskResult,
    trend: TrendResult,
    structure: MarketStructureResult,
    volume: VolumeResult,
    fvg: FVGResult,
    orderBlocks: OrderBlockResult,
    liquidity: LiquidityResult,
    manipulation?: ManipulationResult
  ): TradeQualityResult {
    // Calculate individual factor scores (0-100)
    const factors = this._calculateFactors(probability, risk, trend, structure, volume, fvg, orderBlocks, liquidity, manipulation);

    // Calculate weighted score
    const score = this._calcWeightedScore(factors);

    // Determine rating
    const rating = this._determineRating(score);

    const explanation = this.buildExplanation(rating, score, factors, probability, risk, manipulation);

    return {
      rating,
      score,
      factors,
      explanation,
    };
  },

  /**
   * Calculate individual factor scores
   */
  _calculateFactors(
    probability: ProbabilityResult,
    risk: RiskResult,
    trend: TrendResult,
    structure: MarketStructureResult,
    volume: VolumeResult,
    fvg: FVGResult,
    orderBlocks: OrderBlockResult,
    liquidity: LiquidityResult,
    manipulation?: ManipulationResult
  ): Record<string, number> {
    const factors: Record<string, number> = {
      // Probability score (0-100)
      probability: probability.confidenceScore,

      // Risk-reward score (0-100)
      riskReward: Math.min(100, risk.expectedRR * 20),

      // Trend strength (0-100)
      trendStrength: trend.strength,

      // Structure confirmation (0-100)
      structureConfirm: structure.bosEvents.length > 0 ? Math.min(100, structure.bosEvents.length * 20) : 0,

      // Volume confirmation (0-100)
      volumeConfirm: volume.confirmation ? volume.volumeStrength : 0,

      // FVG quality (0-100)
      fvgQuality: fvg.freshBullish.length > 0 || fvg.freshBearish.length > 0
        ? Math.max(...[...fvg.freshBullish, ...fvg.freshBearish].map(f => f.strength * 10))
        : 0,

      // Order block quality (0-100)
      obQuality: orderBlocks.activeOBs.length > 0
        ? Math.max(...orderBlocks.activeOBs.map(ob => ob.strength))
        : 0,

      // Liquidity alignment (0-100)
      liquidityAlign: liquidity.levels.length > 0 ? Math.min(100, liquidity.levels.length * 10) : 0,

      // Probability edge (0-100)
      probabilityEdge: Math.abs(probability.longProbability - probability.shortProbability),

      // Risk percentage (lower is better, inverted) (0-100)
      riskManagement: risk.riskPercent > 0 ? Math.max(0, 100 - risk.riskPercent * 5) : 50,
    };

    // Add manipulation quality factor
    if (manipulation) {
      factors.manipulationQuality = Math.max(0, 100 - manipulation.manipulationScore);
    } else {
      factors.manipulationQuality = 100;
    }

    return factors;
  },

  /**
   * Calculate weighted quality score
   */
  _calcWeightedScore(factors: Record<string, number>): number {
    const weights = {
      probability: 0.18,
      riskReward: 0.14,
      trendStrength: 0.14,
      structureConfirm: 0.10,
      volumeConfirm: 0.10,
      fvgQuality: 0.08,
      obQuality: 0.07,
      liquidityAlign: 0.05,
      probabilityEdge: 0.05,
      riskManagement: 0.05,
      manipulationQuality: 0.04,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += (factors[key] || 0) * weight;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  },

  /**
   * Determine trade rating from score
   */
  _determineRating(score: number): TradeRating {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'AVOID';
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    rating: TradeRating,
    score: number,
    factors: Record<string, number>,
    probability: ProbabilityResult,
    risk: RiskResult,
    manipulation?: ManipulationResult
  ): string {
    const parts: string[] = [];
    parts.push(`Trade Quality Assessment:`);
    parts.push(`Rating: ${rating} (Score: ${score}/100)`);
    parts.push(`Probability Confidence: ${probability.confidenceScore}%`);
    parts.push(`Expected RR: ${risk.expectedRR.toFixed(2)}`);
    parts.push(`Risk: ${risk.riskPercent.toFixed(2)}%`);

    // Top contributing factors
    const sortedFactors = Object.entries(factors).sort((a, b) => b[1] - a[1]);
    parts.push(`Strongest factors: ${sortedFactors.slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ')}`);

    if (manipulation && manipulation.manipulationScore > 50) {
      parts.push(`⚠ Manipulation risk detected (${manipulation.manipulationScore}/100) - quality reduced`);
    }

    if (rating === 'A+' || rating === 'A') {
      parts.push('High quality setup - strong entry signal');
    } else if (rating === 'B') {
      parts.push('Good setup - moderate confidence');
    } else if (rating === 'C') {
      parts.push('Average setup - consider waiting for better conditions');
    } else if (rating === 'D') {
      parts.push('Below average setup - high risk or low reward');
    } else {
      parts.push('Avoid trade - insufficient setup quality');
    }

    return parts.join(' | ');
  },
};
