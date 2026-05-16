import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class ElectionImpactAgent {
  private sourceName: string = 'Election Impact Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.politico.com/2024-election/',
      'https://www.realclearpolitics.com/',
      'https://www.fivethirtyeight.com/',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const electionSources = [
      'https://www.cnn.com/politics',
      'https://www.nytimes.com/politics',
      'https://www.bbc.com/news/politics',
    ];
    return this.fetchAndAnalyze(electionSources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseElectionContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[ElectionImpact] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyElectionScoring(allAnalyses);
    logger.info(`[ElectionImpact] Analyzed ${scored.length} election updates`);
    return scored;
  }

  private parseElectionContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const electionPatterns = [
      /presidential\s+election/gi,
      /congressional\s+election/gi,
      /senate\s+election/gi,
      /house\s+election/gi,
      /midterm\s+election/gi,
      /primary\s+election/gi,
      /general\s+election/gi,
      /election\s+day/gi,
      /poll[s]?\s+(?:results?|data|numbers)/gi,
      /exit\s+poll[s]?/gi,
      /voting\s+(?:results?|turnout|data)/gi,
    ];

    const policyImpactPatterns = [
      /if\s+elected\s+(.+?)\s+will/gi,
      /campaign\s+promise[s]?\s+(?:to|of)/gi,
      /policy\s+agenda/gi,
      /tax\s+policy/gi,
      /trade\s+policy/gi,
      /healthcare\s+policy/gi,
      /regulation\s+(?:plan|agenda)/gi,
      /foreign\s+policy\s+(?:agenda|plan)/gi,
      /immigration\s+policy/gi,
    ];

    const headline = response.title || 'Election Impact Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of electionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of policyImpactPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Election Alert: ${eventText.substring(0, 100)}`,
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

  private applyElectionScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'presidential election', 'congressional election', 'senate race',
      'house race', 'exit poll', 'poll results', 'voting day',
      'election outcome', 'seats gained', 'seats lost',
      'trading day', 'market impact', 'policy shift',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + 20);
      }

      // Major policy implications
      const policyKeywords = ['tax', 'regulation', 'trade', 'healthcare', 'immigration', 'foreign policy'];
      for (const policy of policyKeywords) {
        if (text.includes(policy)) {
          modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 8);
        }
      }

      // Market moving potential
      if (text.includes('uncertainty') || text.includes('volatility') || text.includes('market reaction')) {
        modifiedScores.volatilityScore = Math.min(100, modifiedScores.volatilityScore + 15);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const electionImpactAgent = new ElectionImpactAgent();