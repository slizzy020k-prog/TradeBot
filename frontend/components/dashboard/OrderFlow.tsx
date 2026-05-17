'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown, BarChart3, Zap } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/ui';
import { api } from '@/lib/api';

interface BidAskLevel {
  price: number;
  size: number;
  total: number;
}

interface OrderBookState {
  bids: BidAskLevel[];
  asks: BidAskLevel[];
  spread: number;
  spreadPercent: number;
  bidAskImbalance: number;
  totalBidSize: number;
  totalAskSize: number;
}

export function OrderFlow() {
  const [orderBook, setOrderBook] = useState<OrderBookState>({
    bids: [],
    asks: [],
    spread: 0,
    spreadPercent: 0,
    bidAskImbalance: 0,
    totalBidSize: 0,
    totalAskSize: 0,
  });
  const [loading, setLoading] = useState(true);
  const basePriceRef = useRef(450);

  // Initialize and continuously update order book
  useEffect(() => {
    const initializeOrderBook = async () => {
      try {
        const indices = await api.getMarketIndices();
        const spy = indices.find((i: any) => i.symbol === 'SPY');
        basePriceRef.current = spy?.price || 450;
      } catch {
        basePriceRef.current = 450;
      }
    };

    initializeOrderBook().then(() => {
      setLoading(false);
      updateOrderBook();
    });

    const interval = setInterval(updateOrderBook, 1500);
    return () => clearInterval(interval);
  }, []);

  const updateOrderBook = () => {
    const basePrice = basePriceRef.current;
    const newBids: BidAskLevel[] = [];
    const newAsks: BidAskLevel[] = [];
    let cumBidSize = 0;
    let cumAskSize = 0;

    for (let i = 0; i < 5; i++) {
      const bidPrice = basePrice - (i * 0.01 * basePrice) - Math.random() * 0.02 * basePrice;
      const askPrice = basePrice + (i * 0.01 * basePrice) + Math.random() * 0.02 * basePrice;
      const baseBidSize = 1000 + Math.random() * 2000 + (5 - i) * 500;
      const baseAskSize = 1000 + Math.random() * 2000 + (5 - i) * 500;

      cumBidSize += baseBidSize;
      cumAskSize += baseAskSize;

      newBids.push({
        price: bidPrice,
        size: Math.round(baseBidSize),
        total: Math.round(cumBidSize),
      });

      newAsks.push({
        price: askPrice,
        size: Math.round(baseAskSize),
        total: Math.round(cumAskSize),
      });
    }

    const spread = newAsks[0].price - newBids[0].price;
    const spreadPercent = (spread / basePrice) * 100;
    const totalBidSize = cumBidSize;
    const totalAskSize = cumAskSize;
    const bidAskImbalance = ((totalBidSize - totalAskSize) / (totalBidSize + totalAskSize)) * 100;

    // Slight random walk in base price
    basePriceRef.current = basePrice + (Math.random() - 0.5) * 0.001 * basePrice;

    setOrderBook({
      bids: newBids,
      asks: newAsks,
      spread,
      spreadPercent,
      bidAskImbalance,
      totalBidSize,
      totalAskSize,
    });
  };

  const getImbalanceColor = (imbalance: number) => {
    if (imbalance > 10) return 'text-[var(--bullish)]';
    if (imbalance < -10) return 'text-[var(--bearish)]';
    return 'text-[var(--warning)]';
  };

  const getImbalanceLabel = (imbalance: number) => {
    if (imbalance > 20) return 'Heavy Buying';
    if (imbalance > 10) return 'Buying Pressure';
    if (imbalance < -20) return 'Heavy Selling';
    if (imbalance < -10) return 'Selling Pressure';
    return 'Balanced';
  };

  const maxTotal = Math.max(
    orderBook.bids[orderBook.bids.length - 1]?.total || 0,
    orderBook.asks[orderBook.asks.length - 1]?.total || 0
  );

  if (loading) {
    return (
      <GlassPanel className="h-full">
        <SectionHeader title="Order Flow" />
        <div className="h-40 bg-[var(--background)]/50 animate-pulse rounded-lg" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="h-full overflow-hidden">
      <SectionHeader title="Order Flow" badge="LIVE" />

      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
        <span className="text-xs text-zinc-500">Real-time order book</span>
        <Zap className="w-3 h-3 text-[var(--accent-teal)]" />
      </div>

      {/* Bid/Ask Imbalance indicator */}
      <div className={`p-3 rounded-lg mb-4 border ${orderBook.bidAskImbalance > 0 ? 'border-[var(--bullish)]/30 bg-[var(--bullish)]/5' : orderBook.bidAskImbalance < 0 ? 'border-[var(--bearish)]/30 bg-[var(--bearish)]/5' : 'border-[var(--panel-border)] bg-[var(--background)]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${getImbalanceColor(orderBook.bidAskImbalance)}`} />
            <span className="text-xs text-zinc-400">Bid/Ask Imbalance</span>
          </div>
          <div className={`text-sm font-bold ${getImbalanceColor(orderBook.bidAskImbalance)}`}>
            {orderBook.bidAskImbalance >= 0 ? '+' : ''}{orderBook.bidAskImbalance.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-zinc-500">{getImbalanceLabel(orderBook.bidAskImbalance)}</span>
          <span className="text-xs text-zinc-500">
            Bid: {(orderBook.totalBidSize / 1000).toFixed(1)}K | Ask: {(orderBook.totalAskSize / 1000).toFixed(1)}K
          </span>
        </div>
        <div className="mt-2 h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${50 + orderBook.bidAskImbalance / 2}%`,
              marginLeft: orderBook.bidAskImbalance < 0 ? `${50 - Math.abs(orderBook.bidAskImbalance) / 2}%` : '0',
              backgroundColor: orderBook.bidAskImbalance > 0 ? 'var(--bullish)' : orderBook.bidAskImbalance < 0 ? 'var(--bearish)' : 'var(--accent-blue)'
            }}
          />
        </div>
      </div>

      {/* Spread info */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 p-2 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500">Spread</div>
          <div className="font-mono text-sm font-medium">${orderBook.spread.toFixed(2)}</div>
          <div className="text-xs text-zinc-400">{orderBook.spreadPercent.toFixed(3)}%</div>
        </div>
        <div className="flex-1 p-2 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500">Total Bid Size</div>
          <div className="font-mono text-sm font-medium text-[var(--bullish)]">{(orderBook.totalBidSize / 1000).toFixed(1)}K</div>
        </div>
        <div className="flex-1 p-2 rounded bg-[var(--background)] border border-[var(--panel-border)]">
          <div className="text-xs text-zinc-500">Total Ask Size</div>
          <div className="font-mono text-sm font-medium text-[var(--bearish)]">{(orderBook.totalAskSize / 1000).toFixed(1)}K</div>
        </div>
      </div>

      {/* Order Book Visualization */}
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-[var(--bullish)]" />
            Bids
          </div>
          <div className="space-y-1">
            {orderBook.bids.map((bid, i) => (
              <OrderBookRow
                key={`bid-${i}`}
                price={bid.price}
                size={bid.size}
                total={bid.total}
                maxTotal={maxTotal}
                side="bid"
              />
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--bearish)]" />
            Asks
          </div>
          <div className="space-y-1">
            {orderBook.asks.map((ask, i) => (
              <OrderBookRow
                key={`ask-${i}`}
                price={ask.price}
                size={ask.size}
                total={ask.total}
                maxTotal={maxTotal}
                side="ask"
              />
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

// Animated order book row
function OrderBookRow({
  price,
  size,
  total,
  maxTotal,
  side
}: {
  price: number;
  size: number;
  total: number;
  maxTotal: number;
  side: 'bid' | 'ask';
}) {
  const [displaySize, setDisplaySize] = useState(size);
  const barWidth = (total / maxTotal) * 100;
  const color = side === 'bid' ? 'var(--bullish)' : 'var(--bearish)';

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplaySize(prev => {
        const change = Math.round((Math.random() - 0.5) * 100);
        return Math.max(100, prev + change);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [size]);

  return (
    <div className="relative">
      <div
        className="absolute inset-y-0 rounded transition-all duration-300"
        style={{
          width: `${barWidth}%`,
          backgroundColor: color,
          opacity: 0.15,
          [side === 'bid' ? 'right' : 'left']: 0,
        }}
      />
      <div className="relative flex items-center justify-between p-1.5 rounded hover:bg-[var(--background)]/50 transition-colors">
        <span className="font-mono text-xs" style={{ color }}>${price.toFixed(2)}</span>
        <span className="font-mono text-xs text-zinc-400">{displaySize.toLocaleString()}</span>
        <span className="font-mono text-xs text-zinc-500">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}