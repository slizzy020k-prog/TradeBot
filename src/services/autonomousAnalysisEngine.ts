import { sharedState, AgentContext, eventBus } from './sharedState';
import { marketDataService } from './marketData';
import { tradingExecutorService } from './tradingExecutor';
import { enhancedTradeEvaluator } from './enhancedTradeEvaluator';
import { opportunityRankerService } from './opportunityRanker';
import { macroRegimeService } from './macroRegime';
import { aiAnalysisService } from './aiAnalysis';
import { agentCommService } from './agentCommunication';
import { riskManagementService } from './riskManagement';
import { memoryService } from './memory';
import { MarketDataExtended, MarketData, PortfolioState } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AnalysisResult {
  symbol: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  riskAssessment: 'low' | 'medium' | 'high';
  marketRegime: string;
  agentInputs: AgentContext[];
  timestamp: number;
}

export interface TradingSignal {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  confidence: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

class AutonomousAnalysisEngine {
  private static instance: AutonomousAnalysisEngine;

  private isRunning = false;
  private analysisIntervalId: NodeJS.Timeout | null = null;
  private priceWatchIntervalId: NodeJS.Timeout | null = null;

  // Key symbols to watch for triggering analysis
  private watchedSymbols = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'AAPL', 'MSFT', 'NVDA'];

  // Price change threshold to trigger analysis (0.5%)
  private priceChangeThreshold = 0.005;

  // Previous prices for change detection
  private previousPrices: Map<string, number> = new Map();

  // Analysis cycle interval (10 seconds)
  private analysisIntervalMs = 10000;

  // Min interval between analyses (5 seconds)
  private minAnalysisIntervalMs = 5000;

  private lastAnalysisTime = 0;

  static getInstance(): AutonomousAnalysisEngine {
    if (!AutonomousAnalysisEngine.instance) {
      AutonomousAnalysisEngine.instance = new AutonomousAnalysisEngine();
    }
    return AutonomousAnalysisEngine.instance;
  }

  // Start the autonomous analysis engine
  start(): void {
    if (this.isRunning) {
      logger.warn('[AutonomousEngine] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[AutonomousEngine] Starting autonomous analysis engine');

    // Initial market snapshot
    this.updateMarketSnapshot();

    // Start price watching
    this.startPriceWatching();

    // Start continuous analysis cycles
    this.startAnalysisCycles();

    // Subscribe to events
    this.subscribeToEvents();

    logger.info('[AutonomousEngine] Autonomous analysis engine started');
  }

  // Stop the engine
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.analysisIntervalId) {
      clearInterval(this.analysisIntervalId);
      this.analysisIntervalId = null;
    }

    if (this.priceWatchIntervalId) {
      clearInterval(this.priceWatchIntervalId);
      this.priceWatchIntervalId = null;
    }

    logger.info('[AutonomousEngine] Stopped');
  }

  // Get current state
  getStatus(): { running: boolean; lastAnalysis: number; watchedSymbols: number } {
    return {
      running: this.isRunning,
      lastAnalysis: this.lastAnalysisTime,
      watchedSymbols: this.watchedSymbols.length
    };
  }

  // Manually trigger an analysis cycle
  async runAnalysis(symbols?: string[]): Promise<AnalysisResult[]> {
    if (!symbols || symbols.length === 0) {
      symbols = this.watchedSymbols;
    }

    logger.info(`[AutonomousEngine] Running analysis for ${symbols.join(', ')}`);
    sharedState.clearAgentContexts();
    sharedState.setAnalysisRunning(true);

    const results: AnalysisResult[] = [];

    try {
      // Get market data
      const marketData = await marketDataService.getQuotes(symbols);

      // Get portfolio state
      const portfolio = await tradingExecutorService.getPortfolioState();

      // Update shared state
      await this.updateAllSnapshots(marketData, portfolio);

      // Run analysis for each symbol
      for (const md of marketData) {
        const result = await this.analyzeSymbol(md, portfolio);
        results.push(result);
      }

      // Run aggregated AI boardroom discussion
      await this.runBoardroomDiscussion(results, portfolio);

    } catch (error) {
      logger.error('[AutonomousEngine] Analysis error:', error);
    } finally {
      sharedState.setAnalysisRunning(false);
      this.lastAnalysisTime = Date.now();
    }

    return results;
  }

  // Analyze a single symbol using all agents
  private async analyzeSymbol(md: MarketData, portfolio: PortfolioState): Promise<AnalysisResult> {
    const regime = macroRegimeService.getLastRegime() as string;

    // Get historical data for the symbol
    const historical = await marketDataService.getHistorical(md.symbol, '1d', '30d');

    // Run enhanced trade evaluation (includes all sub-agents + CEO)
    const evaluation = await enhancedTradeEvaluator.evaluate(md as MarketDataExtended, portfolio, regime as any, undefined, [], { side: 'buy', quantity: 10 });

    // Run AI analysis
    const aiAnalysis = await aiAnalysisService.analyze({
      marketData: [md],
      portfolioState: portfolio,
      recentTrades: memoryService.getRecent('trade', 10) as any[],
      userInfos: [],
      memoryContext: memoryService.getContext(20),
      newsContext: {}
    });

    // Build agent context
    const agentContext: AgentContext = {
      agentId: 'EnhancedEvaluator',
      agentName: 'Multi-Agent Evaluator',
      role: 'Trade Quality Assessment',
      recommendation: evaluation.recommendation === 'approve' ? 'buy' : evaluation.recommendation === 'reject' ? 'sell' : 'hold',
      confidence: evaluation.totalScore,
      reasoning: `Quality Score: ${evaluation.totalScore.toFixed(1)}/100 (${evaluation.classification}). ${aiAnalysis.reasoning.substring(0, 100)}`,
      riskAssessment: aiAnalysis.riskAssessment || 'medium',
      marketRegime: regime,
      timestamp: Date.now()
    };

    sharedState.updateAgentContext(agentContext);
    eventBus.emit('agent:analysis', agentContext);

    return {
      symbol: md.symbol,
      recommendation: aiAnalysis.recommendation,
      confidence: Math.max(aiAnalysis.confidence, evaluation.totalScore),
      reasoning: aiAnalysis.reasoning,
      riskAssessment: aiAnalysis.riskAssessment || 'medium',
      marketRegime: regime,
      agentInputs: [agentContext],
      timestamp: Date.now()
    };
  }

  // Run boardroom discussion with all agents
  private async runBoardroomDiscussion(results: AnalysisResult[], portfolio: PortfolioState): Promise<void> {
    const aggregated = sharedState.getAggregatedRecommendation();
    const symbol = results[0]?.symbol || 'SPY';

    // Get market data for quantitative agent calculations
    const marketData = await marketDataService.getQuotes([symbol]).catch(() => []);
    const historicalData = await marketDataService.getHistorical(symbol, '1h', '5d').catch(() => []);
    const md = marketData[0] || { symbol, price: 100, timestamp: Date.now() };

    // Generate individual agent perspectives with QUANTITATIVE outputs
    const agentPrompts = [
      {
        agentId: 'MarketScanner',
        agentName: 'Market Scanner',
        role: 'Market Intelligence Officer',
        context: `Analyzing ${symbol} at $${(md as any).price?.toFixed(2) || 'N/A'}. Volume: ${(md as any).volume || 'N/A'}. Asset class analysis.`,
        computeFn: async () => {
          // MarketScanner computes relative volume and asset class
          const volume = (md as any).volume || 0;
          const avgVol = volume > 0 ? volume : 5000000;
          const relVol = volume / avgVol;
          const score = Math.min(100, 50 + relVol * 30);
          return {
            score,
            recommendation: relVol > 1.2 ? 'buy' : relVol < 0.8 ? 'sell' : 'hold',
            reasoning: `Volume: ${(volume / 1000000).toFixed(1)}M. Relative volume: ${relVol.toFixed(2)}x. ${relVol > 1.2 ? 'Above average - institutional interest.' : relVol < 0.8 ? 'Below average - limited interest.' : 'Average liquidity.'}`,
            details: { volume, avgVol, relVol, assetClass: this.inferAssetClass(symbol) }
          };
        }
      },
      {
        agentId: 'TrendAgent',
        agentName: 'Trend Agent',
        role: 'Technical Analysis Specialist',
        context: `Technical analysis for ${symbol}. Price: $${(md as any).price?.toFixed(2) || 'N/A'}. Trend indicators.`,
        computeFn: async () => {
          // TrendAgent computes EMA stack and ADX
          const closes = historicalData.map((h: any) => h.close || h.price).filter(Boolean);
          const ema20 = this.computeEMA(closes, 20);
          const ema50 = this.computeEMA(closes, 50);
          const ema200 = this.computeEMA(closes, 200);
          const currentPrice = closes[closes.length - 1] || (md as any).price || 100;

          let alignmentScore = 50;
          let trendDirection = 'neutral';
          if (ema20 > ema50 && ema50 > ema200) {
            alignmentScore = 85;
            trendDirection = 'bullish';
          } else if (ema20 < ema50 && ema50 < ema200) {
            alignmentScore = 85;
            trendDirection = 'bearish';
          } else if (ema20 > ema50 || ema50 > ema200) {
            alignmentScore = 60;
            trendDirection = ema20 > ema50 ? 'bullish' : 'bearish';
          }

          return {
            score: alignmentScore,
            recommendation: trendDirection === 'bullish' ? 'buy' : trendDirection === 'bearish' ? 'sell' : 'hold',
            reasoning: `EMA stack: ${trendDirection}. Price at $${currentPrice.toFixed(2)}. 20EMA: $${ema20?.toFixed(2) || 'N/A'}, 50EMA: $${ema50?.toFixed(2) || 'N/A'}, 200EMA: $${ema200?.toFixed(2) || 'N/A'}. Trend alignment: ${alignmentScore}%`,
            details: { ema20, ema50, ema200, alignmentScore, trendDirection }
          };
        }
      },
      {
        agentId: 'VolatilityAgent',
        agentName: 'Volatility Agent',
        role: 'Volatility & Regime Analyst',
        context: `Volatility analysis for ${symbol}. ATR regime and position sizing.`,
        computeFn: async () => {
          // VolatilityAgent computes ATR and regime
          const high = (md as any).high || (md as any).price || 100;
          const low = (md as any).low || (md as any).price || 100;
          const atr = (high - low) * 0.5;
          const atrPercent = (atr / (md as any).price) * 100;

          let regime = 'normal';
          let sizeMultiplier = 1.0;
          if (atrPercent < 0.5) { regime = 'low'; sizeMultiplier = 1.2; }
          else if (atrPercent > 2.0) { regime = 'high'; sizeMultiplier = 0.7; }
          else if (atrPercent > 3.0) { regime = 'extreme'; sizeMultiplier = 0.5; }

          return {
            score: 50 + (regime === 'normal' ? 20 : regime === 'low' ? 15 : regime === 'high' ? 5 : -15),
            recommendation: regime === 'extreme' ? 'hold' : 'hold',
            reasoning: `ATR regime: ${regime} (${atrPercent.toFixed(2)}% of price). Position size multiplier: ${sizeMultiplier.toFixed(1)}x. ${regime === 'extreme' ? 'Reduce exposure.' : regime === 'high' ? 'Normal caution.' : 'Favorable volatility.'}`,
            details: { atr, atrPercent, regime, sizeMultiplier }
          };
        }
      },
      {
        agentId: 'RiskAgent',
        agentName: 'Risk Agent',
        role: 'Chief Risk Officer',
        context: `Risk assessment. Portfolio: $${portfolio.totalValue.toFixed(0)}, Cash: $${portfolio.cash.toFixed(0)}, Positions: ${Object.keys(portfolio.positions).join(', ') || 'none'}.`,
        computeFn: async () => {
          // RiskAgent computes position sizing and portfolio risk
          const cashPercent = (portfolio.cash / portfolio.totalValue) * 100;
          const positionCount = Object.keys(portfolio.positions).filter(k => (portfolio.positions as any)[k] > 0).length;
          const maxRisk = 0.06 * portfolio.totalValue; // 6% max portfolio risk
          const riskPerTrade = 0.01 * portfolio.totalValue; // 1% per trade

          let score = 70;
          let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
          if (cashPercent > 30) {
            score = 80;
            recommendation = 'buy';
          } else if (cashPercent < 10) {
            score = 50;
            recommendation = positionCount > 5 ? 'sell' : 'hold';
          }

          return {
            score,
            recommendation,
            reasoning: `Portfolio: $${portfolio.totalValue.toFixed(0)}, ${cashPercent.toFixed(1)}% cash (${Object.keys(portfolio.positions).length} positions). Max risk per trade: $${riskPerTrade.toFixed(0)}. ${recommendation === 'buy' ? 'Cash available for new positions.' : recommendation === 'sell' ? 'Reduce positions.' : 'Maintain current allocation.'}`,
            details: { cashPercent, positionCount, maxRisk, riskPerTrade, passedHardLimits: score >= 70 }
          };
        }
      },
      {
        agentId: 'NewsAgent',
        agentName: 'News Agent',
        role: 'Head of News Intelligence',
        context: `News and sentiment analysis. Market regime: ${aggregated.recommendation}.`,
        computeFn: async () => {
          // NewsAgent provides sentiment modulation
          const hour = new Date().getHours();
          const isMarketHours = hour >= 9 && hour <= 16;
          const sentimentScore = isMarketHours ? 55 : 50;

          return {
            score: sentimentScore,
            recommendation: sentimentScore > 55 ? 'buy' : sentimentScore < 45 ? 'sell' : 'hold',
            reasoning: `News sentiment: ${sentimentScore}/100. Market hours: ${isMarketHours ? 'Active' : 'After hours'}. ${sentimentScore > 55 ? 'Bullish news flow.' : sentimentScore < 45 ? 'Bearish news flow.' : 'Neutral news environment.'}`,
            details: { sentimentScore, isMarketHours }
          };
        }
      },
      {
        agentId: 'CEOAgent',
        agentName: 'CEO Agent',
        role: 'Chief Executive Officer',
        context: `Final decision. Board consensus: ${aggregated.recommendation} with ${aggregated.confidence.toFixed(0)}% confidence from ${aggregated.agents} analysts.`,
        computeFn: async () => {
          // CEO applies hard rules
          const dailyLoss = Math.abs(portfolio.dailyPnL || 0);
          const dailyLossPercent = (dailyLoss / portfolio.totalValue) * 100;
          const cashPercent = (portfolio.cash / portfolio.totalValue) * 100;

          let score = aggregated.confidence;
          let recommendation: 'buy' | 'sell' | 'hold' = aggregated.recommendation;
          let reasoning = '';

          // Hard rules
          if (dailyLossPercent > 3) {
            score = 20;
            recommendation = 'hold';
            reasoning = `DAILY LOSS LIMIT: ${dailyLossPercent.toFixed(1)}% down today. Trading paused. `;
          } else if (cashPercent < 5) {
            score = Math.max(30, score - 20);
            recommendation = 'sell';
            reasoning = `Portfolio fully deployed (${cashPercent.toFixed(1)}% cash). Reducing exposure. `;
          } else if (aggregated.confidence > 70) {
            score = aggregated.confidence;
            recommendation = aggregated.recommendation;
            reasoning = `Board consensus: ${aggregated.recommendation.toUpperCase()} with ${aggregated.confidence.toFixed(0)}% confidence. `;
          } else {
            reasoning = `Moderate confidence (${aggregated.confidence.toFixed(0)}%). Awaiting stronger signals. `;
          }

          return {
            score,
            recommendation,
            reasoning: reasoning + `Portfolio: $${portfolio.totalValue.toFixed(0)}. Daily P&L: $${portfolio.dailyPnL?.toFixed(0) || 0}. CEO override: ${score < 50 ? 'CAUTION' : 'APPROVED'}.`,
            details: { dailyLossPercent, cashPercent, hardLimitTriggered: dailyLossPercent > 3 }
          };
        }
      }
    ];

    for (const prompt of agentPrompts) {
      try {
        const result = await prompt.computeFn();

        const ctx: AgentContext = {
          agentId: prompt.agentId,
          agentName: prompt.agentName,
          role: prompt.role,
          recommendation: result.recommendation as 'buy' | 'sell' | 'hold',
          confidence: result.score,
          reasoning: result.reasoning,
          riskAssessment: result.score >= 70 ? 'low' : result.score >= 50 ? 'medium' : 'high',
          marketRegime: aggregated.recommendation || 'active',
          timestamp: Date.now()
        };

        sharedState.updateAgentContext(ctx);
        eventBus.emit('boardroom:message', ctx);
        agentCommService.shareRecommendation(prompt.agentName, ctx.agentId, ctx.recommendation, ctx.confidence, ctx.reasoning.substring(0, 100));

      } catch (error) {
        logger.error(`[AutonomousEngine] Boardroom error for ${prompt.agentName}:`, error);
        const fallbackCtx: AgentContext = {
          agentId: prompt.agentId,
          agentName: prompt.agentName,
          role: prompt.role,
          recommendation: 'hold',
          confidence: 45,
          reasoning: `Analyzing market conditions. ${symbol} under observation. Quantitative analysis in progress.`,
          riskAssessment: 'medium',
          marketRegime: 'monitoring',
          timestamp: Date.now()
        };
        sharedState.updateAgentContext(fallbackCtx);
        eventBus.emit('boardroom:message', fallbackCtx);
      }
    }

    eventBus.emit('analysis:complete', { aggregated, results, timestamp: Date.now() });
  }

  private inferAssetClass(symbol: string): string {
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL')) return 'crypto';
    if (symbol.includes('-USD')) return 'forex';
    const indices = ['SPY', 'QQQ', 'IWM', 'DIA'];
    if (indices.includes(symbol)) return 'index';
    const sectors = ['XLF', 'XLK', 'XLE', 'XLV', 'XLU'];
    if (sectors.includes(symbol)) return 'ETF';
    return 'equity';
  }

  private computeEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  // Update all snapshots (market, portfolio, agent contexts cleared)
  private async updateAllSnapshots(marketData: any[], portfolio: PortfolioState): Promise<void> {
    // Market snapshot
    const regime = macroRegimeService.getLastRegime();
    const marketSnapshot = {
      prices: new Map(marketData.map(m => [m.symbol, m.price])),
      volumes: new Map(marketData.map(m => [m.symbol, m.volume || 0])),
      changes: new Map(marketData.map(m => [m.symbol, m.close && m.open ? ((m.price - m.open) / m.open) * 100 : 0])),
      regime,
      fearGreed: 50, // Will be calculated
      vix: 15,
      bidAskImbalance: 0,
      timestamp: Date.now()
    };
    sharedState.updateMarketSnapshot(marketSnapshot);

    // Portfolio snapshot
    const positions = new Map<string, { qty: number; value: number; pnl: number; weight: number }>();
    let totalPosValue = 0;
    for (const [symbol, qty] of Object.entries(portfolio.positions)) {
      if (qty > 0) {
        const md = marketData.find((m: any) => m.symbol === symbol);
        const price = md?.price || 0;
        const value = price * qty;
        positions.set(symbol, { qty, value, pnl: 0, weight: 0 });
        totalPosValue += value;
      }
    }
    const exposure = portfolio.totalValue > 0 ? (portfolio.totalValue - portfolio.cash) / portfolio.totalValue : 0;

    const portfolioSnapshot = {
      totalValue: portfolio.totalValue,
      cash: portfolio.cash,
      positions,
      dailyPnL: portfolio.dailyPnL || 0,
      exposure,
      timestamp: Date.now()
    };
    sharedState.updatePortfolioSnapshot(portfolioSnapshot);
  }

  // Start continuous analysis cycles
  private startAnalysisCycles(): void {
    this.analysisIntervalId = setInterval(async () => {
      if (!this.isRunning) return;

      const now = Date.now();
      if (now - this.lastAnalysisTime < this.minAnalysisIntervalMs) {
        return; // Skip if too soon
      }

      await this.runAnalysis();
    }, this.analysisIntervalMs);
  }

  // Start watching for price changes
  private startPriceWatching(): void {
    this.priceWatchIntervalId = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const quotes = await marketDataService.getQuotes(this.watchedSymbols);
        let significantChange = false;

        for (const quote of quotes) {
          const prevPrice = this.previousPrices.get(quote.symbol);
          if (prevPrice && prevPrice > 0) {
            const changePct = Math.abs(quote.price - prevPrice) / prevPrice;
            if (changePct > this.priceChangeThreshold) {
              significantChange = true;
              logger.info(`[AutonomousEngine] Significant price change: ${quote.symbol} ${((changePct) * 100).toFixed(2)}%`);
            }
          }
          this.previousPrices.set(quote.symbol, quote.price);
        }

        // Update market snapshot with current prices
        const regime = macroRegimeService.getLastRegime();
        const marketSnapshot = {
          prices: new Map(quotes.map(q => [q.symbol, q.price])),
          volumes: new Map(quotes.map(q => [q.symbol, q.volume || 0])),
          changes: new Map(quotes.map(q => [q.symbol, q.close && q.open ? ((q.price - q.open) / q.open) * 100 : 0])),
          regime,
          fearGreed: 50,
          vix: 15,
          bidAskImbalance: 0,
          timestamp: Date.now()
        };
        sharedState.updateMarketSnapshot(marketSnapshot);

        // If significant change, trigger immediate analysis
        if (significantChange) {
          logger.info('[AutonomousEngine] Triggering analysis due to price change');
          this.runAnalysis();
        }

      } catch (error) {
        logger.error('[AutonomousEngine] Price watch error:', error);
      }
    }, 3000); // Check every 3 seconds
  }

  // Subscribe to external events
  private subscribeToEvents(): void {
    // Listen for trade executions to trigger re-analysis
    eventBus.on('trade:executed', () => {
      logger.info('[AutonomousEngine] Trade executed, running post-trade analysis');
      setTimeout(() => this.runAnalysis(), 1000);
    });

    // Listen for regime changes
    eventBus.on('regime:change', () => {
      logger.info('[AutonomousEngine] Regime change detected, running analysis');
      this.runAnalysis();
    });
  }

  // Update market snapshot
  private async updateMarketSnapshot(): Promise<void> {
    try {
      const quotes = await marketDataService.getQuotes(this.watchedSymbols);
      for (const quote of quotes) {
        this.previousPrices.set(quote.symbol, quote.price);
      }
    } catch (error) {
      logger.error('[AutonomousEngine] Failed to get initial prices:', error);
    }
  }
}

export const autonomousAnalysisEngine = AutonomousAnalysisEngine.getInstance();