import { scraplingService, ScrapedContent } from './scraplingService';
import { crawl4aiService, Crawl4AIResult } from './crawl4aiService';
import { playwrightService, PlaywrightResult } from './playwrightService';
import { logger } from '../../utils/logger';

export type ScrapingTool = 'scrapling' | 'crawl4ai' | 'playwright';
export type ScrapingResult = ScrapedContent | Crawl4AIResult | PlaywrightResult;

export interface ScrapingResponse {
  url: string;
  content: string;
  markdown?: string;
  title: string;
  success: boolean;
  tool: ScrapingTool;
  error?: string;
  timestamp: number;
}

export class ScrapingService {
  private toolPreferences: Map<string, ScrapingTool> = new Map([
    ['bloomberg.com', 'scrapling'],
    ['reuters.com', 'scrapling'],
    ['cnbc.com', 'scrapling'],
    ['ft.com', 'scrapling'],
    ['wsj.com', 'scrapling'],
    ['marketwatch.com', 'scrapling'],
    ['seekingalpha.com', 'scrapling'],
    ['benzinga.com', 'scrapling'],
    ['finance.yahoo.com', 'scrapling'],
    ['fool.com', 'scrapling'],
    ['twitter.com', 'playwright'],
    ['x.com', 'playwright'],
    ['reddit.com', 'playwright'],
    ['youtube.com', 'playwright'],
    ['stocktwits.com', 'playwright'],
    ['tradingview.com', 'crawl4ai'],
  ]);

  private fallbackOrder: ScrapingTool[] = ['scrapling', 'crawl4ai', 'playwright'];

  async scrape(url: string, preferredTool?: ScrapingTool): Promise<ScrapingResponse> {
    const tool = preferredTool || this.getPreferredTool(url);

    try {
      const result = await this.scrapeWithTool(url, tool);
      return this.normalizeResult(result, tool);
    } catch (primaryError) {
      logger.warn(`Primary tool ${tool} failed for ${url}, trying fallbacks`);

      for (const fallback of this.fallbackOrder) {
        if (fallback === tool) continue;
        try {
          const result = await this.scrapeWithTool(url, fallback);
          return this.normalizeResult(result, fallback);
        } catch {
          continue;
        }
      }

      return {
        url,
        content: '',
        title: '',
        success: false,
        tool,
        error: `All scraping tools failed for ${url}`,
        timestamp: Date.now(),
      };
    }
  }

  async scrapeBatch(urls: string[], preferredTool?: ScrapingTool): Promise<ScrapingResponse[]> {
    const results = await Promise.all(
      urls.map(url => this.scrape(url, preferredTool))
    );
    return results;
  }

  private getPreferredTool(url: string): ScrapingTool {
    for (const [domain, tool] of this.toolPreferences) {
      if (url.includes(domain)) {
        return tool;
      }
    }
    return 'scrapling';
  }

  private async scrapeWithTool(url: string, tool: ScrapingTool): Promise<any> {
    switch (tool) {
      case 'scrapling':
        return scraplingService.scrape(url);
      case 'crawl4ai':
        return crawl4aiService.crawl(url);
      case 'playwright':
        return playwrightService.scrape(url, { javascriptEnabled: true });
      default:
        throw new Error(`Unknown scraping tool: ${tool}`);
    }
  }

  private normalizeResult(result: any, tool: ScrapingTool): ScrapingResponse {
    if (tool === 'scrapling') {
      const r = result as ScrapedContent;
      return {
        url: r.url,
        content: r.content,
        markdown: r.markdown,
        title: r.title,
        success: true,
        tool,
        timestamp: r.timestamp,
      };
    } else if (tool === 'crawl4ai') {
      const r = result as Crawl4AIResult;
      return {
        url: r.url,
        content: r.markdown,
        markdown: r.markdown,
        title: r.metadata?.title || '',
        success: r.success,
        tool,
        error: r.error,
        timestamp: Date.now(),
      };
    } else {
      const r = result as PlaywrightResult;
      return {
        url: r.url,
        content: r.content,
        title: r.title,
        success: r.success,
        tool,
        error: r.error,
        timestamp: r.timestamp,
      };
    }
  }

  selectToolForUrl(url: string): ScrapingTool {
    return this.getPreferredTool(url);
  }

  clearAllCaches(): void {
    scraplingService.clearCache();
    crawl4aiService.clearCache();
    playwrightService.clearCache();
  }
}

export const scrapingService = new ScrapingService();
export { scraplingService, crawl4aiService, playwrightService };
export type { ScrapedContent, Crawl4AIResult, PlaywrightResult };