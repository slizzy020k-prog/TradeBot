import { logger } from '../utils/logger';

export interface NewsScores {
  sentimentScore: number;
  volatilityScore: number;
  confidenceScore: number;
  institutionalImpactScore: number;
  durationScore: number;
  manipulationRiskScore: number;
}

export interface NewsAnalysis {
  headline: string;
  content: string;
  url: string;
  source: string;
  timestamp: number;
  scores: NewsScores;
  classification: 'bullish' | 'bearish' | 'neutral';
  keyThemes: string[];
  relevantSymbols: string[];
}

export interface SentimentKeywords {
  bullish: string[];
  bearish: string[];
  neutral: string[];
  manipulation: string[];
}

const SENTIMENT_KEYWORDS: SentimentKeywords = {
  bullish: [
    'beat', 'beats', 'exceeded', 'surpassed', 'strong', 'growth', 'upgraded',
    'upgrade', 'bullish', 'buy', 'long', 'outperform', 'overweight', 'positive',
    ' record high', 'soar', 'soared', 'rally', 'gain', 'gains', 'jump', 'jumped',
    'surge', 'surged', 'rising', 'increase', 'increased', 'expansion', 'profit',
    'profitable', 'dividend', 'buyback', 'acquisition', 'partnership', 'breakthrough'
  ],
  bearish: [
    'miss', 'missed', 'below', 'weak', 'decline', 'declined', 'downgraded',
    'downgrade', 'bearish', 'sell', 'short', 'underperform', 'underweight',
    'negative', 'drop', 'dropped', 'fell', 'fall', 'plunge', 'plunged', 'loss',
    'losses', 'warning', 'cut', 'reduced', 'layoffs', 'lawsuit', 'investigation',
    'fraud', 'scandal', 'bankruptcy', 'default', 'debt', 'write-down'
  ],
  neutral: [
    'maintain', 'hold', 'unchanged', 'stable', 'steady', 'mixed', 'mixed signals',
    'flat', 'in line', 'meets expectations', 'inline', 'mixed', 'uncertain'
  ],
  manipulation: [
    'pump', 'dump', 'short squeeze', 'manipulation', 'coordinated', 'false signal',
    'misleading', 'fake news', 'disinformation', 'hype', 'hyped', 'viral', 'bot',
    'coordinated buying', 'coordinated selling', 'wash trading', 'front running'
  ]
};

const INSTITUTIONAL_KEYWORDS = [
  'hedge fund', 'institutional', 'mutual fund', 'pension', ' ETF ', 'flows',
  '13F', 'accumulation', 'distribution', 'smart money', 'bank', 'trading desk'
];

const HIGH_IMPACT_KEYWORDS = [
  'federal reserve', 'FOMC', 'CPI', 'NFP', 'payrolls', 'GDP', 'earnings',
  'guidance', 'FDA', 'SEC', 'DOJ', 'antitrust', 'merger', 'acquisition'
];

const TEMPORARY_KEYWORDS = ['day trade', 'intraday', 'short-term', 'noise', 'volatility'];
const LONGTERM_KEYWORDS = ['structural', 'long-term', 'fundamentals', 'outlook', 'forecast'];

export class NewsClassifier {
  private minConfidenceThreshold = 30;

  analyze(headline: string, content: string, source: string, url: string): NewsAnalysis {
    const combinedText = `${headline} ${content}`.toLowerCase();

    const scores = this.calculateScores(headline, content, combinedText, source);
    const classification = this.classify(scores);
    const keyThemes = this.extractKeyThemes(combinedText);
    const relevantSymbols = this.extractSymbols(headline, content);

    logger.debug(`News classified as ${classification}: ${headline.substring(0, 50)}...`);

    return {
      headline,
      content: content.substring(0, 5000),
      url,
      source,
      timestamp: Date.now(),
      scores,
      classification,
      keyThemes,
      relevantSymbols,
    };
  }

  private calculateScores(headline: string, content: string, combinedText: string, source: string): NewsScores {
    const sentimentScore = this.calculateSentimentScore(combinedText);
    const volatilityScore = this.calculateVolatilityScore(combinedText);
    const confidenceScore = this.calculateConfidenceScore(content, source);
    const institutionalImpactScore = this.calculateInstitutionalImpact(combinedText);
    const durationScore = this.calculateDurationScore(combinedText);
    const manipulationRiskScore = this.calculateManipulationRisk(combinedText, headline);

    return {
      sentimentScore,
      volatilityScore,
      confidenceScore,
      institutionalImpactScore,
      durationScore,
      manipulationRiskScore,
    };
  }

  private calculateSentimentScore(text: string): number {
    let score = 0;
    let bullishCount = 0;
    let bearishCount = 0;

    for (const keyword of SENTIMENT_KEYWORDS.bullish) {
      if (text.includes(keyword)) bullishCount++;
    }
    for (const keyword of SENTIMENT_KEYWORDS.bearish) {
      if (text.includes(keyword)) bearishCount++;
    }

    const totalMentions = bullishCount + bearishCount;
    if (totalMentions === 0) return 0;

    const rawScore = ((bullishCount - bearishCount) / totalMentions) * 100;
    score = Math.max(-100, Math.min(100, rawScore));

    return score;
  }

  private calculateVolatilityScore(text: string): number {
    let score = 50;

    const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;
    score += highImpactCount * 10;

    const extremeWords = ['crash', 'surge', 'plunge', 'soar', 'collapse', 'explosion'];
    const extremeCount = extremeWords.filter(w => text.includes(w)).length;
    score += extremeCount * 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateConfidenceScore(content: string, source: string): number {
    let score = 50;

    if (content.length > 500) score += 15;
    if (content.length > 1000) score += 10;

    const reputableSources = ['bloomberg', 'reuters', 'cnbc', 'wsj', 'ft', 'marketwatch'];
    if (reputableSources.some(s => source.toLowerCase().includes(s))) {
      score += 15;
    }

    const hasAuthor = content.includes('By ') || content.includes('by ');
    if (hasAuthor) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateInstitutionalImpact(text: string): number {
    let score = 30;

    const instCount = INSTITUTIONAL_KEYWORDS.filter(k => text.includes(k)).length;
    score += instCount * 15;

    if (text.includes('institutional')) score += 10;
    if (text.includes('fund flows') || text.includes('money flow')) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateDurationScore(text: string): number {
    let score = 50;

    const longTermCount = LONGTERM_KEYWORDS.filter(k => text.includes(k)).length;
    score += longTermCount * 12;

    const temporaryCount = TEMPORARY_KEYWORDS.filter(k => text.includes(k)).length;
    score -= temporaryCount * 12;

    return Math.max(0, Math.min(100, score));
  }

  private calculateManipulationRisk(text: string, headline: string): number {
    let risk = 10;

    const manipCount = SENTIMENT_KEYWORDS.manipulation.filter(k => text.includes(k)).length;
    risk += manipCount * 20;

    if (headline.includes('BREAKING') || headline.includes('URGENT')) risk += 15;

    const allCapsCount = (headline.match(/[A-Z]{5,}/g) || []).length;
    if (allCapsCount > 2) risk += 15;

    const excessivePunctuation = (headline.match(/!{2,}|\?{2,}/g) || []).length;
    if (excessivePunctuation > 0) risk += 10;

    return Math.max(0, Math.min(100, risk));
  }

  private classify(scores: NewsScores): 'bullish' | 'bearish' | 'neutral' {
    if (scores.manipulationRiskScore > 60) {
      return 'neutral';
    }

    if (scores.confidenceScore < this.minConfidenceThreshold) {
      return 'neutral';
    }

    if (scores.sentimentScore > 20) return 'bullish';
    if (scores.sentimentScore < -20) return 'bearish';
    return 'neutral';
  }

  private extractKeyThemes(text: string): string[] {
    const themes: string[] = [];

    const themeKeywords: Record<string, string[]> = {
      'earnings': ['earnings', 'revenue', 'eps', 'profit', 'quarter', 'fiscal'],
      ' Fed policy': ['federal reserve', 'FOMC', 'interest rate', 'monetary'],
      'economic data': ['CPI', 'GDP', 'payrolls', 'employment', 'inflation'],
      'M&A': ['merger', 'acquisition', 'takeover', 'buyout', 'deal'],
      'regulatory': ['SEC', 'FDA', 'DOJ', 'antitrust', 'regulation', 'fine'],
      'products': ['product launch', 'FDA approval', 'breakthrough', 'innovation'],
      'leadership': ['CEO', 'COO', 'CFO', 'executive', ' resignation', 'appointed'],
      ' macro': ['global', 'economy', 'recession', 'growth', 'market'],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(k => text.includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 5);
  }

  private extractSymbols(headline: string, content: string): string[] {
    const symbols: Set<string> = new Set();
    const text = `${headline} ${content}`;

    const tickerMatches = text.match(/\b[A-Z]{1,5}(?:\.[A-Z]{1,2})?(?:\s+(?:stock|shares|trading))?\b/g);
    if (tickerMatches) {
      for (const match of tickerMatches) {
        const symbol = match.replace(/\..*$/, '').trim();
        if (symbol.length >= 1 && symbol.length <= 5 && /^[A-Z]+$/.test(symbol)) {
          symbols.add(symbol);
        }
      }
    }

    return Array.from(symbols).slice(0, 10);
  }

  aggregateSentiment(analyses: NewsAnalysis[]): {
    overall: 'bullish' | 'bearish' | 'neutral';
    score: number;
    confidence: number;
    manipulationRisk: number;
  } {
    if (analyses.length === 0) {
      return { overall: 'neutral', score: 0, confidence: 0, manipulationRisk: 0 };
    }

    const avgSentiment = analyses.reduce((sum, a) => sum + a.scores.sentimentScore, 0) / analyses.length;
    const avgConfidence = analyses.reduce((sum, a) => sum + a.scores.confidenceScore, 0) / analyses.length;
    const avgManipulation = analyses.reduce((sum, a) => sum + a.scores.manipulationRiskScore, 0) / analyses.length;

    let overall: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (avgManipulation < 50) {
      if (avgSentiment > 10) overall = 'bullish';
      else if (avgSentiment < -10) overall = 'bearish';
    }

    return {
      overall,
      score: avgSentiment,
      confidence: avgConfidence,
      manipulationRisk: avgManipulation,
    };
  }
}

export const newsClassifier = new NewsClassifier();