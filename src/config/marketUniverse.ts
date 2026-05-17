import { UniverseSymbol, AssetClass } from '../types';

export const DEFAULT_UNIVERSE: Record<AssetClass, UniverseSymbol[]> = {
  equities: [
    { symbol: 'SPY', assetClass: 'equities', enabled: true, priority: 10, weight: 0.25 },
    { symbol: 'QQQ', assetClass: 'equities', enabled: true, priority: 9, weight: 0.15 },
    { symbol: 'IWM', assetClass: 'equities', enabled: true, priority: 7, weight: 0.10 },
    { symbol: 'AAPL', assetClass: 'equities', enabled: true, priority: 8, weight: 0.05 },
    { symbol: 'MSFT', assetClass: 'equities', enabled: true, priority: 8, weight: 0.05 },
    { symbol: 'GOOGL', assetClass: 'equities', enabled: true, priority: 7, weight: 0.05 },
    { symbol: 'AMZN', assetClass: 'equities', enabled: true, priority: 7, weight: 0.05 },
    { symbol: 'NVDA', assetClass: 'equities', enabled: true, priority: 9, weight: 0.05 },
    { symbol: 'TSLA', assetClass: 'equities', enabled: true, priority: 7, weight: 0.03 },
    { symbol: 'META', assetClass: 'equities', enabled: true, priority: 7, weight: 0.03 },
  ],
  crypto: [
    { symbol: 'BTC-USD', assetClass: 'crypto', enabled: true, priority: 10, weight: 0.08 },
    { symbol: 'ETH-USD', assetClass: 'crypto', enabled: true, priority: 9, weight: 0.05 },
    { symbol: 'SOL-USD', assetClass: 'crypto', enabled: false, priority: 6, weight: 0.02 },
  ],
  forex: [
    { symbol: 'EURUSD', assetClass: 'forex', enabled: true, priority: 8, weight: 0.05 },
    { symbol: 'GBPUSD', assetClass: 'forex', enabled: true, priority: 7, weight: 0.03 },
    { symbol: 'USDJPY', assetClass: 'forex', enabled: true, priority: 8, weight: 0.05 },
    { symbol: 'AUDUSD', assetClass: 'forex', enabled: false, priority: 5, weight: 0.02 },
  ],
  commodities: [
    { symbol: 'GC=F', assetClass: 'commodities', enabled: true, priority: 8, weight: 0.05 },
    { symbol: 'CL=F', assetClass: 'commodities', enabled: true, priority: 7, weight: 0.04 },
    { symbol: 'SI=F', assetClass: 'commodities', enabled: false, priority: 6, weight: 0.02 },
    { symbol: 'HG=F', assetClass: 'commodities', enabled: false, priority: 5, weight: 0.02 },
  ],
  etfs: [
    { symbol: 'GLD', assetClass: 'etfs', enabled: true, priority: 7, weight: 0.03 },
    { symbol: 'TLT', assetClass: 'etfs', enabled: true, priority: 7, weight: 0.05 },
    { symbol: 'VNQ', assetClass: 'etfs', enabled: false, priority: 5, weight: 0.02 },
    { symbol: 'XLF', assetClass: 'etfs', enabled: true, priority: 6, weight: 0.03 },
  ],
  bonds: [
    { symbol: '^TNX', assetClass: 'bonds', enabled: true, priority: 8, weight: 0.04 },
    { symbol: '^TYX', assetClass: 'bonds', enabled: false, priority: 6, weight: 0.02 },
    { symbol: 'LQD', assetClass: 'bonds', enabled: false, priority: 5, weight: 0.02 },
  ],
};

export interface UniverseConfig {
  universes: Record<AssetClass, UniverseSymbol[]>;
  maxSymbolsPerAssetClass: number;
  scanIntervalMs: number;
  correlationWindowDays: number;
  regimeLookbackDays: number;
}

export const universeConfig: UniverseConfig = {
  universes: DEFAULT_UNIVERSE,
  maxSymbolsPerAssetClass: 20,
  scanIntervalMs: 60000,
  correlationWindowDays: 60,
  regimeLookbackDays: 20,
};

export function getAllEnabledSymbols(): UniverseSymbol[] {
  const allSymbols: UniverseSymbol[] = [];
  for (const symbols of Object.values(universeConfig.universes)) {
    allSymbols.push(...symbols.filter(s => s.enabled));
  }
  return allSymbols.sort((a, b) => b.priority - a.priority);
}

export function getSymbolsByAssetClass(assetClass: AssetClass): UniverseSymbol[] {
  return universeConfig.universes[assetClass]?.filter(s => s.enabled) || [];
}