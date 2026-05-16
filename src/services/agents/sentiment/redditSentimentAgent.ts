import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class RedditSentimentAgent {
  private sourceName: string = 'Reddit/WallStreetBets';
  private baseUrl: string = 'https://reddit.com';

  private trackedSubreddits = [
    'wallstreetbets', 'stocks', 'investing', 'daytrading', 'StockMarket'
  ];

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      for (const subreddit of this.trackedSubreddits) {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const response = await scrapingService.scrape(url, 'playwright');

        if (response.success && response.content) {
          const posts = this.parseSubredditPosts(response, subreddit);
          analyses.push(...posts);
        }
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping Reddit`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape trending tickers from multiple sources
      const tickerUrls = [
        'https://www.reddit.com/r/wallstreetbets.json?limit=50',
        'https://www.reddit.com/r/StockMarket.json?limit=50'
      ];

      const results = await scrapingService.scrapeBatch(tickerUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const posts = this.parseRedditPosts(result);
          analyses.push(...posts);
        }
      }

      // Classify all posts
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Filter for quality and manipulation risk
      const filtered = classified.filter(a =>
        a.scores.confidenceScore > 25 &&
        a.scores.manipulationRiskScore < 65
      );

      logger.info(`${this.sourceName}: Analyzed ${classified.length} posts, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseSubredditPosts(response: ScrapingResponse, subreddit: string): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Parse Reddit post structure
      const postPattern = /"title":"([^"]+)"/g;
      const scorePattern = /"score":(\d+)/g;
      const tickerPattern = /\b([A-Z]{1,5})\b(?:\s+(?:stock|shares|to|the|and|&|\$))/g;

      const titles = [...response.content.matchAll(postPattern)];
      const scores = [...response.content.matchAll(scorePattern)];

      for (let i = 0; i < Math.min(titles.length, 25); i++) {
        const title = this.decodeUnicode(titles[i][1]);
        const score = scores[i] ? parseInt(scores[i][1]) : 0;

        if (title.length > 20) {
          const tickers = this.extractTickers(title);

          analyses.push({
            headline: title.substring(0, 200),
            content: `Reddit ${subreddit} post with ${score} upvotes`,
            url: response.url,
            source: `${this.sourceName}/r/${subreddit}`,
            timestamp: Date.now(),
            scores: {
              sentimentScore: this.calculateRedditSentiment(title, score),
              volatilityScore: 50,
              confidenceScore: this.calculateConfidence(score),
              institutionalImpactScore: 20,
              durationScore: 25,
              manipulationRiskScore: this.calculateManipulationRisk(title, score)
            },
            classification: 'neutral',
            keyThemes: this.extractThemes(title),
            relevantSymbols: tickers
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing subreddit posts`, error);
    }

    return analyses;
  }

  private parseRedditPosts(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Extract JSON posts from Reddit HTML/content
      const titleMatches = response.content.match(/"title":"([^"]+)"/g) || [];
      const selftextMatches = response.content.match(/"selftext":"([^"]+)"/g) || [];
      const scoreMatches = response.content.match(/"score":(\d+)/g) || [];

      for (let i = 0; i < Math.min(titleMatches.length, 30); i++) {
        const titleRaw = titleMatches[i]?.replace('"title":"', '') || '';
        const title = this.decodeUnicode(titleRaw);
        const selftext = selftextMatches[i]?.replace(/"selftext":"/, '') || '';
        const score = scoreMatches[i] ? parseInt(scoreMatches[i].replace(/\D/g, '')) : 0;

        if (title.length > 10) {
          const tickers = this.extractTickers(`${title} ${selftext}`);

          analyses.push({
            headline: title.substring(0, 200),
            content: selftext.substring(0, 1000),
            url: response.url,
            source: this.sourceName,
            timestamp: Date.now(),
            scores: {
              sentimentScore: this.calculateRedditSentiment(title, score),
              volatilityScore: 55,
              confidenceScore: this.calculateConfidence(score),
              institutionalImpactScore: 25,
              durationScore: 20,
              manipulationRiskScore: this.calculateManipulationRisk(title, score)
            },
            classification: 'neutral',
            keyThemes: this.extractThemes(`${title} ${selftext}`),
            relevantSymbols: tickers
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing Reddit posts`, error);
    }

    return analyses;
  }

  private extractTickers(text: string): string[] {
    const tickers: string[] = [];

    // Match $TICKER format
    const dollarMatches = text.match(/\$([A-Z]{1,5})/g) || [];
    tickers.push(...dollarMatches.map(m => m.replace('$', '')));

    // Match standalone tickers (less reliable)
    const standalonePattern = /\b([A-Z]{2,5})\b(?=\s+(?:stock|shares|to|moon|called))/g;
    const standaloneMatches = text.match(standalonePattern) || [];
    tickers.push(...standaloneMatches);

    return [...new Set(tickers)].slice(0, 10);
  }

  private decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-f]{4})/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    ).replace(/\\"/g, '"').replace(/\\n/g, ' ');
  }

  private calculateRedditSentiment(title: string, score: number): number {
    const bullishTerms = ['bullish', 'buy', 'long', 'calls', 'moon', 'to the moon', 'rocket', 'holds', 'DD'];
    const bearishTerms = ['bearish', 'sell', 'puts', 'drop', 'crash', 'dump', 'shorts', 'rip'];
    const scoreBoost = Math.log10(Math.max(score, 1)) * 5;

    let sentiment = 0;
    const lowerTitle = title.toLowerCase();

    for (const term of bullishTerms) {
      if (lowerTitle.includes(term)) sentiment += 15;
    }
    for (const term of bearishTerms) {
      if (lowerTitle.includes(term)) sentiment -= 15;
    }

    return Math.max(-100, Math.min(100, sentiment + scoreBoost));
  }

  private calculateConfidence(score: number): number {
    let confidence = 30;
    confidence += Math.log10(Math.max(score, 1)) * 8;
    return Math.min(85, confidence);
  }

  private calculateManipulationRisk(title: string, score: number): number {
    let risk = 30;

    // High engagement can indicate manipulation
    if (score > 10000) risk += 15;
    if (score > 50000) risk += 10;

    // Check for pump patterns
    const pumpIndicators = ['pump', 'to the moon', 'rocket', 'squeeze', 'spray', 'this will'];
    for (const indicator of pumpIndicators) {
      if (title.toLowerCase().includes(indicator)) risk += 20;
    }

    // Check forDD (due diligence) claims - often used in manipulation
    if (title.includes('DD') && !title.includes('follow')) risk += 10;

    // Check for emoji usage
    if (title.includes('🚀') || title.includes('💎')) risk += 10;

    return Math.min(95, risk);
  }

  private extractThemes(text: string): string[] {
    const themes: string[] = [];
    const lower = text.toLowerCase();

    const themeMap: Record<string, string[]> = {
      'earnings': ['earnings', 'revenue', 'eps', 'beat', 'miss', 'quarter'],
      'technical': ['technical', 'chart', 'pattern', 'breakout', 'resistance'],
      'momentum': ['squeeze', 'momentum', 'volume', 'run', 'rally'],
      'fundamentals': ['fundamentals', 'value', 'pe', 'ratio', 'analysis'],
      'options': ['options', 'calls', 'puts', 'strike', 'expiration']
    };

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(k => lower.includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 4);
  }
}

export const redditSentimentAgent = new RedditSentimentAgent();