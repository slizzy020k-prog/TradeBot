import {
  SubAgentResult,
  CEOAssessment,
  TradeQualityScore,
  MarketRegime,
} from './types';
import { PERSONA_CONFIG } from '../../config/persona';
import { logger } from '../../utils/logger';

export interface CEOAnalysisInput {
  symbol: string;
  regime: MarketRegime;
  subAgentResults: SubAgentResult;
  proposedTrade?: {
    side: 'buy' | 'sell';
    quantity: number;
    confidence: number;
  };
  riskAssessment?: {
    passedHardLimits: boolean;
    violations: string[];
    riskToRewardRatio: number;
  };
}

export class CEOAgent {
  assess(input: CEOAnalysisInput): CEOAssessment {
    const {
      symbol,
      regime,
      subAgentResults,
      proposedTrade,
      riskAssessment,
    } = input;

    const strategicQuality = this.evaluateStrategicQuality(subAgentResults, regime);
    const riskIntegrity = this.evaluateRiskIntegrity(subAgentResults, riskAssessment);
    const executionPrecision = this.evaluateExecutionPrecision(subAgentResults);
    const institutionalDiscipline = this.evaluateInstitutionalDiscipline(subAgentResults, proposedTrade);
    const longTermSustainability = this.evaluateLongTermSustainability(subAgentResults);

    const override = this.checkOverrideConditions(strategicQuality, riskIntegrity, riskAssessment);
    const overrideReason = override ? this.getOverrideReason(strategicQuality, riskIntegrity, riskAssessment) : undefined;

    let finalRecommendation: 'approve' | 'reject' | 'caution' = 'approve';

    if (override) {
      finalRecommendation = 'reject';
    } else if (strategicQuality < 60 || riskIntegrity < 60) {
      finalRecommendation = 'caution';
    } else if (subAgentResults.trendScore < 50 && subAgentResults.momentumScore < 50) {
      finalRecommendation = 'caution';
    }

    const assessment: CEOAssessment = {
      strategicQuality,
      riskIntegrity,
      executionPrecision,
      institutionalDiscipline,
      longTermSustainability,
      override,
      overrideReason,
      finalRecommendation,
    };

    logger.info(`CEO Agent: ${symbol} - ${finalRecommendation.toUpperCase()} ` +
      `(Strategic: ${strategicQuality.toFixed(0)}, Risk: ${riskIntegrity.toFixed(0)}, ` +
      `Discipline: ${institutionalDiscipline.toFixed(0)})` +
      (override ? ` [OVERRIDE: ${overrideReason}]` : ''));

    return assessment;
  }

  computeTradeQualityScore(
    subAgentResults: SubAgentResult,
    ceoAssessment: CEOAssessment
  ): TradeQualityScore {
    const totalScore = this.weightedTotalScore(subAgentResults);

    let classification: TradeQualityScore['classification'];
    if (totalScore >= 90) classification = 'institutional_grade';
    else if (totalScore >= 80) classification = 'high_quality';
    else if (totalScore >= 70) classification = 'moderate_quality';
    else if (totalScore >= 60) classification = 'weak_opportunity';
    else classification = 'low_quality';

    let recommendation: 'approve' | 'reject' | 'caution';
    if (ceoAssessment.override) {
      recommendation = 'reject';
    } else if (totalScore >= 80) {
      recommendation = 'approve';
    } else if (totalScore >= 60) {
      recommendation = 'caution';
    } else {
      recommendation = 'reject';
    }

    return {
      totalScore,
      classification,
      breakdown: subAgentResults,
      ceoAssessment,
      recommendation,
    };
  }

  private weightedTotalScore(results: SubAgentResult): number {
    return (
      results.trendScore * 0.20 +
      results.regimeCompatibility * 0.15 +
      results.riskScore * 0.15 +
      results.liquidityScore * 0.10 +
      results.momentumScore * 0.10 +
      results.historicalEdgeScore * 0.10 +
      results.executionScore * 0.10 +
      results.volatilityScore * 0.05 +
      results.disciplineScore * 0.05
    );
  }

  private evaluateStrategicQuality(results: SubAgentResult, regime: MarketRegime): number {
    let score = 50;

    score += results.trendScore * 0.30;
    score += results.regimeCompatibility * 0.25;
    score += results.momentumScore * 0.20;
    score += results.historicalEdgeScore * 0.25;

    return Math.min(100, Math.max(0, score));
  }

  private evaluateRiskIntegrity(
    results: SubAgentResult,
    riskAssessment?: { passedHardLimits: boolean; violations: string[]; riskToRewardRatio: number }
  ): number {
    let score = 70;

    if (riskAssessment) {
      if (!riskAssessment.passedHardLimits) {
        score -= 30;
      }
      score += Math.min(20, riskAssessment.riskToRewardRatio * 10);
    } else {
      score += results.riskScore * 0.30;
    }

    return Math.min(100, Math.max(0, score));
  }

  private evaluateExecutionPrecision(results: SubAgentResult): number {
    return (
      results.executionScore * 0.50 +
      results.liquidityScore * 0.30 +
      results.volatilityScore * 0.20
    );
  }

  private evaluateInstitutionalDiscipline(
    results: SubAgentResult,
    proposedTrade?: { confidence: number }
  ): number {
    let score = results.disciplineScore;

    if (proposedTrade) {
      if (proposedTrade.confidence < PERSONA_CONFIG.minConfidenceScore) {
        score -= 20;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private evaluateLongTermSustainability(results: SubAgentResult): number {
    return (
      results.historicalEdgeScore * 0.40 +
      results.riskScore * 0.30 +
      results.trendScore * 0.30
    );
  }

  private checkOverrideConditions(
    strategicQuality: number,
    riskIntegrity: number,
    riskAssessment?: { passedHardLimits: boolean; violations: string[] }
  ): boolean {
    if (riskAssessment && !riskAssessment.passedHardLimits) {
      return true;
    }

    if (strategicQuality < 30 || riskIntegrity < 30) {
      return true;
    }

    if (riskAssessment && riskAssessment.violations.length > 3) {
      return true;
    }

    return false;
  }

  private getOverrideReason(
    strategicQuality: number,
    riskIntegrity: number,
    riskAssessment?: { passedHardLimits: boolean; violations: string[] }
  ): string {
    if (riskAssessment && !riskAssessment.passedHardLimits) {
      return `Hard risk limits violated: ${riskAssessment.violations.join(', ')}`;
    }

    if (strategicQuality < 30) {
      return 'Strategic quality critically low';
    }

    if (riskIntegrity < 30) {
      return 'Risk integrity critically compromised';
    }

    if (riskAssessment && riskAssessment.violations.length > 3) {
      return 'Excessive rule violations';
    }

    return 'CEO override triggered';
  }
}

export const ceoAgent = new CEOAgent();