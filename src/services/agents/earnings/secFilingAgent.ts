import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class SECFilingAgent {
  private sourceName: string = 'SECFiling';
  private baseUrl: string = 'https://www.sec.gov/cgi-bin/browse-edgar';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping SEC filings`);

      const urls = [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-K&owner=include&count=40',
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-Q&owner=include&count=40',
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=8-K&owner=include&count=40',
        'https://www.annualreports.com/companies/edgar',
      ];

      for (const url of urls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const filingsData = this.parseFilingsData(result);
          for (const item of filingsData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // SEC filings have very high institutional impact
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 35);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Scraping failed`, error);
    }

    return analyses;
  }

  async getEarningsSurprises(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Detecting significant SEC filings`);

      const filingUrls = [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=8-K&owner=include&count=100',
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-K&owner=include&count=40',
      ];

      for (const url of filingUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const significantFilings = this.extractSignificantFilings(result);
          for (const item of significantFilings) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );

            // 8-K filings (material events) are high impact
            if (item.formType === '8-K') {
              analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 45);
              analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
            } else {
              analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 35);
            }

            // Annual reports (10-K) indicate long-term changes
            if (item.formType === '10-K') {
              analysis.scores.durationScore = Math.min(100, analysis.scores.durationScore + 20);
            }

            // Pre-announcement detection for earnings
            const preAnnouncementScore = this.detectPreAnnouncementScore(item);
            if (preAnnouncementScore > 60) {
              analysis.keyThemes.push(`pre-announcement: ${preAnnouncementScore}% confidence`);
            }

            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Significant filing detection failed`, error);
    }

    return analyses;
  }

  private parseFilingsData(result: any): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse SEC filing entries
    const filingRegex = /([A-Z]{1,5})\s+(?:10-K|10-Q|8-K|Form\s+[0-9A-Z-]+).*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      const filingMatch = line.match(filingRegex);
      if (filingMatch) {
        const tickerMatch = line.match(/\b[A-Z]{1,5}\b/);
        if (tickerMatch) {
          const ticker = tickerMatch[0];
          const formMatch = line.match(/(10-K|10-Q|8-K|Form\s+[0-9A-Z-]+)/i);
          const formType = formMatch ? formMatch[0].toUpperCase() : 'FILING';

          items.push({
            headline: `${ticker} ${formType} Filed`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    // Parse structured table data
    const tableRegex = /([A-Z]{2,5})\s*[|]\s*(?:10-K|10-Q|8-K)\s*[|]/gi;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      const ticker = match[1];
      if (!items.some(i => i.headline.includes(ticker))) {
        items.push({
          headline: `${ticker} SEC Filing Detected`,
          content: match[0],
          url: result.url,
        });
      }
    }

    return items;
  }

  private extractSignificantFilings(result: any): Array<{ headline: string; content: string; url: string; formType: string }> {
    const items: Array<{ headline: string; content: string; url: string; formType: string }> = [];
    const content = result.markdown || result.content;

    // Extract significant SEC filings (8-K, 10-K, etc.)
    const significantPatterns = [
      // 8-K material events
      /([A-Z]{2,5})\s+(?:8-K|Form\s*8-K).*(?:entry|agreement|termination|resignation|bankruptcy|merger|acquisition)/gi,
      // Annual reports with material info
      /([A-Z]{2,5})\s+(?:10-K|Form\s*10-K).*(?:revenue|income|loss|profit|decline|growth)/gi,
      // Quarterly reports with surprises
      /([A-Z]{2,5})\s+(?:10-Q|Form\s*10-Q).*(?:beat|miss|earnings|revenue)/gi,
    ];

    const formTypes = ['8-K', '10-K', '10-Q'];

    for (const pattern of significantPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ticker = match[1] || match[0].split(/\s+/)[0];
        let formType = 'FILING';

        for (const ft of formTypes) {
          if (match[0].toUpperCase().includes(ft)) {
            formType = ft;
            break;
          }
        }

        if (!items.some(i => i.headline.includes(ticker) && i.formType === formType)) {
          items.push({
            headline: `${ticker} ${formType} Filing - Significant Event`,
            content: match[0],
            url: result.url,
            formType,
          });
        }
      }
    }

    // Also extract any 8-K filings (always material events)
    const eightKPattern = /([A-Z]{2,5})\s+(?:8-K|Form\s*8-K)/gi;
    let match2;
    while ((match2 = eightKPattern.exec(content)) !== null) {
      const ticker = match2[1];
      if (!items.some(i => i.headline.includes(ticker) && i.formType === '8-K')) {
        items.push({
          headline: `${ticker} 8-K Filing Detected`,
          content: match2[0],
          url: result.url,
          formType: '8-K',
        });
      }
    }

    return items;
  }

  private detectPreAnnouncementScore(item: { headline: string; content: string; formType: string }): number {
    let score = 30; // Base score

    // 8-K filings near earnings season are often pre-announcements
    if (item.formType === '8-K') {
      score += 25;
    }

    // Keywords indicating pre-earnings activity
    const preAnnouncementKeywords = [
      'earnings', 'revenue guidance', 'updated outlook', 'pre-announcement',
      'pre-release', 'results', 'quarterly', 'fiscal'
    ];

    const lowerContent = (item.headline + ' ' + item.content).toLowerCase();
    for (const keyword of preAnnouncementKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 15;
      }
    }

    // Form 4 filings (insider trading) are strong pre-announcement signals
    if (item.formType === '4') {
      score += 30;
    }

    return Math.min(95, score);
  }
}

export const secFilingAgent = new SECFilingAgent();