import { config } from './config';
import { logger } from './utils/logger';
import { marketDataService } from './services/marketData';
import { aiAnalysisService } from './services/aiAnalysis';
import { memoryService } from './services/memory';
import { riskManagementService } from './services/riskManagement';
import { tradingExecutorService } from './services/tradingExecutor';
import { userInfoProcessorService } from './services/userInfoProcessor';
import { AIAnalysisRequest } from './types';

export class TradeBot {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;
  private watchedSymbols: string[] = [];

  start(symbols: string[]): void {
    if (this.running) {
      logger.warn('Bot is already running');
      return;
    }

    this.watchedSymbols = symbols;
    this.running = true;
    logger.info(`TradeBot starting with symbols: ${symbols.join(', ')}`);

    this.tick();
    this.intervalId = setInterval(() => this.tick(), config.pollIntervalMs);
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

      const recentTrades = memoryService.getRecent('trade', 10).map(m => m.metadata?.trade).filter(Boolean);
      const userInfos = userInfoProcessorService.getRecentInfos(10);
      const memoryContext = memoryService.getContext(20);

      const analysisRequest: AIAnalysisRequest = {
        marketData,
        portfolioState,
        recentTrades: recentTrades as any[],
        userInfos,
        memoryContext,
      };

      const analysis = await aiAnalysisService.analyze(analysisRequest);
      logger.info(`AI Recommendation: ${analysis.recommendation} (confidence: ${analysis.confidence}%)`);
      logger.debug(`Reasoning: ${analysis.reasoning}`);

      memoryService.addAnalysis(
        `${analysis.recommendation.toUpperCase()} - Confidence: ${analysis.confidence}%`,
        analysis.recommendation,
        analysis.confidence
      );

      if (analysis.recommendation !== 'hold' && analysis.confidence > 60) {
        const rec = analysis.recommendation as 'buy' | 'sell';
        await this.executeTrade({ ...analysis, recommendation: rec }, marketData, portfolioState);
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
    portfolioState: { cash: number; positions: Map<string, number> }
  ): Promise<void> {
    for (const md of marketData) {
      const recommendation = analysis.recommendation;

      let quantity = analysis.suggestedQuantity || riskManagementService.calculateQuantity(md.price, config.maxPositionSize);

      const riskCheck = riskManagementService.checkPositionSize(quantity, md.price);
      if (!riskCheck.approved) {
        logger.warn(`Trade not approved: ${riskCheck.reason}`);
        continue;
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
  }

  addUserInfo(content: string, source?: string): void {
    const info = userInfoProcessorService.addInfo(content, source);
    memoryService.addUserInfo(content, source);
  }

  getMemoryStats(): { total: number; byType: Record<string, number> } {
    return memoryService.getStats();
  }

  getLearningStats(): { wins: number; losses: number; total: number } {
    return memoryService.learnFromOutcomes();
  }
}

export const tradeBot = new TradeBot();