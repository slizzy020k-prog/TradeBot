'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Award } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  monthlyReturns: { month: string; return: number }[];
  equityCurve: { date: string; value: number }[];
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        const data = await api.getPerformanceMetrics(days);
        setMetrics(data as PerformanceMetrics);
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeframe]);

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Performance Analytics" />
        <LoadingSkeleton className="h-60" />
      </GlassPanel>
    );
  }

  if (!metrics) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Performance Analytics" />
        <div className="text-zinc-500 text-sm">No performance data available</div>
      </GlassPanel>
    );
  }

  const isPositive = metrics.totalReturn >= 0;

  return (
    <GlassPanel className="h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Performance Analytics" />
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs rounded ${
                timeframe === tf
                  ? 'bg-[var(--accent-blue)] text-white'
                  : 'bg-[var(--background)] text-zinc-400 hover:text-white'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className={`p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center`}>
          <div className={`text-lg font-bold font-mono ${isPositive ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
            {isPositive ? '+' : ''}{metrics.totalReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-500">Total Return</div>
        </div>
        <div className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className="text-lg font-bold font-mono text-[var(--accent-teal)]">{metrics.sharpeRatio.toFixed(2)}</div>
          <div className="text-xs text-zinc-500">Sharpe Ratio</div>
        </div>
        <div className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className="text-lg font-bold font-mono text-[var(--warning)]">{metrics.maxDrawdown.toFixed(2)}%</div>
          <div className="text-xs text-zinc-500">Max Drawdown</div>
        </div>
        <div className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <div className={`text-lg font-bold font-mono ${metrics.winRate >= 50 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
            {metrics.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-500">Win Rate</div>
        </div>
      </div>

      {/* Equity curve */}
      <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Equity Curve</div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.equityCurve.slice(-30)}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? 'var(--bullish)' : 'var(--bearish)'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? 'var(--bullish)' : 'var(--bearish)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide tick={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--panel)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                }}
                labelFormatter={(label) => `Date: ${label}`}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Equity']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? 'var(--bullish)' : 'var(--bearish)'}
                fill="url(#colorEquity)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly returns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Monthly Returns</div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlyReturns.slice(-6)}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--panel)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${Number(value) >= 0 ? '+' : ''}$${Number(value).toFixed(2)}`, 'Return']}
                />
                <Bar
                  dataKey="return"
                  fill={metrics.totalReturn >= 0 ? 'var(--bullish)' : 'var(--bearish)'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Trade Stats</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-[var(--bullish)]" />
              <span>{metrics.winningTrades} Wins</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="w-3 h-3 text-[var(--bearish)]" />
              <span>{metrics.losingTrades} Losses</span>
            </div>
            <div className="flex items-center gap-1">
              {isPositive ? <TrendingUp className="w-3 h-3 text-[var(--bullish)]" /> : <TrendingDown className="w-3 h-3 text-[var(--bearish)]" />}
              <span>P/F: {metrics.profitFactor.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Avg Win: ${metrics.avgWin.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}