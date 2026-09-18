// ─── Meme Coin Intelligence Types ───────────────────────────────

export type Narrative =
  | 'PEPE'
  | 'DOG'
  | 'CAT'
  | 'AI'
  | 'POLITICAL'
  | 'SPORTS'
  | 'GAMING'
  | 'FOOD'
  | 'ART'
  | 'MUSIC'
  | 'MEME'

export type Signal = 'STRONG BUY' | 'CONDITIONAL BUY' | 'WATCH' | 'WAIT' | 'AVOID' | 'EXIT WATCH'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type EntryPhase = 'EARLY' | 'CURRENT' | 'LATE'

/**
 * Bucket radar — ditentukan server-side dari data live (mcap + kurva bonding
 * pump.fun + RugCheck), BUKAN dari daftar coin hardcoded.
 *  - NEW_BONDING   : progress kurva ≥ 15% dan mcap masih ≤ $10k
 *  - BONDING_RADAR : progress kurva 35–99% dan mcap ≥ $10k
 *  - MOMENTUM      : mcap ≥ $10k + ada gerak volume (vol5m & txns5m)
 *  - NONE          : tidak lolos salah satu aturan di atas (alasan di bucketReason)
 */
export type MemeBucket = 'NEW_BONDING' | 'BONDING_RADAR' | 'MOMENTUM' | 'NONE'

/** Tahap hidup token terhadap kurva bonding pump.fun. */
export type BondingStage = 'BONDING' | 'GRADUATED' | 'UNKNOWN'

/** Status gerbang konsentrasi holder (top-10 ≤ 25%, vault/locker/creator/insider dikecualikan). */
export type HolderGate = 'PASS' | 'FAIL' | 'UNKNOWN'

export interface AIScoreBreakdown {
  liquidity: number
  volume_acceleration: number
  buy_sell_ratio: number
  price_momentum: number
  holder_growth: number
  smart_money: number
  narrative_momentum: number
  entry_timing: number
  market_structure: number
  risk_adjustment: number
}

export interface RiskLevels {
  liquidity: RiskLevel
  holder: RiskLevel
  deployer: RiskLevel
  exit: RiskLevel
  cluster: RiskLevel
}

export interface MemeToken {
  address: string
  symbol: string
  name: string
  price: number
  priceChange1h: number
  priceChange24h: number
  priceChange7d: number
  liquidity: number
  liquidityChange1h: number
  volume1h: number
  volume24h: number
  volumeAcceleration: number
  buys1h: number
  sells1h: number
  buySellRatio: string
  uniqueBuyers: number
  uniqueSellers: number
  holderCount: number
  smartMoneyInflow: number
  smartMoneyCount: number
  topHolderConcentration: number
  deployerExposure: number
  sniperActivity: 'LOW' | 'MEDIUM' | 'HIGH'
  earlyBuyerQuality: number
  narrative: Narrative
  narrativeMomentum: number
  aiScore: number
  aiConfidence: number
  aiSignal: Signal
  aiBreakdown: AIScoreBreakdown
  riskScore: number
  riskFlags: string[]
  riskLevels: RiskLevels
  entryQuality: number
  entryPhase: EntryPhase
  entryReasons: string[]
  exitPressure: number
  exitLevel: RiskLevel
  exitReasons: string[]
  dexUrl: string
  pairAddress: string
  createdAt: string
  age: number // minutes
  source: string
  freshness: string

  // ─── Data live tambahan (pass-through dari feed, sebelumnya dibuang) ───
  mcap: number
  dexId: string
  phase: string
  logoUrl: string
  // Data 5m dari feed live (dex-feed proxy) — dipakai oleh
  // estimateAlertFromToken di lib/memeScanner.ts untuk menghitung
  // organicPct (feed tidak menyediakan uniqueBuyers / buys1h).
  buys5m: number
  sells5m: number
  vol5m: number
  ch5m: number
  txns5m: number
  ageFmt: string
  isBoosted: boolean

  // ─── Kurva bonding pump.fun (dihitung deterministik dari mcap + harga SOL) ───
  bondingProgress: number      // 0–100 (% SOL terkumpul menuju graduation 85 SOL)
  bondingRaisedSol: number     // SOL yang sudah terkumpul di kurva
  bondingStage: BondingStage
  solPriceUsd: number          // harga SOL yang dipakai menghitung (0 = tidak tersedia)

  // ─── Bucket radar + gerbang holder (RugCheck) ───
  bucket: MemeBucket
  bucketReason: string
  top10HolderPct: number       // top-10 holder SETELAH vault/locker/creator/insider dikecualikan
  top10RawPct: number          // top-10 holder mentah (termasuk vault AMM/LP)
  totalHolders: number
  lpLockedPct: number
  deployerPct: number
  insiderPct: number
  rugScore: number
  rugRisks: string[]
  rugged: boolean
  holderGate: HolderGate
  holderDataAge: number        // detik sejak data holder diambil (-1 = tidak ada data)
}

export interface MemeWallet {
  id: string
  address: string
  shortAddr: string
  label: string
  dna: string
  confidence: number
  roi30d: string
  winRate: number
  avgROI: number
  medianROI: number
  avgHoldingTime: string
  medianHoldingTime: string
  avgEntryMc: string
  avgExitMc: string
  tradeCount: number
  successfulTrades: number
  failedTrades: number
  preferredCategories: string[]
  preferredLaunchAge: string
  preferredLiquidityRange: string
  avgPositionSize: string
  buyingBehavior: string
  sellingBehavior: string
  scalingBehavior: string
  convictionBehavior: string
  smartMoneyScore: number
  lastActive: string
  isProfit: boolean
  solValue: number
  profitLoss: number
  sparkline: number[]
  recentTrades?: {
    id: string
    token: string
    isWin: boolean
    roi: number
    entryPrice: number
    exitPrice: number
  }[]
}

export interface NarrativeData {
  name: string
  narrative: Narrative
  velocity: number
  tokensLaunched: number
  volumeGrowth: number
  smartMoneyParticipation: number
  state: 'EARLY' | 'ACCELERATING' | 'PEAKING' | 'DECLINING'
  tokens: MemeToken[]
}

export interface MoneyFlowData {
  smartMoney: { amount: number; direction: 'in' | 'out'; velocity: number }
  whales: { amount: number; direction: 'in' | 'out'; velocity: number }
  retail: { amount: number; direction: 'in' | 'out'; velocity: number }
  exits: { amount: number; direction: 'in' | 'out'; velocity: number }
  flowVelocity: number
  flowMomentum: number
  timestamp: string
}

export interface RiskEvent {
  id: string
  token: string
  tokenAddress: string
  type: 'LIQUIDITY_REMOVAL' | 'DEPLOYER_SELL' | 'COORDINATED_EXIT' | 'BUNDLED_SUPPLY' | 'SUSPICIOUS_FUNDING' | 'RAPID_ROTATION' | 'ABNORMAL_SELL' | 'HOLDER_CONCENTRATION'
  severity: RiskLevel
  description: string
  detectedAt: string
  details: string
}
