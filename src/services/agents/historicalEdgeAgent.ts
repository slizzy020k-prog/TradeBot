import { MarketData, Trade } from '../../types';
import { databaseService } from '../database';
import { logger } from '../../utils/logger';

export interface HistoricalEdgeAnalysisResult {
  score: number;
  patternMatchCount: number;
  expectedValue: number;
  winProbability: number;
  regimeSpecificPerformance: number;
  statisticalConfidence: number;
  matchQuality: 'high' | 'medium' | 'low';
  details: string;
}

export class HistoricalEdgeAgent {
  analyze(
    marketData: MarketData,
    regime: string,
    historicalTrades?: Trade[]
  ): HistoricalEdgeAnalysisResult {
    const dbTrades = databaseService.getTradesBySymbol(marketData.symbol, 50);

    const patternMatchCount = this.countPatternMatches(marketData, dbTrades);
    const winRate = this.calculateWinRate(dbTrades);
    const expectedValue = this.calculateExpectedValue(dbTrades);
    const regimePerformance = this.evaluateRegimePerformance(dbTrades, regime);
    const confidence = this.calculateStatisticalConfidence(patternMatchCount);

    const score = this.computeScore(
      patternMatchCount,
      winRate,
      expectedValue,
      regimePerformance,
      confidence
    );

    const matchQuality: 'high' | 'medium' | 'low' =
      patternMatchCount >= 10 ? 'high' : patternMatchCount >= 5 ? 'medium' : 'low';

    const result: HistoricalEdgeAnalysisResult = {
      score,
      patternMatchCount,
      expectedValue,
      winProbability: winRate,
      regimeSpecificPerformance: regimePerformance,
      statisticalConfidence: confidence,
      matchQuality,
      details: `Matches: ${patternMatchCount}, Win rate: ${winRate.toFixed(0)}%, ` +
        `EV: ${expectedValue.toFixed(2)}, Regime perf: ${regimePerformance.toFixed(0)}%, ` +
        `Confidence: ${confidence.toFixed(0)}%, Quality: ${matchQuality}`,
    };

    logger.debug(`Historical Edge Agent: score=${score.toFixed(0)}, matches=${patternMatchCount}`);
    return result;
  }

  private countPatternMatches(md: MarketData, trades: any[]): number {
    if (trades.length === 0) return 0;

    const currentConditions = {
      priceChange: md.close && md.open ? ((md.close - md.open) / md.open) * 100 : 0,
      volume: md.volume || 0,
      volatility: md.high && md.low ? ((md.high - md.low) / md.price) * 100 : 0,
    };

    let matches = 0;

    for (const trade of trades) {
      const tradeDetails = trade.parameters ? JSON.parse(trade.parameters) : {};
      const tradeConditions = {
        priceChange: tradeDetails.priceChange || 0,
        volume: trade.volume || 0,
        volatility: tradeDetails.volatility || 0,
      };

      if (this.conditionsMatch(currentConditions, tradeConditions)) {
        matches++;
      }
    }

    return matches;
  }

  private conditionsMatch(current: any, historical: any): boolean {
    const priceDiff = Math.abs(current.priceChange - historical.priceChange);
    const volumeDiff = Math.abs(current.volume - historical.volume) / (current.volume || 1);
    const volDiff = Math.abs(current.volatility - historical.volatility);

    return priceDiff < 2 && volumeDiff < 0.5 && volDiff < 1;
  }

  private calculateWinRate(trades: any[]): number {
    if (trades.length === 0) return 50;

    const tradesWithOutcome = trades.filter(t => t.is_good_trade !== null);
    if (tradesWithOutcome.length === 0) return 50;

    const wins = tradesWithOutcome.filter(t => t.is_good_trade === 1).length;
    return (wins / tradesWithOutcome.length) * 100;
  }

  private calculateExpectedValue(trades: any[]): number {
    if (trades.length === 0) return 0;

    const tradesWithPnL = trades.filter(t => t.profit_loss !== null);
    if (tradesWithPnL.length === 0) return 0;

    const totalPnL = tradesWithPnL.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    return totalPnL / tradesWithPnL.length;
  }

  private evaluateRegimePerformance(trades: any[], regime: string): number {
    if (trades.length === 0) return 50;

    const regimeTrades = trades.filter(t => {
      const details = t.evaluation_details ? JSON.parse(t.evaluation_details) : {};
      return details.marketRegime === regime;
    });

    if (regimeTrades.length < 3) return 50;

    const wins = regimeTrades.filter(t => t.is_good_trade === 1).length;
    return (wins / regimeTrades.length) * 100;
  }

  private calculateStatisticalConfidence(matchCount: number): number {
    if (matchCount >= 20) return 90;
    if (matchCount >= 15) return 80;
    if (matchCount >= 10) return 70;
    if (matchCount >= 5) return 50;
    if (matchCount >= 3) return 30;
    return 10;
  }

  private computeScore(
    matches: number,
    winRate: number,
    expectedValue: number,
    regimePerf: number,
    confidence: number
  ): number {
    let score = 50;

    if (matches >= 10) score += 20;
    else if (matches >= 5) score += 10;
    else if (matches < 3) score -= 15;

    if (winRate >= 60) score += 15;
    else if (winRate >= 50) score += 5;
    else if (winRate < 40) score -= 15;

    if (expectedValue > 0) score += Math.min(15, expectedValue * 2);
    else score -= Math.min(20, Math.abs(expectedValue) * 2);

    score += regimePerf * 0.15;
    score += confidence * 0.10;

    return Math.min(100, Math.max(0, score));
  }
}

export const historicalEdgeAgent = new HistoricalEdgeAgent();