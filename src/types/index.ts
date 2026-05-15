export interface TradeParameters {
  riskScore?: number;
  riskToReward?: number;
  trendAlignment?: number;
  volatilityScore?: number;
  liquidityScore?: number;
  momentumConfirmation?: number;
  executionEfficiency?: number;
  marketConditionScore?: number;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  holdingPeriod?: number;
  drawdown?: number;
  profitLoss?: number;
}

export interface TradeEvaluation {
  qualityScore: number;
  isGoodTrade: boolean;
  evaluationDetails: TradeParameters;
  profitLoss?: number;
}

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

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  aiRecommendation?: string;
  parameters?: TradeParameters;
}

export interface TradeOutcome {
  tradeId: string;
  profitLoss: number;
  exitedAt: number;
  notes?: string;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'trade' | 'analysis' | 'user_info' | 'market_event';
  content: string;
  metadata?: Record<string, unknown>;
  outcome?: TradeOutcome;
}

export interface AIAgent {
  role: 'analyzer' | 'risk_manager' | 'trader';
  name: string;
  systemPrompt: string;
}

export interface UserInfo {
  id: string;
  timestamp: number;
  content: string;
  source?: string;
  relevance?: number;
}

export interface PortfolioState {
  cash: number;
  positions: Map<string, number>;
  totalValue: number;
  dailyPnL: number;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxPortfolioExposure: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export interface AIAnalysisRequest {
  marketData: MarketData[];
  portfolioState: PortfolioState;
  recentTrades: Trade[];
  userInfos: UserInfo[];
  memoryContext: MemoryEntry[];
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

export type TradingMode = 'paper' | 'live';