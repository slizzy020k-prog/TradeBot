import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class PriceTargetAgent {
  private sourceName: string = 'PriceTarget';
  private baseUrl: string = 'https://www.benzinga.com/analyst-ratings/price-targets';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping price target data`);

      const urls = [
        'https://www.benzinga.com/analyst-ratings/price-targets',
        'https://www.zacks.com/analyst-ratings/price-targets',
        'https://www.streetinsider.com/Price+Target',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const targetData = this.parsePriceTargets(result);
          for (const item of targetData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Price target changes have high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 30);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Scraping failed`, error);
    }

    return analyses;
  }

  async getEarningsSurprises(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Detecting price target changes`);

      const targetUrls = [
        'https://www.benzinga.com/analyst-ratings/price-targets',
        'https://www.zacks.com/analyst-ratings/price-target-history',
      ];

      for (const url of targetUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const changes = this.extractTargetChanges(result);
          for (const item of changes) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );

            // Price target increases are bullish
            if (item.isIncrease) {
              analysis.classification = 'bullish';
              analysis.scores.sentimentScore = Math.min(100, analysis.scores.sentimentScore + 20);
            } else if (item.isDecrease) {
              analysis.classification = 'bearish';
              analysis.scores.sentimentScore = Math.max(-100, analysis.scores.sentimentScore - 20);
            }

            // Major target changes (>20%) are high impact
            if (item.isMajor) {
              analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 40);
              analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
            } else {
              analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
            }

            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Price target change detection failed`, error);
    }

    return analyses;
  }

  private parsePriceTargets(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse price target entries
    const targetRegex = /([A-Z]{1,5})\s+(?:price\s+target|PT|target)\s*[:\$]?\s*\$?([\d,]+)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const targetMatch = line.match(targetRegex);
      if (targetMatch) {
        const ticker = targetMatch[1];
        const price = targetMatch[2];

        items.push({
          headline: `${ticker} Price Target: $${price}`,
          content: line,
          url: result.url,
        });
      }
    }

    // Parse target changes with direction
    const changeRegex = /([A-Z]{1,5})\s+(?:raises?|lowers?|increases?|decreases?|cuts?)\s+(?:price\s+target|PT)\s+(?:to|from)?\s*\$?([\d,]+)/gi;
    let match;
    while ((match = changeRegex.exec(content)) !== null) {
      const ticker = match[1];
      const newPrice = match[2];
      const isRaise = /raises?|increases?/.test(match[0]);

      items.push({
        headline: `${ticker} ${isRaise ? 'Raised' : 'Lowered'} Price Target to $${newPrice}`,
        content: match[0],
        url: result.url,
      });
    }

    return items;
  }

  private extractTargetChanges(result: any): Array<{ headline: string; content: string; url: string; isIncrease: boolean; isDecrease: boolean; isMajor: boolean }> {
    const items: Array<{ headline: string; content: string; url: string; isIncrease: boolean; isDecrease: boolean; isMajor: boolean }> = [];
    const content = result.markdown || result.content;

    // Extract price target changes with magnitude
    const changePatterns = [
      /([A-Z]{2,5})\s+(?:raises?|lowers?|cuts?|increases?|decreases?)\s+(?:price\s+target|PT)\s+(?:to\s+)?\$?([\d,]+)/gi,
      /([A-Z]{2,5})\s+(?:PT|price\s+target)\s+\$?([\d,]+)\s+(?:from|to)\s+\$?([\d,]+)/gi,
    ];

    for (const pattern of changePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        const priceStr = match[2] || match[3];
        const oldPriceStr = match[3] || match[2];
        const price = parseFloat(priceStr.replace(',', ''));
        const oldPrice = oldPriceStr ? parseFloat(oldPriceStr.replace(',', '')) : price;

        const changePercent = oldPrice ? Math.abs((price - oldPrice) / oldPrice * 100) : 0;
        const isIncrease = price > oldPrice;
        const isDecrease = price < oldPrice;
        const isMajor = changePercent >= 20;

        items.push({
          headline: `${ticker} Price Target ${isIncrease ? 'Raised' : 'Lowered'} to $${price}`,
          content: match[0],
          url: result.url,
          isIncrease,
          isDecrease,
          isMajor,
        });
      }
    }

    // Extract standalone target updates
    const standalonePattern = /([A-Z]{2,5})\s+(?:PT|price\s+target)\s+\$?([\d,]+)/gi;
    let match2;
    while ((match2 = standalonePattern.exec(content)) !== null) {
      const ticker = match2[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} Price Target: $${match2[2]}`,
          content: match2[0],
          url: result.url,
          isIncrease: false,
          isDecrease: false,
          isMajor: false,
        });
      }
    }

    return items;
  }
}

export const priceTargetAgent = new PriceTargetAgent();