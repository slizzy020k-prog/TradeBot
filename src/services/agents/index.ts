export * from './types';
export * from './trendAgent';
export * from './volatilityAgent';
export * from './liquidityAgent';
export * from './momentumAgent';
export * from './riskAgent';
export * from './historicalEdgeAgent';
export * from './executionAgent';
export * from './ceoAgent';

import { trendAgent } from './trendAgent';
import { volatilityAgent } from './volatilityAgent';
import { liquidityAgent } from './liquidityAgent';
import { momentumAgent } from './momentumAgent';
import { riskAgent } from './riskAgent';
import { historicalEdgeAgent } from './historicalEdgeAgent';
import { executionAgent } from './executionAgent';
import { ceoAgent } from './ceoAgent';

export const agents = {
  trendAgent,
  volatilityAgent,
  liquidityAgent,
  momentumAgent,
  riskAgent,
  historicalEdgeAgent,
  executionAgent,
  ceoAgent,
};