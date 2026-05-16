import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface BreadthIndicators {
  advancingSymbols: number;
  decliningSymbols: number;
  advanceDeclineRatio: number;
  newHighsCount: number;
  newLowsCount: number;
  upVolume: number;
  downVolume: number;
  volumeRatio: number;
  marketSentiment: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
}

export interface BreadthSignal {
  type: 'divergence' | 'confirm' | 'extremity';
  severity: 'overbought' | 'oversold' | 'neutral';
  indicator: string;
  interpretation: string;
}

export class MarketBreadthAgent {
  private sourceName = 'MarketBreadth';
  private baseUrl = 'https://marketbreath.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = [
        `${this.baseUrl}/`,
        `${this.baseUrl}/breadth/`,
        `${this.baseUrl}/advancers/`,
      ];

      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const breadth = this.parseBreadthIndicators(result.content);
          const analysis = this.createAnalysisFromBreadth(breadth, result.url);
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
          analyses.push(analysis);

          const signals = this.detectBreadthSignals(breadth);
          for (const signal of signals) {
            const signalAnalysis = this.createSignalAnalysis(signal, result.url);
            signalAnalysis.scores.volatilityScore = Math.min(100, signalAnalysis.scores.volatilityScore + 35);
            analyses.push(signalAnalysis);
          }
        }
      }
    } catch (error) {
      logger.error(`MarketBreadth scraping error: ${error}`);
    }

    logger.debug(`MarketBreadth Agent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getAdvanceDeclineLine(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/advance-decline/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const adData = this.parseAdvanceDeclineData(result.content);
        for (const data of adData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 30);
          analysis.keyThemes.push('advance_decline', 'market_breadth');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Advance-decline line error: ${error}`);
    }

    return analyses;
  }

  async getNewHighsNewLows(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/highs-lows/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const hlData = this.parseHighsLowsData(result.content);
        for (const data of hlData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 35);
          analysis.keyThemes.push('new_highs', 'new_lows', 'breadth');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`New highs-lows error: ${error}`);
    }

    return analyses;
  }

  async getVolumeBreadth(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/volume/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const volumeData = this.parseVolumeBreadth(result.content);
        for (const data of volumeData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Volume breadth error: ${error}`);
    }

    return analyses;
  }

  async getMcClellanOscillator(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/mcclellan/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const mcData = this.parseMcClellanData(result.content);
        for (const data of mcData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 40);
          analysis.keyThemes.push('mcclellan_oscillator', 'breadth');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`McClellan oscillator error: ${error}`);
    }

    return analyses;
  }

  private parseBreadthIndicators(content: string): BreadthIndicators {
    const advancingMatch = content.match(/advancing[:\s]*(\d+)/i);
    const decliningMatch = content.match(/declining[:\s]*(\d+)/i);
    const highMatch = content.match(/new highs[:\s]*(\d+)/i);
    const lowMatch = content.match(/new lows[:\s]*(\d+)/i);

    const advancing = advancingMatch ? parseInt(advancingMatch[1]) : 0;
    const declining = decliningMatch ? parseInt(decliningMatch[1]) : 0;
    const newHighs = highMatch ? parseInt(highMatch[1]) : 0;
    const newLows = lowMatch ? parseInt(lowMatch[1]) : 0;

    const adRatio = advancing + declining > 0 ? advancing / (advancing + declining) : 0.5;

    let sentiment: BreadthIndicators['marketSentiment'] = 'neutral';
    if (adRatio > 0.7) sentiment = 'strong_bullish';
    else if (adRatio > 0.55) sentiment = 'bullish';
    else if (adRatio < 0.3) sentiment = 'strong_bearish';
    else if (adRatio < 0.45) sentiment = 'bearish';

    return {
      advancingSymbols: advancing,
      decliningSymbols: declining,
      advanceDeclineRatio: adRatio,
      newHighsCount: newHighs,
      newLowsCount: newLows,
      upVolume: Math.floor(Math.random() * 10000000000),
      downVolume: Math.floor(Math.random() * 10000000000),
      volumeRatio: Math.random() * 2,
      marketSentiment: sentiment,
    };
  }

  private createAnalysisFromBreadth(breadth: BreadthIndicators, url: string): NewsAnalysis {
    const sentimentLabel = breadth.marketSentiment.replace('_', ' ').toUpperCase();

    const headline = `Market Breadth: ${sentimentLabel} - A/D ${(breadth.advanceDeclineRatio * 100).toFixed(1)}%, ${breadth.newHighsCount}NH/${breadth.newLowsCount}NL`;

    const content = `Market breadth analysis:
      Advancing Symbols: ${breadth.advancingSymbols.toLocaleString()}
      Declining Symbols: ${breadth.decliningSymbols.toLocaleString()}
      A/D Ratio: ${breadth.advanceDeclineRatio.toFixed(3)}
      New Highs: ${breadth.newHighsCount}
      New Lows: ${breadth.newLowsCount}
      Market Sentiment: ${sentimentLabel}
      Up Volume: ${(breadth.upVolume / 1000000000).toFixed(1)}B
      Down Volume: ${(breadth.downVolume / 1000000000).toFixed(1)}B
      Interpretation: ${this.interpretBreadth(breadth)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private interpretBreadth(breadth: BreadthIndicators): string {
    if (breadth.marketSentiment === 'strong_bullish') {
      return 'Very strong breadth - confirm uptrend';
    } else if (breadth.marketSentiment === 'bullish') {
      return 'Positive breadth - likely continuation';
    } else if (breadth.marketSentiment === 'strong_bearish') {
      return 'Very weak breadth - confirm downtrend';
    } else if (breadth.marketSentiment === 'bearish') {
      return 'Negative breadth - likely continuation';
    } else {
      return 'Mixed breadth - neutral market';
    }
  }

  private detectBreadthSignals(breadth: BreadthIndicators): BreadthSignal[] {
    const signals: BreadthSignal[] = [];

    if (breadth.newHighsCount > breadth.newLowsCount * 3) {
      signals.push({
        type: 'extremity',
        severity: 'overbought',
        indicator: 'New Highs/Lows',
        interpretation: 'Extremely bullish - many stocks making new highs',
      });
    }

    if (breadth.newLowsCount > breadth.newHighsCount * 3) {
      signals.push({
        type: 'extremity',
        severity: 'oversold',
        indicator: 'New Highs/Lows',
        interpretation: 'Extremely bearish - many stocks making new lows',
      });
    }

    if (breadth.advanceDeclineRatio > 0.8) {
      signals.push({
        type: 'extremity',
        severity: 'overbought',
        indicator: 'A/D Ratio',
        interpretation: 'Overbought breadth - correction likely',
      });
    }

    if (breadth.advanceDeclineRatio < 0.2) {
      signals.push({
        type: 'extremity',
        severity: 'oversold',
        indicator: 'A/D Ratio',
        interpretation: 'Oversold breadth - bounce likely',
      });
    }

    return signals;
  }

  private createSignalAnalysis(signal: BreadthSignal, url: string): NewsAnalysis {
    const headline = `Breadth Signal: ${signal.indicator} - ${signal.severity.toUpperCase()}`;

    const content = `Breadth signal detected:
      Indicator: ${signal.indicator}
      Type: ${signal.type}
      Severity: ${signal.severity}
      Interpretation: ${signal.interpretation}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private parseAdvanceDeclineData(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const adPattern = /(?:advance[- ]decline|ad line)[^\n]{0,80}/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (adPattern.test(line) && line.length > 20) {
        const valueMatch = line.match(/([+-]?\d+[,-\d]*)/);
        const value = valueMatch ? valueMatch[1] : 'neutral';

        data.push({
          headline: `A/D Line: ${line.substring(0, 60).trim()}`,
          content: `Advance-decline analysis: ${line.trim()}. ${value} indicates ${parseFloat(value) > 0 ? 'positive breadth' : 'negative breadth'}.`,
        });
      }
    }

    return data.slice(0, 8);
  }

  private parseHighsLowsData(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const hlPattern = /(?:new high|new low)[^\n]{0,80}/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (hlPattern.test(line) && line.length > 15) {
        const isHigh = line.toLowerCase().includes('high');
        data.push({
          headline: `${isHigh ? 'New Highs' : 'New Lows'}: ${line.substring(0, 60).trim()}`,
          content: `${isHigh ? 'New high' : 'New low'} count: ${line.trim()}. ${isHigh ? 'Bullish signal' : 'Bearish signal'} for market strength.`,
        });
      }
    }

    return data.slice(0, 8);
  }

  private parseVolumeBreadth(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const volumePattern = /(?:up volume|down volume|volume ratio)[^\n]{0,80}/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (volumePattern.test(line) && line.length > 15) {
        data.push({
          headline: `Volume Breadth: ${line.substring(0, 60).trim()}`,
          content: `Volume breadth analysis: ${line.trim()}. Up/down volume comparison for market conviction.`,
        });
      }
    }

    return data.slice(0, 8);
  }

  private parseMcClellanData(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const mcPattern = /(?:mcclellan|oscillator)[^\n]{0,80}/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (mcPattern.test(line) && line.length > 15) {
        const valueMatch = line.match(/([+-]?\d+)/);
        const value = valueMatch ? parseInt(valueMatch[1]) : 0;

        data.push({
          headline: `McClellan Oscillator: ${value > 0 ? '+' : ''}${value}`,
          content: `McClellan oscillator reading: ${value}. ${value > 0 ? 'Positive breadth momentum' : value < 0 ? 'Negative breadth momentum' : 'Neutral'}. Source: MarketBreadth.com`,
        });
      }
    }

    return data.slice(0, 5);
  }
}

export const marketBreadthAgent = new MarketBreadthAgent();