import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class GuidanceAgent {
  private sourceName: string = 'Guidance';
  private baseUrl: string = 'https://www.zacks.com/earnings/guidance';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping forward guidance data`);

      const urls = [
        'https://www.zacks.com/earnings/guidance',
        'https://www.benzinga.com/earnings/guidance',
        'https://www.earnings.com/earnings/guidance',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const guidanceData = this.parseGuidanceData(result);
          for (const item of guidanceData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Guidance changes have very high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 40);
            analysis.scores.durationScore = Math.min(100, analysis.scores.durationScore + 20);
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
      logger.info(`${this.sourceName}: Detecting guidance changes`);

      const guidanceUrls = [
        'https://www.zacks.com/earnings/earnings-guidance.php',
        'https://www.benzinga.com/earnings/earnings-guidance',
      ];

      for (const url of guidanceUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const changes = this.extractGuidanceChanges(result);
          for (const item of changes) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Upward guidance is extremely bullish
            if (item.isUpward) {
              analysis.classification = 'bullish';
              analysis.scores.sentimentScore = Math.min(100, analysis.scores.sentimentScore + 30);
            } else if (item.isDownward) {
              analysis.classification = 'bearish';
              analysis.scores.sentimentScore = Math.max(-100, analysis.scores.sentimentScore - 30);
            }
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 45);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Guidance change detection failed`, error);
    }

    return analyses;
  }

  private parseGuidanceData(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse guidance entries
    const guidanceRegex = /([A-Z]{1,5})\s+(?:raises|lowers|issues|updates|cuts|increases|decreases).*(?:guidance|forecast|outlook|estimates)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const guidanceMatch = line.match(guidanceRegex);
      if (guidanceMatch) {
        const ticker = guidanceMatch[1];
        const isRaising = line.toLowerCase().includes('raise') || line.toLowerCase().includes('increase') || line.toLowerCase().includes('upward');
        const isLowering = line.toLowerCase().includes('lower') || line.toLowerCase().includes('cut') || line.toLowerCase().includes('decrease') || line.toLowerCase().includes('downward');

        items.push({
          headline: `${ticker} ${isRaising ? 'Raises' : isLowering ? 'Lowers' : 'Updates'} Guidance`,
          content: line,
          url: result.url,
        });
      }
    }

    // Also parse structured guidance data
    const structuredRegex = /([A-Z]{2,5})\s*[/|]\s*(?:raises|lowers|issues|cuts|updates).*(?:Q\d|[一二三四五六七八九十]+)/gi;
    let match;
    while ((match = structuredRegex.exec(content)) !== null) {
      const ticker = match[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} Guidance Update`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractGuidanceChanges(result: any): Array<{ headline: string; content: string; url: string; isUpward: boolean; isDownward: boolean }> {
    const items: Array<{ headline: string; content: string; url: string; isUpward: boolean; isDownward: boolean }> = [];
    const content = result.markdown || result.content;

    // Extract guidance changes with direction
    const upwardPatterns = [
      /([A-Z]{2,5})\s+(?:raises|increases|upgrades).*(?:guidance|forecast|outlook|price\s+target)/gi,
      /([A-Z]{2,5})\s+(?:Q\d|[一二三四五六七八九十]+).*(?:raises|increases).*(?:forecast|estimates)/gi,
    ];

    const downwardPatterns = [
      /([A-Z]{2,5})\s+(?:lowers|cuts|reduces|downgrades).*(?:guidance|forecast|outlook|price\s+target)/gi,
      /([A-Z]{2,5})\s+(?:Q\d|[一二三四五六七八九十]+).*(?:lowers|cuts|reduces).*(?:forecast|estimates)/gi,
    ];

    for (const pattern of upwardPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        items.push({
          headline: `${ticker} Raises Guidance`,
          content: match[0],
          url: result.url,
          isUpward: true,
          isDownward: false,
        });
      }
    }

    for (const pattern of downwardPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1];
        // Avoid duplicates
        if (!items.some(i => i.headline.includes(ticker))) {
          items.push({
            headline: `${ticker} Lowers Guidance`,
            content: match[0],
            url: result.url,
            isUpward: false,
            isDownward: true,
          });
        }
      }
    }

    return items;
  }
}

export const guidanceAgent = new GuidanceAgent();