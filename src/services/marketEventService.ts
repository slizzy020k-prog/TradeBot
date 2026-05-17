import { EventEmitter } from 'events';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';

export class MarketEventService extends EventEmitter {
  private watchedSymbols = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'AAPL', 'MSFT', 'NVDA'];
  private prices: Map<string, number> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private priceChangeThreshold = 0.001; // 0.1% change triggers event

  start(intervalMs = 5000): void {
    if (this.intervalId) {
      logger.warn('MarketEventService already running');
      return;
    }

    logger.info('MarketEventService started - watching for price changes');
    this.intervalId = setInterval(() => this.checkPriceChanges(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('MarketEventService stopped');
    }
  }

  private async checkPriceChanges(): Promise<void> {
    try {
      const quotes = await marketDataService.getQuotes(this.watchedSymbols);

      for (const quote of quotes) {
        const prevPrice = this.prices.get(quote.symbol);
        const currentPrice = quote.price;

        if (prevPrice !== undefined && prevPrice > 0) {
          const changePct = Math.abs(currentPrice - prevPrice) / prevPrice;

          if (changePct > this.priceChangeThreshold) {
            const direction = currentPrice > prevPrice ? 'up' : 'down';
            logger.info(`Price ${direction}: ${quote.symbol} ${prevPrice.toFixed(2)} -> ${currentPrice.toFixed(2)} (${(changePct * 100).toFixed(2)}%)`);

            this.emit('price:change', {
              symbol: quote.symbol,
              previousPrice: prevPrice,
              currentPrice,
              changePercent: changePct * 100,
              direction,
              timestamp: Date.now()
            });
          }
        }

        this.prices.set(quote.symbol, currentPrice);
      }
    } catch (error) {
      logger.error('Error checking price changes:', error);
    }
  }

  watchSymbols(symbols: string[]): void {
    this.watchedSymbols = symbols;
    logger.info(`Now watching symbols: ${symbols.join(', ')}`);
  }

  getCurrentPrices(): Map<string, number> {
    return new Map(this.prices);
  }
}

export const marketEventService = new MarketEventService();