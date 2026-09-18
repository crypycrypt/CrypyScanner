/**
 * Hollowcat Trading Platform - Type Definitions
 * Professional institutional trading platform with Smart Money Concepts
 */

// ===== Candle Data =====
export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: number;
}

// ===== Market Structure Types =====
export type BosType = 'INTERNAL_BOS' | 'EXTERNAL_BOS' | 'BOS';
export type ChoCHType = 'BULLISH_CHOCH' | 'BEARISH_CHOCH' | 'INTERNAL_CHOCH';
export type TrendDirection = 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'WEAK_BULLISH' | 'WEAK_BEARISH' | 'STRONG_BULLISH' | 'STRONG_BEARISH';
export type MarketRegime = 'TRENDING' | 'SIDEWAYS' | 'EXPANSION' | 'COMPRESSION' | 'ACCUMULATION' | 'DISTRIBUTION';

export interface TrendResult {
  direction: TrendDirection;
  strength: number; // 0-100
  ema200: number;
  kalmanSlope: number;
  adaptiveSlope: number;
  atr: number;
  trendStrength: number;
  explanation: string;
}

export interface SwingPoint {
  idx: number;
  price: number;
  time: string;
  type: 'HH' | 'HL' | 'LH' | 'LL';
}

export interface BOSEvent {
  type: 'bullish' | 'bearish';
  idx: number;
  time: string;
  swingPrice: number;
  swingTime: string;
  breakPrice: number;
  bodyRatio: number;
  strength: number;
  bosType: BosType;
  label: string;
}

export interface ChoCHEvent {
  type: 'bullish' | 'bearish';
  idx: number;
  time: string;
  price: number;
  chochType: ChoCHType;
  label: string;
}

export interface MarketStructureResult {
  swings: { highs: SwingPoint[]; lows: SwingPoint[] };
  bosEvents: BOSEvent[];
  chochEvents: ChoCHEvent[];
  currentStructure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  explanation: string;
}

// ===== Fair Value Gap =====
export type FVGState = 'FRESH' | 'PARTIALLY_FILLED' | 'FILLED' | 'INVALID';

export interface FVGZone {
  type: 'bullish' | 'bearish';
  bottom: number;
  top: number;
  gapSize: number;
  strength: number;
  candleIdx: number;
  time: string;
  state: FVGState;
  filledAt?: string;
  fillPercentage: number;
  explanation: string;
}

export interface FVGResult {
  zones: FVGZone[];
  freshBullish: FVGZone[];
  freshBearish: FVGZone[];
  explanation: string;
}

// ===== Order Block =====
export type OBType = 'BULLISH_OB' | 'BEARISH_OB';
export type OBState = 'ACTIVE' | 'MITIGATED' | 'INVALID';

export interface OrderBlock {
  type: OBType;
  idx: number;
  time: string;
  zoneTop: number;
  zoneBottom: number;
  zoneHeight: number;
  strength: number;
  state: OBState;
  mitigatedAt?: string;
  explanation: string;
}

export interface OrderBlockResult {
  orderBlocks: OrderBlock[];
  activeOBs: OrderBlock[];
  explanation: string;
}

// ===== Liquidity =====
export type LiquidityType = 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY' | 'LIQUIDITY_SWEEP' | 'LIQUIDITY_GRAB' | 'STOP_HUNT';

export interface LiquidityLevel {
  type: LiquidityType;
  price: number;
  idx: number;
  time: string;
  strength: number;
  label: string;
  explanation: string;
}

export interface LiquidityResult {
  levels: LiquidityLevel[];
  buySideLiquidity: LiquidityLevel[];
  sellSideLiquidity: LiquidityLevel[];
  sweeps: LiquidityLevel[];
  explanation: string;
}

// ===== Volume =====
export interface VolumeResult {
  spike: boolean;
  relativeVolume: number; // ratio to 20-candle average
  volumeStrength: number; // 0-100
  confirmation: boolean;
  breakoutConfirmation: boolean;
  explanation: string;
}

// ===== Regression =====
export interface RegressionChannel {
  upper: number[];
  middle: number[];
  lower: number[];
  slope: number;
  r2: number;
  projectedDirection: 'UP' | 'DOWN' | 'FLAT';
  width: number;
  explanation: string;
}

// ===== Probability =====
export interface ProbabilityScores {
  trend: number;      // 0-100
  volume: number;     // 0-100
  liquidity: number;  // 0-100
  structure: number;  // 0-100
  regression: number; // 0-100
  fvg: number;        // 0-100
  orderBlock: number; // 0-100
  momentum: number;   // 0-100
  atr: number;        // 0-100
  vwap: number;       // 0-100
}

export interface ProbabilityResult {
  longProbability: number;  // 0-100
  shortProbability: number; // 0-100
  confidenceScore: number;  // 0-100
  scores: ProbabilityScores;
  explanation: string;
}

// ===== Risk =====
export interface RiskResult {
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  expectedRR: number;
  riskPercent: number;
  positionSize: number;
  explanation: string;
}

// ===== Trade Quality =====
export type TradeRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'AVOID';

export interface TradeQualityResult {
  rating: TradeRating;
  score: number; // 0-100
  factors: Record<string, number>;
  explanation: string;
}

// ===== Entry Signal =====
export type EntrySignal = 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';

export interface EntryResult {
  signal: EntrySignal;
  probability: ProbabilityResult;
  risk: RiskResult;
  quality: TradeQualityResult;
  manipulation: ManipulationResult;
  entryPrice: number;
  explanation: string;
  reasons: string[];
}

// ===== Dashboard Data =====
export interface DashboardData {
  trend: TrendResult;
  marketStructure: MarketStructureResult;
  fvg: FVGResult;
  bos: BOSEvent[];
  choch: ChoCHEvent[];
  liquidity: LiquidityResult;
  volume: VolumeResult;
  regression: RegressionChannel;
  probability: ProbabilityResult;
  risk: RiskResult;
  quality: TradeQualityResult;
  manipulation: ManipulationResult;
  entry: EntryResult;
  marketRegime: MarketRegime;
  candleColor: CandleColor;
}

export type CandleColor = 'DARK_GREEN' | 'LIGHT_GREEN' | 'GRAY' | 'ORANGE' | 'RED';

// ===== Backtest =====
export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  rr: number;
  win: boolean;
  rating: TradeRating;
  manipulationScore: number;
  manipulationWarnings: string[];
}

export interface BacktestResult {
  trades: BacktestTrade[];
  winRate: number;
  profitFactor: number;
  expectancy: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  explanation: string;
}

// ===== Alert =====
export type AlertChannel = 'TRADINGVIEW' | 'WEBHOOK' | 'TELEGRAM' | 'DISCORD';

export interface AlertConfig {
  channel: AlertChannel;
  enabled: boolean;
  webhookUrl?: string;
  telegramBotId?: string;
  discordWebhook?: string;
  tradingviewAlertId?: string;
}

export interface AlertResult {
  triggered: boolean;
  signal: EntrySignal;
  confidence: number;
  message: string;
  channels: AlertChannel[];
  explanation: string;
}

// ===== RSI Divergence =====
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

// ===== Manipulation Detection =====
export type ManipulationType =
  | 'LIQUIDITY_SWEEP_FAKEOUT'
  | 'FALSE_BREAKOUT'
  | 'VOLUME_ANOMALY'
  | 'WICK_REJECTION'
  | 'OB_SWEEP'
  | 'FVG_MANIPULATION'
  | 'TIME_BASED_MANIPULATION';

export interface ManipulationSignal {
  type: ManipulationType;
  riskScore: number; // 0-100
  detected: boolean;
  details: string[];
  recommendation: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
}

export interface ManipulationResult {
  manipulationScore: number; // 0-100, higher = more risk
  isManipulated: boolean;
  confidence: number; // 0-100
  signals: ManipulationSignal[];
  filteredSignal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
  riskFactors: ManipulationSignal[];
  explanation: string;
}

// ===== Full Analysis =====
export interface HollowcatAnalysis {
  symbol: string;
  timeframe: string;
  analyzedAt: string;
  dashboard: DashboardData;
  rsiDivergence?: RSIDivergenceResult;
  backtest?: BacktestResult;
  manipulation?: ManipulationResult;
  alerts: AlertResult[];
}
