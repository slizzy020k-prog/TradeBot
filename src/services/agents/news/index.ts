export { BloombergNewsAgent, bloombergNewsAgent } from './bloombergAgent';
export { ReutersNewsAgent, reutersNewsAgent } from './reutersAgent';
export { CNBCNewsAgent, cnbcNewsAgent } from './cnbcAgent';
export { FTNewsAgent, ftNewsAgent } from './ftAgent';
export { WSJNewsAgent, wsjNewsAgent } from './wsjAgent';
export { MarketWatchNewsAgent, marketWatchNewsAgent } from './marketWatchAgent';
export { SeekingAlphaNewsAgent, seekingAlphaNewsAgent } from './seekingAlphaAgent';
export { BenzingaNewsAgent, benzingaNewsAgent } from './benzingaAgent';
export { YahooFinanceNewsAgent, yahooFinanceNewsAgent } from './yahooFinanceAgent';
export { MotleyFoolNewsAgent, motleyFoolNewsAgent } from './motleyFoolAgent';

import { bloombergNewsAgent } from './bloombergAgent';
import { reutersNewsAgent } from './reutersAgent';
import { cnbcNewsAgent } from './cnbcAgent';
import { ftNewsAgent } from './ftAgent';
import { wsjNewsAgent } from './wsjAgent';
import { marketWatchNewsAgent } from './marketWatchAgent';
import { seekingAlphaNewsAgent } from './seekingAlphaAgent';
import { benzingaNewsAgent } from './benzingaAgent';
import { yahooFinanceNewsAgent } from './yahooFinanceAgent';
import { motleyFoolNewsAgent } from './motleyFoolAgent';

export const allNewsAgents = [
  bloombergNewsAgent,
  reutersNewsAgent,
  cnbcNewsAgent,
  ftNewsAgent,
  wsjNewsAgent,
  marketWatchNewsAgent,
  seekingAlphaNewsAgent,
  benzingaNewsAgent,
  yahooFinanceNewsAgent,
  motleyFoolNewsAgent,
];

export const newsAgentSources = [
  'Bloomberg',
  'Reuters',
  'CNBC',
  'Financial Times',
  'Wall Street Journal',
  'MarketWatch',
  'Seeking Alpha',
  'Benzinga',
  'Yahoo Finance',
  'Motley Fool',
];