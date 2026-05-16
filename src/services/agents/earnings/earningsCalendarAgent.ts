import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class EarningsCalendarAgent {
  private sourceName: string = 'EarningsCalendar';
  private baseUrl: string = 'https://www.earningscalendar.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      logger.info(`${this.sourceName}: Scraping earnings calendar`);

      // Scrape earnings calendar for upcoming earnings
      const upcomingUrls = [
        `${this.baseUrl}/earnings-ratios/`,
        `${this.baseUrl}/earnings-surprise-history/`,
      ];

      for (const url of upcomingUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const earningsData = this.parseEarningsCalendar(result);
          for (const item of earningsData) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // Boost institutional impact for earnings
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 25);
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
      logger.info(`${this.sourceName}: Fetching earnings surprises`);

      const surpriseUrls = [
        `${this.baseUrl}/earnings-surprise-history/`,
        'https://www.earnings.com/earnings/calendar',
      ];

      for (const url of surpriseUrls) {
        const result = await scrapingService.scrape(url);
        if (result.success && result.content) {
          const surprises = this.parseSurpriseData(result);
          for (const item of surprises) {
            const analysis = newsClassifier.analyze(
              item.headline,
              item.content,
              this.sourceName,
              item.url
            );
            // High impact for earnings beats/misses
            analysis.scores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 35);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Earnings surprises fetch failed`, error);
    }

    return analyses;
  }

  private parseEarningsCalendar(result: ScrapingResponse): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse earnings calendar entries
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/gi;
    const tickerRegex = /\b[A-Z]{1,5}\b(?:\s+(?:reports?|announces?|will\s+report|earnings))?/gi;

    const lines = content.split('\n');
    let currentDate = '';

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        currentDate = dateMatch[0];
      }

      const tickerMatch = line.match(tickerRegex);
      if (tickerMatch && currentDate) {
        const ticker = tickerMatch[0].split(/\s+/)[0];
        if (ticker.length >= 1 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
          items.push({
            headline: `${ticker} Earnings Report - ${currentDate}`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    return items;
  }

  private parseSurpriseData(result: ScrapingResponse): Array<{ headline: string; content: string; url: string }> {
    const items: Array<{ headline: string; content: string; url: string }> = [];
    const content = result.markdown || result.content;

    // Parse earnings surprise entries
    const surpriseRegex = /(?:beat|beats|missed|miss|exceeded)\s+(?:earnings|revenue|eps)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (surpriseRegex.test(line)) {
        const tickerMatch = line.match(/\b[A-Z]{1,5}\b/);
        if (tickerMatch) {
          const ticker = tickerMatch[0];
          items.push({
            headline: `${ticker} Earnings ${line.includes('beat') ? 'Beats' : 'Misses'} Estimates`,
            content: line,
            url: result.url,
          });
        }
      }
    }

    return items;
  }
}

export const earningsCalendarAgent = new EarningsCalendarAgent();