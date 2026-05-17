'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, Activity, CheckCircle, AlertCircle, Loader, MessageCircle, ArrowRight, AlertTriangle, Zap } from 'lucide-react';
import { GlassPanel } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { useAgentMessages } from '@/lib/websocket';

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

export function AgentMonitor() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agentActivity, setAgentActivity] = useState<Map<string, number>>(new Map());
  const [liveCount, setLiveCount] = useState(0);
  const [view, setView] = useState<'messages' | 'agents'>('agents');
  const countRef = useRef(0);

  // Subscribe to agent messages
  useAgentMessages((data) => {
    if (data && typeof data === 'object') {
      const msgData = data as any;
      if (msgData.agent && msgData.content) {
        setMessages(prev => {
          const newMsg: AgentMessage = {
            id: `msg-${Date.now()}-${countRef.current++}`,
            timestamp: Date.now(),
            fromAgent: msgData.agent,
            toAgent: 'all',
            messageType: 'analysis',
            content: msgData.content?.substring(0, 100) || '',
            confidence: msgData.confidence || 65,
          };
          return [...prev.slice(-20), newMsg];
        });

        // Update agent activity
        setAgentActivity(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(msgData.agent) || 0;
          newMap.set(msgData.agent, current + 1);
          return newMap;
        });
      }
    }
  });

  // Simulate agent activity fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentActivity(prev => {
        const newMap = new Map<string, number>();
        AGENTS.forEach(agent => {
          const current = prev.get(agent.name) || 0;
          const decay = current > 0 ? Math.floor(Math.random() * 3) : 0;
          const spike = Math.random() > 0.95 ? Math.floor(Math.random() * 20) : 0;
          newMap.set(agent.name, Math.max(0, current - decay + spike));
        });
        return newMap;
      });

      setLiveCount(prev => prev + Math.floor(Math.random() * 5));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/agent/comm');
        if (res.ok) {
          const data = await res.json();
          if (data.messages) {
            setMessages(data.messages.slice(-20));
          }
        }
      } catch {}
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getAgentStatus = (name: string) => {
    const activity = agentActivity.get(name) || 0;
    if (activity > 15) return 'active';
    if (activity > 5) return 'processing';
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

  return (
    <GlassPanel className="h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Agent Network" badge="LIVE" />
        <div className="flex gap-1">
          <button
            onClick={() => setView('agents')}
            className={`px-2 py-1 text-xs rounded ${view === 'agents' ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--background)] text-zinc-400'}`}
          >
            Agents
          </button>
          <button
            onClick={() => setView('messages')}
            className={`px-2 py-1 text-xs rounded ${view === 'messages' ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--background)] text-zinc-400'}`}
          >
            Feed
          </button>
        </div>
      </div>

      {/* Live activity indicator */}
      <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
        <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
        <span>{liveCount} events processed</span>
        <Zap className="w-3 h-3 text-[var(--accent-teal)]" />
      </div>

      {/* Agent Status Grid */}
      {view === 'agents' && (
        <div className="grid grid-cols-4 gap-2">
          {AGENTS.map((agent) => {
            const status = getAgentStatus(agent.name);
            const activity = agentActivity.get(agent.name) || 0;
            return (
              <AnimatedAgentCell
                key={agent.name}
                name={agent.name}
                status={status}
                activity={activity}
                getStatusIcon={getStatusIcon}
              />
            );
          })}
        </div>
      )}

      {/* Message Feed */}
      {view === 'messages' && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-zinc-500 text-xs text-center py-6 flex flex-col items-center gap-2">
              <Brain className="w-6 h-6 text-zinc-600" />
              <span>Waiting for agent communications...</span>
              <span className="text-zinc-600">Messages will appear here in real-time</span>
            </div>
          ) : (
            messages.slice().reverse().map((msg) => (
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

      {/* Stats bar */}
      <div className="mt-2 pt-2 border-t border-[var(--panel-border)] flex items-center justify-between text-xs">
        <span className="text-zinc-500">{messages.length} messages</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--bullish)]">{Array.from(agentActivity.values()).filter(a => a > 5).length} active</span>
          <Activity className="w-3 h-3 text-zinc-400" />
        </div>
      </div>
    </GlassPanel>
  );
}

// Animated agent cell with activity pulse
function AnimatedAgentCell({
  name,
  status,
  activity,
  getStatusIcon
}: {
  name: string;
  status: string;
  activity: number;
  getStatusIcon: (status: string) => React.ReactNode;
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (activity > 10) {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [activity]);

  return (
    <div
      className={`
        px-2 py-2 rounded text-center transition-all duration-300 cursor-pointer
        ${status === 'active' ? 'bg-[var(--bullish)]/20 text-[var(--bullish)] border border-[var(--bullish)]/30' :
          status === 'processing' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' :
          'bg-[var(--background)] text-zinc-500 border border-[var(--panel-border)]'}
        ${pulse ? 'scale-105' : ''}
      `}
      title={`${name}: ${status} (${activity} events)`}
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        {getStatusIcon(status)}
      </div>
      <div className="text-[10px] font-medium truncate">{name.replace('Agent', '')}</div>
      <div className="text-[8px] text-zinc-400">{activity} events</div>
      {/* Activity bar */}
      <div className="mt-1 h-1 bg-[var(--background-secondary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            status === 'active' ? 'bg-[var(--bullish)]' :
              status === 'processing' ? 'bg-[var(--accent-blue)]' : 'bg-zinc-600'
          }`}
          style={{ width: `${Math.min(100, activity * 5)}%` }}
        />
      </div>
    </div>
  );
}