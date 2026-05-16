import { MarketData, Trade } from '../../types';
import { logger } from '../../utils/logger';

export interface TrendAnalysisResult {
  score: number;
  multiTimeframeAlignment: number;
  directionalBias: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number;
  exhaustionIndicators: string[];
  continuationProbability: number;
  details: string;
}

export class TrendAgent {
  analyze(marketData: MarketData, historicalData?: MarketData[]): TrendAnalysisResult {
    const priceChange = this.calculatePriceChange(marketData);
    const volumeStrength = this.evaluateVolumeStrength(marketData);
    const trendStrength = this.calculateTrendStrength(marketData, historicalData);
    const exhaustion = this.detectTrendExhaustion(marketData, historicalData);
    const alignment = this.checkMultiTimeframeAlignment(marketData, historicalData);

    const score = Math.min(100, Math.max(0,
      alignment * 0.30 +
      trendStrength * 0.25 +
      volumeStrength * 0.20 +
      (100 - exhaustion) * 0.15 +
      (priceChange > 0 ? priceChange : -priceChange) * 0.10
    ));

    const result: TrendAnalysisResult = {
      score,
      multiTimeframeAlignment: alignment,
      directionalBias: priceChange > 2 ? 'bullish' : priceChange < -2 ? 'bearish' : 'neutral',
      trendStrength,
      exhaustionIndicators: exhaustion > 70 ? ['Potential exhaustion detected'] : [],
      continuationProbability: 100 - exhaustion,
      details: `Trend analysis: ${priceChange > 0 ? 'Bullish' : priceChange < 0 ? 'Bearish' : 'Neutral'} bias. ` +
        `Alignment: ${alignment.toFixed(0)}%, Strength: ${trendStrength.toFixed(0)}%, ` +
        `Volume: ${volumeStrength.toFixed(0)}%, Exhaustion: ${exhaustion.toFixed(0)}%`,
    };

    logger.debug(`Trend Agent: score=${score.toFixed(0)}, bias=${result.directionalBias}`);
    return result;
  }

  private calculatePriceChange(md: MarketData): number {
    if (!md.open) return 0;
    return ((md.price - md.open) / md.open) * 100;
  }

  private evaluateVolumeStrength(md: MarketData): number {
    const vol = md.volume || 0;
    if (vol > 10000000) return 95;
    if (vol > 5000000) return 80;
    if (vol > 1000000) return 60;
    if (vol > 100000) return 40;
    return 20;
  }

  private calculateTrendStrength(md: MarketData, historical?: MarketData[]): number {
    if (!historical || historical.length < 5) {
      const range = md.high && md.low ? ((md.high - md.low) / md.price) * 100 : 2;
      return range < 1 ? 85 : range < 2 ? 70 : range < 5 ? 50 : 30;
    }

    const closes = historical.map(h => h.close).filter((c): c is number => c !== undefined);
    if (closes.length < 2) return 50;

    const changes = closes.slice(1).map((c, i) => {
      const prev = closes[i] ?? c;
      return prev !== 0 ? (c - prev) / prev : 0;
    });
    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const consistency = changes.length > 0 ? changes.filter(c => (avgChange > 0 ? c > 0 : c < 0)).length / changes.length : 0;

    return Math.min(100, consistency * 100 * (1 + Math.abs(avgChange) * 10));
  }

  private detectTrendExhaustion(md: MarketData, historical?: MarketData[]): number {
    if (!historical || historical.length < 10) return 20;

    const recent = historical.slice(-5);
    const earlier = historical.slice(-10, -5);

    const recentAvgChange = this.avgChange(recent);
    const earlierAvgChange = this.avgChange(earlier);

    if (earlierAvgChange === 0) return 20;

    const momentumLoss = ((Math.abs(earlierAvgChange) - Math.abs(recentAvgChange)) / Math.abs(earlierAvgChange)) * 100;

    return Math.min(100, Math.max(0, momentumLoss));
  }

  private avgChange(data: MarketData[]): number {
    const changes = data.slice(1).map((d, i) => {
      const prev = data[i];
      const prevClose = prev.close ?? prev.price;
      const currClose = d.close ?? d.price;
      return prevClose ? (currClose - prevClose) / prevClose : 0;
    });
    return changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  }

  private checkMultiTimeframeAlignment(md: MarketData, historical?: MarketData[]): number {
    let score = 50;

    const priceChange = this.calculatePriceChange(md);
    if (priceChange > 1) score += 15;
    else if (priceChange < -1) score += 15;

    if (md.close && md.open) {
      if (md.close > md.open) score += 10;
      else score -= 10;
    }

    if (historical && historical.length >= 20) {
      const trend = this.calculateTrendStrength(md, historical);
      score = (score + trend) / 2;
    }

    return Math.min(100, Math.max(0, score));
  }
}

export const trendAgent = new TrendAgent();