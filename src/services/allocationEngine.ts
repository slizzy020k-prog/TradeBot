import { PortfolioState, AllocationTarget, PortfolioAllocation, MacroRegime, AssetClass, OpportunityScore } from '../types';
import { macroRegimeService } from './macroRegime';
import { marketScannerService } from './marketScanner';
import { logger } from '../utils/logger';

export class AllocationEngineService {

  calculateAllocation(
    portfolioState: PortfolioState,
    currentPositions: Record<string, number>,
    opportunities: OpportunityScore[]
  ): PortfolioAllocation {
    const regime = macroRegimeService.getLastRegime();
    const regimeAdjustments = macroRegimeService.getRegimeAllocationAdjustments(regime);

    const allocations: AllocationTarget[] = this.buildBaseAllocations();

    for (const target of allocations) {
      const adj = regimeAdjustments[target.assetClass] || 0;
      target.targetWeight = Math.max(target.minWeight, Math.min(target.maxWeight, target.targetWeight + adj));
    }

    this.normalizeAllocations(allocations);
    this.updateCurrentWeights(allocations, portfolioState, currentPositions);
    this.applyOpportunityAdjustments(allocations, opportunities);

    const concentrationRisk = this.calculateConcentrationRisk(allocations);

    if (concentrationRisk > 0.5) {
      this.rebalanceForDiversification(allocations);
    }

    return {
      totalValue: portfolioState.totalValue,
      cash: portfolioState.cash,
      allocations,
      regime,
      concentrationRisk,
      updatedAt: Date.now(),
    };
  }

  private buildBaseAllocations(): AllocationTarget[] {
    return [
      { assetClass: 'equities', currentWeight: 0, targetWeight: 0.30, minWeight: 0.10, maxWeight: 0.50, enabled: true },
      { assetClass: 'crypto', currentWeight: 0, targetWeight: 0.08, minWeight: 0, maxWeight: 0.15, enabled: true },
      { assetClass: 'forex', currentWeight: 0, targetWeight: 0.10, minWeight: 0.02, maxWeight: 0.20, enabled: true },
      { assetClass: 'commodities', currentWeight: 0, targetWeight: 0.08, minWeight: 0, maxWeight: 0.15, enabled: true },
      { assetClass: 'etfs', currentWeight: 0, targetWeight: 0.12, minWeight: 0.05, maxWeight: 0.25, enabled: true },
      { assetClass: 'bonds', currentWeight: 0, targetWeight: 0.20, minWeight: 0.05, maxWeight: 0.40, enabled: true },
    ];
  }

  private normalizeAllocations(allocations: AllocationTarget[]): void {
    const total = allocations.reduce((sum, a) => sum + a.targetWeight, 0);
    if (total === 0) return;
    for (const a of allocations) {
      a.targetWeight /= total;
    }
  }

  private updateCurrentWeights(
    allocations: AllocationTarget[],
    portfolioState: PortfolioState,
    positions: Record<string, number>
  ): void {
    // Reset all weights
    for (const target of allocations) {
      target.currentWeight = 0;
    }

    const positionValue = portfolioState.totalValue - portfolioState.cash;
    if (positionValue <= 0) return;

    // Get market data to determine asset classes and values
    const symbols = Object.keys(positions);
    if (symbols.length === 0) return;

    // Calculate position values by asset class
    const classValues: Record<string, number> = {};
    for (const target of allocations) {
      classValues[target.assetClass] = 0;
    }

    // We need to get current prices to calculate actual values
    // For now, estimate based on portfolio percentage if we have total position value
    // This will be refined when market data is available
    const avgPositionValue = positionValue / Math.max(1, symbols.length);

    // Use market scanner to infer asset classes for each symbol
    for (const symbol of symbols) {
      const assetClass = marketScannerService.inferAssetClass(symbol);
      const qty = positions[symbol] || 0;
      // Estimate value - in real implementation would fetch current price
      const estimatedValue = avgPositionValue; // Placeholder - real impl would use current price
      const current = classValues[assetClass] || 0;
      classValues[assetClass] = current + estimatedValue;
    }

    // Update current weights based on actual position values
    for (const target of allocations) {
      const value = classValues[target.assetClass] || 0;
      target.currentWeight = positionValue > 0 ? value / positionValue : 0;
    }
  }

  private applyOpportunityAdjustments(
    allocations: AllocationTarget[],
    opportunities: OpportunityScore[]
  ): void {
    if (opportunities.length === 0) return;

    const byAssetClass = new Map<AssetClass, OpportunityScore[]>();
    for (const opp of opportunities) {
      const existing = byAssetClass.get(opp.assetClass) || [];
      existing.push(opp);
      byAssetClass.set(opp.assetClass, existing);
    }

    for (const target of allocations) {
      const opps = byAssetClass.get(target.assetClass) || [];
      if (opps.length === 0) continue;

      const avgScore = opps.reduce((sum, o) => sum + o.totalScore, 0) / opps.length;
      const scoreBoost = (avgScore - 50) / 500;

      target.targetWeight = Math.max(
        target.minWeight,
        Math.min(target.maxWeight, target.targetWeight + scoreBoost)
      );
    }

    this.normalizeAllocations(allocations);
  }

  private calculateConcentrationRisk(allocations: AllocationTarget[]): number {
    const weights = allocations.filter(a => a.enabled).map(a => a.currentWeight);
    return weights.reduce((sum, w) => sum + w * w, 0);
  }

  private rebalanceForDiversification(allocations: AllocationTarget[]): void {
    const excess = allocations.filter(a => a.currentWeight > a.maxWeight);
    const deficit = allocations.filter(a => a.currentWeight < a.minWeight);

    for (const e of excess) {
      const reduceBy = e.currentWeight - e.maxWeight;
      e.currentWeight = e.maxWeight;

      const perDeficit = reduceBy / Math.max(1, deficit.length);
      for (const d of deficit) {
        d.currentWeight = Math.min(d.maxWeight, d.currentWeight + perDeficit);
      }
    }
  }

  shouldTradeSymbol(
    symbol: string,
    assetClass: AssetClass,
    allocation: PortfolioAllocation,
    currentPositions: Record<string, number>
  ): { shouldTrade: boolean; reason: string; suggestedQuantity?: number } {
    const target = allocation.allocations.find(a => a.assetClass === assetClass);
    if (!target || !target.enabled) {
      return { shouldTrade: false, reason: 'Asset class disabled' };
    }

    const currentPosition = currentPositions[symbol] || 0;
    const currentValue = currentPosition;
    const currentWeight = currentValue / allocation.totalValue;

    if (currentWeight < target.minWeight) {
      const diff = target.minWeight - currentWeight;
      return {
        shouldTrade: true,
        reason: `Underweight in ${assetClass}`,
        suggestedQuantity: Math.floor((diff * allocation.totalValue) / 100),
      };
    }

    if (currentWeight > target.maxWeight) {
      return {
        shouldTrade: true,
        reason: `Overweight in ${assetClass}`,
        suggestedQuantity: Math.floor(currentPosition * 0.5),
      };
    }

    return { shouldTrade: false, reason: 'Within allocation bounds' };
  }
}

export const allocationEngineService = new AllocationEngineService();