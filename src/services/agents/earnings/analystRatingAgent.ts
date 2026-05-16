import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class AnalystRatingAgent {
  private sourceName: string = 'AnalystRating';
  private baseUrl: string = 'https://www.zacks.com/analyst-ratings';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping analyst ratings`);

      const urls = [
        'https://www.zacks.com/analyst-ratings',
        'https://www.benzinga.com/analyst-ratings',
        'https://www.streetinsider.com/Analyst+Ratings',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const ratingsData = this.parseRatingsData(result);
          for (const item of ratingsData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Analyst upgrades/downgrades have high institutional impact
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
      logger.info(`${this.sourceName}: Detecting analyst rating changes`);

      const ratingUrls = [
        'https://www.zacks.com/analyst-ratings/analyst-rating-changes',
        'https://www.benzinga.com/analyst-ratings/price-targets',
      ];

      for (const url of ratingUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const changes = this.extractRatingChanges(result);
          for (const item of changes) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Rating changes are high impact events
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 40);
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 15);

            if (item.isUpgrade) {
              analysis.classification = 'bullish';
              analysis.scores.sentimentScore = Math.min(100, analysis.scores.sentimentScore + 25);
            } else if (item.isDowngrade) {
              analysis.classification = 'bearish';
              analysis.scores.sentimentScore = Math.max(-100, analysis.scores.sentimentScore - 25);
            }

            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Rating change detection failed`, error);
    }

    return analyses;
  }

  private parseRatingsData(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse analyst rating entries
    const ratingRegex = /([A-Z]{1,5})\s+(?:upgraded|downgraded|initiated|maintained|price\s+target)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const ratingMatch = line.match(ratingRegex);
      if (ratingMatch) {
        const tickerMatch = line.match(/\b[A-Z]{1,5}\b/);
        if (tickerMatch) {
          const ticker = tickerMatch[0];
          const isUpgrade = line.toLowerCase().includes('upgrade') || line.toLowerCase().includes('upgraded');
          const isDowngrade = line.toLowerCase().includes('downgrade') || line.toLowerCase().includes('downgraded');
          const isInitiated = line.toLowerCase().includes('initiate');

          let action = '';
          if (isUpgrade) action = 'Upgraded';
          else if (isDowngrade) action = 'Downgraded';
          else if (isInitiated) action = 'Initiated Coverage';
          else action = 'Rating Change';

          items.push({
            headline: `${ticker} ${action}`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    // Parse structured rating data
    const structuredRegex = /([A-Z]{2,5})\s*[/|]\s*(?:buy|sell|hold|outperform|underperform|overweight|underweight)/gi;
    let match;
    while ((match = structuredRegex.exec(content)) !== null) {
      const ticker = match[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} Analyst Rating Update`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractRatingChanges(result: any): Array<{ headline: string; content: string; url: string; isUpgrade: boolean; isDowngrade: boolean }> {
    const items: Array<{ headline: string; content: string; url: string; isUpgrade: boolean; isDowngrade: boolean }> = [];
    const content = result.markdown || result.content;

    // Extract rating changes with direction
    const upgradePatterns = [
      /([A-Z]{2,5})\s+(?:upgraded|raises?|raises?\s+to|upgraded\s+to)/gi,
      /([A-Z]{2,5})\s+(?:outperform|overweight|buy).*(?:from|to)\s+(?:hold|neutral|underperform|sell)/gi,
    ];

    const downgradePatterns = [
      /([A-Z]{2,5})\s+(?:downgraded|lowers?|lowers?\s+to|downgraded\s+to)/gi,
      /([A-Z]{2,5})\s+(?:underperform|underweight|sell).*(?:from|to)\s+(?:hold|neutral|outperform|buy)/gi,
    ];

    for (const pattern of upgradePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        if (!items.some(i => i.headline.includes(ticker) && i.isUpgrade)) {
          items.push({
            headline: `${ticker} Upgraded by Analyst`,
            content: match[0],
            url: result.url,
            isUpgrade: true,
            isDowngrade: false,
          });
        }
      }
    }

    for (const pattern of downgradePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        if (!items.some(i => i.headline.includes(ticker) && i.isDowngrade)) {
          items.push({
            headline: `${ticker} Downgraded by Analyst`,
            content: match[0],
            url: result.url,
            isUpgrade: false,
            isDowngrade: true,
          });
        }
      }
    }

    return items;
  }
}

export const analystRatingAgent = new AnalystRatingAgent();