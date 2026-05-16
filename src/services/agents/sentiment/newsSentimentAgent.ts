import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

interface NewsSource {
  name: string;
  url: string;
  preferredTool: 'scrapling' | 'playwright' | 'crawl4ai';
  sentimentBias?: number; // -100 to +100, positive = bullish bias
}

export class NewsSentimentAgent {
  private sourceName: string = 'News Aggregator';
  private baseUrl: string = 'https://finance.news';

  private newsSources: NewsSource[] = [
    // Financial News
    { name: 'Bloomberg', url: 'https://www.bloomberg.com/markets', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'Reuters', url: 'https://www.reuters.com/markets/', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'CNBC', url: 'https://www.cnbc.com/markets/', preferredTool: 'scrapling', sentimentBias: 5 },
    { name: 'WSJ', url: 'https://www.wsj.com/news/markets', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/markets', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'Financial Times', url: 'https://www.ft.com/markets', preferredTool: 'scrapling', sentimentBias: 0 },
    // Finance/Securities
    { name: 'Seeking Alpha', url: 'https://seekingalpha.com/market-outlook', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'Benzinga', url: 'https://www.benzinga.com/markets', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news', preferredTool: 'scrapling', sentimentBias: 0 },
    { name: 'Motley Fool', url: 'https://www.fool.com/', preferredTool: 'scrapling', sentimentBias: 10 },
    // Trading/Analysis
    { name: 'TradingView', url: 'https://www.tradingview.com/markets/', preferredTool: 'crawl4ai', sentimentBias: 0 },
    { name: 'Investopedia', url: 'https://www.investopedia.com/news/', preferredTool: 'scrapling', sentimentBias: 0 },
  ];

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape headlines from all sources
      const urls = this.newsSources.map(s => s.url);
      const results = await scrapingService.scrapeBatch(urls, 'scrapling');

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const source = this.newsSources[i];

        if (result.success && result.content) {
          const headlines = this.parseHeadlines(result);
          const sourceAnalyses = headlines.map(h => this.createAnalysis(h, source));
          analyses.push(...sourceAnalyses);
        }
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping news`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape from all major sources
      const urls = this.newsSources.map(s => s.url);

      const results = await scrapingService.scrapeBatch(urls, 'scrapling');

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const source = this.newsSources[i];

        if (result.success && result.content) {
          const headlines = this.parseHeadlines(result);

          for (const headline of headlines) {
            const analysis = newsClassifier.analyze(
              headline,
              result.content,
              source.name,
              result.url
            );

            // Apply source bias adjustment
            if (source.sentimentBias && source.sentimentBias !== 0) {
              analysis.scores.sentimentScore += source.sentimentBias * 0.3;
              analysis.scores.sentimentScore = Math.max(-100, Math.min(100, analysis.scores.sentimentScore));
            }

            analyses.push(analysis);
          }
        }
      }

      // Aggregate sentiment
      const aggregated = this.aggregateNewsSentiment(analyses);
      logger.info(`${this.sourceName}: Analyzed ${analyses.length} articles, aggregate: ${aggregated.overall}`);

      // Filter for manipulation risk
      const filtered = analyses.filter(a =>
        a.scores.confidenceScore > 30 &&
        a.scores.manipulationRiskScore < 55
      );

      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseHeadlines(response: ScrapingResponse): string[] {
    const headlines: string[] = [];

    try {
      // Try to extract headlines from HTML structure
      const headlinePatterns = [
        /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi,
        /"headline":"([^"]+)"/g,
        /"title":"([^"]+)"/g,
        /class="[^"]*headline[^"]*"[^>]*>([^<]+)</gi,
        /class="[^"]*title[^"]*"[^>]*>([^<]+)</gi
      ];

      for (const pattern of headlinePatterns) {
        const matches = response.content.match(pattern);
        if (matches && matches.length > 0) {
          for (const match of matches) {
            const cleanHeadline = this.cleanHtmlTags(match);
            if (cleanHeadline.length > 20 && cleanHeadline.length < 300) {
              headlines.push(cleanHeadline);
            }
          }
          break;
        }
      }

      // If no structured matches, try to extract sentences
      if (headlines.length === 0) {
        const sentences = response.content.split(/[.!?]/);
        for (const sentence of sentences) {
          const clean = this.cleanHtmlTags(sentence).trim();
          if (clean.length > 30 && clean.length < 250 && /[A-Z]/.test(clean)) {
            headlines.push(clean);
          }
        }
      }

      // Deduplicate
      return [...new Set(headlines)].slice(0, 50);

    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing headlines`, error);
      return [];
    }
  }

  private cleanHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createAnalysis(headline: string, source: NewsSource): NewsAnalysis {
    const analysis = newsClassifier.analyze(headline, '', source.name, source.url);

    // Apply source bias
    if (source.sentimentBias) {
      analysis.scores.sentimentScore += source.sentimentBias * 0.3;
    }

    return analysis;
  }

  private aggregateNewsSentiment(analyses: NewsAnalysis[]): {
    overall: 'bullish' | 'bearish' | 'neutral';
    score: number;
    confidence: number;
    manipulationRisk: number;
  } {
    return newsClassifier.aggregateSentiment(analyses);
  }

  async getMarketOverview(): Promise<{
    sectorSentiment: Record<string, number>;
    topSymbols: string[];
    marketBias: 'bullish' | 'bearish' | 'neutral';
  }> {
    const analyses = await this.analyzeSentiment();

    const sectorSentiment: Record<string, number> = {};
    const symbolCounts: Record<string, number> = {};

    for (const analysis of analyses) {
      // Aggregate by sector
      const sectors = this.categorizeBySector(analysis.relevantSymbols);
      for (const sector of sectors) {
        if (!sectorSentiment[sector]) sectorSentiment[sector] = 0;
        sectorSentiment[sector] += analysis.scores.sentimentScore / analyses.length;
      }

      // Count symbol mentions
      for (const symbol of analysis.relevantSymbols) {
        if (!symbolCounts[symbol]) symbolCounts[symbol] = 0;
        symbolCounts[symbol]++;
      }
    }

    const topSymbols = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol]) => symbol);

    const avgSentiment = analyses.reduce((sum, a) => sum + a.scores.sentimentScore, 0) / (analyses.length || 1);
    let marketBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (avgSentiment > 15) marketBias = 'bullish';
    else if (avgSentiment < -15) marketBias = 'bearish';

    return { sectorSentiment, topSymbols, marketBias };
  }

  private categorizeBySector(symbols: string[]): string[] {
    const sectorMap: Record<string, string[]> = {
      'Technology': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD', 'INTC', 'TSM'],
      'Automotive': ['TSLA', 'F', 'GM', 'TM', 'RIVN'],
      'Finance': ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'],
      'Healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK'],
      'Energy': ['XOM', 'CVX', 'COP', 'SLB'],
      'Consumer': ['KO', 'PEP', 'PG', 'WMT', 'HD', 'MCD']
    };

    const sectors: string[] = [];
    for (const symbol of symbols) {
      for (const [sector, members] of Object.entries(sectorMap)) {
        if (members.includes(symbol) && !sectors.includes(sector)) {
          sectors.push(sector);
        }
      }
    }

    return sectors.length > 0 ? sectors : ['Other'];
  }

  getSources(): NewsSource[] {
    return this.newsSources;
  }
}

export const newsSentimentAgent = new NewsSentimentAgent();