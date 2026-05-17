'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Filter, ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus, Brain, Zap, BarChart3, Shield, Newspaper, Globe, Eye } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/ui';
import { useBoardroomMessages } from '@/lib/websocket';
import { api } from '@/lib/api';

// Agent configuration with distinct colors
const AGENTS = {
  MarketScanner: {
    name: 'Market Scanner',
    color: '#f97316', // orange
    icon: Eye,
    role: 'Market Intelligence Officer',
    description: 'Monitors price action, volume, and market breadth',
  },
  TrendAgent: {
    name: 'Trend Agent',
    color: '#3b82f6', // blue
    icon: TrendingUp,
    role: 'Technical Analysis Specialist',
    description: 'Analyzes multi-timeframe trends and momentum',
  },
  VolatilityAgent: {
    name: 'Volatility Agent',
    color: '#8b5cf6', // violet
    icon: BarChart3,
    role: 'Volatility & Regime Analyst',
    description: 'Tracks ATR, VIX, and volatility regime changes',
  },
  RiskAgent: {
    name: 'Risk Agent',
    color: '#ef4444', // red
    icon: Shield,
    role: 'Chief Risk Officer',
    description: 'Validates position sizing and risk parameters',
  },
  NewsAgent: {
    name: 'News Agent',
    color: '#22c55e', // green
    icon: Newspaper,
    role: 'Head of News Intelligence',
    description: 'Processes news sentiment and market impact',
  },
  CEOAgent: {
    name: 'CEO Agent',
    color: '#eab308', // yellow/gold
    icon: Brain,
    role: 'Chief Executive Officer',
    description: 'Final trade approval and strategic oversight',
  },
} as const;

interface AgentMessage {
  id: string;
  agent: string;
  role: string;
  content: string;
  timestamp: number;
  recommendation?: 'buy' | 'sell' | 'hold';
  confidence?: number;
  reasoning?: string;
  context?: string;
  expanded?: boolean;
}

interface BoardroomStats {
  totalMessages: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  avgConfidence: number;
  activeAgents: string[];
}

export function BoardroomDiscussion() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [stats, setStats] = useState<BoardroomStats>({
    totalMessages: 0,
    buySignals: 0,
    sellSignals: 0,
    holdSignals: 0,
    avgConfidence: 0,
    activeAgents: [],
  });
  const [filter, setFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  // Subscribe to boardroom messages via WebSocket
  useBoardroomMessages((data) => {
    if (data && typeof data === 'object') {
      const msgData = data as any;
      if (msgData.agent && msgData.content) {
        const newMsg: AgentMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          agent: msgData.agent,
          role: msgData.role || AGENTS[msgData.agent as keyof typeof AGENTS]?.role || 'Agent',
          content: msgData.content || '',
          timestamp: msgData.timestamp || Date.now(),
          recommendation: msgData.recommendation || 'hold',
          confidence: msgData.confidence || 50,
          reasoning: msgData.reasoning,
          context: msgData.context,
          expanded: false,
        };

        setMessages(prev => {
          const updated = [...prev, newMsg];
          // Keep only last 100 messages
          return updated.slice(-100);
        });

        // Update stats
        updateStats([...messages, newMsg]);
      }
    }
  });

  // Fetch historical messages
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await api.getBoardroomHistory(50);
        const formatted: AgentMessage[] = history.map((h: any, i: number) => ({
          id: `hist-${i}-${h.timestamp}`,
          agent: h.agent,
          role: h.role,
          content: h.content,
          timestamp: h.timestamp,
          recommendation: extractRecommendation(h.content),
          confidence: extractConfidence(h.content),
          expanded: false,
        }));
        setMessages(formatted);
        updateStats(formatted);
      } catch (error) {
        console.error('Failed to fetch boardroom history:', error);
      }
    };

    fetchHistory();

    // Periodically refresh
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const updateStats = (msgs: AgentMessage[]) => {
    const buySignals = msgs.filter(m => m.recommendation === 'buy').length;
    const sellSignals = msgs.filter(m => m.recommendation === 'sell').length;
    const holdSignals = msgs.filter(m => m.recommendation === 'hold').length;
    const confidences = msgs.filter(m => m.confidence).map(m => m.confidence!);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;
    const agents = [...new Set(msgs.map(m => m.agent))];

    setStats({
      totalMessages: msgs.length,
      buySignals,
      sellSignals,
      holdSignals,
      avgConfidence: Math.round(avgConfidence),
      activeAgents: agents,
    });
  };

  const extractRecommendation = (content: string): 'buy' | 'sell' | 'hold' => {
    const lower = content.toLowerCase();
    if (lower.includes('buy')) return 'buy';
    if (lower.includes('sell')) return 'sell';
    return 'hold';
  };

  const extractConfidence = (content: string): number => {
    const match = content.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 50;
  };

  const toggleExpanded = (id: string) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, expanded: !m.expanded } : m)
    );
  };

  const filteredMessages = messages.filter(msg => {
    if (filter !== 'all' && msg.agent !== filter) return false;
    if (confidenceFilter > 0 && (msg.confidence || 0) < confidenceFilter) return false;
    return true;
  });

  const getAgentConfig = (agentName: string) => {
    return AGENTS[agentName as keyof typeof AGENTS] || {
      name: agentName,
      color: '#6b7280',
      icon: MessageCircle,
      role: 'Agent',
      description: '',
    };
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'buy': return <TrendingUp className="w-4 h-4" />;
      case 'sell': return <TrendingDown className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'buy': return 'text-[var(--bullish)]';
      case 'sell': return 'text-[var(--bearish)]';
      default: return 'text-zinc-400';
    }
  };

  return (
    <GlassPanel className="h-full flex flex-col overflow-hidden">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Boardroom Discussion" badge="LIVE" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
          <span className="text-xs text-zinc-500">{stats.totalMessages} messages</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        <StatBadge label="Buy" value={stats.buySignals} color="var(--bullish)" />
        <StatBadge label="Sell" value={stats.sellSignals} color="var(--bearish)" />
        <StatBadge label="Hold" value={stats.holdSignals} color="zinc" />
        <StatBadge label="Avg Conf" value={stats.avgConfidence} color="var(--accent-blue)" suffix="%" />
      </div>

      {/* Agent filter chips */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <FilterChip
          label="All"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          color="#6b7280"
        />
        {Object.entries(AGENTS).map(([key, config]) => (
          <FilterChip
            key={key}
            label={config.name.replace(' Agent', '')}
            active={filter === key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            color={config.color}
          />
        ))}
      </div>

      {/* Confidence filter */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-zinc-500">Min Confidence:</span>
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(parseInt(e.target.value))}
          className="w-24 h-1 bg-[var(--background-secondary)] rounded-full appearance-none cursor-pointer"
        />
        <span className="font-mono text-[var(--accent-teal)]">{confidenceFilter}%</span>
      </div>

      {/* Message feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
          setAutoScroll(isAtBottom);
        }}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
            <MessageCircle className="w-8 h-8" />
            <span className="text-sm">Waiting for agent discussions...</span>
            <span className="text-xs text-zinc-600">Messages will appear here in real-time</span>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const config = getAgentConfig(msg.agent);
            const AgentIcon = config.icon;

            return (
              <AgentMessageCard
                key={msg.id}
                message={msg}
                config={config}
                AgentIcon={AgentIcon}
                isExpanded={msg.expanded || false}
                onToggle={() => toggleExpanded(msg.id)}
                formatTime={formatTime}
                getRecommendationIcon={getRecommendationIcon}
                getRecommendationColor={getRecommendationColor}
              />
            );
          })
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-[var(--accent-blue)] text-white text-xs flex items-center gap-1 shadow-lg"
        >
          <ChevronDown className="w-3 h-3" />
          New messages
        </button>
      )}
    </GlassPanel>
  );
}

// Stat badge component
function StatBadge({ label, value, color, suffix = '' }: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="px-2 py-1 rounded bg-[var(--background)] border border-[var(--panel-border)] flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color }}>{value}{suffix}</span>
    </div>
  );
}

// Filter chip component
function FilterChip({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
        active
          ? 'border'
          : 'bg-[var(--background)] text-zinc-400'
      }`}
      style={{
        borderColor: active ? color : 'var(--panel-border)',
        backgroundColor: active ? `${color}20` : 'var(--background)',
        color: active ? color : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );
}

// Agent message card
function AgentMessageCard({
  message,
  config,
  AgentIcon,
  isExpanded,
  onToggle,
  formatTime,
  getRecommendationIcon,
  getRecommendationColor,
}: {
  message: AgentMessage;
  config: typeof AGENTS[keyof typeof AGENTS];
  AgentIcon: any;
  isExpanded: boolean;
  onToggle: () => void;
  formatTime: (ts: number) => string;
  getRecommendationIcon: (rec: string) => React.ReactElement;
  getRecommendationColor: (rec: string) => string;
}) {
  const [showFull, setShowFull] = useState(false);
  const contentPreview = message.content.substring(0, 150);
  const needsTruncation = message.content.length > 150;

  return (
    <div
      className="p-4 rounded-lg border transition-all duration-300 hover:shadow-lg"
      style={{
        borderColor: `${config.color}40`,
        backgroundColor: `${config.color}05`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <AgentIcon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <div className="font-medium text-sm" style={{ color: config.color }}>
              {config.name}
            </div>
            <div className="text-xs text-zinc-500">{config.role}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recommendation badge */}
          {message.recommendation && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getRecommendationColor(message.recommendation)}`}
              style={{
                backgroundColor: `${config.color}20`,
              }}
            >
              {getRecommendationIcon(message.recommendation)}
              {message.recommendation.toUpperCase()}
            </div>
          )}

          {/* Confidence */}
          {message.confidence && (
            <div className="px-2 py-1 rounded bg-[var(--background)] border border-[var(--panel-border)]">
              <span className="text-xs font-mono font-bold">{message.confidence}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-2">
        <p className="text-sm text-zinc-300 leading-relaxed">
          {showFull || !needsTruncation ? message.content : contentPreview}
          {needsTruncation && !showFull && '...'}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-xs text-[var(--accent-blue)] mt-1 hover:underline"
          >
            {showFull ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Expanded reasoning */}
      {message.reasoning && isExpanded && (
        <div
          className="p-3 rounded mt-2"
          style={{ backgroundColor: `${config.color}10`, borderLeft: `3px solid ${config.color}` }}
        >
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Reasoning</div>
          <p className="text-sm text-zinc-300">{message.reasoning}</p>
        </div>
      )}

      {/* Context */}
      {message.context && isExpanded && (
        <div className="p-3 rounded mt-2 bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Context</div>
          <p className="text-sm text-zinc-400">{message.context}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--panel-border)]">
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />
          <span>{formatTime(message.timestamp)}</span>
        </div>

        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show details
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Standalone component for dashboard integration
export function BoardroomPanel() {
  return (
    <div className="h-full">
      <BoardroomDiscussion />
    </div>
  );
}