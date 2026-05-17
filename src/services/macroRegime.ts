import { MacroRegime } from '../types';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';

interface RegimeIndicators {
  vix: number;
  treasury10y: number;
  gold: number;
  dollarIndex: number;
  riskOnAssets: number[];
  riskOffAssets: number[];
}

interface RegimeSignal {
  regime: MacroRegime;
  confidence: number;
  triggers: string[];
}

export class MacroRegimeService {
  private lastRegime: MacroRegime = 'normal';
  private regimeHistory: Array<{ regime: MacroRegime; timestamp: number }> = [];

  async detectRegime(): Promise<MacroRegime> {
    try {
      const [vixData, treasuryData, goldData, dollarData] = await Promise.all([
        this.getSafeQuote('VIX'),
        this.getSafeQuote('^TNX'),
        this.getSafeQuote('GC=F'),
        this.getSafeQuote('DXY'),
      ]);

      const riskOnData = await marketDataService.getQuotes(['SPY', 'QQQ', 'IWM']);
      const riskOffData = await marketDataService.getQuotes(['TLT', 'GLD']);

      const indicators: RegimeIndicators = {
        vix: vixData?.price || 20,
        treasury10y: treasuryData?.price || 4.5,
        gold: goldData?.price || 2000,
        dollarIndex: dollarData?.price || 100,
        riskOnAssets: riskOnData.map(d => d.price),
        riskOffAssets: riskOffData.map(d => d.price),
      };

      const signal = this.analyzeRegimeSignals(indicators);
      this.lastRegime = signal.regime;
      this.regimeHistory.push({ regime: signal.regime, timestamp: Date.now() });

      if (this.regimeHistory.length > 100) {
        this.regimeHistory.shift();
      }

      logger.info(`Macro regime: ${signal.regime} (${signal.confidence}% confidence)`);
      return signal.regime;
    } catch (error) {
      logger.error('Regime detection error:', error);
      return this.lastRegime;
    }
  }

  private async getSafeQuote(symbol: string): Promise<{ price: number } | null> {
    try {
      return await marketDataService.getQuote(symbol);
    } catch {
      return null;
    }
  }

  private analyzeRegimeSignals(indicators: RegimeIndicators): RegimeSignal {
    const triggers: string[] = [];
    let regime: MacroRegime = 'normal';
    let maxConfidence = 50;

    if (indicators.vix > 25) {
      triggers.push(`VIX elevated: ${indicators.vix.toFixed(2)}`);
      regime = 'high_volatility';
      maxConfidence = Math.max(maxConfidence, 75);
    } else if (indicators.vix < 15) {
      triggers.push(`VIX suppressed: ${indicators.vix.toFixed(2)}`);
      regime = 'low_volatility';
      maxConfidence = Math.max(maxConfidence, 65);
    }

    if (indicators.treasury10y < 2.5 && indicators.gold > 2000) {
      triggers.push(`Yield low, Gold high`);
      regime = 'risk_off';
      maxConfidence = Math.max(maxConfidence, 70);
    }

    const avgRiskOn = indicators.riskOnAssets.reduce((a, b) => a + b, 0) / indicators.riskOnAssets.length;
    const avgRiskOff = indicators.riskOffAssets.reduce((a, b) => a + b, 0) / indicators.riskOffAssets.length;

    if (indicators.vix < 20 && avgRiskOn > avgRiskOff * 1.02) {
      if (regime === 'normal' || regime === 'low_volatility') {
        regime = 'risk_on_bull';
        maxConfidence = Math.max(maxConfidence, 70);
        triggers.push('Risk assets outperforming');
      }
    }

    if (indicators.vix > 20 && avgRiskOn < avgRiskOff * 0.98) {
      regime = 'risk_on_bear';
      maxConfidence = Math.max(maxConfidence, 70);
      triggers.push('Risk assets underperforming');
    }

    if (indicators.treasury10y > 4.5 && indicators.gold > 2100) {
      regime = 'inflation';
      maxConfidence = Math.max(maxConfidence, 65);
      triggers.push(`Inflation signals: 10Y at ${indicators.treasury10y.toFixed(2)}%`);
    }

    return { regime, confidence: maxConfidence, triggers };
  }

  getRegimeAllocationAdjustments(regime: MacroRegime): Record<string, number> {
    const baseWeights: Record<string, number> = {
      equities: 0.30,
      crypto: 0.08,
      forex: 0.10,
      commodities: 0.08,
      etfs: 0.12,
      bonds: 0.20,
      cash: 0.12,
    };

    const adjustments: Record<MacroRegime, Record<string, number>> = {
      risk_on_bull: { equities: 0.10, crypto: 0.05, commodities: 0.03, bonds: -0.10, cash: -0.08 },
      risk_on_bear: { equities: -0.15, crypto: -0.05, bonds: 0.15, cash: 0.10 },
      risk_off: { equities: -0.15, bonds: 0.20, cash: 0.05 },
      inflation: { commodities: 0.15, equities: -0.05, bonds: -0.10 },
      deflation: { bonds: 0.15, equities: -0.10, cash: 0.05 },
      high_volatility: { equities: -0.10, crypto: -0.05, cash: 0.20 },
      low_volatility: { equities: 0.10, bonds: -0.05 },
      stagflation: { commodities: 0.10, equities: -0.10, bonds: -0.05, cash: 0.05 },
      recovery: { equities: 0.15, commodities: 0.05, bonds: -0.10, crypto: 0.03 },
      normal: {},
    };

    const adj = adjustments[regime] || {};
    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(baseWeights)) {
      result[key] = Math.max(0, Math.min(1, value + (adj[key] || 0)));
    }

    return result;
  }

  getLastRegime(): MacroRegime {
    return this.lastRegime;
  }

  getRegimeHistory(): Array<{ regime: MacroRegime; timestamp: number }> {
    return this.regimeHistory;
  }
}

export const macroRegimeService = new MacroRegimeService();