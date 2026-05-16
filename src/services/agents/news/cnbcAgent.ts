import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class CNBCNewsAgent {
  private sourceName: string = 'CNBC';
  private baseUrl: string = 'https://cnbc.com';

  async scrape(headlinesCount: number = 10): Promise<NewsAnalysis[]> {
    const url = `${this.baseUrl}/news/`;
    return this.fetchAndAnalyze(url, headlinesCount);
  }

  async analyzeContent(url: string): Promise<NewsAnalysis> {
    const response = await scrapingService.scrape(url);
    return this.parseArticle(response);
  }

  async getLatestNews(): Promise<NewsAnalysis[]> {
    return this.scrape(10);
  }

  private async fetchAndAnalyze(url: string, limit: number): Promise<NewsAnalysis[]> {
    try {
      const response = await scrapingService.scrape(url);
      const headlines = this.extractHeadlines(response);

      const analyses: NewsAnalysis[] = [];
      for (const headline of headlines.slice(0, limit)) {
        const analysis = newsClassifier.analyze(
          headline.title,
          headline.summary || headline.title,
          this.sourceName,
          headline.url
        );
        analyses.push(analysis);
      }

      logger.info(`[CNBC] Analyzed ${analyses.length} headlines`);
      return analyses;
    } catch (error) {
      logger.error(`[CNBC] Failed to fetch news: ${error}`);
      return [];
    }
  }

  private extractHeadlines(response: ScrapingResponse): Array<{title: string; url: string; summary: string}> {
    const headlines: Array<{title: string; url: string; summary: string}> = [];

    if (!response.success || !response.content) {
      return headlines;
    }

    const articlePatterns = [
      /<div[^>]*class="[^"]*Card[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>\s*<h[1-3][^>]*>([^<]+)<\/h[1-3]>[\s\S]*?<\/div>/gi,
      /<article[^>]*>[\s\S]*?<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/article>/gi,
      /<div[^>]*class="[^"]*headline[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    ];

    let match;
    for (const pattern of articlePatterns) {
      while ((match = pattern.exec(response.content)) !== null) {
        const url = match[1].startsWith('http') ? match[1] : `${this.baseUrl}${match[1]}`;
        const title = this.cleanText(match[2] || match[1]);
        if (title.length > 10) {
          headlines.push({ title, url, summary: title });
        }
      }
    }

    const linkPattern = /<a[^>]*href="(\/[^\/]+\/[^\/]+)"[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi;
    while ((match = linkPattern.exec(response.content)) !== null) {
      const url = match[1].startsWith('http') ? match[1] : `${this.baseUrl}${match[1]}`;
      const title = this.cleanText(match[2]);
      if (title.length > 10 && !headlines.some(h => h.url === url)) {
        headlines.push({ title, url, summary: title });
      }
    }

    return headlines.slice(0, 20);
  }

  private parseArticle(response: ScrapingResponse): NewsAnalysis {
    if (!response.success) {
      return newsClassifier.analyze('', '', this.sourceName, response.url);
    }

    return newsClassifier.analyze(
      response.title,
      response.content.substring(0, 3000),
      this.sourceName,
      response.url
    );
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const cnbcNewsAgent = new CNBCNewsAgent();