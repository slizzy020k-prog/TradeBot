export type MarketRegime =
  | 'trending_bullish'
  | 'trending_bearish'
  | 'ranging'
  | 'breakout_expansion'
  | 'reversal_transition'
  | 'accumulation'
  | 'distribution'
  | 'high_volatility_instability'
  | 'low_liquidity_conditions'
  | 'news_driven_uncertainty'
  | 'manipulation_risk'
  | 'uncertain';

export interface AgentScore {
  agentName: string;
  score: number;
  details: string;
  timestamp: number;
}

export interface SubAgentResult {
  trendScore: number;
  volatilityScore: number;
  liquidityScore: number;
  momentumScore: number;
  riskScore: number;
  historicalEdgeScore: number;
  executionScore: number;
  regimeCompatibility: number;
  disciplineScore: number;
}

export interface CEOAssessment {
  strategicQuality: number;
  riskIntegrity: number;
  executionPrecision: number;
  institutionalDiscipline: number;
  longTermSustainability: number;
  override: boolean;
  overrideReason?: string;
  finalRecommendation: 'approve' | 'reject' | 'caution';
}

export interface TradeQualityScore {
  totalScore: number;
  classification: 'institutional_grade' | 'high_quality' | 'moderate_quality' | 'weak_opportunity' | 'low_quality';
  breakdown: SubAgentResult;
  ceoAssessment: CEOAssessment;
  recommendation: 'approve' | 'reject' | 'caution';
}

export interface TradeAnalysisContext {
  symbol: string;
  marketData: {
    price: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    close: number;
    timestamp: number;
  };
  portfolioState: {
    cash: number;
    totalValue: number;
    dailyPnL: number;
    positions: Map<string, number>;
  };
  regime: MarketRegime;
  subAgentResults?: SubAgentResult;
  recentTrades: any[];
  userInfos: any[];
}

export const REGIME_WEIGHTS: Record<MarketRegime, number> = {
  trending_bullish: 0.15,
  trending_bearish: 0.15,
  ranging: 0.10,
  breakout_expansion: 0.12,
  reversal_transition: 0.10,
  accumulation: 0.12,
  distribution: 0.12,
  high_volatility_instability: 0.05,
  low_liquidity_conditions: 0.03,
  news_driven_uncertainty: 0.03,
  manipulation_risk: 0.01,
  uncertain: 0.02,
};