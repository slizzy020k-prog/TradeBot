import { MarketData } from '../../types';
import { logger } from '../../utils/logger';

export interface MomentumAnalysisResult {
  score: number;
  rsi: number;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  macdStrength: number;
  divergenceDetected: boolean;
  breakoutConfirmed: boolean;
  strengthConsistency: number;
  details: string;
}

export class MomentumAgent {
  analyze(marketData: MarketData, historicalData?: MarketData[]): MomentumAnalysisResult {
    const rsi = this.calculateRSI(marketData, historicalData);
    const macd = this.calculateMACD(historicalData);
    const divergence = this.detectDivergence(marketData, historicalData);
    const breakout = this.confirmBreakout(marketData, historicalData);
    const consistency = this.evaluateStrengthConsistency(historicalData);

    const score = this.computeScore(rsi, macd, divergence, breakout, consistency);

    const result: MomentumAnalysisResult = {
      score,
      rsi,
      macdSignal: macd.signal,
      macdStrength: macd.strength,
      divergenceDetected: divergence,
      breakoutConfirmed: breakout.confirmed,
      strengthConsistency: consistency,
      details: `RSI: ${rsi.toFixed(0)}, MACD: ${macd.signal} (${macd.strength.toFixed(0)}%), ` +
        `Divergence: ${divergence}, Breakout: ${breakout.confirmed}, ` +
        `Consistency: ${consistency.toFixed(0)}%`,
    };

    logger.debug(`Momentum Agent: score=${score.toFixed(0)}, RSI=${rsi.toFixed(0)}`);
    return result;
  }

  private calculateRSI(md: MarketData, historical?: MarketData[]): number {
    if (!historical || historical.length < 14) {
      const change = md.close && md.open ? ((md.close - md.open) / md.open) * 100 : 0;
      return 50 + change * 5;
    }

    const closes = historical.slice(-14).map(h => h.close).filter((c): c is number => c !== undefined);
    const lastPrice = md.close ?? md.price ?? 0;
    if (closes.length === 0) return 50 + ((lastPrice - (md.open || lastPrice)) / (md.open || lastPrice || 1)) * 100;
    closes.push(lastPrice);

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains.push(change);
      else losses.push(Math.abs(change));
    }

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(historical?: MarketData[]): { signal: 'bullish' | 'bearish' | 'neutral'; strength: number } {
    if (!historical || historical.length < 26) {
      return { signal: 'neutral', strength: 50 };
    }

    const closes = historical.slice(-26).map(h => h.close).filter((c): c is number => c !== undefined);
    if (closes.length < 26) {
      return { signal: 'neutral', strength: 50 };
    }

    const ema12 = this.calculateEMA(closes.slice(-12), 12);
    const ema26 = this.calculateEMA(closes, 26);

    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA([...closes.slice(-9), macdLine], 9);

    const histogram = macdLine - signalLine;

    const signal: 'bullish' | 'bearish' | 'neutral' =
      histogram > 0 ? 'bullish' : histogram < 0 ? 'bearish' : 'neutral';

    const strength = Math.min(100, Math.abs(histogram) * 100);

    return { signal, strength };
  }

  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  private detectDivergence(md: MarketData, historical?: MarketData[]): boolean {
    if (!historical || historical.length < 20) return false;

    const recentPrices = historical.slice(-10).map(h => h.close || h.price);
    const currentPrice = md.close || md.price;

    const priceTrend = currentPrice > recentPrices[0] ? 'up' : 'down';

    const rsi = this.calculateRSI(md, historical);
    const rsiTrend = rsi > 50 ? 'up' : 'down';

    return priceTrend !== rsiTrend;
  }

  private confirmBreakout(md: MarketData, historical?: MarketData[]): { confirmed: boolean; type?: string } {
    if (!historical || historical.length < 5) return { confirmed: false };

    const recent = historical.slice(-5);
    const highs = recent.map(h => h.high || h.price);
    const lows = recent.map(h => h.low || h.price);
    const avgRange = highs.reduce((a, h, i) => a + (h - lows[i]), 0) / highs.length;

    const currentHigh = md.high || md.price;
    const currentLow = md.low || md.price;

    if (currentHigh > Math.max(...highs) * 1.01) {
      return { confirmed: true, type: 'bullish_breakout' };
    }
    if (currentLow < Math.min(...lows) * 0.99) {
      return { confirmed: true, type: 'bearish_breakout' };
    }

    const range = (md.high || md.price) - (md.low || md.price);
    if (range > avgRange * 1.5) {
      return { confirmed: true, type: 'volatility_breakout' };
    }

    return { confirmed: false };
  }

  private evaluateStrengthConsistency(historical?: MarketData[]): number {
    if (!historical || historical.length < 5) return 50;

    const momentumValues = historical.slice(-5).map((h, i, arr) => {
      if (i === 0) return 0;
      const prev = arr[i - 1].close || arr[i - 1].price;
      return (h.close || h.price) - prev;
    }).filter(v => v !== 0);

    if (momentumValues.length < 2) return 50;

    const positiveCount = momentumValues.filter(v => v > 0).length;
    const consistency = (positiveCount / momentumValues.length) * 100;

    const avgMomentum = momentumValues.reduce((a, b) => a + b, 0) / momentumValues.length;
    const magnitudeScore = Math.min(100, Math.abs(avgMomentum) * 10);

    return (consistency + magnitudeScore) / 2;
  }

  private computeScore(
    rsi: number,
    macd: { signal: string; strength: number },
    divergence: boolean,
    breakout: { confirmed: boolean; type?: string },
    consistency: number
  ): number {
    let score = 50;

    if (rsi >= 40 && rsi <= 60) score += 15;
    else if (rsi > 30 && rsi < 70) score += 10;
    else if (rsi <= 30 || rsi >= 70) score -= 10;

    switch (macd.signal) {
      case 'bullish': score += macd.strength * 0.15; break;
      case 'bearish': score -= macd.strength * 0.10; break;
    }

    if (divergence) score -= 15;

    if (breakout.confirmed) score += 20;

    score += consistency * 0.20;

    return Math.min(100, Math.max(0, score));
  }
}

export const momentumAgent = new MomentumAgent();