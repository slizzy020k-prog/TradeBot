import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './src/config';
import { marketDataService } from './src/services/marketData';
import { tradingExecutorService } from './src/services/tradingExecutor';
import { aiAnalysisService } from './src/services/aiAnalysis';
import { memoryService } from './src/services/memory';
import { riskManagementService } from './src/services/riskManagement';
import { newsIntelligenceService } from './src/services/newsIntelligence';
import { TradeBot } from './src/bot';
import { logger } from './src/utils/logger';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Initialize TradeBot singleton
const tradeBot = new TradeBot();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Market data
app.get('/api/market/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',');
    const data = await marketDataService.getQuotes(symbols);
    res.json(data);
  } catch (error) {
    logger.error('Market data error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Portfolio state
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolio = await tradingExecutorService.getPortfolioState();
    res.json(portfolio);
  } catch (error) {
    logger.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Account info
app.get('/api/account', async (req, res) => {
  try {
    const account = await tradingExecutorService.getAccount();
    res.json(account);
  } catch (error) {
    logger.error('Account error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Submit order
app.post('/api/order', async (req, res) => {
  try {
    const { symbol, side, quantity } = req.body;
    if (!symbol || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const order = await tradingExecutorService.submitOrder(symbol, side, quantity);
    io.emit('trade:executed', order);
    res.json(order);
  } catch (error) {
    logger.error('Order error:', error);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

// Get orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await tradingExecutorService.getOrderStatus('all');
    res.json(orders);
  } catch (error) {
    logger.error('Orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Memory entries
app.get('/api/memory', (req, res) => {
  try {
    const { type, limit } = req.query;
    const entries = memoryService.getRecent(type as 'trade' | 'analysis' | 'user_info' | 'market_event' | undefined, Number(limit) || 50);
    res.json(entries);
  } catch (error) {
    logger.error('Memory error:', error);
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

// Stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      memory: memoryService.getStats(),
      learning: memoryService.learnFromOutcomes(),
      botStatus: tradeBot.status(),
    };
    res.json(stats);
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Risk status
app.get('/api/risk', (req, res) => {
  try {
    const dailyLoss = riskManagementService.getDailyLoss();
    res.json({
      dailyLoss,
      maxDailyLoss: config.maxDailyLoss,
      maxPositionSize: config.maxPositionSize,
    });
  } catch (error) {
    logger.error('Risk error:', error);
    res.status(500).json({ error: 'Failed to fetch risk status' });
  }
});

// News intelligence
app.get('/api/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const news = await newsIntelligenceService.getNewsForSymbol(symbol.toUpperCase());
    res.json(news);
  } catch (error) {
    logger.error('News error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Historical news context
app.get('/api/news/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit } = req.query;
    const history = await newsIntelligenceService.getHistoricalNewsContext(symbol.toUpperCase(), Number(limit) || 10);
    res.json(history);
  } catch (error) {
    logger.error('News history error:', error);
    res.status(500).json({ error: 'Failed to fetch news history' });
  }
});

// Trigger AI analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbols, portfolioState } = req.body;

    const marketData = await marketDataService.getQuotes(symbols);
    const portfolio = portfolioState || await tradingExecutorService.getPortfolioState();
    const recentTrades = memoryService.getRecent('trade', 10).map(m => m.metadata?.trade).filter(Boolean);
    const userInfos: any[] = []; // Could be fetched from userInfoProcessor
    const memoryContext = memoryService.getContext(20);

    const newsContext: Record<string, string> = {};
    for (const symbol of symbols) {
      const ni = await newsIntelligenceService.getNewsForSymbol(symbol);
      newsContext[symbol] = ni.newsContextForAI;
    }

    const analysis = await aiAnalysisService.analyze({
      marketData,
      portfolioState: portfolio,
      recentTrades: recentTrades as any[],
      userInfos,
      memoryContext,
      newsContext,
    });

    io.emit('analysis:complete', analysis);
    res.json(analysis);
  } catch (error) {
    logger.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

// Bot control
app.post('/api/bot/start', (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array required' });
    }
    tradeBot.start(symbols);
    res.json({ status: 'started', symbols });
  } catch (error) {
    logger.error('Bot start error:', error);
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

app.post('/api/bot/stop', (req, res) => {
  try {
    tradeBot.stop();
    res.json({ status: 'stopped' });
  } catch (error) {
    logger.error('Bot stop error:', error);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

app.get('/api/bot/status', (req, res) => {
  res.json(tradeBot.status());
});

// Add user info
app.post('/api/user-info', (req, res) => {
  try {
    const { content, source } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }
    tradeBot.addUserInfo(content, source);
    res.json({ status: 'added' });
  } catch (error) {
    logger.error('User info error:', error);
    res.status(500).json({ error: 'Failed to add user info' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Send current bot status
  socket.emit('bot:status', tradeBot.status());

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Periodic updates (every 5 seconds)
setInterval(() => {
  const status = tradeBot.status();
  io.emit('bot:status', status);

  if (status.running) {
    // Emit portfolio update
    tradingExecutorService.getPortfolioState()
      .then(portfolio => {
        io.emit('portfolio:update', portfolio);
      })
      .catch(() => {}); // Silently fail - portfolio might not be available
  }
}, 5000);

const PORT = process.env.API_PORT || 3001;

server.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);
  logger.info(`Market data endpoint: http://localhost:${PORT}/api/market/:symbols`);
  logger.info(`Portfolio endpoint: http://localhost:${PORT}/api/portfolio`);
  logger.info(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

export { app, io };