import { EventEmitter } from 'events';
import { MarketDataExtended, PortfolioState, MacroRegime } from '../types';
import { logger } from '../utils/logger';

// Shared context that all agents can access
export interface AgentContext {
  agentId: string;
  agentName: string;
  role: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  riskAssessment: 'low' | 'medium' | 'high';
  marketRegime: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MarketSnapshot {
  prices: Map<string, number>;
  volumes: Map<string, number>;
  changes: Map<string, number>;
  regime: MacroRegime;
  fearGreed: number;
  vix: number;
  bidAskImbalance: number;
  timestamp: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  cash: number;
  positions: Map<string, { qty: number; value: number; pnl: number; weight: number }>;
  dailyPnL: number;
  exposure: number;
  timestamp: number;
}

export interface SharedState {
  marketSnapshot: MarketSnapshot | null;
  portfolioSnapshot: PortfolioSnapshot | null;
  agentContexts: Map<string, AgentContext>;
  lastAnalysisTime: number;
  isAnalysisRunning: boolean;
}

// Global event bus for inter-agent communication
class EventBusService extends EventEmitter {
  private static instance: EventBusService;

  static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService();
    }
    return EventBusService.instance;
  }

  // Subscribe to specific events with handler
  on(event: string, handler: (...args: any[]) => void): this {
    super.on(event, handler);
    logger.debug(`[EventBus] Subscribed to: ${event}`);
    return this;
  }

  // Publish event with data
  emit(event: string, ...args: any[]): boolean {
    logger.debug(`[EventBus] Publishing: ${event}`);
    return super.emit(event, ...args);
  }

  // Get all event names for debugging
  getEventNames(): string[] {
    return this.eventNames() as string[];
  }
}

export const eventBus = EventBusService.getInstance();

// Shared State Service - central state that all agents can access
class SharedStateService {
  private static instance: SharedStateService;

  private state: SharedState = {
    marketSnapshot: null,
    portfolioSnapshot: null,
    agentContexts: new Map(),
    lastAnalysisTime: 0,
    isAnalysisRunning: false
  };

  private stateVersion = 0;
  private updateSubscribers: Set<(state: SharedState) => void> = new Set();

  static getInstance(): SharedStateService {
    if (!SharedStateService.instance) {
      SharedStateService.instance = new SharedStateService();
    }
    return SharedStateService.instance;
  }

  // Get current state snapshot
  getState(): SharedState {
    return this.state;
  }

  // Get state version for change detection
  getVersion(): number {
    return this.stateVersion;
  }

  // Update market snapshot
  updateMarketSnapshot(snapshot: MarketSnapshot): void {
    this.state.marketSnapshot = snapshot;
    this.stateVersion++;
    this.notifySubscribers();
    eventBus.emit('market:snapshot', snapshot);
  }

  // Update portfolio snapshot
  updatePortfolioSnapshot(snapshot: PortfolioSnapshot): void {
    this.state.portfolioSnapshot = snapshot;
    this.stateVersion++;
    this.notifySubscribers();
    eventBus.emit('portfolio:snapshot', snapshot);
  }

  // Update single agent context
  updateAgentContext(context: AgentContext): void {
    this.state.agentContexts.set(context.agentId, context);
    this.stateVersion++;
    eventBus.emit('agent:context', context);
  }

  // Get all agent contexts as array
  getAllAgentContexts(): AgentContext[] {
    return Array.from(this.state.agentContexts.values());
  }

  // Get agent context by ID
  getAgentContext(agentId: string): AgentContext | undefined {
    return this.state.agentContexts.get(agentId);
  }

  // Get market snapshot
  getMarketSnapshot(): MarketSnapshot | null {
    return this.state.marketSnapshot;
  }

  // Get portfolio snapshot
  getPortfolioSnapshot(): PortfolioSnapshot | null {
    return this.state.portfolioSnapshot;
  }

  // Set analysis running state
  setAnalysisRunning(running: boolean): void {
    this.state.isAnalysisRunning = running;
    this.state.lastAnalysisTime = running ? Date.now() : this.state.lastAnalysisTime;
    eventBus.emit('analysis:state', { running, timestamp: this.state.lastAnalysisTime });
  }

  // Subscribe to state changes
  subscribe(handler: (state: SharedState) => void): () => void {
    this.updateSubscribers.add(handler);
    return () => this.updateSubscribers.delete(handler);
  }

  // Notify all subscribers of state change
  private notifySubscribers(): void {
    for (const handler of this.updateSubscribers) {
      try {
        handler(this.state);
      } catch (error) {
        logger.error('[SharedState] Subscriber error:', error);
      }
    }
  }

  // Get aggregated recommendation from all agents
  getAggregatedRecommendation(): { recommendation: 'buy' | 'sell' | 'hold'; confidence: number; agents: number } {
    const contexts = this.getAllAgentContexts();
    if (contexts.length === 0) {
      return { recommendation: 'hold', confidence: 0, agents: 0 };
    }

    let buyScore = 0;
    let sellScore = 0;
    let totalConfidence = 0;

    for (const ctx of contexts) {
      if (ctx.recommendation === 'buy') {
        buyScore += ctx.confidence;
      } else if (ctx.recommendation === 'sell') {
        sellScore += ctx.confidence;
      }
      totalConfidence += ctx.confidence;
    }

    let recommendation: 'buy' | 'sell' | 'hold';
    if (buyScore > sellScore * 1.2) {
      recommendation = 'buy';
    } else if (sellScore > buyScore * 1.2) {
      recommendation = 'sell';
    } else {
      recommendation = 'hold';
    }

    const confidence = totalConfidence / contexts.length;
    return { recommendation, confidence, agents: contexts.length };
  }

  // Clear all agent contexts (for fresh analysis cycle)
  clearAgentContexts(): void {
    this.state.agentContexts.clear();
    eventBus.emit('agent:contexts:cleared');
  }

  // Get state summary for debugging
  getSummary(): Record<string, any> {
    return {
      marketSnapshotAge: this.state.marketSnapshot ? Date.now() - this.state.marketSnapshot.timestamp : null,
      portfolioSnapshotAge: this.state.portfolioSnapshot ? Date.now() - this.state.portfolioSnapshot.timestamp : null,
      agentCount: this.state.agentContexts.size,
      lastAnalysisAge: this.state.lastAnalysisTime ? Date.now() - this.state.lastAnalysisTime : null,
      isAnalysisRunning: this.state.isAnalysisRunning,
      stateVersion: this.stateVersion
    };
  }
}

export const sharedState = SharedStateService.getInstance();