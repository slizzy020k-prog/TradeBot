import axios from 'axios';
import { MarketData } from '../types';
import { logger } from '../utils/logger';

export class MarketDataService {
  private cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private cacheTimeout = 60000;

  async getQuote(symbol: string): Promise<MarketData> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          params: { interval: '1m', range: '1d' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );

      const result = response.data.chart.result[0];
      const meta = result.meta;
      const quote = result.timestamp.length > 0
        ? result.indicators.quote[0]
        : null;

      const marketData: MarketData = {
        symbol: symbol.toUpperCase(),
        price: meta.regularMarketPrice || 0,
        timestamp: meta.regularMarketTime * 1000,
        volume: meta.regularMarketVolume,
        high: quote?.high?.[quote.high.length - 1],
        low: quote?.low?.[quote.low.length - 1],
        open: quote?.open?.[quote.open.length - 1],
        close: quote?.close?.[quote.close.length - 1],
      };

      this.cache.set(symbol, { data: marketData, timestamp: Date.now() });
      return marketData;
    } catch (error) {
      logger.error(`Failed to fetch quote for ${symbol}:`, error);
      throw error;
    }
  }

  async getQuotes(symbols: string[]): Promise<MarketData[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }

  async getHistorical(symbol: string, interval: string = '1d', range: string = '1mo'): Promise<MarketData[]> {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          params: { interval, range },
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );

      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      return timestamps.map((ts: number, i: number) => ({
        symbol: symbol.toUpperCase(),
        timestamp: ts * 1000,
        price: quote.close[i] || 0,
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i],
      }));
    } catch (error) {
      logger.error(`Failed to fetch historical for ${symbol}:`, error);
      throw error;
    }
  }
}

export const marketDataService = new MarketDataService();