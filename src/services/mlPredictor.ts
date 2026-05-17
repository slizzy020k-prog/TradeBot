import { databaseService } from './database';
import { logger } from '../utils/logger';

export interface TradePrediction {
  symbol: string;
  successProbability: number;
  expectedReturn: number;
  confidence: number;
  features: {
    trendStrength: number;
    momentumScore: number;
    volatilityScore: number;
    qualityScore: number;
    winRate: number;
  };
  modelVersion: string;
}

interface TradePattern {
  avgQualityScore: number;
  winRate: number;
  avgReturn: number;
  trendStrength: number;
  momentumScore: number;
  volatilityScore: number;
  count: number;
}

export class MLPredictor {
  private modelVersion = '1.0.0-pattern-based';

  async predict(symbol: string): Promise<TradePrediction> {
    logger.info(`Generating prediction for ${symbol}`);

    const trades = databaseService.getTradesBySymbol(symbol, 50);
    const pattern = this.analyzePattern(trades);

    const qualityScore = pattern.avgQualityScore;
    const winRate = pattern.winRate;

    const successProbability = this.calculateSuccessProbability(pattern);
    const expectedReturn = this.calculateExpectedReturn(pattern);

    const confidence = this.calculateConfidence(trades.length, pattern.count);

    return {
      symbol,
      successProbability: Math.round(successProbability * 100) / 100,
      expectedReturn: Math.round(expectedReturn * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      features: {
        trendStrength: Math.round(pattern.trendStrength * 100) / 100,
        momentumScore: Math.round(pattern.momentumScore * 100) / 100,
        volatilityScore: Math.round(pattern.volatilityScore * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        winRate: Math.round(winRate * 100) / 100,
      },
      modelVersion: this.modelVersion,
    };
  }

  async batchPredict(symbols: string[]): Promise<TradePrediction[]> {
    return Promise.all(symbols.map(s => this.predict(s)));
  }

  private analyzePattern(trades: any[]): TradePattern {
    if (trades.length === 0) {
      return {
        avgQualityScore: 50,
        winRate: 0.5,
        avgReturn: 0,
        trendStrength: 50,
        momentumScore: 50,
        volatilityScore: 50,
        count: 0,
      };
    }

    const qualityScores = trades.map(t => t.quality_score).filter((q): q is number => q !== null);
    const avgQualityScore = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 50;

    const winningTrades = trades.filter(t => t.profit_loss && t.profit_loss > 0);
    const winRate = winningTrades.length / trades.length;

    const returns = trades.map(t => t.profit_loss).filter((p): p is number => p !== null);
    const avgReturn = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

    const gains = returns.filter(r => r > 0);
    const losses = returns.filter(r => r <= 0);
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1;

    return {
      avgQualityScore,
      winRate,
      avgReturn,
      trendStrength: avgQualityScore * 0.4 + (winRate * 100) * 0.3 + (avgGain / (avgLoss || 1)) * 0.3,
      momentumScore: avgQualityScore * 0.5 + (winRate * 100) * 0.5,
      volatilityScore: Math.min(100, avgReturn > 0 ? avgReturn * 10 : 50),
      count: trades.length,
    };
  }

  private calculateSuccessProbability(pattern: TradePattern): number {
    let probability = 50;

    if (pattern.count >= 10) {
      const qualityFactor = (pattern.avgQualityScore - 50) / 50;
      const winRateFactor = (pattern.winRate - 0.5) * 2;

      probability += qualityFactor * 20;
      probability += winRateFactor * 20;

      if (pattern.avgReturn > 0) {
        probability += Math.min(10, pattern.avgReturn * 2);
      }

      probability += Math.min(10, pattern.count * 0.5);
    } else {
      probability += (pattern.count / 10) * 20;
    }

    return Math.max(5, Math.min(95, probability));
  }

  private calculateExpectedReturn(pattern: TradePattern): number {
    if (pattern.count === 0) return 0;

    const baseReturn = pattern.avgReturn;

    const qualityBonus = (pattern.avgQualityScore - 65) * 0.02 * (pattern.winRate > 0.5 ? 1 : -1);

    const winRateFactor = pattern.winRate > 0.5 ? pattern.winRate * 2 : -0.5;

    return baseReturn + qualityBonus + winRateFactor;
  }

  private calculateConfidence(sampleSize: number, patternCount: number): number {
    let confidence = 30;

    if (sampleSize >= 5) {
      confidence += Math.min(30, sampleSize * 3);
    }

    if (patternCount >= 3) {
      confidence += Math.min(20, patternCount * 5);
    }

    return Math.min(95, confidence);
  }

  getTopSymbolsByPrediction(limit: number = 10): { symbol: string; probability: number }[] {
    const trades = databaseService.getAllTradesWithOutcome(200);
    const symbolStats = new Map<string, { wins: number; total: number; recent: any[] }>();

    for (const trade of trades) {
      const existing = symbolStats.get(trade.symbol) || { wins: 0, total: 0, recent: [] };
      existing.total++;
      if (trade.profit_loss && trade.profit_loss > 0) existing.wins++;
      existing.recent.push(trade);
      if (existing.recent.length > 20) existing.recent.shift();
      symbolStats.set(trade.symbol, existing);
    }

    const predictions = Array.from(symbolStats.entries())
      .filter(([, stats]) => stats.total >= 3)
      .map(([symbol, stats]) => {
        const winRate = stats.wins / stats.total;
        const recentQuality = stats.recent
          .filter(t => t.quality_score)
          .reduce((sum, t, i, arr) => sum + (t.quality_score || 0) / arr.length, 0);

        const probability = Math.min(95, Math.max(5,
          30 + (winRate * 40) + ((recentQuality - 50) * 0.4) + (stats.total * 0.5)
        ));

        return { symbol, probability };
      })
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);

    return predictions;
  }
}

export const mlPredictor = new MLPredictor();