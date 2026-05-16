'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Globe } from 'lucide-react';
import { GlassPanel, MetricCard, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { MarketData } from '@/types/api';

// Mock global indices data
const GLOBAL_INDICES = [
  { name: 'S&P 500', symbol: 'SPX', basePrice: 5234.18 },
  { name: 'NASDAQ', symbol: 'IXIC', basePrice: 16428.82 },
  { name: 'DOW', symbol: 'DJI', basePrice: 39500.00 },
  { name: 'Russell 2000', symbol: 'RUT', basePrice: 2078.00 },
  { name: 'VIX', symbol: 'VIX', basePrice: 14.32 },
  { name: 'BTC/USD', symbol: 'BTC-USD', basePrice: 67500.00 },
  { name: 'ETH/USD', symbol: 'ETH-USD', basePrice: 3450.00 },
  { name: 'Gold', symbol: 'GC=F', basePrice: 2340.00 },
  { name: 'Oil', symbol: 'CL=F', basePrice: 78.50 },
  { name: 'US 10Y', symbol: '^TNX', basePrice: 4.52 },
];

// Mock sector heatmap data
const SECTORS = [
  { name: 'Technology', change: 1.24, marketCap: '11.2T' },
  { name: 'Healthcare', change: -0.45, marketCap: '6.8T' },
  { name: 'Financials', change: 0.87, marketCap: '7.1T' },
  { name: 'Energy', change: -1.32, marketCap: '4.2T' },
  { name: 'Consumer', change: 0.56, marketCap: '5.9T' },
  { name: 'Industrial', change: 1.89, marketCap: '4.8T' },
  { name: 'Utilities', change: -0.23, marketCap: '1.4T' },
  { name: 'Materials', change: 0.12, marketCap: '2.1T' },
  { name: 'Real Estate', change: -0.67, marketCap: '1.2T' },
  { name: 'Communications', change: 0.34, marketCap: '3.5T' },
];

export function MarketOverview() {
  const [indices, setIndices] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch real data for global indices
        const symbols = GLOBAL_INDICES.map(i => i.symbol);
        const data = await api.fetchQuotes(symbols);
        setIndices(data);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getIndexData = (symbol: string) => {
    return indices.find(i => i.symbol === symbol) || GLOBAL_INDICES.find(i => i.symbol === symbol);
  };

  const renderHeatmapCell = (sector: typeof SECTORS[0]) => {
    const isPositive = sector.change >= 0;
    const intensity = Math.min(Math.abs(sector.change) / 2, 1);

    return (
      <div
        key={sector.name}
        className={`
          p-3 rounded-lg flex flex-col items-center justify-center
          transition-all duration-300 hover:scale-105 cursor-pointer
          ${isPositive ? 'bg-[var(--bullish)]' : 'bg-[var(--bearish)]'}
        `}
        style={{
          opacity: 0.4 + intensity * 0.6,
        }}
      >
        <span className="text-xs font-medium text-white">{sector.name.substring(0, 4)}</span>
        <span className={`text-sm font-bold ${isPositive ? 'text-white' : 'text-white/90'}`}>
          {isPositive ? '+' : ''}{sector.change.toFixed(2)}%
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Global Market Overview" />
        <div className="space-y-4">
          <LoadingSkeleton className="h-20" />
          <LoadingSkeleton className="h-40" />
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Global Market Overview" badge="LIVE" />

      {/* Global Indices */}
      <div className="mb-4">
        <div className="grid grid-cols-5 gap-2">
          {GLOBAL_INDICES.slice(0, 5).map((idx) => {
            const data = getIndexData(idx.symbol) as typeof GLOBAL_INDICES[0] | MarketData;
            const price = 'price' in data ? data.price : idx.basePrice;
            const change = ((price - idx.basePrice) / idx.basePrice) * 100;

            return (
              <div
                key={idx.symbol}
                className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] hover:border-[var(--accent-blue)] transition-colors"
              >
                <div className="flex items-center gap-1 mb-1">
                  <Globe className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-400">{idx.name}</span>
                </div>
                <div className="font-mono text-sm font-medium">${price.toFixed(2)}</div>
                <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
                  {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crypto & Commodities */}
      <div className="mb-4">
        <div className="grid grid-cols-5 gap-2">
          {GLOBAL_INDICES.slice(5).map((idx) => {
            const data = getIndexData(idx.symbol) as typeof GLOBAL_INDICES[0] | MarketData;
            const price = 'price' in data ? data.price : idx.basePrice;
            const change = ((price - idx.basePrice) / idx.basePrice) * 100;

            return (
              <div
                key={idx.symbol}
                className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] hover:border-[var(--accent-teal)] transition-colors"
              >
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-400">{idx.name}</span>
                </div>
                <div className="font-mono text-sm font-medium">
                  {idx.symbol === '^TNX' ? `${price.toFixed(2)}%` : `$${price.toLocaleString()}`}
                </div>
                <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
                  {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector Heatmap */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Sector Performance</h4>
        <div className="grid grid-cols-5 gap-2">
          {SECTORS.map(renderHeatmapCell)}
        </div>
      </div>

      {/* Fear & Greed / Volatility */}
      <div className="mt-4 flex gap-4">
        <div className="flex-1 p-3 rounded-lg bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">Fear & Greed</span>
            <Activity className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--accent-teal)]">62</div>
          <div className="text-xs text-zinc-400">Greed</div>
        </div>

        <div className="flex-1 p-3 rounded-lg bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">VIX</span>
            <Activity className="w-4 h-4 text-[var(--accent-violet)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--accent-violet)]">14.32</div>
          <div className="text-xs text-zinc-400">Low Volatility</div>
        </div>

        <div className="flex-1 p-3 rounded-lg bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">Liquidity</span>
            <Activity className="w-4 h-4 text-[var(--bullish)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--bullish)]">High</div>
          <div className="text-xs text-zinc-400">Healthy</div>
        </div>
      </div>
    </GlassPanel>
  );
}