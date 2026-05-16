import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class StockTwitsSentimentAgent {
  private sourceName: string = 'StockTwits';
  private baseUrl: string = 'https://stocktwits.com';

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const trendingUrl = 'https://stocktwits.com/';
      const response = await scrapingService.scrape(trendingUrl, 'playwright');

      if (!response.success) {
        logger.warn(`${this.sourceName}: Failed to scrape trending`);
        return [];
      }

      return this.parseTrendingPosts(response);
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping StockTwits`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape trending symbols on StockTwits
      const symbolUrls = [
        'https://stocktwits.com/symbol/SPY',
        'https://stocktwits.com/symbol/QQQ',
        'https://stocktwits.com/symbol/AAPL',
        'https://stocktwits.com/symbol/TSLA',
        'https://stocktwits.com/symbol/NVDA'
      ];

      const results = await scrapingService.scrapeBatch(symbolUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const posts = this.parseSymbolPosts(result);
          analyses.push(...posts);
        }
      }

      // Also scrape trending stream
      const trendingResponse = await scrapingService.scrape(
        'https://stocktwits.com/stream/special/trending',
        'playwright'
      );

      if (trendingResponse.success && trendingResponse.content) {
        const trendingPosts = this.parseTrendingPosts(trendingResponse);
        analyses.push(...trendingPosts);
      }

      // Classify all posts
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Filter for manipulation risk
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

  private parseTrendingPosts(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Parse StockTwits post structure
      const messagePattern = /"body":"([^"]+)"/g;
      const sentimentPattern = /"sentiment":"([^"]+)"/g;
      const symbolPattern = /"symbol":"([^"]+)"/g;
      const userPattern = /"username":"([^"]+)"/g;

      const bodies = [...response.content.matchAll(messagePattern)].map(m => this.decodeUnicode(m[1]));
      const sentiments = [...response.content.matchAll(sentimentPattern)].map(m => m[1]);
      const symbols = [...response.content.matchAll(symbolPattern)].map(m => m[1]);
      const users = [...response.content.matchAll(userPattern)].map(m => m[1]);

      for (let i = 0; i < Math.min(bodies.length, 30); i++) {
        const body = bodies[i];
        const symbol = symbols[i] || 'UNKNOWN';
        const sentiment = sentiments[i] || 'neutral';

        if (body.length > 10) {
          const parsedSentiment = this.parseStockTwitsSentiment(sentiment, body);

          analyses.push({
            headline: body.substring(0, 200),
            content: body,
            url: response.url,
            source: `${this.sourceName}/symbol/${symbol}`,
            timestamp: Date.now(),
            scores: {
              sentimentScore: parsedSentiment.score,
              volatilityScore: parsedSentiment.volatility,
              confidenceScore: 45,
              institutionalImpactScore: 35,
              durationScore: 25,
              manipulationRiskScore: this.calculateManipulationRisk(body)
            },
            classification: parsedSentiment.classification,
            keyThemes: this.extractThemes(body),
            relevantSymbols: [symbol]
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing trending posts`, error);
    }

    return analyses;
  }

  private parseSymbolPosts(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Extract symbol from URL
      const symbolMatch = response.url.match(/symbol\/([A-Z]+)/i);
      const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'UNKNOWN';

      // Parse messages for this symbol
      const bodyPattern = /"message":"([^"]+)"/g;
      const heartsPattern = /"hearts":(\d+)/g;
      const sentimentPattern = /"sentiment":"?([^",}]+)"?/g;

      const bodies = [...response.content.matchAll(bodyPattern)].map(m => this.decodeUnicode(m[1]));
      const hearts = [...response.content.matchAll(heartsPattern)].map(m => parseInt(m[1]));
      const sentiments = [...response.content.matchAll(sentimentPattern)].map(m => m[1]);

      for (let i = 0; i < Math.min(bodies.length, 25); i++) {
        const body = bodies[i];
        const heartCount = hearts[i] || 0;

        if (body.length > 10) {
          const parsedSentiment = this.parseStockTwitsSentiment(
            sentiments[i] || 'neutral',
            body
          );

          analyses.push({
            headline: body.substring(0, 200),
            content: body,
            url: response.url,
            source: `${this.sourceName}/symbol/${symbol}`,
            timestamp: Date.now(),
            scores: {
              sentimentScore: parsedSentiment.score + (heartCount > 100 ? 10 : 0),
              volatilityScore: parsedSentiment.volatility,
              confidenceScore: this.calculateConfidence(heartCount),
              institutionalImpactScore: 30,
              durationScore: 25,
              manipulationRiskScore: this.calculateManipulationRisk(body)
            },
            classification: parsedSentiment.classification,
            keyThemes: this.extractThemes(body),
            relevantSymbols: [symbol]
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing symbol posts`, error);
    }

    return analyses;
  }

  private decodeUnicode(str: string): string {
    return str
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  private parseStockTwitsSentiment(sentiment: string, body: string): { score: number; volatility: number; classification: 'bullish' | 'bearish' | 'neutral' } {
    let score = 0;
    const lower = body.toLowerCase();

    // StockTwits has built-in sentiment labels
    if (sentiment === 'bullish') score = 40;
    else if (sentiment === 'bearish') score = -40;

    // Check for textual sentiment
    const bullishTerms = ['bullish', 'buy', 'long', 'calls', 'breakout', 'moon', 'btfd'];
    const bearishTerms = ['bearish', 'sell', 'short', 'puts', 'crash', 'dump'];

    for (const term of bullishTerms) {
      if (lower.includes(term)) score += 10;
    }
    for (const term of bearishTerms) {
      if (lower.includes(term)) score -= 10;
    }

    let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (score > 20) classification = 'bullish';
    else if (score < -20) classification = 'bearish';

    const volatility = 50 + Math.abs(score) * 0.3;

    return {
      score: Math.max(-100, Math.min(100, score)),
      volatility: Math.min(100, volatility),
      classification
    };
  }

  private calculateConfidence(heartCount: number): number {
    let confidence = 35;

    if (heartCount > 10) confidence += 10;
    if (heartCount > 50) confidence += 15;
    if (heartCount > 100) confidence += 15;
    if (heartCount > 500) confidence += 10;

    return Math.min(90, confidence);
  }

  private calculateManipulationRisk(body: string): number {
    let risk = 25;

    // Pump patterns
    const pumpTerms = ['to the moon', 'squeeze', 'rocket', 'spray', '100x', 'call it'];
    for (const term of pumpTerms) {
      if (body.toLowerCase().includes(term)) risk += 20;
    }

    // Coordinated activity indicators
    const coordTerms = ['like and share', 'spread', 'tell your friends', 'retweet'];
    for (const term of coordTerms) {
      if (body.toLowerCase().includes(term)) risk += 25;
    }

    // High engagement + extreme sentiment = higher risk
    if (body.includes('🚀') || body.includes('💎')) risk += 10;

    return Math.min(95, risk);
  }

  private extractThemes(body: string): string[] {
    const themes: string[] = [];
    const lower = body.toLowerCase();

    const themeMap: Record<string, string[]> = {
      'technical': ['technical', 'chart', 'pattern', 'resistance', 'support'],
      'options': ['options', 'calls', 'puts', 'strike', 'spread'],
      'momentum': ['momentum', 'volume', 'breakout', 'squeeze'],
      'fundamentals': ['earnings', 'revenue', 'guidance', 'fundamentals'],
      'sentiment': ['bullish', 'bearish', 'buy', 'sell']
    };

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(k => lower.includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 4);
  }
}

export const stockTwitsSentimentAgent = new StockTwitsSentimentAgent();