'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { GlassPanel, MetricCard, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { usePortfolioUpdates } from '@/lib/websocket';
import type { PortfolioState } from '@/types/api';

export function PortfolioPanel() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to portfolio updates
  usePortfolioUpdates((data) => {
    setPortfolio(data as PortfolioState);
    setLoading(false);
  });

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const data = await api.getPortfolio();
        setPortfolio(data);
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  const positionData = portfolio
    ? Object.entries(portfolio.positions).map(([symbol, qty]) => ({
        symbol,
        value: qty,
      }))
    : [];

  const COLORS = ['#00d4ff', '#00ffcc', '#8b5cf6', '#ff3366', '#ffaa00', '#00ff88'];

  const pnlColor = portfolio && portfolio.dailyPnL >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]';

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Portfolio" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Portfolio" badge="LIVE" />

      <div className="space-y-4">
        {/* Total value */}
        <div className="text-center p-4 rounded-lg bg-gradient-radial">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Portfolio Value</div>
          <div className="text-3xl font-bold font-mono">
            ${portfolio?.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </div>
          <div className={`flex items-center justify-center gap-1 mt-2 ${pnlColor}`}>
            {portfolio && portfolio.dailyPnL >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {portfolio && portfolio.dailyPnL >= 0 ? '+' : ''}
              ${portfolio?.dailyPnL.toFixed(2) || '0.00'} today
            </span>
          </div>
        </div>

        {/* Cash & Positions breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Cash Available</span>
            </div>
            <div className="font-mono text-lg font-medium text-[var(--accent-teal)]">
              ${portfolio?.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </div>
          </div>

          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Positions</span>
            </div>
            <div className="font-mono text-lg font-medium">
              {Object.keys(portfolio?.positions || {}).length || 0}
            </div>
          </div>
        </div>

        {/* Position pie chart */}
        {positionData.length > 0 && (
          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Position Distribution</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={positionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {positionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--panel)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '6px',
                      color: 'white',
                    }}
                    formatter={(value) => [`${value} shares`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-2">
              {positionData.map((entry, index) => (
                <div key={entry.symbol} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-zinc-400">{entry.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active positions list */}
        {positionData.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Holdings</div>
            {positionData.map((pos) => (
              <div
                key={pos.symbol}
                className="flex items-center justify-between p-2 rounded bg-[var(--background)]/50 hover:bg-[var(--background)] transition-colors"
              >
                <span className="font-medium text-sm">{pos.symbol}</span>
                <span className="font-mono text-sm text-zinc-400">{pos.value} shares</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}