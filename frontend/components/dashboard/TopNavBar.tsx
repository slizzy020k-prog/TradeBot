'use client';

import { useState, useEffect } from 'react';
import { Activity, Bell, Settings, Play, Square } from 'lucide-react';
import { GlassPanel, StatusIndicator } from '@/components/ui';
import { Ticker } from '@/components/ui';
import { api } from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';
import type { BotStatus } from '@/types/api';

interface TopNavBarProps {
  watchedSymbols: string[];
  onSymbolAdd?: (symbol: string) => void;
}

export function TopNavBar({ watchedSymbols, onSymbolAdd }: TopNavBarProps) {
  const [botStatus, setBotStatus] = useState<BotStatus>({ running: false, symbols: [] });
  const [tickerData, setTickerData] = useState<Array<{ symbol: string; price: number; change: number }>>([]);
  const { connected } = useWebSocket();

  useEffect(() => {
    // Fetch initial bot status
    api.getBotStatus().then(setBotStatus).catch(console.error);

    // Fetch initial ticker data
    if (watchedSymbols.length > 0) {
      api.fetchQuotes(watchedSymbols).then((data) => {
        setTickerData(
          data.map((d) => ({
            symbol: d.symbol,
            price: d.price,
            change: 0, // Would need historical data to calculate change
          }))
        );
      }).catch(console.error);
    }
  }, [watchedSymbols]);

  const handleToggleBot = async () => {
    try {
      if (botStatus.running) {
        await api.stopBot();
        setBotStatus({ running: false, symbols: [] });
      } else if (watchedSymbols.length > 0) {
        await api.startBot(watchedSymbols);
        setBotStatus({ running: true, symbols: watchedSymbols });
      }
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
  };

  return (
    <nav className="h-14 bg-[var(--background-secondary)] border-b border-[var(--panel-border)] px-4 flex items-center justify-between">
      {/* Left: Logo and connection status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-teal)] flex items-center justify-center">
            <Activity className="w-4 h-4 text-black" />
          </div>
          <span className="font-semibold text-sm tracking-wide">TRADEBOT PRO</span>
        </div>

        <StatusIndicator status={connected ? 'active' : 'idle'} label={connected ? 'Connected' : 'Disconnected'} />
      </div>

      {/* Center: Ticker */}
      <div className="flex-1 max-w-2xl mx-4">
        {tickerData.length > 0 && <Ticker items={tickerData} />}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Watched symbols */}
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <span>Watching:</span>
          <span className="text-[var(--accent-teal)]">{watchedSymbols.join(', ') || 'None'}</span>
        </div>

        {/* Bot control */}
        <button
          onClick={handleToggleBot}
          disabled={watchedSymbols.length === 0}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
            ${botStatus.running
              ? 'bg-[var(--bearish)]/20 text-[var(--bearish)] hover:bg-[var(--bearish)]/30'
              : 'bg-[var(--bullish)]/20 text-[var(--bullish)] hover:bg-[var(--bullish)]/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {botStatus.running ? (
            <>
              <Square className="w-3 h-3" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Start
            </>
          )}
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-md hover:bg-[var(--panel)] transition-colors relative">
          <Bell className="w-4 h-4 text-zinc-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--bearish)] rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 rounded-md hover:bg-[var(--panel)] transition-colors">
          <Settings className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
    </nav>
  );
}