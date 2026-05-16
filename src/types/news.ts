export interface NewsScores {
  sentimentScore: number;
  volatilityScore: number;
  confidenceScore: number;
  institutionalImpactScore: number;
  durationScore: number;
  manipulationRiskScore: number;
}

export interface NewsArticle {
  id: string;
  url: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
  sentimentScore: number;
  volatilityScore: number;
  confidenceScore: number;
  institutionalImpactScore: number;
  durationScore: number;
  manipulationRiskScore: number;
  classification: 'bullish' | 'bearish' | 'neutral';
  keyThemes: string[];
  relevantSymbols: string[];
  scrapedAt: number;
}

export interface ScrapedNews {
  url: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
}

export interface NewsSource {
  name: string;
  baseUrl: string;
  scrapingTool: 'scrapling' | 'crawl4ai' | 'playwright';
  category: 'news' | 'economic' | 'sentiment' | 'earnings' | 'technical' | 'geopolitical';
}

export const NEWS_SOURCES: NewsSource[] = [
  { name: 'Bloomberg', baseUrl: 'https://bloomberg.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Reuters', baseUrl: 'https://reuters.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'CNBC', baseUrl: 'https://cnbc.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Financial Times', baseUrl: 'https://ft.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'WSJ', baseUrl: 'https://wsj.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'MarketWatch', baseUrl: 'https://marketwatch.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Seeking Alpha', baseUrl: 'https://seekingalpha.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Benzinga', baseUrl: 'https://benzinga.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Yahoo Finance', baseUrl: 'https://finance.yahoo.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Motley Fool', baseUrl: 'https://fool.com', scrapingTool: 'scrapling', category: 'news' },
  { name: 'Federal Reserve', baseUrl: 'https://federalreserve.gov', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'BLS', baseUrl: 'https://bls.gov', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'IMF', baseUrl: 'https://imf.org', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'World Bank', baseUrl: 'https://worldbank.org', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'ECB', baseUrl: 'https://ecb.europa.eu', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'Bank of England', baseUrl: 'https://bankofengland.co.uk', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'US Treasury', baseUrl: 'https://treasury.gov', scrapingTool: 'scrapling', category: 'economic' },
  { name: 'DOL', baseUrl: 'https://dol.gov', scrapingTool: 'scrapling', category: 'economic' },
];

export interface EconomicRelease {
  id: string;
  name: string;
  country: string;
  importance: 'high' | 'medium' | 'low';
  releaseDate: number;
  previousValue?: number;
  forecastValue?: number;
  actualValue?: number;
  impactScore: number;
}

export interface SentimentData {
  source: string;
  symbol?: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  volume: number;
  timestamp: number;
}