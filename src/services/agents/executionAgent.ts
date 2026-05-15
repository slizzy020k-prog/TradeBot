import { MarketData } from '../../types';
import { logger } from '../../utils/logger';

export interface ExecutionAnalysisResult {
  score: number;
  entryPrecision: 'excellent' | 'good' | 'acceptable' | 'poor';
  timingQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  spreadCost: number;
  latencyScore: number;
  orderEfficiency: number;
  details: string;
}

export class ExecutionAgent {
  analyze(
    marketData: MarketData,
    proposedEntry?: { expectedPrice: number; timestamp: number }
  ): ExecutionAnalysisResult {
    const entryPrecision = this.evaluateEntryPrecision(marketData, proposedEntry);
    const timingQuality = this.evaluateTimingQuality(marketData, proposedEntry);
    const spreadCost = this.calculateSpreadCost(marketData);
    const latencyScore = this.assessLatency(marketData);
    const orderEfficiency = this.calculateOrderEfficiency(marketData, proposedEntry);

    const score = this.computeScore(entryPrecision, timingQuality, spreadCost, latencyScore, orderEfficiency);

    const result: ExecutionAnalysisResult = {
      score,
      entryPrecision,
      timingQuality,
      spreadCost,
      latencyScore,
      orderEfficiency,
      details: `Entry: ${entryPrecision}, Timing: ${timingQuality}, ` +
        `Spread cost: ${spreadCost.toFixed(1)}%, Latency: ${latencyScore.toFixed(0)}%, ` +
        `Efficiency: ${orderEfficiency.toFixed(0)}%`,
    };

    logger.debug(`Execution Agent: score=${score.toFixed(0)}`);
    return result;
  }

  private evaluateEntryPrecision(
    md: MarketData,
    proposed?: { expectedPrice: number }
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (!proposed) return 'acceptable';

    const slippage = Math.abs(md.price - proposed.expectedPrice) / md.price * 100;

    if (slippage < 0.1) return 'excellent';
    if (slippage < 0.3) return 'good';
    if (slippage < 0.5) return 'acceptable';
    return 'poor';
  }

  private evaluateTimingQuality(
    md: MarketData,
    proposed?: { timestamp: number }
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (!proposed) return 'good';

    const hour = new Date(proposed.timestamp).getHours();
    const dayOfWeek = new Date(proposed.timestamp).getDay();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isRushHour = (hour >= 9 && hour <= 10) || (hour >= 15 && hour <= 16);

    if (isWeekend) return 'poor';
    if (isRushHour) return 'acceptable';
    if (hour >= 10 && hour <= 15) return 'excellent';
    return 'good';
  }

  private calculateSpreadCost(md: MarketData): number {
    if (!md.high || !md.low || !md.price) return 0;

    const spread = (md.high - md.low) / md.price * 100;
    return spread;
  }

  private assessLatency(md: MarketData): number {
    const age = Date.now() - md.timestamp;

    if (age < 60000) return 95;
    if (age < 300000) return 80;
    if (age < 600000) return 60;
    if (age < 900000) return 40;
    return 20;
  }

  private calculateOrderEfficiency(
    md: MarketData,
    proposed?: { expectedPrice: number }
  ): number {
    if (!proposed) return 75;

    const slippage = Math.abs(md.price - proposed.expectedPrice) / md.price * 100;

    let efficiency = 100 - slippage * 10;

    const spread = this.calculateSpreadCost(md);
    efficiency -= spread * 2;

    return Math.min(100, Math.max(0, efficiency));
  }

  private computeScore(
    entry: string,
    timing: string,
    spread: number,
    latency: number,
    efficiency: number
  ): number {
    let score = 50;

    switch (entry) {
      case 'excellent': score += 20; break;
      case 'good': score += 10; break;
      case 'acceptable': score += 0; break;
      case 'poor': score -= 20; break;
    }

    switch (timing) {
      case 'excellent': score += 15; break;
      case 'good': score += 10; break;
      case 'acceptable': score += 0; break;
      case 'poor': score -= 15; break;
    }

    score -= spread * 3;

    score += latency * 0.10;
    score += efficiency * 0.15;

    return Math.min(100, Math.max(0, score));
  }
}

export const executionAgent = new ExecutionAgent();