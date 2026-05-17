'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Zap, Target, Shield, Activity } from 'lucide-react';
import { GlassPanel, ConfidenceRing } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAnalysisUpdates } from '@/lib/websocket';
import type { AIAnalysisResponse } from '@/types/api';

export function TradeIntelligence() {
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [confidenceTrend, setConfidenceTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const targetConfidenceRef = useRef(65);
  const prevConfidenceRef = useRef(0);

  // Subscribe to real-time analysis updates
  useAnalysisUpdates((data) => {
    setAnalysis(data as AIAnalysisResponse);
    if ((data as AIAnalysisResponse).confidence) {
      targetConfidenceRef.current = (data as AIAnalysisResponse).confidence;
    }
  });

  // Simulate confidence fluctuation based on "market conditions"
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveConfidence(prev => {
        const target = targetConfidenceRef.current;
        const drift = (target - prev) * 0.1;
        const noise = (Math.random() - 0.5) * 2;
        const newConf = Math.max(20, Math.min(95, prev + drift + noise));
        const rounded = Math.round(newConf);

        if (rounded > prevConfidenceRef.current + 0.5) {
          setConfidenceTrend('up');
        } else if (rounded < prevConfidenceRef.current - 0.5) {
          setConfidenceTrend('down');
        } else {
          setConfidenceTrend('stable');
        }
        prevConfidenceRef.current = rounded;

        return rounded;
      });

      // Occasionally shift target based on simulated market volatility
      if (Math.random() < 0.05) {
        targetConfidenceRef.current = 50 + Math.random() * 40;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await api.analyze(['AAPL', 'TSLA']);
      setAnalysis(result);
      targetConfidenceRef.current = result.confidence;
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationStyles = (rec: string) => {
    switch (rec) {
      case 'buy':
        return {
          bg: 'bg-[var(--bullish)]/10',
          border: 'border-[var(--bullish)]/30',
          text: 'text-[var(--bullish)]',
          icon: TrendingUp,
        };
      case 'sell':
        return {
          bg: 'bg-[var(--bearish)]/10',
          border: 'border-[var(--bearish)]/30',
          text: 'text-[var(--bearish)]',
          icon: TrendingDown,
        };
      default:
        return {
          bg: 'bg-zinc-500/10',
          border: 'border-zinc-500/30',
          text: 'text-zinc-400',
          icon: Minus,
        };
    }
  };

  const styles = analysis ? getRecommendationStyles(analysis.recommendation) : null;
  const RecIcon = styles?.icon || Brain;

  // Use live confidence if we have analysis, otherwise show live simulation
  const displayConfidence = analysis ? liveConfidence : 0;
  const displayRecommendation = analysis?.recommendation || 'hold';
  const displayRiskAssessment = analysis?.riskAssessment || 'medium';

  return (
    <GlassPanel className="h-full overflow-hidden" glow={displayRecommendation === 'buy' ? 'green' : displayRecommendation === 'sell' ? 'red' : 'none'}>
      <SectionHeader
        title="AI Trade Intelligence"
        badge={analysis ? `${liveConfidence}%` : undefined}
        action={
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-3 py-1 text-xs rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        }
      />

      {/* Live indicator */}
      {analysis && (
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${confidenceTrend === 'up' ? 'bg-[var(--bullish)]' : confidenceTrend === 'down' ? 'bg-[var(--bearish)]' : 'bg-[var(--accent-blue)]'} animate-pulse`} />
          <span className="text-xs text-zinc-500">
            {confidenceTrend === 'up' ? 'Confidence improving' : confidenceTrend === 'down' ? 'Confidence declining' : 'Stable'}
          </span>
          <Activity className="w-3 h-3 text-[var(--accent-teal)]" />
        </div>
      )}

      {!analysis && !loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <ConfidenceRing value={0} size={100} />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-zinc-600" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          </div>
          <span className="text-sm text-zinc-400">Run analysis to see AI recommendations</span>
          <div className="text-xs text-zinc-500">Confidence will fluctuate dynamically</div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <ConfidenceRing value={0} size={100} />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-[var(--accent-blue)] animate-pulse" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          </div>
          <span className="text-sm text-zinc-400 animate-pulse">AI is analyzing market conditions...</span>
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-4 animate-fade-in">
          {/* Main recommendation card */}
          <div className={`p-4 rounded-lg ${styles?.bg} border ${styles?.border}`}>
            <div className="flex items-center gap-3">
              <RecIcon className={`w-8 h-8 ${styles?.text}`} />
              <div>
                <div className={`text-2xl font-bold ${styles?.text}`}>
                  {displayRecommendation.toUpperCase()}
                </div>
                <div className="text-xs text-zinc-400">
                  {analysis.reasoning.substring(0, 60)}...
                </div>
              </div>
            </div>
          </div>

          {/* Confidence meter with live animation */}
          <div className="flex items-center gap-6">
            <LiveConfidenceRing value={liveConfidence} size={80} trend={confidenceTrend} />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Confidence</span>
                <LiveConfidenceValue value={liveConfidence} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Risk Assessment</span>
                <RiskBadge level={displayRiskAssessment} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Market Regime</span>
                <span className="font-medium text-[var(--accent-violet)]">
                  {analysis.marketRegime?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>

          {/* Suggested parameters */}
          {(analysis.stopLoss || analysis.takeProfit || analysis.suggestedQuantity) && (
            <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Trade Parameters</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {analysis.suggestedQuantity && (
                  <div>
                    <div className="text-xs text-zinc-500">Quantity</div>
                    <div className="font-mono text-lg font-medium">{analysis.suggestedQuantity}</div>
                  </div>
                )}
                {analysis.stopLoss && (
                  <div>
                    <div className="text-xs text-zinc-500">Stop Loss</div>
                    <div className="font-mono text-lg font-medium text-[var(--bearish)]">${analysis.stopLoss.toFixed(2)}</div>
                  </div>
                )}
                {analysis.takeProfit && (
                  <div>
                    <div className="text-xs text-zinc-500">Take Profit</div>
                    <div className="font-mono text-lg font-medium text-[var(--bullish)]">${analysis.takeProfit.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI reasoning */}
          <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Target className="w-3 h-3" />
              AI Reasoning
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{analysis.reasoning}</p>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

// Live confidence ring with animation
function LiveConfidenceRing({ value, size, trend }: { value: number; size: number; trend: 'up' | 'down' | 'stable' }) {
  const [animatedValue, setAnimatedValue] = useState(value);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedValue(prev => {
        const drift = (value - prev) * 0.15;
        const noise = (Math.random() - 0.5) * 1;
        return Math.max(0, Math.min(100, prev + drift + noise));
      });
    }, 300);

    return () => clearInterval(interval);
  }, [value]);

  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;
  const color = animatedValue > 60 ? 'var(--bullish)' : animatedValue < 40 ? 'var(--bearish)' : 'var(--warning)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={35}
          stroke="var(--background-secondary)"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={35}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold font-mono" style={{ color }}>
          {Math.round(animatedValue)}
        </span>
      </div>
      {trend !== 'stable' && (
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${trend === 'up' ? 'bg-[var(--bullish)]' : 'bg-[var(--bearish)]'}`}>
          {trend === 'up' ? <TrendingUp className="w-2 h-2 text-white" /> : <TrendingDown className="w-2 h-2 text-white" />}
        </div>
      )}
    </div>
  );
}

// Live confidence value display
function LiveConfidenceValue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue(prev => {
        const drift = (value - prev) * 0.2;
        const noise = (Math.random() - 0.5);
        const newVal = Math.max(0, Math.min(100, prev + drift + noise));
        if (Math.abs(newVal - prev) > 0.5) {
          setFlashColor(newVal > prev ? 'var(--bullish)]' : 'var(--bearish)]');
          setTimeout(() => setFlashColor(null), 200);
        }
        return newVal;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <span className={`font-mono font-medium ${flashColor || 'text-white'}`}>
      {Math.round(displayValue)}%
    </span>
  );
}

// Live risk badge
function RiskBadge({ level }: { level: string }) {
  const colors = {
    low: 'text-[var(--bullish)]',
    medium: 'text-[var(--warning)]',
    high: 'text-[var(--bearish)]',
  };

  return (
    <span className={`font-medium ${colors[level as keyof typeof colors] || 'text-zinc-400'}`}>
      {level.toUpperCase()}
    </span>
  );
}