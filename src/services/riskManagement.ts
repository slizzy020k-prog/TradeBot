import { config } from '../config';
import { logger } from '../utils/logger';

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  adjustedQuantity?: number;
}

export class RiskManagementService {
  private dailyLoss = 0;
  private lastResetDate = new Date().toDateString();

  checkPositionSize(quantity: number, price: number): RiskCheckResult {
    const totalCost = quantity * price;

    if (totalCost > config.maxPositionSize) {
      const adjustedQty = Math.floor(config.maxPositionSize / price);
      logger.warn(`Position size exceeded limit. Adjusted from ${quantity} to ${adjustedQty}`);
      return {
        approved: true,
        reason: `Reduced quantity from ${quantity} to ${adjustedQty} to respect max position size`,
        adjustedQuantity: adjustedQty,
      };
    }

    return { approved: true };
  }

  checkDailyLossLimit(currentLoss: number): RiskCheckResult {
    this.resetDailyLossIfNeeded();

    if (this.dailyLoss + currentLoss > config.maxDailyLoss) {
      logger.warn(`Daily loss limit would be exceeded: ${this.dailyLoss} + ${currentLoss} > ${config.maxDailyLoss}`);
      return {
        approved: false,
        reason: 'Daily loss limit exceeded',
      };
    }

    return { approved: true };
  }

  updateDailyLoss(amount: number): void {
    this.resetDailyLossIfNeeded();
    this.dailyLoss += amount;
    logger.info(`Daily P&L updated: $${this.dailyLoss.toFixed(2)}`);
  }

  private resetDailyLossIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyLoss = 0;
      this.lastResetDate = today;
      logger.info('Daily loss tracker reset for new day');
    }
  }

  calculateStopLoss(buyPrice: number, percent: number = 2): number {
    return buyPrice * (1 - percent / 100);
  }

  calculateTakeProfit(buyPrice: number, percent: number = 5): number {
    return buyPrice * (1 + percent / 100);
  }

  calculateQuantity(price: number, maxAmount: number): number {
    return Math.floor(maxAmount / price);
  }

  getDailyLoss(): number {
    this.resetDailyLossIfNeeded();
    return this.dailyLoss;
  }
}

export const riskManagementService = new RiskManagementService();