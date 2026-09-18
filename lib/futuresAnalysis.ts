// ══════════════════════════════════════════════════════════════════════════
//  FUTURES ANALYSIS — pure logic (shared client + server)
//
//  Sebelumnya seluruh logika ini hidup di components/crypto-scanner/
//  FuturesAnalysis.tsx yang ber-directive "use client", sehingga TIDAK BISA
//  diimpor dari API route / modul server. File ini memindahkan bagian pure
//  (tanpa React) ke lib/ supaya:
//    • komponen client tetap memakainya (di-re-export dari FuturesAnalysis.tsx
//      agar import lama `from './FuturesAnalysis'` tidak berubah), dan
//    • lib/sniperTelegramAlert.ts (server) bisa menghitung rekomendasi futures
//      yang SAMA PERSIS dengan panel "FUTURES RECOMMENDATION · $SYM/USDT PERP"
//      di halaman sniper-scanner — tidak ada duplikasi / drift rumus.
//
//  Isi dipindah apa adanya (verbatim) — tidak ada perubahan rumus.
// ══════════════════════════════════════════════════════════════════════════

export interface FuturesResult {
  direction: string;
  dirLabel: string;
  dirColor: string;
  dirEmoji: string;
  score: number;
  leverage: number;
  entry: string;
  tp1: string;
  tp2: string;
  sl: string;
  liqEstimate: string;
  riskPct: string;
  rewardPct: string;
  rrRatio: string;
  rsi: string;
  atrPct: string;
  volatilityLevel: string;
  confidence: string;
  factors: string[];
  support: string;
  resistance: string;
  isNeutral: boolean;
}

// Utility functions
function calcRSI(prices: number[], period: number = 14): number {
  if (!prices || prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcEMA(prices: number[], period: number): number {
  if (!prices || prices.length < period) return prices?.at(-1) || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcATR(prices: number[], period: number = 14): number {
  if (!prices || prices.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function formatNumber(num: number): string {
  if (!num || !Number.isFinite(num)) return '—';
  if (num >= 1000) return `$${(num/1000).toFixed(2)}K`;
  if (num >= 1) return `$${num.toFixed(3)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
}

export function getFuturesAnalysis(coin: any, marketChart: any = null): FuturesResult {
  const price = coin.current_price || 0;
  const ch1h = coin.price_change_percentage_1h_in_currency || 0;
  const ch24h = coin.price_change_percentage_24h || 0;
  const ch7d = coin.price_change_percentage_7d_in_currency || 0;
  const volRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0;

  // Ambil harga: utamakan marketChart (30d), fallback ke sparkline 7d
  const spark7d = coin.sparkline_in_7d?.price || [];
  const chartPrices = marketChart?.prices?.map((p: any) => p[1]) || [];
  const spark = chartPrices.length >= spark7d.length ? chartPrices : spark7d;

  // Estimasi ATR dari % changes jika tidak ada data historis
  function estimateAtrFromPct(): number {
    const daily24h = Math.abs(ch24h) / 100 * price;
    const daily7d = Math.abs(ch7d) / 7 / 100 * price;
    const est = (daily24h * 0.6 + daily7d * 0.4);
    return Math.max(est, price * 0.01);
  }

  // Indikator teknikal
  const rsi = calcRSI(spark, 14);
  const ema20 = calcEMA(spark, 20);
  const ema50 = calcEMA(spark, 50);
  const rawAtr = calcATR(spark, 14);
  const atr = rawAtr > 0 ? rawAtr : estimateAtrFromPct();
  const atrPct = price > 0 ? (atr / price) * 100 : 2;

  // Support / Resistance — gunakan swing high/low
  function calcSwingLevels(prices: number[], lookback: number = 20): { resist: number | null; support: number | null } | null {
    if (!prices || prices.length < lookback) return null;
    const recent = prices.slice(-lookback);
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = 1; i < recent.length - 1; i++) {
      if (recent[i] >= recent[i-1] && recent[i] >= recent[i+1]) highs.push(recent[i]);
      if (recent[i] <= recent[i-1] && recent[i] <= recent[i+1]) lows.push(recent[i]);
    }
    const aboveHighs = highs.filter(h => h > price).sort((a, b) => a - b);
    const belowLows = lows.filter(l => l < price).sort((a, b) => b - a);
    return {
      resist: aboveHighs[0] || null,
      support: belowLows[0] || null,
    };
  }

  const swings = spark.length > 20 ? calcSwingLevels(spark, 30) : null;

  // Fallback bertingkat
  const sorted = [...spark].sort((a, b) => a - b);
  const pct10 = spark.length > 10 ? sorted[Math.floor(sorted.length * 0.1)] : null;
  const pct90 = spark.length > 10 ? sorted[Math.floor(sorted.length * 0.9)] : null;

  const resist = (swings?.resist && swings.resist > price)
    ? swings.resist
    : (pct90 && pct90 > price)
      ? pct90
      : price * (1 + Math.max(Math.abs(ch7d) / 100 * 0.4, 0.03));

  const support = (swings?.support && swings.support < price)
    ? swings.support
    : (pct10 && pct10 < price)
      ? pct10
      : price * (1 - Math.max(Math.abs(ch7d) / 100 * 0.4, 0.03));

  const high7d = spark.length ? Math.max(...spark) : price * 1.1;
  const low7d = spark.length ? Math.min(...spark) : price * 0.9;

  // Skor sinyal
  let score = 0;
  const factors: string[] = [];

  // Faktor 1: Momentum 24h
  if (ch24h > 5) { score += 2; factors.push(`24h +${ch24h.toFixed(1)}% ↑↑`); }
  else if (ch24h > 1) { score += 1; factors.push(`24h +${ch24h.toFixed(1)}% ↑`); }
  else if (ch24h < -5) { score -= 2; factors.push(`24h ${ch24h.toFixed(1)}% ↓↓`); }
  else if (ch24h < -1) { score -= 1; factors.push(`24h ${ch24h.toFixed(1)}% ↓`); }

  // Faktor 2: Trend 7d
  if (ch7d > 10) { score += 2; factors.push(`7d +${ch7d.toFixed(0)}% ↑↑`); }
  else if (ch7d > 0) { score += 1; factors.push(`7d +${ch7d.toFixed(0)}% ↑`); }
  else if (ch7d < -10) { score -= 2; factors.push(`7d ${ch7d.toFixed(0)}% ↓↓`); }
  else if (ch7d < 0) { score -= 1; factors.push(`7d ${ch7d.toFixed(0)}% ↓`); }

  // Faktor 3: RSI
  if (rsi < 30) { score += 2; factors.push(`RSI ${rsi.toFixed(0)} oversold`); }
  else if (rsi < 45) { score += 1; factors.push(`RSI ${rsi.toFixed(0)} lemah`); }
  else if (rsi > 75) { score -= 2; factors.push(`RSI ${rsi.toFixed(0)} overbought`); }
  else if (rsi > 60) { score -= 1; factors.push(`RSI ${rsi.toFixed(0)} tinggi`); }

  // Faktor 4: EMA crossover
  if (ema20 > ema50) { score += 1; factors.push(`EMA20 > EMA50 bullish`); }
  else if (ema20 < ema50) { score -= 1; factors.push(`EMA20 < EMA50 bearish`); }

  // Faktor 5: Posisi harga terhadap Support/Resistance
  const distToResist = (resist - price) / price * 100;
  const distToSupport = (price - support) / price * 100;
  if (distToSupport < 1 && distToSupport >= 0) {
    score += 1; factors.push(`Harga dekat support`);
  } else if (distToSupport < 0) {
    score -= 2; factors.push(`Breakdown support ↓`);
  }
  if (distToResist < 0) {
    score += 1; factors.push(`Breakout resistance ↑`);
  } else if (distToResist < 2) {
    score -= 1; factors.push(`Harga dekat resistensi`);
  }

  // Faktor 6: Volume momentum
  if (volRatio > 0.2 && ch24h > 0) { score += 1; factors.push(`Volume spike + naik`); }
  if (volRatio > 0.2 && ch24h < 0) { score -= 1; factors.push(`Volume spike + turun`); }

  // Momentum 1h untuk konfirmasi
  const confirmedUp = ch1h > 0.5 && score > 0;
  const confirmedDown = ch1h < -0.5 && score < 0;

  // Tentukan arah
  let direction, dirLabel, dirColor, dirEmoji;
  if (score >= 3) {
    direction = 'long'; dirLabel = 'LONG'; dirColor = '#22c55e'; dirEmoji = '🟢';
  } else if (score <= -3) {
    direction = 'short'; dirLabel = 'SHORT'; dirColor = '#ef4444'; dirEmoji = '🔴';
  } else if (score >= 1) {
    direction = 'long_weak'; dirLabel = 'LONG (Lemah)'; dirColor = '#86efac'; dirEmoji = '↗️';
  } else if (score <= -1) {
    direction = 'short_weak'; dirLabel = 'SHORT (Lemah)'; dirColor = '#fca5a5'; dirEmoji = '↘️';
  } else {
    direction = 'neutral'; dirLabel = 'NETRAL / Hindari'; dirColor = '#94a3b8'; dirEmoji = '⚪';
  }

  // Leverage optimal berdasarkan volatilitas
  let leverage;
  if (atrPct > 6) leverage = 2;
  else if (atrPct > 4) leverage = 3;
  else if (atrPct > 2.5) leverage = 5;
  else if (atrPct > 1.5) leverage = 7;
  else leverage = 10;

  if (direction === 'neutral') leverage = 1;
  if (direction.includes('weak')) leverage = Math.min(leverage, 3);

  // Hitung entry, TP, SL berdasarkan ATR
  const atrBuffer = atr * 0.5;
  let entry, tp1, tp2, sl, liqEstimate;
  const rr = 2.0;

  if (direction === 'long' || direction === 'long_weak') {
    entry = price;
    const slByAtr = price - atr * 1.5;
    const slBySupport = support < price ? support * 0.995 : slByAtr;
    sl = Math.max(slByAtr, slBySupport);
    if (sl >= entry) sl = entry - atr * 1.5;
    const risk = entry - sl;
    tp1 = entry + risk * rr;
    tp2 = entry + risk * rr * 1.8;
    liqEstimate = entry * (1 - (1 / leverage) * 0.9);
  } else if (direction === 'short' || direction === 'short_weak') {
    entry = price;
    const slByAtr = price + atr * 1.5;
    const slByResist = resist > price ? resist * 1.005 : slByAtr;
    sl = Math.min(slByAtr, slByResist);
    if (sl <= entry) sl = entry + atr * 1.5;
    const risk = sl - entry;
    tp1 = entry - risk * rr;
    tp2 = entry - risk * rr * 1.8;
    tp1 = Math.max(tp1, 0);
    tp2 = Math.max(tp2, 0);
    liqEstimate = entry * (1 + (1 / leverage) * 0.9);
  } else {
    entry = tp1 = tp2 = sl = liqEstimate = price;
  }

  tp1 = Math.max(tp1 ?? 0, 0);
  tp2 = Math.max(tp2 ?? 0, 0);
  sl = Math.max(sl ?? 0, 0);

  // Hitung risk & reward dalam %
  const riskPct = entry > 0 ? Math.abs(entry - sl) / entry * 100 : 0;
  const rewardPct = entry > 0 ? Math.abs(tp1 - entry) / entry * 100 : 0;
  const rrRatio = riskPct > 0 ? (rewardPct / riskPct).toFixed(2) : 'N/A';

  // Level volatilitas
  let volatilityLevel;
  if (atrPct > 6) volatilityLevel = 'Sangat Tinggi 🔴';
  else if (atrPct > 3.5) volatilityLevel = 'Tinggi 🟠';
  else if (atrPct > 2) volatilityLevel = 'Sedang 🟡';
  else volatilityLevel = 'Rendah 🟢';

  // Confidence level
  const absScore = Math.abs(score);
  let confidence;
  if (absScore >= 5 && (confirmedUp || confirmedDown)) confidence = 'Tinggi ✅';
  else if (absScore >= 3) confidence = 'Sedang 📊';
  else if (absScore >= 1) confidence = 'Lemah ⚠️';
  else confidence = 'Tidak ada ❌';

  return {
    direction,
    dirLabel,
    dirColor,
    dirEmoji,
    score,
    leverage,
    entry: formatNumber(entry),
    tp1: formatNumber(tp1),
    tp2: formatNumber(tp2),
    sl: formatNumber(sl),
    liqEstimate: formatNumber(liqEstimate),
    riskPct: riskPct.toFixed(2),
    rewardPct: rewardPct.toFixed(2),
    rrRatio,
    rsi: rsi.toFixed(0),
    atrPct: atrPct.toFixed(2),
    volatilityLevel,
    confidence,
    factors,
    support: formatNumber(support),
    resistance: formatNumber(resist),
    isNeutral: direction === 'neutral',
  };
}
