'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import { GlassPanel, MetricCard, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { RiskStatus } from '@/types/api';

export function RiskCommandCenter() {
  const [risk, setRisk] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const data = await api.getRisk();
        setRisk(data);
      } catch (error) {
        console.error('Failed to fetch risk:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRisk();
    const interval = setInterval(fetchRisk, 10000);
    return () => clearInterval(interval);
  }, []);

  const dailyLossPercent = risk ? (risk.dailyLoss / risk.maxDailyLoss) * 100 : 0;
  const isWarning = dailyLossPercent > 50;
  const isDanger = dailyLossPercent > 80;

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Risk Management" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden" glow={isDanger ? 'red' : isWarning ? 'blue' : 'none'}>
      <SectionHeader title="Risk Command Center" />

      <div className="space-y-4">
        {/* Daily loss gauge */}
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
              ${risk?.dailyLoss.toFixed(2) || '0.00'} / ${risk?.maxDailyLoss.toFixed(2) || '200.00'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full bg-[var(--background)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDanger ? 'bg-[var(--bearish)]' : isWarning ? 'bg-[var(--warning)]' : 'bg-[var(--bullish)]'
              }`}
              style={{ width: `${Math.min(dailyLossPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>0%</span>
            <span>{dailyLossPercent.toFixed(0)}% Used</span>
            <span>100%</span>
          </div>
        </div>

        {/* Risk metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Max Position</span>
            </div>
            <div className="font-mono text-lg font-medium text-[var(--accent-teal)]">
              ${risk?.maxPositionSize.toLocaleString() || '1,000'}
            </div>
          </div>

          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Max Daily Loss</span>
            </div>
            <div className="font-mono text-lg font-medium text-[var(--warning)]">
              ${risk?.maxDailyLoss.toLocaleString() || '200'}
            </div>
          </div>
        </div>

        {/* Risk status indicator */}
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isDanger ? 'status-dot-error animate-pulse' : isWarning ? 'status-dot-warning' : 'status-dot-active'}`} />
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
            <div className="status-dot status-dot-active" />
            <span className="text-sm font-medium text-[var(--accent-blue)]">PAPER</span>
            <span className="text-xs text-zinc-500">(Safe Mode)</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}