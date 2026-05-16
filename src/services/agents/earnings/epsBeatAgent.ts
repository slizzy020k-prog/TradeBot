import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class EPSBeatAgent {
  private sourceName: string = 'EPSBeat';
  private baseUrl: string = 'https://www.earnings.com/earnings/eps';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping EPS beat/miss data`);

      const urls = [
        'https://www.earnings.com/earnings/eps',
        'https://www.benzinga.com/earnings/eps-ratings',
        'https://www.zacks.com/earnings/earnings-surprise-history.php',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const beatsMisses = this.parseEPSData(result);
          for (const item of beatsMisses) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // EPS beats have very high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 40);
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 15);
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
      logger.info(`${this.sourceName}: Detecting earnings surprises`);

      // Focus on EPS beats and misses specifically
      const surpriseUrls = [
        'https://www.earnings.com/earnings/eps',
        'https://www.benzinga.com/earnings/earnings-surprise-history',
      ];

      for (const url of surpriseUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const surprises = this.extractSurprises(result);
          for (const item of surprises) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Very high impact for actual surprises
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 45);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Earnings surprises detection failed`, error);
    }

    return analyses;
  }

  private parseEPSData(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse EPS data lines
    const epsRegex = /\$[\d.]+\s*(?:beat|beats|missed|miss|exceeded|surpassed)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const epsMatch = line.match(epsRegex);
      const tickerMatch = line.match(/\b[A-Z]{1,5}\b/);

      if (epsMatch && tickerMatch) {
        const ticker = tickerMatch[0];
        const isBeat = line.toLowerCase().includes('beat') || line.toLowerCase().includes('exceeded');
        const isMiss = line.toLowerCase().includes('miss');

        items.push({
          headline: `${ticker} EPS ${isBeat ? 'Beats' : isMiss ? 'Misses' : ''} Estimates`,
          content: line,
          url: result.url,
        });
      }
    }

    // Also look for structured EPS data
    const structuredRegex = /([A-Z]{1,5})\s+\|.*?\$\d+\.\d+.*?(?:beat|miss)/gi;
    let match;
    while ((match = structuredRegex.exec(content)) !== null) {
      const ticker = match[1];
      const line = match[0];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} Earnings Surprise Detected`,
          content: line,
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractSurprises(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Extract companies that surprised on earnings
    const surprisePatterns = [
      /([A-Z]{2,5})\s+(?:reported|announced).*(?:beat|beats|exceeded).*earnings/i,
      /earnings\s+(?:beat|beats|miss|missed)\s+(?:by|for)?\s*\$?([\d.]+)/gi,
      /([A-Z]{2,5})\s+(?:EPS|Q\d).*(?:beat|beats|surpassed)/gi,
    ];

    for (const pattern of surprisePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1] || match[0].split(/\s+/)[0];
        items.push({
          headline: `${ticker} Reports Earnings Beat`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }
}

export const epsBeatAgent = new EPSBeatAgent();