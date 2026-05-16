import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class EnergyPriceAgent {
  private sourceName: string = 'Energy Price Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.eia.gov/outlooks/steo/',
      'https://www.opec.org/en/home/',
      'https://www.bloomberg.com/markets/commodities',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const energySources = [
      'https://www.reuters.com/business/energy/',
      'https://www.cnbc.com/economy/commodities',
      'https://www.ft.com/markets/commodities',
    ];
    return this.fetchAndAnalyze(energySources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseEnergyContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[EnergyPrice] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyEnergyScoring(allAnalyses);
    logger.info(`[EnergyPrice] Analyzed ${scored.length} energy price updates`);
    return scored;
  }

  private parseEnergyContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const oilPatterns = [
      /crude\s+oil\s+(?:price|spot|future)/gi,
      /WTI\s+crude/gi,
      /Brent\s+crude/gi,
      /barrel\s+of\s+oil/gi,
      /OPEC\s+(?:cut|increase|production|quota)/gi,
      /Saudi\s+(?:cut|production|supply)/gi,
      /Russia\s+oil/gi,
      /oil\s+supply\s+(?:cut|increase|disruption)/gi,
      /oil\s+export[s]?/gi,
      /oil\s+production\s+(?:cut|increase)/gi,
      /oil[- ]?spill/gi,
      /oil\s+prices?/gi,
      /petroleum\s+market/gi,
    ];

    const gasPatterns = [
      /natural\s+gas\s+(?:price|spot|future)/gi,
      /LNG\s+(?:price|export|import)/gi,
      /Henry\s+Hub/gi,
      /natural\s+gas\s+supply/gi,
      /nat\s+gas/gi,
      /methane\s+emissions?/gi,
      /gas\s+production/gi,
      /gas\s+export[s]?/gi,
    ];

    const energyPatterns = [
      /energy\s+crisis/gi,
      /energy\s+prices?\s+(?:surge|soar|plunge|drop)/gi,
      /energy\s+supply/gi,
      /oil\s+demand/gi,
      /energy\s+security/gi,
      /renewable\s+energy\s+(?:breakthrough|investment)/gi,
      /solar\s+panel/gi,
      /wind\s+turbine/gi,
      /pipeline\s+(?:dispute|approval|shutdown)/gi,
    ];

    const headline = response.title || 'Energy Price Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of oilPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of gasPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of energyPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Energy Alert: ${eventText.substring(0, 100)}`,
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

  private applyEnergyScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'crude oil', 'WTI', 'Brent', 'OPEC', 'oil production cut',
      'oil supply disruption', 'energy crisis', 'natural gas',
      'LNG', 'Henry Hub', 'energy prices', 'oil demand',
      'energy security', 'pipeline', 'oil export', 'oil import',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 12);
      }

      // OPEC and production-related news
      if (text.includes('opec') || text.includes('production cut') || text.includes('supply cut')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 15);
      }

      // Geopolitical energy events (Russia, Middle East)
      if (text.includes('russia') || text.includes('saudi') || text.includes('iran') || text.includes('middle east')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 10);
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 10);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const energyPriceAgent = new EnergyPriceAgent();