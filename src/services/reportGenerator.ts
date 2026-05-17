import { databaseService } from './database';
import { logger } from '../utils/logger';

export interface PerformanceReport {
  period: { start: number; end: number };
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    avgHoldingPeriod: number;
  };
  trades: {
    id: string;
    symbol: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    profitLoss: number;
    qualityScore: number;
    timestamp: number;
  }[];
  recommendations: string[];
}

export class ReportGenerator {
  generatePerformanceReport(period: '1w' | '1m' | '3m'): PerformanceReport {
    const now = Date.now();
    const periods = {
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '3m': 90 * 24 * 60 * 60 * 1000,
    };

    const startTime = now - periods[period];
    const trades = databaseService.getAllTradesWithOutcome(500).filter(t => t.timestamp >= startTime);

    const winningTrades = trades.filter(t => t.profit_loss && t.profit_loss > 0);
    const losingTrades = trades.filter(t => t.profit_loss && t.profit_loss <= 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0));

    const totalReturn = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    let peak = 1000;
    let maxDrawdown = 0;
    let equity = 1000;
    const returns: number[] = [];

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    for (const trade of sortedTrades) {
      equity += trade.profit_loss || 0;
      const drawdown = ((peak - equity) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      peak = Math.max(peak, equity);
      returns.push(trade.profit_loss || 0);
    }

    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const recommendations = this.generateRecommendations(trades, winRate, profitFactor, maxDrawdown);

    return {
      period: { start: startTime, end: now },
      summary: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: Math.round(winRate * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        avgHoldingPeriod: 0,
      },
      trades: trades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        entryPrice: t.price,
        exitPrice: t.price + (t.profit_loss || 0) / t.quantity,
        quantity: t.quantity,
        profitLoss: t.profit_loss || 0,
        qualityScore: t.quality_score || 0,
        timestamp: t.timestamp,
      })),
      recommendations,
    };
  }

  private generateRecommendations(
    trades: any[],
    winRate: number,
    profitFactor: number,
    maxDrawdown: number
  ): string[] {
    const recommendations: string[] = [];

    if (winRate < 40) {
      recommendations.push('Win rate below 40% - consider improving entry timing or reducing position sizes');
    }

    if (profitFactor < 1.5) {
      recommendations.push('Profit factor below 1.5 - focus on better risk/reward ratios');
    }

    if (maxDrawdown > 20) {
      recommendations.push('Max drawdown exceeds 20% - consider reducing position sizes or adding stop-losses');
    }

    const avgQuality = trades.length > 0
      ? trades.reduce((sum, t) => sum + (t.quality_score || 0), 0) / trades.length
      : 0;

    if (avgQuality < 65) {
      recommendations.push('Average trade quality below threshold - review and filter lower quality setups');
    }

    const symbolPerformance = new Map<string, { wins: number; total: number; pnl: number }>();
    for (const trade of trades) {
      const existing = symbolPerformance.get(trade.symbol) || { wins: 0, total: 0, pnl: 0 };
      existing.total++;
      if (trade.profit_loss && trade.profit_loss > 0) existing.wins++;
      existing.pnl += trade.profit_loss || 0;
      symbolPerformance.set(trade.symbol, existing);
    }

    for (const [symbol, perf] of symbolPerformance) {
      if (perf.total >= 5 && perf.wins / perf.total < 0.35) {
        recommendations.push(`Poor performance on ${symbol} - consider removing or reducing allocation`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable parameters - continue monitoring');
    }

    return recommendations;
  }

  generateDailySummary(): { date: string; pnl: number; trades: number }[] {
    const trades = databaseService.getAllTradesWithOutcome(100);
    const dailyMap = new Map<string, { pnl: number; count: number }>();

    for (const trade of trades) {
      const date = new Date(trade.timestamp).toLocaleDateString();
      const existing = dailyMap.get(date) || { pnl: 0, count: 0 };
      existing.pnl += trade.profit_loss || 0;
      existing.count++;
      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        pnl: Math.round(data.pnl * 100) / 100,
        trades: data.count,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const reportGenerator = new ReportGenerator();