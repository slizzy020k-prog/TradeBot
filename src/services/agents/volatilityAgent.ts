import { MarketData } from '../../types';
import { logger } from '../../utils/logger';

export interface VolatilityAnalysisResult {
  score: number;
  atr: number;
  regime: 'low' | 'normal' | 'high' | 'extreme';
  expansionProbability: number;
  stopLossDistance: number;
  suitability: 'excellent' | 'good' | 'acceptable' | 'poor';
  details: string;
}

export class VolatilityAgent {
  analyze(marketData: MarketData, historicalData?: MarketData[]): VolatilityAnalysisResult {
    const atr = this.calculateATR(marketData, historicalData);
    const regime = this.classifyRegime(atr, marketData.price);
    const expansionProb = this.assessExpansionProbability(historicalData);
    const stopDistance = this.calculateStopDistance(atr, marketData.price);
    const suitability = this.evaluateSuitability(regime, stopDistance);

    const score = this.computeScore(atr, marketData.price, regime, expansionProb);

    const result: VolatilityAnalysisResult = {
      score,
      atr,
      regime,
      expansionProbability: expansionProb,
      stopLossDistance: stopDistance,
      suitability,
      details: `ATR: ${atr.toFixed(2)}, Regime: ${regime}, Expansion: ${expansionProb.toFixed(0)}%, ` +
        `Stop Distance: ${stopDistance.toFixed(2)}%, Suitability: ${suitability}`,
    };

    logger.debug(`Volatility Agent: score=${score.toFixed(0)}, regime=${regime}`);
    return result;
  }

  private calculateATR(md: MarketData, historical?: MarketData[]): number {
    const high = md.high || md.price;
    const low = md.low || md.price;
    const close = md.close || md.price;

    if (!historical || historical.length < 14) {
      return (high - low) * 0.5;
    }

    const trueRanges = historical.slice(-14).map((h, i) => {
      const prevClose = i > 0 ? (historical[i - 1].close ?? close) : close;
      return Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
    });

    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  private classifyRegime(atr: number, price: number): 'low' | 'normal' | 'high' | 'extreme' {
    const atrPercent = (atr / price) * 100;

    if (atrPercent < 0.5) return 'low';
    if (atrPercent < 1.5) return 'normal';
    if (atrPercent < 3) return 'high';
    return 'extreme';
  }

  private assessExpansionProbability(historical?: MarketData[]): number {
    if (!historical || historical.length < 20) return 30;

    const recent = historical.slice(-10);
    const ranges = recent.map(r => {
      const high = r.high || r.price;
      const low = r.low || r.price;
      return (high - low) / r.price;
    });

    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const variance = ranges.reduce((a, r) => a + Math.pow(r - avgRange, 2), 0) / ranges.length;

    const volatilityIncreasing = variance > avgRange * avgRange * 0.5;
    return volatilityIncreasing ? 70 : 30;
  }

  private calculateStopDistance(atr: number, price: number): number {
    return (atr / price) * 100;
  }

  private evaluateSuitability(regime: string, stopDistance: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (regime === 'extreme' || stopDistance > 5) return 'poor';
    if (regime === 'high' || stopDistance > 3) return 'acceptable';
    if (regime === 'normal' && stopDistance <= 2) return 'good';
    return 'excellent';
  }

  private computeScore(atr: number, price: number, regime: string, expansionProb: number): number {
    let score = 50;

    switch (regime) {
      case 'low': score += 10; break;
      case 'normal': score += 20; break;
      case 'high': score += 5; break;
      case 'extreme': score -= 20; break;
    }

    const atrPercent = (atr / price) * 100;
    if (atrPercent >= 1 && atrPercent <= 2) score += 15;
    else if (atrPercent > 0.5 && atrPercent < 1) score += 10;

    score += expansionProb * 0.15;

    return Math.min(100, Math.max(0, score));
  }
}

export const volatilityAgent = new VolatilityAgent();