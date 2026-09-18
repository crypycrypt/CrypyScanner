/**
 * Hollowcat Trading Platform - Main Export
 * Professional institutional trading platform with Smart Money Concepts
 *
 * Modules:
 * - Trend Engine: Multi-factor trend analysis (EMA200, Kalman, Regression, Slope, ATR)
 * - Market Structure Engine: BOS, CHoCH detection
 * - FVG Engine: Fair Value Gap detection with state tracking
 * - Order Block Engine: Bullish/Bearish OB detection
 * - Liquidity Engine: Buy/Sell side liquidity, sweeps, stop hunts
 * - Volume Engine: Volume spike, relative volume, confirmation
 * - Regression Engine: Adaptive regression channel with Kalman
 * - Probability Engine: Weighted LONG/SHORT probability scoring
 * - Risk Engine: Entry, SL, TP1/TP2/TP3, expected RR
 * - Entry Engine: Multi-condition entry signal determination
 * - Quality Engine: Trade rating A+ to AVOID
 * - Backtest Engine: Win rate, profit factor, Sharpe, drawdown
 * - Alert Engine: TradingView, Webhook, Telegram, Discord
 * - Dashboard Engine: Unified dashboard data aggregation
 * - Strategy Engine: Multi-timeframe strategy orchestration
 * - Manipulation Engine: Market maker manipulation detection and filtering
 */

// Types
export type {
  Candle, TrendDirection, MarketRegime, BosType, ChoCHType,
  TrendResult, SwingPoint, BOSEvent, ChoCHEvent, MarketStructureResult,
  FVGZone, FVGState, FVGResult,
  OrderBlock, OBType, OBState, OrderBlockResult,
  LiquidityLevel, LiquidityType, LiquidityResult,
  VolumeResult,
  RegressionChannel,
  ProbabilityScores, ProbabilityResult,
  RiskResult,
  TradeRating, TradeQualityResult,
  EntrySignal, EntryResult,
  ManipulationType, ManipulationSignal, ManipulationResult,
  DashboardData, CandleColor,
  BacktestTrade, BacktestResult,
  AlertConfig, AlertChannel, AlertResult,
  HollowcatAnalysis,
} from './types';

// Engines
export { TrendEngine } from './trend-engine';
export { MarketStructureEngine } from './market-structure-engine';
export { FVGEngine } from './fvg-engine';
export { OrderBlockEngine } from './order-block-engine';
export { LiquidityEngine } from './liquidity-engine';
export { VolumeEngine } from './volume-engine';
export { RegressionEngine } from './regression-engine';
export { ProbabilityEngine } from './probability-engine';
export { RiskEngine } from './risk-engine';
export { EntryEngine } from './entry-engine';
export { QualityEngine } from './quality-engine';
export { BacktestEngine } from './backtest-engine';
export { AlertEngine } from './alert-engine';
export { DashboardEngine } from './dashboard-engine';
export { StrategyEngine } from './strategy-engine';
export { RSIDivergenceEngine } from './rsi-divergence-engine';
export { ManipulationEngine } from './manipulation-engine';
