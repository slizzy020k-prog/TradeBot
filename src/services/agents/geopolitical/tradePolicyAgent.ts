import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class TradePolicyAgent {
  private sourceName: string = 'Trade Policy Monitor';
  private baseUrl: string = 'https://www.trademonitor.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.reuters.com/world/us/',
      'https://www.cnbc.com/politics/',
      'https://www.ft.com/world/us',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const policySources = [
      'https://www.wto.org/english/news_e/news_e.htm',
      'https://www.cbp.gov/trade',
      'https://www.commerce.gov/bureau-of-industry-and-security',
    ];
    return this.fetchAndAnalyze(policySources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseTradePolicyContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[TradePolicy] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyTradePolicyScoring(allAnalyses);
    logger.info(`[TradePolicy] Analyzed ${scored.length} trade policy updates`);
    return scored;
  }

  private parseTradePolicyContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const tariffPatterns = [
      /tariff[s]?\s+(?:on|against|in|introduced|proposed)?\s*([A-Z]{2,})/gi,
      /([A-Z]{2,})\s+tariff[s]?\s+(?:imposed|raised|increased|proposed)/gi,
      /import\s+tariff[s]?\s+(?:on|in)?\s*([A-Z]{2,})/gi,
      /trade\s+war\s+(?:with|between)?\s*([A-Z]{2,})/gi,
      /reciprocal\s+tariff[s]?/gi,
      /Section\s+232|Section\s+301|Section\s+201/gi,
    ];

    const dealPatterns = [
      /trade\s+deal[s]?\s+(?:signed|approved|rejected|pending)/gi,
      /trade\s+agreement[s]?\s+(?:with|between)?\s*([A-Z]{2,})/gi,
      /NAFTA|USMCA|TPP|CPTPP|RECP/gi,
      /trade\s+negotiation[s]?\s+(?:with|between|in)/gi,
      /trade\s+talks?\s+(?:resumed|collapsed|failed)/gi,
      /bilateral\s+trade\s+deal[s]?/gi,
    ];

    const sanctionPatterns = [
      /trade\s+sanction[s]?\s+(?:imposed|removed|expanded)/gi,
      /export\s+control[s]?\s+(?:tightened?|loosened?)/gi,
      /ban\s+on\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /restrictions?\s+(?:on|against)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    ];

    const headline = response.title || 'Trade Policy Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of tariffPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of dealPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of sanctionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Trade Policy Alert: ${eventText.substring(0, 100)}`,
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

  private applyTradePolicyScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'tariff', 'trade war', 'sanctions', 'export ban', 'import restrictions',
      'trade deal', 'NAFTA', 'USMCA', 'WTO', 'retaliatory tariffs',
      '25% tariff', '10% tariff', 'trade negotiation', 'trade agreement',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + 20);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 12);
      }

      // Check for specific country impacts
      const countries = ['China', 'Russia', 'Iran', 'North Korea', 'EU', 'Mexico', 'Canada'];
      for (const country of countries) {
        if (text.includes(country.toLowerCase())) {
          modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 10);
        }
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const tradePolicyAgent = new TradePolicyAgent();