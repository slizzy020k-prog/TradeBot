'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Globe, Zap } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/ui';
import { useMarketSimulation, useAnimatedPrice } from '@/lib/marketSimulation';
import { api } from '@/lib/api';
import type { MarketData } from '@/types/api';

interface FearGreedData {
  value: number;
  label: string;
  vix: number;
}

interface SectorData {
  name: string;
  change: number;
}

// Animated price display with flash effect
function AnimatedPrice({ symbol, prefix = '$', decimals = 2 }: { symbol: string; prefix?: string; decimals?: number }) {
  const { price, change, changePercent, flashColor } = useAnimatedPrice(symbol);

  return (
    <div className="font-mono text-sm font-medium">
      <span className={`
        transition-colors duration-300
        ${flashColor === 'up' ? 'text-[var(--bullish)]' : flashColor === 'down' ? 'text-[var(--bearish)]' : ''}
      `}>
        {prefix}{price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
      <div className={`flex items-center gap-1 text-xs ${changePercent >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>
        {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
      </div>
    </div>
  );
}

// Sector cell with dynamic intensity
function DynamicSectorCell({ sector, onClick }: { sector: SectorData; onClick?: () => void }) {
  const [opacity, setOpacity] = useState(0.5);
  const [change, setChange] = useState(sector.change);

  useEffect(() => {
    const interval = setInterval(() => {
      // Small random fluctuation in sector performance
      setChange(prev => {
        const drift = (sector.change - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 0.2;
        return prev + drift + noise;
      });
      setOpacity(0.4 + Math.min(Math.abs(change) / 2, 1) * 0.6);
    }, 2000);

    return () => clearInterval(interval);
  }, [sector.change, change]);

  const isPositive = change >= 0;

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg flex flex-col items-center justify-center
        transition-all duration-500 hover:scale-105 cursor-pointer
        ${isPositive ? 'bg-[var(--bullish)]' : 'bg-[var(--bearish)]'}
      `}
      style={{ opacity }}
    >
      <span className="text-xs font-medium text-white">{sector.name.substring(0, 4)}</span>
      <span className={`text-sm font-bold ${isPositive ? 'text-white' : 'text-white/90'}`}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketOverview() {
  const { prices, getAllPrices, isRunning } = useMarketSimulation({
    updateIntervalMs: 500,
    volatilityBase: 1.0,
    enableSimulation: true
  });

  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sectorsData, fgData] = await Promise.all([
          api.getMarketSectors(),
          api.getFearGreed()
        ]);

        setSectors(sectorsData);
        setFearGreed(fgData);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Update fear/greed occasionally
    const fgInterval = setInterval(async () => {
      try {
        const fg = await api.getFearGreed();
        setFearGreed(fg);
      } catch {}
    }, 30000);

    return () => clearInterval(fgInterval);
  }, []);

  // Get current price data
  const getPriceData = (symbol: string) => prices.get(symbol);

  const indexSymbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const cryptoSymbols = ['BTC-USD', 'ETH-USD', 'GC=F', 'CL=F', '^TNX'];

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Global Market Overview" />
        <div className="space-y-4">
          <div className="h-20 bg-[var(--background)]/50 animate-pulse rounded-lg" />
          <div className="h-40 bg-[var(--background)]/50 animate-pulse rounded-lg" />
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Global Market Overview" badge={isRunning ? "LIVE" : "SIM"} />

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[var(--bullish)] animate-pulse' : 'bg-zinc-500'}`} />
        <span className="text-xs text-zinc-500">
          {isRunning ? 'Simulated market data active' : 'Connecting...'}
        </span>
        {isRunning && <Zap className="w-3 h-3 text-[var(--accent-teal)]" />}
      </div>

      {/* Global Indices */}
      <div className="mb-4">
        <div className="grid grid-cols-4 gap-2">
          {indexSymbols.map((symbol) => {
            const data = getPriceData(symbol);
            const price = data?.price || 0;
            const change = data?.changePercent || 0;

            return (
              <div
                key={symbol}
                className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] hover:border-[var(--accent-blue)] transition-colors"
              >
                <div className="flex items-center gap-1 mb-1">
                  <Globe className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-400">{symbol}</span>
                </div>
                <div className="font-mono text-sm font-medium">
                  ${price.toLocaleString()}
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

      {/* Crypto & Commodities */}
      <div className="mb-4">
        <div className="grid grid-cols-5 gap-2">
          {cryptoSymbols.map((symbol) => {
            const data = getPriceData(symbol);
            const price = data?.price || 0;
            const change = data?.changePercent || 0;

            return (
              <div
                key={symbol}
                className="p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] hover:border-[var(--accent-teal)] transition-colors"
              >
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-400">{symbol}</span>
                </div>
                <div className="font-mono text-sm font-medium">
                  {symbol === '^TNX' ? `${price.toFixed(2)}%` : `$${price.toLocaleString()}`}
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

      {/* Dynamic Sector Heatmap */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Sector Performance</h4>
        <div className="grid grid-cols-5 gap-2">
          {sectors.map((sector, i) => (
            <DynamicSectorCell key={`${sector.name}-${i}`} sector={sector} />
          ))}
        </div>
      </div>

      {/* Fear & Greed / Volatility with live updates */}
      <div className="mt-4 flex gap-4">
        <LiveUpdatingMetric
          label="Fear & Greed"
          value={fearGreed?.value || 50}
          displayValue={fearGreed?.value?.toString() || '--'}
          color="var(--accent-teal)"
          icon={<Activity className="w-4 h-4" />}
          subLabel={fearGreed?.label || 'Loading'}
          min={0}
          max={100}
        />

        <LiveUpdatingMetric
          label="VIX"
          value={fearGreed?.vix || 15}
          displayValue={fearGreed?.vix?.toFixed(2) || '--'}
          color="var(--accent-violet)"
          icon={<Activity className="w-4 h-4" />}
          subLabel="Volatility Index"
          min={10}
          max={40}
        />

        <LiveUpdatingMetric
          label="Liquidity"
          value={75}
          displayValue="High"
          color="var(--bullish)"
          icon={<Activity className="w-4 h-4" />}
          subLabel="Healthy"
          min={0}
          max={100}
        />
      </div>
    </GlassPanel>
  );
}

// Live updating metric with animated bar
function LiveUpdatingMetric({
  label,
  value,
  displayValue,
  color,
  icon,
  subLabel,
  min,
  max
}: {
  label: string;
  value: number;
  displayValue: string;
  color: string;
  icon: React.ReactNode;
  subLabel: string;
  min: number;
  max: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(value);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedValue(prev => {
        const drift = (value - prev) * 0.2;
        const noise = (Math.random() - 0.5) * 2;
        return prev + drift + noise;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [value]);

  const percentage = ((animatedValue - min) / (max - min)) * 100;

  return (
    <div className="flex-1 p-3 rounded-lg bg-[var(--background)] border border-[var(--panel-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{displayValue}</div>
      <div className="text-xs text-zinc-400">{subLabel}</div>
      {/* Animated progress bar */}
      <div className="mt-2 h-1 bg-[var(--background-secondary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}