import type {
  MarketData,
  PortfolioState,
  Trade,
  AIAnalysisResponse,
  NewsIntelligenceResult,
  MemoryEntry,
  RiskStatus,
  BotStatus,
  OrderRequest,
} from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async health() {
    return this.fetch<{ status: string; timestamp: number }>('/api/health');
  }

  // Market data
  async fetchQuotes(symbols: string[]): Promise<MarketData[]> {
    return this.fetch<MarketData[]>(`/api/market/${symbols.join(',')}`);
  }

  // Portfolio
  async getPortfolio(): Promise<PortfolioState> {
    return this.fetch<PortfolioState>('/api/portfolio');
  }

  async getAccount(): Promise<{ cash: number; portfolio_value: number }> {
    return this.fetch('/api/account');
  }

  // Orders
  async submitOrder(order: OrderRequest): Promise<Trade> {
    return this.fetch<Trade>('/api/order', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrders(): Promise<Trade[]> {
    return this.fetch<Trade[]>('/api/orders');
  }

  // Memory
  async getMemory(type?: string, limit = 50): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    params.set('limit', limit.toString());
    return this.fetch<MemoryEntry[]>(`/api/memory?${params}`);
  }

  // Stats
  async getStats() {
    return this.fetch('/api/stats');
  }

  // Risk
  async getRisk(): Promise<RiskStatus> {
    return this.fetch<RiskStatus>('/api/risk');
  }

  // News
  async getNews(symbol: string): Promise<NewsIntelligenceResult> {
    return this.fetch<NewsIntelligenceResult>(`/api/news/${symbol}`);
  }

  async getNewsHistory(symbol: string, limit = 10) {
    return this.fetch(`/api/news/${symbol}/history?limit=${limit}`);
  }

  // AI Analysis
  async analyze(symbols: string[]): Promise<AIAnalysisResponse> {
    return this.fetch<AIAnalysisResponse>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ symbols }),
    });
  }

  // Bot control
  async startBot(symbols: string[]): Promise<{ status: string; symbols: string[] }> {
    return this.fetch('/api/bot/start', {
      method: 'POST',
      body: JSON.stringify({ symbols }),
    });
  }

  async stopBot(): Promise<{ status: string }> {
    return this.fetch('/api/bot/stop', {
      method: 'POST',
    });
  }

  async getBotStatus(): Promise<BotStatus> {
    return this.fetch<BotStatus>('/api/bot/status');
  }

  // User info
  async addUserInfo(content: string, source?: string): Promise<{ status: string }> {
    return this.fetch('/api/user-info', {
      method: 'POST',
      body: JSON.stringify({ content, source }),
    });
  }

  // Analytics
  async getPerformanceMetrics(days = 30) {
    return this.fetch(`/api/analytics/performance?days=${days}`);
  }

  async getSymbolAnalytics(symbol: string, days = 30) {
    return this.fetch(`/api/analytics/symbol/${symbol}?days=${days}`);
  }

  async getAgentAnalytics() {
    return this.fetch('/api/analytics/agents');
  }

  // Portfolio
  async getPortfolioOptimize(symbols: string[], method: 'mean_variance' | 'risk_parity' = 'risk_parity') {
    return this.fetch(`/api/portfolio/optimize?symbols=${symbols.join(',')}&method=${method}`);
  }

  // Reports
  async getPerformanceReport(period: '1w' | '1m' | '3m' = '1m') {
    return this.fetch(`/api/reports/performance?period=${period}`);
  }

  async getDailySummary() {
    return this.fetch('/api/reports/daily');
  }

  // ML Predictions
  async getPrediction(symbol: string) {
    return this.fetch(`/api/predict/${symbol}`);
  }

  async getTopPredictions(limit = 10) {
    return this.fetch(`/api/predict/top?limit=${limit}`);
  }

  // Trading 212
  async getT212Portfolio() {
    return this.fetch('/api/t212/portfolio');
  }

  async getT212Positions() {
    return this.fetch('/api/t212/positions');
  }

  async getT212Orders() {
    return this.fetch('/api/t212/orders');
  }

  async getT212Quote(ticker: string) {
    return this.fetch(`/api/t212/quote/${ticker}`);
  }

  async submitT212Order(ticker: string, side: 'buy' | 'sell', quantity: number, orderType?: 'market' | 'limit', limitPrice?: number) {
    return this.fetch('/api/t212/order', {
      method: 'POST',
      body: JSON.stringify({ ticker, side, quantity, orderType, limitPrice }),
    });
  }

  async cancelT212Order(orderId: string) {
    return this.fetch(`/api/t212/order/${orderId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();