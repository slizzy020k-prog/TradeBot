'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { MarketData } from '@/types/api';

export interface SimulatedPrice {
  symbol: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
}

interface UseMarketSimulationOptions {
  updateIntervalMs?: number;
  volatilityBase?: number;
  enableSimulation?: boolean;
}

// Symbol-specific volatility profiles (higher = more fluctuation)
const VOLATILITY_PROFILES: Record<string, number> = {
  'BTC-USD': 0.003,    // 0.3% base volatility per tick
  'ETH-USD': 0.004,
  'SPY': 0.0005,
  'QQQ': 0.0006,
  'AAPL': 0.0008,
  'MSFT': 0.0007,
  'NVDA': 0.0015,
  'TSLA': 0.0025,
  'GC=F': 0.001,
  'CL=F': 0.0012,
  'DEFAULT': 0.0008,
};

// Sector correlation groups (stocks that move together)
const SECTOR_CORRELATION: Record<string, string[]> = {
  'TECH': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN'],
  'FINANCE': ['JPM', 'V', 'MA', 'BAC', 'GS'],
  'ENERGY': ['XOM', 'CVX', 'COP', 'SLB'],
  'CRYPTO': ['BTC-USD', 'ETH-USD'],
  'INDICES': ['SPY', 'QQQ', 'DIA', 'IWM'],
};

export function useMarketSimulation(options: UseMarketSimulationOptions = {}) {
  const {
    updateIntervalMs = 1000,
    volatilityBase = 1.0,
    enableSimulation = true
  } = options;

  const [prices, setPrices] = useState<Map<string, SimulatedPrice>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const basePricesRef = useRef<Map<string, number>>(new Map());
  const correlationNoiseRef = useRef<Map<string, number>>(new Map());

  // Get volatility for a symbol
  const getVolatility = useCallback((symbol: string): number => {
    return VOLATILITY_PROFILES[symbol] || VOLATILITY_PROFILES['DEFAULT'];
  }, []);

  // Get sector correlation factor
  const getCorrelationFactor = useCallback((symbol: string): number => {
    for (const [, symbols] of Object.entries(SECTOR_CORRELATION)) {
      if (symbols.includes(symbol)) {
        const sectorNoise = correlationNoiseRef.current.get(symbol) || 0;
        return 1 + sectorNoise;
      }
    }
    return 1;
  }, []);

  // Generate random walk with mean reversion
  const generatePriceChange = useCallback((
    currentPrice: number,
    volatility: number,
    correlationFactor: number
  ): number => {
    // Random component (Gaussian distribution approximated)
    const random1 = (Math.random() - 0.5) * 2;
    const random2 = (Math.random() - 0.5) * 2;
    const gaussian = (random1 + random2) / 2;

    // Apply volatility and correlation
    const change = gaussian * volatility * correlationFactor * volatilityBase;

    // Mean reversion factor (prices tend to stay near base)
    const basePrice = basePricesRef.current.get(Object.keys(volatilityBase).length > 0 ? '' : '') || currentPrice;
    const meanReversion = basePrice > 0 ? (basePrice - currentPrice) / basePrice * 0.01 : 0;

    return currentPrice * (1 + change + meanReversion);
  }, [volatilityBase]);

  // Initialize prices from API
  const initializePrices = useCallback(async () => {
    try {
      const indices = await api.getMarketIndices();
      const newPrices = new Map<string, SimulatedPrice>();

      indices.forEach((data: MarketData) => {
        basePricesRef.current.set(data.symbol, data.price);
        newPrices.set(data.symbol, {
          symbol: data.symbol,
          price: data.price,
          previousPrice: data.price,
          change: 0,
          changePercent: 0,
          high: data.high || data.price * 1.02,
          low: data.low || data.price * 0.98,
          volume: data.volume || 0,
          bid: data.price * 0.9995,
          ask: data.price * 1.0005,
          timestamp: Date.now(),
        });

        // Initialize correlation noise for sector
        const symbols = Object.values(SECTOR_CORRELATION).flat();
        if (symbols.includes(data.symbol)) {
          correlationNoiseRef.current.set(data.symbol, (Math.random() - 0.5) * 0.3);
        }
      });

      setPrices(newPrices);
      return newPrices;
    } catch (error) {
      console.error('Failed to initialize prices:', error);
      return new Map<string, SimulatedPrice>();
    }
  }, []);

  // Main update loop
  useEffect(() => {
    if (!enableSimulation) return;

    let intervalId: NodeJS.Timeout;

    const updatePrices = () => {
      setPrices(currentPrices => {
        const updatedPrices = new Map(currentPrices);
        let hasChanges = false;

        updatedPrices.forEach((simPrice, symbol) => {
          const volatility = getVolatility(symbol);
          const correlationFactor = getCorrelationFactor(symbol);

          // Generate new price
          const newPrice = generatePriceChange(simPrice.price, volatility, correlationFactor);
          const previousPrice = simPrice.price;
          const change = newPrice - previousPrice;
          const changePercent = (change / previousPrice) * 100;

          // Update high/low
          const high = Math.max(simPrice.high, newPrice);
          const low = Math.min(simPrice.low, newPrice);

          // Update volume randomly
          const volumeChange = Math.floor(Math.random() * 10000) + 1000;

          // Calculate bid/ask spread (typically 0.01% for liquid assets)
          const spread = newPrice * 0.0001;
          const bid = newPrice - spread;
          const ask = newPrice + spread;

          updatedPrices.set(symbol, {
            symbol,
            price: newPrice,
            previousPrice,
            change,
            changePercent,
            high,
            low,
            volume: simPrice.volume + volumeChange,
            bid,
            ask,
            timestamp: Date.now(),
          });

          hasChanges = true;
        });

        // Occasionally update sector correlation noise
        if (Math.random() < 0.1) {
          correlationNoiseRef.current.forEach((value, sym) => {
            correlationNoiseRef.current.set(sym, value * 0.95 + (Math.random() - 0.5) * 0.1);
          });
        }

        return hasChanges ? updatedPrices : currentPrices;
      });
    };

    // Initialize and start
    initializePrices().then(() => {
      setIsRunning(true);
      intervalId = setInterval(updatePrices, updateIntervalMs);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      setIsRunning(false);
    };
  }, [enableSimulation, updateIntervalMs, initializePrices, generatePriceChange, getVolatility, getCorrelationFactor]);

  // Get price for a specific symbol
  const getPrice = useCallback((symbol: string): SimulatedPrice | undefined => {
    return prices.get(symbol);
  }, [prices]);

  // Get all prices as array
  const getAllPrices = useCallback((): SimulatedPrice[] => {
    return Array.from(prices.values());
  }, [prices]);

  // Force refresh from API
  const refreshPrices = useCallback(async () => {
    await initializePrices();
  }, [initializePrices]);

  return {
    prices,
    getPrice,
    getAllPrices,
    isRunning,
    refreshPrices,
  };
}

// Hook for individual price with animation state
export function useAnimatedPrice(symbol: string, updateIntervalMs = 1000) {
  const { getPrice, isRunning } = useMarketSimulation({
    updateIntervalMs,
    enableSimulation: true
  });

  const priceData = getPrice(symbol);
  const [displayPrice, setDisplayPrice] = useState(priceData?.price || 0);
  const [flashColor, setFlashColor] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef(priceData?.price || 0);

  useEffect(() => {
    if (priceData && priceData.price !== prevPriceRef.current) {
      const direction = priceData.price > prevPriceRef.current ? 'up' : 'down';
      setFlashColor(direction);
      setDisplayPrice(priceData.price);
      prevPriceRef.current = priceData.price;

      setTimeout(() => setFlashColor(null), 300);
    }
  }, [priceData?.price, priceData?.change]);

  return {
    price: displayPrice,
    change: priceData?.change || 0,
    changePercent: priceData?.changePercent || 0,
    flashColor,
    isLive: isRunning,
  };
}

// Hook for portfolio value simulation
export function useSimulatedPortfolio(initialValue = 100000, updateIntervalMs = 2000) {
  const [portfolioValue, setPortfolioValue] = useState(initialValue);
  const [dailyPnL, setDailyPnL] = useState(0);
  const baseValueRef = useRef(initialValue);
  const positionsRef = useRef<Map<string, { qty: number; avgPrice: number }>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      // Small random fluctuation to portfolio value (±0.1%)
      const change = (Math.random() - 0.48) * 0.002 * portfolioValue;
      const newValue = portfolioValue + change;
      baseValueRef.current = newValue;

      setPortfolioValue(newValue);

      // Update daily P&L based on change
      setDailyPnL(prev => prev + change);
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [portfolioValue, updateIntervalMs]);

  // Update with real positions
  const updatePositions = useCallback((positions: Map<string, { qty: number; avgPrice: number }>) => {
    positionsRef.current = positions;
  }, []);

  return {
    totalValue: portfolioValue,
    dailyPnL,
    cash: portfolioValue * 0.3, // Simulated cash allocation
    exposure: 0.7,
  };
}

// Hook for AI confidence simulation
export function useSimulatedConfidence(baseConfidence = 65, updateIntervalMs = 3000) {
  const [confidence, setConfidence] = useState(baseConfidence);
  const [trend, setTrend] = useState<'improving' | 'declining' | 'stable'>('stable');
  const targetRef = useRef(baseConfidence);
  const trendRef = useRef<'improving' | 'declining' | 'stable'>('stable');

  useEffect(() => {
    const interval = setInterval(() => {
      // Small random walk toward target
      const drift = (targetRef.current - confidence) * 0.1;
      const noise = (Math.random() - 0.5) * 3;
      const newConfidence = Math.max(20, Math.min(95, confidence + drift + noise));

      // Determine trend
      if (newConfidence > confidence + 0.5) {
        trendRef.current = 'improving';
      } else if (newConfidence < confidence - 0.5) {
        trendRef.current = 'declining';
      } else {
        trendRef.current = 'stable';
      }

      setConfidence(Math.round(newConfidence));
      setTrend(trendRef.current);

      // Occasionally shift target based on "market conditions"
      if (Math.random() < 0.05) {
        targetRef.current = 50 + Math.random() * 40;
      }
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [confidence, updateIntervalMs]);

  return {
    confidence,
    trend,
    recommendation: confidence > 60 ? 'buy' : confidence < 40 ? 'sell' : 'hold',
  };
}