import { config } from './config';
import { logger } from './utils/logger';
import { marketDataService } from './services/marketData';
import { aiAnalysisService } from './services/aiAnalysis';
import { memoryService } from './services/memory';
import { riskManagementService } from './services/riskManagement';
import { tradingExecutorService } from './services/tradingExecutor';
import { userInfoProcessorService } from './services/userInfoProcessor';
import { AIAnalysisRequest } from './types';
import { newsIntelligenceService } from './services/newsIntelligence';
import { agentCommService } from './services/agentCommunication';
import { enhancedTradeEvaluator } from './services/enhancedTradeEvaluator';

export class TradeBot {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;
  private newsIntervalId: NodeJS.Timeout | null = null;
  private watchedSymbols: string[] = [];

  start(symbols: string[]): void {
    if (this.running) {
      logger.warn('Bot is already running');
      return;
    }

    this.watchedSymbols = symbols;
    this.running = true;
    logger.info(`TradeBot starting with symbols: ${symbols.join(', ')}`);

    // Start automated news scraping every hour
    this.startNewsAutomation();

    this.tick();
    this.intervalId = setInterval(() => this.tick(), config.pollIntervalMs);
  }

  private async startNewsAutomation(): Promise<void> {
    logger.info('Starting automated news scraping (every 15 minutes)');

    // Run initial scrape immediately
    this.runComprehensiveNewsScrape();

    // Then run every hour
    this.newsIntervalId = setInterval(() => {
      this.runComprehensiveNewsScrape();
    }, 15 * 60 * 1000); // 15 minutes
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
      const marketData = await marketDataService.getQuotes(this.watchedSymbols);
      logger.debug(`Fetched market data for ${marketData.length} symbols`);

      const portfolioState = await tradingExecutorService.getPortfolioState();
      logger.debug(`Portfolio value: $${portfolioState.totalValue}`);

      // Agent communication: Broadcast market data availability
      agentCommService.broadcast('MarketDataAgent', 'analysis', `Market data updated: ${marketData.length} symbols`, { symbols: marketData.map(m => m.symbol) });

      // Check and update trade outcomes (learning)
      await this.updateTradeOutcomes();

      // NEWS INTELLIGENCE - Required before any trade decision
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

      // Build news context for each symbol
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

      // Run multi-agent evaluation BEFORE AI analysis - agents communicate their findings
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
      logger.debug(`Reasoning: ${analysis.reasoning}`);

      // Apply news intelligence gate - if manipulation risk is high, reject trade
      const primarySymbol = marketData[0]?.symbol;
      const primaryNews = primarySymbol ? newsIntelligence.get(primarySymbol) : null;

      // Agent communication: Share AI analysis
      agentCommService.shareRecommendation('AIAnalyzer', primarySymbol || 'UNKNOWN', analysis.recommendation, analysis.confidence, analysis.reasoning.substring(0, 100));

      if (primaryNews && primaryNews.riskFactors.length > 0) {
        agentCommService.raiseWarning('RiskAgent', `High manipulation risk for ${primarySymbol}: ${primaryNews.riskFactors.length} risk factors detected`);
        logger.warn(`Manipulation/ Risk factors detected for ${primarySymbol}:`);
        for (const risk of primaryNews.riskFactors) {
          logger.warn(`  - ${risk}`);
        }
      }

      memoryService.addAnalysis(
        `${analysis.recommendation.toUpperCase()} - Confidence: ${analysis.confidence}%`,
        analysis.recommendation,
        analysis.confidence
      );

      // Combine AI confidence with CEO trade quality score for final decision
      const effectiveConfidence = Math.max(analysis.confidence, tradeQuality.totalScore);
      const finalRecommendation = tradeQuality.recommendation === 'approve' ? 'buy' : tradeQuality.recommendation === 'reject' ? 'sell' : 'hold';

      // Execute if either AI or CEO recommends action with sufficient confidence
      if (effectiveConfidence > 50 && finalRecommendation !== 'hold') {
        // Additional check: if news shows high manipulation risk, reduce confidence threshold
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
    } catch (error) {
      logger.error('Error during tick:', error);
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Tick completed in ${elapsed}ms`);
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