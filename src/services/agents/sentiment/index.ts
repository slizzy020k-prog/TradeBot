export { twitterSentimentAgent, TwitterSentimentAgent } from './twitterSentimentAgent';
export { redditSentimentAgent, RedditSentimentAgent } from './redditSentimentAgent';
export { youtubeSentimentAgent, YouTubeSentimentAgent } from './youtubeSentimentAgent';
export { stockTwitsSentimentAgent, StockTwitsSentimentAgent } from './stockTwitsAgent';
export { glassDoorSentimentAgent, GlassDoorSentimentAgent } from './glassDoorAgent';
export { newsSentimentAgent, NewsSentimentAgent } from './newsSentimentAgent';
export { optionsFlowSentimentAgent, OptionsFlowSentimentAgent } from './optionsFlowAgent';
export { darkPoolSentimentAgent, DarkPoolSentimentAgent } from './darkPoolAgent';

import { TwitterSentimentAgent } from './twitterSentimentAgent';
import { RedditSentimentAgent } from './redditSentimentAgent';
import { YouTubeSentimentAgent } from './youtubeSentimentAgent';
import { StockTwitsSentimentAgent } from './stockTwitsAgent';
import { GlassDoorSentimentAgent } from './glassDoorAgent';
import { NewsSentimentAgent } from './newsSentimentAgent';
import { OptionsFlowSentimentAgent } from './optionsFlowAgent';
import { DarkPoolSentimentAgent } from './darkPoolAgent';

export interface SentimentAgent {
  scrape(): Promise<import('../../newsClassifier').NewsAnalysis[]>;
  analyzeSentiment(): Promise<import('../../newsClassifier').NewsAnalysis[]>;
}

export const sentimentAgents: Record<string, SentimentAgent> = {
  twitter: new TwitterSentimentAgent(),
  reddit: new RedditSentimentAgent(),
  youtube: new YouTubeSentimentAgent(),
  stocktwits: new StockTwitsSentimentAgent(),
  glassdoor: new GlassDoorSentimentAgent(),
  news: new NewsSentimentAgent(),
  optionsflow: new OptionsFlowSentimentAgent(),
  darkpool: new DarkPoolSentimentAgent(),
};

export async function scrapeAllSentiment(): Promise<import('../../newsClassifier').NewsAnalysis[]> {
  const results = await Promise.allSettled(
    Object.values(sentimentAgents).map(agent => agent.analyzeSentiment())
  );

  const allAnalyses: import('../../newsClassifier').NewsAnalysis[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allAnalyses.push(...result.value);
    }
  }

  return allAnalyses;
}