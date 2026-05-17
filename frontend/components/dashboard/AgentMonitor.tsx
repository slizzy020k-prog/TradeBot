'use client';

import { useState, useEffect } from 'react';
import { Brain, Activity, CheckCircle, AlertCircle, Loader, MessageCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';

const AGENTS = [
  { name: 'TrendAgent', description: 'Multi-timeframe trend analysis', key: 'trend' },
  { name: 'VolatilityAgent', description: 'ATR and regime detection', key: 'volatility' },
  { name: 'LiquidityAgent', description: 'Spread and order book quality', key: 'liquidity' },
  { name: 'MomentumAgent', description: 'RSI/MACD and momentum signals', key: 'momentum' },
  { name: 'RiskAgent', description: 'Position sizing validation', key: 'risk' },
  { name: 'HistoricalEdgeAgent', description: 'Pattern matching and recall', key: 'historical' },
  { name: 'ExecutionAgent', description: 'Entry precision analysis', key: 'execution' },
  { name: 'CEOAgent', description: 'Final trade approval', key: 'ceo' },
];

interface AgentMessage {
  id: string;
  timestamp: number;
  fromAgent: string;
  toAgent: string;
  messageType: 'analysis' | 'recommendation' | 'warning' | 'approval' | 'rejection';
  content: string;
  confidence?: number;
}

interface AgentDecision {
  symbol: string;
  votes: { agent: string; decision: 'buy' | 'sell' | 'hold'; confidence: number }[];
  finalDecision: 'buy' | 'sell' | 'hold';
  consensus: number;
  timestamp: number;
}

interface AgentCommData {
  messages: AgentMessage[];
  decisions: AgentDecision[];
  stats: { totalMessages: number; byType: Record<string, number>; byAgent: Record<string, number> };
}

export function AgentMonitor() {
  const [commData, setCommData] = useState<AgentCommData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [view, setView] = useState<'messages' | 'decisions'>('messages');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/agent/comm');
        if (res.ok) {
          const data = await res.json();
          setCommData(data);
        }
      } catch (error) {
        console.error('Failed to fetch agent comm:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getAgentStatus = (key: string) => {
    if (!commData?.stats?.byAgent) return 'idle';
    const count = commData.stats.byAgent[key] || 0;
    if (count > 10) return 'active';
    if (count > 0) return 'processing';
    return 'idle';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-3 h-3 text-[var(--bullish)]" />;
      case 'processing':
        return <Loader className="w-3 h-3 text-[var(--accent-blue)] animate-spin" />;
      case 'idle':
        return <CheckCircle className="w-3 h-3 text-zinc-500" />;
      default:
        return <CheckCircle className="w-3 h-3 text-zinc-500" />;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'analysis': return <Activity className="w-3 h-3 text-[var(--accent-blue)]" />;
      case 'recommendation': return <ArrowRight className="w-3 h-3 text-[var(--accent-teal)]" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-[var(--warning)]" />;
      case 'approval': return <CheckCircle className="w-3 h-3 text-[var(--bullish)]" />;
      case 'rejection': return <AlertCircle className="w-3 h-3 text-[var(--bearish)]" />;
      default: return <MessageCircle className="w-3 h-3 text-zinc-400" />;
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Agent Network" badge="LIVE" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Agent Network" badge={autoRefresh ? 'LIVE' : 'PAUSED'} />
        <div className="flex gap-1">
          <button
            onClick={() => setView('messages')}
            className={`px-2 py-1 text-xs rounded ${view === 'messages' ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--background)] text-zinc-400'}`}
          >
            Messages
          </button>
          <button
            onClick={() => setView('decisions')}
            className={`px-2 py-1 text-xs rounded ${view === 'decisions' ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--background)] text-zinc-400'}`}
          >
            Decisions
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1 rounded ${autoRefresh ? 'bg-[var(--bullish)]/20 text-[var(--bullish)]' : 'bg-[var(--panel)] text-zinc-400'}`}
          >
            <Activity className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>

      {/* Agent Status Row */}
      <div className="flex gap-1 mb-3 overflow-hidden">
        {AGENTS.map((agent) => {
          const status = getAgentStatus(agent.key);
          return (
            <div
              key={agent.name}
              className={`flex-1 px-1 py-1 rounded text-center transition-colors ${
                status === 'active' ? 'bg-[var(--bullish)]/20 text-[var(--bullish)] border border-[var(--bullish)]/30' :
                status === 'processing' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' :
                'bg-[var(--background)] text-zinc-500 border border-[var(--panel-border)]'
              }`}
              title={`${agent.name}: ${status}`}
            >
              <div className="flex items-center justify-center gap-1">
                {getStatusIcon(status)}
                <span className="text-[10px] font-medium truncate">{agent.name.replace('Agent', '')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Communication Feed */}
      {view === 'messages' && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {(!commData?.messages || commData.messages.length === 0) ? (
            <div className="text-zinc-500 text-xs text-center py-6">
              Waiting for agent communications...
            </div>
          ) : (
            commData.messages.slice(-15).reverse().map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 p-2 rounded bg-[var(--background)]/50 hover:bg-[var(--background)] transition-colors">
                {getMessageIcon(msg.messageType)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-medium text-[var(--accent-teal)]">{msg.fromAgent}</span>
                    <ArrowRight className="w-2 h-2 text-zinc-600" />
                    <span className="text-zinc-400">{msg.toAgent === 'all' ? 'all' : msg.toAgent}</span>
                  </div>
                  <div className="text-xs text-zinc-300 truncate" title={msg.content}>
                    {msg.content}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500">{formatTime(msg.timestamp)}</span>
                  {msg.confidence && <div className="text-[10px] text-[var(--accent-blue)]">{msg.confidence}%</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Decisions View */}
      {view === 'decisions' && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {(!commData?.decisions || commData.decisions.length === 0) ? (
            <div className="text-zinc-500 text-xs text-center py-6">
              No decisions yet...
            </div>
          ) : (
            commData.decisions.slice(-10).reverse().map((decision, idx) => (
              <div key={idx} className="p-2 rounded bg-[var(--background)]/50 border border-[var(--panel-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">{decision.symbol}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    decision.finalDecision === 'buy' ? 'bg-[var(--bullish)]/20 text-[var(--bullish)]' :
                    decision.finalDecision === 'sell' ? 'bg-[var(--bearish)]/20 text-[var(--bearish)]' :
                    'bg-[var(--panel)] text-zinc-400'
                  }`}>
                    {decision.finalDecision.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  {decision.votes.map((vote, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span className="text-zinc-400">{vote.agent.replace('Agent', '')}:</span>
                      <span className={vote.decision === 'buy' ? 'text-[var(--bullish)]' : vote.decision === 'sell' ? 'text-[var(--bearish)]' : 'text-zinc-400'}>
                        {vote.decision.toUpperCase()}
                      </span>
                      <span className="text-zinc-500">({vote.confidence}%)</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">{formatTime(decision.timestamp)}</span>
                  <span className="text-xs font-medium text-[var(--accent-teal)]">{Math.round(decision.consensus * 100)}% consensus</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats */}
      {commData?.stats && (
        <div className="mt-2 pt-2 border-t border-[var(--panel-border)] flex items-center justify-between text-xs">
          <span className="text-zinc-500">Total: {commData.stats.totalMessages} messages</span>
          <div className="flex gap-2">
            {Object.entries(commData.stats.byType || {}).slice(0, 4).map(([type, count]) => (
              <span key={type} className="text-zinc-400">{type}: {count}</span>
            ))}
          </div>
        </div>
      )}
    </GlassPanel>
  );
}