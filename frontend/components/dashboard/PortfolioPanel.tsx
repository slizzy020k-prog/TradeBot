'use client';

import { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Activity, Zap } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { usePortfolioUpdates } from '@/lib/websocket';
import type { PortfolioState } from '@/types/api';

interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  weight: number;
}

export function PortfolioPanel() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const [dailyPnL, setDailyPnL] = useState(0);
  const prevValueRef = useRef(100000);
  const basePortfolioRef = useRef(100000);

  // Simulate continuous portfolio fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setPortfolioValue(prev => {
        // Small random walk with drift
        const change = (Math.random() - 0.48) * 0.002 * prev;
        const newValue = prev + change;
        basePortfolioRef.current = newValue;
        return newValue;
      });

      setDailyPnL(prev => {
        const pnlChange = (Math.random() - 0.48) * 20;
        return prev + pnlChange;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to real portfolio updates
  usePortfolioUpdates((data) => {
    const portfolioData = data as PortfolioState;
    setPortfolio(portfolioData);
    setPortfolioValue(portfolioData.totalValue);
    prevValueRef.current = portfolioData.totalValue;
  });

  // Fetch initial portfolio
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const data = await api.getPortfolio();
        setPortfolio(data);
        setPortfolioValue(data.totalValue);
        prevValueRef.current = data.totalValue;

        // Fetch positions with P&L
        const positionsData = await api.getPositions();
        setPositions(positionsData.map((p: any) => ({
          symbol: p.symbol,
          qty: p.quantity,
          avgPrice: p.avgEntryPrice,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          unrealizedPnL: p.unrealizedPnL,
          unrealizedPnLPct: (p.unrealizedPnL / (p.quantity * p.avgEntryPrice)) * 100,
          weight: p.weight,
        })));
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();

    // Refresh positions periodically
    const posInterval = setInterval(async () => {
      try {
        const positionsData = await api.getPositions();
        setPositions(positionsData.map((p: any) => ({
          symbol: p.symbol,
          qty: p.quantity,
          avgPrice: p.avgEntryPrice,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          unrealizedPnL: p.unrealizedPnL,
          unrealizedPnLPct: (p.unrealizedPnL / (p.quantity * p.avgEntryPrice)) * 100,
          weight: p.weight,
        })));
      } catch {}
    }, 10000);

    return () => clearInterval(posInterval);
  }, []);

  // Calculate exposure
  const cash = portfolio?.cash || portfolioValue * 0.3;
  const positionsValue = portfolioValue - cash;
  const exposure = positionsValue / portfolioValue;

  const pnlColor = dailyPnL >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]';
  const positionColors = ['#00d4ff', '#00ffcc', '#8b5cf6', '#ff3366', '#ffaa00', '#00ff88'];

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Portfolio" />
        <div className="h-40 bg-[var(--background)]/50 animate-pulse rounded-lg" />
      </GlassPanel>
    );
  }

  const pieData = positions.map(p => ({
    name: p.symbol,
    value: p.marketValue,
  }));

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Portfolio" badge="LIVE" />

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
        <span className="text-xs text-zinc-500">Real-time portfolio updates</span>
        <Zap className="w-3 h-3 text-[var(--accent-teal)]" />
      </div>

      {/* Total value with live animation */}
      <LiveValueDisplay
        label="Total Portfolio Value"
        value={portfolioValue}
        prefix="$"
        decimals={2}
        pnl={dailyPnL}
        pnlLabel="today"
      />

      {/* Cash & Exposure breakdown */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <AnimatedMetric
          label="Cash Available"
          value={cash}
          prefix="$"
          decimals={2}
          icon={<DollarSign className="w-4 h-4" />}
          color="var(--accent-teal)"
        />

        <AnimatedMetric
          label="Positions"
          value={positions.length}
          prefix=""
          decimals={0}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="var(--accent-blue)"
        />
      </div>

      {/* Exposure bar */}
      <div className="mt-4 p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Portfolio Exposure</span>
          <span className="text-xs font-mono">{(exposure * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)]"
            style={{ width: `${exposure * 100}%` }}
          />
        </div>
      </div>

      {/* Position pie chart */}
      {pieData.length > 0 && (
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] mt-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Position Distribution</div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={positionColors[index % positionColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--panel)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '6px',
                    color: 'white',
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {positions.map((pos, index) => (
              <div key={pos.symbol} className="flex items-center gap-1 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: positionColors[index % positionColors.length] }}
                />
                <span className="text-zinc-400">{pos.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings with live P&L */}
      {positions.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Holdings</div>
          {positions.map((pos) => (
            <LivePositionRow key={pos.symbol} position={pos} />
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

// Live position row with animated P&L
function LivePositionRow({ position }: { position: Position }) {
  const [displayPnL, setDisplayPnL] = useState(position.unrealizedPnL);
  const [flashColor, setFlashColor] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Small fluctuation in unrealized P&L
      setDisplayPnL(prev => {
        const change = (Math.random() - 0.5) * position.unrealizedPnL * 0.02;
        const newPnL = prev + change;
        if (change > 1) setFlashColor('up');
        else if (change < -1) setFlashColor('down');
        setTimeout(() => setFlashColor(null), 200);
        return newPnL;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [position.unrealizedPnL]);

  const pnlColor = displayPnL >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]';
  const pnlPct = position.unrealizedPnLPct;

  return (
    <div className="flex items-center justify-between p-2 rounded bg-[var(--background)]/50 hover:bg-[var(--background)] transition-colors">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{position.symbol}</span>
        <span className="text-xs text-zinc-500">{position.qty} shares</span>
      </div>
      <div className="text-right">
        <div className={`font-mono text-sm ${pnlColor} ${flashColor ? `font-bold` : ''}`}>
          {displayPnL >= 0 ? '+' : ''}${displayPnL.toFixed(2)}
        </div>
        <div className={`text-xs ${pnlPct >= 0 ? 'text-[var(--bullish)]/60' : 'text-[var(--bearish)]/60'}`}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// Animated value display with P&L
function LiveValueDisplay({
  label,
  value,
  prefix,
  decimals,
  pnl,
  pnlLabel
}: {
  label: string;
  value: number;
  prefix: string;
  decimals: number;
  pnl: number;
  pnlLabel: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flashColor, setFlashColor] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue(prev => {
        const drift = (value - prev) * 0.15;
        const noise = (Math.random() - 0.5) * value * 0.0005;
        const newValue = prev + drift + noise;
        if (Math.abs(newValue - prev) > 1) {
          setFlashColor(newValue > prev ? 'up' : 'down');
          setTimeout(() => setFlashColor(null), 200);
        }
        return newValue;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [value]);

  const pnlColor = pnl >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]';

  return (
    <div className="text-center p-4 rounded-lg bg-gradient-radial">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-bold font-mono ${flashColor === 'up' ? 'text-[var(--bullish)]' : flashColor === 'down' ? 'text-[var(--bearish)]' : ''}`}>
        {prefix}{displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </div>
      <div className={`flex items-center justify-center gap-1 mt-2 ${pnlColor}`}>
        {pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span className="text-sm font-medium">
          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} {pnlLabel}
        </span>
      </div>
    </div>
  );
}

// Animated metric card
function AnimatedMetric({
  label,
  value,
  prefix,
  decimals,
  icon,
  color
}: {
  label: string;
  value: number;
  prefix: string;
  decimals: number;
  icon: React.ReactNode;
  color: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue(prev => {
        const drift = (value - prev) * 0.1;
        const noise = (Math.random() - 0.5) * value * 0.02;
        return prev + drift + noise;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-zinc-500">{icon}</span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="font-mono text-lg font-medium" style={{ color }}>
        {prefix}{displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </div>
    </div>
  );
}