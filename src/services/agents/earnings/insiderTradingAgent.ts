import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class InsiderTradingAgent {
  private sourceName: string = 'InsiderTrading';
  private baseUrl: string = 'https://www.sec.gov/cgi-bin/browse-edgar';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping SEC insider filings`);

      const urls = [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=Form+4&owner=include&count=40',
        'https://www.insiderinsider.com/filing/new/',
        'https://www.form4insider.com/',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const insiderData = this.parseInsiderFilings(result);
          for (const item of insiderData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Insider buying/selling has high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 35);
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
      logger.info(`${this.sourceName}: Detecting insider trading activity`);

      const activityUrls = [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=Form+4&owner=include&count=100',
        'https://www.insiderinsider.com/transaction/',
      ];

      for (const url of activityUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const activity = this.extractInsiderActivity(result);
          for (const item of activity) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Major insider transactions are high impact
            if (item.isMajor) {
              analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 40);
              analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
            }
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Insider activity detection failed`, error);
    }

    return analyses;
  }

  private parseInsiderFilings(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse insider filing entries from SEC data
    const filingRegex = /([A-Z]{1,5})\s+(?:Form\s+4|filed|reports?).*(?:buy|sell|purchase|sale)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const filingMatch = line.match(filingRegex);
      if (filingMatch) {
        const tickerMatch = line.match(/\b[A-Z]{1,5}\b/);
        if (tickerMatch) {
          const ticker = tickerMatch[0];
          const isBuying = line.toLowerCase().includes('buy') || line.toLowerCase().includes('purchase');
          const isSelling = line.toLowerCase().includes('sell') || line.toLowerCase().includes('sale');

          items.push({
            headline: `${ticker} Insider ${isBuying ? 'Buying' : isSelling ? 'Selling' : 'Transaction'} Detected`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    // Parse transaction tables
    const transactionRegex = /([A-Z]{2,5})\s+\|\s*(?:\d+\s+)?(?:shares?|units?).*(?:\$[\d,]+|buy|sell|purchase)/gi;
    let match;
    while ((match = transactionRegex.exec(content)) !== null) {
      const ticker = match[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} Insider Transaction Filed`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractInsiderActivity(result: any): Array<{ headline: string; content: string; url: string; isMajor: boolean }> {
    const items: Array<{ headline: string; content: string; url: string; isMajor: boolean }> = [];
    const content = result.markdown || result.content;

    // Extract major insider transactions (>$1M or >10% of holdings)
    const majorPatterns = [
      /([A-Z]{2,5})\s+(?:CEO|CFO|COO|Executive|Director|Principal).*(?:\$[\d,]+|\d+\s+(?:shares?|units?)).*(?:buy|sell|purchase)/gi,
      /([A-Z]{2,5})\s+(?:acquired|disposed).*(?:\$[\d,]+|\d+\s+(?:shares?|units?))/gi,
      /([A-Z]{2,5})\s+(?:open\s+market|purchase|sale).*(?:\$[\d,]+|\d+%\s+(?:of|shares?))/gi,
    ];

    for (const pattern of majorPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1] || match[0].split(/\s+/)[0];
        items.push({
          headline: `Major Insider Transaction: ${ticker}`,
          content: match[0],
          url: result.url,
          isMajor: true,
        });
      }
    }

    // Also extract smaller transactions
    const smallPattern = /([A-Z]{2,5})\s+(?:Form\s+4|filed|reports?).*(?:buy|sell)/gi;
    let match2;
    while ((match2 = smallPattern.exec(content)) !== null) {
      const ticker = match2[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `Insider Filing: ${ticker}`,
          content: match2[0],
          url: result.url,
          isMajor: false,
        });
      }
    }

    return items;
  }
}

export const insiderTradingAgent = new InsiderTradingAgent();