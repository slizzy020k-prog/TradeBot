import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface OptionsData {
  symbol: string;
  strike: number;
  expiration: string;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
}

export interface OptionsFlowAnalysis {
  direction: 'bullish' | 'bearish' | 'neutral';
  unusualActivity: boolean;
  sweepCount: number;
  totalPremium: number;
  putCallRatio: number;
  maxPainDirection: string;
}

export class OptionsChainAgent {
  private sourceName = 'OptionsChain';
  private baseUrl = 'https://options.hisiness.com';

  async scrape(symbol: string): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = this.buildUrls(symbol);
      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const flowAnalysis = this.parseOptionsFlow(result.content, symbol);
          const analysis = this.createAnalysisFromFlow(flowAnalysis, symbol, result.url);
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
          analyses.push(analysis);

          const sweeps = this.detectSweepActivity(result.content, symbol);
          for (const sweep of sweeps) {
            const sweepAnalysis = newsClassifier.analyze(
              sweep.headline,
              sweep.content,
              this.sourceName,
              result.url
            );
            sweepAnalysis.scores.volatilityScore = Math.min(100, sweepAnalysis.scores.volatilityScore + 30);
            analyses.push(sweepAnalysis);
          }
        }
      }
    } catch (error) {
      logger.error(`OptionsChain scraping error: ${error}`);
    }

    logger.debug(`OptionsChain Agent: scraped ${analyses.length} items for ${symbol}`);
    return analyses;
  }

  async getOptionsFlow(symbol: string): Promise<OptionsFlowAnalysis | null> {
    try {
      const url = `${this.baseUrl}/options/${symbol}/flow`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        return this.parseOptionsFlowData(result.content, symbol);
      }
    } catch (error) {
      logger.error(`Options flow analysis error: ${error}`);
    }
    return null;
  }

  async getUnusualOptionsActivity(symbols: string[]): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/unusual-activity`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const activities = this.parseUnusualActivity(result.content, symbols);
        for (const activity of activities) {
          const analysis = newsClassifier.analyze(
            activity.headline,
            activity.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 35);
          analysis.keyThemes.push('options_flow', 'unusual_activity');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Unusual options activity error: ${error}`);
    }

    return analyses;
  }

  async getPutCallRatios(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/put-call-ratios`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const ratios = this.parsePutCallRatios(result.content);
        for (const ratio of ratios) {
          const analysis = newsClassifier.analyze(
            ratio.headline,
            ratio.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Put-call ratios error: ${error}`);
    }

    return analyses;
  }

  private buildUrls(symbol: string): string[] {
    return [
      `${this.baseUrl}/chains/${symbol}/`,
      `${this.baseUrl}/flow/${symbol}/`,
      `${this.baseUrl}/volatility/${symbol}/`,
    ];
  }

  private parseOptionsFlow(content: string, symbol: string): OptionsFlowAnalysis {
    const callVolumeMatch = content.match(/call.?volume[:\s]*(\d+)/i);
    const putVolumeMatch = content.match(/put.?volume[:\s]*(\d+)/i);
    const callVolume = callVolumeMatch ? parseInt(callVolumeMatch[1]) : 0;
    const putVolume = putVolumeMatch ? parseInt(putVolumeMatch[1]) : 0;

    const sweepMatch = content.match(/sweep[:\s]*(\d+)/i);
    const sweepCount = sweepMatch ? parseInt(sweepMatch[1]) : 0;

    const premiumMatch = content.match(/premium[:\s]*\$?([\d,]+)/i);
    const totalPremium = premiumMatch ? parseInt(premiumMatch[1].replace(/,/g, '')) : 0;

    const putCallRatio = putVolume > 0 && callVolume > 0 ? putVolume / callVolume : 1;

    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (callVolume > putVolume * 1.5) direction = 'bullish';
    else if (putVolume > callVolume * 1.5) direction = 'bearish';

    const unusualActivity = sweepCount > 5 || totalPremium > 1000000;

    return {
      direction,
      unusualActivity,
      sweepCount,
      totalPremium,
      putCallRatio,
      maxPainDirection: putCallRatio > 1 ? 'bearish' : 'bullish',
    };
  }

  private parseOptionsFlowData(content: string, symbol: string): OptionsFlowAnalysis {
    return this.parseOptionsFlow(content, symbol);
  }

  private createAnalysisFromFlow(flow: OptionsFlowAnalysis, symbol: string, url: string): NewsAnalysis {
    const headline = `${symbol} Options Flow: ${flow.direction.toUpperCase()} direction, ${flow.sweepCount} sweeps, $${(flow.totalPremium / 1000).toFixed(0)}K premium`;

    const content = `Options flow analysis for ${symbol}:
      Direction: ${flow.direction}
      Sweep Count: ${flow.sweepCount}
      Total Premium: $${flow.totalPremium.toLocaleString()}
      Put/Call Ratio: ${flow.putCallRatio.toFixed(2)}
      Unusual Activity: ${flow.unusualActivity ? 'YES' : 'No'}
      Max Pain Direction: ${flow.maxPainDirection}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private detectSweepActivity(content: string, symbol: string): { headline: string; content: string }[] {
    const sweeps: { headline: string; content: string }[] = [];

    const sweepPatterns = [
      /([A-Z]{1,5})\s*\$?(\d+)\s*(?:call|put)\s*(?: sweep|unusual|block)/gi,
      /(\d+)\s*contracts?\s*(?:bought|sold)\s*(?:at|@)\s*\$?(\d+)/gi,
      /(?:sweep|block trade|printing)\s*([A-Z]{1,5})/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of sweepPatterns) {
        const match = line.match(pattern);
        if (match) {
          const strike = match[2] || 'unknown';
          const isCall = line.toLowerCase().includes('call');
          sweeps.push({
            headline: `${symbol} $${strike} ${isCall ? 'CALL' : 'PUT'} sweep detected`,
            content: `Unusual options sweep: ${line.trim()}. Potential institutional activity.`,
          });
          break;
        }
      }
    }

    return sweeps.slice(0, 10);
  }

  private parseUnusualActivity(content: string, symbols: string[]): { headline: string; content: string }[] {
    const activities: { headline: string; content: string }[] = [];

    for (const symbol of symbols) {
      const symbolRegex = new RegExp(`${symbol}[^\\n]{0,200}`, 'gi');
      const matches = content.match(symbolRegex) || [];

      for (const match of matches.slice(0, 2)) {
        if (match.length > 20) {
          const isCall = match.toLowerCase().includes('call');
          const isPut = match.toLowerCase().includes('put');
          const direction = isCall ? 'BULLISH' : isPut ? 'BEARISH' : 'NEUTRAL';

          activities.push({
            headline: `${symbol} Unusual Options: ${direction} flow detected`,
            content: `Unusual options activity for ${symbol}: ${match.trim()}`,
          });
        }
      }
    }

    return activities;
  }

  private parsePutCallRatios(content: string): { headline: string; content: string }[] {
    const ratios: { headline: string; content: string }[] = [];

    const ratioPattern = /(?:equity|index|total)\s*put[/\\]call[:\s]*(\d+\.?\d*)/gi;
    const matches = content.match(ratioPattern) || [];

    for (const match of matches.slice(0, 5)) {
      const value = match.match(/(\d+\.?\d*)/);
      if (value) {
        const ratio = parseFloat(value[1]);
        let interpretation = 'neutral';
        if (ratio > 1.2) interpretation = 'bearish signal';
        else if (ratio < 0.7) interpretation = 'bullish signal';

        ratios.push({
          headline: `Put/Call Ratio: ${ratio.toFixed(2)} - ${interpretation}`,
          content: `Put/Call ratio of ${ratio.toFixed(2)} indicates ${interpretation}. ${match}`,
        });
      }
    }

    return ratios;
  }
}

export const optionsChainAgent = new OptionsChainAgent();