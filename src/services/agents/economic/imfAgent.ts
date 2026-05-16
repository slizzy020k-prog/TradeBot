import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class IMFDataAgent {
  private sourceName: string = 'IMF';
  private baseUrl: string = 'https://imf.org';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/en/Publications/WEO`,
      `${this.baseUrl}/en/Publications/RO`,
      `${this.baseUrl}/en/News`,
      `${this.baseUrl}/en/Research`,
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
      logger.error(`IMFDataAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/en/News`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseContent(result);
        if (analysis) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`IMFDataAgent getLatestReleases error: ${error}`);
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

      if (trimmed.length > 20 && trimmed.length < 150 && !trimmed.includes('http')) {
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

export const imfDataAgent = new IMFDataAgent();