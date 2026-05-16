import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class TreasuryYieldAgent {
  private sourceName: string = 'US Treasury';
  private baseUrl: string = 'https://treasury.gov';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/resource-center/data-chart-center/interest-rates`,
      `${this.baseUrl}/office-of-foreign-assets-control/sanctions-programs-information`,
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
      logger.error(`TreasuryYieldAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/resource-center/data-chart-center/interest-rates`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseYieldContent(result);
        if (analysis.length > 0) {
          analyses.push(...analysis);
        }
      }
    } catch (error) {
      logger.error(`TreasuryYieldAgent getLatestReleases error: ${error}`);
    }

    return analyses;
  }

  private parseContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';

    const yieldData = this.extractYieldData(content);

    for (const data of yieldData) {
      const analysis = newsClassifier.analyze(
        data.headline,
        data.content,
        this.sourceName,
        result.url
      );
      analyses.push(analysis);
    }

    return analyses;
  }

  private parseYieldContent(result: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];
    const content = result.content || '';
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    const yieldData: string[] = [];
    const dateMatch = content.match(/\d{4}-\d{2}-\d{2}/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/\d+\.\d+/) || trimmed.includes('%') || trimmed.includes('yield')) {
        yieldData.push(trimmed);
      }
    }

    if (yieldData.length > 0) {
      const analysis = newsClassifier.analyze(
        `Treasury Yield Data${dateMatch ? ' - ' + dateMatch[0] : ''}`,
        yieldData.join(' | '),
        this.sourceName,
        result.url
      );
      analyses.push(analysis);
    }

    return analyses;
  }

  private extractYieldData(content: string): { headline: string; content: string }[] {
    const dataPoints: { headline: string; content: string }[] = [];
    const lines = content.split('\n');

    let currentHeadline = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('%') || trimmed.match(/\d+\.\d+/)) {
        if (!currentHeadline) {
          currentHeadline = 'Treasury Yield Rate';
        }
        currentContent.push(trimmed);
      } else if (trimmed.length > 20 && trimmed.length < 100) {
        if (currentHeadline && currentContent.length > 0) {
          dataPoints.push({
            headline: currentHeadline,
            content: currentContent.join(' '),
          });
        }
        currentHeadline = trimmed;
        currentContent = [];
      }
    }

    if (currentHeadline && currentContent.length > 0) {
      dataPoints.push({
        headline: currentHeadline,
        content: currentContent.join(' '),
      });
    }

    return dataPoints.slice(0, 10);
  }
}

export const treasuryYieldAgent = new TreasuryYieldAgent();