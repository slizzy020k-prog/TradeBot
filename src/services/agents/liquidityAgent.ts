import { MarketData } from '../../types';
import { logger } from '../../utils/logger';

export interface LiquidityAnalysisResult {
  score: number;
  spreadQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  orderBookQuality: number;
  sessionLiquidity: 'high' | 'normal' | 'low';
  institutionalZones: number;
  slippageProbability: number;
  details: string;
}

export class LiquidityAgent {
  analyze(marketData: MarketData): LiquidityAnalysisResult {
    const spreadQuality = this.evaluateSpreadQuality(marketData);
    const orderBookScore = this.evaluateOrderBookQuality(marketData);
    const sessionLiquidity = this.determineSessionLiquidity();
    const institutionalScore = this.detectInstitutionalActivity(marketData);
    const slippageProb = this.assessSlippageProbability(marketData, spreadQuality);

    const score = this.computeScore(spreadQuality, orderBookScore, institutionalScore, slippageProb);

    const result: LiquidityAnalysisResult = {
      score,
      spreadQuality,
      orderBookQuality: orderBookScore,
      sessionLiquidity,
      institutionalZones: institutionalScore,
      slippageProbability: slippageProb,
      details: `Spread: ${spreadQuality}, Order Book: ${orderBookScore.toFixed(0)}%, ` +
        `Session: ${sessionLiquidity}, Institutional: ${institutionalScore.toFixed(0)}%, ` +
        `Slippage Prob: ${slippageProb.toFixed(0)}%`,
    };

    logger.debug(`Liquidity Agent: score=${score.toFixed(0)}, spread=${spreadQuality}`);
    return result;
  }

  private evaluateSpreadQuality(md: MarketData): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (!md.high || !md.low || !md.price) return 'acceptable';

    const spreadPercent = ((md.high - md.low) / md.price) * 100;

    if (spreadPercent < 0.1) return 'excellent';
    if (spreadPercent < 0.3) return 'good';
    if (spreadPercent < 0.5) return 'acceptable';
    return 'poor';
  }

  private evaluateOrderBookQuality(md: MarketData): number {
    const volume = md.volume || 0;

    if (volume > 10000000) return 95;
    if (volume > 5000000) return 85;
    if (volume > 1000000) return 70;
    if (volume > 100000) return 50;
    return 25;
  }

  private determineSessionLiquidity(): 'high' | 'normal' | 'low' {
    const hour = new Date().getHours();
    const isUS = hour >= 14 && hour <= 22;
    const isEU = hour >= 8 && hour <= 16;
    const isAsia = hour >= 0 && hour <= 8;

    if (isUS || isEU) return 'high';
    if (isAsia) return 'low';
    return 'normal';
  }

  private detectInstitutionalActivity(md: MarketData): number {
    const volume = md.volume || 0;
    const range = md.high && md.low ? ((md.high - md.low) / md.price) * 100 : 0;

    let score = 50;

    if (volume > 5000000) score += 20;
    if (range > 1 && range < 3) score += 15;

    const pricePosition = md.close && md.high && md.low && md.high !== md.low
      ? (md.close - md.low) / (md.high - md.low)
      : 0.5;

    if (pricePosition > 0.7 || pricePosition < 0.3) score += 10;

    return Math.min(100, score);
  }

  private assessSlippageProbability(md: MarketData, spreadQuality: string): number {
    let prob = 20;

    switch (spreadQuality) {
      case 'excellent': prob = 5; break;
      case 'good': prob = 15; break;
      case 'acceptable': prob = 25; break;
      case 'poor': prob = 40; break;
    }

    const volume = md.volume || 0;
    if (volume < 100000) prob += 15;
    else if (volume < 1000000) prob += 5;

    return Math.min(100, prob);
  }

  private computeScore(
    spreadQuality: string,
    orderBookScore: number,
    institutionalScore: number,
    slippageProb: number
  ): number {
    let score = 50;

    switch (spreadQuality) {
      case 'excellent': score += 25; break;
      case 'good': score += 15; break;
      case 'acceptable': score += 5; break;
      case 'poor': score -= 15; break;
    }

    score += orderBookScore * 0.20;
    score += institutionalScore * 0.15;
    score -= slippageProb * 0.30;

    return Math.min(100, Math.max(0, score));
  }
}

export const liquidityAgent = new LiquidityAgent();