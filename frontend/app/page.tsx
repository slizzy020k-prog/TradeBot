'use client';

import { useState, useEffect } from 'react';
import { TopNavBar } from '@/components/dashboard/TopNavBar';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { TradeIntelligence } from '@/components/dashboard/TradeIntelligence';
import { PortfolioPanel } from '@/components/dashboard/PortfolioPanel';
import { NewsIntelligence } from '@/components/dashboard/NewsIntelligence';
import { RiskCommandCenter } from '@/components/dashboard/RiskCommandCenter';
import { AgentMonitor } from '@/components/dashboard/AgentMonitor';
import { TradeJournal } from '@/components/dashboard/TradeJournal';
import { CEOPanel } from '@/components/dashboard/CEOPanel';
import { OrderFlow } from '@/components/dashboard/OrderFlow';
import { LearningModule } from '@/components/dashboard/LearningModule';
import { PerformanceMetrics } from '@/components/dashboard/PerformanceMetrics';
import { SectionHeader } from '@/components/ui';
import { Activity, Zap, TrendingUp, Shield } from 'lucide-react';

export default function Dashboard() {
  const [watchedSymbols] = useState<string[]>(['AAPL', 'TSLA', 'BTC-USD', 'NVDA', 'MSFT']);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col relative overflow-hidden">
      {/* Grid pattern background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />

      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--accent-teal)]/5 rounded-full blur-[100px] pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--accent-blue)]/5 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 right-0 w-64 h-64 bg-[var(--accent-violet)]/5 rounded-full blur-[80px] pointer-events-none animate-float" style={{ animationDelay: '4s' }} />

      {/* Top Navigation */}
      <TopNavBar watchedSymbols={watchedSymbols} />

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto relative z-10">
        {/* Top Row: Market Overview + Trade Intelligence + Portfolio */}
        <div className={`grid grid-cols-12 gap-4 mb-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
          {/* Market Overview - spans 4 columns */}
          <div className="col-span-4">
            <MarketOverview />
          </div>

          {/* Trade Intelligence - spans 4 columns */}
          <div className="col-span-4">
            <TradeIntelligence />
          </div>

          {/* Portfolio - spans 4 columns */}
          <div className="col-span-4">
            <PortfolioPanel />
          </div>
        </div>

        {/* Middle Row: News Intelligence + Order Flow + Risk Command Center */}
        <div className={`grid grid-cols-12 gap-4 mb-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
          {/* News Intelligence - spans 4 columns */}
          <div className="col-span-4">
            <NewsIntelligence />
          </div>

          {/* Order Flow - spans 4 columns */}
          <div className="col-span-4">
            <OrderFlow />
          </div>

          {/* Risk Command Center - spans 4 columns */}
          <div className="col-span-4">
            <RiskCommandCenter />
          </div>
        </div>

        {/* Bottom Row: Agent Monitor + CEO Panel + Learning Module + Performance */}
        <div className={`grid grid-cols-12 gap-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
          {/* Agent Monitor - spans 3 columns */}
          <div className="col-span-3">
            <AgentMonitor />
          </div>

          {/* CEO Panel - spans 3 columns */}
          <div className="col-span-3">
            <CEOPanel />
          </div>

          {/* Learning Module - spans 3 columns */}
          <div className="col-span-3">
            <LearningModule />
          </div>

          {/* Performance Metrics - spans 3 columns */}
          <div className="col-span-3">
            <PerformanceMetrics />
          </div>
        </div>
      </div>

      {/* Bottom Console - Execution logs */}
      <div className="relative z-10 h-32 border-t border-[var(--panel-border)]/50 bg-[var(--background-secondary)]/80 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
              <SectionHeader title="Execution Console" />
            </div>
            <div className="flex items-center gap-4 ml-4">
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Zap className="w-3 h-3 text-[var(--accent-teal)]" />
                <span>AI Active</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <TrendingUp className="w-3 h-3 text-[var(--bullish)]" />
                <span>3 Agents</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Shield className="w-3 h-3 text-[var(--accent-blue)]" />
                <span>Risk Managed</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[var(--bullish)]" />
              Connected
            </span>
            <span className="px-2 py-0.5 rounded bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20">
              v2.0
            </span>
          </div>
        </div>
        <div className="h-16 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent-teal)]">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-zinc-500">System initialized with enhanced UI</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent-blue)]">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-zinc-500">Particle effects & animations active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--bullish)]">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-zinc-500">API Server: Connected to localhost:3001</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent-purple)]">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-zinc-500">WebSocket: Real-time updates active</span>
          </div>
        </div>
      </div>
    </div>
  );
}