import { MarketDataExtended, OpportunityScore, AssetClass, MacroRegime } from '../types';
import { macroRegimeService } from './macroRegime';
import { logger } from '../utils/logger';

export class OpportunityRankerService {
  private scores: Map<string, OpportunityScore> = new Map();

  async rankOpportunities(marketData: MarketDataExtended[]): Promise<OpportunityScore[]> {
    const regime = macroRegimeService.getLastRegime();
    const scores: OpportunityScore[] = [];

    for (const md of marketData) {
      const score = this.calculateOpportunityScore(md, regime);
      scores.push(score);
      this.scores.set(md.symbol, score);
    }

    scores.sort((a, b) => b.totalScore - a.totalScore);

    scores.forEach((s, i) => {
      s.rank = i + 1;
    });

    const allRanked = scores.sort((a, b) => b.totalScore - a.totalScore);
    allRanked.forEach((s, i) => {
      s.globalRank = i + 1;
    });

    logger.info(`Ranked ${scores.length} opportunities. Top: ${scores[0]?.symbol} (${scores[0]?.totalScore.toFixed(1)})`);

    return scores;
  }

  private calculateOpportunityScore(md: MarketDataExtended, regime: MacroRegime): OpportunityScore {
    const trendScore = this.calculateTrendScore(md);
    const momentumScore = this.calculateMomentumScore(md);
    const valueScore = this.calculateValueScore(md);
    const qualityScore = this.calculateQualityScore(md);
    const regimeScore = this.calculateRegimeScore(md, regime);
    const liquidityScore = this.calculateLiquidityScore(md);

    const totalScore =
      trendScore * 0.20 +
      momentumScore * 0.15 +
      valueScore * 0.15 +
      qualityScore * 0.15 +
      regimeScore * 0.20 +
      liquidityScore * 0.15;

    let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
    if (totalScore >= 75) recommendation = 'buy';
    else if (totalScore <= 40) recommendation = 'sell';
    else recommendation = 'hold';

    return {
      symbol: md.symbol,
      assetClass: md.assetClass,
      totalScore,
      breakdown: {
        trendScore,
        momentumScore,
        valueScore,
        qualityScore,
        regimeScore,
        liquidityScore,
      },
      rank: 0,
      globalRank: 0,
      recommendation,
      confidence: totalScore,
      timestamp: Date.now(),
    };
  }

  private calculateTrendScore(md: MarketDataExtended): number {
    if (!md.close || !md.open) return 50;
    const priceChange = ((md.close - md.open) / md.open) * 100;
    return Math.min(100, Math.max(0, 50 + priceChange * 10));
  }

  private calculateMomentumScore(md: MarketDataExtended): number {
    if (!md.price || !md.fiftyTwoWeekHigh || !md.fiftyTwoWeekLow) return 50;
    const range = md.fiftyTwoWeekHigh - md.fiftyTwoWeekLow;
    if (range === 0) return 50;
    const position = (md.price - md.fiftyTwoWeekLow) / range;
    return position * 100;
  }

  private calculateValueScore(md: MarketDataExtended): number {
    if (!md.peRatio) return 50;
    if (md.peRatio < 0) return 40;
    if (md.peRatio < 15) return 80;
    if (md.peRatio > 30) return 40;
    return 60;
  }

  private calculateQualityScore(md: MarketDataExtended): number {
    let score = 50;
    if (md.marketCap && md.marketCap > 1e12) score += 20;
    else if (md.marketCap && md.marketCap > 1e10) score += 10;
    if (md.dividendYield && md.dividendYield > 0.02) score += 10;
    return Math.min(100, score);
  }

  private calculateRegimeScore(md: MarketDataExtended, regime: MacroRegime): number {
    const regimeSuitability: Record<MacroRegime, Record<AssetClass, number>> = {
      risk_on_bull: { equities: 85, crypto: 75, commodities: 65, forex: 50, etfs: 70, bonds: 30 },
      risk_on_bear: { equities: 30, crypto: 25, commodities: 40, forex: 60, etfs: 35, bonds: 80 },
      risk_off: { equities: 30, crypto: 25, commodities: 50, forex: 55, etfs: 35, bonds: 85 },
      inflation: { equities: 45, crypto: 55, commodities: 85, forex: 50, etfs: 40, bonds: 25 },
      deflation: { equities: 40, crypto: 30, commodities: 45, forex: 60, etfs: 45, bonds: 75 },
      high_volatility: { equities: 40, crypto: 30, commodities: 55, forex: 60, etfs: 45, bonds: 70 },
      low_volatility: { equities: 60, crypto: 50, commodities: 50, forex: 55, etfs: 60, bonds: 55 },
      stagflation: { equities: 35, crypto: 40, commodities: 70, forex: 50, etfs: 40, bonds: 60 },
      recovery: { equities: 80, crypto: 60, commodities: 60, forex: 45, etfs: 70, bonds: 30 },
      normal: { equities: 60, crypto: 55, commodities: 55, forex: 55, etfs: 60, bonds: 55 },
    };

    const scores = regimeSuitability[regime] || regimeSuitability.normal;
    return scores[md.assetClass] || 50;
  }

  private calculateLiquidityScore(md: MarketDataExtended): number {
    if (!md.volume) return 50;
    if (md.volume > 10e6) return 90;
    if (md.volume > 1e6) return 70;
    if (md.volume > 100e3) return 50;
    return 30;
  }

  getTopOpportunities(limit = 10): OpportunityScore[] {
    const all = Array.from(this.scores.values());
    return all.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit);
  }

  getOpportunitiesByAssetClass(assetClass: AssetClass): OpportunityScore[] {
    const all = Array.from(this.scores.values()).filter(s => s.assetClass === assetClass);
    return all.sort((a, b) => b.totalScore - a.totalScore);
  }

  getScores(): Map<string, OpportunityScore> {
    return this.scores;
  }
}

export const opportunityRankerService = new OpportunityRankerService();