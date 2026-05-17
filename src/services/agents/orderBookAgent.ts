import { MarketData } from '../../types';
import { logger } from '../../utils/logger';

export interface OrderBookAnalysisResult {
  score: number;
  bidAskSpread: number;
  spreadQuality: 'tight' | 'moderate' | 'wide';
  orderImbalanceScore: number;
  liquidityZone: 'high' | 'medium' | 'low';
  spoofingIndicators: string[];
  manipulationRisk: number;
  details: string;
}

export class OrderBookAgent {
  analyze(marketData: MarketData, historicalData?: MarketData[]): OrderBookAnalysisResult {
    const spread = this.calculateBidAskSpread(marketData);
    const spreadQuality = this.evaluateSpreadQuality(spread, marketData.price);
    const imbalance = this.calculateOrderImbalance(marketData, historicalData);
    const liquidity = this.evaluateLiquidity(marketData, historicalData);
    const spoofing = this.detectSpoofingPatterns(marketData, historicalData);
    const manipulationRisk = this.assessManipulationRisk(spread, imbalance, spoofing);

    const score = Math.min(100, Math.max(0,
      spreadQuality.score * 0.25 +
      liquidity.score * 0.25 +
      (100 - Math.abs(imbalance)) * 0.20 +
      (100 - manipulationRisk) * 0.15 +
      (spoofing.length === 0 ? 100 : 50) * 0.15
    ));

    const result: OrderBookAnalysisResult = {
      score,
      bidAskSpread: spread,
      spreadQuality: spreadQuality.label,
      orderImbalanceScore: imbalance,
      liquidityZone: liquidity.label,
      spoofingIndicators: spoofing,
      manipulationRisk,
      details: `Spread: ${spreadQuality.label} (${spread.toFixed(4)}), ` +
        `Imbalance: ${imbalance > 0 ? 'Buy' : 'Sell'} pressure ${Math.abs(imbalance).toFixed(0)}%, ` +
        `Liquidity: ${liquidity.label}, ` +
        `Spoofing indicators: ${spoofing.length > 0 ? spoofing.join(', ') : 'None detected'}, ` +
        `Manipulation risk: ${manipulationRisk.toFixed(0)}%`,
    };

    logger.debug(`Order Book Agent: score=${score.toFixed(0)}, spread=${spread.toFixed(4)}, imbalance=${imbalance.toFixed(0)}`);
    return result;
  }

  private calculateBidAskSpread(md: MarketData): number {
    if (md.high && md.low && md.high > 0) {
      return md.high - md.low;
    }
    return md.price * 0.001;
  }

  private evaluateSpreadQuality(spread: number, price: number): { score: number; label: 'tight' | 'moderate' | 'wide' } {
    const spreadPct = (spread / price) * 100;

    if (spreadPct < 0.05) {
      return { score: 95, label: 'tight' };
    } else if (spreadPct < 0.10) {
      return { score: 75, label: 'moderate' };
    } else if (spreadPct < 0.20) {
      return { score: 50, label: 'wide' };
    } else {
      return { score: 25, label: 'wide' };
    }
  }

  private calculateOrderImbalance(md: MarketData, historical?: MarketData[]): number {
    const volume = md.volume || 0;
    const priceChange = md.close && md.open ? ((md.close - md.open) / md.open) * 100 : 0;

    let baseImbalance = priceChange * 10;

    if (historical && historical.length >= 5) {
      const recentVolume = historical.slice(-5).reduce((sum, h) => sum + (h.volume || 0), 0);
      const avgVolume = recentVolume / 5;
      const volumeRatio = volume / (avgVolume || 1);

      if (volumeRatio > 2) {
        baseImbalance *= 1.5;
      }
    }

    return Math.max(-100, Math.min(100, baseImbalance));
  }

  private evaluateLiquidity(md: MarketData, historical?: MarketData[]): { score: number; label: 'high' | 'medium' | 'low' } {
    const volume = md.volume || 0;
    const price = md.price;

    let liquidityScore = 50;

    if (volume > 10000000 && price < 100) liquidityScore = 95;
    else if (volume > 5000000) liquidityScore = 80;
    else if (volume > 1000000) liquidityScore = 60;
    else if (volume > 100000) liquidityScore = 40;
    else liquidityScore = 20;

    if (historical && historical.length >= 20) {
      const avgVolume = historical.reduce((sum, h) => sum + (h.volume || 0), 0) / historical.length;
      const volumeRatio = volume / avgVolume;

      if (volumeRatio > 0.8 && volumeRatio < 1.2) {
        liquidityScore = Math.min(100, liquidityScore + 10);
      } else if (volumeRatio < 0.5 || volumeRatio > 2) {
        liquidityScore = Math.max(0, liquidityScore - 20);
      }
    }

    const label = liquidityScore >= 70 ? 'high' : liquidityScore >= 40 ? 'medium' : 'low';
    return { score: liquidityScore, label };
  }

  private detectSpoofingPatterns(md: MarketData, historical?: MarketData[]): string[] {
    const indicators: string[] = [];

    if (!historical || historical.length < 10) return indicators;

    const recent = historical.slice(-5);
    const priceChanges = recent.map((h, i) => {
      const prev = i > 0 ? recent[i - 1] : h;
      const hClose = h.close ?? h.price;
      const prevClose = prev.close ?? prev.price ?? hClose;
      return ((hClose - prevClose) / prevClose) * 100;
    });

    const volumeSpikes = recent.filter(h => (h.volume || 0) > 2000000);
    if (volumeSpikes.length >= 3) {
      const avgPriceChange = Math.abs(priceChanges.slice(-3).reduce((a, b) => a + b, 0) / 3);
      if (avgPriceChange < 0.5) {
        indicators.push('High volume without price movement - possible spoofing');
      }
    }

    const consecutiveUp = priceChanges.slice(-3).filter(p => p > 0.5).length;
    const consecutiveDown = priceChanges.slice(-3).filter(p => p < -0.5).length;

    if (consecutiveUp === 3 || consecutiveDown === 3) {
      const lastPriceChange = Math.abs(priceChanges[priceChanges.length - 1]);
      if (lastPriceChange < 0.2) {
        indicators.push('Price direction reversal after sustained move - possible spoofing');
      }
    }

    return indicators;
  }

  private assessManipulationRisk(spread: number, imbalance: number, spoofingIndicators: string[]): number {
    let risk = 30;

    if (spread > 0.10) risk += 20;
    else if (spread > 0.05) risk += 10;

    if (Math.abs(imbalance) > 50) risk += 25;
    else if (Math.abs(imbalance) > 30) risk += 15;

    if (spoofingIndicators.length >= 2) risk += 30;
    else if (spoofingIndicators.length >= 1) risk += 15;

    return Math.min(100, risk);
  }
}

export const orderBookAgent = new OrderBookAgent();