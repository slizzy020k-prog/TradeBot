import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class InitialClaimsAgent {
  private sourceName: string = 'Department of Labor';
  private baseUrl: string = 'https://dol.gov';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/news.release/claims.nws.htm`,
      `${this.baseUrl}/news.release/empsit.nws.htm`,
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
      logger.error(`InitialClaimsAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/news.release/claims.nws.htm`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseClaimsContent(result);
        if (analysis.length > 0) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`InitialClaimsAgent getLatestReleases error: ${error}`);
    }

    return analyses;
  }

  private parseContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';

    const dataPoints = this.extractDataPoints(content);

    for (const point of dataPoints) {
      const analysis = newsClassifier.analyze(
        point.headline,
        point.content,
        this.sourceName,
        result.url
      );
      analyses.push(analysis);
    }

    return analyses;
  }

  private parseClaimsContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';

    const headlineMatch = content.match(/Jobless Claims[\s\S]{0,100}/);
    const headline = headlineMatch ? headlineMatch[0].split('\n')[0].trim() : 'Jobless Claims Report';

    const keyMetrics: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('Initial') ||
          trimmed.includes('Continued') ||
          trimmed.includes('claim') ||
          trimmed.match(/\d{3,}/)) {
        keyMetrics.push(trimmed);
      }
      if (keyMetrics.length >= 6) break;
    }

    const analysis = newsClassifier.analyze(
      headline,
      keyMetrics.join(' | '),
      this.sourceName,
      result.url
    );
    analyses.push(analysis);

    return analyses;
  }

  private extractDataPoints(content: string): { headline: string; content: string }[] {
    const points: { headline: string; content: string }[] = [];
    const lines = content.split('\n');

    let currentSection = '';
    let sectionLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length > 15 &&
          trimmed.length < 150 &&
          !trimmed.includes('http') &&
          !trimmed.includes('@')) {

        if (currentSection && sectionLines.length > 0) {
          points.push({
            headline: currentSection,
            content: sectionLines.join(' '),
          });
        }
        currentSection = trimmed;
        sectionLines = [];
      } else if (trimmed.length > 20) {
        sectionLines.push(trimmed);
      }
    }

    if (currentSection && sectionLines.length > 0) {
      points.push({
        headline: currentSection,
        content: sectionLines.join(' '),
      });
    }

    return points.slice(0, 10);
  }
}

export const initialClaimsAgent = new InitialClaimsAgent();