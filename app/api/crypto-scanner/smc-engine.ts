/**
 * SMC Engine - Smart Money Concepts Analysis
 */

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type FVGZone = {
  type: 'bullish' | 'bearish';
  bottom: number;
  top: number;
  gapSize: number;
  strength: number;
  candleIdx: number;
  time: string;
  filled: boolean;
  filledAt?: string;
};

type SwingPoint = {
  idx: number;
  price: number;
  time: string;
};

type BOSEvent = {
  type: 'bullish' | 'bearish';
  idx: number;
  time: string;
  swingPrice: number;
  swingTime: string;
  breakPrice: number;
  bodyRatio: number;
  strength: number;
};

type ManipulationWarning = {
  type: string;
  riskScore: number;
  details: string[];
};

type Signal = {
  signal: 'LONG' | 'SHORT' | 'NONE';
  confidence: number;
  reason: string;
  entryZone?: { low: number; high: number };
  bos?: BOSEvent;
  fvg?: FVGZone;
  scores?: Record<string, number>;
  manipulationScore?: number;
  manipulationWarnings?: ManipulationWarning[];
  filteredSignal?: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
};

type AnalysisResult = {
  fvgZones: FVGZone[];
  swings: { highs: SwingPoint[]; lows: SwingPoint[] };
  bosEvents: BOSEvent[];
  signal: Signal;
  manipulation?: {
    score: number;
    isManipulated: boolean;
    warnings: ManipulationWarning[];
  };
  meta: {
    candleCount: number;
    fvgCount: number;
    unfilledFvg: number;
    bosCount: number;
    swingHighCount: number;
    swingLowCount: number;
    analyzedAt: string;
  };
};

export const SmcEngine = {
  analyze(candles: Candle[], options: any = {}): AnalysisResult {
    const { minGapMultiplier = 0.5, swingLookback = 2 } = options;

    if (!Array.isArray(candles) || candles.length < 10) {
      return {
        fvgZones: [],
        swings: { highs: [], lows: [] },
        bosEvents: [],
        signal: { signal: 'NONE', confidence: 0, reason: 'Need at least 10 candles' },
        meta: {
          candleCount: candles?.length || 0,
          fvgCount: 0,
          unfilledFvg: 0,
          bosCount: 0,
          swingHighCount: 0,
          swingLowCount: 0,
          analyzedAt: new Date().toISOString(),
        },
      };
    }

    const fvgZones = this.detectFVG(candles, minGapMultiplier);
    const swings = this.detectSwings(candles, swingLookback);
    const bosEvents = this.detectBOS(candles, swings);
    const signal = this.generateSignal(candles, fvgZones, bosEvents);
    
    // Run manipulation detection
    const manipulation = this.detectManipulation(candles, signal.signal, bosEvents, fvgZones);

    // Filter signal based on manipulation
    let filteredSignal: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE' | undefined = signal.signal as 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE' | undefined;
    if (manipulation.score > 70) {
      filteredSignal = 'WAIT';
    } else if (manipulation.score > 50 && manipulation.warnings.length > 0) {
      filteredSignal = 'WAIT';
    }

    return {
      fvgZones,
      swings,
      bosEvents,
      signal: {
        ...signal,
        manipulationScore: manipulation.score,
        manipulationWarnings: manipulation.warnings,
        filteredSignal: filteredSignal !== signal.signal ? filteredSignal : undefined,
      },
      manipulation: manipulation.score > 30 ? {
        score: manipulation.score,
        isManipulated: manipulation.isManipulated,
        warnings: manipulation.warnings,
      } : undefined,
      meta: {
        candleCount: candles.length,
        fvgCount: fvgZones.length,
        unfilledFvg: fvgZones.filter((z: FVGZone) => !z.filled).length,
        bosCount: bosEvents.length,
        swingHighCount: swings.highs.length,
        swingLowCount: swings.lows.length,
        analyzedAt: new Date().toISOString(),
      },
    };
  },

  calcATR(candles: Candle[]): number {
    if (candles.length < 2) return 1;
    let sum = 0;
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    return sum / (candles.length - 1) || 1;
  },

  detectFVG(candles: Candle[], minGapMultiplier: number): FVGZone[] {
    const zones: FVGZone[] = [];
    const atr = this.calcATR(candles.slice(0, Math.min(14, candles.length)));

    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const next = candles[i + 1];

      // Bullish FVG: gap between prev high and next low
      if (next.low > prev.high && next.low - prev.high >= atr * minGapMultiplier) {
        zones.push({
          type: 'bullish',
          bottom: prev.high,
          top: next.low,
          gapSize: next.low - prev.high,
          strength: (next.low - prev.high) / atr,
          candleIdx: i,
          time: curr.time,
          filled: false,
        });
      }

      // Bearish FVG: gap between next high and prev low
      if (next.high < prev.low && prev.low - next.high >= atr * minGapMultiplier) {
        zones.push({
          type: 'bearish',
          bottom: next.high,
          top: prev.low,
          gapSize: prev.low - next.high,
          strength: (prev.low - next.high) / atr,
          candleIdx: i,
          time: curr.time,
          filled: false,
        });
      }
    }

    // Mark filled zones
    for (const zone of zones) {
      for (let i = zone.candleIdx + 1; i < candles.length; i++) {
        const c = candles[i];
        if (zone.type === 'bullish' && c.low <= zone.bottom) {
          zone.filled = true;
          zone.filledAt = c.time;
          break;
        }
        if (zone.type === 'bearish' && c.high >= zone.top) {
          zone.filled = true;
          zone.filledAt = c.time;
          break;
        }
      }
    }

    return zones;
  },

  detectSwings(candles: Candle[], lookback: number): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const c = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
        if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
      }

      if (isHigh) highs.push({ idx: i, price: c.high, time: c.time });
      if (isLow) lows.push({ idx: i, price: c.low, time: c.time });
    }

    return { highs, lows };
  },

  detectBOS(candles: Candle[], swings: { highs: SwingPoint[]; lows: SwingPoint[] }): BOSEvent[] {
    const events: BOSEvent[] = [];

    for (const sh of swings.highs) {
      for (let i = sh.idx + 1; i < candles.length; i++) {
        const c = candles[i];
        if (c.close > sh.price) {
          const body = Math.abs(c.close - c.open);
          const range = c.high - c.low || 0.0001;
          events.push({
            type: 'bullish',
            idx: i,
            time: c.time,
            swingPrice: sh.price,
            swingTime: sh.time,
            breakPrice: c.close,
            bodyRatio: body / range,
            strength: ((c.close - sh.price) / sh.price) * 100,
          });
          break;
        }
      }
    }

    for (const sl of swings.lows) {
      for (let i = sl.idx + 1; i < candles.length; i++) {
        const c = candles[i];
        if (c.close < sl.price) {
          const body = Math.abs(c.close - c.open);
          const range = c.high - c.low || 0.0001;
          events.push({
            type: 'bearish',
            idx: i,
            time: c.time,
            swingPrice: sl.price,
            swingTime: sl.time,
            breakPrice: c.close,
            bodyRatio: body / range,
            strength: ((sl.price - c.close) / sl.price) * 100,
          });
          break;
        }
      }
    }

    return events.sort((a, b) => a.idx - b.idx);
  },

  detectManipulation(
    candles: Candle[],
    signal: 'LONG' | 'SHORT' | 'NONE',
    bosEvents: BOSEvent[],
    fvgZones: FVGZone[]
  ): { score: number; isManipulated: boolean; warnings: { type: string; riskScore: number; details: string[] }[] } {
    const warnings: { type: string; riskScore: number; details: string[] }[] = [];
    let totalScore = 0;

    if (signal === 'NONE') {
      return { score: 0, isManipulated: false, warnings: [] };
    }

    // 1. Detect false breakout
    const recentBOS = bosEvents.filter(b => b.idx >= candles.length - 8);
    for (const bos of recentBOS) {
      const candlesAfter = candles.slice(bos.idx + 1);
      if (candlesAfter.length >= 3) {
        const reversed = bos.type === 'bullish'
          ? candlesAfter.slice(0, 3).some(c => c.close < bos.breakPrice)
          : candlesAfter.slice(0, 3).some(c => c.close > bos.breakPrice);
        
        if (reversed) {
          warnings.push({
            type: 'FALSE_BREAKOUT',
            riskScore: 80,
            details: [`BOS at ${bos.breakPrice.toFixed(4)} reversed within 3 candles`],
          });
          totalScore += 80;
        }
      }
    }

    // 2. Detect volume anomaly
    const lastCandle = candles[candles.length - 1];
    const avgVolume = candles.slice(-20).reduce((s, c) => s + (c.volume || 0), 0) / 20;
    const relativeVolume = (lastCandle.volume || 0) / (avgVolume || 1);
    
    if (relativeVolume > 2.5) {
      const priceMove = Math.abs(lastCandle.close - lastCandle.open);
      const avgMove = candles.slice(-10).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 10;
      
      if (priceMove < avgMove * 0.5) {
        warnings.push({
          type: 'VOLUME_ANOMALY',
          riskScore: 65,
          details: [`Volume spike (${relativeVolume.toFixed(1)}x) without proportional price movement`],
        });
        totalScore += 65;
      }
    }

    // 3. Detect wick rejection
    const recentCandles = candles.slice(-5);
    for (const candle of recentCandles) {
      const bodySize = Math.abs(candle.close - candle.open);
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const totalRange = candle.high - candle.low;

      if (totalRange > 0) {
        const upperWickRatio = upperWick / totalRange;
        const lowerWickRatio = lowerWick / totalRange;

        if (signal === 'LONG' && upperWickRatio > 0.6 && bodySize / totalRange < 0.3) {
          warnings.push({
            type: 'WICK_REJECTION',
            riskScore: 55,
            details: [`Bearish wick rejection at ${candle.high.toFixed(4)}`],
          });
          totalScore += 55;
          break;
        }

        if (signal === 'SHORT' && lowerWickRatio > 0.6 && bodySize / totalRange < 0.3) {
          warnings.push({
            type: 'WICK_REJECTION',
            riskScore: 55,
            details: [`Bullish wick rejection at ${candle.low.toFixed(4)}`],
          });
          totalScore += 55;
          break;
        }
      }
    }

    // 4. Detect FVG manipulation
    for (const fvg of fvgZones) {
      if (fvg.filled) continue;
      
      const filledRecently = candles.slice(-5).some(c => {
        if (fvg.type === 'bullish') return c.low <= fvg.bottom;
        return c.high >= fvg.top;
      });

      if (filledRecently) {
        warnings.push({
          type: 'FVG_MANIPULATION',
          riskScore: 70,
          details: [`FVG at ${fvg.bottom.toFixed(4)}-${fvg.top.toFixed(4)} was recently filled`],
        });
        totalScore += 70;
        break;
      }
    }

    // 5. Time-based manipulation
    const hour = new Date(lastCandle.time).getUTCHours();
    const lowLiquidityHours = [0, 1, 2, 3, 4, 5, 6, 7, 12, 13];
    if (lowLiquidityHours.includes(hour)) {
      warnings.push({
        type: 'TIME_BASED_MANIPULATION',
        riskScore: 40,
        details: [`Low liquidity period (${hour}:00 UTC)`],
      });
      totalScore += 40;
    }

    const avgScore = warnings.length > 0 ? totalScore / warnings.length : 0;
    const isManipulated = avgScore > 60;

    return {
      score: Math.min(100, Math.round(avgScore)),
      isManipulated,
      warnings,
    };
  },

  generateSignal(candles: Candle[], fvgZones: FVGZone[], bosEvents: BOSEvent[]): Signal {
    if (bosEvents.length === 0) {
      return { signal: 'NONE', confidence: 0, reason: 'No BOS detected' };
    }

    const lastBos = bosEvents[bosEvents.length - 1];
    const lastClose = candles[candles.length - 1].close;
    const unfilledFvgs = fvgZones.filter((z) => !z.filled);

    if (lastBos.type === 'bullish') {
      const matchFvg = unfilledFvgs.find(
        (z) => z.type === 'bullish' && lastClose >= z.bottom && lastClose <= z.top
      );
      const confidence = Math.min(95, 50 + lastBos.strength * 5 + (matchFvg ? 20 : 0));
      return {
        signal: 'LONG',
        confidence,
        reason: `Bullish BOS at ${lastBos.breakPrice.toFixed(4)}${matchFvg ? ' + FVG entry' : ''}`,
        entryZone: matchFvg ? { low: matchFvg.bottom, high: matchFvg.top } : undefined,
        bos: lastBos,
        fvg: matchFvg,
        scores: { bos: lastBos.strength, fvg: matchFvg?.strength ?? 0, bodyRatio: lastBos.bodyRatio * 100 },
      };
    }

    const matchFvg = unfilledFvgs.find(
      (z) => z.type === 'bearish' && lastClose >= z.bottom && lastClose <= z.top
    );
    const confidence = Math.min(95, 50 + lastBos.strength * 5 + (matchFvg ? 20 : 0));
    return {
      signal: 'SHORT',
      confidence,
      reason: `Bearish BOS at ${lastBos.breakPrice.toFixed(4)}${matchFvg ? ' + FVG resistance' : ''}`,
      entryZone: matchFvg ? { low: matchFvg.bottom, high: matchFvg.top } : undefined,
      bos: lastBos,
      fvg: matchFvg,
      scores: { bos: lastBos.strength, fvg: matchFvg?.strength ?? 0, bodyRatio: lastBos.bodyRatio * 100 },
    };
  },
};
