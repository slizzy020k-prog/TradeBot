'use client';

import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Zap, Target, Shield } from 'lucide-react';
import { GlassPanel, ConfidenceRing, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAnalysisUpdates } from '@/lib/websocket';
import type { AIAnalysisResponse } from '@/types/api';

export function TradeIntelligence() {
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Subscribe to real-time analysis updates
  useAnalysisUpdates((data) => {
    setAnalysis(data as AIAnalysisResponse);
  });

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await api.analyze(['AAPL', 'TSLA']);
      setAnalysis(result);
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

  return (
    <GlassPanel className="h-full overflow-hidden" glow={analysis?.recommendation === 'buy' ? 'green' : analysis?.recommendation === 'sell' ? 'red' : 'none'}>
      <SectionHeader
        title="AI Trade Intelligence"
        badge={analysis ? `${analysis.confidence}%` : undefined}
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

      {!analysis && !loading && (
        <EmptyState
          message="Run analysis to see AI recommendations"
          icon={<Brain className="w-8 h-8 text-zinc-600" />}
        />
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
                  {analysis.recommendation.toUpperCase()}
                </div>
                <div className="text-xs text-zinc-400">
                  {analysis.reasoning.substring(0, 60)}...
                </div>
              </div>
            </div>
          </div>

          {/* Confidence meter */}
          <div className="flex items-center gap-6">
            <ConfidenceRing value={analysis.confidence} size={80} />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Confidence</span>
                <span className="font-mono font-medium">{analysis.confidence}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Risk Assessment</span>
                <span className={`font-medium ${
                  analysis.riskAssessment === 'low' ? 'text-[var(--bullish)]' :
                  analysis.riskAssessment === 'high' ? 'text-[var(--bearish)]' :
                  'text-[var(--warning)]'
                }`}>
                  {analysis.riskAssessment?.toUpperCase() || 'N/A'}
                </span>
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