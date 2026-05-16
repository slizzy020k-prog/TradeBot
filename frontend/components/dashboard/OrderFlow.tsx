'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { usePortfolioUpdates } from '@/lib/websocket';
import type { PortfolioState } from '@/types/api';

export function OrderFlow() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [loading, setLoading] = useState(true);

  usePortfolioUpdates((data) => {
    setPortfolio(data as PortfolioState);
    setLoading(false);
  });

  useEffect(() => {
    api.getPortfolio().then(setPortfolio).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Order Flow" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  const positions = Object.entries(portfolio?.positions || {});
  const totalVolume = positions.reduce((sum, [, qty]) => sum + qty, 0);

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Order Flow" badge="LIVE" />

      {/* Volume bar */}
      <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Volume</span>
          </div>
          <span className="font-mono text-sm font-medium">{totalVolume.toLocaleString()}</span>
        </div>
        <div className="h-8 rounded bg-[var(--panel)] relative overflow-hidden">
          {positions.map(([symbol, qty], i) => (
            <div
              key={symbol}
              className="absolute top-0 h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)]"
              style={{
                left: `${(i / positions.length) * 100}%`,
                width: `${(Number(qty) / totalVolume) * 100}%`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bid/Ask imbalance - placeholder */}
      <div className="mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Bid/Ask Imbalance</div>
        <div className="flex h-16 rounded overflow-hidden">
          <div className="w-1/2 bg-[var(--bullish)]/20 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[var(--bullish)]" />
          </div>
          <div className="w-1/2 bg-[var(--bearish)]/20 flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-[var(--bearish)]" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>52%</span>
          <span>48%</span>
        </div>
      </div>

      {/* Liquidity zones - placeholder */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Liquidity Zones</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--bullish)]/5 border-l-2 border-[var(--bullish)]">
            <span className="text-xs font-mono">$185.50</span>
            <span className="text-xs text-zinc-500">Bid wall</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--bearish)]/5 border-l-2 border-[var(--bearish)]">
            <span className="text-xs font-mono">$186.20</span>
            <span className="text-xs text-zinc-500">Ask wall</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}