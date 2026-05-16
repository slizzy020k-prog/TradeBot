import { databaseService } from './database';
import { vectorStoreService, TradeVectorPayload } from './vectorStore';
import { embeddingsService } from './embeddings';
import { logger } from '../utils/logger';

export interface RAGContext {
  symbol: string;
  goodTrades: string;
  badTrades: string;
  learnedParameters: string;
  similarTrades: string;
  totalGoodTrades: number;
  totalBadTrades: number;
  averageQualityScore: number;
}

export class RAGContextBuilder {
  async buildContext(symbol: string): Promise<RAGContext> {
    const goodTrades = await this.getGoodTradesContext(symbol);
    const badTrades = await this.getBadTradesContext(symbol);
    const similarTrades = await this.getSimilarTradesContext(symbol);
    const learnedParameters = await this.extractLearnedParameters(symbol);
    const stats = databaseService.getStats();

    return {
      symbol,
      goodTrades,
      badTrades,
      learnedParameters,
      similarTrades,
      totalGoodTrades: stats.goodTrades,
      totalBadTrades: stats.badTrades,
      averageQualityScore: stats.avgQualityScore ?? 0,
    };
  }

  private safeJsonParse(json: string | null): any {
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  private async getGoodTradesContext(symbol: string): Promise<string> {
    const goodTrades = databaseService.getGoodTrades(symbol, 5);

    if (goodTrades.length === 0) {
      return `No successful trades recorded for ${symbol} yet.`;
    }

    let context = `Successful trades for ${symbol} (quality >= 65):\n`;

    for (const trade of goodTrades) {
      const details = this.safeJsonParse(trade.evaluation_details);
      context += `- ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price}\n`;
      context += `  Quality: ${trade.quality_score?.toFixed(1)}/100 | P/L: $${trade.profit_loss?.toFixed(2) || 'N/A'}\n`;
      context += `  Trend: ${details.trendAlignment?.toFixed(0)} | Volatility: ${details.volatilityScore?.toFixed(0)} | Momentum: ${details.momentumConfirmation?.toFixed(0)}\n`;
      context += `  Risk/Reward: ${details.riskToReward?.toFixed(2)} | Market Fit: ${details.marketConditionScore?.toFixed(0)}\n`;
    }

    return context;
  }

  private async getBadTradesContext(symbol: string): Promise<string> {
    const badTrades = databaseService.getBadTrades(symbol, 5);

    if (badTrades.length === 0) {
      return `No unsuccessful trades recorded for ${symbol} yet.`;
    }

    let context = `Unsuccessful trades for ${symbol} (quality < 65):\n`;

    for (const trade of badTrades) {
      const details = this.safeJsonParse(trade.evaluation_details);
      context += `- ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price}\n`;
      context += `  Quality: ${trade.quality_score?.toFixed(1)}/100 | P/L: $${trade.profit_loss?.toFixed(2) || 'N/A'}\n`;
      context += `  Trend: ${details.trendAlignment?.toFixed(0)} | Volatility: ${details.volatilityScore?.toFixed(0)} | Momentum: ${details.momentumConfirmation?.toFixed(0)}\n`;
      context += `  Risk/Reward: ${details.riskToReward?.toFixed(2)} | Market Fit: ${details.marketConditionScore?.toFixed(0)}\n`;
    }

    return context;
  }

  private async getSimilarTradesContext(symbol: string): Promise<string> {
    try {
      const similar = await vectorStoreService.searchSimilar(symbol, 3);

      if (similar.length === 0) {
        return 'No similar trades found in vector store.';
      }

      let context = 'Similar historical trades:\n';

      for (const trade of similar) {
        context += `- ${trade.side} ${trade.symbol} (quality: ${(trade.qualityScore ?? 0).toFixed(0)}/100)\n`;
        context += `  Trend: ${(trade.trendAlignment ?? 0).toFixed(0)} | Vol: ${(trade.volatilityScore ?? 0).toFixed(0)} | Liquidity: ${(trade.liquidityScore ?? 0).toFixed(0)}\n`;
        context += `  Risk/Reward: ${(trade.riskToReward ?? 0).toFixed(2)} | P/L: $${trade.profitLoss?.toFixed(2) || 'N/A'}\n`;
      }

      return context;
    } catch (error) {
      logger.warn('Failed to get similar trades context:', error);
      return 'Vector store unavailable for similar trade lookup.';
    }
  }

  private async extractLearnedParameters(symbol: string): Promise<string> {
    const trades = databaseService.getAllTradesWithOutcome(20);
    const symbolTrades = trades.filter(t => t.symbol === symbol);

    if (symbolTrades.length < 3) {
      return `Insufficient trade history for ${symbol} to extract learned parameters.`;
    }

    const goodOnes = symbolTrades.filter(t => t.is_good_trade === 1);
    const badOnes = symbolTrades.filter(t => t.is_good_trade === 0);

    let learned = 'Learned parameters from trade history:\n';

    if (goodOnes.length > 0) {
      const goodAvgTrend = this.avg(goodOnes.map(t => this.safeJsonParse(t.evaluation_details).trendAlignment));
      const goodAvgVol = this.avg(goodOnes.map(t => this.safeJsonParse(t.evaluation_details).volatilityScore));
      const goodAvgMomentum = this.avg(goodOnes.map(t => this.safeJsonParse(t.evaluation_details).momentumConfirmation));
      const goodAvgRiskReward = this.avg(goodOnes.map(t => this.safeJsonParse(t.evaluation_details).riskToReward));

      learned += `\nSuccessful trades avg parameters:\n`;
      learned += `  Trend Alignment: ${goodAvgTrend.toFixed(0)}\n`;
      learned += `  Volatility Score: ${goodAvgVol.toFixed(0)}\n`;
      learned += `  Momentum Confirmation: ${goodAvgMomentum.toFixed(0)}\n`;
      learned += `  Risk/Reward Ratio: ${goodAvgRiskReward.toFixed(2)}\n`;
    }

    if (badOnes.length > 0) {
      const badAvgTrend = this.avg(badOnes.map(t => this.safeJsonParse(t.evaluation_details).trendAlignment));
      const badAvgVol = this.avg(badOnes.map(t => this.safeJsonParse(t.evaluation_details).volatilityScore));
      const badAvgMomentum = this.avg(badOnes.map(t => this.safeJsonParse(t.evaluation_details).momentumConfirmation));

      learned += `\nUnsuccessful trades avg parameters:\n`;
      learned += `  Trend Alignment: ${badAvgTrend.toFixed(0)}\n`;
      learned += `  Volatility Score: ${badAvgVol.toFixed(0)}\n`;
      learned += `  Momentum Confirmation: ${badAvgMomentum.toFixed(0)}\n`;
    }

    return learned;
  }

  private avg(values: number[]): number {
    const valid = values.filter(v => !isNaN(v));
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 50;
  }

  formatContextForAI(ragContext: RAGContext): string {
    return `
=== HISTORICAL TRADE LEARNING ===

[Good Trades]
${ragContext.goodTrades}

[Bad Trades]
${ragContext.badTrades}

[Similar Trades - Vector Search]
${ragContext.similarTrades}

[Learned Parameters]
${ragContext.learnedParameters}

[Summary Stats]
Total Good Trades: ${ragContext.totalGoodTrades}
Total Bad Trades: ${ragContext.totalBadTrades}
Average Quality Score: ${ragContext.averageQualityScore.toFixed(1)}

IMPORTANT: Use this historical context to inform your trading decision.
Prioritize trades that match the patterns of successful trades.
Avoid trades that exhibit characteristics of unsuccessful trades.
Consider the learned parameters when evaluating risk/reward.
`;
  }
}

export const ragContextBuilder = new RAGContextBuilder();