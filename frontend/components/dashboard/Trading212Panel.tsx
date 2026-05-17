'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';

interface T212Position {
  ticker: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface T212Portfolio {
  totalValue: number;
  cash: number;
  positionsValue: number;
}

export function Trading212Panel() {
  const [portfolio, setPortfolio] = useState<T212Portfolio | null>(null);
  const [positions, setPositions] = useState<T212Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [portfolioData, positionsData] = await Promise.all([
        api.getT212Portfolio(),
        api.getT212Positions(),
      ]);
      setPortfolio(portfolioData as T212Portfolio);
      setPositions(positionsData as T212Position[]);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch Trading 212 data:', err);
      setError('Failed to connect to Trading 212 API. Check your API key.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Trading 212" badge="BETA" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  if (error) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Trading 212" badge="BETA" />
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="text-[var(--bearish)] text-sm">{error}</div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--panel)] border border-[var(--panel-border)] text-sm hover:border-[var(--accent-teal)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </GlassPanel>
    );
  }

  const totalPnL = positions.reduce((sum, p) => sum + p.profitLoss, 0);

  return (
    <GlassPanel className="h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Trading 212" badge="LIVE" />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${lastUpdate ? 'bg-[var(--bullish)] animate-pulse' : 'bg-zinc-500'}`} />
          <button
            onClick={fetchData}
            className="p-1.5 rounded hover:bg-[var(--panel)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wallet className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-xs text-zinc-500">Portfolio</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            ${portfolio?.totalValue.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className="text-xs text-zinc-500 mb-1">Cash</div>
          <div className="text-lg font-bold font-mono text-[var(--accent-teal)]">
            ${portfolio?.cash.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className="text-xs text-zinc-500 mb-1">P&L</div>
          <div className={`text-lg font-bold font-mono ${totalPnL >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Positions ({positions.length})</div>

      {positions.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-zinc-500">
          <div className="text-center">
            <div className="text-sm">No open positions</div>
            <div className="text-xs mt-1">Connect your Trading 212 account</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {positions.map((pos) => (
            <div
              key={pos.ticker}
              className="flex items-center justify-between p-2 rounded bg-[var(--background)]/50 border border-[var(--panel-border)] hover:border-[var(--accent-teal)]/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center ${
                  pos.profitLoss >= 0 ? 'bg-[var(--bullish)]/10' : 'bg-[var(--bearish)]/10'
                }`}>
                  {pos.profitLoss >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[var(--bullish)]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[var(--bearish)]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{pos.ticker}</div>
                  <div className="text-xs text-zinc-500">{pos.quantity} shares</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-mono">${(pos.currentPrice * pos.quantity).toFixed(2)}</div>
                <div className={`text-xs font-mono ${pos.profitLoss >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
                  {pos.profitLoss >= 0 ? '+' : ''}{pos.profitLoss.toFixed(2)} ({pos.profitLossPercent.toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Last updated */}
      <div className="flex items-center gap-1 mt-3 text-xs text-zinc-500">
        <Clock className="w-3 h-3" />
        <span>
          {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Not updated yet'}
        </span>
      </div>
    </GlassPanel>
  );
}