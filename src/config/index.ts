import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  anthropicApiKey: string;
  miniMaxApiKey: string;
  aiProvider: 'anthropic' | 'minimax';
  alpacaApiKey: string;
  alpacaSecretKey: string;
  trading212ApiKey: string;
  tradingMode: 'paper' | 'live';
  pollIntervalMs: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  slippageRate: number;
  dataDir: string;
  qdrantHost: string;
  qdrantPort: number;
  qdrantCollection: string;
  qualityThreshold: number;
}

export function loadConfig(): Config {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    miniMaxApiKey: process.env.MINIMAX_API_KEY || '',
    aiProvider: (process.env.AI_PROVIDER as 'anthropic' | 'minimax') || 'minimax',
    alpacaApiKey: process.env.ALPACA_API_KEY || '',
    alpacaSecretKey: process.env.ALPACA_SECRET_KEY || '',
    trading212ApiKey: process.env.TRADING212_API_KEY || '',
    tradingMode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10) || 60000,
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000') || 1000,
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '200') || 200,
    slippageRate: parseFloat(process.env.SLIPPAGE_RATE || '0.0005') || 0.0005,
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333', 10) || 6333,
    qdrantCollection: process.env.QDRANT_COLLECTION || 'tradebot_trades',
    qualityThreshold: parseFloat(process.env.QUALITY_THRESHOLD || '65'),
  };
}

export const config = loadConfig();