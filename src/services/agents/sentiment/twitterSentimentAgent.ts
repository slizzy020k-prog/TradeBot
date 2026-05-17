import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class TwitterSentimentAgent {
  private sourceName: string = 'Twitter/X';
  private baseUrl: string = 'https://twitter.com';

  private trendingTickers: string[] = [];
  private lastScrapeTime: number = 0;
  private scrapeCooldown: number = 30000; // 30 seconds

  async scrape(): Promise<NewsAnalysis[]> {
    const now = Date.now();
    if (now - this.lastScrapeTime < this.scrapeCooldown) {
      logger.debug(`${this.sourceName}: Skipping scrape, cooldown active`);
      return [];
    }
    this.lastScrapeTime = now;

    try {
      const trendingUrl = 'https://twitter.com/search?q=stocks&f=top';
      const response = await scrapingService.scrape(trendingUrl, 'playwright');

      if (!response.success) {
        logger.warn(`${this.sourceName}: Failed to scrape trending topics`);
        return [];
      }

      return this.parseTrendingTweets(response);
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping tweets`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape stock-related trending topics
      const stockQueries = ['$SPY', '$QQQ', '$AAPL', '$TSLA', '$NVDA', 'stock market'];
      const searchUrls = stockQueries.map(q =>
        `https://twitter.com/search?q=${encodeURIComponent(q)}&f=top`
      );

      const results = await scrapingService.scrapeBatch(searchUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const analysesFromResult = this.extractTweets(result);
          analyses.push(...analysesFromResult);
        }
      }

      // Classify and filter for manipulation
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Filter high manipulation risk social posts
      const filtered = classified.filter(a => a.scores.manipulationRiskScore < 70);

      logger.info(`${this.sourceName}: Found ${classified.length} posts, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseTrendingTweets(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Extract ticker mentions from trending
      const tickerPattern = /\$[A-Z]{1,5}/g;
      const matches = response.content.match(tickerPattern) || [];
      this.trendingTickers = [...new Set(matches)];

      // Parse tweets for sentiment
      const tweetBlocks = response.content.split(/tweet|post|retweet/gi);
      for (const block of tweetBlocks.slice(0, 20)) {
        if (block.length > 50) {
          analyses.push({
            headline: this.extractHeadline(block),
            content: block.substring(0, 500),
            url: response.url,
            source: this.sourceName,
            timestamp: Date.now(),
            scores: {
              sentimentScore: this.calculateSocialSentiment(block),
              volatilityScore: 60,
              confidenceScore: 40,
              institutionalImpactScore: 30,
              durationScore: 20,
              manipulationRiskScore: this.calculateSocialManipulationRisk(block)
            },
            classification: 'neutral',
            keyThemes: this.extractThemes(block),
            relevantSymbols: this.extractTickerSymbols(block)
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing tweets`, error);
    }

    return analyses;
  }

  private extractTweets(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Parse user posts from scraped content
      const postPattern = /@[a-zA-Z0-9_]+\s+(.{20,500})/g;
      let match;

      while ((match = postPattern.exec(response.content)) !== null) {
        const postContent = match[1];
        const tickerMatches = postContent.match(/\$[A-Z]+/g) || [];

        if (tickerMatches.length > 0) {
          analyses.push({
            headline: this.extractHeadline(postContent),
            content: postContent,
            url: response.url,
            source: this.sourceName,
            timestamp: Date.now(),
            scores: {
              sentimentScore: this.calculateSocialSentiment(postContent),
              volatilityScore: 50,
              confidenceScore: 35,
              institutionalImpactScore: 25,
              durationScore: 15,
              manipulationRiskScore: this.calculateSocialManipulationRisk(postContent)
            },
            classification: 'neutral',
            keyThemes: this.extractThemes(postContent),
            relevantSymbols: tickerMatches.map(t => t.replace('$', ''))
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error extracting tweets`, error);
    }

    return analyses;
  }

  private extractHeadline(text: string): string {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    return lines[0]?.substring(0, 200) || 'Twitter Post';
  }

  private extractTickerSymbols(text: string): string[] {
    const matches = text.match(/\$[A-Z]{1,5}/g) || [];
    return matches.map(m => m.replace('$', '')).slice(0, 10);
  }

  private extractThemes(text: string): string[] {
    const themes: string[] = [];
    const themeMap: Record<string, string[]> = {
      'earnings': ['earnings', 'revenue', 'beat', 'miss'],
      'analysis': ['analysis', 'technical', 'chart', 'pattern'],
      'news': ['news', 'report', 'announcement'],
      'sentiment': ['bullish', 'bearish', 'buy', 'sell']
    };

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(k => text.toLowerCase().includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 3);
  }

  private calculateSocialSentiment(text: string): number {
    const bullishWords = ['bullish', 'buy', 'long', 'moon', 'to the moon', 'soar', 'rally', 'gain', 'upgraded'];
    const bearishWords = ['bearish', 'sell', 'short', 'drop', 'crash', 'dump', 'downgraded', 'plunge'];

    let score = 0;
    const lower = text.toLowerCase();

    for (const word of bullishWords) {
      if (lower.includes(word)) score += 15;
    }
    for (const word of bearishWords) {
      if (lower.includes(word)) score -= 15;
    }

    return Math.max(-100, Math.min(100, score));
  }

  private calculateSocialManipulationRisk(text: string): number {
    let risk = 25; // Base risk for social media

    const manipulationIndicators = [
      'pump', 'dump', 'short squeeze', 'to the moon', 'hold the line',
      'whale', 'institutional', 'hedge fund', ' manipulation', 'coordinated'
    ];

    for (const indicator of manipulationIndicators) {
      if (text.toLowerCase().includes(indicator)) {
        risk += 20;
      }
    }

    // Check for viral/engagement farming patterns
    if (text.includes('!') && text.includes('🔥')) risk += 15;
    if (text.match(/\$([A-Z]+)\s*\$([A-Z]+)/)) risk += 10; // Multiple tickers

    return Math.min(100, risk);
  }

  calculateSignalQuality(text: string, followerCount?: number): number {
    let quality = 35;

    const qualityIndicators = [
      { text: 'analysis', weight: 10 },
      { text: 'technical', weight: 8 },
      { text: 'chart', weight: 5 },
      { text: 'earnings', weight: 10 },
      { text: 'fundamentals', weight: 12 },
      { text: 'DD', weight: 8 },
      { text: 'due diligence', weight: 10 },
    ];

    const lower = text.toLowerCase();
    for (const indicator of qualityIndicators) {
      if (lower.includes(indicator.text)) {
        quality += indicator.weight;
      }
    }

    if (text.includes('reply') && text.includes('thread')) quality += 10;
    if (text.length > 200) quality += 5;
    if (text.length > 500) quality += 5;

    const manipRisk = this.calculateSocialManipulationRisk(text);
    if (manipRisk < 30) quality += 10;
    else if (manipRisk > 60) quality -= 15;

    if (followerCount) {
      if (followerCount > 100000) quality += 15;
      else if (followerCount > 10000) quality += 10;
      else if (followerCount > 1000) quality += 5;
    }

    return Math.min(90, Math.max(15, quality));
  }

  async getTrendingTickers(): Promise<string[]> {
    return this.trendingTickers;
  }
}

export const twitterSentimentAgent = new TwitterSentimentAgent();