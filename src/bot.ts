import { config } from './config';
import { logger } from './utils/logger';
import { marketDataService } from './services/marketData';
import { aiAnalysisService } from './services/aiAnalysis';
import { memoryService } from './services/memory';
import { riskManagementService } from './services/riskManagement';
import { tradingExecutorService } from './services/tradingExecutor';
import { userInfoProcessorService } from './services/userInfoProcessor';
import { AIAnalysisRequest, MarketDataExtended, OpportunityScore } from './types';
import { newsIntelligenceService } from './services/newsIntelligence';
import { agentCommService } from './services/agentCommunication';
import { enhancedTradeEvaluator } from './services/enhancedTradeEvaluator';
import { marketScannerService } from './services/marketScanner';
import { macroRegimeService } from './services/macroRegime';
import { opportunityRankerService } from './services/opportunityRanker';
import { allocationEngineService } from './services/allocationEngine';
import { correlationEngine } from './services/correlationEngine';

export class TradeBot {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;
  private newsIntervalId: NodeJS.Timeout | null = null;
  private watchedSymbols: string[] = [];
  private multiAssetMode = false;

  start(symbols?: string[]): void {
    if (this.running) {
      logger.warn('Bot is already running');
      return;
    }

    this.watchedSymbols = symbols || [];
    this.multiAssetMode = symbols === undefined || symbols.length === 0;
    this.running = true;

    if (this.multiAssetMode) {
      logger.info('TradeBot starting in MULTI-ASSET mode (discovery-based)');
    } else {
      logger.info(`TradeBot starting with symbols: ${symbols!.join(', ')}`);
    }

    this.startNewsAutomation();
    this.tick();
    this.intervalId = setInterval(() => this.tick(), config.pollIntervalMs);
  }

  private async startNewsAutomation(): Promise<void> {
    logger.info('Starting automated news scraping (every 15 minutes)');

    // Run initial scrape immediately
    this.runComprehensiveNewsScrape();

    // Run both news and market data scraping every 15 minutes
    this.newsIntervalId = setInterval(() => {
      this.runComprehensiveNewsScrape();
      this.runYahooFinanceScrape();
    }, 15 * 60 * 1000); // 15 minutes
  }

  private async runYahooFinanceScrape(): Promise<void> {
    logger.info('=== YAHOO FINANCE SCRAPE STARTED ===');

    try {
      // Scrape detailed data for all watched symbols
      for (const symbol of this.watchedSymbols) {
        try {
          const data = await marketDataService.getQuote(symbol);
          logger.info(`Yahoo Finance ${symbol}: $${data.price} (vol: ${data.volume})`);
          await new Promise(r => setTimeout(r, 500)); // Rate limit protection
        } catch (error) {
          logger.error(`Failed to scrape ${symbol}:`, error);
        }
      }
      logger.info(`=== YAHOO FINANCE SCRAPE COMPLETE: ${this.watchedSymbols.length} symbols ===`);
    } catch (error) {
      logger.error('Error during Yahoo Finance scrape:', error);
    }
  }

  private async runComprehensiveNewsScrape(): Promise<void> {
    logger.info('=== COMPREHENSIVE NEWS SCRAPE STARTED ===');

    try {
      // 1. Scrape geopolitical news
      logger.info('Fetching geopolitical news...');
      const geoNews = await newsIntelligenceService.scrapeGeopoliticalNews();
      logger.info(`Collected ${geoNews.length} geopolitical news articles`);

      // 2. Scrape news for all watched symbols
      logger.info('Fetching news for watched symbols...');
      const symbolNews = await newsIntelligenceService.scrapeAllNews(this.watchedSymbols);

      let totalArticles = geoNews.length;
      for (const [symbol, result] of symbolNews) {
        if (result.hasNews) {
          logger.info(`  ${symbol}: ${result.aggregatedSentiment.articleCount} articles (${result.aggregatedSentiment.overall})`);
          totalArticles += result.aggregatedSentiment.articleCount;
        }
      }

      logger.info(`=== NEWS SCRAPE COMPLETE: ${totalArticles} total articles ===`);
    } catch (error) {
      logger.error('Error during comprehensive news scrape:', error);
    }
  }

  stop(): void {
    if (!this.running) {
      logger.warn('Bot is not running');
      return;
    }

    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.newsIntervalId) {
      clearInterval(this.newsIntervalId);
      this.newsIntervalId = null;
    }
    logger.info('TradeBot stopped');
  }

  status(): { running: boolean; symbols: string[] } {
    return {
      running: this.running,
      symbols: this.watchedSymbols,
    };
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    logger.info('Bot tick started');
    const startTime = Date.now();

    try {
      let marketData: MarketDataExtended[];
      let opportunities: OpportunityScore[];
      let portfolioState = await tradingExecutorService.getPortfolioState();
      let positions = await tradingExecutorService.getPositions();
      let posMap: Record<string, number> = {};
      for (const p of positions) {
        posMap[p.symbol] = parseFloat(p.qty);
      }

      if (this.multiAssetMode) {
        logger.info('=== MULTI-ASSET SCAN CYCLE ===');

        marketData = await marketScannerService.scanAllMarkets();
        logger.info(`Scanned ${marketData.length} symbols across asset classes`);

        agentCommService.broadcast('MarketScanner', 'analysis', `Universe scan complete: ${marketData.length} symbols`, { count: marketData.length });

        const regime = await macroRegimeService.detectRegime();
        logger.info(`Macro regime: ${regime}`);
        agentCommService.broadcast('MacroRegimeAgent', 'analysis', `Regime detected: ${regime}`);

        const symbols = marketData.map(m => m.symbol);
        await correlationEngine.calculateCorrelations(symbols.slice(0, 20));

        opportunities = await opportunityRankerService.rankOpportunities(marketData);
        const topOpps = opportunities.slice(0, 5);
        logger.info(`Top opportunities: ${topOpps.map(o => `${o.symbol}(${o.totalScore.toFixed(0)})`).join(', ')}`);

        for (const opp of topOpps) {
          agentCommService.shareAnalysis('OpportunityRanker', opp.symbol,
            `${opp.assetClass} score: ${opp.totalScore.toFixed(0)} recommend: ${opp.recommendation}`,
            opp.confidence);
        }

        const allocation = allocationEngineService.calculateAllocation(portfolioState, posMap, opportunities);
        logger.info(`Allocation: ${allocation.allocations.map(a => `${a.assetClass}:${(a.targetWeight*100).toFixed(0)}%`).join(', ')}`);

        await this.executeMultiAssetCycle(marketData, opportunities, allocation, portfolioState, posMap);
      } else {
        marketData = await marketDataService.getQuotes(this.watchedSymbols) as MarketDataExtended[];
        await this.executeLegacyCycle(marketData, portfolioState, posMap);
      }
    } catch (error) {
      logger.error('Error during tick:', error);
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Tick completed in ${elapsed}ms`);
  }

  private async executeMultiAssetCycle(
    marketData: MarketDataExtended[],
    opportunities: OpportunityScore[],
    allocation: any,
    portfolioState: any,
    positions: Record<string, number>
  ): Promise<void> {
    const topOpps = opportunities.filter(o => o.recommendation !== 'hold').slice(0, 3);

    for (const opp of topOpps) {
      const md = marketData.find(m => m.symbol === opp.symbol);
      if (!md) continue;

      try {
        const tradeCheck = allocationEngineService.shouldTradeSymbol(
          opp.symbol, opp.assetClass, allocation, positions
        );

        if (!tradeCheck.shouldTrade) {
          logger.info(`Skipping ${opp.symbol}: ${tradeCheck.reason}`);
          continue;
        }

        const regime = enhancedTradeEvaluator.classifyRegime(md);
        const tradeQuality = await enhancedTradeEvaluator.evaluate(
          md, portfolioState, regime, undefined, [], { side: 'buy', quantity: 10 }
        );

        if (tradeQuality.recommendation !== 'approve') {
          agentCommService.rejectTrade('CEOAgent', opp.symbol, `Quality score ${tradeQuality.totalScore.toFixed(0)} below threshold`);
          continue;
        }

        const quantity = tradeCheck.suggestedQuantity || Math.floor(portfolioState.cash * 0.1 / md.price);
        const analysis = await aiAnalysisService.analyze({
          marketData: [md],
          portfolioState,
          recentTrades: [],
          userInfos: [],
          memoryContext: [],
          newsContext: {},
        });

        if (analysis.confidence > 50) {
          agentCommService.broadcast('RiskManager', 'approval', `Multi-asset trade approved: ${opp.symbol} ${analysis.recommendation.toUpperCase()} ${analysis.confidence}%`);
          await this.executeTrade({ ...analysis, recommendation: analysis.recommendation as 'buy' | 'sell', suggestedQuantity: quantity }, [md], portfolioState);
        }
      } catch (error) {
        logger.error(`Error evaluating ${opp.symbol}:`, error);
      }
    }
  }

  private async executeLegacyCycle(
    marketData: MarketDataExtended[],
    portfolioState: any,
    positions: Record<string, number>
  ): Promise<void> {
    logger.debug(`Fetched market data for ${marketData.length} symbols`);
    logger.debug(`Portfolio value: $${portfolioState.totalValue}`);

    agentCommService.broadcast('MarketDataAgent', 'analysis', `Market data updated: ${marketData.length} symbols`, { symbols: marketData.map(m => m.symbol) });

    await this.updateTradeOutcomes();

    logger.info('Fetching market news intelligence...');
    agentCommService.broadcast('NewsAgent', 'analysis', 'Starting news intelligence gathering...');

    const newsIntelligence = new Map();
    for (const symbol of this.watchedSymbols) {
      const ni = await newsIntelligenceService.getNewsForSymbol(symbol);
      newsIntelligence.set(symbol, ni);
      if (ni.hasNews) {
        agentCommService.shareAnalysis('NewsAgent', symbol, `${ni.aggregatedSentiment.articleCount} articles, sentiment: ${ni.aggregatedSentiment.overall}`, ni.aggregatedSentiment.confidence);
        logger.info(`News for ${symbol}: ${ni.aggregatedSentiment.overall} (${ni.aggregatedSentiment.articleCount} articles)`);
      }
    }

    const recentTrades = memoryService.getRecent('trade', 10).map(m => m.metadata?.trade).filter(Boolean);
    const userInfos = userInfoProcessorService.getRecentInfos(10);
    const memoryContext = memoryService.getContext(20);

    const newsContextForSymbols = new Map<string, string>();
    for (const [symbol, ni] of newsIntelligence) {
      newsContextForSymbols.set(symbol, ni.newsContextForAI);
    }

    const analysisRequest: AIAnalysisRequest = {
      marketData,
      portfolioState,
      recentTrades: recentTrades as any[],
      userInfos,
      memoryContext,
      newsContext: Object.fromEntries(newsContextForSymbols),
    };

    agentCommService.broadcast('System', 'analysis', `Starting multi-agent evaluation for ${marketData[0]?.symbol}...`);
    const regime = enhancedTradeEvaluator.classifyRegime(marketData[0]);
    const tradeQuality = await enhancedTradeEvaluator.evaluate(
      marketData[0],
      portfolioState,
      regime,
      undefined,
      recentTrades as any[],
      { side: 'buy', quantity: 10 }
    );
    const ceoRec = tradeQuality.recommendation === 'approve' ? 'buy' : tradeQuality.recommendation === 'reject' ? 'sell' : 'hold';
    agentCommService.shareRecommendation('CEOAgent', marketData[0]?.symbol || 'UNKNOWN', ceoRec, tradeQuality.totalScore, tradeQuality.classification);

    const analysis = await aiAnalysisService.analyze(analysisRequest);
    logger.info(`AI Recommendation: ${analysis.recommendation} (confidence: ${analysis.confidence}%)`);

    const primarySymbol = marketData[0]?.symbol;
    const primaryNews = primarySymbol ? newsIntelligence.get(primarySymbol) : null;

    agentCommService.shareRecommendation('AIAnalyzer', primarySymbol || 'UNKNOWN', analysis.recommendation, analysis.confidence, analysis.reasoning.substring(0, 100));

    if (primaryNews && primaryNews.riskFactors.length > 0) {
      agentCommService.raiseWarning('RiskAgent', `High manipulation risk for ${primarySymbol}: ${primaryNews.riskFactors.length} risk factors detected`);
    }

    memoryService.addAnalysis(
      `${analysis.recommendation.toUpperCase()} - Confidence: ${analysis.confidence}%`,
      analysis.recommendation,
      analysis.confidence
    );

    const effectiveConfidence = Math.max(analysis.confidence, tradeQuality.totalScore);
    const finalRecommendation = tradeQuality.recommendation === 'approve' ? 'buy' : tradeQuality.recommendation === 'reject' ? 'sell' : 'hold';

    if (effectiveConfidence > 50 && finalRecommendation !== 'hold') {
      const adjustedConfidence = primaryNews?.aggregatedSentiment.manipulationRisk > 50
        ? effectiveConfidence * 0.7
        : effectiveConfidence;

      if (adjustedConfidence > 50) {
        agentCommService.broadcast('RiskManager', 'approval', `Trade approved for ${primarySymbol}: ${finalRecommendation.toUpperCase()} ${adjustedConfidence}% confidence (AI: ${analysis.confidence}%, CEO: ${tradeQuality.totalScore.toFixed(0)}%)`);
        await this.executeTrade({ ...analysis, recommendation: finalRecommendation as 'buy' | 'sell', suggestedQuantity: Math.floor(portfolioState.cash * 0.1 / marketData[0].price) }, marketData, portfolioState);
      } else {
        agentCommService.rejectTrade('RiskManager', primarySymbol || 'UNKNOWN', `High manipulation risk detected`);
        logger.info(`Trade blocked due to high manipulation risk`);
      }
    } else if (finalRecommendation === 'hold') {
      logger.info(`Trade not executed: recommendation is HOLD (CEO: ${tradeQuality.recommendation})`);
    } else {
      logger.info(`Trade not executed: combined confidence ${effectiveConfidence.toFixed(0)}% below threshold (AI: ${analysis.confidence}%, CEO: ${tradeQuality.totalScore.toFixed(0)}%)`);
    }
  }

  private async executeTrade(
    analysis: { recommendation: 'buy' | 'sell'; suggestedQuantity?: number; stopLoss?: number; takeProfit?: number },
    marketData: { symbol: string; price: number }[],
    portfolioState: { cash: number; positions: Record<string, number> }
  ): Promise<void> {
    // Execute trade only for the primary analyzed symbol (first in array)
    const primarySymbol = marketData[0];
    if (!primarySymbol) {
      logger.warn('No market data available for trade execution');
      return;
    }

    const md = primarySymbol;
    const recommendation = analysis.recommendation;

    let quantity = analysis.suggestedQuantity || riskManagementService.calculateQuantity(md.price, config.maxPositionSize);

    const riskCheck = riskManagementService.checkPositionSize(quantity, md.price);
    if (!riskCheck.approved) {
      logger.warn(`Trade not approved for ${md.symbol}: ${riskCheck.reason}`);
      return;
    }
    if (riskCheck.adjustedQuantity) {
      quantity = riskCheck.adjustedQuantity;
    }

    try {
      const trade = await tradingExecutorService.submitOrder(md.symbol, recommendation, quantity);
      memoryService.addTrade(trade);

      logger.info(`Trade executed: ${recommendation.toUpperCase()} ${quantity} ${md.symbol} @ $${md.price}`);
    } catch (error) {
      logger.error(`Failed to execute trade for ${md.symbol}:`, error);
    }
  }

  addUserInfo(content: string, source?: string): void {
    const info = userInfoProcessorService.addInfo(content, source);
    memoryService.addUserInfo(content, source);
  }

  getMemoryStats(): { total: number; byType: Record<string, number> } {
    return memoryService.getStats();
  }

  private async updateTradeOutcomes(): Promise<void> {
    try {
      const positions = await tradingExecutorService.getPositions();

      for (const position of positions) {
        const symbol = position.symbol;
        const qty = parseFloat(position.qty);

        if (qty > 0) {
          // Find trades for this symbol in memory
          const trades = memoryService.getRecent('trade', 50).filter(m => {
            const trade = m.metadata?.trade as any;
            return trade?.symbol === symbol && trade?.side === 'buy';
          });

          // Update outcome for open positions
          for (const tradeEntry of trades) {
            const trade = tradeEntry.metadata?.trade as any;
            if (trade && !tradeEntry.outcome) {
              const quotes = await marketDataService.getQuotes([symbol]);
              const currentPrice = quotes[0]?.price || 0;
              if (currentPrice > 0) {
                const profitLoss = (currentPrice - trade.price) * trade.quantity;
                memoryService.updateTradeOutcome(trade.id, {
                  tradeId: trade.id,
                  profitLoss,
                  exitedAt: Date.now(),
                });
                logger.info(`Updated trade outcome: ${symbol} P&L: $${profitLoss.toFixed(2)}`);
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error updating trade outcomes:', error);
    }
  }

  getLearningStats(): { wins: number; losses: number; total: number } {
    return memoryService.learnFromOutcomes();
  }
}

export const tradeBot = new TradeBot();