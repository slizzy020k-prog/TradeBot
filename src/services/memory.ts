import fs from 'fs';
import path from 'path';
import { MemoryEntry, Trade, TradeOutcome } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class MemoryService {
  private memoryPath: string;
  private memory: MemoryEntry[] = [];

  constructor() {
    this.memoryPath = path.join(config.dataDir, 'memory.json');
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.memoryPath)) {
        const data = fs.readFileSync(this.memoryPath, 'utf-8');
        this.memory = JSON.parse(data);
        logger.info(`Loaded ${this.memory.length} memory entries`);
      }
    } catch (error) {
      logger.error('Failed to load memory:', error);
      this.memory = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      logger.error('Failed to save memory:', error);
    }
  }

  add(type: MemoryEntry['type'], content: string, metadata?: Record<string, unknown>): MemoryEntry {
    const entry: MemoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      content,
      metadata,
    };
    this.memory.push(entry);
    this.save();
    logger.debug(`Added memory entry: ${type} - ${content.substring(0, 50)}...`);
    return entry;
  }

  addTrade(trade: Trade): MemoryEntry {
    return this.add('trade', `Trade ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.price}`, { trade });
  }

  addAnalysis(content: string, recommendation: string, confidence: number): MemoryEntry {
    return this.add('analysis', content, { recommendation, confidence });
  }

  addUserInfo(content: string, source?: string): MemoryEntry {
    return this.add('user_info', content, { source });
  }

  addMarketEvent(content: string, metadata?: Record<string, unknown>): MemoryEntry {
    return this.add('market_event', content, metadata);
  }

  updateTradeOutcome(tradeId: string, outcome: TradeOutcome): void {
    const entry = this.memory.find(m => (m.metadata?.trade as any)?.id === tradeId);
    if (entry) {
      entry.outcome = outcome;
      this.save();
    }
  }

  getRecent(type?: MemoryEntry['type'], limit: number = 10): MemoryEntry[] {
    let filtered = this.memory;
    if (type) {
      filtered = this.memory.filter(m => m.type === type);
    }
    return filtered.slice(-limit);
  }

  getContext(limit: number = 20): MemoryEntry[] {
    return this.memory.slice(-limit);
  }

  getTradesWithOutcomes(): MemoryEntry[] {
    return this.memory.filter(m => m.type === 'trade' && m.outcome);
  }

  learnFromOutcomes(): { wins: number; losses: number; total: number } {
    const trades = this.getTradesWithOutcomes();
    let wins = 0;
    let losses = 0;

    for (const trade of trades) {
      if (trade.outcome) {
        if (trade.outcome.profitLoss > 0) wins++;
        else losses++;
      }
    }

    return { wins, losses, total: trades.length };
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const entry of this.memory) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }
    return { total: this.memory.length, byType };
  }
}

export const memoryService = new MemoryService();