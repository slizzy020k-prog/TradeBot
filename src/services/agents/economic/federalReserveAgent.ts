import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class FederalReserveAgent {
  private sourceName: string = 'Federal Reserve';
  private baseUrl: string = 'https://federalreserve.gov';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const currentYear = new Date().getFullYear();
    const urls = [
      `${this.baseUrl}/monetarypolicy/fomccalendars${currentYear}.htm`,
      `${this.baseUrl}/newsevents/pressreleases.htm`,
      `${this.baseUrl}/monetarypolicy/policy-committee.htm`,
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
      logger.error(`FederalReserveAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/newsevents/pressreleases.htm`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseContent(result);
        if (analysis) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`FederalReserveAgent getLatestReleases error: ${error}`);
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

      if (trimmed.length > 10 && !trimmed.includes('http') && !trimmed.includes('@')) {
        if (trimmed === trimmed.toUpperCase() || trimmed.endsWith(':')) {
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
        } else {
          sectionContent.push(trimmed);
        }
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

    return analyses;
  }
}

export const federalReserveAgent = new FederalReserveAgent();