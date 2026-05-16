import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class CurrencyAgent {
  private sourceName: string = 'Currency Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.forexlive.com/',
      'https://www.dailyfx.com/',
      'https://www.bloomberg.com/markets/currencies',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const currencySources = [
      'https://www.reuters.com/markets/currencies/',
      'https://www.cnbc.com/forex',
      'https://www.ft.com/markets/currencies',
    ];
    return this.fetchAndAnalyze(currencySources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseCurrencyContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[Currency] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyCurrencyScoring(allAnalyses);
    logger.info(`[Currency] Analyzed ${scored.length} currency updates`);
    return scored;
  }

  private parseCurrencyContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const dollarIndexPatterns = [
      /DXY\s+(?:index|price)/gi,
      /dollar\s+index/gi,
      /US\s+dollar\s+(?:index|strength|weakness)/gi,
      /USD\s+(?:index|strength)/gi,
      /US\s+dollar\s+trades?\s+(?:higher|lower)/gi,
      /dollar\s+strength\s+(?:index|indicator)/gi,
    ];

    const forexPatterns = [
      /EUR\/USD/gi,
      /GBP\/USD/gi,
      /USD\/JPY/gi,
      /USD\/CHF/gi,
      /AUD\/USD/gi,
      /USD\/CAD/gi,
      /NZD\/USD/gi,
      /forex\s+(?:market|trend|analysis)/gi,
      /currency\s+(?:pair|trading|market)/gi,
      /exchange\s+rate[s]?/gi,
      /currency\s+war/gi,
      /devalu(ation|ed)/gi,
      /currency\s+intervention/gi,
    ];

    const emergingPatterns = [
      /emerging\s+market\s+currency/gi,
      /EM\s+currency/gi,
      /yuan\s+(?:weakness|strength|depreciation|appreciation)/gi,
      /CNY\/USD/gi,
      /RMB\s+(?:depreciation|weakening)/gi,
      /Rupee\s+(?:falls?|rises?|weak)/gi,
      /real\s+(?:depreciation|weakening)/gi,
      /TRY\/USD/gi,
      /BRL\/USD/gi,
    ];

    const headline = response.title || 'Currency Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of dollarIndexPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of forexPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of emergingPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Currency Alert: ${eventText.substring(0, 100)}`,
        content,
        this.sourceName,
        response.url
      );
      analyses.push(analysis);
    } else if (content.length > 100) {
      const analysis = newsClassifier.analyze(
        headline,
        content,
        this.sourceName,
        response.url
      );
      analyses.push(analysis);
    }

    return analyses;
  }

  private applyCurrencyScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'DXY', 'dollar index', 'USD strength', 'dollar weakness',
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'currency war',
      'forex intervention', 'currency devaluation', 'exchange rate',
      'emerging market currency', 'yuan depreciation', 'CNY',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + 20);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 10);
      }

      // Dollar index movements are highly impactful
      if (text.includes('dollar index') || text.includes('DXY')) {
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 15);
      }

      // Currency wars and interventions
      if (text.includes('intervention') || text.includes('currency war') || text.includes('devaluation')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 15);
      }

      // Emerging market currency crises
      if (text.includes('crisis') || text.includes('depreciation') || text.includes('capital flight')) {
        modifiedScores.volatilityScore = Math.min(100, modifiedScores.volatilityScore + 12);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const currencyAgent = new CurrencyAgent();