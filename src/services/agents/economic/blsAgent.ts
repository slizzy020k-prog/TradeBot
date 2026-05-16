import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class BLSAgent {
  private sourceName: string = 'Bureau of Labor Statistics';
  private baseUrl: string = 'https://bls.gov';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    const urls = [
      `${this.baseUrl}/news.release/cpi.nws.htm`,
      `${this.baseUrl}/news.release/empsit.nws.htm`,
      `${this.baseUrl}/news.release/jolts.nws.htm`,
      `${this.baseUrl}/news.release/realcei.nws.htm`,
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
      logger.error(`BLSAgent scrape error: ${error}`);
    }

    return analyses;
  }

  async getLatestReleases(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const result = await scrapingService.scrape(
        `${this.baseUrl}/news.release/empsit.nws.htm`,
        'scrapling'
      );

      if (result.success && result.content) {
        const analysis = this.parseNFPContent(result);
        if (analysis) {
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`BLSAgent getLatestReleases error: ${error}`);
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

  private parseNFPContent(result: ScrapingResponse): NewsAnalysis | null {
    const content = result.content || '';

    const headlineMatch = content.match(/Employment Situation[\s\S]{0,200}/);
    const headline = headlineMatch ? headlineMatch[0].split('\n')[0].trim() : 'Employment Situation Report';

    const keyData: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('%') || line.includes('000') || line.includes('change')) {
        keyData.push(line.trim());
      }
      if (keyData.length >= 5) break;
    }

    return newsClassifier.analyze(
      headline,
      keyData.join(' | '),
      this.sourceName,
      result.url
    );
  }

  private extractDataPoints(content: string): { headline: string; content: string }[] {
    const points: { headline: string; content: string }[] = [];
    const sections = content.split(/\n{2,}/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length > 50 && trimmed.length < 2000) {
        const lines = trimmed.split('\n').filter(l => l.trim());
        if (lines.length >= 2) {
          points.push({
            headline: lines[0].trim(),
            content: lines.slice(1).join(' ').trim(),
          });
        }
      }
    }

    return points.slice(0, 10);
  }
}

export const blsAgent = new BLSAgent();