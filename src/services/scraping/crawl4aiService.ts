import { logger } from '../../utils/logger';

export interface Crawl4AIResult {
  url: string;
  markdown: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    publishedDate?: string;
  };
  success: boolean;
  error?: string;
}

export interface Crawl4AIOptions {
  prompt?: string;
  maxLength?: number;
  waitFor?: number;
 jsEnabled?: boolean;
}

export class Crawl4AIService {
  private cache: Map<string, { result: Crawl4AIResult; timestamp: number }> = new Map();
  private cacheDuration = 60000;
  private baseUrl = 'http://localhost:8000';

  async crawl(url: string, options: Crawl4AIOptions = {}): Promise<Crawl4AIResult> {
    const { prompt, maxLength, waitFor, jsEnabled } = options;

    const cacheKey = `${url}:${prompt || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug(`Crawl4AI cache hit for ${url}`);
      return cached.result;
    }

    try {
      const result = await this.makeRequest(url, { prompt, maxLength, waitFor, jsEnabled });
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      logger.error(`Crawl4AI failed for ${url}:`, error);
      return {
        url,
        markdown: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async makeRequest(
    url: string,
    options: Crawl4AIOptions
  ): Promise<Crawl4AIResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [url],
          prompt: options.prompt || 'Extract all content',
          max_length: options.maxLength || 4000,
          wait_for: options.waitFor || 2,
          js_enabled: options.jsEnabled ?? true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Crawl4AI returned ${response.status}`);
      }

      const data: any = await response.json();
      const result = data.results?.[0];

      if (!result) {
        throw new Error('No result returned from Crawl4AI');
      }

      return {
        url,
        markdown: result.markdown || '',
        html: result.html,
        metadata: {
          title: result.metadata?.title,
          description: result.metadata?.description,
          author: result.metadata?.author,
          publishedDate: result.metadata?.published_date,
        },
        success: true,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async crawlBatch(urls: string[], options: Crawl4AIOptions = {}): Promise<Crawl4AIResult[]> {
    const { prompt, maxLength, waitFor, jsEnabled } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          prompt: options.prompt || 'Extract all market-relevant content',
          max_length: maxLength || 4000,
          wait_for: waitFor || 2,
          js_enabled: jsEnabled ?? true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Crawl4AI batch returned ${response.status}`);
      }

      const data: any = await response.json();
      return (data.results || []).map((result: any) => ({
        url: result.url || '',
        markdown: result.markdown || '',
        html: result.html,
        metadata: result.metadata,
        success: true,
      }));
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('Crawl4AI batch failed:', error);
      return urls.map(url => ({
        url,
        markdown: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  isAvailable(): boolean {
    return true;
  }
}

export const crawl4aiService = new Crawl4AIService();