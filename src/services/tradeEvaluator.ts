import { logger } from '../utils/logger';
import { Trade, MarketData, TradeEvaluation, TradeParameters } from '../types';

export interface EvaluationFactors {
  trendAlignment: number;
  volatilitySuitability: number;
  liquidityQuality: number;
  momentumConfirmation: number;
  executionEfficiency: number;
  marketConditionCompatibility: number;
  riskToReward: number;
  riskScore: number;
}

export class TradeEvaluatorService {
  private qualityThreshold: number;

  constructor(threshold: number = 65) {
    this.qualityThreshold = threshold;
  }

  evaluateTrade(
    trade: Trade,
    marketData: MarketData,
    parameters: TradeParameters
  ): TradeEvaluation {
    const factors = this.calculateFactors(trade, marketData, parameters);
    const qualityScore = this.computeWeightedScore(factors);
    const isGoodTrade = qualityScore >= this.qualityThreshold;

    const evaluation: TradeEvaluation = {
      qualityScore,
      isGoodTrade,
      evaluationDetails: factors,
      profitLoss: parameters.profitLoss || 0,
    };

    logger.info(`Trade ${trade.id} evaluated: score=${qualityScore.toFixed(1)}, isGood=${isGoodTrade}`);
    return evaluation;
  }

  private calculateFactors(
    trade: Trade,
    marketData: MarketData,
    parameters: TradeParameters
  ): TradeParameters {
    return {
      riskScore: parameters.riskScore || this.calculateRiskScore(trade, marketData),
      riskToReward: parameters.riskToReward || this.calculateRiskToReward(trade, parameters),
      trendAlignment: parameters.trendAlignment || this.evaluateTrendAlignment(trade, marketData),
      volatilityScore: parameters.volatilityScore || this.evaluateVolatility(marketData),
      liquidityScore: parameters.liquidityScore || this.evaluateLiquidity(marketData),
      momentumConfirmation: parameters.momentumConfirmation || this.evaluateMomentum(marketData),
      executionEfficiency: parameters.executionEfficiency || this.evaluateExecutionEfficiency(trade, marketData),
      marketConditionScore: parameters.marketConditionScore || this.evaluateMarketCompatibility(marketData),
      positionSize: parameters.positionSize || trade.quantity * trade.price,
      stopLoss: parameters.stopLoss,
      takeProfit: parameters.takeProfit,
      stopLossPct: parameters.stopLossPct,
      takeProfitPct: parameters.takeProfitPct,
      holdingPeriod: parameters.holdingPeriod,
      drawdown: parameters.drawdown,
    };
  }

  private calculateRiskScore(trade: Trade, marketData: MarketData): number {
    const positionValue = trade.quantity * trade.price;
    const portfolioPercent = (positionValue / (marketData.price * 100)) * 100;

    if (portfolioPercent > 20) return 20;
    if (portfolioPercent > 15) return 40;
    if (portfolioPercent > 10) return 60;
    if (portfolioPercent > 5) return 80;
    return 100;
  }

  private calculateRiskToReward(trade: Trade, parameters: TradeParameters): number {
    if (!parameters.stopLoss || !parameters.takeProfit) return 50;

    const diff = Math.abs(parameters.takeProfit - trade.price);
    const stopDiff = Math.abs(trade.price - parameters.stopLoss);

    if (stopDiff === 0) return 50;
    return Math.min(100, (diff / stopDiff) * 50);
  }

  private evaluateTrendAlignment(trade: Trade, marketData: MarketData): number {
    const priceChange = marketData.price - (marketData.open || marketData.price);
    const trendStrength = Math.abs(priceChange) / marketData.price * 100;

    if (trade.side === 'buy' && priceChange > 0) return 80 + Math.min(20, trendStrength * 2);
    if (trade.side === 'sell' && priceChange < 0) return 80 + Math.min(20, trendStrength * 2);
    if (trade.side === 'buy' && priceChange < 0) return Math.max(20, 50 - trendStrength * 3);
    if (trade.side === 'sell' && priceChange > 0) return Math.max(20, 50 - trendStrength * 3);
    return 50;
  }

  private evaluateVolatility(marketData: MarketData): number {
    if (!marketData.high || !marketData.low) return 50;

    const range = (marketData.high - marketData.low) / marketData.price * 100;

    if (range > 5) return 30;
    if (range > 3) return 50;
    if (range > 1) return 70;
    return 90;
  }

  private evaluateLiquidity(marketData: MarketData): number {
    const volume = marketData.volume || 0;

    if (volume > 10000000) return 95;
    if (volume > 5000000) return 80;
    if (volume > 1000000) return 60;
    if (volume > 100000) return 40;
    return 20;
  }

  private evaluateMomentum(marketData: MarketData): number {
    if (!marketData.open || !marketData.close) return 50;

    const priceChange = (marketData.close - marketData.open) / marketData.open * 100;

    if (Math.abs(priceChange) < 0.5) return 60;
    if (priceChange > 2) return 85;
    if (priceChange > 1) return 75;
    if (priceChange < -2) return 85;
    if (priceChange < -1) return 75;
    return 50;
  }

  private evaluateExecutionEfficiency(trade: Trade, marketData: MarketData): number {
    const expectedPrice = marketData.price;
    const slippage = Math.abs(trade.price - expectedPrice) / expectedPrice * 100;

    if (slippage < 0.1) return 95;
    if (slippage < 0.5) return 80;
    if (slippage < 1) return 60;
    if (slippage < 2) return 40;
    return 20;
  }

  private evaluateMarketCompatibility(marketData: MarketData): number {
    let score = 50;

    const range = marketData.high && marketData.low
      ? (marketData.high - marketData.low) / marketData.price * 100
      : 0;

    if (range < 1) score += 20;
    else if (range < 2) score += 10;
    else if (range > 5) score -= 20;

    if (marketData.volume && marketData.volume > 1000000) score += 15;

    return Math.min(100, Math.max(0, score));
  }

  private computeWeightedScore(factors: TradeParameters): number {
    const weights = {
      trendAlignment: 0.15,
      volatilitySuitability: 0.15,
      liquidityQuality: 0.15,
      momentumConfirmation: 0.15,
      executionEfficiency: 0.10,
      marketConditionScore: 0.15,
      riskToReward: 0.10,
      riskScore: 0.05,
    };

    return (
      (factors.trendAlignment || 50) * weights.trendAlignment +
      (factors.volatilityScore || 50) * weights.volatilitySuitability +
      (factors.liquidityScore || 50) * weights.liquidityQuality +
      (factors.momentumConfirmation || 50) * weights.momentumConfirmation +
      (factors.executionEfficiency || 50) * weights.executionEfficiency +
      (factors.marketConditionScore || 50) * weights.marketConditionScore +
      (factors.riskToReward || 50) * weights.riskToReward +
      (factors.riskScore || 50) * weights.riskScore
    );
  }
}

export const tradeEvaluatorService = new TradeEvaluatorService();