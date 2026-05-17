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
  dividendRate?: number;
  dividendYield?: number;
  trailingAnnualDividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  peRatio?: number;
  eps?: number;
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
  positions: Record<string, number>;
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
  newsContext?: Record<string, string>;
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

// ============================================================
// MULTI-ASSET TRADING TYPES
// ============================================================

export type AssetClass = 'equities' | 'crypto' | 'forex' | 'commodities' | 'etfs' | 'bonds';

export type MacroRegime =
  | 'risk_on_bull'
  | 'risk_on_bear'
  | 'risk_off'
  | 'inflation'
  | 'deflation'
  | 'high_volatility'
  | 'low_volatility'
  | 'stagflation'
  | 'recovery'
  | 'normal';

export interface UniverseSymbol {
  symbol: string;
  assetClass: AssetClass;
  enabled: boolean;
  priority: number;
  weight?: number;
}

export interface MarketDataExtended extends MarketData {
  assetClass: AssetClass;
  quoteCurrency: string;
  baseCurrency?: string;
  contractSize?: number;
  exchange?: string;
}

export interface OpportunityScore {
  symbol: string;
  assetClass: AssetClass;
  totalScore: number;
  breakdown: {
    trendScore: number;
    momentumScore: number;
    valueScore: number;
    qualityScore: number;
    regimeScore: number;
    liquidityScore: number;
  };
  rank: number;
  globalRank: number;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  timestamp: number;
}

export interface CorrelationEntry {
  symbol1: string;
  symbol2: string;
  correlation: number;
  strength: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
  lookbackDays: number;
  updatedAt: number;
}

export interface AllocationTarget {
  assetClass: AssetClass;
  currentWeight: number;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  enabled: boolean;
}

export interface PortfolioAllocation {
  totalValue: number;
  cash: number;
  allocations: AllocationTarget[];
  regime: MacroRegime;
  concentrationRisk: number;
  updatedAt: number;
}

export interface MultiAssetContext {
  topOpportunities: OpportunityScore[];
  currentAllocation: PortfolioAllocation;
  regime: MacroRegime;
  concentrationRisk: number;
}