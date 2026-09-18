/**
 * Alert Engine
 * Generates alerts for TradingView, Webhook, Telegram, Discord
 * Triggers when probability thresholds are met
 */

import type { Candle, AlertConfig, AlertResult, EntrySignal, EntryResult } from './types';
import { EntryEngine } from './entry-engine';

export const AlertEngine = {
  /**
   * Check if alerts should be triggered
   */
  checkAlerts(
    candles: Candle[],
    configs: AlertConfig[]
  ): AlertResult[] {
    if (candles.length < 20) {
      return [{
        triggered: false,
        signal: 'WAIT',
        confidence: 0,
        message: 'Insufficient data for alert check',
        channels: [],
        explanation: 'Need at least 20 candles',
      }];
    }

    const entry = EntryEngine.analyze(candles, 55);
    const enabledConfigs = configs.filter(c => c.enabled);

    if (enabledConfigs.length === 0) {
      return [{
        triggered: false,
        signal: entry.signal,
        confidence: entry.probability.confidenceScore,
        message: 'No alert channels enabled',
        channels: [],
        explanation: 'All alert channels are disabled',
      }];
    }

    // Check if signal meets threshold
    const threshold = 60;
    const meetsThreshold = entry.probability.confidenceScore >= threshold;

    const results: AlertResult[] = [];

    for (const config of enabledConfigs) {
      const result = this._generateAlert(entry, config, meetsThreshold);
      results.push(result);
    }

    return results;
  },

  /**
   * Generate alert for a specific channel
   */
  _generateAlert(entry: EntryResult, config: AlertConfig, meetsThreshold: boolean): AlertResult {
    const triggered = meetsThreshold && entry.signal !== 'NO_TRADE';

    const message = this._buildAlertMessage(entry, config.channel);

    return {
      triggered,
      signal: entry.signal,
      confidence: entry.probability.confidenceScore,
      message,
      channels: [config.channel],
      explanation: triggered
        ? `Alert triggered on ${config.channel}: ${entry.signal} signal with ${entry.probability.confidenceScore}% confidence`
        : `No alert triggered on ${config.channel}: confidence ${entry.probability.confidenceScore}% below threshold`,
    };
  },

  /**
   * Build alert message for specific channel
   */
  _buildAlertMessage(entry: EntryResult, channel: string): string {
    const base = `Hollowcat Signal: ${entry.signal}\n` +
      `Confidence: ${entry.probability.confidenceScore}%\n` +
      `LONG: ${entry.probability.longProbability}% | SHORT: ${entry.probability.shortProbability}%\n` +
      `Expected RR: ${entry.risk.expectedRR.toFixed(2)}\n` +
      `Risk: ${entry.risk.riskPercent.toFixed(2)}%\n` +
      `Rating: ${entry.quality.rating}\n`;

    if (channel === 'TRADINGVIEW') {
      return base + `Alert ID: hollowcat-${Date.now()}`;
    }

    if (channel === 'WEBHOOK') {
      return JSON.stringify({
        signal: entry.signal,
        confidence: entry.probability.confidenceScore,
        longProb: entry.probability.longProbability,
        shortProb: entry.probability.shortProbability,
        rr: entry.risk.expectedRR,
        risk: entry.risk.riskPercent,
        rating: entry.quality.rating,
        reasons: entry.reasons,
        timestamp: new Date().toISOString(),
      });
    }

    if (channel === 'TELEGRAM') {
      return `🔔 *Hollowcat Alert*\n\n` +
        `Signal: ${entry.signal === 'LONG' ? '🟢 LONG' : entry.signal === 'SHORT' ? '🔴 SHORT' : '⚪ WAIT'}\n` +
        `Confidence: ${entry.probability.confidenceScore}%\n` +
        `LONG: ${entry.probability.longProbability}% | SHORT: ${entry.probability.shortProbability}%\n` +
        `RR: ${entry.risk.expectedRR.toFixed(2)} | Risk: ${entry.risk.riskPercent}%\n` +
        `Rating: ${entry.quality.rating}\n` +
        entry.reasons.map(r => `• ${r}`).join('\n');
    }

    if (channel === 'DISCORD') {
      return `**Hollowcat Alert**\n` +
        `Signal: ${entry.signal}\n` +
        `Confidence: ${entry.probability.confidenceScore}%\n` +
        `Expected RR: ${entry.risk.expectedRR.toFixed(2)}\n` +
        `Rating: ${entry.quality.rating}\n` +
        entry.reasons.map(r => `${r}`).join('\n');
    }

    return base;
  },

  /**
   * Send alert to specific channel
   */
  async sendAlert(config: AlertConfig, message: string): Promise<boolean> {
    try {
      switch (config.channel) {
        case 'TRADINGVIEW':
          // TradingView alerts are configured via webhook URL
          if (config.webhookUrl) {
            await fetch(config.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ alert: message }),
            });
            return true;
          }
          break;

        case 'WEBHOOK':
          if (config.webhookUrl) {
            await fetch(config.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: message,
            });
            return true;
          }
          break;

        case 'TELEGRAM':
          if (config.telegramBotId) {
            // Telegram bot API call would go here
            console.log(`Telegram alert via bot ${config.telegramBotId}: ${message}`);
            return true;
          }
          break;

        case 'DISCORD':
          if (config.discordWebhook) {
            await fetch(config.discordWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: message }),
            });
            return true;
          }
          break;
      }

      return false;
    } catch (error) {
      console.error(`Failed to send alert via ${config.channel}:`, error);
      return false;
    }
  },
};
