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

type Signal = {
  signal: 'LONG' | 'SHORT' | 'NONE';
  confidence: number;
  reason: string;
  entryZone?: { low: number; high: number };
  bos?: BOSEvent;
  fvg?: FVGZone;
  scores?: Record<string, number>;
};

type AnalysisResult = {
  fvgZones: FVGZone[];
  swings: { highs: SwingPoint[]; lows: SwingPoint[] };
  bosEvents: BOSEvent[];
  signal: Signal;
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

    return {
      fvgZones,
      swings,
      bosEvents,
      signal,
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
