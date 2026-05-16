import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class BOEAgent {
  private sourceName: string = 'Bank of England';
  private baseUrl: string = 'https://bankofengland.co.uk';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/news`,
      `${this.baseUrl}/mpw/inflation-report`,
      `${this.baseUrl}/boe-framework/policy`,
    ];

    try {
      const results = await scrapingService.scrapeBatch(urls);
      for (const result of results) {
        if (result.success && result.content) {
          const analysis = this.parseContent(result);
          if (analysis) {
            analyses.push(...analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`BOEAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/news`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseContent(result);
        if (analysis) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`BOEAgent getLatestReleases error: ${error}`);
    }

    return analyses;
  }

  private parseContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    let currentHeadline = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length > 20 &&
          trimmed.length < 200 &&
          !trimmed.includes('http') &&
          !trimmed.includes('@')) {

        if (currentHeadline && currentContent.length > 0) {
          const analysis = newsClassifier.analyze(
            currentHeadline,
            currentContent.join(' '),
            this.sourceName,
            result.url
          );
          analyses.push(analysis);
        }
        currentHeadline = trimmed;
        currentContent = [];
      } else if (trimmed.length > 30) {
        currentContent.push(trimmed);
      }
    }

    if (currentHeadline && currentContent.length > 0) {
      const analysis = newsClassifier.analyze(
        currentHeadline,
        currentContent.join(' '),
        this.sourceName,
        result.url
      );
      analyses.push(analysis);
    }

    return analyses.slice(0, 10);
  }
}

export const boeAgent = new BOEAgent();