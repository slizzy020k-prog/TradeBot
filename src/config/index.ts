import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  anthropicApiKey: string;
  miniMaxApiKey: string;
  aiProvider: 'anthropic' | 'minimax';
  alpacaApiKey: string;
  alpacaSecretKey: string;
  tradingMode: 'paper' | 'live';
  pollIntervalMs: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  dataDir: string;
}

export function loadConfig(): Config {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    miniMaxApiKey: process.env.MINIMAX_API_KEY || '',
    aiProvider: (process.env.AI_PROVIDER as 'anthropic' | 'minimax') || 'minimax',
    alpacaApiKey: process.env.ALPACA_API_KEY || '',
    alpacaSecretKey: process.env.ALPACA_SECRET_KEY || '',
    tradingMode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000'),
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '200'),
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  };
}

export const config = loadConfig();