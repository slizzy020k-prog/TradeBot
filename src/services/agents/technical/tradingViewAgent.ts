import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class TradingViewAgent {
  private sourceName = 'TradingView';
  private baseUrl = 'https://www.tradingview.com';

  async scrape(symbol?: string): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = this.buildUrls(symbol);
      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const parsed = this.parseTradingViewContent(result.content, result.url);
          for (const item of parsed) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              result.url
            );
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`TradingView scraping error: ${error}`);
    }

    logger.debug(`TradingView Agent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getTechnicalIndicators(symbol: string): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/symbols/${symbol}/technicals/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const indicators = this.extractIndicators(result.content, symbol);
        for (const indicator of indicators) {
          const analysis = newsClassifier.analyze(
            indicator.headline,
            indicator.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`TradingView technical indicators error: ${error}`);
    }

    return analyses;
  }

  async getMarketOverview(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/markets/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const overview = this.parseMarketOverview(result.content);
        for (const item of overview) {
          const analysis = newsClassifier.analyze(
            item.headline,
            item.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 15);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`TradingView market overview error: ${error}`);
    }

    return analyses;
  }

  private buildUrls(symbol?: string): string[] {
    const urls: string[] = [];

    if (symbol) {
      urls.push(`${this.baseUrl}/symbols/${symbol}/`);
      urls.push(`${this.baseUrl}/symbols/${symbol}/technicals/`);
    }

    urls.push(`${this.baseUrl}/markets/stocks/`);
    urls.push(`${this.baseUrl}/markets/crypto/`);

    return urls;
  }

  private parseTradingViewContent(content: string, url: string): { headline: string; content: string }[] {
    const items: { headline: string; content: string }[] = [];

    const patterns = [
      /([A-Z]{1,5}(?:\.[A-Z])?)\s*(?:price|chart|technical|analysis|screen)/gi,
      /(strong buy|strong sell|neutral|outperform|underperform)/gi,
      /(RSI|MACD|SMA|EMA|support|resistance|breakout)/gi,
    ];

    const headlines = content.split('\n').filter(line => {
      for (const pattern of patterns) {
        pattern.lastIndex = 0; // Reset regex state for each line
        if (pattern.test(line) && line.length > 10 && line.length < 200) {
          return true;
        }
      }
      return false;
    });

    for (const headline of headlines.slice(0, 10)) {
      const cleanedHeadline = headline.trim().replace(/[#*_]/g, '');
      items.push({
        headline: `[Technical] ${cleanedHeadline}`,
        content: `TradingView technical analysis: ${cleanedHeadline}. Source: ${url}`,
      });
    }

    return items;
  }

  private extractIndicators(content: string, symbol: string): { headline: string; content: string }[] {
    const items: { headline: string; content: string }[] = [];

    const indicatorPatterns = [
      { pattern: /RSI[^\n]{0,50}/gi, name: 'RSI' },
      { pattern: /MACD[^\n]{0,50}/gi, name: 'MACD' },
      { pattern: /moving average[^\n]{0,50}/gi, name: 'Moving Average' },
      { pattern: /support[^\n]{0,50}/gi, name: 'Support' },
      { pattern: /resistance[^\n]{0,50}/gi, name: 'Resistance' },
      { pattern: /breakout[^\n]{0,50}/gi, name: 'Breakout' },
    ];

    for (const { pattern, name } of indicatorPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches.slice(0, 3)) {
        items.push({
          headline: `${symbol} ${name}: ${match.substring(0, 60)}`,
          content: `${name} indicator for ${symbol}: ${match}. TradingView technical analysis.`,
        });
      }
    }

    return items;
  }

  private parseMarketOverview(content: string): { headline: string; content: string }[] {
    const items: { headline: string; content: string }[] = [];

    const sectors = ['Technology', 'Healthcare', 'Financial', 'Energy', 'Consumer'];
    const relevantLines = content.split('\n').filter(line =>
      sectors.some(s => line.includes(s)) ||
      (line.includes('up') && line.includes('%')) ||
      (line.includes('down') && line.includes('%'))
    );

    for (const line of relevantLines.slice(0, 5)) {
      const cleaned = line.trim().replace(/[#*_]/g, '');
      if (cleaned.length > 10) {
        items.push({
          headline: `Market Overview: ${cleaned.substring(0, 80)}`,
          content: `Market breadth data from TradingView: ${cleaned}`,
        });
      }
    }

    return items;
  }
}

export const tradingViewAgent = new TradingViewAgent();