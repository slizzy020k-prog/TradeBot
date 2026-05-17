import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  publishedAt?: string;
  source?: string;
}

export class WebScraperService {
  private cache: Map<string, { articles: ScrapedArticle[]; timestamp: number }> = new Map();
  private cacheDuration = 3600000; // 1 hour

  async scrapeNews(query: string): Promise<ScrapedArticle[]> {
    const cacheKey = `news:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug(`WebScraper cache hit for ${query}`);
      return cached.articles;
    }

    try {
      const articles = await this.scrapeGoogleRSS(query);
      if (articles.length > 0) {
        this.cache.set(cacheKey, { articles, timestamp: Date.now() });
        return articles;
      }
      // Fallback to other methods
      const rssArticles = await this.scrapeBingNews(query);
      this.cache.set(cacheKey, { articles: rssArticles, timestamp: Date.now() });
      return rssArticles;
    } catch (error) {
      logger.error(`WebScraper failed for ${query}:`, error);
      return [];
    }
  }

  async scrapeGoogleRSS(query: string): Promise<ScrapedArticle[]> {
    try {
      const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' stock')}&hl=en-US&gl=US&ceid=US:en`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const articles: ScrapedArticle[] = [];

      $('item').each((i, el) => {
        if (i >= 10) return;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const description = $(el).find('description').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();

        if (title) {
          // Clean HTML from description
          const content = description.replace(/<[^>]+>/g, '').substring(0, 200);
          articles.push({
            title,
            content: content || title,
            url: link || '',
            publishedAt: pubDate,
            source: 'Google News',
          });
        }
      });

      logger.info(`WebScraper RSS found ${articles.length} articles for "${query}"`);
      return articles;
    } catch (error) {
      logger.error('Google RSS scrape failed:', error);
      return [];
    }
  }

  async scrapeBingNews(query: string): Promise<ScrapedArticle[]> {
    try {
      const searchUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query + ' stock')}&FORM=HDRSGN`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const articles: ScrapedArticle[] = [];

      $('div.news-card').each((i, el) => {
        if (i >= 10) return;
        const title = $(el).find('a.title').text().trim();
        const url = $(el).find('a.title').attr('href') || '';
        const snippet = $(el).find('div.snippet').text().trim();
        const source = $(el).find('span.provider').text().trim();

        if (title) {
          articles.push({
            title,
            content: snippet,
            url,
            source: source || 'Bing News',
          });
        }
      });

      // Fallback to generic parsing
      if (articles.length === 0) {
        $('a[href*="/news/"]').each((i, el) => {
          if (i >= 10) return;
          const title = $(el).text().trim();
          const url = $(el).attr('href') || '';

          if (title && title.length > 15) {
            articles.push({
              title,
              content: title,
              url,
              source: 'Bing News',
            });
          }
        });
      }

      logger.info(`WebScraper Bing found ${articles.length} articles for "${query}"`);
      return articles;
    } catch (error) {
      logger.error('Bing News scrape failed:', error);
      return [];
    }
  }

  async scrapeFallbackNews(query: string): Promise<ScrapedArticle[]> {
    const sources = [
      { name: 'Seeking Alpha', url: `https://seekingalpha.com/search?q=${encodeURIComponent(query)}` },
      { name: 'MarketWatch', url: `https://www.marketwatch.com/search?keyword=${encodeURIComponent(query)}` },
      { name: 'Benzinga', url: `https://www.benzinga.com/search?query=${encodeURIComponent(query)}` },
    ];

    const articles: ScrapedArticle[] = [];

    for (const source of sources) {
      try {
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            timeout: 10000,
          },
        });

        const $ = cheerio.load(response.data);
        $('h3').each((i, el) => {
          if (i >= 5) return;
          const title = $(el).text().trim();
          const link = $(el).closest('a').attr('href') || '';

          if (title && title.length > 10) {
            articles.push({
              title,
              content: `From ${source.name}`,
              url: link.startsWith('http') ? link : `${source.url}${link}`,
              source: source.name,
            });
          }
        });
      } catch (e) {
        logger.debug(`Fallback source ${source.name} failed:`, e);
      }
    }

    return articles;
  }

  async scrapeGeopoliticalNews(): Promise<ScrapedArticle[]> {
    const queries = [
      'US China trade war tariffs',
      'Federal Reserve interest rates',
      'Russia Ukraine war oil',
      'Middle East conflict oil prices',
      'global recession stock market',
      'OPEC oil prices',
      'inflation economy',
    ];

    const allArticles: ScrapedArticle[] = [];

    for (const query of queries) {
      const articles = await this.scrapeNews(query);
      allArticles.push(...articles);
      await this.delay(500);
    }

    logger.info(`Geopolitical news collected: ${allArticles.length} articles`);
    return allArticles.slice(0, 30);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const webScraperService = new WebScraperService();