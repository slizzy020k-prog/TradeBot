import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class GeopoliticalRiskAgent {
  private sourceName: string = 'Geopolitical Risk Monitor';
  private baseUrl: string = 'https://www.geopoliticalmonitor.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.geopoliticalmonitor.com/',
      'https://www.crisis monitor.com/',
      'https://www.peacef monitor.org/',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const geopoliticalSources = [
      'https://www.cnn.com/world',
      'https://www.bbc.com/news/world',
      'https://www.aljazeera.com/',
    ];
    return this.fetchAndAnalyze(geopoliticalSources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseGeopoliticalContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[GeopoliticalRisk] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyHighImpactScoring(allAnalyses);
    logger.info(`[GeopoliticalRisk] Analyzed ${scored.length} geopolitical events`);
    return scored;
  }

  private parseGeopoliticalContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const conflictPatterns = [
      /war[s]?\s+(?:in|between|across)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /conflict[s]?\s+(?:in|between|across)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /military\s+action[s]?\s+(?:in|against)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /invasion\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /occupation\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /ceasefire[s]?\s+(?:breakdown|violated?|failed)/gi,
      /tensions\s+(?:escalate|rise|flare)\s+(?:in|between)/gi,
    ];

    const terrorPatterns = [
      /terrorist\s+attack[s]?\s+(?:in|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /bombing[s]?\s+(?:in|targets?|kills?)/gi,
      /extremist[s]?\s+(?:group|attack|threat)/gi,
      /ISIS|al[- ]?Qaeda|Taliban[^\w]/gi,
    ];

    const nukePatterns = [
      /nuclear\s+(?:threat|test|program|weapon)/gi,
      /Iran\s+nuclear/i,
      /North\s+Korea\s+nuclear/gi,
      /nuclear\s+deal\s+(?:collapsed|exited|failed)/gi,
    ];

    const headline = response.title || 'Geopolitical Risk Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of conflictPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of terrorPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of nukePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Geopolitical Alert: ${eventText.substring(0, 100)}`,
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

  private applyHighImpactScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_EVENTS = [
      'war', 'invasion', 'occupation', 'military action', 'conflict',
      'terrorist', 'attack', 'bombing', 'nuclear war', 'WWIII',
      'world war', 'escalation', 'ceasefire violation', 'civil war',
      'genocide', 'massacre', 'chemical weapon', 'biological weapon',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_EVENTS.filter(e => text.includes(e)).length;

      const modifiedScores = { ...analysis.scores };

      // Boost duration and institutional impact for high-impact geopolitical events
      if (highImpactCount > 0) {
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + 25);
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 20);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 15);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const geopoliticalRiskAgent = new GeopoliticalRiskAgent();