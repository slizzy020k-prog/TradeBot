import axios from 'axios';
import { Trade, PortfolioState } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class TradingExecutorService {
  private baseUrl = 'https://paper-api.alpaca.markets';
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'APCA-API-KEY-ID': config.alpacaApiKey,
      'APCA-API-SECRET-KEY': config.alpacaSecretKey,
    };
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

      const positionsMap = new Map<string, number>();
      for (const pos of positions) {
        positionsMap.set(pos.symbol, parseFloat(pos.qty));
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
        quantity: parseInt(response.data.qty, 10),
        price: parseFloat(response.data.filled_avg_price || '0'),
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

  async getOrderStatus(orderId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/orders/${orderId}`, { headers: this.headers });
      return response.data.status;
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