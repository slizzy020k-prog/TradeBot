import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class AcquisitionAgent {
  private sourceName: string = 'Acquisition';
  private baseUrl: string = 'https://www.mergerstation.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping M&A news`);

      const urls = [
        'https://www.mergerstation.com/',
        'https://www.benzinga.com/movers/ma',
        'https://www.reuters.com/moneycompanies/ma/',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const maData = this.parseMAData(result);
          for (const item of maData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // M&A news has extremely high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 45);
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
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
      logger.info(`${this.sourceName}: Detecting M&A activity`);

      const maUrls = [
        'https://www.benzinga.com/movers/ma',
        'https://www.reuters.com/moneycompanies/ma/',
      ];

      for (const url of maUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const deals = this.extractMADeals(result);
          for (const item of deals) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );

            // M&A deals are very high impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 50);

            // Classify based on deal type
            if (item.isAcquisition) {
              analysis.classification = item.isHostile ? 'neutral' : 'bullish';
              analysis.scores.sentimentScore = item.isHostile ?
                Math.min(100, analysis.scores.sentimentScore) :
                Math.min(100, analysis.scores.sentimentScore + 30);
            } else if (item.isMerger) {
              analysis.classification = 'bullish';
              analysis.scores.sentimentScore = Math.min(100, analysis.scores.sentimentScore + 25);
            } else if (item.isTakePrivate) {
              analysis.classification = 'bullish';
              analysis.scores.sentimentScore = Math.min(100, analysis.scores.sentimentScore + 20);
            }

            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: M&A detection failed`, error);
    }

    return analyses;
  }

  private parseMAData(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse M&A news entries
    const maRegex = /(?:acquir|acquisition|merger|merge|takeover|buyout|deal)\s+(?:of|with|for)?\s*([A-Z]{1,5})/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const maMatch = line.match(maRegex);
      if (maMatch) {
        // Try to extract both companies involved
        const allTickers = line.match(/\b[A-Z]{1,5}\b/g) || [];
        const uniqueTickers = [...new Set<string>(allTickers)].filter((t: string) => t.length >= 1 && t.length <= 5);

        if (uniqueTickers.length >= 1) {
          const primaryTicker = uniqueTickers[0];
          items.push({
            headline: `M&A Activity: ${primaryTicker} Involved in Deal`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    // Parse structured deal data
    const dealRegex = /([A-Z]{2,5})\s+(?:acquir|buys?|acquisition|merger)\s+([A-Z]{2,5})/gi;
    let match: RegExpExecArray | null;
    while ((match = dealRegex.exec(content)) !== null) {
      const ticker1 = match[1];
      const ticker2 = match[2];
      if (!items.some(i => i.headline.includes(ticker1) && i.headline.includes(ticker2))) {
        items.push({
          headline: `M&A Deal: ${ticker1} Acquires ${ticker2}`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractMADeals(result: any): Array<{ headline: string; content: string; url: string; isAcquisition: boolean; isMerger: boolean; isTakePrivate: boolean; isHostile: boolean }> {
    const items: Array<{ headline: string; content: string; url: string; isAcquisition: boolean; isMerger: boolean; isTakePrivate: boolean; isHostile: boolean }> = [];
    const content = result.markdown || result.content;

    // Extract acquisitions
    const acquisitionPatterns = [
      /([A-Z]{2,5})\s+(?:acquir|acquires|acquisition|acquires\s+all\s+of)\s+([A-Z]{2,5})/gi,
      /([A-Z]{2,5})\s+(?:to\s+acquir|acquir(?:es|ing)?)\s+([A-Z]{2,5})/gi,
    ];

    // Extract mergers
    const mergerPatterns = [
      /([A-Z]{2,5})\s+(?:merger|merges|merger\s+with)\s+([A-Z]{2,5})/gi,
      /([A-Z]{2,5})\s+(?:and\s+)?([A-Z]{2,5})\s+(?:to\s+merge|merge)/gi,
    ];

    // Extract take-private
    const takePrivatePatterns = [
      /([A-Z]{2,5})\s+(?:taken\s+private|go\s+private|take\s+private|going\s+private)/gi,
      /([A-Z]{2,5})\s+(?:to\s+be\s+acquired\s+by\s+private)/gi,
    ];

    // Extract hostile bids
    const hostilePatterns = [
      /([A-Z]{2,5})\s+(?:hostile|takeover\s+bid|unsolicited)/gi,
      /([A-Z]{2,5})\s+(?:rejects?|refuses?).*(?:acquisition|merger|offer)/gi,
    ];

    for (const pattern of acquisitionPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        const target = match[2];
        const matchText = match[0];
        const isHostile = hostilePatterns.some(p => p.test(matchText));

        if (!items.some(i => i.headline.includes(ticker) && i.headline.includes(target))) {
          items.push({
            headline: `${ticker} Announces Acquisition of ${target}`,
            content: matchText,
            url: result.url,
            isAcquisition: true,
            isMerger: false,
            isTakePrivate: false,
            isHostile,
          });
        }
      }
    }

    for (const pattern of mergerPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        const target = match[2];
        const matchText = match[0];
        const isHostile = hostilePatterns.some(p => p.test(matchText));

        if (!items.some(i => i.headline.includes(ticker) && i.headline.includes(target))) {
          items.push({
            headline: `${ticker} and ${target} Announce Merger`,
            content: matchText,
            url: result.url,
            isAcquisition: false,
            isMerger: true,
            isTakePrivate: false,
            isHostile,
          });
        }
      }
    }

    for (const pattern of takePrivatePatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        const matchText = match[0];
        const isHostile = hostilePatterns.some(p => p.test(matchText));

        if (!items.some(i => i.headline.includes(ticker))) {
          items.push({
            headline: `${ticker} Taken Private`,
            content: matchText,
            url: result.url,
            isAcquisition: false,
            isMerger: false,
            isTakePrivate: true,
            isHostile,
          });
        }
      }
    }

    return items;
  }
}

export const acquisitionAgent = new AcquisitionAgent();