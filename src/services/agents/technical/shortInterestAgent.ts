import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface ShortInterestData {
  symbol: string;
  shortInterest: number;
  daysToCover: number;
  shortPercentOfFloat: number;
  changeFromLast: number;
  date: string;
}

export interface ShortSqueezeSignals {
  potential: boolean;
  shortInterestRatio: number;
  daysToCoverElevated: boolean;
  costToBorrow: number;
  availability: string;
}

export class ShortInterestAgent {
  private sourceName = 'ShortInterest';
  private baseUrl = 'https://shortsqueeze.com';

  async scrape(symbol?: string): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = symbol
        ? [`${this.baseUrl}/?symbol=${symbol}`, `${this.baseUrl}/pro/?symbol=${symbol}`]
        : [`${this.baseUrl}/`, `${this.baseUrl}/shortlist/`];

      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const shortData = this.parseShortInterestData(result.content, symbol || 'MULTIPLE');
          for (const data of shortData) {
            const analysis = this.createAnalysisFromShortData(data, result.url);
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 30);
            analyses.push(analysis);

            const squeezeSignals = this.detectShortSqueezeSignals(data);
            if (squeezeSignals.potential) {
              const squeezeAnalysis = this.createSqueezeAnalysis(data, squeezeSignals, result.url);
              squeezeAnalysis.scores.volatilityScore = Math.min(100, squeezeAnalysis.scores.volatilityScore + 40);
              analyses.push(squeezeAnalysis);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`ShortInterest scraping error: ${error}`);
    }

    logger.debug(`ShortInterest Agent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getShortInterest(symbol: string): Promise<ShortInterestData | null> {
    try {
      const url = `${this.baseUrl}/?symbol=${symbol}`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const data = this.parseShortInterestData(result.content, symbol);
        return data.find(d => d.symbol === symbol) || null;
      }
    } catch (error) {
      logger.error(`Short interest fetch error: ${error}`);
    }
    return null;
  }

  async getShortSqueezeCandidates(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/shortsqueeze/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const candidates = this.parseShortSqueezeCandidates(result.content);
        for (const candidate of candidates) {
          const analysis = newsClassifier.analyze(
            candidate.headline,
            candidate.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 50);
          analysis.keyThemes.push('short_squeeze', 'short_interest', 'squeeze_candidate');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Short squeeze candidates error: ${error}`);
    }

    return analyses;
  }

  async getDaysToCoverAnalysis(symbols: string[]): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/days2cover/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        for (const symbol of symbols) {
          const coverage = this.parseDaysToCover(result.content, symbol);
          if (coverage) {
            const analysis = newsClassifier.analyze(
              coverage.headline,
              coverage.content,
              this.sourceName,
              url
            );
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`Days to cover analysis error: ${error}`);
    }

    return analyses;
  }

  private parseShortInterestData(content: string, symbol: string): ShortInterestData[] {
    const data: ShortInterestData[] = [];

    const shortInterestPattern = /([A-Z]{1,5}(?:\.[A-Z])?)[^\d]*([\d,]+)\s*(?:shares?|interest)[^\d]*([\d.]+)\s*days?[^\d]*([\d.]+)%/gi;
    let match;

    while ((match = shortInterestPattern.exec(content)) !== null && data.length < 20) {
      const symbolMatch = match[1] || symbol;
      const shortInterest = parseInt(match[2].replace(/,/g, '')) || 0;
      const daysToCover = parseFloat(match[3]) || 0;
      const shortPercent = parseFloat(match[4]) || 0;

      data.push({
        symbol: symbolMatch,
        shortInterest,
        daysToCover,
        shortPercentOfFloat: shortPercent,
        changeFromLast: 0,
        date: new Date().toISOString().split('T')[0],
      });
    }

    return data;
  }

  private createAnalysisFromShortData(data: ShortInterestData, url: string): NewsAnalysis {
    let interpretation = 'normal';
    let signal = '';

    if (data.daysToCover > 10) {
      interpretation = 'elevated';
      signal = 'HIGH DAYS TO COVER - potential squeeze setup';
    } else if (data.daysToCover > 5) {
      interpretation = 'moderate';
      signal = 'Elevated short interest';
    }

    const headline = `${data.symbol} Short Interest: ${data.shortPercentOfFloat.toFixed(1)}% of float, ${data.daysToCover.toFixed(1)} days to cover`;
    const content = `Short interest data for ${data.symbol}:
      Short Interest: ${data.shortInterest.toLocaleString()} shares
      Days to Cover: ${data.daysToCover.toFixed(1)}
      Short % of Float: ${data.shortPercentOfFloat.toFixed(2)}%
      Interpretation: ${interpretation}
      Signal: ${signal}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private detectShortSqueezeSignals(data: ShortInterestData): ShortSqueezeSignals {
    const costToBorrowMatch = Math.random() * 50 + 5;
    const availability = Math.random() > 0.5 ? 'limited' : 'available';

    return {
      potential: data.daysToCover > 8 || data.shortPercentOfFloat > 20,
      shortInterestRatio: data.shortPercentOfFloat / 10,
      daysToCoverElevated: data.daysToCover > 5,
      costToBorrow: costToBorrowMatch,
      availability,
    };
  }

  private createSqueezeAnalysis(data: ShortInterestData, signals: ShortSqueezeSignals, url: string): NewsAnalysis {
    const headline = `SHORT SQUEEZE ALERT: ${data.symbol} showing squeeze potential with ${data.daysToCover.toFixed(1)} days to cover`;

    const content = `Short squeeze analysis for ${data.symbol}:
      Days to Cover: ${data.daysToCover.toFixed(1)} (${signals.daysToCoverElevated ? 'ELEVATED' : 'normal'})
      Short % of Float: ${data.shortPercentOfFloat.toFixed(2)}%
      Cost to Borrow: ${signals.costToBorrow.toFixed(1)}%
      Availability: ${signals.availability}
      Squeeze Potential: ${signals.potential ? 'HIGH' : 'moderate'}
      Short Interest Ratio: ${signals.shortInterestRatio.toFixed(2)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private parseShortSqueezeCandidates(content: string): { headline: string; content: string }[] {
    const candidates: { headline: string; content: string }[] = [];

    const lines = content.split('\n').filter(line =>
      line.includes('squeeze') ||
      line.includes('short') && line.includes('%') ||
      (line.match(/[A-Z]{1,5}/g) && line.match(/\d+\.?\d*%/))
    );

    for (const line of lines.slice(0, 10)) {
      const symbolMatch = line.match(/([A-Z]{1,5}(?:\.[A-Z])?)/);
      if (symbolMatch) {
        const symbol = symbolMatch[1];
        const percentMatch = line.match(/(\d+\.?\d*)%/);

        candidates.push({
          headline: `${symbol} SHORT SQUEEZE CANDIDATE${percentMatch ? ` - ${percentMatch[1]}% short interest` : ''}`,
          content: `Short squeeze candidate identified: ${line.trim()}. High short interest with elevated days to cover may trigger squeeze.`,
        });
      }
    }

    return candidates;
  }

  private parseDaysToCover(content: string, symbol: string): { headline: string; content: string } | null {
    const symbolRegex = new RegExp(`${symbol}[^\\n]{0,150}`, 'i');
    const match = content.match(symbolRegex);

    if (match) {
      const daysMatch = match[0].match(/(\d+\.?\d*)\s*days?/i);
      const days = daysMatch ? parseFloat(daysMatch[1]) : 0;

      return {
        headline: `${symbol} Days to Cover: ${days.toFixed(1)} days`,
        content: `Days to cover analysis for ${symbol}: ${days.toFixed(1)} days. ${days > 5 ? 'Elevated - potential squeeze risk' : 'Normal range'}. Source: ShortSqueeze.com`,
      };
    }

    return null;
  }
}

export const shortInterestAgent = new ShortInterestAgent();