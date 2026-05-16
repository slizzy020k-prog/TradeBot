'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Scale, Shield, Target } from 'lucide-react';
import { GlassPanel, ConfidenceRing } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';

export function CEOPanel() {
  const [stats, setStats] = useState<{ learning: { wins: number; losses: number; total: number } } | null>(null);

  useEffect(() => {
    api.getStats().then(data => {
      setStats(data as { learning: { wins: number; losses: number; total: number } });
    }).catch(console.error);
  }, []);

  const winRate = stats?.learning.total
    ? (stats.learning.wins / stats.learning.total) * 100
    : 0;

  const getClassification = (score: number) => {
    if (score >= 90) return { label: 'INSTITUTIONAL GRADE', color: 'var(--bullish)' };
    if (score >= 80) return { label: 'HIGH QUALITY', color: 'var(--accent-teal)' };
    if (score >= 70) return { label: 'MODERATE', color: 'var(--warning)' };
    if (score >= 60) return { label: 'WEAK', color: 'var(--accent-violet)' };
    return { label: 'LOW QUALITY', color: 'var(--bearish)' };
  };

  return (
    <GlassPanel className="h-full overflow-hidden" glow="red">
      <SectionHeader title="CEO Oversight" badge="Active" />

      {/* CEO Status */}
      <div className="p-4 rounded-lg bg-gradient-to-br from-[var(--bearish)]/10 to-transparent border border-[var(--bearish)]/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-[var(--bearish)]/20 flex items-center justify-center">
            <Scale className="w-6 h-6 text-[var(--bearish)]" />
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--bearish)]">CEO AGENT</div>
            <div className="text-xs text-zinc-400">Autonomous Oversight Active</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded bg-[var(--background)]/50">
            <div className="text-xs text-zinc-500">Strategic Quality</div>
            <div className="text-lg font-bold text-[var(--accent-teal)]">92</div>
          </div>
          <div className="p-2 rounded bg-[var(--background)]/50">
            <div className="text-xs text-zinc-500">Risk Integrity</div>
            <div className="text-lg font-bold text-[var(--accent-teal)]">95</div>
          </div>
          <div className="p-2 rounded bg-[var(--background)]/50">
            <div className="text-xs text-zinc-500">Execution Precision</div>
            <div className="text-lg font-bold text-[var(--warning)]">78</div>
          </div>
          <div className="p-2 rounded bg-[var(--background)]/50">
            <div className="text-xs text-zinc-500">Discipline Score</div>
            <div className="text-lg font-bold text-[var(--bullish)]">88</div>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="mt-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Learning Performance</div>
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-500" />
              <span className="text-sm">Win Rate</span>
            </div>
            <span className="text-lg font-bold font-mono text-[var(--bullish)]">{winRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--panel)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--bullish)]" style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>{stats?.learning.wins || 0} Wins</span>
            <span>{stats?.learning.losses || 0} Losses</span>
          </div>
        </div>
      </div>

      {/* Recent Decisions */}
      <div className="mt-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Recent Decisions</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--bullish)]/5 border border-[var(--bullish)]/20">
            <CheckCircle className="w-4 h-4 text-[var(--bullish)]" />
            <span className="text-xs">AAPL position approved</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--bullish)]/5 border border-[var(--bullish)]/20">
            <CheckCircle className="w-4 h-4 text-[var(--bullish)]" />
            <span className="text-xs">TSLA stop-loss confirmed</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--warning)]/5 border border-[var(--warning)]/20">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
            <span className="text-xs">Risk check override for BTC</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}