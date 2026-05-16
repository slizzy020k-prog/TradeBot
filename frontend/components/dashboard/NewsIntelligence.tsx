'use client';

import { useState, useEffect } from 'react';
import { Newspaper, AlertTriangle, TrendingUp, TrendingDown, Clock, ChevronRight } from 'lucide-react';
import { GlassPanel, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { NewsIntelligenceResult } from '@/types/api';

interface NewsItem {
  headline: string;
  source: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  time: string;
  impact: 'high' | 'medium' | 'low';
}

export function NewsIntelligence() {
  const [news, setNews] = useState<NewsIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchedSymbol, setWatchedSymbol] = useState('AAPL');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await api.getNews(watchedSymbol);
        setNews(data);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [watchedSymbol]);

  const getSentimentStyles = (sentiment: 'bullish' | 'bearish' | 'neutral') => {
    switch (sentiment) {
      case 'bullish':
        return {
          bg: 'bg-[var(--bullish)]/10',
          border: 'border-[var(--bullish)]/30',
          text: 'text-[var(--bullish)]',
          icon: TrendingUp,
        };
      case 'bearish':
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
          icon: Newspaper,
        };
    }
  };

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="News Intelligence" />
        <LoadingSkeleton className="h-40" />
      </GlassPanel>
    );
  }

  const sentimentStyles = news ? getSentimentStyles(news.aggregatedSentiment.overall) : null;
  const SentimentIcon = sentimentStyles?.icon || Newspaper;

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader
        title="News Intelligence"
        badge={news?.aggregatedSentiment.articleCount?.toString() || '0'}
      />

      {/* Sentiment overview */}
      {news && (
        <div className={`p-3 rounded-lg ${sentimentStyles?.bg} border ${sentimentStyles?.border} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SentimentIcon className={`w-5 h-5 ${sentimentStyles?.text}`} />
              <span className={`font-semibold ${sentimentStyles?.text}`}>
                {news.aggregatedSentiment.overall.toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">Manipulation Risk</div>
              <div className={`text-sm font-medium ${
                news.aggregatedSentiment.manipulationRisk > 50
                  ? 'text-[var(--bearish)]'
                  : 'text-[var(--bullish)]'
              }`}>
                {news.aggregatedSentiment.manipulationRisk.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Sentiment bar */}
          <div className="mt-3 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${news.aggregatedSentiment.confidence}%`,
                backgroundColor: news.aggregatedSentiment.overall === 'bullish'
                  ? 'var(--bullish)'
                  : news.aggregatedSentiment.overall === 'bearish'
                  ? 'var(--bearish)'
                  : 'var(--text-muted)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>Bearish</span>
            <span>Confidence: {news.aggregatedSentiment.confidence.toFixed(0)}%</span>
            <span>Bullish</span>
          </div>
        </div>
      )}

      {/* Risk factors */}
      {news && news.riskFactors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--bearish)]/10 border border-[var(--bearish)]/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--bearish)]" />
            <span className="text-xs font-semibold text-[var(--bearish)]">Risk Factors</span>
          </div>
          {news.riskFactors.slice(0, 2).map((risk, i) => (
            <div key={i} className="text-xs text-zinc-300 mb-1">
              {risk}
            </div>
          ))}
        </div>
      )}

      {/* Bullish factors */}
      {news && news.bullishFactors.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-[var(--bullish)]" />
            Bullish Factors
          </div>
          {news.bullishFactors.slice(0, 2).map((factor, i) => (
            <div key={i} className="text-xs text-zinc-300 mb-1 p-2 rounded bg-[var(--bullish)]/5 border border-[var(--bullish)]/20">
              {factor}
            </div>
          ))}
        </div>
      )}

      {/* Bearish factors */}
      {news && news.bearishFactors.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingDown className="w-3 h-3 text-[var(--bearish)]" />
            Bearish Factors
          </div>
          {news.bearishFactors.slice(0, 2).map((factor, i) => (
            <div key={i} className="text-xs text-zinc-300 mb-1 p-2 rounded bg-[var(--bearish)]/5 border border-[var(--bearish)]/20">
              {factor}
            </div>
          ))}
        </div>
      )}

      {/* AI Recommendation */}
      {news && (
        <div className="p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">AI Recommendation</div>
          <div className="text-sm font-medium text-[var(--accent-teal)]">
            {news.recommendation.replace(/_/g, ' ')}
          </div>
        </div>
      )}

      {/* Empty state */}
      {news && !news.hasNews && (
        <EmptyState
          message={`No recent news for ${watchedSymbol}`}
          icon={<Newspaper className="w-8 h-8 text-zinc-600" />}
        />
      )}
    </GlassPanel>
  );
}