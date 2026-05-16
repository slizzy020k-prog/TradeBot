import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class YouTubeSentimentAgent {
  private sourceName: string = 'YouTube';
  private baseUrl: string = 'https://youtube.com';

  private channelPatterns = {
    financial: [
      'CNBC', 'Bloomberg', 'Reuters', 'Yahoo Finance', 'MarketWatch',
      'Mad Money', 'Halftime Report', 'Fast Money'
    ],
    analysis: [
      'Rayner', 'Michaela', 'Joseph Carson', 'ChartGuys', 'Meet Kevin'
    ],
    trading: [
      'TradingLab', 'Stan', 'TheTradingArtist', 'RiskHawk'
    ]
  };

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape trending finance videos
      const trendingUrl = 'https://www.youtube.com/results?search_query=stock+market+analysis&sp=CAI%3D';
      const response = await scrapingService.scrape(trendingUrl, 'playwright');

      if (response.success && response.content) {
        const videos = this.parseVideoListings(response);
        analyses.push(...videos);
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping YouTube`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape multiple finance video categories
      const searchQueries = [
        'stock market update today',
        'AAPL stock analysis',
        'TSLA stock prediction',
        'NVDA earnings review',
        'SPY technical analysis'
      ];

      const searchUrls = searchQueries.map(q =>
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
      );

      const results = await scrapingService.scrapeBatch(searchUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const videoAnalyses = this.parseVideoListings(result);
          analyses.push(...videoAnalyses);
        }
      }

      // Classify videos
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Filter for quality and manipulation
      const filtered = classified.filter(a =>
        a.scores.confidenceScore > 20 &&
        a.scores.manipulationRiskScore < 60
      );

      logger.info(`${this.sourceName}: Analyzed ${classified.length} videos, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseVideoListings(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Parse video metadata from YouTube page
      const videoPattern = /"title":"([^"]+)"/g;
      const viewPattern = /"viewCountText":"[^"]*?(\d+(?:\.\d+)?[MK]?\s*(?:views)?)/g;
      const channelPattern = /"channelTitle":"([^"]+)"/g;
      const durationPattern = /"lengthText":"([^"]+)"/g;

      const titles = [...response.content.matchAll(videoPattern)].map(m => m[1]);
      const channels = [...response.content.matchAll(channelPattern)].map(m => m[1]);
      const views = [...response.content.matchAll(viewPattern)].map(m => m[1]);
      const durations = [...response.content.matchAll(durationPattern)].map(m => m[1]);

      for (let i = 0; i < Math.min(titles.length, 30); i++) {
        const title = this.decodeUnicode(titles[i]);
        const channel = channels[i] || 'Unknown';
        const viewText = views[i] || '0';

        if (title.length > 10) {
          const symbols = this.extractSymbols(title);
          const sentiment = this.calculateVideoSentiment(title, channel, viewText);

          analyses.push({
            headline: title.substring(0, 200),
            content: `Channel: ${channel} | Views: ${viewText} | Duration: ${durations[i] || 'Unknown'}`,
            url: response.url,
            source: `${this.sourceName} - ${channel}`,
            timestamp: Date.now(),
            scores: {
              sentimentScore: sentiment.score,
              volatilityScore: sentiment.volatility,
              confidenceScore: this.calculateConfidence(channel, viewText),
              institutionalImpactScore: this.calculateInstitutionalScore(channel),
              durationScore: this.extractDurationScore(durations[i]),
              manipulationRiskScore: this.calculateManipulationRisk(title, channel)
            },
            classification: sentiment.classification as 'bullish' | 'bearish' | 'neutral',
            keyThemes: this.extractThemes(title),
            relevantSymbols: symbols
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing video listings`, error);
    }

    return analyses;
  }

  private decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-f]{4})/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    ).replace(/\\"/g, '"');
  }

  private extractSymbols(title: string): string[] {
    const symbols: string[] = [];

    // Match $TICKER format
    const dollarMatches = title.match(/\$([A-Z]{1,5})/g) || [];
    symbols.push(...dollarMatches.map(m => m.replace('$', '')));

    // Match common stock name mentions
    const knownStocks = ['APPLE', 'TESLA', 'NVIDIA', 'MICROSOFT', 'GOOGLE', 'AMAZON', 'META', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL'];
    for (const stock of knownStocks) {
      if (title.toUpperCase().includes(stock)) {
        symbols.push(stock);
      }
    }

    return [...new Set(symbols)].slice(0, 10);
  }

  private calculateVideoSentiment(title: string, channel: string, views: string): { score: number; volatility: number; classification: string } {
    let score = 0;
    let volatility = 45;
    const lowerTitle = title.toLowerCase();

    // Sentiment keywords
    const bullishTerms = ['bullish', 'breakout', 'buy', 'long', 'moon', 'soar', 'rally', 'up', 'gain'];
    const bearishTerms = ['bearish', 'sell', 'short', 'drop', 'crash', 'dump', 'plunge', 'fall', 'bear'];

    for (const term of bullishTerms) {
      if (lowerTitle.includes(term)) score += 12;
    }
    for (const term of bearishTerms) {
      if (lowerTitle.includes(term)) score -= 12;
    }

    // Volatility indicators
    const highVolTerms = ['crash', 'surge', 'plunge', 'soar', 'explosive', 'massive'];
    for (const term of highVolTerms) {
      if (lowerTitle.includes(term)) volatility += 20;
    }

    let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (score > 15) classification = 'bullish';
    else if (score < -15) classification = 'bearish';

    return { score: Math.max(-100, Math.min(100, score)), volatility: Math.min(100, volatility), classification };
  }

  private calculateConfidence(channel: string, viewText: string): number {
    let confidence = 35;

    // Financial news channels have higher credibility
    for (const pattern of Object.values(this.channelPatterns)) {
      if (pattern.some(c => channel.toLowerCase().includes(c.toLowerCase()))) {
        confidence += 25;
        break;
      }
    }

    // View count affects confidence
    const views = this.parseViewCount(viewText);
    if (views > 100000) confidence += 15;
    if (views > 1000000) confidence += 10;

    return Math.min(90, confidence);
  }

  private parseViewCount(viewText: string): number {
    const match = viewText.match(/(\d+(?:\.\d+)?)\s*([MK])?/i);
    if (!match) return 0;

    let count = parseFloat(match[1]);
    if (match[2]?.toUpperCase() === 'M') count *= 1000000;
    else if (match[2]?.toUpperCase() === 'K') count *= 1000;

    return count;
  }

  private calculateInstitutionalScore(channel: string): number {
    let score = 25;

    const institutionalChannels = [
      'CNBC', 'Bloomberg', 'Reuters', 'Yahoo Finance', 'MarketWatch',
      'WSJ', 'Financial Times', 'CNN Business'
    ];

    for (const c of institutionalChannels) {
      if (channel.includes(c)) {
        score += 40;
        break;
      }
    }

    return Math.min(100, score);
  }

  private extractDurationScore(duration: string | undefined): number {
    if (!duration) return 30;

    // Longer videos often have more analysis
    const timeParts = duration.match(/(\d+):(\d+)/);
    if (timeParts) {
      const minutes = parseInt(timeParts[1]);
      if (minutes > 20) return 70;
      if (minutes > 10) return 55;
      if (minutes > 5) return 40;
    }

    return 30;
  }

  private calculateManipulationRisk(title: string, channel: string): number {
    let risk = 20;

    // Clickbait patterns
    const clickbaitTerms = ['you wont believe', 'shocking', 'breaking', 'this is why', 'secret', 'revealed'];
    for (const term of clickbaitTerms) {
      if (title.toLowerCase().includes(term)) risk += 25;
    }

    // Extreme claims
    const extremeClaims = ['to the moon', '100x', 'guaranteed', 'will double', 'this stock will'];
    for (const claim of extremeClaims) {
      if (title.toLowerCase().includes(claim)) risk += 20;
    }

    // Unknown channels have higher risk
    const knownChannels = Object.values(this.channelPatterns).flat();
    if (!knownChannels.some(c => channel.includes(c))) {
      risk += 15;
    }

    return Math.min(95, risk);
  }

  private extractThemes(title: string): string[] {
    const themes: string[] = [];
    const lower = title.toLowerCase();

    const themeMap: Record<string, string[]> = {
      'technical': ['technical', 'chart', 'pattern', 'analysis', 'trading view'],
      'fundamentals': ['fundamentals', 'earnings', 'revenue', 'pe ratio', 'value'],
      'momentum': ['momentum', 'breakout', 'squeeze', 'run', 'rally'],
      'education': ['learn', ' tutorial', ' guide', 'explain', ' basics'],
      'news': ['news', 'update', 'report', 'today', 'earnings']
    };

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(k => lower.includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 4);
  }
}

export const youtubeSentimentAgent = new YouTubeSentimentAgent();