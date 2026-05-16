'use client';

import { useState } from 'react';
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
import { SectionHeader } from '@/components/ui';
import { Activity } from 'lucide-react';

export default function Dashboard() {
  const [watchedSymbols] = useState<string[]>(['AAPL', 'TSLA', 'BTC-USD']);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Top Navigation */}
      <TopNavBar watchedSymbols={watchedSymbols} />

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto">
        {/* Top Row: Market Overview + Trade Intelligence + Portfolio */}
        <div className="grid grid-cols-12 gap-4 mb-4">
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
        <div className="grid grid-cols-12 gap-4 mb-4">
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

        {/* Bottom Row: Agent Monitor + CEO Panel + Trade Journal + Learning Module */}
        <div className="grid grid-cols-12 gap-4">
          {/* Agent Monitor - spans 3 columns */}
          <div className="col-span-3">
            <AgentMonitor />
          </div>

          {/* CEO Panel - spans 3 columns */}
          <div className="col-span-3">
            <CEOPanel />
          </div>

          {/* Trade Journal - spans 3 columns */}
          <div className="col-span-3">
            <TradeJournal />
          </div>

          {/* Learning Module - spans 3 columns */}
          <div className="col-span-3">
            <LearningModule />
          </div>
        </div>
      </div>

      {/* Bottom Console - Execution logs */}
      <div className="h-32 border-t border-[var(--panel-border)] bg-[var(--background-secondary)] p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Execution Console" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[var(--bullish)]" />
              Connected
            </span>
            <span>v1.0.0</span>
          </div>
        </div>
        <div className="h-16 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1">
          <div>[{new Date().toLocaleTimeString()}] System initialized</div>
          <div>[{new Date().toLocaleTimeString()}] API Server: Connected to localhost:3001</div>
          <div>[{new Date().toLocaleTimeString()}] WebSocket: Real-time updates active</div>
          <div>[{new Date().toLocaleTimeString()}] Watching: {watchedSymbols.join(', ')}</div>
        </div>
      </div>
    </div>
  );
}