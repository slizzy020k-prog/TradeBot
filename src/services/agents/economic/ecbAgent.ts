import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class ECBAgent {
  private sourceName: string = 'European Central Bank';
  private baseUrl: string = 'https://ecb.europa.eu';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/home/html/news.en.html`,
      `${this.baseUrl}/press/pr/html/index.en.html`,
      `${this.baseUrl}/press/pressconf/html/index.en.html`,
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
      logger.error(`ECBAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/home/html/news.en.html`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseContent(result);
        if (analysis) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`ECBAgent getLatestReleases error: ${error}`);
    }

    return analyses;
  }

  private parseContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    let currentSection = '';
    let sectionContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length > 15 &&
          !trimmed.includes('http') &&
          !trimmed.includes('@') &&
          (trimmed === trimmed.toUpperCase() || /\d{4}-\d{2}-\d{2}/.test(trimmed))) {

        if (currentSection && sectionContent.length > 0) {
          const analysis = newsClassifier.analyze(
            currentSection,
            sectionContent.join(' '),
            this.sourceName,
            result.url
          );
          analyses.push(analysis);
        }
        currentSection = trimmed;
        sectionContent = [];
      } else if (trimmed.length > 30) {
        sectionContent.push(trimmed);
      }
    }

    if (currentSection && sectionContent.length > 0) {
      const analysis = newsClassifier.analyze(
        currentSection,
        sectionContent.join(' '),
        this.sourceName,
        result.url
      );
      analyses.push(analysis);
    }

    return analyses.slice(0, 10);
  }
}

export const ecbAgent = new ECBAgent();