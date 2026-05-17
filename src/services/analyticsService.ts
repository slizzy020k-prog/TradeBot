import { databaseService } from './database';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  monthlyReturns: { month: string; return: number }[];
  equityCurve: { date: string; value: number }[];
}

export class AnalyticsService {
  getPerformanceMetrics(days: number = 30): PerformanceMetrics {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const trades = databaseService.getAllTradesWithOutcome(1000).filter(t => t.timestamp >= cutoff);

    if (trades.length === 0) {
      return {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        monthlyReturns: [],
        equityCurve: [],
      };
    }

    const winningTrades = trades.filter(t => t.profit_loss && t.profit_loss > 0);
    const losingTrades = trades.filter(t => t.profit_loss && t.profit_loss <= 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0));

    const totalReturn = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const winRate = (winningTrades.length / trades.length) * 100;
    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    let peak = 1000;
    let maxDrawdown = 0;
    let equity = 1000;
    const equityCurve: { date: string; value: number }[] = [];

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    for (const trade of sortedTrades) {
      equity += trade.profit_loss || 0;
      equityCurve.push({
        date: new Date(trade.timestamp).toLocaleDateString(),
        value: Math.round(equity * 100) / 100,
      });

      const drawdown = ((peak - equity) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      peak = Math.max(peak, equity);
    }

    const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value * 100);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const monthlyMap = new Map<string, number>();
    for (const trade of sortedTrades) {
      const month = new Date(trade.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + (trade.profit_loss || 0));
    }
    const monthlyReturns = Array.from(monthlyMap.entries()).map(([month, returnVal]) => ({
      month,
      return: Math.round(returnVal * 100) / 100,
    }));

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      monthlyReturns,
      equityCurve,
    };
  }

  getSymbolPerformance(symbol: string, days: number = 30): any {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const trades = databaseService.getTradesBySymbol(symbol, 100).filter(t => t.timestamp >= cutoff);

    const winningTrades = trades.filter(t => t.profit_loss && t.profit_loss > 0);
    const losingTrades = trades.filter(t => t.profit_loss && t.profit_loss <= 0);

    return {
      symbol,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalPnL: trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0),
      avgQualityScore: trades.length > 0
        ? trades.reduce((sum, t) => sum + (t.quality_score || 0), 0) / trades.length
        : 0,
    };
  }

  getAgentPerformance(): any {
    const trades = databaseService.getAllTradesWithOutcome(500);

    return {
      totalTrades: trades.length,
      avgQualityScore: trades.length > 0
        ? trades.reduce((sum, t) => sum + (t.quality_score || 0), 0) / trades.length
        : 0,
      institutionalGradeTrades: trades.filter(t => (t.quality_score || 0) >= 90).length,
      highQualityTrades: trades.filter(t => (t.quality_score || 0) >= 80 && (t.quality_score || 0) < 90).length,
      moderateTrades: trades.filter(t => (t.quality_score || 0) >= 70 && (t.quality_score || 0) < 80).length,
      weakTrades: trades.filter(t => (t.quality_score || 0) >= 60 && (t.quality_score || 0) < 70).length,
      lowQualityTrades: trades.filter(t => (t.quality_score || 0) < 60).length,
    };
  }
}

export const analyticsService = new AnalyticsService();