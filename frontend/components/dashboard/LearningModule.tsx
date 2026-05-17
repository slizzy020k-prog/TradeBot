'use client';

import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Award, Zap } from 'lucide-react';
import { GlassPanel, LoadingSkeleton } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface LearningStats {
  patternsLearned: number;
  avgResponseMs: number;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

interface PerformanceMetric {
  day: string;
  score: number;
}

export function LearningModule() {
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stats, perf] = await Promise.all([
          api.getLearningStats(),
          api.getPerformanceMetrics(7)
        ]);
        setLearningStats(stats);

        // Transform performance data for the chart
        const chartData = (perf as any[]).slice(-7).map((p: any) => ({
          day: new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' }),
          score: Math.min(100, Math.max(0, 50 + (p.return || 0) * 10))
        }));
        setPerformanceData(chartData);
      } catch (error) {
        console.error('Failed to fetch learning data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Autonomous Learning" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  const winRate = learningStats?.winRate || 0;

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Autonomous Learning" badge="Active" />

      {/* Adaptation metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <Brain className="w-5 h-5 mx-auto mb-1 text-[var(--accent-blue)]" />
          <div className="text-xl font-bold font-mono">{learningStats?.patternsLearned || 0}</div>
          <div className="text-xs text-zinc-500">Patterns Learned</div>
        </div>
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <Zap className="w-5 h-5 mx-auto mb-1 text-[var(--warning)]" />
          <div className="text-xl font-bold font-mono">{learningStats?.avgResponseMs || 0}ms</div>
          <div className="text-xs text-zinc-500">Avg Response</div>
        </div>
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] text-center">
          <Award className="w-5 h-5 mx-auto mb-1 text-[var(--bullish)]" />
          <div className="text-xl font-bold font-mono">{winRate.toFixed(0)}%</div>
          <div className="text-xs text-zinc-500">Win Rate</div>
        </div>
      </div>

      {/* Performance chart */}
      <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)] mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Strategy Performance</div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceData.length > 0 ? performanceData : [{ day: 'Mon', score: 50 }]}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--panel)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '6px',
                  color: 'white',
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--accent-teal)"
                fill="url(#colorScore)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning milestones */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Recent Milestones</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--bullish)]/5 border border-[var(--bullish)]/20">
            <TrendingUp className="w-4 h-4 text-[var(--bullish)]" />
            <span className="text-xs">Win rate: {learningStats?.wins || 0} wins / {learningStats?.losses || 0} losses</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/20">
            <Brain className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-xs">Analyzed {learningStats?.total || 0} total trades</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-[var(--warning)]/5 border border-[var(--warning)]/20">
            <Award className="w-4 h-4 text-[var(--warning)]" />
            <span className="text-xs">{learningStats?.patternsLearned || 0} patterns learned</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}