import { UserInfo } from '../types';
import { logger } from '../utils/logger';

export class UserInfoProcessorService {
  private infos: UserInfo[] = [];
  private maxStored = 100;

  addInfo(content: string, source?: string): UserInfo {
    const info: UserInfo = {
      id: this.generateId(),
      timestamp: Date.now(),
      content,
      source,
      relevance: this.calculateRelevance(content),
    };

    this.infos.push(info);
    if (this.infos.length > this.maxStored) {
      this.infos = this.infos.slice(-this.maxStored);
    }

    logger.info(`User info added: ${content.substring(0, 50)}...`);
    return info;
  }

  getRecentInfos(limit: number = 10): UserInfo[] {
    return this.infos.slice(-limit);
  }

  getInfosForSymbol(symbol: string): UserInfo[] {
    const upperSymbol = symbol.toUpperCase();
    return this.infos.filter(info =>
      info.content.toUpperCase().includes(upperSymbol)
    );
  }

  clearOldInfos(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.infos.length;
    this.infos = this.infos.filter(info => info.timestamp > cutoff);
    return before - this.infos.length;
  }

  private calculateRelevance(content: string): number {
    let score = 50;

    const positiveKeywords = ['bullish', 'buy', 'upgrade', 'positive', 'growth', 'opportunity'];
    const negativeKeywords = ['bearish', 'sell', 'downgrade', 'negative', 'risk', 'warning'];

    const lower = content.toLowerCase();
    for (const kw of positiveKeywords) {
      if (lower.includes(kw)) score += 10;
    }
    for (const kw of negativeKeywords) {
      if (lower.includes(kw)) score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private generateId(): string {
    return `ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): { total: number; avgRelevance: number } {
    if (this.infos.length === 0) {
      return { total: 0, avgRelevance: 0 };
    }
    const sum = this.infos.reduce((acc, info) => acc + (info.relevance || 0), 0);
    return {
      total: this.infos.length,
      avgRelevance: sum / this.infos.length,
    };
  }
}

export const userInfoProcessorService = new UserInfoProcessorService();