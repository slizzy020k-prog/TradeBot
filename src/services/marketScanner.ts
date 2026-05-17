import { EventEmitter } from 'events';
import { AssetClass, MarketDataExtended, UniverseSymbol } from '../types';
import { marketDataService } from './marketData';
import { getAllEnabledSymbols, getSymbolsByAssetClass } from '../config/marketUniverse';
import { logger } from '../utils/logger';

export class MarketScannerService extends EventEmitter {
  private cache: Map<string, MarketDataExtended> = new Map();
  private cacheTimeout = 30000;

  getAllEnabledSymbols(): UniverseSymbol[] {
    return getAllEnabledSymbols();
  }

  getSymbolsByAssetClass(assetClass: AssetClass): UniverseSymbol[] {
    return getSymbolsByAssetClass(assetClass);
  }

  async scanAllMarkets(): Promise<MarketDataExtended[]> {
    const symbols = this.getAllEnabledSymbols();
    if (symbols.length === 0) {
      logger.warn('No symbols enabled in universe');
      return [];
    }

    const results: MarketDataExtended[] = [];
    const batchSize = 10;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const symbolStrings = batch.map(s => s.symbol);

      try {
        const marketData = await marketDataService.getQuotes(symbolStrings);

        for (const md of marketData) {
          const universeSymbol = batch.find(s => s.symbol === md.symbol);
          const extended = this.extendMarketData(md, universeSymbol);
          results.push(extended);
          this.cache.set(md.symbol, extended);
        }

        if (i + batchSize < symbols.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        logger.error(`Batch scan error for ${batch.join(', ')}:`, error);
      }
    }

    const assetClassCount = new Set(results.map(r => r.assetClass)).size;
    logger.info(`Market scan complete: ${results.length} symbols across ${assetClassCount} asset classes`);

    // Emit scan complete event for event-driven analysis
    this.emit('scan:complete', { symbols: results.length, assetClasses: assetClassCount, timestamp: Date.now() });

    return results;
  }

  async scanAssetClass(assetClass: AssetClass): Promise<MarketDataExtended[]> {
    const symbols = this.getSymbolsByAssetClass(assetClass);
    if (symbols.length === 0) return [];

    const symbolStrings = symbols.map(s => s.symbol);
    const marketData = await marketDataService.getQuotes(symbolStrings);

    return marketData.map(md => {
      const universeSymbol = symbols.find(s => s.symbol === md.symbol);
      return this.extendMarketData(md, universeSymbol);
    });
  }

  getCachedMarketData(symbol: string): MarketDataExtended | null {
    return this.cache.get(symbol) || null;
  }

  private extendMarketData(md: any, universeSymbol?: UniverseSymbol): MarketDataExtended {
    const symbol = md.symbol || '';
    return {
      ...md,
      assetClass: universeSymbol?.assetClass || this.inferAssetClass(symbol),
      quoteCurrency: this.inferQuoteCurrency(symbol),
      baseCurrency: this.extractBaseCurrency(symbol),
    };
  }

  public inferAssetClass(symbol: string): AssetClass {
    const upper = symbol.toUpperCase();

    if (upper.endsWith('-USD') || upper.endsWith('-BTC') || upper.endsWith('-ETH')) {
      if (['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD'].includes(upper)) {
        return 'crypto';
      }
    }

    if (/^[A-Z]{3}(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)$/.test(upper)) {
      return 'forex';
    }
    if (['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'].includes(upper)) {
      return 'forex';
    }

    if (upper.includes('=F') || ['GC=F', 'CL=F', 'SI=F', 'HG=F', 'NG=F'].includes(upper)) {
      return 'commodities';
    }

    if (upper.startsWith('^TNX') || upper.startsWith('^TYX') || upper.startsWith('^FVX')) {
      return 'bonds';
    }

    const etfList = ['GLD', 'TLT', 'VNQ', 'QQQ', 'SPY', 'IWM', 'EFA', 'EEM', 'XLF', 'XLK', 'XLV'];
    if (etfList.includes(upper)) {
      return 'etfs';
    }

    return 'equities';
  }

  private inferQuoteCurrency(symbol: string): string {
    const upper = symbol.toUpperCase();
    if (upper.includes('USD')) return 'USD';
    if (upper.includes('EUR')) return 'EUR';
    if (upper.includes('GBP')) return 'GBP';
    if (upper.includes('JPY')) return 'JPY';
    if (upper.includes('AUD')) return 'AUD';
    if (upper.includes('CAD')) return 'CAD';
    if (upper.includes('CHF')) return 'CHF';
    if (upper.includes('NZD')) return 'NZD';
    return 'USD';
  }

  private extractBaseCurrency(symbol: string): string | undefined {
    const upper = symbol.toUpperCase();
    if (upper.endsWith('-USD')) return upper.replace('-USD', '');
    if (upper.endsWith('-BTC')) return upper.replace('-BTC', '');
    if (upper.endsWith('-ETH')) return upper.replace('-ETH', '');
    if (/^[A-Z]{3}USD$/.test(upper)) return upper.substring(0, 3);
    if (/^[A-Z]{3}EUR$/.test(upper)) return upper.substring(0, 3);
    if (/^[A-Z]{3}GBP$/.test(upper)) return upper.substring(0, 3);
    if (/^[A-Z]{3}JPY$/.test(upper)) return upper.substring(0, 3);
    return undefined;
  }
}

export const marketScannerService = new MarketScannerService();