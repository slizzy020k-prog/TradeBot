import { MarketData, PortfolioState } from '../../types';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { PERSONA_CONFIG } from '../../config/persona';

export interface RiskAnalysisResult {
  score: number;
  positionSizeValid: boolean;
  riskToRewardRatio: number;
  drawdownImpact: number;
  portfolioExposure: number;
  correlatedRisk: number;
  leverageAppropriate: boolean;
  passedHardLimits: boolean;
  violations: string[];
  details: string;
}

export class RiskAgent {
  analyze(
    marketData: MarketData,
    portfolioState: PortfolioState,
    proposedTrade?: { side: 'buy' | 'sell'; quantity: number; stopLoss?: number; takeProfit?: number }
  ): RiskAnalysisResult {
    const violations: string[] = [];

    const positionSizeValid = this.validatePositionSize(marketData, proposedTrade);
    if (!positionSizeValid) violations.push('Position size exceeds maximum');

    const leverageAppropriate = this.validateLeverage(marketData, portfolioState, proposedTrade);
    if (!leverageAppropriate) violations.push('Leverage would be excessive');

    const drawdownImpact = this.calculateDrawdownImpact(portfolioState, proposedTrade);
    if (drawdownImpact > PERSONA_CONFIG.maxDailyDrawdownPercent) {
      violations.push('Daily drawdown limit would be exceeded');
    }

    const rtoRR = proposedTrade?.stopLoss && proposedTrade?.takeProfit
      ? this.calculateRiskToReward(marketData, proposedTrade)
      : this.estimateRiskToReward(marketData);

    if (rtoRR < PERSONA_CONFIG.minRiskToReward) {
      violations.push(`Risk/Reward ratio ${rtoRR.toFixed(2)} below minimum ${PERSONA_CONFIG.minRiskToReward}`);
    }

    const portfolioExposure = this.calculatePortfolioExposure(portfolioState, proposedTrade);
    const correlatedRisk = this.evaluateCorrelatedRisk(portfolioState, proposedTrade);

    const passedHardLimits = violations.length === 0;

    const score = this.computeScore(
      positionSizeValid,
      leverageAppropriate,
      drawdownImpact,
      rtoRR,
      portfolioExposure
    );

    const result: RiskAnalysisResult = {
      score,
      positionSizeValid,
      riskToRewardRatio: rtoRR,
      drawdownImpact,
      portfolioExposure,
      correlatedRisk,
      leverageAppropriate,
      passedHardLimits,
      violations,
      details: `Position valid: ${positionSizeValid}, R/R: ${rtoRR.toFixed(2)}, ` +
        `Drawdown impact: ${drawdownImpact.toFixed(1)}%, Exposure: ${portfolioExposure.toFixed(1)}%, ` +
        `Hard limits passed: ${passedHardLimits}`,
    };

    logger.debug(`Risk Agent: score=${score.toFixed(0)}, violations=${violations.length}`);
    return result;
  }

  private validatePositionSize(md: MarketData, trade?: { quantity: number }): boolean {
    if (!trade) return true;

    const positionValue = trade.quantity * md.price;
    return positionValue <= config.maxPositionSize;
  }

  private validateLeverage(md: MarketData, portfolio: PortfolioState, trade?: { quantity: number }): boolean {
    if (!trade) return true;

    const safeTotalValue = portfolio.totalValue || 1;
    const positionValue = trade.quantity * md.price;
    const portfolioPercent = (positionValue / safeTotalValue) * 100;

    return portfolioPercent <= 20;
  }

  private calculateDrawdownImpact(portfolio: PortfolioState, trade?: { quantity: number; side: 'buy' | 'sell' }): number {
    if (!trade) return 0;

    const safeTotalValue = portfolio.totalValue || 1;
    const lossPercent = Math.abs(portfolio.dailyPnL) / safeTotalValue * 100;

    const positionValue = trade.quantity * (safeTotalValue / 100);
    const potentialLoss = positionValue * 0.01;

    return lossPercent + (potentialLoss / safeTotalValue) * 100;
  }

  private calculateRiskToReward(
    md: MarketData,
    trade: { stopLoss?: number; takeProfit?: number }
  ): number {
    if (!trade.stopLoss || !trade.takeProfit) return 1;

    const risk = Math.abs(md.price - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - md.price);

    return reward / Math.max(risk, 0.001);
  }

  private estimateRiskToReward(md: MarketData): number {
    if (!md.high || !md.low) return 1.5;

    const range = md.high - md.low;
    const risk = range * 0.3;
    const reward = range * 0.6;

    return reward / Math.max(risk, 0.001);
  }

  private calculatePortfolioExposure(
    portfolio: PortfolioState,
    trade?: { quantity: number }
  ): number {
    if (!trade) return 0;

    const safeTotalValue = portfolio.totalValue || 1;
    const positionValue = trade.quantity * (safeTotalValue / 100);
    return (positionValue / safeTotalValue) * 100;
  }

  private evaluateCorrelatedRisk(
    portfolio: PortfolioState,
    trade?: { quantity: number }
  ): number {
    if (!trade || Object.keys(portfolio.positions).length === 0) return 0;

    let risk = 20;

    if (Object.keys(portfolio.positions).length > 5) risk += 20;
    else if (Object.keys(portfolio.positions).length > 3) risk += 10;

    return Math.min(100, risk);
  }

  private computeScore(
    positionValid: boolean,
    leverageValid: boolean,
    drawdownImpact: number,
    rtoRR: number,
    exposure: number
  ): number {
    let score = 50;

    if (positionValid) score += 20;
    else score -= 30;

    if (leverageValid) score += 15;
    else score -= 25;

    if (drawdownImpact < PERSONA_CONFIG.maxDailyDrawdownPercent) score += 10;
    else score -= 30;

    if (rtoRR >= PERSONA_CONFIG.minRiskToReward) score += 10;
    else if (rtoRR >= 1.5) score += 5;
    else score -= 15;

    if (exposure < 10) score += 5;
    else if (exposure > 20) score -= 10;

    return Math.min(100, Math.max(0, score));
  }
}

export const riskAgent = new RiskAgent();