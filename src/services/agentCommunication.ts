import { logger } from '../utils/logger';

export interface AgentMessage {
  id: string;
  timestamp: number;
  fromAgent: string;
  toAgent: string | 'all';
  messageType: 'analysis' | 'recommendation' | 'question' | 'warning' | 'approval' | 'rejection';
  content: string;
  data?: Record<string, any>;
  confidence?: number;
}

export interface AgentDecision {
  symbol: string;
  agents: string[];
  votes: { agent: string; decision: 'buy' | 'sell' | 'hold'; confidence: number }[];
  finalDecision: 'buy' | 'sell' | 'hold';
  consensus: number;
  timestamp: number;
}

export class AgentCommunicationService {
  private messages: AgentMessage[] = [];
  private decisions: AgentDecision[] = [];
  private maxMessages = 500;
  private listeners: ((message: AgentMessage) => void)[] = [];

  broadcast(fromAgent: string, messageType: AgentMessage['messageType'], content: string, data?: Record<string, any>): AgentMessage {
    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      fromAgent,
      toAgent: 'all',
      messageType,
      content,
      data,
      confidence: data?.confidence,
    };

    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    logger.info(`[AGENT COMM] ${fromAgent} → all: ${messageType} - ${content.substring(0, 50)}...`);

    // Notify listeners
    for (const listener of this.listeners) {
      listener(message);
    }

    return message;
  }

  sendTo(fromAgent: string, toAgent: string, messageType: AgentMessage['messageType'], content: string, data?: Record<string, any>): AgentMessage {
    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      fromAgent,
      toAgent,
      messageType,
      content,
      data,
      confidence: data?.confidence,
    };

    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    logger.info(`[AGENT COMM] ${fromAgent} → ${toAgent}: ${messageType} - ${content.substring(0, 50)}...`);

    return message;
  }

  askQuestion(fromAgent: string, question: string, data?: Record<string, any>): AgentMessage {
    return this.broadcast(fromAgent, 'question', question, data);
  }

  shareAnalysis(agent: string, symbol: string, analysis: string, confidence: number, data?: Record<string, any>): AgentMessage {
    return this.broadcast(agent, 'analysis', `${symbol}: ${analysis}`, { ...data, confidence, symbol });
  }

  shareRecommendation(agent: string, symbol: string, action: 'buy' | 'sell' | 'hold', confidence: number, reasoning: string): AgentMessage {
    return this.broadcast(agent, 'recommendation', `${symbol} ${action.toUpperCase()} (${confidence}% confidence) - ${reasoning}`, { symbol, action, confidence, reasoning });
  }

  raiseWarning(agent: string, warning: string, data?: Record<string, any>): AgentMessage {
    return this.broadcast(agent, 'warning', warning, data);
  }

  approveTrade(agent: string, symbol: string, quantity: number, price: number): AgentMessage {
    return this.broadcast(agent, 'approval', `APPROVE: ${quantity} ${symbol} @ $${price}`, { symbol, quantity, price });
  }

  rejectTrade(agent: string, symbol: string, reason: string): AgentMessage {
    return this.broadcast(agent, 'rejection', `REJECT ${symbol}: ${reason}`, { symbol, reason });
  }

  recordDecision(symbol: string, agents: string[], votes: { agent: string; decision: 'buy' | 'sell' | 'hold'; confidence: number }[]): AgentDecision {
    const buyVotes = votes.filter(v => v.decision === 'buy').length;
    const sellVotes = votes.filter(v => v.decision === 'sell').length;
    const holdVotes = votes.filter(v => v.decision === 'hold').length;

    let finalDecision: 'buy' | 'sell' | 'hold' = 'hold';
    if (buyVotes > sellVotes && buyVotes > holdVotes) finalDecision = 'buy';
    else if (sellVotes > buyVotes && sellVotes > holdVotes) finalDecision = 'sell';

    const consensus = Math.max(buyVotes, sellVotes, holdVotes) / agents.length;

    const decision: AgentDecision = {
      symbol,
      agents,
      votes,
      finalDecision,
      consensus,
      timestamp: Date.now(),
    };

    this.decisions.push(decision);
    if (this.decisions.length > 100) {
      this.decisions.shift();
    }

    return decision;
  }

  getRecentMessages(limit = 50): AgentMessage[] {
    return this.messages.slice(-limit);
  }

  getMessagesByAgent(agent: string, limit = 20): AgentMessage[] {
    return this.messages.filter(m => m.fromAgent === agent).slice(-limit);
  }

  getMessagesByType(type: AgentMessage['messageType'], limit = 20): AgentMessage[] {
    return this.messages.filter(m => m.messageType === type).slice(-limit);
  }

  getRecentDecisions(limit = 20): AgentDecision[] {
    return this.decisions.slice(-limit);
  }

  subscribe(listener: (message: AgentMessage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getStats(): { totalMessages: number; byType: Record<string, number>; byAgent: Record<string, number> } {
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const msg of this.messages) {
      byType[msg.messageType] = (byType[msg.messageType] || 0) + 1;
      byAgent[msg.fromAgent] = (byAgent[msg.fromAgent] || 0) + 1;
    }

    return {
      totalMessages: this.messages.length,
      byType,
      byAgent,
    };
  }

  clear(): void {
    this.messages = [];
    this.decisions = [];
    logger.info('[AGENT COMM] Communication history cleared');
  }
}

export const agentCommService = new AgentCommunicationService();