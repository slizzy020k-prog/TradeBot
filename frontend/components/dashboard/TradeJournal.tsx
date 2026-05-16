'use client';

import { useState, useEffect } from 'react';
import { XCircle, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { GlassPanel, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useTradeUpdates } from '@/lib/websocket';
import type { MemoryEntry, Trade } from '@/types/api';

export function TradeJournal() {
  const [trades, setTrades] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useTradeUpdates((data) => {
    const trade = data as Trade;
    if (trade.id) {
      const entry: MemoryEntry = {
        id: trade.id,
        timestamp: trade.timestamp,
        type: 'trade',
        content: `${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} @ $${trade.price}`,
        metadata: { trade },
      };
      setTrades(prev => [entry, ...prev].slice(0, 20));
    }
  });

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const data = await api.getMemory('trade', 20);
        setTrades(data);
      } catch (error) {
        console.error('Failed to fetch trades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <RefreshCw className="w-4 h-4 text-[var(--accent-blue)]" />;
      case 'analysis':
        return <CheckCircle className="w-4 h-4 text-[var(--bullish)]" />;
      case 'user_info':
        return <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Trade Journal" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Trade Journal" badge={trades.length.toString()} />

      {trades.length === 0 ? (
        <EmptyState
          message="No trades recorded yet"
          icon={<Clock className="w-8 h-8 text-zinc-600" />}
        />
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-64">
          {trades.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-2 rounded bg-[var(--background)]/50 hover:bg-[var(--background)] transition-colors"
            >
              {getStatusIcon(entry.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{entry.content}</div>
                <div className="text-xs text-zinc-500">{formatTime(entry.timestamp)}</div>
              </div>
              {entry.type === 'trade' && entry.metadata?.trade ? (
                <div className={`text-xs px-2 py-0.5 rounded ${
                  (entry.metadata.trade as Trade).status === 'filled'
                    ? 'bg-[var(--bullish)]/20 text-[var(--bullish)]'
                    : (entry.metadata.trade as Trade).status === 'rejected'
                    ? 'bg-[var(--bearish)]/20 text-[var(--bearish)]'
                    : 'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {(entry.metadata.trade as Trade).status}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}