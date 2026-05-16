import { logger } from '../../utils/logger';

export interface PlaywrightResult {
  url: string;
  content: string;
  screenshot?: string;
  title: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface PlaywrightOptions {
  screenshot?: boolean;
  waitForSelector?: string;
  waitForTimeout?: number;
  javascriptEnabled?: boolean;
}

export class PlaywrightService {
  private cache: Map<string, { result: PlaywrightResult; timestamp: number }> = new Map();
  private cacheDuration = 60000;
  private browser: any = null;
  private isRunning = false;

  async scrape(url: string, options: PlaywrightOptions = {}): Promise<PlaywrightResult> {
    const {
      screenshot = false,
      waitForSelector,
      waitForTimeout = 3000,
      javascriptEnabled = true,
    } = options;

    const cacheKey = `${url}:${screenshot}:${waitForSelector || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug(`Playwright cache hit for ${url}`);
      return cached.result;
    }

    const browser = await this.getBrowser();
    if (!browser) {
      return {
        url,
        content: '',
        title: '',
        timestamp: Date.now(),
        success: false,
        error: 'Browser not available',
      };
    }

    try {
      const result = await this.scrapePage(browser, url, {
        screenshot,
        waitForSelector,
        waitForTimeout,
        javascriptEnabled,
      });

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      logger.error(`Playwright failed for ${url}:`, error);
      return {
        url,
        content: '',
        title: '',
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getBrowser(): Promise<any> {
    if (this.browser && this.isRunning) {
      return this.browser;
    }

    try {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({ headless: true });
      this.isRunning = true;
      return this.browser;
    } catch (error) {
      logger.error('Failed to launch Playwright browser:', error);
      return null;
    }
  }

  private async scrapePage(
    browser: any,
    url: string,
    options: PlaywrightOptions
  ): Promise<PlaywrightResult> {
    const page = await browser.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
      }

      if (options.waitForTimeout) {
        await page.waitForTimeout(options.waitForTimeout);
      }

      const title = await page.title();
      const content = await page.content();
      let screenshotBase64: string | undefined;

      if (options.screenshot) {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        screenshotBase64 = screenshot as string;
      }

      const textContent = await page.evaluate(() => (globalThis as any).document?.body?.innerText || '');

      return {
        url,
        content: textContent || this.stripHtml(content),
        screenshot: screenshotBase64,
        title,
        timestamp: Date.now(),
        success: true,
      };
    } finally {
      await page.close();
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isRunning = false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const playwrightService = new PlaywrightService();