import { vectorStoreService, TradeVectorPayload, NewsVectorPayload } from './vectorStore';
import { embeddingsService } from './embeddings';
import { databaseService } from './database';
import { newsClassifier, NewsAnalysis } from './newsClassifier';
import { scrapingService, ScrapingResponse } from './scraping';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface NewsIntelligenceResult {
  symbol: string;
  hasNews: boolean;
  news: NewsAnalysis[];
  aggregatedSentiment: {
    overall: 'bullish' | 'bearish' | 'neutral';
    score: number;
    confidence: number;
    manipulationRisk: number;
    articleCount: number;
  };
  bullishFactors: string[];
  bearishFactors: string[];
  riskFactors: string[];
  recommendation: string;
  newsContextForAI: string;
}

export class NewsIntelligenceService {
  private scrapeCache: Map<string, { news: NewsAnalysis[]; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000;

  async getNewsForSymbols(symbols: string[]): Promise<Map<string, NewsIntelligenceResult>> {
    const results = new Map<string, NewsIntelligenceResult>();

    for (const symbol of symbols) {
      const result = await this.getNewsForSymbol(symbol);
      results.set(symbol, result);
    }

    return results;
  }

  async getNewsForSymbol(symbol: string): Promise<NewsIntelligenceResult> {
    const cached = this.scrapeCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug(`News cache hit for ${symbol}`);
      return this.buildIntelligenceResult(symbol, cached.news);
    }

    const news = await this.scrapeNewsForSymbol(symbol);

    this.scrapeCache.set(symbol, { news, timestamp: Date.now() });

    return this.buildIntelligenceResult(symbol, news);
  }

  private async scrapeNewsForSymbol(symbol: string): Promise<NewsAnalysis[]> {
    const allNews: NewsAnalysis[] = [];

    const searchUrls = this.buildSearchUrls(symbol);

    for (const { url, source, tool } of searchUrls) {
      try {
        const response = await scrapingService.scrape(url, tool);

        if (response.success && response.content) {
          const headlines = this.extractHeadlinesFromContent(response.content, symbol);

          for (const headline of headlines) {
            const analysis = newsClassifier.analyze(
              headline.title,
              headline.summary || headline.title,
              source,
              headline.url
            );

            analysis.relevantSymbols = [symbol, ...analysis.relevantSymbols.filter(s => s !== symbol)];
            allNews.push(analysis);

            await this.storeNewsInVectorDB(analysis);
            await this.storeNewsInSQLite(analysis);
          }
        }
      } catch (error) {
        logger.warn(`Failed to scrape ${source} for ${symbol}:`, error);
      }

      await this.delay(500);
    }

    return allNews.sort((a, b) => b.timestamp - a.timestamp);
  }

  private buildSearchUrls(symbol: string): { url: string; source: string; tool: 'scrapling' | 'crawl4ai' | 'playwright' }[] {
    const upperSymbol = symbol.toUpperCase().replace('-', '_');

    return [
      {
        url: `https://finance.yahoo.com/quote/${upperSymbol}/news`,
        source: 'Yahoo Finance',
        tool: 'scrapling'
      },
      {
        url: `https://www.google.com/search?q=${encodeURIComponent(symbol + ' stock news')}&tbm=nws`,
        source: 'Google News',
        tool: 'crawl4ai'
      },
      {
        url: `https://www.reuters.com/search/news?q=${encodeURIComponent(symbol)}&blob=headline`,
        source: 'Reuters',
        tool: 'scrapling'
      },
      {
        url: `https://www.cnbc.com/search/?query=${encodeURIComponent(symbol)}`,
        source: 'CNBC',
        tool: 'scrapling'
      },
      {
        url: `https://www.marketwatch.com/investing/stock/${upperSymbol}/news`,
        source: 'MarketWatch',
        tool: 'scrapling'
      },
      {
        url: `https://seekingalpha.com/symbol/${upperSymbol}`,
        source: 'Seeking Alpha',
        tool: 'scrapling'
      },
      {
        url: `https://www.benzinga.com/search?query=${encodeURIComponent(symbol)}`,
        source: 'Benzinga',
        tool: 'scrapling'
      },
    ];
  }

  private extractHeadlinesFromContent(
    content: string,
    symbol: string
  ): { title: string; summary?: string; url: string }[] {
    const headlines: { title: string; summary?: string; url: string }[] = [];

    const lines = content.split('\n').filter(line => line.trim().length > 10);

    for (const line of lines.slice(0, 30)) {
      const cleanLine = line.trim();

      if (cleanLine.length > 20 && cleanLine.length < 300) {
        const hasSymbol = cleanLine.toUpperCase().includes(symbol.toUpperCase()) ||
                         cleanLine.toLowerCase().includes(symbol.toLowerCase());

        if (hasSymbol || this.containsFinancialKeywords(cleanLine)) {
          headlines.push({
            title: cleanLine,
            url: `https://www.google.com/search?q=${encodeURIComponent(cleanLine.substring(0, 50))}`,
          });
        }
      }
    }

    return headlines.slice(0, 10);
  }

  private containsFinancialKeywords(text: string): boolean {
    const keywords = [
      'stock', 'share', 'price', 'market', 'trading', 'investor',
      'earnings', 'revenue', 'profit', 'growth', 'forecast',
      'buy', 'sell', 'upgrade', 'downgrade', 'analyst',
      'IPO', 'M&A', 'merger', 'acquisition', 'deal',
      'FDA', 'SEC', 'regulation', 'lawsuit', 'investigation'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  private async storeNewsInVectorDB(analysis: NewsAnalysis): Promise<void> {
    try {
      const textForEmbedding = this.createNewsText(analysis);
      const embedding = await embeddingsService.getEmbedding(textForEmbedding);

      const payload: NewsVectorPayload = {
        symbol: analysis.relevantSymbols[0] || 'UNKNOWN',
        headline: analysis.headline,
        content: analysis.content,
        url: analysis.url,
        source: analysis.source,
        classification: analysis.classification,
        sentimentScore: analysis.scores.sentimentScore,
        volatilityScore: analysis.scores.volatilityScore,
        confidenceScore: analysis.scores.confidenceScore,
        institutionalImpactScore: analysis.scores.institutionalImpactScore,
        durationScore: analysis.scores.durationScore,
        manipulationRiskScore: analysis.scores.manipulationRiskScore,
        keyThemes: analysis.keyThemes,
        relevantSymbols: analysis.relevantSymbols,
        timestamp: analysis.timestamp,
      };

      const vectorId = `news_${analysis.timestamp}_${Math.random().toString(36).substr(2, 9)}`;

      await vectorStoreService.upsertNews(vectorId, embedding, payload);
      logger.debug(`Stored news in vector DB: ${analysis.headline.substring(0, 30)}...`);
    } catch (error) {
      logger.error('Failed to store news in vector DB:', error);
    }
  }

  private async storeNewsInSQLite(analysis: NewsAnalysis): Promise<void> {
    try {
      databaseService.insertNewsArticle(analysis);
    } catch (error) {
      logger.error('Failed to store news in SQLite:', error);
    }
  }

  private createNewsText(analysis: NewsAnalysis): string {
    return `
Symbol: ${analysis.relevantSymbols.join(', ')}
Headline: ${analysis.headline}
Source: ${analysis.source}
Classification: ${analysis.classification}
Sentiment: ${analysis.scores.sentimentScore > 0 ? 'BULLISH' : analysis.scores.sentimentScore < 0 ? 'BEARISH' : 'NEUTRAL'}
Sentiment Score: ${analysis.scores.sentimentScore}
Volatility Impact: ${analysis.scores.volatilityScore}
Confidence: ${analysis.scores.confidenceScore}
Institutional Impact: ${analysis.scores.institutionalImpactScore}
Duration: ${analysis.scores.durationScore > 50 ? 'LONG-TERM' : 'SHORT-TERM'}
Manipulation Risk: ${analysis.scores.manipulationRiskScore}
Themes: ${analysis.keyThemes.join(', ')}
Content: ${analysis.content.substring(0, 500)}
`.trim();
  }

  async getHistoricalNewsContext(
    symbol: string,
    limit: number = 10
  ): Promise<{
    bullishNews: NewsAnalysis[];
    bearishNews: NewsAnalysis[];
    neutralNews: NewsAnalysis[];
    aggregated: { bullish: number; bearish: number; neutral: number };
  }> {
    try {
      const results = await vectorStoreService.searchByQuality(true, symbol, limit * 2);

      const bullish: NewsAnalysis[] = [];
      const bearish: NewsAnalysis[] = [];
      const neutral: NewsAnalysis[] = [];

      for (const result of results) {
        const analysis = this.vectorPayloadToNewsAnalysis(result);
        if (!analysis) continue;

        if (analysis.classification === 'bullish' && bullish.length < limit) {
          bullish.push(analysis);
        } else if (analysis.classification === 'bearish' && bearish.length < limit) {
          bearish.push(analysis);
        } else if (neutral.length < limit) {
          neutral.push(analysis);
        }
      }

      return {
        bullishNews: bullish,
        bearishNews: bearish,
        neutralNews: neutral,
        aggregated: {
          bullish: bullish.length,
          bearish: bearish.length,
          neutral: neutral.length,
        },
      };
    } catch (error) {
      logger.error('Failed to get historical news context:', error);
      return {
        bullishNews: [],
        bearishNews: [],
        neutralNews: [],
        aggregated: { bullish: 0, bearish: 0, neutral: 0 },
      };
    }
  }

  private vectorPayloadToNewsAnalysis(payload: any): NewsAnalysis | null {
    try {
      return {
        headline: payload.headline || '',
        content: payload.content || '',
        url: payload.url || '',
        source: payload.source || '',
        timestamp: payload.timestamp || Date.now(),
        scores: {
          sentimentScore: payload.sentimentScore || 0,
          volatilityScore: payload.volatilityScore || 50,
          confidenceScore: payload.confidenceScore || 50,
          institutionalImpactScore: payload.institutionalImpactScore || 50,
          durationScore: payload.durationScore || 50,
          manipulationRiskScore: payload.manipulationRiskScore || 10,
        },
        classification: payload.classification || 'neutral',
        keyThemes: payload.keyThemes || [],
        relevantSymbols: payload.relevantSymbols || [],
      };
    } catch {
      return null;
    }
  }

  private buildIntelligenceResult(symbol: string, news: NewsAnalysis[]): NewsIntelligenceResult {
    const aggregated = newsClassifier.aggregateSentiment(news);

    const bullishFactors: string[] = [];
    const bearishFactors: string[] = [];
    const riskFactors: string[] = [];

    for (const article of news.filter(n => n.classification === 'bullish').slice(0, 5)) {
      bullishFactors.push(`${article.source}: ${article.headline.substring(0, 60)}...`);
    }

    for (const article of news.filter(n => n.classification === 'bearish').slice(0, 5)) {
      bearishFactors.push(`${article.source}: ${article.headline.substring(0, 60)}...`);
    }

    for (const article of news.filter(n => n.scores.manipulationRiskScore > 50)) {
      riskFactors.push(`POTENTIAL MANIPULATION [${article.scores.manipulationRiskScore}%]: ${article.headline.substring(0, 50)}...`);
    }

    const manipulationCount = news.filter(n => n.scores.manipulationRiskScore > 60).length;
    if (manipulationCount > 3) {
      riskFactors.push(`WARNING: ${manipulationCount} articles with high manipulation risk detected`);
    }

    const newsContextForAI = this.buildNewsContextForAI(symbol, news, aggregated);

    return {
      symbol,
      hasNews: news.length > 0,
      news: news.slice(0, 10),
      aggregatedSentiment: {
        overall: aggregated.overall,
        score: aggregated.score,
        confidence: aggregated.confidence,
        manipulationRisk: aggregated.manipulationRisk,
        articleCount: news.length,
      },
      bullishFactors,
      bearishFactors,
      riskFactors,
      recommendation: this.generateRecommendation(aggregated, news),
      newsContextForAI,
    };
  }

  private buildNewsContextForAI(
    symbol: string,
    news: NewsAnalysis[],
    aggregated: { overall: 'bullish' | 'bearish' | 'neutral'; score: number; confidence: number; manipulationRisk: number }
  ): string {
    if (news.length === 0) {
      return `No recent news found for ${symbol}. Proceeding with standard analysis.`;
    }

    const topBullish = news.filter(n => n.classification === 'bullish').slice(0, 3);
    const topBearish = news.filter(n => n.classification === 'bearish').slice(0, 3);

    let context = `=== MARKET NEWS INTELLIGENCE FOR ${symbol} ===\n`;
    context += `News Articles Analyzed: ${news.length}\n`;
    context += `Overall Sentiment: ${aggregated.overall.toUpperCase()} (Score: ${aggregated.score.toFixed(1)})\n`;
    context += `Confidence: ${aggregated.confidence.toFixed(0)}%\n`;
    context += `Manipulation Risk: ${aggregated.manipulationRisk.toFixed(0)}%\n\n`;

    if (topBullish.length > 0) {
      context += `--- BULLISH FACTORS (${topBullish.length}) ---\n`;
      for (const article of topBullish) {
        context += `[${article.source}] ${article.headline}\n`;
        context += `  Themes: ${article.keyThemes.join(', ') || 'N/A'}\n`;
      }
      context += '\n';
    }

    if (topBearish.length > 0) {
      context += `--- BEARISH FACTORS (${topBearish.length}) ---\n`;
      for (const article of topBearish) {
        context += `[${article.source}] ${article.headline}\n`;
        context += `  Themes: ${article.keyThemes.join(', ') || 'N/A'}\n`;
      }
      context += '\n';
    }

    context += `--- MARKET NEWS DECISION WEIGHT ---\n`;
    if (aggregated.overall === 'bullish' && aggregated.confidence > 60 && aggregated.manipulationRisk < 40) {
      context += `RECOMMENDATION: Positive news bias detected. ADD WEIGHT to bullish trades.\n`;
    } else if (aggregated.overall === 'bearish' && aggregated.confidence > 60 && aggregated.manipulationRisk < 40) {
      context += `RECOMMENDATION: Negative news bias detected. ADD WEIGHT to bearish trades.\n`;
    } else if (aggregated.manipulationRisk > 50) {
      context += `RECOMMENDATION: High manipulation risk detected. PROCEED WITH CAUTION or REJECT trade.\n`;
    } else if (aggregated.confidence < 40) {
      context += `RECOMMENDATION: Low confidence news. Proceed with standard analysis.\n`;
    } else {
      context += `RECOMMENDATION: Mixed/neutral signals. Use standard technical/fundamental analysis.\n`;
    }

    return context;
  }

  private generateRecommendation(
    aggregated: { overall: 'bullish' | 'bearish' | 'neutral'; score: number; confidence: number; manipulationRisk: number },
    news: NewsAnalysis[]
  ): string {
    if (news.length === 0) {
      return 'NO_NEWS';
    }

    if (aggregated.manipulationRisk > 60) {
      return 'REJECT_DUE_TO_MANIPULATION_RISK';
    }

    if (aggregated.confidence < 30) {
      return 'PROCEED_STANDARD_ANALYSIS';
    }

    if (aggregated.overall === 'bullish' && aggregated.confidence > 60) {
      return 'ENHANCED_BULLISH';
    }

    if (aggregated.overall === 'bearish' && aggregated.confidence > 60) {
      return 'ENHANCED_BEARISH';
    }

    return 'NEUTRAL_NEWS_SIGNAL';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const newsIntelligenceService = new NewsIntelligenceService();