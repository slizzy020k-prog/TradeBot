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
}

export const api = new ApiClient();