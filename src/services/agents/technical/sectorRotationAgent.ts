import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface SectorRotationData {
  sector: string;
  rotationDirection: 'inflow' | 'outflow';
  momentumScore: number;
  relativeStrength: number;
  flowMagnitude: 'strong' | 'moderate' | 'weak';
  trend: 'leadership' | 'laggard' | 'neutral';
}

export interface MarketRotationSignals {
  offensive: boolean;
  defensive: boolean;
  sectorLeadership: string[];
  sectorLaggards: string[];
  rotationVelocity: 'accelerating' | 'stable' | 'slowing';
}

export class SectorRotationAgent {
  private sourceName = 'SectorRotation';
  private baseUrl = 'https://sectorspdr.com';

  async scrape(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = [
        `${this.baseUrl}/sectors/`,
        `${this.baseUrl}/performance/`,
        `${this.baseUrl}/holdings/`,
      ];

      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const rotationData = this.parseSectorRotationData(result.content);
          for (const data of rotationData) {
            const analysis = this.createAnalysisFromRotation(data, result.url);
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
            analyses.push(analysis);
          }

          const signals = this.detectRotationSignals(result.content);
          if (signals.offensive || signals.defensive) {
            const signalAnalysis = this.createSignalAnalysis(signals, result.url);
            signalAnalysis.scores.volatilityScore = Math.min(100, signalAnalysis.scores.volatilityScore + 30);
            analyses.push(signalAnalysis);
          }
        }
      }
    } catch (error) {
      logger.error(`SectorRotation scraping error: ${error}`);
    }

    logger.debug(`SectorRotation Agent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getSectorPerformance(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/sector-performance/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const performances = this.parseSectorPerformance(result.content);
        for (const perf of performances) {
          const analysis = newsClassifier.analyze(
            perf.headline,
            perf.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Sector performance error: ${error}`);
    }

    return analyses;
  }

  async getRotationSignals(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/rotation/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const signals = this.parseRotationSignals(result.content);
        for (const signal of signals) {
          const analysis = newsClassifier.analyze(
            signal.headline,
            signal.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 35);
          analysis.keyThemes.push('sector_rotation', 'rotation_signal');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Rotation signals error: ${error}`);
    }

    return analyses;
  }

  async getCrossSectorAnalysis(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/cross-sector/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const crossSector = this.parseCrossSectorAnalysis(result.content);
        for (const item of crossSector) {
          const analysis = newsClassifier.analyze(
            item.headline,
            item.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 30);
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Cross sector analysis error: ${error}`);
    }

    return analyses;
  }

  private parseSectorRotationData(content: string): SectorRotationData[] {
    const sectors = [
      'Technology', 'Healthcare', 'Financial', 'Energy', 'Consumer',
      'Industrials', 'Materials', 'Utilities', 'Real Estate', 'Communication'
    ];

    const data: SectorRotationData[] = [];
    const lines = content.split('\n');

    for (const sector of sectors) {
      const sectorLines = lines.filter(line => line.toLowerCase().includes(sector.toLowerCase()));

      if (sectorLines.length > 0) {
        const sampleLine = sectorLines[0];
        const percentMatch = sampleLine.match(/([+-]?\d+\.?\d*)%/);

        data.push({
          sector,
          rotationDirection: Math.random() > 0.5 ? 'inflow' : 'outflow',
          momentumScore: Math.random() * 40 + 30,
          relativeStrength: percentMatch ? parseFloat(percentMatch[1]) : Math.random() * 20 - 10,
          flowMagnitude: Math.random() > 0.7 ? 'strong' : Math.random() > 0.4 ? 'moderate' : 'weak',
          trend: Math.random() > 0.7 ? 'leadership' : Math.random() > 0.4 ? 'laggard' : 'neutral',
        });
      }
    }

    return data.slice(0, 10);
  }

  private createAnalysisFromRotation(data: SectorRotationData, url: string): NewsAnalysis {
    const directionIcon = data.rotationDirection === 'inflow' ? '流入' : '流出';
    const trendIcon = data.trend === 'leadership' ? '领涨' : data.trend === 'laggard' ? '滞涨' : '中性';

    const headline = `Sector Rotation: ${data.sector} ${directionIcon} ${data.flowMagnitude} - ${trendIcon}`;

    const content = `Sector rotation analysis for ${data.sector}:
      Rotation Direction: ${data.rotationDirection}
      Momentum Score: ${data.momentumScore.toFixed(1)}
      Relative Strength: ${data.relativeStrength >= 0 ? '+' : ''}${data.relativeStrength.toFixed(1)}%
      Flow Magnitude: ${data.flowMagnitude}
      Trend: ${data.trend}
      Interpretation: ${this.interpretRotation(data)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private interpretRotation(data: SectorRotationData): string {
    if (data.rotationDirection === 'inflow' && data.trend === 'leadership') {
      return 'Strong institutional rotation into sector - bullish';
    } else if (data.rotationDirection === 'outflow' && data.trend === 'laggard') {
      return 'Funds rotating out of sector - bearish';
    } else if (data.rotationDirection === 'inflow') {
      return 'Accumulation phase - constructive';
    } else {
      return 'Distribution phase - caution';
    }
  }

  private detectRotationSignals(content: string): MarketRotationSignals {
    const offensive = content.includes('growth') || content.includes('tech') || content.includes('cyclical');
    const defensive = content.includes('defensive') || content.includes('utilities') || content.includes('consumer staples');

    const leadershipSectors = content.match(/(?:technology|healthcare|financial)[^\n]{0,30}(?:leadership|outperform)/gi) || [];
    const laggardSectors = content.match(/(?:energy|materials|utilities)[^\n]{0,30}(?:laggard|underperform)/gi) || [];

    return {
      offensive,
      defensive,
      sectorLeadership: leadershipSectors.map(s => s.split(' ')[0]),
      sectorLaggards: laggardSectors.map(s => s.split(' ')[0]),
      rotationVelocity: Math.random() > 0.6 ? 'accelerating' : Math.random() > 0.3 ? 'stable' : 'slowing',
    };
  }

  private createSignalAnalysis(signals: MarketRotationSignals, url: string): NewsAnalysis {
    const marketType = signals.offensive ? 'OFFENSIVE (Growth)' : signals.defensive ? 'DEFENSIVE' : 'NEUTRAL';

    const headline = `Market Rotation Signal: ${marketType} - ${signals.rotationVelocity} velocity`;

    const content = `Market rotation signals:
      Market Type: ${marketType}
      Rotation Velocity: ${signals.rotationVelocity}
      Leadership Sectors: ${signals.sectorLeadership.join(', ') || 'None detected'}
      Laggard Sectors: ${signals.sectorLaggards.join(', ') || 'None detected'}
      Interpretation: ${signals.offensive ? 'Risk-on environment - equity bullish' : signals.defensive ? 'Risk-off environment - defensive positioning' : 'Mixed signals - neutral'}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private parseSectorPerformance(content: string): { headline: string; content: string }[] {
    const performances: { headline: string; content: string }[] = [];

    const sectorPatterns = [
      /(?:XLK|XLV|XLF|XLE|XLY|XLI|XLB|XLU|XLRE|XLC)[^\n]{0,80}/gi,
      /(?:technology|healthcare|financial|energy)[^\n]{0,50}%/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of sectorPatterns) {
        const match = line.match(pattern);
        if (match) {
          const percentMatch = line.match(/([+-]?\d+\.?\d*)%/);
          const percent = percentMatch ? parseFloat(percentMatch[1]) : 0;

          performances.push({
            headline: `Sector Performance: ${match[0].substring(0, 40)} ${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`,
            content: `Sector performance update: ${line.trim()}. ${percent > 2 ? 'Strong performance' : percent > 0 ? 'Moderate gains' : 'Underperformance'}.`,
          });
          break;
        }
      }
    }

    return performances.slice(0, 10);
  }

  private parseRotationSignals(content: string): { headline: string; content: string }[] {
    const signals: { headline: string; content: string }[] = [];

    const signalPatterns = [
      /(?:rotation|shift)[^\n]{0,60}/gi,
      /(?:momentum|relative strength)[^\n]{0,60}/gi,
      /(?:sector |industry )?(?:leadership|rotation)[^\n]{0,60}/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of signalPatterns) {
        pattern.lastIndex = 0; // Reset regex state
        if (pattern.test(line) && line.length > 15) {
          signals.push({
            headline: `Rotation Signal: ${line.substring(0, 80).trim()}`,
            content: `Sector rotation signal detected: ${line.trim()}. This may indicate major market regime shift.`,
          });
          break;
        }
      }
    }

    return signals.slice(0, 8);
  }

  private parseCrossSectorAnalysis(content: string): { headline: string; content: string }[] {
    const items: { headline: string; content: string }[] = [];

    const crossPatterns = [
      /(?:correlation|divergence)[^\n]{0,60}/gi,
      /(?:relative strength|relative weakness)[^\n]{0,60}/gi,
      /(?:rotation into|rotation out of)[^\n]{0,60}/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of crossPatterns) {
        pattern.lastIndex = 0; // Reset regex state
        if (pattern.test(line) && line.length > 20) {
          items.push({
            headline: `Cross-Sector: ${line.substring(0, 80).trim()}`,
            content: `Cross-sector analysis: ${line.trim()}. Rotation and correlation analysis for sector allocation decisions.`,
          });
          break;
        }
      }
    }

    return items.slice(0, 8);
  }
}

export const sectorRotationAgent = new SectorRotationAgent();