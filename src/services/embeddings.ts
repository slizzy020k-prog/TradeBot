import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Trade, TradeEvaluation } from '../types';

export interface TradeSummary {
  tradeId: string;
  symbol: string;
  side: string;
  qualityScore: number;
  isGoodTrade: boolean | null;
  profitLoss: number | null;
  trendAlignment: number;
  volatilityScore: number;
  liquidityScore: number;
  riskToReward: number;
  outcome: string;
}

export class EmbeddingsService {
  private apiUrl = 'https://api.minimaxi.com/v1/embeddings';

  async getEmbedding(text: string): Promise<number[]> {
    if (!config.miniMaxApiKey) {
      throw new Error('MINIMAX_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'emb-01',
          texts: [text],
        },
        {
          headers: {
            'Authorization': `Bearer ${config.miniMaxApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.embeddings && response.data.embeddings[0]) {
        return response.data.embeddings[0];
      }

      throw new Error('No embedding returned from MiniMax');
    } catch (error: any) {
      logger.error('Embedding error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getTradeSummaryEmbedding(trade: Trade, evaluation?: TradeEvaluation): Promise<number[]> {
    const summary = this.createTradeSummaryText(trade, evaluation);
    return this.getEmbedding(summary);
  }

  createTradeSummaryText(trade: Trade, evaluation?: TradeEvaluation): string {
    const parts: string[] = [
      `Trade ${trade.side.toUpperCase()} ${trade.symbol}`,
      `Quantity: ${trade.quantity} @ $${trade.price}`,
      `Status: ${trade.status}`,
    ];

    if (evaluation) {
      parts.push(`Quality Score: ${evaluation.qualityScore.toFixed(1)}/100`);
      parts.push(`Outcome: ${evaluation.isGoodTrade ? 'GOOD' : 'BAD'}`);
      if (evaluation.profitLoss !== undefined) {
        parts.push(`Profit/Loss: $${evaluation.profitLoss.toFixed(2)}`);
      }

      const details = evaluation.evaluationDetails;
      parts.push(`Trend Alignment: ${details.trendAlignment || 50}/100`);
      parts.push(`Volatility Score: ${details.volatilityScore || 50}/100`);
      parts.push(`Liquidity Score: ${details.liquidityScore || 50}/100`);
      parts.push(`Momentum Confirmation: ${details.momentumConfirmation || 50}/100`);
      parts.push(`Risk/Reward Ratio: ${(details.riskToReward || 50).toFixed(2)}`);
      parts.push(`Execution Efficiency: ${details.executionEfficiency || 50}/100`);
      parts.push(`Market Condition Score: ${details.marketConditionScore || 50}/100`);
    }

    return parts.join('. ');
  }

  async getSimilaritySearchText(symbol: string, goodTradeCount: number, badTradeCount: number): Promise<string> {
    return `Analyze trades for ${symbol}. Consider ${goodTradeCount} successful trades and ${badTradeCount} unsuccessful trades. Look for patterns in entry timing, position sizing, market conditions, and risk management that distinguish good trades from bad ones.`;
  }
}

export const embeddingsService = new EmbeddingsService();