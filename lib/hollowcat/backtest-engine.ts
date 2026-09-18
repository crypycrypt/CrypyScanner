/**
 * Backtest Engine
 * Calculates Win Rate, Profit Factor, Expectancy, Sharpe Ratio, Sortino Ratio,
 * Drawdown, Recovery Factor from historical trade simulation
 * Includes market maker manipulation tracking
 */

import type { Candle, BacktestResult, BacktestTrade, TradeRating, EntrySignal } from './types';
import { EntryEngine } from './entry-engine';
import { ProbabilityEngine } from './probability-engine';
import { RiskEngine } from './risk-engine';

export const BacktestEngine = {
  /**
   * Run backtest on historical candle data
   */
  run(candles: Candle[], lookbackPeriod: number = 50): BacktestResult {
    if (candles.length < lookbackPeriod + 20) {
      return this._fallback('Need sufficient historical data for backtesting');
    }

    const trades: BacktestTrade[] = [];

    // Walk forward through the data
    for (let i = lookbackPeriod; i < candles.length - 10; i++) {
      const window = candles.slice(i - lookbackPeriod, i + 1);
      const entry = EntryEngine.analyze(window, 55);

      if (entry.signal === 'LONG' || entry.signal === 'SHORT') {
        // Simulate trade execution
        const trade = this._simulateTrade(candles, i, entry);
        if (trade) {
          trades.push(trade);
        }
      }
    }

    // Calculate performance metrics
    const result = this._calculateMetrics(trades);

    return result;
  },

  /**
   * Simulate a single trade from entry to exit
   */
  _simulateTrade(candles: Candle[], entryIdx: number, entry: any): BacktestTrade | null {
    const entryCandle = candles[entryIdx];
    const entryPrice = entryCandle.close;
    const direction = entry.signal;

    // Get risk levels
    const risk = entry.risk;
    const manipulation = entry.manipulation;

    // Simulate exit at TP1, TP2, TP3, or SL
    let exitPrice = 0;
    let exitIdx = entryIdx;
    let hitSL = false;
    let hitTP = 0;

    for (let i = entryIdx + 1; i < Math.min(entryIdx + 50, candles.length); i++) {
      const c = candles[i];

      if (direction === 'LONG') {
        // Check stop loss
        if (c.low <= risk.stopLoss) {
          exitPrice = risk.stopLoss;
          hitSL = true;
          exitIdx = i;
          break;
        }
        // Check take profits
        if (c.high >= risk.tp3) {
          exitPrice = risk.tp3;
          hitTP = 3;
          exitIdx = i;
          break;
        }
        if (c.high >= risk.tp2) {
          exitPrice = risk.tp2;
          hitTP = 2;
          exitIdx = i;
          break;
        }
        if (c.high >= risk.tp1) {
          exitPrice = risk.tp1;
          hitTP = 1;
          exitIdx = i;
          break;
        }
      } else {
        // SHORT
        if (c.high >= risk.stopLoss) {
          exitPrice = risk.stopLoss;
          hitSL = true;
          exitIdx = i;
          break;
        }
        if (c.low <= risk.tp3) {
          exitPrice = risk.tp3;
          hitTP = 3;
          exitIdx = i;
          break;
        }
        if (c.low <= risk.tp2) {
          exitPrice = risk.tp2;
          hitTP = 2;
          exitIdx = i;
          break;
        }
        if (c.low <= risk.tp1) {
          exitPrice = risk.tp1;
          hitTP = 1;
          exitIdx = i;
          break;
        }
      }
    }

    // If no exit found, close at last candle
    if (exitPrice === 0) {
      exitPrice = candles[Math.min(entryIdx + 49, candles.length - 1)].close;
      exitIdx = Math.min(entryIdx + 49, candles.length - 1);
    }

    // Calculate PnL
    const pnl = direction === 'LONG'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;

    const pnlPercent = (pnl / entryPrice) * 100;
    const rr = risk.expectedRR;
    const win = pnl > 0;

    return {
      entryTime: entryCandle.time,
      exitTime: candles[exitIdx].time,
      direction,
      entryPrice,
      exitPrice,
      stopLoss: risk.stopLoss,
      takeProfit: hitTP > 0 ? (direction === 'LONG' ? entryPrice + hitTP * risk.tp1 / 3 : entryPrice - hitTP * risk.tp1 / 3) : 0,
      pnl,
      pnlPercent,
      rr,
      win,
      rating: entry.quality.rating,
      manipulationScore: manipulation.manipulationScore,
      manipulationWarnings: manipulation.signals.map((s: { type: string }) => s.type),
    };
  },

  /**
   * Calculate performance metrics from trades
   */
  _calculateMetrics(trades: BacktestTrade[]): BacktestResult {
    if (trades.length === 0) {
      return {
        trades: [],
        winRate: 0,
        profitFactor: 0,
        expectancy: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        recoveryFactor: 0,
        totalPnL: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        explanation: 'No trades generated from backtest',
      };
    }

    const winningTrades = trades.filter(t => t.win);
    const losingTrades = trades.filter(t => !t.win);
    const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
    const totalTrades = trades.length;
    const winningCount = winningTrades.length;
    const losingCount = losingTrades.length;

    const winRate = totalTrades > 0 ? winningCount / totalTrades : 0;
    const avgWin = winningCount > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningCount : 0;
    const avgLoss = losingCount > 0 ? losingTrades.reduce((s, t) => s + t.pnl, 0) / losingCount : 0;

    // Profit Factor
    const grossProfit = winningTrades.reduce((s, t) => s + Math.max(0, t.pnl), 0);
    const grossLoss = losingTrades.reduce((s, t) => s + Math.abs(Math.min(0, t.pnl)), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Expectancy
    const expectancy = (winRate * avgWin) - ((1 - winRate) * Math.abs(avgLoss));

    // Sharpe Ratio (assuming risk-free rate = 0)
    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Sortino Ratio (downside deviation only)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / downsideReturns.length)
      : 1;
    const sortinoRatio = downsideDev > 0 ? avgReturn / downsideDev : 0;

    // Max Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const t of trades) {
      cumulative += t.pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Recovery Factor
    const recoveryFactor = maxDrawdown > 0 ? totalPnL / maxDrawdown : totalPnL > 0 ? Infinity : 0;

    const explanation = this.buildExplanation(winRate, profitFactor, expectancy, sharpeRatio, sortinoRatio, maxDrawdown, recoveryFactor, totalTrades);

    return {
      trades,
      winRate: Math.round(winRate * 10000) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      expectancy: Math.round(expectancy * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      totalPnL: Math.round(totalPnL * 10000) / 10000,
      totalTrades,
      winningTrades: winningCount,
      losingTrades: losingCount,
      avgWin: Math.round(avgWin * 10000) / 10000,
      avgLoss: Math.round(avgLoss * 10000) / 10000,
      explanation,
    };
  },

  /**
   * Build explanation string
   */
  buildExplanation(
    winRate: number,
    profitFactor: number,
    expectancy: number,
    sharpeRatio: number,
    sortinoRatio: number,
    maxDrawdown: number,
    recoveryFactor: number,
    totalTrades: number
  ): string {
    const parts: string[] = [];
    parts.push(`Backtest Results (${totalTrades} trades):`);
    parts.push(`Win Rate: ${(winRate * 100).toFixed(1)}%`);
    parts.push(`Profit Factor: ${profitFactor.toFixed(2)}`);
    parts.push(`Expectancy: ${expectancy.toFixed(4)}`);
    parts.push(`Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
    parts.push(`Sortino Ratio: ${sortinoRatio.toFixed(2)}`);
    parts.push(`Max Drawdown: ${maxDrawdown.toFixed(4)}`);
    parts.push(`Recovery Factor: ${recoveryFactor.toFixed(2)}`);

    if (profitFactor > 1.5 && winRate > 0.5) {
      parts.push('Strategy shows positive edge');
    } else if (profitFactor > 1) {
      parts.push('Strategy is marginally profitable');
    } else {
      parts.push('Strategy needs improvement');
    }

    return parts.join(' | ');
  },

  /**
   * Fallback for insufficient data
   */
  _fallback(reason: string): BacktestResult {
    return {
      trades: [],
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      recoveryFactor: 0,
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      explanation: reason,
    };
  },
};
