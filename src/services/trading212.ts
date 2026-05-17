import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface Trading212Account {
  id: string;
  balance: number;
  currency: string;
  equity: number;
  freeCash: number;
  leverage: number;
}

export interface Trading212Position {
  ticker: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface Trading212Order {
  id: string;
  ticker: string;
  quantity: number;
  side: 'buy' | 'sell';
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: string;
}

export interface Trading212Quote {
  ticker: string;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export class Trading212Service {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = config.trading212ApiKey || process.env.TRADING212_API_KEY || '';

    this.client = axios.create({
      baseURL: 'https://api.trading212.com',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Trading 212 API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async getAccount(): Promise<Trading212Account> {
    try {
      const response = await this.client.get('/v3/account');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Trading 212 account:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Trading212Position[]> {
    try {
      const response = await this.client.get('/v3/positions');
      return response.data.map((pos: any) => ({
        ticker: pos.ticker,
        symbol: pos.ticker,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.currentPrice,
        profitLoss: pos.profitLoss,
        profitLossPercent: pos.profitLossPercent,
      }));
    } catch (error) {
      logger.error('Failed to get Trading 212 positions:', error);
      throw error;
    }
  }

  async getOrders(): Promise<Trading212Order[]> {
    try {
      const response = await this.client.get('/v3/orders');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Trading 212 orders:', error);
      throw error;
    }
  }

  async submitOrder(ticker: string, side: 'buy' | 'sell', quantity: number, orderType: 'market' | 'limit' = 'market', limitPrice?: number): Promise<Trading212Order> {
    try {
      const orderData: any = {
        instrument: ticker,
        quantity,
        side,
        type: orderType,
        timeInForce: 'DAY',
      };

      if (orderType === 'limit' && limitPrice) {
        orderData.limitPrice = limitPrice;
      }

      const response = await this.client.post('/v3/orders', orderData);
      logger.info(`Trading 212 order submitted: ${side.toUpperCase()} ${quantity} ${ticker}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to submit Trading 212 order for ${ticker}:`, error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.delete(`/v3/orders/${orderId}`);
      logger.info(`Trading 212 order cancelled: ${orderId}`);
    } catch (error) {
      logger.error(`Failed to cancel Trading 212 order ${orderId}:`, error);
      throw error;
    }
  }

  async getQuote(ticker: string): Promise<Trading212Quote> {
    try {
      const response = await this.client.get(`/v3/quotes/${ticker}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Trading 212 quote for ${ticker}:`, error);
      throw error;
    }
  }

  async getQuotes(tickers: string[]): Promise<Trading212Quote[]> {
    try {
      const response = await this.client.post('/v3/quotes', { tickers });
      return response.data;
    } catch (error) {
      logger.error('Failed to get Trading 212 quotes:', error);
      throw error;
    }
  }

  async getPortfolioValue(): Promise<{ totalValue: number; cash: number; positionsValue: number }> {
    try {
      const account = await this.getAccount();
      const positions = await this.getPositions();

      const positionsValue = positions.reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);

      return {
        totalValue: account.equity,
        cash: account.freeCash,
        positionsValue,
      };
    } catch (error) {
      logger.error('Failed to get Trading 212 portfolio value:', error);
      throw error;
    }
  }
}

export const trading212Service = new Trading212Service();