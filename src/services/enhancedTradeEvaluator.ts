import { MarketData, Trade, PortfolioState } from '../types';
import { logger } from '../utils/logger';
import {
  SubAgentResult,
  TradeQualityScore,
  MarketRegime,
} from './agents/types';
import {
  trendAgent,
  volatilityAgent,
  liquidityAgent,
  momentumAgent,
  riskAgent,
  historicalEdgeAgent,
  executionAgent,
  ceoAgent,
} from './agents';
import { PERSONA_CONFIG } from '../config/persona';

export class EnhancedTradeEvaluator {
  async evaluate(
    marketData: MarketData,
    portfolioState: PortfolioState,
    regime: MarketRegime,
    historicalData?: MarketData[],
    recentTrades?: Trade[],
    proposedTrade?: {
      side: 'buy' | 'sell';
      quantity: number;
      stopLoss?: number;
      takeProfit?: number;
    }
  ): Promise<TradeQualityScore> {
    logger.info(`Evaluating trade for ${marketData.symbol} in ${regime} regime`);

    const subAgentResults = this.runSubAgentEvaluation(
      marketData,
      portfolioState,
      regime,
      historicalData,
      recentTrades,
      proposedTrade
    );

    const ceoInput = {
      symbol: marketData.symbol,
      regime,
      subAgentResults,
      proposedTrade: proposedTrade ? {
        side: proposedTrade.side,
        quantity: proposedTrade.quantity,
        confidence: this.computeWeightedScore(subAgentResults),
      } : undefined,
      riskAssessment: proposedTrade ? {
        passedHardLimits: subAgentResults.riskScore >= 60,
        violations: subAgentResults.riskScore < 60 ? ['Risk score below threshold'] : [],
        riskToRewardRatio: proposedTrade.stopLoss && proposedTrade.takeProfit
          ? (proposedTrade.takeProfit - marketData.price) / Math.abs(marketData.price - proposedTrade.stopLoss)
          : 2,
      } : undefined,
    };

    const ceoAssessment = ceoAgent.assess(ceoInput);
    const qualityScore = ceoAgent.computeTradeQualityScore(subAgentResults, ceoAssessment);

    logger.info(`Trade Quality Score: ${qualityScore.totalScore.toFixed(1)} (${qualityScore.classification})`);
    logger.info(`CEO Recommendation: ${qualityScore.recommendation.toUpperCase()}`);

    return qualityScore;
  }

  private runSubAgentEvaluation(
    md: MarketData,
    portfolio: PortfolioState,
    regime: MarketRegime,
    historical?: MarketData[],
    recentTrades?: Trade[],
    proposedTrade?: { side: 'buy' | 'sell'; quantity: number; stopLoss?: number; takeProfit?: number }
  ): SubAgentResult {
    const trendResult = trendAgent.analyze(md, historical);
    const volatilityResult = volatilityAgent.analyze(md, historical);
    const liquidityResult = liquidityAgent.analyze(md);
    const momentumResult = momentumAgent.analyze(md, historical);
    const riskResult = riskAgent.analyze(md, portfolio, proposedTrade);
    const historicalEdgeResult = historicalEdgeAgent.analyze(md, regime, recentTrades);
    const executionResult = executionAgent.analyze(md);

    const regimeCompatibility = this.calculateRegimeCompatibility(regime, trendResult, momentumResult, md, historical);

    return {
      trendScore: trendResult.score,
      volatilityScore: volatilityResult.score,
      liquidityScore: liquidityResult.score,
      momentumScore: momentumResult.score,
      riskScore: riskResult.score,
      historicalEdgeScore: historicalEdgeResult.score,
      executionScore: executionResult.score,
      regimeCompatibility,
      disciplineScore: this.calculateDisciplineScore(riskResult, proposedTrade),
    };
  }

  private calculateRegimeCompatibility(
    regime: MarketRegime,
    trend: any,
    momentum: any,
    md: MarketData,
    historical?: MarketData[]
  ): number {
    let score = 50;

    switch (regime) {
      case 'trending_bullish':
        score = trend.directionalBias === 'bullish' ? 85 : 40;
        break;
      case 'trending_bearish':
        score = trend.directionalBias === 'bearish' ? 85 : 40;
        break;
      case 'ranging':
        score = Math.abs(trend.score - 50) < 20 ? 75 : 50;
        break;
      case 'breakout_expansion':
        score = momentum.breakoutConfirmed ? 85 : 50;
        break;
      case 'reversal_transition':
        score = momentum.divergenceDetected ? 80 : 45;
        break;
      case 'accumulation':
        score = trend.directionalBias === 'bullish' && momentum.macdSignal === 'bullish' ? 80 : 50;
        break;
      case 'distribution':
        score = trend.directionalBias === 'bearish' && momentum.macdSignal === 'bearish' ? 80 : 50;
        break;
      case 'high_volatility_instability':
        score = volatilityAgent.analyze(md, historical).score < 60 ? 70 : 40;
        break;
      case 'low_liquidity_conditions':
        score = liquidityAgent.analyze(md).score < 50 ? 40 : 60;
        break;
      case 'uncertain':
      default:
        score = 30;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateDisciplineScore(riskResult: any, proposedTrade?: any): number {
    let score = 80;

    if (!proposedTrade) return score;

    if (proposedTrade.quantity > 100) score -= 10;

    if (riskResult.violations && riskResult.violations.length > 0) {
      score -= riskResult.violations.length * 15;
    }

    if (!riskResult.passedHardLimits) {
      score -= 30;
    }

    return Math.min(100, Math.max(0, score));
  }

  private computeWeightedScore(results: SubAgentResult): number {
    return (
      results.trendScore * 0.20 +
      results.regimeCompatibility * 0.15 +
      results.riskScore * 0.15 +
      results.liquidityScore * 0.10 +
      results.momentumScore * 0.10 +
      results.historicalEdgeScore * 0.10 +
      results.executionScore * 0.10 +
      results.volatilityScore * 0.05 +
      results.disciplineScore * 0.05
    );
  }

  classifyRegime(md: MarketData, historical?: MarketData[]): MarketRegime {
    const trendResult = trendAgent.analyze(md, historical);
    const volatilityResult = volatilityAgent.analyze(md, historical);
    const momentumResult = momentumAgent.analyze(md, historical);

    const priceChange = md.close && md.open ? ((md.close - md.open) / md.open) * 100 : 0;

    if (volatilityResult.regime === 'extreme' || volatilityResult.regime === 'high') {
      if (Math.abs(priceChange) > 2) {
        return priceChange > 0 ? 'trending_bullish' : 'trending_bearish';
      }
      return 'high_volatility_instability';
    }

    if (momentumResult.breakoutConfirmed) {
      return 'breakout_expansion';
    }

    if (momentumResult.divergenceDetected) {
      return 'reversal_transition';
    }

    if (trendResult.multiTimeframeAlignment > 80) {
      return priceChange > 0 ? 'trending_bullish' : 'trending_bearish';
    }

    if (trendResult.exhaustionIndicators.length > 0) {
      return 'reversal_transition';
    }

    const range = md.high && md.low ? ((md.high - md.low) / md.price) * 100 : 0;
    if (range < 0.5) {
      return 'ranging';
    }

    return 'uncertain';
  }
}

export const enhancedTradeEvaluator = new EnhancedTradeEvaluator();