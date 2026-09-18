'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  SeriesMarker,
  Time,
  ColorType,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';

interface Props {
  analysis: any;
}

export default function HollowcatChart({ analysis }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Core SMC signals are enabled by default so the chart immediately explains
  // why Hollowcat produced its current bias.
  const [showFVG, setShowFVG] = useState(true);
  const [showBOS, setShowBOS] = useState(true);
  const [showSwings, setShowSwings] = useState(true);
  const [showLiquidity, setShowLiquidity] = useState(true);
  const [showRegression, setShowRegression] = useState(false);
  const [showILQ, setShowILQ] = useState(true);
  const [showTLQ, setShowTLQ] = useState(true);
  const [showEPA, setShowEPA] = useState(false);
  const [showMSU, setShowMSU] = useState(false);
  const [showVTA, setShowVTA] = useState(true);
  const [showExtreme, setShowExtreme] = useState(true);
  const [showStructureBars, setShowStructureBars] = useState(true);
  const [mounted, setMounted] = useState(false);

  const d = analysis?.dashboard;
  const candles: any[] = analysis?.candles || [];

  // Handle hydration - only render chart after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    let rafId: number;
    let ro: ResizeObserver;
    let redrawRaf: number | undefined;
    let removeOverlayListeners: (() => void) | undefined;

    // Use requestAnimationFrame to ensure container has proper dimensions
    rafId = requestAnimationFrame(() => {
      if (!chartContainerRef.current) return;

      const containerWidth = chartContainerRef.current.clientWidth || 800;
      const containerHeight = 480;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0b1220' },
          textColor: '#94a3b8',
          fontSize: 11,
          fontFamily: 'monospace',
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.08)' },
          horzLines: { color: 'rgba(148,163,184,0.08)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(99,102,241,0.5)', labelBackgroundColor: '#1e293b' },
          horzLine: { color: 'rgba(99,102,241,0.5)', labelBackgroundColor: '#1e293b' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148,163,184,0.15)',
          textColor: '#64748b',
        },
        timeScale: {
          borderColor: 'rgba(148,163,184,0.15)',
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerWidth,
        height: containerHeight,
      });

      chartRef.current = chart;

      // --- Candlestick Series ---
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#4ade80',
        downColor: '#f87171',
        borderUpColor: '#4ade80',
        borderDownColor: '#f87171',
        wickUpColor: '#4ade80',
        wickDownColor: '#f87171',
      });

      const candleData = candles.map((c: any) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeries.setData(candleData);
      candleSeriesRef.current = candleSeries;

      // --- Volume Series ---
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(99,102,241,0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volumeSeries.setData(
        candles.map((c: any) => ({
          time: Math.floor(new Date(c.time).getTime() / 1000) as any,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)',
        }))
      );
      volumeSeriesRef.current = volumeSeries;

      if (!d) {
        chart.timeScale().fitContent();
        return;
      }

      const toTs = (t: string) => Math.floor(new Date(t).getTime() / 1000) as any;
      const lastTs = candleData[candleData.length - 1]?.time;
      const intervalSec = candleData.length > 1 ? (candleData[1].time as number) - (candleData[0].time as number) : 3600;
      const futureTs = ((lastTs as number) + intervalSec * 8) as any;

      // --- Regression Channel ---
      if (showRegression && d.regression) {
        const reg = d.regression;
        const len = Math.min(reg.upper.length, reg.middle.length, reg.lower.length, candles.length);
        const regUpper = chart.addSeries(LineSeries, { color: 'rgba(99,102,241,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        const regMid = chart.addSeries(LineSeries, { color: 'rgba(99,102,241,0.8)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const regLower = chart.addSeries(LineSeries, { color: 'rgba(99,102,241,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });

        const regData = (arr: number[]) =>
          candles.slice(candles.length - len).map((c: any, i: number) => ({
            time: toTs(c.time),
            value: arr[arr.length - len + i],
          }));

        regUpper.setData(regData(reg.upper));
        regMid.setData(regData(reg.middle));
        regLower.setData(regData(reg.lower));
      }

      // --- BOS Lines ---
      if (showBOS && d.marketStructure?.bosEvents) {
        for (const bos of d.marketStructure.bosEvents.slice(-5)) {
          const color = bos.type === 'bullish' ? '#4ade80' : '#f87171';
          candleSeries.createPriceLine({
            price: bos.swingPrice,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: bos.type === 'bullish' ? '▲ BOS' : '▼ BOS',
          });
        }
      }

      // --- CHoCH Lines ---
      if (showBOS && d.marketStructure?.chochEvents) {
        for (const choch of d.marketStructure.chochEvents.slice(-4)) {
          const color = choch.type === 'bullish' ? '#a78bfa' : '#fb923c';
          candleSeries.createPriceLine({
            price: choch.price,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: choch.type === 'bullish' ? 'CHoCH ▲' : 'CHoCH ▼',
          });
        }
      }

      // --- Swing High/Low Labels (HH/HL/LH/LL) via price lines ---
      if (showSwings && d.marketStructure?.swings) {
        for (const sh of d.marketStructure.swings.highs.slice(-6)) {
          const color = sh.type === 'HH' ? '#4ade80' : '#fb923c';
          candleSeries.createPriceLine({
            price: sh.price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: sh.type,
          });
        }
        for (const sl of d.marketStructure.swings.lows.slice(-6)) {
          const color = sl.type === 'HL' ? '#4ade80' : '#f87171';
          candleSeries.createPriceLine({
            price: sl.price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: sl.type,
          });
        }
      }

      // --- FVG Zones (as price bands via price lines) ---
      if (showFVG && d.fvg) {
        for (const fvg of [...d.fvg.freshBullish, ...d.fvg.freshBearish].slice(-5)) {
          const color = fvg.type === 'bullish' ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)';
          candleSeries.createPriceLine({ price: fvg.top, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: fvg.type === 'bullish' ? 'FVG↑' : 'FVG↓' });
          candleSeries.createPriceLine({ price: fvg.bottom, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
        }
      }

      // --- Liquidity Levels (ILQ / TLQ equivalent) ---
      if (showLiquidity && d.liquidity) {
        for (const lvl of d.liquidity.buySideLiquidity.slice(-4)) {
          candleSeries.createPriceLine({ price: lvl.price, color: 'rgba(251,191,36,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'BSL' });
        }
        for (const lvl of d.liquidity.sellSideLiquidity.slice(-4)) {
          candleSeries.createPriceLine({ price: lvl.price, color: 'rgba(251,191,36,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SSL' });
        }
      }

      // --- RSI Divergence Zones (highlighted background bands) ---
      if (analysis?.rsiDivergence) {
        const rsiDiv = analysis.rsiDivergence;
        const allDivs = [
          ...rsiDiv.bullishDivergences.slice(-5).map((div: any) => ({ ...div, type: 'bullish' as const })),
          ...rsiDiv.bearishDivergences.slice(-5).map((div: any) => ({ ...div, type: 'bearish' as const })),
        ];
        for (const div of allDivs) {
          const divBorder = div.type === 'bullish' ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)';
          candleSeries.createPriceLine({
            price: div.price,
            color: divBorder,
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: div.type === 'bullish' ? 'Bull Div ▲' : 'Bear Div ▼',
          });
        }
      }

      // --- Risk Levels (Entry / SL / TP) ---
      // WAIT / NO_TRADE states should not look like an actionable setup.
      if (d.risk && d.entry?.signal && !['WAIT', 'NO_TRADE'].includes(d.entry.signal)) {
        candleSeries.createPriceLine({ price: d.risk.entry, color: '#fbbf24', lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'Entry' });
        candleSeries.createPriceLine({ price: d.risk.stopLoss, color: '#f87171', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL' });
        candleSeries.createPriceLine({ price: d.risk.tp1, color: '#4ade80', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP1' });
        candleSeries.createPriceLine({ price: d.risk.tp2, color: '#4ade80', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP2' });
        candleSeries.createPriceLine({ price: d.risk.tp3, color: '#4ade80', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP3' });
      }

      // --- ILQ (Imbalance Liquidity Zones) ---
      if (showILQ && d.liquidity) {
        for (const lvl of d.liquidity.levels.slice(-6)) {
          const color = lvl.type.includes('BUY') ? '#f97316' : '#f97316';
          candleSeries.createPriceLine({
            price: lvl.price,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `ILQ ${lvl.label}`,
          });
        }
      }

      // --- TLQ (Top/Bottom Liquidity Zones) ---
      if (showTLQ && d.liquidity) {
        for (const lvl of d.liquidity.buySideLiquidity.slice(-4)) {
          candleSeries.createPriceLine({
            price: lvl.price,
            color: '#22c55e',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `TLQ ${lvl.label}`,
          });
        }
        for (const lvl of d.liquidity.sellSideLiquidity.slice(-4)) {
          candleSeries.createPriceLine({
            price: lvl.price,
            color: '#ef4444',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `TLQ ${lvl.label}`,
          });
        }
      }

      // --- EPA (Efficient Price Action) ---
      if (showEPA && d.marketStructure?.swings) {
        const highs = d.marketStructure.swings.highs;
        const lows = d.marketStructure.swings.lows;
        if (highs.length >= 2 && lows.length >= 2) {
          const lastHigh = highs[highs.length - 1];
          const lastLow = lows[lows.length - 1];
          const prevHigh = highs[highs.length - 2];
          const prevLow = lows[lows.length - 2];

          if (lastHigh && lastLow && prevHigh && prevLow) {
            const efficientHigh = Math.max(lastHigh.price, prevHigh.price);
            const efficientLow = Math.min(lastLow.price, prevLow.price);

            candleSeries.createPriceLine({
              price: efficientHigh,
              color: '#3b82f6',
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'EPA High',
            });
            candleSeries.createPriceLine({
              price: efficientLow,
              color: '#3b82f6',
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'EPA Low',
            });
          }
        }
      }

      // --- MSU (Market Structure Unlock) Arrows ---
      if (showMSU && d.marketStructure?.bosEvents) {
        for (const bos of d.marketStructure.bosEvents.slice(-5)) {
          const color = bos.type === 'bullish' ? '#22c55e' : '#ef4444';
          const arrow = bos.type === 'bullish' ? '▲' : '▼';
          candleSeries.createPriceLine({
            price: bos.swingPrice,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${arrow} MSU`,
          });
        }
      }

      // --- VTA (Valid Trading Range) ---
      if (showVTA && d.marketStructure?.swings) {
        const highs = d.marketStructure.swings.highs;
        const lows = d.marketStructure.swings.lows;
        if (highs.length >= 2 && lows.length >= 2) {
          const rangeHigh = Math.max(highs[highs.length - 1].price, highs[highs.length - 2].price);
          const rangeLow = Math.min(lows[lows.length - 1].price, lows[lows.length - 2].price);

          candleSeries.createPriceLine({
            price: rangeHigh,
            color: '#06b6d4',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'VTA High',
          });
          candleSeries.createPriceLine({
            price: rangeLow,
            color: '#06b6d4',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'VTA Low',
          });
        }
      }

      // --- Extreme Boxes ---
      if (showExtreme && d.marketStructure?.swings) {
        const highs = d.marketStructure.swings.highs;
        const lows = d.marketStructure.swings.lows;
        if (highs.length >= 3 && lows.length >= 3) {
          const extremeHigh = Math.max(...highs.slice(-3).map((h: any) => h.price));
          const extremeLow = Math.min(...lows.slice(-3).map((l: any) => l.price));

          candleSeries.createPriceLine({
            price: extremeHigh,
            color: 'rgba(156,163,175,0.8)',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'Extreme High',
          });
          candleSeries.createPriceLine({
            price: extremeLow,
            color: 'rgba(156,163,175,0.8)',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'Extreme Low',
          });
        }
      }

      // --- On-candle signal labels -------------------------------------------------
      // Price lines alone are hard to read because they span the entire chart. Put
      // the structure/liquidity events back on their originating candles as well.
      const markers: SeriesMarker<Time>[] = [];
      const timeAt = (idx: number) => candleData[idx]?.time as Time | undefined;
      const addMarker = (
        idx: number,
        text: string,
        color: string,
        position: 'aboveBar' | 'belowBar',
        shape: 'arrowUp' | 'arrowDown' | 'circle' = 'circle'
      ) => {
        const time = timeAt(idx);
        if (time !== undefined) markers.push({ time, position, color, shape, text, size: 1 });
      };

      if (showSwings && d.marketStructure?.swings) {
        d.marketStructure.swings.highs.slice(-10).forEach((swing: any) => {
          addMarker(swing.idx, swing.type, swing.type === 'HH' ? '#22c55e' : '#fb923c', 'aboveBar');
        });
        d.marketStructure.swings.lows.slice(-10).forEach((swing: any) => {
          addMarker(swing.idx, swing.type, swing.type === 'HL' ? '#22c55e' : '#f87171', 'belowBar');
        });
      }

      if (showBOS && d.marketStructure?.bosEvents) {
        d.marketStructure.bosEvents.slice(-6).forEach((event: any) => {
          const bullish = event.type === 'bullish';
          addMarker(event.idx, bullish ? 'BOS ▲' : 'BOS ▼', bullish ? '#22c55e' : '#f87171', bullish ? 'belowBar' : 'aboveBar', bullish ? 'arrowUp' : 'arrowDown');
        });
        d.marketStructure.chochEvents?.slice(-4).forEach((event: any) => {
          const bullish = event.type === 'bullish';
          addMarker(event.idx, bullish ? 'CHoCH ▲' : 'CHoCH ▼', bullish ? '#a78bfa' : '#fb923c', bullish ? 'belowBar' : 'aboveBar');
        });
      }

      if ((showLiquidity || showILQ || showTLQ) && d.liquidity) {
        d.liquidity.levels.slice(-6).forEach((level: any) => {
          const belowPrice = level.type.includes('BUY') || level.type.includes('SWEEP');
          const label = level.type.includes('SWEEP') ? 'ILQ' : belowPrice ? 'TLQ Low' : 'TLQ High';
          addMarker(level.idx, label, '#f59e0b', belowPrice ? 'belowBar' : 'aboveBar');
        });
      }

      if (showFVG && d.fvg) {
        [...d.fvg.freshBullish, ...d.fvg.freshBearish].slice(-4).forEach((zone: any) => {
          const bullish = zone.type === 'bullish';
          addMarker(zone.candleIdx, bullish ? 'Bull FVG' : 'Bear FVG', bullish ? '#4ade80' : '#f87171', bullish ? 'belowBar' : 'aboveBar');
        });
      }

      if (d.entry?.signal && !['WAIT', 'NO_TRADE'].includes(d.entry.signal)) {
        const bullish = d.entry.signal === 'LONG';
        addMarker(candleData.length - 1, bullish ? 'LONG ▲' : 'SHORT ▼', bullish ? '#22c55e' : '#ef4444', bullish ? 'belowBar' : 'aboveBar', bullish ? 'arrowUp' : 'arrowDown');
      }

      if (markers.length) createSeriesMarkers(candleSeries, markers.sort((a, b) => (a.time as number) - (b.time as number)));

      chart.timeScale().fitContent();

      // --- Structure drawing layer -------------------------------------------------
      // Lightweight Charts handles candles well, while this transparent canvas adds
      // the diagonal Bull/Bear legs and the highlighted valid trading range.
      const overlay = document.createElement('canvas');
      overlay.setAttribute('aria-hidden', 'true');
      Object.assign(overlay.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '4',
      });
      chartContainerRef.current.style.position = 'relative';
      chartContainerRef.current.appendChild(overlay);

      const drawStructureOverlay = () => {
        const container = chartContainerRef.current;
        if (!container || !d.marketStructure?.swings) return;
        const ratio = window.devicePixelRatio || 1;
        const width = container.clientWidth;
        const height = container.clientHeight;
        overlay.width = Math.round(width * ratio);
        overlay.height = Math.round(height * ratio);
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const point = (swing: any) => {
          const time = timeAt(swing.idx);
          if (time === undefined) return null;
          const x = chart.timeScale().timeToCoordinate(time);
          const y = candleSeries.priceToCoordinate(swing.price);
          return x === null || y === null || x === undefined || y === undefined ? null : { x, y };
        };
        const drawLeg = (from: any, to: any, label: string, color: string) => {
          const a = point(from); const b = point(to);
          if (!a || !b) return;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineWidth = 7;
          ctx.strokeStyle = color.replace(')', ', 0.18)').replace('rgb', 'rgba');
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.lineWidth = 2.5; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.fillStyle = color; ctx.font = '600 13px ui-sans-serif, system-ui';
          ctx.fillText(label, b.x + 7, b.y + (label === 'Bear' ? -12 : 18));
          ctx.restore();
        };

        const highs = d.marketStructure.swings.highs.slice(-8);
        const lows = d.marketStructure.swings.lows.slice(-8);
        if (showStructureBars) {
          for (let i = 1; i < highs.length; i++) {
            if (highs[i].type === 'LH') drawLeg(highs[i - 1], highs[i], 'Bear', '#c084fc');
          }
          for (let i = 1; i < lows.length; i++) {
            if (lows[i].type === 'HL') drawLeg(lows[i - 1], lows[i], 'Bull', '#4ade80');
          }
        }

        if (showVTA && highs.length >= 2 && lows.length >= 2) {
          const selected = [highs[highs.length - 1], highs[highs.length - 2], lows[lows.length - 1], lows[lows.length - 2]];
          const startIdx = Math.min(...selected.map((s: any) => s.idx));
          const startTime = timeAt(startIdx);
          const endTime = timeAt(candleData.length - 1);
          if (startTime === undefined || endTime === undefined) return;
          const startX = chart.timeScale().timeToCoordinate(startTime);
          const endX = chart.timeScale().timeToCoordinate(endTime);
          const rangeHigh = Math.max(highs[highs.length - 1].price, highs[highs.length - 2].price);
          const rangeLow = Math.min(lows[lows.length - 1].price, lows[lows.length - 2].price);
          const top = candleSeries.priceToCoordinate(rangeHigh);
          const bottom = candleSeries.priceToCoordinate(rangeLow);
          if (startX !== null && endX !== null && top !== null && bottom !== null) {
            const left = Math.min(startX, endX); const boxWidth = Math.abs(endX - startX);
            const boxTop = Math.min(top, bottom); const boxHeight = Math.abs(bottom - top);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.09)';
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)'; ctx.lineWidth = 1.5;
            ctx.fillRect(left, boxTop, boxWidth, boxHeight);
            ctx.strokeRect(left, boxTop, boxWidth, boxHeight);
            ctx.fillStyle = '#86efac'; ctx.font = '600 12px ui-sans-serif, system-ui';
            ctx.fillText('Valid Trading Range', left + 8, boxTop + 18);
          }
        }
      };
      const scheduleStructureOverlay = () => {
        if (redrawRaf !== undefined) cancelAnimationFrame(redrawRaf);
        redrawRaf = requestAnimationFrame(() => {
          redrawRaf = undefined;
          drawStructureOverlay();
        });
      };

      // A time-range change covers horizontal pan/zoom. Pointer and wheel events
      // also cover vertical price-scale zoom, which does not emit a time event.
      chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleStructureOverlay);
      const onWheel = () => scheduleStructureOverlay();
      const onPointerMove = (event: PointerEvent) => {
        if (event.buttons !== 0) scheduleStructureOverlay();
      };
      chartContainerRef.current.addEventListener('wheel', onWheel, { passive: true });
      chartContainerRef.current.addEventListener('pointermove', onPointerMove);
      removeOverlayListeners = () => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleStructureOverlay);
        chartContainerRef.current?.removeEventListener('wheel', onWheel);
        chartContainerRef.current?.removeEventListener('pointermove', onPointerMove);
      };
      scheduleStructureOverlay();

      // Resize observer
      ro = new ResizeObserver(() => {
        if (chartContainerRef.current && chartRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
          scheduleStructureOverlay();
        }
      });
      ro.observe(chartContainerRef.current);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (redrawRaf !== undefined) cancelAnimationFrame(redrawRaf);
      if (ro) ro.disconnect();
      removeOverlayListeners?.();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, d, analysis, showFVG, showBOS, showSwings, showLiquidity, showRegression, showILQ, showTLQ, showEPA, showMSU, showVTA, showExtreme, showStructureBars]);

  if (!d) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <p className="text-slate-400">No chart data available. Try refreshing.</p>
      </div>
    );
  }

  const trendColor = d.trend.direction.includes('BULLISH') ? '#4ade80' : d.trend.direction.includes('BEARISH') ? '#f87171' : '#fbbf24';
  const tradeSignal = d.entry?.signal === 'LONG' ? 'LONG' : d.entry?.signal === 'SHORT' ? 'SHORT' : 'HOLD';
  const signalColor = tradeSignal === 'LONG' ? '#4ade80' : tradeSignal === 'SHORT' ? '#f87171' : '#fbbf24';

  // Prevent hydration mismatch by only rendering chart after client mount
  if (!mounted) {
    return (
      <div className="space-y-4" suppressHydrationWarning>
        <div className="card-glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-slate-300">📈 Market Structure Chart</span>
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ color: trendColor, background: `${trendColor}18` }}>{d.trend.direction}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">{d.marketRegime}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">R:R {d.risk.expectedRR.toFixed(2)}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">Conf {d.probability.confidenceScore}%</span>
            </div>
          </div>
          <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: '480px', minHeight: '480px' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Structure" value={d.marketStructure.currentStructure} color={d.marketStructure.currentStructure === 'BULLISH' ? '#4ade80' : d.marketStructure.currentStructure === 'BEARISH' ? '#f87171' : '#fbbf24'} />
          <StatCard label="BOS Events" value={d.marketStructure.bosEvents.length} />
          <StatCard label="CHoCH Events" value={d.marketStructure.chochEvents.length} />
          <StatCard label="ATR" value={d.trend.atr.toFixed(4)} />
          <StatCard label="Long %" value={`${d.probability.longProbability}%`} color="#4ade80" />
          <StatCard label="Short %" value={`${d.probability.shortProbability}%`} color="#f87171" />
           <StatCard label="Bullish FVG" value={d.fvg.freshBullish.length} color="#4ade80" />
           <StatCard label="Bearish FVG" value={d.fvg.freshBearish.length} color="#f87171" />
           <StatCard label="RSI" value={analysis?.rsiDivergence?.rsiLine.toFixed(1) || '—'} color={analysis?.rsiDivergence?.rsiLine > 70 ? '#f87171' : analysis?.rsiDivergence?.rsiLine < 30 ? '#4ade80' : '#e2e8f0'} />
           <StatCard label="Bull Div" value={analysis?.rsiDivergence?.bullishDivergences.length || 0} color="#4ade80" />
           <StatCard label="Bear Div" value={analysis?.rsiDivergence?.bearishDivergences.length || 0} color="#f87171" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {/* Chart Header */}
      <div className="card-glass rounded-xl p-4">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: `${signalColor}55`, background: `${signalColor}10` }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Hollowcat setup suggestion</div>
            <div className="mt-0.5 text-xs text-slate-300">{d.entry?.explanation || 'Waiting for a confirmed market-structure setup.'}</div>
          </div>
          <span className="shrink-0 rounded-md px-3 py-1.5 text-sm font-extrabold" style={{ color: signalColor, background: `${signalColor}18` }}>
            {tradeSignal === 'LONG' ? '▲ LONG' : tradeSignal === 'SHORT' ? '▼ SHORT' : '● HOLD'}
          </span>
        </div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-slate-300">📈 Market Structure Chart</span>
            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ color: trendColor, background: `${trendColor}18` }}>{d.trend.direction}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">{d.marketRegime}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">R:R {d.risk.expectedRR.toFixed(2)}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-400">Conf {d.probability.confidenceScore}%</span>
          </div>
          {/* Toggle Controls */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {[
              { label: 'FVG', state: showFVG, set: setShowFVG, color: 'text-green-400' },
              { label: 'BOS/CHoCH', state: showBOS, set: setShowBOS, color: 'text-indigo-400' },
              { label: 'HH/LL', state: showSwings, set: setShowSwings, color: 'text-yellow-400' },
              { label: 'Liquidity', state: showLiquidity, set: setShowLiquidity, color: 'text-orange-400' },
              { label: 'Regression', state: showRegression, set: setShowRegression, color: 'text-purple-400' },
              { label: 'ILQ', state: showILQ, set: setShowILQ, color: 'text-orange-400' },
              { label: 'TLQ', state: showTLQ, set: setShowTLQ, color: 'text-green-400' },
              { label: 'EPA', state: showEPA, set: setShowEPA, color: 'text-blue-400' },
              { label: 'MSU', state: showMSU, set: setShowMSU, color: 'text-pink-400' },
              { label: 'VTA', state: showVTA, set: setShowVTA, color: 'text-cyan-400' },
              { label: 'Extreme', state: showExtreme, set: setShowExtreme, color: 'text-gray-400' },
              { label: 'Bull/Bear Lines', state: showStructureBars, set: setShowStructureBars, color: 'text-emerald-400' },
            ].map(({ label, state, set, color }) => (
              <button
                key={label}
                onClick={() => set(!state)}
                className={`px-2 py-1 rounded border transition-all ${state ? `border-current ${color} bg-current/10` : 'border-slate-700 text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
         <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: '480px', minHeight: '480px' }} />

        {/* Legend */}
         <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" />BOS ▲</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" />BOS ▼</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block" />CHoCH ▲</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" />CHoCH ▼</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" />FVG Bull</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" />FVG Bear</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" />BSL/SSL</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-400 inline-block" />Regression</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-300 inline-block" />Entry/SL/TP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-300 inline-block" />Bull Div</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-300 inline-block" />Bear Div</span>
          </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Structure" value={d.marketStructure.currentStructure} color={d.marketStructure.currentStructure === 'BULLISH' ? '#4ade80' : d.marketStructure.currentStructure === 'BEARISH' ? '#f87171' : '#fbbf24'} />
        <StatCard label="BOS Events" value={d.marketStructure.bosEvents.length} />
        <StatCard label="CHoCH Events" value={d.marketStructure.chochEvents.length} />
        <StatCard label="ATR" value={d.trend.atr.toFixed(4)} />
        <StatCard label="Long %" value={`${d.probability.longProbability}%`} color="#4ade80" />
        <StatCard label="Short %" value={`${d.probability.shortProbability}%`} color="#f87171" />
         <StatCard label="Bullish FVG" value={d.fvg.freshBullish.length} color="#4ade80" />
         <StatCard label="Bearish FVG" value={d.fvg.freshBearish.length} color="#f87171" />
         <StatCard label="RSI" value={analysis?.rsiDivergence?.rsiLine.toFixed(1) || '—'} color={analysis?.rsiDivergence?.rsiLine > 70 ? '#f87171' : analysis?.rsiDivergence?.rsiLine < 30 ? '#4ade80' : '#e2e8f0'} />
         <StatCard label="Bull Div" value={analysis?.rsiDivergence?.bullishDivergences.length || 0} color="#4ade80" />
         <StatCard label="Bear Div" value={analysis?.rsiDivergence?.bearishDivergences.length || 0} color="#f87171" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="card-glass rounded-lg p-3">
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: color || '#e2e8f0' }}>{value}</div>
    </div>
  );
}
