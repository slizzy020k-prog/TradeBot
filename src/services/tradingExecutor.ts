import axios from 'axios';
import { Trade, PortfolioState } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class TradingExecutorService {
  private baseUrl = 'https://paper-api.alpaca.markets';
  private headers: Record<string, string>;
  private slippageRate: number;
  private fillDelayMs: { min: number; max: number };
  private simulationMode: boolean;

  constructor() {
    this.headers = {
      'APCA-API-KEY-ID': config.alpacaApiKey,
      'APCA-API-SECRET-KEY': config.alpacaSecretKey,
    };
    this.slippageRate = config.slippageRate || 0.0005;
    this.fillDelayMs = { min: 100, max: 500 };
    this.simulationMode = config.tradingMode === 'paper';
  }

  applySlippage(price: number, side: 'buy' | 'sell'): number {
    const slippageMultiplier = 1 + (Math.random() - 0.5) * 2 * this.slippageRate;
    return price * slippageMultiplier;
  }

  async simulateFillDelay(): Promise<void> {
    if (!this.simulationMode) return;
    const delay = this.fillDelayMs.min + Math.random() * (this.fillDelayMs.max - this.fillDelayMs.min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async getAccount(): Promise<{ cash: number; portfolio_value: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/account`, { headers: this.headers });
      return {
        cash: parseFloat(response.data.cash),
        portfolio_value: parseFloat(response.data.portfolio_value),
      };
    } catch (error) {
      logger.error('Failed to get account:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Array<{ symbol: string; qty: string; market_value: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/positions`, { headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error('Failed to get positions:', error);
      throw error;
    }
  }

  async getPortfolioState(): Promise<PortfolioState> {
    try {
      const [account, positions] = await Promise.all([this.getAccount(), this.getPositions()]);

      const positionsMap: Record<string, number> = {};
      for (const pos of positions) {
        positionsMap[pos.symbol] = parseFloat(pos.qty);
      }

      return {
        cash: account.cash,
        positions: positionsMap,
        totalValue: account.portfolio_value,
        dailyPnL: 0,
      };
    } catch (error) {
      logger.error('Failed to get portfolio state:', error);
      throw error;
    }
  }

  async submitOrder(symbol: string, side: 'buy' | 'sell', quantity: number, type: 'market' | 'limit' = 'market'): Promise<Trade> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/orders`,
        {
          symbol,
          side,
          qty: quantity,
          type,
          time_in_force: 'day',
        },
        { headers: this.headers }
      );

      const trade: Trade = {
        id: response.data.id,
        symbol: response.data.symbol,
        side: response.data.side,
        quantity: parseInt(response.data.qty, 10) || 0,
        price: parseFloat(response.data.filled_avg_price || '0') || 0,
        timestamp: Date.now(),
        status: 'pending',
      };

      logger.info(`Order submitted: ${side.toUpperCase()} ${quantity} ${symbol}`);
      return trade;
    } catch (error) {
      logger.error(`Failed to submit order for ${symbol}:`, error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const url = orderId === 'all'
        ? `${this.baseUrl}/v2/orders?status=all`
        : `${this.baseUrl}/v2/orders/${orderId}`;
      const response = await axios.get(url, { headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get order status for ${orderId}:`, error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/v2/orders/${orderId}`, { headers: this.headers });
      logger.info(`Order ${orderId} cancelled`);
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }
}

export const tradingExecutorService = new TradingExecutorService();