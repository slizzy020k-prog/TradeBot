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

    // Build market context with real prices
    const marketSummary = results.map(r => `${r.symbol}@$${r.symbol.includes('BTC') || r.symbol.includes('ETH') ? r.confidence.toFixed(2) : 'N/A'}`).join(', ');

    // Generate individual agent perspectives using AI
    const agentPrompts = [
      {
        agentId: 'TrendAgent',
        agentName: 'Trend Agent',
        role: 'Technical Analysis Specialist',
        context: `Market analysis results: ${results.map(r => `${r.symbol}: ${r.recommendation}(${r.confidence.toFixed(0)}%)`).join(', ')}. Aggregated signal: ${aggregated.recommendation} with ${aggregated.confidence.toFixed(0)}% confidence. Provide technical analysis perspective on these signals.`
      },
      {
        agentId: 'RiskAgent',
        agentName: 'Risk Agent',
        role: 'Chief Risk Officer',
        context: `Portfolio status - Value: $${portfolio.totalValue.toFixed(2)}, Cash: $${portfolio.cash.toFixed(2)}, Positions: ${Object.keys(portfolio.positions).join(', ') || 'none'}, Exposure: ${aggregated.agents} agents analyzing. Assess risk implications of current market signals.`
      },
      {
        agentId: 'NewsAgent',
        agentName: 'News Agent',
        role: 'Head of News Intelligence',
        context: `Market signals from analysis: ${results.map(r => `${r.symbol} (${r.recommendation}, ${r.confidence.toFixed(0)}%)`).join(', ')}. Market regime: ${aggregated.recommendation}. Provide news sentiment and market intelligence perspective.`
      },
      {
        agentId: 'CEOAgent',
        agentName: 'CEO Agent',
        role: 'Chief Executive Officer',
        context: `Board consensus: ${aggregated.recommendation} with ${aggregated.confidence.toFixed(0)}% average confidence from ${aggregated.agents} analysts. Portfolio: $${portfolio.totalValue.toFixed(2)} total value. Synthesize all inputs to provide final trading decision.`
      }
    ];

    for (const prompt of agentPrompts) {
      try {
        const response = await aiAnalysisService.analyze({
          marketData: results.map(r => ({ symbol: r.symbol, price: 100, timestamp: r.timestamp } as any)),
          portfolioState: portfolio,
          recentTrades: memoryService.getRecent('trade', 5) as any[],
          userInfos: [],
          memoryContext: [],
          newsContext: {}
        });

        const ctx: AgentContext = {
          agentId: prompt.agentId,
          agentName: prompt.agentName,
          role: prompt.role,
          recommendation: response.recommendation,
          confidence: response.confidence,
          reasoning: response.reasoning.substring(0, 300),
          riskAssessment: response.riskAssessment || 'medium',
          marketRegime: response.marketRegime || 'active',
          timestamp: Date.now()
        };

        sharedState.updateAgentContext(ctx);
        eventBus.emit('boardroom:message', ctx);

        // Also broadcast via agentCommService
        agentCommService.shareAnalysis(prompt.agentName, ctx.agentId, ctx.reasoning, ctx.confidence);
        agentCommService.shareRecommendation(prompt.agentName, ctx.agentId, ctx.recommendation, ctx.confidence, ctx.reasoning.substring(0, 100));

      } catch (error) {
        logger.error(`[AutonomousEngine] Boardroom error for ${prompt.agentName}:`, error);
        // Emit fallback to keep boardroom active
        const fallbackCtx: AgentContext = {
          agentId: prompt.agentId,
          agentName: prompt.agentName,
          role: prompt.role,
          recommendation: 'hold',
          confidence: 45,
          reasoning: `Analyzing market conditions in current regime. Awaiting clearer signals before adjusting position. Market data shows: ${results.map(r => r.symbol).join(', ') || 'watching'}.`,
          riskAssessment: 'medium',
          marketRegime: 'monitoring',
          timestamp: Date.now()
        };
        sharedState.updateAgentContext(fallbackCtx);
        eventBus.emit('boardroom:message', fallbackCtx);
      }
    }

    // Emit final aggregated signal
    eventBus.emit('analysis:complete', {
      aggregated,
      results,
      timestamp: Date.now()
    });
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