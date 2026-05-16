import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Trade, TradeParameters, TradeEvaluation } from '../types';

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  status: string;
  quality_score: number | null;
  evaluation_details: string | null;
  is_good_trade: number | null;
  parameters: string | null;
  embedding_id: string | null;
  profit_loss: number | null;
}

export interface TradeParametersRecord {
  tradeId: string;
  riskScore: number;
  riskToReward: number;
  trendAlignment: number;
  volatilityScore: number;
  liquidityScore: number;
  momentumConfirmation: number;
  executionEfficiency: number;
  marketConditionScore: number;
  positionSize: number;
  stopLoss: number | null;
  takeProfit: number | null;
  stopLossPct: number | null;
  takeProfitPct: number | null;
  holdingPeriod: number | null;
  drawdown: number | null;
}

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(config.dataDir, 'trades.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        quality_score REAL,
        evaluation_details TEXT,
        is_good_trade INTEGER,
        parameters TEXT,
        embedding_id TEXT,
        profit_loss REAL
      );

      CREATE TABLE IF NOT EXISTS trade_parameters (
        trade_id TEXT REFERENCES trades(id),
        risk_score REAL,
        risk_to_reward REAL,
        trend_alignment REAL,
        volatility_score REAL,
        liquidity_score REAL,
        momentum_confirmation REAL,
        execution_efficiency REAL,
        market_condition_score REAL,
        position_size REAL,
        stop_loss REAL,
        take_profit REAL,
        stop_loss_pct REAL,
        take_profit_pct REAL,
        holding_period INTEGER,
        drawdown REAL
      );

      CREATE TABLE IF NOT EXISTS learning_log (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        trade_id TEXT REFERENCES trades(id),
        learning_type TEXT,
        content TEXT,
        embedding_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_is_good ON trades(is_good_trade);
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

      CREATE TABLE IF NOT EXISTS news_articles (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        source TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sentiment_score REAL,
        volatility_score REAL,
        confidence_score REAL,
        institutional_impact_score REAL,
        duration_score REAL,
        manipulation_risk_score REAL,
        classification TEXT,
        key_themes TEXT,
        relevant_symbols TEXT,
        scraped_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sentiment_data (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        symbol TEXT,
        sentiment TEXT,
        score REAL,
        volume INTEGER,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS economic_releases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT,
        importance TEXT,
        release_date INTEGER,
        previous_value REAL,
        forecast_value REAL,
        actual_value REAL,
        impact_score REAL
      );

      CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
      CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news_articles(timestamp);
      CREATE INDEX IF NOT EXISTS idx_news_classification ON news_articles(classification);
      CREATE INDEX IF NOT EXISTS idx_sentiment_source ON sentiment_data(source);
      CREATE INDEX IF NOT EXISTS idx_sentiment_timestamp ON sentiment_data(timestamp);
    `);
    logger.info('Database initialized');
  }

  insertTrade(trade: Trade, parameters?: TradeParameters): void {
    const stmt = this.db.prepare(`
      INSERT INTO trades (id, symbol, side, quantity, price, timestamp, status, parameters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      trade.id,
      trade.symbol,
      trade.side,
      trade.quantity,
      trade.price,
      trade.timestamp,
      trade.status,
      parameters ? JSON.stringify(parameters) : null
    );
    logger.debug(`Trade ${trade.id} inserted`);
  }

  updateTradeEvaluation(
    tradeId: string,
    evaluation: TradeEvaluation
  ): void {
    const stmt = this.db.prepare(`
      UPDATE trades SET
        quality_score = ?,
        evaluation_details = ?,
        is_good_trade = ?,
        profit_loss = ?
      WHERE id = ?
    `);
    stmt.run(
      evaluation.qualityScore,
      JSON.stringify(evaluation.evaluationDetails),
      evaluation.isGoodTrade ? 1 : 0,
      evaluation.profitLoss || null,
      tradeId
    );
    logger.debug(`Trade ${tradeId} evaluation updated: ${evaluation.qualityScore}`);
  }

  insertTradeParameters(tradeId: string, params: TradeParametersRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO trade_parameters (
        trade_id, risk_score, risk_to_reward, trend_alignment,
        volatility_score, liquidity_score, momentum_confirmation,
        execution_efficiency, market_condition_score, position_size,
        stop_loss, take_profit, stop_loss_pct, take_profit_pct,
        holding_period, drawdown
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      tradeId, params.riskScore, params.riskToReward, params.trendAlignment,
      params.volatilityScore, params.liquidityScore, params.momentumConfirmation,
      params.executionEfficiency, params.marketConditionScore, params.positionSize,
      params.stopLoss, params.takeProfit, params.stopLossPct, params.takeProfitPct,
      params.holdingPeriod, params.drawdown
    );
  }

  getTrade(id: string): TradeRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM trades WHERE id = ?');
    return stmt.get(id) as TradeRecord | undefined;
  }

  getTradesBySymbol(symbol: string, limit: number = 50): TradeRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM trades WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(symbol, limit) as TradeRecord[];
  }

  getGoodTrades(symbol: string, limit: number = 10): TradeRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM trades WHERE symbol = ? AND is_good_trade = 1 ORDER BY quality_score DESC LIMIT ?'
    );
    return stmt.all(symbol, limit) as TradeRecord[];
  }

  getBadTrades(symbol: string, limit: number = 10): TradeRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM trades WHERE symbol = ? AND is_good_trade = 0 ORDER BY quality_score ASC LIMIT ?'
    );
    return stmt.all(symbol, limit) as TradeRecord[];
  }

  insertNewsArticle(article: {
    headline: string;
    content: string;
    url: string;
    source: string;
    timestamp: number;
    scores: {
      sentimentScore: number;
      volatilityScore: number;
      confidenceScore: number;
      institutionalImpactScore: number;
      durationScore: number;
      manipulationRiskScore: number;
    };
    classification: 'bullish' | 'bearish' | 'neutral';
    keyThemes: string[];
    relevantSymbols: string[];
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO news_articles (
        id, url, title, content, source, timestamp,
        sentiment_score, volatility_score, confidence_score,
        institutional_impact_score, duration_score, manipulation_risk_score,
        classification, key_themes, relevant_symbols, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const id = `news_${article.timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    stmt.run(
      id,
      article.url,
      article.headline,
      article.content,
      article.source,
      article.timestamp,
      article.scores.sentimentScore,
      article.scores.volatilityScore,
      article.scores.confidenceScore,
      article.scores.institutionalImpactScore,
      article.scores.durationScore,
      article.scores.manipulationRiskScore,
      article.classification,
      JSON.stringify(article.keyThemes),
      JSON.stringify(article.relevantSymbols),
      Date.now()
    );

    logger.debug(`News article inserted: ${article.headline.substring(0, 30)}...`);
  }

  getAllTradesWithOutcome(limit: number = 100): TradeRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM trades WHERE is_good_trade IS NOT NULL ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(limit) as TradeRecord[];
  }

  setEmbeddingId(tradeId: string, embeddingId: string): void {
    const stmt = this.db.prepare('UPDATE trades SET embedding_id = ? WHERE id = ?');
    stmt.run(embeddingId, tradeId);
  }

  addLearningLog(tradeId: string, learningType: string, content: string, embeddingId?: string): void {
    const id = `lrn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO learning_log (id, timestamp, trade_id, learning_type, content, embedding_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, Date.now(), tradeId, learningType, content, embeddingId || null);
  }

  getLearningLog(limit: number = 50): { id: string; timestamp: number; tradeId: string; learningType: string; content: string }[] {
    const stmt = this.db.prepare(
      'SELECT id, timestamp, trade_id, learning_type, content FROM learning_log ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(limit) as any[];
  }

  getStats(): { totalTrades: number; goodTrades: number; badTrades: number; avgQualityScore: number } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE is_good_trade IS NOT NULL');
    const goodStmt = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE is_good_trade = 1');
    const badStmt = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE is_good_trade = 0');
    const avgStmt = this.db.prepare('SELECT AVG(quality_score) as avg FROM trades WHERE quality_score IS NOT NULL');

    const total = (totalStmt.get() as any).count;
    const good = (goodStmt.get() as any).count;
    const bad = (badStmt.get() as any).count;
    const avg = (avgStmt.get() as any).avg || 0;

    return { totalTrades: total, goodTrades: good, badTrades: bad, avgQualityScore: avg };
  }

  close(): void {
    this.db.close();
  }
}

export const databaseService = new DatabaseService();