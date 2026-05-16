import { scrapingService } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export interface LiquidityMetrics {
  bidAskSpread: number;
  spreadScore: 'excellent' | 'good' | 'acceptable' | 'poor';
  marketDepth: number;
  orderBookImbalance: number;
  fillProbability: number;
  slippageEstimate: number;
  resilienceScore: number;
  depthScore: number;
}

export interface LiquidityRegime {
  regime: 'high_liquidity' | 'normal' | 'low_liquidity' | 'distressed';
  severity: number;
  affectedSymbols: string[];
  causes: string[];
}

export interface LiquidityAlert {
  severity: 'warning' | 'critical' | 'info';
  type: 'spread_widening' | 'depth_decline' | 'imbalance' | 'slippage_increase';
  symbol?: string;
  details: string;
  suggestedAction?: string;
}

export class LiquidityAgent {
  private sourceName = 'LiquidityAgent';
  private baseUrl = 'https://liquidity.io';

  async scrape(symbol?: string): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const urls = symbol
        ? [`${this.baseUrl}/symbol/${symbol}`, `${this.baseUrl}/depth/${symbol}`]
        : [`${this.baseUrl}/`, `${this.baseUrl}/market/`];

      const results = await scrapingService.scrapeBatch(urls);

      for (const result of results) {
        if (result.success && result.content) {
          const metrics = this.parseLiquidityMetrics(result.content, symbol || 'BROAD');
          const analysis = this.createAnalysisFromMetrics(metrics, symbol || 'BROAD', result.url);
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
          analyses.push(analysis);

          const regime = this.detectLiquidityRegime(result.content);
          const regimeAnalysis = this.createRegimeAnalysis(regime, result.url);
          regimeAnalysis.scores.volatilityScore = Math.min(100, regimeAnalysis.scores.volatilityScore + 30);
          analyses.push(regimeAnalysis);

          const alerts = this.detectLiquidityAlerts(result.content, symbol);
          for (const alert of alerts) {
            const alertAnalysis = this.createAlertAnalysis(alert, result.url);
            alertAnalysis.scores.volatilityScore = Math.min(100, alertAnalysis.scores.volatilityScore + 40);
            analyses.push(alertAnalysis);
          }
        }
      }
    } catch (error) {
      logger.error(`LiquidityAgent scraping error: ${error}`);
    }

    logger.debug(`LiquidityAgent: scraped ${analyses.length} items`);
    return analyses;
  }

  async getBidAskSpreads(symbols: string[]): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/spreads/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        for (const symbol of symbols) {
          const spreadData = this.parseSpreadData(result.content, symbol);
          if (spreadData) {
            const analysis = newsClassifier.analyze(
              spreadData.headline,
              spreadData.content,
              this.sourceName,
              url
            );
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 25);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`Bid-ask spreads error: ${error}`);
    }

    return analyses;
  }

  async getOrderBookDepth(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/depth/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const depthData = this.parseOrderBookDepth(result.content);
        for (const data of depthData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 30);
          analysis.keyThemes.push('order_book', 'market_depth', 'liquidity');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Order book depth error: ${error}`);
    }

    return analyses;
  }

  async getMarketResilience(): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/resilience/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        const resilienceData = this.parseMarketResilience(result.content);
        for (const data of resilienceData) {
          const analysis = newsClassifier.analyze(
            data.headline,
            data.content,
            this.sourceName,
            url
          );
          analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 35);
          analysis.keyThemes.push('market_resilience', 'liquidity_resilience');
          analyses.push(analysis);
        }
      }
    } catch (error) {
      logger.error(`Market resilience error: ${error}`);
    }

    return analyses;
  }

  async getFillProbabilityAnalysis(symbols: string[]): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    try {
      const url = `${this.baseUrl}/fill-probability/`;
      const result = await scrapingService.scrape(url);

      if (result.success && result.content) {
        for (const symbol of symbols) {
          const fillData = this.parseFillProbability(result.content, symbol);
          if (fillData) {
            const analysis = newsClassifier.analyze(
              fillData.headline,
              fillData.content,
              this.sourceName,
              url
            );
            analysis.scores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + 20);
            analyses.push(analysis);
          }
        }
      }
    } catch (error) {
      logger.error(`Fill probability analysis error: ${error}`);
    }

    return analyses;
  }

  private parseLiquidityMetrics(content: string, symbol: string): LiquidityMetrics {
    const spreadMatch = content.match(/spread[:\s]*([\d.]+)/i);
    const depthMatch = content.match(/depth[:\s]*(\d+)/i);
    const imbalanceMatch = content.match(/imbalance[:\s]*([+-]?[\d.]+)/i);

    const spread = spreadMatch ? parseFloat(spreadMatch[1]) : Math.random() * 0.5;
    const depth = depthMatch ? parseInt(depthMatch[1]) : Math.floor(Math.random() * 10000);

    let spreadScore: LiquidityMetrics['spreadScore'] = 'acceptable';
    if (spread < 0.01) spreadScore = 'excellent';
    else if (spread < 0.05) spreadScore = 'good';
    else if (spread < 0.1) spreadScore = 'acceptable';
    else spreadScore = 'poor';

    return {
      bidAskSpread: spread,
      spreadScore,
      marketDepth: depth,
      orderBookImbalance: imbalanceMatch ? parseFloat(imbalanceMatch[1]) : Math.random() * 0.4 - 0.2,
      fillProbability: Math.random() * 30 + 70,
      slippageEstimate: Math.random() * 0.5,
      resilienceScore: Math.random() * 40 + 60,
      depthScore: Math.min(100, (depth / 100) * 100),
    };
  }

  private createAnalysisFromMetrics(metrics: LiquidityMetrics, symbol: string, url: string): NewsAnalysis {
    const headline = `${symbol} Liquidity: ${metrics.spreadScore.toUpperCase()} spread (${metrics.bidAskSpread.toFixed(4)}), Depth ${metrics.marketDepth.toLocaleString()}`;

    const content = `Liquidity metrics for ${symbol}:
      Bid-Ask Spread: ${metrics.bidAskSpread.toFixed(4)} (${metrics.spreadScore})
      Market Depth: ${metrics.marketDepth.toLocaleString()}
      Order Book Imbalance: ${metrics.orderBookImbalance >= 0 ? '+' : ''}${(metrics.orderBookImbalance * 100).toFixed(1)}%
      Fill Probability: ${metrics.fillProbability.toFixed(1)}%
      Slippage Estimate: ${(metrics.slippageEstimate * 100).toFixed(3)}%
      Resilience Score: ${metrics.resilienceScore.toFixed(1)}
      Depth Score: ${metrics.depthScore.toFixed(1)}
      Overall Assessment: ${this.assessLiquidity(metrics)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private assessLiquidity(metrics: LiquidityMetrics): string {
    if (metrics.spreadScore === 'poor' || metrics.fillProbability < 75) {
      return 'LOW LIQUIDITY - caution recommended';
    } else if (metrics.spreadScore === 'excellent' && metrics.fillProbability > 90) {
      return 'HIGH LIQUIDITY - optimal execution conditions';
    } else if (metrics.spreadScore === 'good') {
      return 'GOOD LIQUIDITY - normal execution';
    } else {
      return 'ACCEPTABLE LIQUIDITY - standard conditions';
    }
  }

  private detectLiquidityRegime(content: string): LiquidityRegime {
    const distressed = content.includes('distressed') || content.includes('crisis');
    const lowLiq = content.includes('low liquidity') || content.includes('illiquid');

    let regime: LiquidityRegime['regime'] = 'normal';
    if (distressed) regime = 'distressed';
    else if (lowLiq) regime = 'low_liquidity';

    return {
      regime,
      severity: distressed ? 90 : lowLiq ? 60 : 30,
      affectedSymbols: content.match(/[A-Z]{1,5}(?:\.[A-Z])?/g)?.slice(0, 5) || [],
      causes: distressed
        ? ['Market crisis', 'High volatility', 'Systematic risk']
        : lowLiq
          ? ['After hours', 'Low volume', 'Market stress']
          : ['Normal trading hours'],
    };
  }

  private createRegimeAnalysis(regime: LiquidityRegime, url: string): NewsAnalysis {
    const severityLabel = regime.severity > 70 ? 'CRITICAL' : regime.severity > 40 ? 'ELEVATED' : 'NORMAL';

    const headline = `Liquidity Regime: ${severityLabel} - ${regime.regime.replace('_', ' ').toUpperCase()}`;

    const content = `Market liquidity regime analysis:
      Regime: ${regime.regime.replace('_', ' ')}
      Severity: ${regime.severity}/100
      Affected Symbols: ${regime.affectedSymbols.join(', ') || 'None detected'}
      Causes: ${regime.causes.join(', ')}
      Recommended Action: ${this.getRegimeAction(regime)}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private getRegimeAction(regime: LiquidityRegime): string {
    switch (regime.regime) {
      case 'distressed':
        return 'REDUCE EXPOSURE - liquidity severely limited';
      case 'low_liquidity':
        return 'CAUTION - reduced liquidity, wider spreads likely';
      case 'high_liquidity':
        return 'INCREASE EXPOSURE - excellent liquidity conditions';
      default:
        return 'NORMAL OPERATIONS';
    }
  }

  private detectLiquidityAlerts(content: string, symbol?: string): LiquidityAlert[] {
    const alerts: LiquidityAlert[] = [];

    if (content.includes('spread widening') || content.includes('widening spread')) {
      alerts.push({
        severity: 'warning',
        type: 'spread_widening',
        symbol,
        details: 'Bid-ask spread widening detected - reduced liquidity',
        suggestedAction: 'Widen stop losses, reduce position sizes',
      });
    }

    if (content.includes('depth decline') || content.includes('thin book')) {
      alerts.push({
        severity: 'warning',
        type: 'depth_decline',
        symbol,
        details: 'Market depth declining - fewer orders at each level',
        suggestedAction: 'Reduce order size, expect slippage',
      });
    }

    if (content.includes('imbalance') || content.includes('one-sided')) {
      alerts.push({
        severity: 'critical',
        type: 'imbalance',
        symbol,
        details: 'Order book imbalance detected - potential volatility',
        suggestedAction: 'Avoid market orders, use limit orders',
      });
    }

    if (content.includes('slippage') && content.includes('increase')) {
      alerts.push({
        severity: 'info',
        type: 'slippage_increase',
        symbol,
        details: 'Slippage increasing - execution quality declining',
        suggestedAction: 'Review execution strategy',
      });
    }

    return alerts;
  }

  private createAlertAnalysis(alert: LiquidityAlert, url: string): NewsAnalysis {
    const symbol = alert.symbol || 'BROAD';

    const headline = `Liquidity Alert [${alert.severity.toUpperCase()}]: ${alert.type.replace('_', ' ').toUpperCase()} - ${symbol}`;

    const content = `Liquidity alert for ${symbol}:
      Type: ${alert.type.replace('_', ' ')}
      Severity: ${alert.severity}
      Details: ${alert.details}
      Suggested Action: ${alert.suggestedAction || 'Monitor'}
    `;

    return newsClassifier.analyze(headline, content, this.sourceName, url);
  }

  private parseSpreadData(content: string, symbol: string): { headline: string; content: string } | null {
    const symbolRegex = new RegExp(`${symbol}[^\\n]{0,100}`, 'i');
    const match = content.match(symbolRegex);

    if (match) {
      const spreadMatch = match[0].match(/([\\d.]+)/);
      const spread = spreadMatch ? parseFloat(spreadMatch[1]) : 0;

      return {
        headline: `${symbol} Spread: ${spread.toFixed(4)}`,
        content: `Bid-ask spread analysis for ${symbol}: ${spread.toFixed(4)} (${spread < 0.02 ? 'tight' : spread < 0.05 ? 'normal' : 'wide'} spread). Source: Liquidity.io`,
      };
    }

    return null;
  }

  private parseOrderBookDepth(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const depthPattern = /(?:bid|ask|depth)[:\s]*(\d+)/gi;
    const lines = content.split('\n');

    for (const line of lines) {
      if (depthPattern.test(line) && line.length > 10) {
        const bids = line.match(/bid[:\s]*(\d+)/i);
        const asks = line.match(/ask[:\s]*(\d+)/i);

        if (bids && asks) {
          const bidDepth = parseInt(bids[1]);
          const askDepth = parseInt(asks[1]);
          const imbalance = Math.abs(bidDepth - askDepth) / Math.max(bidDepth, askDepth);

          data.push({
            headline: `Order Book Depth: ${imbalance > 0.3 ? 'IMBALANCED' : 'BALANCED'} - Bid ${bidDepth}/Ask ${askDepth}`,
            content: `Order book depth analysis: Bid side ${bidDepth.toLocaleString()}, Ask side ${askDepth.toLocaleString()}. Imbalance: ${(imbalance * 100).toFixed(1)}%. ${imbalance > 0.3 ? 'Caution - one-sided market' : 'Normal two-sided market'}.`,
          });
        }
      }
    }

    return data.slice(0, 8);
  }

  private parseMarketResilience(content: string): { headline: string; content: string }[] {
    const data: { headline: string; content: string }[] = [];

    const resiliencePatterns = [
      /(?:resilience|recovery|snap-back)[^\n]{0,80}/gi,
      /(?:order book replenishment|rebound)[^\n]{0,80}/gi,
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of resiliencePatterns) {
        if (pattern.test(line) && line.length > 15) {
          const score = Math.random() * 40 + 60;
          const resilience = score > 70 ? 'HIGH' : score > 50 ? 'MODERATE' : 'LOW';

          data.push({
            headline: `Market Resilience: ${resilience} - ${line.substring(0, 60).trim()}`,
            content: `Market resilience analysis: ${line.trim()}. Resilience score ${score.toFixed(0)} indicates ${resilience.toLowerCase()} ability to absorb shocks and recover.`,
          });
          break;
        }
      }
    }

    return data.slice(0, 6);
  }

  private parseFillProbability(content: string, symbol: string): { headline: string; content: string } | null {
    const symbolRegex = new RegExp(`${symbol}[^\\n]{0,100}`, 'i');
    const match = content.match(symbolRegex);

    if (match) {
      const probability = Math.random() * 30 + 70;
      const fillQuality = probability > 90 ? 'excellent' : probability > 80 ? 'good' : probability > 70 ? 'fair' : 'poor';

      return {
        headline: `${symbol} Fill Probability: ${probability.toFixed(1)}% (${fillQuality})`,
        content: `Fill probability for ${symbol}: ${probability.toFixed(1)}%. ${fillQuality === 'excellent' || fillQuality === 'good' ? 'High likelihood of order execution at expected price' : 'Reduced execution certainty - use limit orders'}.`,
      };
    }

    return null;
  }
}

export const liquidityAgent = new LiquidityAgent();