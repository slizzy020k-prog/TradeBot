import { logger } from '../../utils/logger';

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  markdown?: string;
  timestamp: number;
  author?: string;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface ScrapingOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  useCache?: boolean;
}

const DEFAULT_OPTIONS: ScrapingOptions = {
  timeout: 30000,
  retries: 3,
  useCache: true,
};

export class ScraplingService {
  private cache: Map<string, { content: ScrapedContent; timestamp: number }> = new Map();
  private cacheDuration = 60000;

  async scrape(url: string, options: ScrapingOptions = {}): Promise<ScrapedContent> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.useCache) {
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        logger.debug(`Scrapling cache hit for ${url}`);
        return cached.content;
      }
    }

    try {
      const content = await this.fetchWithRetry(url, opts);
      if (opts.useCache) {
        this.cache.set(url, { content, timestamp: Date.now() });
      }
      return content;
    } catch (error) {
      logger.error(`Scrapling failed for ${url}:`, error);
      throw error;
    }
  }

  private async fetchWithRetry(url: string, options: ScrapingOptions): Promise<ScrapedContent> {
    const { retries, timeout, headers } = options;

    for (let attempt = 0; attempt < (retries || 3); attempt++) {
      try {
        return await this.fetch(url, timeout || 30000, headers || {});
      } catch (error) {
        if (attempt === (retries || 3) - 1) throw error;
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error(`Failed after ${retries} attempts`);
  }

  private async fetch(url: string, timeout: number, headers: Record<string, string>): Promise<ScrapedContent> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseHtml(url, html);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private parseHtml(url: string, html: string): ScrapedContent {
    const title = this.extractTitle(html);
    const content = this.extractContent(html);
    const markdown = this.htmlToMarkdown(content);
    const author = this.extractAuthor(html);

    return {
      url,
      title,
      content,
      markdown,
      timestamp: Date.now(),
      author,
      metadata: {
        wordCount: content.split(/\s+/).length,
        charCount: content.length,
      },
    };
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : 'No Title';
  }

  private extractContent(html: string): string {
    const scriptsAndStyles = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
    const htmlWithoutScripts = html.replace(scriptsAndStyles, '');
    const textWithoutTags = htmlWithoutScripts.replace(/<[^>]+>/g, ' ');
    const cleaned = textWithoutTags.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  private extractAuthor(html: string): string | undefined {
    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
    return authorMatch ? authorMatch[1] : undefined;
  }

  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<h1[^>]*>([^<]+)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>([^<]+)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>([^<]+)<\/h3>/gi, '### $1\n')
      .replace(/<p[^>]*>([^<]+)<\/p>/gi, '$1\n\n')
      .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
      .replace(/<strong[^>]*>([^<]+)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>([^<]+)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const scraplingService = new ScraplingService();