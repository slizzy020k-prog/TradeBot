import { CorrelationEntry } from '../types';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';

export class CorrelationEngine {
  private correlations: CorrelationEntry[] = [];
  private lookbackDays = 60;

  async calculateCorrelations(symbols: string[]): Promise<CorrelationEntry[]> {
    if (symbols.length < 2) {
      return [];
    }

    const results: CorrelationEntry[] = [];
    const historicalData: Map<string, number[]> = new Map();

    for (const symbol of symbols) {
      try {
        const history = await marketDataService.getHistorical(symbol, '1d', `${this.lookbackDays}d`);
        const closes = history.map(h => h.close).filter((c): c is number => c !== undefined && c > 0);
        if (closes.length > 0) {
          historicalData.set(symbol, closes);
        }
      } catch (error) {
        logger.error(`Failed to fetch history for ${symbol}:`, error);
      }
    }

    const symbolList = Array.from(historicalData.keys());
    for (let i = 0; i < symbolList.length; i++) {
      for (let j = i + 1; j < symbolList.length; j++) {
        const symbol1 = symbolList[i];
        const symbol2 = symbolList[j];
        const data1 = historicalData.get(symbol1);
        const data2 = historicalData.get(symbol2);

        if (data1 && data2 && data1.length > 10 && data2.length > 10) {
          const correlation = this.computePearsonCorrelation(data1, data2);
          results.push({
            symbol1,
            symbol2,
            correlation,
            strength: this.categorizeCorrelation(correlation),
            lookbackDays: this.lookbackDays,
            updatedAt: Date.now(),
          });
        }
      }
    }

    this.correlations = results;
    logger.info(`Calculated ${results.length} pairwise correlations`);
    return results;
  }

  private computePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const xTrim = x.slice(-n);
    const yTrim = y.slice(-n);

    const meanX = xTrim.reduce((a, b) => a + b, 0) / n;
    const meanY = yTrim.reduce((a, b) => a + b, 0) / n;

    let covariance = 0;
    let varX = 0;
    let varY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xTrim[i] - meanX;
      const dy = yTrim[i] - meanY;
      covariance += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    const stdX = Math.sqrt(varX);
    const stdY = Math.sqrt(varY);

    if (stdX === 0 || stdY === 0) return 0;
    return covariance / (stdX * stdY);
  }

  private categorizeCorrelation(r: number): CorrelationEntry['strength'] {
    const absR = Math.abs(r);
    if (absR >= 0.7) {
      return r > 0 ? 'strong_positive' : 'strong_negative';
    } else if (absR >= 0.4) {
      return r > 0 ? 'moderate_positive' : 'moderate_negative';
    }
    return 'weak';
  }

  getCorrelation(symbol1: string, symbol2: string): CorrelationEntry | null {
    return this.correlations.find(
      c => (c.symbol1 === symbol1 && c.symbol2 === symbol2) ||
           (c.symbol1 === symbol2 && c.symbol2 === symbol1)
    ) || null;
  }

  getSymbolCorrelations(symbol: string): CorrelationEntry[] {
    return this.correlations.filter(
      c => c.symbol1 === symbol || c.symbol2 === symbol
    );
  }

  findCorrelatedPairs(threshold = 0.7): CorrelationEntry[] {
    return this.correlations.filter(c => Math.abs(c.correlation) >= threshold);
  }

  findDiversificationOpportunities(symbol: string, threshold = 0.3): CorrelationEntry[] {
    return this.correlations.filter(
      c => (c.symbol1 === symbol || c.symbol2 === symbol) &&
           Math.abs(c.correlation) < threshold
    );
  }

  getAllCorrelations(): CorrelationEntry[] {
    return this.correlations;
  }
}

export const correlationEngine = new CorrelationEngine();