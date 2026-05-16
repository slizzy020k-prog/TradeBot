import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

interface DarkPoolTrade {
  symbol: string;
  side: 'buy' | 'sell' | 'unknown';
  volume: number;
  price: number;
  venue: string;
  timestamp: number;
  isBlockTrade: boolean;
  estimatedNotional: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  manipulationRisk: number;
}

export class DarkPoolSentimentAgent {
  private sourceName: string = 'Dark Pool';
  private baseUrl: string = 'https://darkpool.report';

  private darkPoolVenues = [
    'NASDAQ TOC', 'NYSE ARCA', 'BATS', 'IEX', 'CBOE',
    'Citadel', 'Virtu', 'Two Sigma', 'Jane Street'
  ];

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape dark pool data from various sources
      const sources = [
        'https://www.barchart.com/options/most-active',
        'https://www.wsj.com/market-data/quotes/options/most-active'
      ];

      const results = await scrapingService.scrapeBatch(sources, 'scrapling');

      for (const result of results) {
        if (result.success && result.content) {
          const trades = this.parseDarkPoolData(result);
          const tradeAnalyses = trades.map(t => this.tradeToAnalysis(t, result.url));
          analyses.push(...tradeAnalyses);
        }
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping dark pool data`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape block trades and dark pool activity
      const sources = [
        'https://www.nasdaq.com/quotes/dark-pool',
        'https://www.investopedia.com/terms/d/dark-pool.asp'
      ];

      const results = await scrapingService.scrapeBatch(sources, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const trades = this.parseBlockTrades(result);
          const tradeAnalyses = trades.map(t => this.tradeToAnalysis(t, result.url));
          analyses.push(...tradeAnalyses);
        }
      }

      // Also try to scrape FINRA ATS data
      const finraData = await this.scrapeFinraData();
      if (finraData.length > 0) {
        analyses.push(...finraData);
      }

      // Classify trades
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Dark pool data has moderate manipulation risk
      const filtered = classified.filter(a =>
        a.scores.confidenceScore > 30 &&
        a.scores.manipulationRiskScore < 55
      );

      logger.info(`${this.sourceName}: Analyzed ${classified.length} dark pool trades, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private async scrapeFinraData(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      // FINRA publishes ATS data but it's delayed
      const finraUrl = 'https://www.finra.org/finra-data/bulk-file-download/alternatives-trading-systems';
      const response = await scrapingService.scrape(finraUrl, 'playwright');

      if (response.success && response.content) {
        const trades = this.parseFinraData(response);
        for (const trade of trades) {
          analyses.push(this.tradeToAnalysis(trade, response.url));
        }
      }
    } catch (error) {
      logger.warn(`${this.sourceName}: Could not scrape FINRA data`, error);
    }

    return analyses;
  }

  private parseDarkPoolData(response: ScrapingResponse): DarkPoolTrade[] {
    const trades: DarkPoolTrade[] = [];

    try {
      // Parse dark pool trade indicators from content
      const pattern = /\b([A-Z]{1,5})\b\s+(buy|sell|bought|sold)\s+(\d+[\d,]*)\s+shares?\s+@?\s*\$?(\d+\.?\d*)/gi;
      const matches = response.content.matchAll(pattern);

      for (const match of matches) {
        const symbol = match[1];
        const side = match[2].toLowerCase().startsWith('b') ? 'buy' : 'sell';
        const volume = parseInt(match[3].replace(/,/g, ''));
        const price = parseFloat(match[4]);

        trades.push({
          symbol,
          side,
          volume,
          price,
          venue: 'Unknown Dark Pool',
          timestamp: Date.now(),
          isBlockTrade: volume > 10000,
          estimatedNotional: volume * price,
          sentiment: this.calculateTradeSentiment(side, volume, price),
          manipulationRisk: this.calculateManipulationRisk(volume, price)
        });
      }

      // Also try to parse table structures
      if (trades.length === 0) {
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const rows = response.content.matchAll(rowPattern);

        for (const row of rows) {
          const cells = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          if (cells.length >= 4 && cells[0] && cells[1] && cells[2] && cells[3]) {
            const symbolMatch = cells[0].match(/\b([A-Z]{1,5})\b/);
            const volumeMatch = cells[1].match(/(\d+[\d,]*)/);
            const priceMatch = cells[2].match(/\$?(\d+\.?\d*)/);

            if (symbolMatch && volumeMatch && priceMatch) {
              trades.push({
                symbol: symbolMatch[1],
                side: 'unknown',
                volume: parseInt(volumeMatch[1].replace(/,/g, '')),
                price: parseFloat(priceMatch[1]),
                venue: (cells[3] || 'Unknown').replace(/<[^>]+>/g, ''),
                timestamp: Date.now(),
                isBlockTrade: parseInt(volumeMatch[1].replace(/,/g, '')) > 10000,
                estimatedNotional: parseInt(volumeMatch[1].replace(/,/g, '')) * parseFloat(priceMatch[1]),
                sentiment: 'neutral',
                manipulationRisk: 45
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing dark pool data`, error);
    }

    return trades;
  }

  private parseBlockTrades(response: ScrapingResponse): DarkPoolTrade[] {
    const trades: DarkPoolTrade[] = [];

    try {
      // Parse block trade patterns
      const blockPatterns = [
        /block\s+trade[:\s]+([A-Z]+)\s+(\d+[\d,]*)\s+shares?\s+(@|\$)\s*(\d+\.?\d*)/gi,
        /([A-Z]+)\s+(?:block|print)[:\s]+(\d+[\d,]*)\s+@?\s*\$?(\d+\.?\d*)/gi,
        /(\d+[\d,]*)\s+shares?\s+of\s+([A-Z]+)\s+@?\s*\$?(\d+\.?\d*)/gi
      ];

      for (const pattern of blockPatterns) {
        const matches = response.content.matchAll(pattern);
        for (const match of matches) {
          // Different patterns have different group orders
          let symbol: string, volume: number, price: number;

          if (match[1].length <= 5 && /^[A-Z]+$/.test(match[1])) {
            symbol = match[1];
            volume = parseInt(match[2].replace(/,/g, ''));
            price = parseFloat(match[3]);
          } else {
            volume = parseInt(match[1].replace(/,/g, ''));
            symbol = match[2];
            price = parseFloat(match[3]);
          }

          if (volume > 1000) {
            trades.push({
              symbol,
              side: 'unknown',
              volume,
              price,
              venue: 'Block Trade Venue',
              timestamp: Date.now(),
              isBlockTrade: volume > 10000,
              estimatedNotional: volume * price,
              sentiment: this.inferSentiment(symbol, volume, price),
              manipulationRisk: this.calculateBlockManipulationRisk(volume, price)
            });
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing block trades`, error);
    }

    return trades;
  }

  private parseFinraData(response: ScrapingResponse): DarkPoolTrade[] {
    const trades: DarkPoolTrade[] = [];

    try {
      // FINRA ATS data typically in CSV format
      const lines = response.content.split(/\n/);

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 5) {
          const symbol = parts[0]?.trim();
          const volume = parseInt(parts[1]?.replace(/"/g, '') || '0');
          const price = parseFloat(parts[2]?.replace(/"/g, '') || '0');

          if (symbol && /^[A-Z]{1,5}$/.test(symbol) && volume > 0 && price > 0) {
            trades.push({
              symbol,
              side: 'unknown',
              volume,
              price,
              venue: parts[3] || 'FINRA ATS',
              timestamp: Date.now(),
              isBlockTrade: volume > 10000,
              estimatedNotional: volume * price,
              sentiment: this.inferSentiment(symbol, volume, price),
              manipulationRisk: 40
            });
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing FINRA data`, error);
    }

    return trades;
  }

  private calculateTradeSentiment(side: 'buy' | 'sell', volume: number, price: number): 'bullish' | 'bearish' | 'neutral' {
    // Large buy orders in dark pools can indicate bullish intent
    if (side === 'buy' && volume > 10000) return 'bullish';
    if (side === 'sell' && volume > 10000) return 'bearish';

    // Block trades have more significance
    if (volume > 50000) {
      return side === 'buy' ? 'bullish' : 'bearish';
    }

    return 'neutral';
  }

  private inferSentiment(symbol: string, volume: number, price: number): 'bullish' | 'bearish' | 'neutral' {
    // Large notional value trades are more significant
    const notional = volume * price;

    if (notional > 5000000) {
      // Large block trades give neutral signal without side info
      return 'neutral';
    }

    return 'neutral';
  }

  private calculateManipulationRisk(volume: number, price: number): number {
    let risk = 40; // Base dark pool risk

    // Very large trades might indicate manipulation
    if (volume > 50000) risk += 20;
    else if (volume > 20000) risk += 15;
    else if (volume > 10000) risk += 10;

    // High notional value
    const notional = volume * price;
    if (notional > 10000000) risk += 15;
    else if (notional > 1000000) risk += 10;

    // Dark pools inherently carry some manipulation risk
    risk += 10;

    return Math.min(90, risk);
  }

  private calculateBlockManipulationRisk(volume: number, price: number): number {
    let risk = 35; // Lower base for block trades

    // Block trades are more legitimate but can still be used for manipulation
    if (volume > 100000) risk += 25;
    else if (volume > 50000) risk += 15;
    else if (volume > 20000) risk += 10;

    // Large notional
    const notional = volume * price;
    if (notional > 10000000) risk += 15;
    else if (notional > 1000000) risk += 10;

    return Math.min(85, risk);
  }

  private tradeToAnalysis(trade: DarkPoolTrade, url: string): NewsAnalysis {
    const headline = `${trade.isBlockTrade ? 'BLOCK TRADE: ' : ''}${trade.side.toUpperCase()} ${trade.volume.toLocaleString()} shares of ${trade.symbol} @ $${trade.price}`;

    const sentimentScore = trade.sentiment === 'bullish' ? 40 :
                         trade.sentiment === 'bearish' ? -40 : 0;

    return {
      headline,
      content: `Volume: ${trade.volume.toLocaleString()} | Price: $${trade.price} | Notional: $${trade.estimatedNotional.toLocaleString()} | Venue: ${trade.venue} | Block: ${trade.isBlockTrade}`,
      url,
      source: `${this.sourceName} - ${trade.venue}`,
      timestamp: trade.timestamp,
      scores: {
        sentimentScore,
        volatilityScore: this.calculateVolatilityScore(trade),
        confidenceScore: this.calculateConfidenceScore(trade),
        institutionalImpactScore: this.calculateInstitutionalScore(trade),
        durationScore: 65,
        manipulationRiskScore: trade.manipulationRisk
      },
      classification: trade.sentiment,
      keyThemes: this.extractThemes(trade),
      relevantSymbols: [trade.symbol]
    };
  }

  private calculateVolatilityScore(trade: DarkPoolTrade): number {
    let score = 45;

    // Large trades indicate conviction
    if (trade.volume > 20000) score += 25;
    else if (trade.volume > 10000) score += 15;
    else if (trade.volume > 5000) score += 10;

    // High notional = high impact
    if (trade.estimatedNotional > 5000000) score += 20;
    else if (trade.estimatedNotional > 1000000) score += 15;

    return Math.min(100, score);
  }

  private calculateConfidenceScore(trade: DarkPoolTrade): number {
    let confidence = 50;

    // Block trades have higher confidence
    if (trade.isBlockTrade) confidence += 20;

    // Dark pool venues are more credible
    const knownVenues = ['NASDAQ', 'NYSE', 'BATS', 'IEX', 'CBOE'];
    for (const venue of knownVenues) {
      if (trade.venue.includes(venue)) {
        confidence += 15;
        break;
      }
    }

    // Volume adds confidence
    if (trade.volume > 10000) confidence += 15;

    return Math.min(90, confidence);
  }

  private calculateInstitutionalScore(trade: DarkPoolTrade): number {
    let score = 45;

    // Large notional = institutional
    if (trade.estimatedNotional > 5000000) score += 40;
    else if (trade.estimatedNotional > 1000000) score += 25;
    else if (trade.estimatedNotional > 500000) score += 15;

    // Block trades are typically institutional
    if (trade.isBlockTrade) score += 20;

    return Math.min(100, score);
  }

  private extractThemes(trade: DarkPoolTrade): string[] {
    const themes: string[] = [];

    if (trade.isBlockTrade) themes.push('block trade');
    themes.push(trade.side);

    const notional = trade.estimatedNotional;
    if (notional > 5000000) themes.push('large notional');
    else if (notional > 1000000) themes.push('medium notional');

    if (trade.volume > 20000) themes.push('high volume');

    return themes.slice(0, 4);
  }

  async getRecentDarkPoolActivity(symbol?: string): Promise<{
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    blockTradeCount: number;
    netSentiment: 'bullish' | 'bearish' | 'neutral';
  }> {
    const analyses = await this.analyzeSentiment();

    let filtered = analyses;
    if (symbol) {
      filtered = analyses.filter(a => a.relevantSymbols.includes(symbol));
    }

    const totalVolume = filtered.reduce((sum, a) => sum + (parseInt(a.content.match(/Volume: (\d+)/)?.[1] || '0')), 0);
    const buyVolume = filtered.filter(a => a.classification === 'bullish').length * 10000;
    const sellVolume = filtered.filter(a => a.classification === 'bearish').length * 10000;
    const blockTradeCount = filtered.filter(a => a.headline.includes('BLOCK')).length;

    let netSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (buyVolume > sellVolume * 1.5) netSentiment = 'bullish';
    else if (sellVolume > buyVolume * 1.5) netSentiment = 'bearish';

    return { totalVolume, buyVolume, sellVolume, blockTradeCount, netSentiment };
  }
}

export const darkPoolSentimentAgent = new DarkPoolSentimentAgent();