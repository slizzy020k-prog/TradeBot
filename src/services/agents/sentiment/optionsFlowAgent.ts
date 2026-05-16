import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

interface OptionFlow {
  symbol: string;
  expiration: string;
  type: 'call' | 'put';
  strike: number;
  premium: number;
  volume: number;
  OI: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  unusual: boolean;
  estimatedMarketImpact: number;
}

export class OptionsFlowSentimentAgent {
  private sourceName: string = 'Options Flow';
  private baseUrl: string = 'https://options.flow';

  private trackedSources = [
    'https://www.barchart.com/options/volume-leaders',
    'https://www.wsj.com/market-data/quotes/options/largest-volume',
    'https://finance.yahoo.com/options/largest-change-in-implied-volatility'
  ];

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape options flow data
      const results = await scrapingService.scrapeBatch(this.trackedSources, 'scrapling');

      for (const result of results) {
        if (result.success && result.content) {
          const optionFlows = this.parseOptionsData(result);
          const flowAnalyses = optionFlows.map(f => this.flowToAnalysis(f, result.url));
          analyses.push(...flowAnalyses);
        }
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping options flow`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape unusual options activity
      const unusualSources = [
        'https://www.barchart.com/options/unusual-activity',
        'https://www.ortex.com/large-trades'
      ];

      const results = await scrapingService.scrapeBatch(unusualSources, 'scrapling');

      for (const result of results) {
        if (result.success && result.content) {
          const optionFlows = this.parseUnusualOptions(result);
          const flowAnalyses = optionFlows.map(f => this.flowToAnalysis(f, result.url));
          analyses.push(...flowAnalyses);
        }
      }

      // Classify all flows
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Options flow has high manipulation risk due to spoofing potential
      const filtered = classified.filter(a =>
        a.scores.confidenceScore > 35 &&
        a.scores.manipulationRiskScore < 50
      );

      logger.info(`${this.sourceName}: Analyzed ${classified.length} option flows, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseOptionsData(response: ScrapingResponse): OptionFlow[] {
    const flows: OptionFlow[] = [];

    try {
      // Parse options table structure
      const symbolPattern = /\b([A-Z]{1,5})\b(?:\s+(?:Calls|Puts|Options))?/g;
      const strikePattern = /(\d+\.?\d*)\s*(?:strike|strike price)/gi;
      const volumePattern = /volume[:\s]*(\d+[\d,]*)/gi;
      const premiumPattern = /premium[:\s]*\$?(\d+\.?\d*)/gi;

      const symbols = response.content.match(symbolPattern) || [];
      const volumes = [...response.content.matchAll(volumePattern)].map(m => parseInt(m[1].replace(/,/g, '')));
      const premiums = [...response.content.matchAll(premiumPattern)].map(m => parseFloat(m[1]));

      for (let i = 0; i < Math.min(symbols.length, 30); i++) {
        const symbol = symbols[i];
        const volume = volumes[i] || 0;
        const premium = premiums[i] || 0;

        const type = this.detectOptionType(response.content, i);
        const sentiment = this.calculateFlowSentiment(type, volume, premium);

        flows.push({
          symbol,
          expiration: this.extractExpiration(response.content, i),
          type,
          strike: this.extractStrike(response.content, i),
          premium,
          volume,
         OI: this.extractOI(response.content, i),
          sentiment,
          unusual: volume > 5000,
          estimatedMarketImpact: this.estimateMarketImpact(volume, premium)
        });
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing options data`, error);
    }

    return flows;
  }

  private parseUnusualOptions(response: ScrapingResponse): OptionFlow[] {
    const flows: OptionFlow[] = [];

    try {
      // Parse unusual options activity table
      const rows = response.content.split(/<tr|<\/tr>/i);

      for (const row of rows) {
        const symbolMatch = row.match(/\b([A-Z]{2,5})\b/);
        if (!symbolMatch) continue;

        const symbol = symbolMatch[1];
        const volume = this.extractValue(row, /vol[:\s]*(\d+)/i);
        const premium = this.extractValue(row, /premium[:\s]*\$?(\d+)/i);
        const strike = this.extractValue(row, /strike[:\s]*(\d+\.?\d*)/i);

        if (volume > 1000) {
          const type: 'call' | 'put' = row.toLowerCase().includes('put') ? 'put' : 'call';
          const sentiment = this.calculateFlowSentiment(type, volume, premium);

          flows.push({
            symbol,
            expiration: this.extractExpiration(row, 0),
            type,
            strike: strike || 0,
            premium: premium || 0,
            volume,
           OI: this.extractValue(row, /oi[:\s]*(\d+)/i) || 0,
            sentiment,
            unusual: true,
            estimatedMarketImpact: this.estimateMarketImpact(volume, premium)
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing unusual options`, error);
    }

    return flows;
  }

  private extractValue(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }

  private detectOptionType(text: string, index: number): 'call' | 'put' {
    const lower = text.toLowerCase();
    if (lower.includes('put')) return 'put';
    if (lower.includes('call')) return 'call';
    return index % 2 === 0 ? 'call' : 'put';
  }

  private extractExpiration(text: string, _index: number): string {
    // Try to find expiration date patterns
    const expirationPatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d+/gi
    ];

    for (const pattern of expirationPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return 'unknown';
  }

  private extractStrike(text: string, _index: number): number {
    const strikeMatch = text.match(/\b(\d{2,5})\b(?=\s*(?:strike|purchase|buy))/i);
    return strikeMatch ? parseFloat(strikeMatch[1]) : 0;
  }

  private extractOI(text: string, _index: number): number {
    const oiMatch = text.match(/oi[:\s]*(\d+,?\d*)/i);
    return oiMatch ? parseInt(oiMatch[1].replace(/,/g, '')) : 0;
  }

  private calculateFlowSentiment(type: 'call' | 'put', volume: number, premium: number): 'bullish' | 'bearish' | 'neutral' {
    // Unusual call volume = bullish, put volume = bearish
    const isUnusual = volume > 5000;

    if (type === 'call' && isUnusual) return 'bullish';
    if (type === 'put' && isUnusual) return 'bearish';

    // Large premiums indicate conviction
    if (premium > 100000) {
      return type === 'call' ? 'bullish' : 'bearish';
    }

    return 'neutral';
  }

  private estimateMarketImpact(volume: number, premium: number): number {
    let impact = 0;

    // Volume-based impact
    if (volume > 10000) impact += 40;
    else if (volume > 5000) impact += 25;
    else if (volume > 1000) impact += 10;

    // Premium-based impact (large trades move markets)
    if (premium > 1000000) impact += 30;
    else if (premium > 100000) impact += 20;
    else if (premium > 10000) impact += 10;

    return Math.min(100, impact);
  }

  private flowToAnalysis(flow: OptionFlow, url: string): NewsAnalysis {
    const headline = `${flow.unusual ? 'UNUSUAL ' : ''}${flow.type.toUpperCase()} flow: ${flow.symbol} $${flow.strike} ${flow.expiration}`;

    const sentimentScore = flow.sentiment === 'bullish' ? 50 : flow.sentiment === 'bearish' ? -50 : 0;

    return {
      headline,
      content: `Volume: ${flow.volume.toLocaleString()} | Premium: $${flow.premium.toLocaleString()} | OI: ${flow.OI.toLocaleString()} | Impact: ${flow.estimatedMarketImpact}%`,
      url,
      source: this.sourceName,
      timestamp: Date.now(),
      scores: {
        sentimentScore,
        volatilityScore: this.calculateVolatilityScore(flow),
        confidenceScore: this.calculateConfidenceScore(flow),
        institutionalImpactScore: this.calculateInstitutionalScore(flow),
        durationScore: 60,
        manipulationRiskScore: this.calculateManipulationRisk(flow)
      },
      classification: flow.sentiment,
      keyThemes: this.extractThemes(flow),
      relevantSymbols: [flow.symbol]
    };
  }

  private calculateVolatilityScore(flow: OptionFlow): number {
    let score = 40;

    // High volume indicates volatility
    if (flow.volume > 10000) score += 30;
    else if (flow.volume > 5000) score += 20;
    else if (flow.volume > 1000) score += 10;

    // Large premium = high conviction = higher volatility signal
    if (flow.premium > 1000000) score += 20;
    else if (flow.premium > 100000) score += 10;

    return Math.min(100, score);
  }

  private calculateConfidenceScore(flow: OptionFlow): number {
    let confidence = 50;

    // Unusual activity has higher confidence
    if (flow.unusual) confidence += 20;

    // OI (Open Interest) adds confidence
    if (flow.OI > 10000) confidence += 15;
    else if (flow.OI > 1000) confidence += 10;

    return Math.min(90, confidence);
  }

  private calculateInstitutionalScore(flow: OptionFlow): number {
    let score = 40;

    // Large premiums indicate institutional involvement
    if (flow.premium > 500000) score += 40;
    else if (flow.premium > 100000) score += 25;

    // High OI suggests institutional positioning
    if (flow.OI > 50000) score += 20;

    return Math.min(100, score);
  }

  private calculateManipulationRisk(flow: OptionFlow): number {
    let risk = 35;

    // Options can be used for manipulation (spoofing, layering)
    if (flow.unusual) risk += 15;

    // Very large trades might be manipulative
    if (flow.volume > 20000) risk += 10;
    if (flow.premium > 2000000) risk += 15;

    // Short-dated options are riskier for manipulation
    if (flow.expiration.includes('0') || flow.expiration.includes('1')) risk += 10;

    return Math.min(90, risk);
  }

  private extractThemes(flow: OptionFlow): string[] {
    const themes: string[] = [];

    if (flow.type === 'call') themes.push('call activity');
    else themes.push('put activity');

    if (flow.unusual) themes.push('unusual activity');

    if (flow.OI > flow.volume) themes.push('deep ITM');
    else if (flow.OI < flow.volume * 0.5) themes.push('short expiration');

    if (flow.estimatedMarketImpact > 50) themes.push('high impact');

    return themes.slice(0, 3);
  }
}

export const optionsFlowSentimentAgent = new OptionsFlowSentimentAgent();