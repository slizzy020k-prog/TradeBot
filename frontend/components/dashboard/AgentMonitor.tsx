'use client';

import { useState } from 'react';
import { Brain, Activity, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';

const AGENTS = [
  { name: 'Trend Agent', description: 'Multi-timeframe trend analysis', status: 'active' as const },
  { name: 'Volatility Agent', description: 'ATR and regime detection', status: 'active' as const },
  { name: 'Liquidity Agent', description: 'Spread and order book quality', status: 'idle' as const },
  { name: 'Momentum Agent', description: 'RSI/MACD and momentum signals', status: 'active' as const },
  { name: 'Risk Agent', description: 'Position sizing validation', status: 'processing' as const },
  { name: 'Historical Edge', description: 'Pattern matching and recall', status: 'active' as const },
  { name: 'Execution Agent', description: 'Entry precision analysis', status: 'idle' as const },
  { name: 'Sentiment Agent', description: 'News and social analysis', status: 'active' as const },
  { name: 'CEO Agent', description: 'Final trade approval', status: 'active' as const },
];

export function AgentMonitor() {
  const [agents] = useState(AGENTS);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4 text-[var(--bullish)]" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-[var(--accent-blue)] animate-spin" />;
      case 'idle':
        return <CheckCircle className="w-4 h-4 text-zinc-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[var(--bearish)]" />;
      default:
        return <CheckCircle className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-[var(--bullish)]/30 bg-[var(--bullish)]/5';
      case 'processing':
        return 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5';
      case 'idle':
        return 'border-[var(--panel-border)] bg-[var(--background)]';
      case 'error':
        return 'border-[var(--bearish)]/30 bg-[var(--bearish)]/5';
      default:
        return 'border-[var(--panel-border)]';
    }
  };

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="AI Agent Network" badge="9 Active" />

      {/* Neural network visualization */}
      <div className="flex items-center justify-center py-4">
        <div className="relative w-32 h-32">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-blue)]/20 animate-neural" />
          {/* Inner ring */}
          <div className="absolute inset-2 rounded-full border border-[var(--accent-teal)]/30 animate-pulse" />
          {/* Center */}
          <div className="absolute inset-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-teal)] flex items-center justify-center">
            <Brain className="w-5 h-5 text-black" />
          </div>
          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-full bg-[var(--accent-blue)]/10 animate-ping" />
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-3 gap-2">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className={`p-2 rounded border transition-all hover:scale-105 cursor-pointer ${getStatusStyle(agent.status)}`}
          >
            <div className="flex items-center gap-1 mb-1">
              {getStatusIcon(agent.status)}
              <span className="text-xs font-medium truncate">{agent.name}</span>
            </div>
            <div className="text-xs text-zinc-500 truncate">{agent.description}</div>
          </div>
        ))}
      </div>

      {/* Consensus score */}
      <div className="mt-4 p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Network Consensus</span>
          <span className="text-sm font-bold text-[var(--accent-teal)]">87%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--panel)] overflow-hidden">
          <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)]" />
        </div>
      </div>
    </GlassPanel>
  );
}