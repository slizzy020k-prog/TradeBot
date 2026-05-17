import { MarketData, Trade } from '../types';
import { logger } from '../utils/logger';
import { databaseService } from './database';
import { marketDataService } from './marketData';
import { enhancedTradeEvaluator } from './enhancedTradeEvaluator';

export interface BacktestConfig {
  symbols: string[];
  startDate: number;
  endDate: number;
  initialCapital: number;
  slippageRate: number;
  positionSizePct: number;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  entryDate: number;
  exitDate: number;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profitLoss: number;
  returnPct: number;
  holdingPeriod: number;
  qualityScore: number;
  slippage: number;
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  annualizedReturn: number;
  trades: BacktestTrade[];
}

export class BacktesterService {
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    logger.info(`Starting backtest for ${config.symbols.join(', ')} from ${new Date(config.startDate).toISOString()} to ${new Date(config.endDate).toISOString()}`);

    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let peakCapital = capital;
    let maxDrawdown = 0;
    let dailyReturns: number[] = [];

    for (const symbol of config.symbols) {
      const historicalData = await marketDataService.getHistorical(symbol, '1h', '3mo');
      const filteredData = historicalData.filter(d => d.timestamp >= config.startDate && d.timestamp <= config.endDate);

      if (filteredData.length < 2) continue;

      const positionSize = capital * (config.positionSizePct / 100);

      for (let i = 0; i < filteredData.length - 1; i++) {
        const entryData = filteredData[i];
        const exitData = filteredData[i + 1];

        const qualityScore = Math.random() * 30 + 70;

        if (qualityScore < 60) continue;

        const entrySlippage = entryData.price * (1 + (Math.random() - 0.5) * config.slippageRate * 2);
        const exitSlippage = exitData.price * (1 + (Math.random() - 0.5) * config.slippageRate * 2);

        const side: 'buy' | 'sell' = (entryData.close ?? entryData.price) > (entryData.open ?? entryData.price) ? 'buy' : 'sell';
        const quantity = Math.floor(positionSize / entrySlippage);

        const pnl = side === 'buy'
          ? (exitSlippage - entrySlippage) * quantity
          : (entrySlippage - exitSlippage) * quantity;

        const returnPct = (pnl / (entrySlippage * quantity)) * 100;
        const holdingPeriod = (exitData.timestamp - entryData.timestamp) / (1000 * 60 * 60);

        const backtestTrade: BacktestTrade = {
          id: `bt_${symbol}_${entryData.timestamp}`,
          symbol,
          entryDate: entryData.timestamp,
          exitDate: exitData.timestamp,
          side,
          entryPrice: entrySlippage,
          exitPrice: exitSlippage,
          quantity,
          profitLoss: pnl,
          returnPct,
          holdingPeriod,
          qualityScore,
          slippage: config.slippageRate,
        };

        trades.push(backtestTrade);
        capital += pnl;

        const drawdown = ((peakCapital - capital) / peakCapital) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        peakCapital = Math.max(peakCapital, capital);

        dailyReturns.push(returnPct);
      }
    }

    const winningTrades = trades.filter(t => t.profitLoss > 0);
    const losingTrades = trades.filter(t => t.profitLoss <= 0);
    const totalReturn = ((capital - config.initialCapital) / config.initialCapital) * 100;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.profitLoss, 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss, 0) / losingTrades.length)
      : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profitLoss, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const variance = dailyReturns.length > 0
      ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const daysElapsed = (config.endDate - config.startDate) / (1000 * 60 * 60 * 24);
    const annualizedReturn = daysElapsed > 0 ? totalReturn * (365 / daysElapsed) : 0;

    const result: BacktestResult = {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      profitFactor,
      avgWin,
      avgLoss,
      annualizedReturn,
      trades,
    };

    this.saveBacktestResult(config, result);

    logger.info(`Backtest complete: ${trades.length} trades, ${result.winRate.toFixed(1)}% win rate, ${result.totalReturn.toFixed(2)}% return, Sharpe: ${result.sharpeRatio.toFixed(2)}`);

    return result;
  }

  private saveBacktestResult(config: BacktestConfig, result: BacktestResult): void {
    try {
      const stmt = databaseService.getDb().prepare(`
        INSERT INTO backtest_results (id, name, config, result, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const id = `bt_${Date.now()}`;
      stmt.run(
        id,
        `Backtest ${new Date(config.startDate).toLocaleDateString()} - ${new Date(config.endDate).toLocaleDateString()}`,
        JSON.stringify(config),
        JSON.stringify({
          totalReturn: result.totalReturn,
          sharpeRatio: result.sharpeRatio,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
          totalTrades: result.totalTrades,
          winningTrades: result.winningTrades,
          losingTrades: result.losingTrades,
          profitFactor: result.profitFactor,
          avgWin: result.avgWin,
          avgLoss: result.avgLoss,
          annualizedReturn: result.annualizedReturn,
        }),
        Date.now()
      );
    } catch (error: any) {
      logger.warn(`Failed to save backtest result: ${error.message}`);
    }
  }

  getBacktestResults(limit: number = 10): any[] {
    const stmt = databaseService.getDb().prepare(
      'SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT ?'
    );
    return stmt.all(limit);
  }
}

export const backtesterService = new BacktesterService();