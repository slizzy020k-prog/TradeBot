export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

export interface PortfolioState {
  cash: number;
  positions: Record<string, number>;
  totalValue: number;
  dailyPnL: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
}

export interface AIAnalysisResponse {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedQuantity?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskAssessment?: 'low' | 'medium' | 'high';
  marketRegime?: string;
}

export interface NewsIntelligenceResult {
  symbol: string;
  hasNews: boolean;
  aggregatedSentiment: {
    overall: 'bullish' | 'bearish' | 'neutral';
    score: number;
    confidence: number;
    manipulationRisk: number;
    articleCount: number;
  };
  bullishFactors: string[];
  bearishFactors: string[];
  riskFactors: string[];
  recommendation: string;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'trade' | 'analysis' | 'user_info' | 'market_event';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RiskStatus {
  dailyLoss: number;
  maxDailyLoss: number;
  maxPositionSize: number;
}

export interface BotStatus {
  running: boolean;
  symbols: string[];
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
}

export interface AgentStatus {
  name: string;
  status: 'idle' | 'processing' | 'error';
  lastActivity?: number;
  score?: number;
}