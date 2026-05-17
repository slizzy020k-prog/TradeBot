import { marketDataService } from './marketData';
import { databaseService } from './database';
import { logger } from '../utils/logger';

export interface OptimizationResult {
  allocations: { symbol: string; weight: number; shares: number }[];
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  method: 'mean_variance' | 'risk_parity';
}

export interface PortfolioMetrics {
  totalValue: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  positions: { symbol: string; value: number; weight: number; pnl: number }[];
}

export class PortfolioOptimizer {
  async optimize(
    symbols: string[],
    currentWeights: Map<string, number>,
    method: 'mean_variance' | 'risk_parity' = 'risk_parity',
    portfolioValue?: number
  ): Promise<OptimizationResult> {
    logger.info(`Optimizing portfolio for ${symbols.join(', ')} using ${method}`);

    const historicalData = await Promise.all(
      symbols.map(s => marketDataService.getHistorical(s, '1d', '90d'))
    );

    const returns = this.calculateReturns(historicalData);
    const expectedReturns = this.calculateExpectedReturns(returns);
    const covarianceMatrix = this.calculateCovarianceMatrix(returns);

    let optimalWeights: number[];
    let expectedReturn: number;
    let expectedVolatility: number;

    if (method === 'mean_variance') {
      optimalWeights = this.meanVarianceOptimization(expectedReturns, covarianceMatrix);
    } else {
      optimalWeights = this.riskParityOptimization(covarianceMatrix);
    }

    const portfolioReturn = optimalWeights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    const portfolioVolatility = this.calculatePortfolioVolatility(optimalWeights, covarianceMatrix);
    const sharpeRatio = portfolioVolatility > 0 ? portfolioReturn / portfolioVolatility : 0;

    const totalValue = portfolioValue || 10000;
    const allocations = symbols.map((symbol, i) => ({
      symbol,
      weight: Math.round(optimalWeights[i] * 10000) / 100,
      shares: Math.floor((optimalWeights[i] * totalValue) / (historicalData[i]?.[0]?.price || 100)),
    }));

    return {
      allocations,
      expectedReturn: Math.round(portfolioReturn * 10000) / 100,
      expectedVolatility: Math.round(portfolioVolatility * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      method,
    };
  }

  getRebalancingSuggestions(currentWeights: Map<string, number>, targetWeights: Map<string, number>): string[] {
    const suggestions: string[] = [];
    const threshold = 0.05;

    for (const [symbol, target] of targetWeights) {
      const current = currentWeights.get(symbol) || 0;
      const drift = Math.abs(target - current);

      if (drift > threshold) {
        const action = target > current ? 'buy' : 'sell';
        suggestions.push(`${action.toUpperCase()} ${symbol}: current ${(current * 100).toFixed(1)}%, target ${(target * 100).toFixed(1)}%`);
      }
    }

    return suggestions;
  }

  getPortfolioMetrics(positions: Map<string, { quantity: number; avgPrice: number }>): PortfolioMetrics {
    const positionArray = Array.from(positions.entries());
    let totalValue = 0;
    const metrics: PortfolioMetrics = {
      totalValue: 0,
      dailyReturn: 0,
      weeklyReturn: 0,
      monthlyReturn: 0,
      positions: [],
    };

    const positionMetrics = positionArray.map(([symbol, pos]) => {
      const lastPrice = pos.avgPrice * 1.0;
      const currentValue = lastPrice * pos.quantity;
      const costBasis = pos.avgPrice * pos.quantity;
      const pnl = currentValue - costBasis;

      totalValue += currentValue;

      return {
        symbol,
        value: currentValue,
        weight: 0,
        pnl,
      };
    });

    positionMetrics.forEach(p => {
      p.weight = totalValue > 0 ? (p.value / totalValue) * 100 : 0;
    });

    metrics.totalValue = totalValue;
    metrics.positions = positionMetrics;

    return metrics;
  }

  private calculateReturns(historicalData: any[][]): number[][] {
    return historicalData.map(data => {
      if (data.length < 2) return [];
      const returns: number[] = [];
      for (let i = 1; i < data.length; i++) {
        const prevClose = data[i - 1].close || data[i - 1].price;
        const currClose = data[i].close || data[i].price;
        if (prevClose > 0) {
          returns.push((currClose - prevClose) / prevClose);
        }
      }
      return returns;
    });
  }

  private calculateExpectedReturns(returns: number[][]): number[] {
    return returns.map(r => {
      if (r.length === 0) return 0;
      return r.reduce((a, b) => a + b, 0) / r.length;
    });
  }

  private calculateCovarianceMatrix(returns: number[][]): number[][] {
    const n = returns.length;
    const covariance: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const len = Math.min(returns[i].length, returns[j].length);
        if (len === 0) {
          covariance[i][j] = 0;
          continue;
        }

        const meanI = returns[i].slice(0, len).reduce((a, b) => a + b, 0) / len;
        const meanJ = returns[j].slice(0, len).reduce((a, b) => a + b, 0) / len;

        let cov = 0;
        for (let k = 0; k < len; k++) {
          cov += (returns[i][k] - meanI) * (returns[j][k] - meanJ);
        }
        covariance[i][j] = cov / len;
      }
    }

    return covariance;
  }

  private meanVarianceOptimization(expectedReturns: number[], covarianceMatrix: number[][]): number[] {
    const n = expectedReturns.length;
    const targetReturn = expectedReturns.reduce((a, b) => a + b, 0) / n;

    const weights = expectedReturns.map((er, i) => {
      const cov = covarianceMatrix[i][i] || 1;
      const relReturn = er - targetReturn;
      const score = relReturn / cov;
      return Math.max(0, score);
    });

    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights.map(() => 1 / n);

    return weights.map(w => w / sum);
  }

  private riskParityOptimization(covarianceMatrix: number[][]): number[] {
    const n = covarianceMatrix.length;
    const volatilities = covarianceMatrix.map((row, i) => Math.sqrt(row[i] || 1));

    const invVol = volatilities.map(v => (v > 0 ? 1 / v : 1));
    const sum = invVol.reduce((a, b) => a + b, 0);

    if (sum === 0) return volatilities.map(() => 1 / n);

    return invVol.map(inv => inv / sum);
  }

  private calculatePortfolioVolatility(weights: number[], covarianceMatrix: number[][]): number {
    let variance = 0;
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        variance += weights[i] * weights[j] * (covarianceMatrix[i]?.[j] || 0);
      }
    }
    return Math.sqrt(Math.max(0, variance));
  }
}

export const portfolioOptimizer = new PortfolioOptimizer();