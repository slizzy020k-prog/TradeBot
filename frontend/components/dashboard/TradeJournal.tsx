'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, RefreshCw, Filter, X } from 'lucide-react';
import { GlassPanel, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useTradeUpdates } from '@/lib/websocket';
import type { MemoryEntry, Trade } from '@/types/api';

interface FilterState {
  symbol: string;
  pnlFilter: 'all' | 'positive' | 'negative';
  qualityMin: number;
}

export function TradeJournal() {
  const [trades, setTrades] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    symbol: '',
    pnlFilter: 'all',
    qualityMin: 0,
  });

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
      setTrades(prev => [entry, ...prev].slice(0, 50));
    }
  });

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const data = await api.getMemory('trade', 50);
        setTrades(data);
      } catch (error) {
        console.error('Failed to fetch trades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set<string>();
    trades.forEach(t => {
      const trade = t.metadata?.trade as Trade;
      if (trade?.symbol) symbols.add(trade.symbol);
    });
    return Array.from(symbols).sort();
  }, [trades]);

  const filteredTrades = useMemo(() => {
    return trades.filter(entry => {
      const trade = entry.metadata?.trade as Trade | undefined;
      if (!trade) return true;

      if (filters.symbol && trade.symbol !== filters.symbol) return false;

      if (filters.pnlFilter === 'positive' && (trade.profitLoss === undefined || trade.profitLoss <= 0)) return false;
      if (filters.pnlFilter === 'negative' && (trade.profitLoss === undefined || trade.profitLoss >= 0)) return false;

      if (filters.qualityMin > 0 && (trade.qualityScore === undefined || trade.qualityScore < filters.qualityMin)) return false;

      return true;
    });
  }, [trades, filters]);

  const clearFilters = () => {
    setFilters({ symbol: '', pnlFilter: 'all', qualityMin: 0 });
  };

  const hasActiveFilters = filters.symbol || filters.pnlFilter !== 'all' || filters.qualityMin > 0;

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <RefreshCw className="w-4 h-4 text-[var(--accent-blue)]" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatPnL = (pnl?: number) => {
    if (pnl === undefined) return '-';
    return pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
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
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Trade Journal" badge={filteredTrades.length.toString()} />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1.5 rounded transition-colors ${showFilters ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--background)] text-zinc-400 hover:text-white'}`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {showFilters && (
        <div className="mb-3 p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
              className="px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--panel-border)] text-sm text-white"
            >
              <option value="">All Symbols</option>
              {uniqueSymbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filters.pnlFilter}
              onChange={(e) => setFilters({ ...filters, pnlFilter: e.target.value as any })}
              className="px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--panel-border)] text-sm text-white"
            >
              <option value="all">All P&L</option>
              <option value="positive">Winners</option>
              <option value="negative">Losers</option>
            </select>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filters.qualityMin}
                onChange={(e) => setFilters({ ...filters, qualityMin: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-zinc-500 w-16">Q&gt;{filters.qualityMin}</span>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      {filteredTrades.length === 0 ? (
        <EmptyState
          message={hasActiveFilters ? "No trades match filters" : "No trades recorded yet"}
          icon={<Clock className="w-8 h-8 text-zinc-600" />}
        />
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-64">
          {filteredTrades.map((entry) => {
            const trade = entry.metadata?.trade as Trade | undefined;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-2 rounded bg-[var(--background)]/50 hover:bg-[var(--background)] transition-colors"
              >
                {getStatusIcon(entry.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{entry.content}</div>
                  <div className="text-xs text-zinc-500">{formatTime(entry.timestamp)}</div>
                </div>
                {trade && (
                  <>
                    <div className={`text-xs font-mono ${trade.profitLoss && trade.profitLoss >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
                      {formatPnL(trade.profitLoss)}
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded ${
                      trade.status === 'filled'
                        ? 'bg-[var(--bullish)]/20 text-[var(--bullish)]'
                        : trade.status === 'rejected'
                        ? 'bg-[var(--bearish)]/20 text-[var(--bearish)]'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {trade.status}
                    </div>
                    {trade.qualityScore !== undefined && (
                      <div className={`text-xs px-2 py-0.5 rounded ${
                        trade.qualityScore >= 80
                          ? 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)]'
                          : trade.qualityScore >= 60
                          ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                          : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        Q:{trade.qualityScore.toFixed(0)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}