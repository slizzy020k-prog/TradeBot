import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class SanctionsAgent {
  private sourceName: string = 'Sanctions Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://home.treasury.gov/policy-issues/office-of-foreign-assets-control-sanctions-programs-information',
      'https://www.state.gov/reports/',
      'https://www.reuters.com/business/finance/',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const sanctionSources = [
      'https://www.bloomberg.com/markets',
      'https://www.ft.com/markets',
      'https://www.cnbc.com/economy',
    ];
    return this.fetchAndAnalyze(sanctionSources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseSanctionsContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[Sanctions] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applySanctionsScoring(allAnalyses);
    logger.info(`[Sanctions] Analyzed ${scored.length} sanctions updates`);
    return scored;
  }

  private parseSanctionsContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const sanctionPatterns = [
      /sanction[s]?\s+(?:imposed|added|removed|expanded|against)/gi,
      /OFAC\s+sanction[s]?/gi,
      /EU\s+sanction[s]?/gi,
      /UN\s+sanction[s]?/gi,
      /asset\s+freeze[d]?/gi,
      /travel\s+ban[s]?/gi,
      /banking\s+sanction[s]?/gi,
      /SWIFT\s+cut\s+off/gi,
      /blacklist(ed)?/gi,
      /entity\s+list/gi,
      /denied\s+party/gi,
    ];

    const targetPatterns = [
      /(?:Russian|Russia)[^\w]+(?:sanction|oligarch|billionaire|officials?)/gi,
      /Iranian?\s+(?:oil|bank|entities?|officials?)/gi,
      /North\s+Korean?\s+(?:nuclear|missile|entities?)/gi,
      /Venezuelan?\s+(?:oil|sanction|regime)/gi,
      /Cuban?\s+(?:sanction|embargo)/gi,
      /Syrian?\s+(?:regime|sanction|assad)/gi,
      /Taliban[^\w]+sanction/gi,
      /Russian\s+central\s+bank/gi,
      /Russian\s+reserve[s]?/gi,
    ];

    const headline = response.title || 'Sanctions Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of sanctionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of targetPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Sanctions Alert: ${eventText.substring(0, 100)}`,
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

  private applySanctionsScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'sanction', 'OFAC', 'asset freeze', 'SWIFT', 'banking ban',
      'travel ban', 'export ban', 'oil sanction', 'energy sanction',
      'financial sanction', 'targeted sanction', 'sectoral sanction',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 30);
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + 25);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 15);
      }

      // Financial system impacts get extra boost
      if (text.includes('bank') || text.includes('SWIFT') || text.includes('financial')) {
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 15);
      }

      // Oil/energy sanctions get extra boost
      if (text.includes('oil') || text.includes('energy') || text.includes('gas')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 10);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const sanctionsAgent = new SanctionsAgent();