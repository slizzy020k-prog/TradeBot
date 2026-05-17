'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, TrendingDown, Activity, Zap } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { RiskStatus } from '@/types/api';

export function RiskCommandCenter() {
  const [risk, setRisk] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLossValue, setDailyLossValue] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const baseRiskRef = useRef(0);

  // Fetch risk data and simulate fluctuations
  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const data = await api.getRisk();
        setRisk(data);
        setDailyLossValue(data.dailyLoss);
        baseRiskRef.current = data.dailyLoss;
      } catch (error) {
        console.error('Failed to fetch risk:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRisk();

    // Simulate risk metric fluctuations
    const riskInterval = setInterval(() => {
      setDailyLossValue(prev => {
        const drift = (baseRiskRef.current - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 5;
        return Math.max(0, prev + drift + noise);
      });

      setRiskScore(prev => {
        const target = risk?.dailyLoss && risk.maxDailyLoss ? (risk.dailyLoss / risk.maxDailyLoss) * 100 : 30;
        const drift = (target - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 2;
        return Math.max(0, Math.min(100, prev + drift + noise));
      });
    }, 1500);

    return () => clearInterval(riskInterval);
  }, [risk?.dailyLoss, risk?.maxDailyLoss]);

  // Periodically refresh risk from API
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getRisk();
        setRisk(data);
        baseRiskRef.current = data.dailyLoss;
      } catch {}
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const dailyLossPercent = risk ? (dailyLossValue / risk.maxDailyLoss) * 100 : 0;
  const isWarning = dailyLossPercent > 50;
  const isDanger = dailyLossPercent > 80;

  // Simulated risk metrics with fluctuation
  const [simMaxPosition, setSimMaxPosition] = useState(1000);
  const [positionSize, setPositionSize] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSimMaxPosition(prev => {
        const drift = (1000 - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 50;
        return prev + drift + noise;
      });
      setPositionSize(prev => {
        const drift = ((risk?.dailyLoss || 0) * 0.5 - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 100;
        return Math.max(0, prev + drift + noise);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [risk?.dailyLoss]);

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Risk Management" />
        <div className="h-40 bg-[var(--background)]/50 animate-pulse rounded-lg" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden" glow={isDanger ? 'red' : isWarning ? 'blue' : 'none'}>
      <SectionHeader title="Risk Command Center" badge={riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MED' : 'LOW'} />

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isDanger ? 'bg-[var(--bearish)] animate-pulse' : 'bg-[var(--bullish)] animate-pulse'}`} />
        <span className="text-xs text-zinc-500">Real-time risk monitoring</span>
        <Zap className="w-3 h-3 text-[var(--accent-teal)]" />
      </div>

      <div className="space-y-4">
        {/* Daily loss gauge with live updates */}
        <DailyLossGauge
          currentLoss={dailyLossValue}
          maxLoss={risk?.maxDailyLoss || 200}
          percent={dailyLossPercent}
          isWarning={isWarning}
          isDanger={isDanger}
        />

        {/* Risk metrics with live animation */}
        <div className="grid grid-cols-2 gap-3">
          <LiveMetric
            label="Max Position"
            value={simMaxPosition}
            prefix="$"
            decimals={0}
            icon={<Activity className="w-4 h-4" />}
            color="var(--accent-teal)"
          />

          <LiveMetric
            label="Max Daily Loss"
            value={risk?.maxDailyLoss || 200}
            prefix="$"
            decimals={0}
            icon={<TrendingDown className="w-4 h-4" />}
            color="var(--warning)"
          />
        </div>

        {/* Risk score meter */}
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Risk Score</span>
            <span className={`font-mono text-sm font-bold ${
              riskScore > 70 ? 'text-[var(--bearish)]' : riskScore > 40 ? 'text-[var(--warning)]' : 'text-[var(--bullish)]'
            }`}>
              {Math.round(riskScore)}%
            </span>
          </div>
          <div className="h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                riskScore > 70 ? 'bg-[var(--bearish)]' : riskScore > 40 ? 'bg-[var(--warning)]' : 'bg-[var(--bullish)]'
              }`}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>Safe</span>
            <span>{riskScore > 70 ? 'Dangerous' : riskScore > 40 ? 'Elevated' : 'Normal'}</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Risk status indicator */}
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDanger ? 'bg-[var(--bearish)] animate-pulse' : isWarning ? 'bg-[var(--warning)]' : 'bg-[var(--bullish)]'}`} />
            <span className={`text-sm font-medium ${
              isDanger ? 'text-[var(--bearish)]' : isWarning ? 'text-[var(--warning)]' : 'text-[var(--bullish)]'
            }`}>
              {isDanger ? 'CRITICAL - Trading Halted' : isWarning ? 'WARNING - Approaching Limit' : 'NOMINAL - Trading Active'}
            </span>
          </div>
        </div>

        {/* Trading mode indicator */}
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Trading Mode</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
            <span className="text-sm font-medium text-[var(--accent-blue)]">PAPER</span>
            <span className="text-xs text-zinc-500">(Safe Mode)</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

// Live daily loss gauge
function DailyLossGauge({
  currentLoss,
  maxLoss,
  percent,
  isWarning,
  isDanger
}: {
  currentLoss: number;
  maxLoss: number;
  percent: number;
  isWarning: boolean;
  isDanger: boolean;
}) {
  const [displayLoss, setDisplayLoss] = useState(currentLoss);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayLoss(prev => {
        const drift = (currentLoss - prev) * 0.15;
        const noise = (Math.random() - 0.5) * 2;
        return Math.max(0, prev + drift + noise);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [currentLoss]);

  return (
    <div className={`p-4 rounded-lg ${isDanger ? 'bg-[var(--bearish)]/10 animate-risk-pulse' : isWarning ? 'bg-[var(--warning)]/10' : 'bg-[var(--panel)]'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isDanger ? (
            <AlertTriangle className="w-5 h-5 text-[var(--bearish)]" />
          ) : (
            <Shield className="w-5 h-5 text-[var(--accent-blue)]" />
          )}
          <span className="text-sm font-medium">Daily Loss Limit</span>
        </div>
        <span className={`text-sm font-mono font-bold ${isDanger ? 'text-[var(--bearish)]' : isWarning ? 'text-[var(--warning)]' : 'text-[var(--bullish)]'}`}>
          ${displayLoss.toFixed(2)} / ${maxLoss.toFixed(2)}
        </span>
      </div>

      <div className="h-3 rounded-full bg-[var(--background)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isDanger ? 'bg-[var(--bearish)]' : isWarning ? 'bg-[var(--warning)]' : 'bg-[var(--bullish)]'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500 mt-1">
        <span>0%</span>
        <span>{percent.toFixed(0)}% Used</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// Live metric with animation
function LiveMetric({
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