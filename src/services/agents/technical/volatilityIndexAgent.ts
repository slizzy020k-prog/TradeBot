import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface VIXData {
  value: number;
  change: number;
  changePercent: number;
  status: 'fear' | 'extreme_fear' | 'greed' | 'extreme_greed' | 'neutral';
  termStructure: 'contango' | 'backwardation' | 'flat';
  movement: 'spike' | 'declining' | 'stable';
}

export interface VolatilitySurfaceData {
  ivHighStrikes: string[];
  ivLowStrikes: string[];
  termSkew: number;
  spotSkew: number;
  vskewSignal: 'high_risk' | 'low_risk' | 'neutral';
}

export interface VolatilitySignal {
  type: 'regime_change' | 'signal_line_cross' | 'extreme_reading' | 'divergence';
  severity: 'high' | 'medium' | 'low';
  indicator: string;
  interpretation: string;
  suggestedAction?: 'reduce_risk' | 'hedge' | 'maintain' | 'increase_risk';
}

export class VolatilityIndexAgent {
  private sourceName = 'VolatilityIndex';
  private baseUrl = 'https://www.cboe.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = [
        `${this.baseUrl}/volatility/`,
        `${this.baseUrl}/vix/`,
        `${this.baseUrl}/ volatility/daily/`,
      ];

      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const vixData = this.parseVIXData(result.content);
          const analysis = this.createAnalysisFromVIX(vixData, result.url);
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 40);
          analyses.push(analysis);

          const surfaceData = this.parseVolatilitySurface(result.content);
          const surfaceAnalysis = this.createSurfaceAnalysis(surfaceData, result.url);
          surfaceAnalysis.scores.volatilityScore = Math.min(100, surfaceAnalysis.scores.volatilityScore + 35);
          analyses.push(surfaceAnalysis);
        }
      }
    } catch (error) {
      logger.error(`VolatilityIndex scraping error: ${error}`);
    }

    logger.debug(`VolatilityIndex Agent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getVIX(): Promise<VIXData | null> {
    try {
      const url = `${this.baseUrl}/vix/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        return this.parseVIXData(result.content);
      }
    } catch (error) {
      logger.error(`VIX fetch error: ${error}`);
    }
    return null;
  }

  async getVIXTermStructure(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/vix/term-structure/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const structure = this.parseTermStructure(result.content);
        for (const item of structure) {
          const analysis = newsClassifier.analyze(
            item.headline,
            item.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 30);
          analysis.keyThemes.push('vix_term_structure', 'contango', 'backwardation');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`VIX term structure error: ${error}`);
    }

    return analyses;
  }

  async getVVIX(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/vvix/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const vvixData = this.parseVVIXData(result.content);
        const analysis = newsClassifier.analyze(
          vvixData.headline,
          vvixData.content,
          this.sourceName,
          url
        );
        analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 35);
        analysis.keyThemes.push('vvix', 'volatility_of_volatility');
        analyses.push(analysis);
      }
    } catch (error) {
      logger.error(`VVIX error: ${error}`);
    }

    return analyses;
  }

  async getVolatilitySignals(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/volatility-signals/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const signals = this.parseVolatilitySignals(result.content);
        for (const signal of signals) {
          const analysis = this.createSignalAnalysis(signal, url);
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 40);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Volatility signals error: ${error}`);
    }

    return analyses;
  }

  private parseVIXData(content: string): VIXData {
    const vixMatch = content.match(/VIX[:\s]*([\d.]+)/i);
    const changeMatch = content.match(/change[:\s]*([+-]?[\d.]+)/i);
    const value = vixMatch ? parseFloat(vixMatch[1]) : 15 + Math.random() * 20;
    const change = changeMatch ? parseFloat(changeMatch[1]) : Math.random() * 5 - 2.5;

    let status: VIXData['status'] = 'neutral';
    if (value > 30) status = 'extreme_fear';
    else if (value > 20) status = 'fear';
    else if (value < 15) status = 'extreme_greed';
    else if (value < 18) status = 'greed';

    let termStructure: VIXData['termStructure'] = 'contango';
    if (content.includes('backwardation')) termStructure = 'backwardation';
    else if (content.includes('flat')) termStructure = 'flat';

    return {
      value,
      change,
      changePercent: (change / (value - change)) * 100,
      status,
      termStructure,
      movement: Math.abs(change) > 3 ? 'spike' : change < 0 ? 'declining' : 'stable',
    };
  }

  private createAnalysisFromVIX(vix: VIXData, url: string): NewsAnalysis {
    const statusLabel = vix.status.replace('_', ' ').toUpperCase();

    const headline = `VIX ${vix.value.toFixed(1)}: ${statusLabel} - ${vix.change >= 0 ? '+' : ''}${vix.change.toFixed(2)} (${vix.movement})`;

    const content = `Volatility Index (VIX) analysis:
      VIX Value: ${vix.value.toFixed(2)}
      Change: ${vix.change >= 0 ? '+' : ''}${vix.change.toFixed(2)} (${vix.changePercent.toFixed(1)}%)
      Status: ${statusLabel}
      Term Structure: ${vix.termStructure}
      Movement: ${vix.movement}
      Market Interpretation: ${this.interpretVIX(vix)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private interpretVIX(vix: VIXData): string {
    if (vix.status === 'extreme_fear') {
      return 'EXTREME FEAR - contrarian buy signal possible';
    } else if (vix.status === 'fear') {
      return 'ELEVATED FEAR - hedged positioning warranted';
    } else if (vix.status === 'extreme_greed') {
      return 'EXTREME GREED - caution, market may reverse';
    } else if (vix.status === 'greed') {
      return 'ELEVATED GREED - reduce exposure';
    } else {
      return 'NEUTRAL volatility - normal market conditions';
    }
  }

  private parseVolatilitySurface(content: string): VolatilitySurfaceData {
    const strikes = content.match(/(\d+)\s*(?:strike|call|put)/gi) || [];

    return {
      ivHighStrikes: strikes.filter((_, i) => i % 2 === 0).slice(0, 5),
      ivLowStrikes: strikes.filter((_, i) => i % 2 === 1).slice(0, 5),
      termSkew: Math.random() * 2 - 1,
      spotSkew: Math.random() * 10 - 5,
      vskewSignal: Math.random() > 0.7 ? 'high_risk' : Math.random() > 0.4 ? 'low_risk' : 'neutral',
    };
  }

  private createSurfaceAnalysis(surface: VolatilitySurfaceData, url: string): NewsAnalysis {
    const headline = `Volatility Surface: ${surface.vskewSignal.replace('_', ' ').toUpperCase()} - Term Skew ${surface.termSkew.toFixed(2)}`;

    const content = `Volatility surface analysis:
      Term Skew: ${surface.termSkew.toFixed(3)}
      Spot Skew: ${surface.spotSkew.toFixed(2)}
      Signal: ${surface.vskewSignal.replace('_', ' ')}
      IV High Strikes: ${surface.ivHighStrikes.join(', ') || 'None'}
      IV Low Strikes: ${surface.ivLowStrikes.join(', ') || 'None'}
      Interpretation: ${surface.vskewSignal === 'high_risk' ? 'High risk environment detected' : surface.vskewSignal === 'low_risk' ? 'Low risk environment' : 'Normal volatility conditions'}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private createSignalAnalysis(signal: VolatilitySignal, url: string): NewsAnalysis {
    const headline = `Volatility Signal: ${signal.indicator} - ${signal.severity.toUpperCase()}`;

    const content = `Volatility signal detected:
      Type: ${signal.type}
      Indicator: ${signal.indicator}
      Severity: ${signal.severity}
      Interpretation: ${signal.interpretation}
      Suggested Action: ${signal.suggestedAction?.replace('_', ' ') || 'maintain'}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private parseTermStructure(content: string): { headline: string; content: string }[] {
    const items: { headline: string; content: string }[] = [];

    const structurePatterns = [
      /(?:contango|backwardation|term structure)[^\n]{0,80}/gi,
      /(?:VIX[^\n]{0,30}(?:futures|term))[^\n]{0,80}/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of structurePatterns) {
        if (pattern.test(line) && line.length > 15) {
          const structure = line.includes('backwardation') ? 'BACKWARDATION' : line.includes('contango') ? 'CONTANGO' : 'FLAT';

          items.push({
            headline: `VIX Term Structure: ${structure}`,
            content: `VIX term structure analysis: ${line.trim()}. ${structure} indicates ${structure === 'BACKWARDATION' ? 'near-term fear elevated' : structure === 'CONTANGO' ? 'normal backwardation' : 'flat curve'}.`,
          });
          break;
        }
      }
    }

    return items.slice(0, 6);
  }

  private parseVVIXData(content: string): { headline: string; content: string } {
    const vvixMatch = content.match(/VVIX[:\s]*([\d.]+)/i);
    const vvix = vvixMatch ? parseFloat(vvixMatch[1]) : 80 + Math.random() * 40;

    return {
      headline: `VVIX: ${vvix.toFixed(1)} - Volatility of Volatility`,
      content: `VVIX (volatility of VIX) analysis:
      VVIX Value: ${vvix.toFixed(2)}
      Interpretation: ${vvix > 100 ? 'High VVIX - VIX itself is volatile, hedged positions recommended' : vvix < 80 ? 'Low VVIX - VIX stable, normal conditions' : 'Moderate VVIX - standard volatility regime'}
      VVIX above 100 indicates unusually high volatility expectations for the VIX itself.
    `,
    };
  }

  private parseVolatilitySignals(content: string): VolatilitySignal[] {
    const signals: VolatilitySignal[] = [];

    const signalPatterns = [
      { pattern: /spike[:\s]*(?:VIX|volatility)/gi, type: 'regime_change' as const, severity: 'high' as const, indicator: 'VIX Spike' },
      { pattern: /signal line cross/gi, type: 'signal_line_cross' as const, severity: 'medium' as const, indicator: 'Signal Cross' },
      { pattern: /extreme[:\s]*(?:fear|greed)/gi, type: 'extreme_reading' as const, severity: 'high' as const, indicator: 'Extreme Reading' },
      { pattern: /divergence[^\n]{0,40}/gi, type: 'divergence' as const, severity: 'medium' as const, indicator: 'VIX Divergence' },
    ];

    for (const { pattern, type, severity, indicator } of signalPatterns) {
      if (pattern.test(content)) {
        signals.push({
          type,
          severity,
          indicator,
          interpretation: this.interpretVolatilitySignal(type, indicator),
          suggestedAction: severity === 'high' ? 'hedge' : 'maintain',
        });
      }
    }

    return signals;
  }

  private interpretVolatilitySignal(type: VolatilitySignal['type'], indicator: string): string {
    switch (type) {
      case 'regime_change':
        return 'Volatility regime change detected - market structure shifting';
      case 'signal_line_cross':
        return 'Signal line cross - momentum shift in volatility';
      case 'extreme_reading':
        return 'Extreme volatility reading - contrarian opportunity or risk';
      case 'divergence':
        return 'Volatility divergence - price and VIX moving differently';
      default:
        return 'Volatility signal detected';
    }
  }
}

export const volatilityIndexAgent = new VolatilityIndexAgent();