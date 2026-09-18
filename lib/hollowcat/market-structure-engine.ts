/**
 * Market Structure Engine
 * Detects Higher High, Higher Low, Lower High, Lower Low
 * Break of Structure (BOS), Change of Character (CHoCH), Internal/External BOS
 */

import type { Candle, SwingPoint, BOSEvent, ChoCHEvent, MarketStructureResult, BosType } from './types';

export const MarketStructureEngine = {
  /**
   * Main market structure analysis
   */
  analyze(candles: Candle[], swingLookback: number = 5): MarketStructureResult {
    if (candles.length < 20) {
      return {
        swings: { highs: [], lows: [] },
        bosEvents: [],
        chochEvents: [],
        currentStructure: 'NEUTRAL',
        explanation: 'Need at least 20 candles for market structure analysis',
      };
    }

    const swings = this.detectSwings(candles, swingLookback);
    const bosEvents = this.detectBOS(candles, swings);
    const chochEvents = this.detectChoCH(candles, swings);
    const currentStructure = this.determineStructure(bosEvents, chochEvents);
    const explanation = this.buildExplanation(swings, bosEvents, chochEvents, currentStructure);

    return {
      swings,
      bosEvents,
      chochEvents,
      currentStructure,
      explanation,
    };
  },

  /**
   * Detect swing highs and swing lows
   * HH = Higher High, HL = Higher Low, LH = Lower High, LL = Lower Low
   */
  detectSwings(candles: Candle[], lookback: number): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const c = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= c.high) isHigh = false;
        if (candles[i + j].high >= c.high) isHigh = false;
        if (candles[i - j].low <= c.low) isLow = false;
        if (candles[i + j].low <= c.low) isLow = false;
      }

      if (isHigh) {
        const type = this.classifySwingHigh(candles, i, highs, lows);
        highs.push({ idx: i, price: c.high, time: c.time, type });
      }
      if (isLow) {
        const type = this.classifySwingLow(candles, i, highs, lows);
        lows.push({ idx: i, price: c.low, time: c.time, type });
      }
    }

    return { highs, lows };
  },

  /**
   * Classify swing high as HH or LH
   */
  classifySwingHigh(candles: Candle[], idx: number, prevHighs: SwingPoint[], prevLows: SwingPoint[]): 'HH' | 'LH' {
    if (prevHighs.length === 0) return 'HH';
    const lastHigh = prevHighs[prevHighs.length - 1];
    return candles[idx].high > lastHigh.price ? 'HH' : 'LH';
  },

  /**
   * Classify swing low as HL or LL
   */
  classifySwingLow(candles: Candle[], idx: number, prevHighs: SwingPoint[], prevLows: SwingPoint[]): 'HL' | 'LL' {
    if (prevLows.length === 0) return 'HL';
    const lastLow = prevLows[prevLows.length - 1];
    return candles[idx].low > lastLow.price ? 'HL' : 'LL';
  },

  /**
   * Detect Break of Structure (BOS)
   * Internal BOS: within current structure
   * External BOS: breaks out of previous structure
   */
  detectBOS(candles: Candle[], swings: { highs: SwingPoint[]; lows: SwingPoint[] }): BOSEvent[] {
    const events: BOSEvent[] = [];

    // Bullish BOS: price breaks above a swing high
    for (let i = 0; i < swings.highs.length; i++) {
      const sh = swings.highs[i];
      for (let j = sh.idx + 1; j < candles.length; j++) {
        const c = candles[j];
        if (c.close > sh.price) {
          const body = Math.abs(c.close - c.open);
          const range = c.high - c.low || 0.0001;
          const bosType = this._determineBOSType(candles, j, swings, 'bullish');

          events.push({
            type: 'bullish',
            idx: j,
            time: c.time,
            swingPrice: sh.price,
            swingTime: sh.time,
            breakPrice: c.close,
            bodyRatio: body / range,
            strength: ((c.close - sh.price) / sh.price) * 100,
            bosType,
            label: `${bosType} Bullish BOS`,
          });
          break;
        }
      }
    }

    // Bearish BOS: price breaks below a swing low
    for (let i = 0; i < swings.lows.length; i++) {
      const sl = swings.lows[i];
      for (let j = sl.idx + 1; j < candles.length; j++) {
        const c = candles[j];
        if (c.close < sl.price) {
          const body = Math.abs(c.close - c.open);
          const range = c.high - c.low || 0.0001;
          const bosType = this._determineBOSType(candles, j, swings, 'bearish');

          events.push({
            type: 'bearish',
            idx: j,
            time: c.time,
            swingPrice: sl.price,
            swingTime: sl.time,
            breakPrice: c.close,
            bodyRatio: body / range,
            strength: ((sl.price - c.close) / sl.price) * 100,
            bosType,
            label: `${bosType} Bearish BOS`,
          });
          break;
        }
      }
    }

    return events.sort((a, b) => a.idx - b.idx);
  },

  /**
   * Determine if BOS is internal or external
   */
  _determineBOSType(
    candles: Candle[],
    breakIdx: number,
    swings: { highs: SwingPoint[]; lows: SwingPoint[] },
    direction: 'bullish' | 'bearish'
  ): BosType {
    // Check if there's a prior swing in the same direction
    const relevantSwings = direction === 'bullish' ? swings.highs : swings.lows;
    const priorSwings = relevantSwings.filter(s => s.idx < breakIdx);

    if (priorSwings.length >= 2) {
      // Check if this breaks the most recent swing
      const lastSwing = priorSwings[priorSwings.length - 1];
      const secondLastSwing = priorSwings[priorSwings.length - 2];

      if (direction === 'bullish' && breakIdx > lastSwing.idx) {
        // External BOS if it breaks beyond the previous swing high
        return candles[breakIdx].close > secondLastSwing.price ? 'EXTERNAL_BOS' : 'INTERNAL_BOS';
      }
      if (direction === 'bearish' && breakIdx > lastSwing.idx) {
        return candles[breakIdx].close < secondLastSwing.price ? 'EXTERNAL_BOS' : 'INTERNAL_BOS';
      }
    }

    return 'BOS';
  },

  /**
   * Detect Change of Character (CHoCH)
   * Bullish CHoCH: lower low followed by higher low (structure shift from bearish to bullish)
   * Bearish CHoCH: higher high followed by lower high (structure shift from bullish to bearish)
   */
  detectChoCH(candles: Candle[], swings: { highs: SwingPoint[]; lows: SwingPoint[] }): ChoCHEvent[] {
    const events: ChoCHEvent[] = [];

    // Bullish CHoCH: sequence of lower lows then a higher low
    for (let i = 2; i < swings.lows.length; i++) {
      const ll1 = swings.lows[i - 2]; // First low
      const ll2 = swings.lows[i - 1]; // Second low (lower)
      const hl = swings.lows[i];       // Third low (higher = change of character)

      if (ll2.price < ll1.price && hl.price > ll2.price) {
        events.push({
          type: 'bullish',
          idx: hl.idx,
          time: hl.time,
          price: hl.price,
          chochType: 'BULLISH_CHOCH',
          label: 'Bullish CHoCH - Structure shift to bullish',
        });
      }
    }

    // Bearish CHoCH: sequence of higher highs then a lower high
    for (let i = 2; i < swings.highs.length; i++) {
      const hh1 = swings.highs[i - 2]; // First high
      const hh2 = swings.highs[i - 1]; // Second high (higher)
      const lh = swings.highs[i];       // Third high (lower = change of character)

      if (hh2.price > hh1.price && lh.price < hh2.price) {
        events.push({
          type: 'bearish',
          idx: lh.idx,
          time: lh.time,
          price: lh.price,
          chochType: 'BEARISH_CHOCH',
          label: 'Bearish CHoCH - Structure shift to bearish',
        });
      }
    }

    // Internal CHoCH: within the same structure
    for (let i = 1; i < swings.lows.length; i++) {
      const prev = swings.lows[i - 1];
      const curr = swings.lows[i];
      if (curr.price > prev.price && curr.idx - prev.idx < 10) {
        events.push({
          type: 'bullish',
          idx: curr.idx,
          time: curr.time,
          price: curr.price,
          chochType: 'INTERNAL_CHOCH',
          label: 'Internal Bullish CHoCH',
        });
      }
    }

    for (let i = 1; i < swings.highs.length; i++) {
      const prev = swings.highs[i - 1];
      const curr = swings.highs[i];
      if (curr.price < prev.price && curr.idx - prev.idx < 10) {
        events.push({
          type: 'bearish',
          idx: curr.idx,
          time: curr.time,
          price: curr.price,
          chochType: 'INTERNAL_CHOCH',
          label: 'Internal Bearish CHoCH',
        });
      }
    }

    return events.sort((a, b) => a.idx - b.idx);
  },

  /**
   * Determine overall market structure
   */
  determineStructure(bosEvents: BOSEvent[], chochEvents: ChoCHEvent[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const recentBOS = bosEvents.slice(-5);
    const recentChoCH = chochEvents.slice(-3);

    let bullishScore = 0;
    let bearishScore = 0;

    for (const bos of recentBOS) {
      if (bos.type === 'bullish') bullishScore += 2;
      else bearishScore += 2;
    }

    for (const choch of recentChoCH) {
      if (choch.type === 'bullish') bullishScore += 1;
      else bearishScore += 1;
    }

    if (bullishScore > bearishScore + 1) return 'BULLISH';
    if (bearishScore > bullishScore + 1) return 'BEARISH';
    return 'NEUTRAL';
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    swings: { highs: SwingPoint[]; lows: SwingPoint[] },
    bosEvents: BOSEvent[],
    chochEvents: ChoCHEvent[],
    structure: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  ): string {
    const parts: string[] = [];
    parts.push(`Market Structure: ${structure}`);
    parts.push(`Swing Highs: ${swings.highs.length}, Swing Lows: ${swings.lows.length}`);
    parts.push(`BOS Events: ${bosEvents.length}, CHoCH Events: ${chochEvents.length}`);

    if (bosEvents.length > 0) {
      const lastBos = bosEvents[bosEvents.length - 1];
      parts.push(`Last BOS: ${lastBos.type === 'bullish' ? 'Bullish' : 'Bearish'} at ${lastBos.breakPrice.toFixed(4)} (${lastBos.bosType})`);
    }

    if (chochEvents.length > 0) {
      const lastChoCH = chochEvents[chochEvents.length - 1];
      parts.push(`Last CHoCH: ${lastChoCH.type === 'bullish' ? 'Bullish' : 'Bearish'} at ${lastChoCH.price.toFixed(4)}`);
    }

    return parts.join(' | ');
  },
};
