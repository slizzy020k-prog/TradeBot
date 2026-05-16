import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class MetalPriceAgent {
  private sourceName: string = 'Metal Price Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.lme.com/',
      'https://www.metalsdaily.com/',
      'https://www.bloomberg.com/markets/commodities',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const metalSources = [
      'https://www.reuters.com/business/commodities/',
      'https://www.cnbc.com/economy/commodities',
      'https://www.kitco.com/news/',
    ];
    return this.fetchAndAnalyze(metalSources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseMetalContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[MetalPrice] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyMetalScoring(allAnalyses);
    logger.info(`[MetalPrice] Analyzed ${scored.length} metal price updates`);
    return scored;
  }

  private parseMetalContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const goldPatterns = [
      /gold\s+(?:price|spot|future|surge|plunge)/gi,
      /XAU\/USD/gi,
      /gold\s+bullion/gi,
      /gold\s+miners?/gi,
      /gold\s+etf[s]?/gi,
      /safe\s+haven\s+gold/gi,
      /gold\s+standard/gi,
      /central\s+bank\s+gold\s+(?:buy|purchase)/gi,
      /gold\s+reserves?/gi,
    ];

    const silverPatterns = [
      /silver\s+(?:price|spot|future|surge|plunge)/gi,
      /XAG\/USD/gi,
      /silver\s+miners?/gi,
      /silver\s+etf[s]?/gi,
      /silver\s+bullion/gi,
      /silver\s+industrial\s+demand/gi,
    ];

    const copperPatterns = [
      /copper\s+(?:price|spot|future|surge|plunge)/gi,
      /HG\/USD/gi,
      /copper\s+miners?/gi,
      /copper\s+etf[s]?/gi,
      /copper\s+future[s]?/gi,
      /red\s+metal/gi,
      /copper\s+supply\s+(?:disruption|shortage)/gi,
      /copper\s+demand/gi,
    ];

    const industrialMetalPatterns = [
      /aluminum\s+(?:price|spot|future)/gi,
      /zinc\s+(?:price|spot|future)/gi,
      /nickel\s+(?:price|spot|future)/gi,
      /lithium\s+(?:price|spot)/gi,
      /cobalt\s+(?:price|spot)/gi,
      /rare\s+earth\s+(?:metal|element)/gi,
      /steel\s+(?:price|output)/gi,
    ];

    const headline = response.title || 'Metal Price Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of goldPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of silverPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of copperPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of industrialMetalPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Metal Price Alert: ${eventText.substring(0, 100)}`,
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

  private applyMetalScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'gold price', 'silver price', 'copper price', 'XAU', 'XAG',
      'metal surge', 'metal plunge', 'copper shortage', 'gold rally',
      'precious metal', 'industrial metal', 'central bank gold',
      'gold reserves', 'gold bullion', 'copper demand', 'LME',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 20);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 10);
      }

      // Gold safe-haven status
      if (text.includes('safe haven') || text.includes('gold rush') || text.includes('central bank buy')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 15);
      }

      // Copper as economic indicator
      if (text.includes('copper') && (text.includes('demand') || text.includes('supply') || text.includes('China'))) {
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 12);
      }

      // Industrial metals for manufacturing
      if (text.includes('lithium') || text.includes('cobalt') || text.includes('rare earth')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 10);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const metalPriceAgent = new MetalPriceAgent();