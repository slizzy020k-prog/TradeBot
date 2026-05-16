import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class CryptoCorrelationAgent {
  private sourceName: string = 'Crypto Correlation Monitor';

  async scrape(): Promise<NewsAnalysis[]> {
    const urls = [
      'https://www.coindesk.com/',
      'https://cointelegraph.com/',
      'https://decrypt.co/',
    ];
    return this.fetchAndAnalyze(urls);
  }

  async getLatestData(): Promise<NewsAnalysis[]> {
    const cryptoSources = [
      'https://www.bloomberg.com/markets/currencies',
      'https://www.reuters.com/technology/',
      'https://www.cnbc.com/cryptocurrency',
    ];
    return this.fetchAndAnalyze(cryptoSources);
  }

  private async fetchAndAnalyze(urls: string[]): Promise<NewsAnalysis[]> {
    const allAnalyses: NewsAnalysis[] = [];

    for (const url of urls) {
      try {
        const response = await scrapingService.scrape(url);
        const analyses = this.parseCryptoContent(response);
        allAnalyses.push(...analyses);
      } catch (error) {
        logger.error(`[CryptoCorrelation] Failed to fetch ${url}: ${error}`);
      }
    }

    const scored = this.applyCryptoScoring(allAnalyses);
    logger.info(`[CryptoCorrelation] Analyzed ${scored.length} crypto correlation updates`);
    return scored;
  }

  private parseCryptoContent(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    if (!response.success || !response.content) {
      return analyses;
    }

    const bitcoinPatterns = [
      /bitcoin\s+(?:price|surge|plunge|rally|crash)/gi,
      /BTC\s+(?:price|surge|plunge)/gi,
      /Bitcoin\s+(?:ETF|adoption|institutional)/gi,
      /bitcoin\s+mine?s?/gi,
      /bitcoin\s+wallets?/gi,
      /bitcoin\s+whales?/gi,
      /bitcoin\s+network\s+(?:hash|activity)/gi,
      /\bBTC\b(?!\s+call)/gi,
    ];

    const correlationPatterns = [
      /bitcoin\s+correlation\s+(?:with|to|vs?)\s+(?:S&P|nasdaq|dollar|gold|stock)/gi,
      /crypto\s+correlation\s+(?:to|with)\s+(?:markets?|stocks|gold)/gi,
      /bitcoin\s+trades?\s+(?:with|alongside|similar\s+to)\s+(?:gold|stocks|equity)/gi,
      /risk\s+on[\s-]?off\s+dynamic/gi,
      /bitcoin\s+safe\s+haven/gi,
      /bitcoin\s+hedge\s+(?:against|inflation)/gi,
      /bitcoin\s+vs[\s-]?\s*(?:S&P 500|nasdaq|dow)/gi,
      /correlation\s+coefficient\s+(?:between|of)\s+bitcoin/gi,
    ];

    const macroCryptoPatterns = [
      /Fed\s+(?:rate|policy)\s+(?:impact\s+)?crypto/gi,
      /institutional\s+(?:crypto|bitcoin)/gi,
      /macro\s+environment\s+(?:favors?|impacts?)\s+crypto/gi,
      /dollar\s+(?:weakness|strength)\s+(?:bitcoin|crypto)/gi,
      /liquidity\s+(?:crisis|squeeze)\s+(?:bitcoin|crypto)/gi,
      /liquidation[s]?\s+(?:bitcoin|crypto|short\s+position)/gi,
    ];

    const headline = response.title || 'Crypto Correlation Report';
    const content = response.content.substring(0, 5000);

    const events: string[] = [];
    for (const pattern of bitcoinPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of correlationPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }
    for (const pattern of macroCryptoPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        events.push(match[0]);
      }
    }

    if (events.length > 0) {
      const eventText = events.join('. ');
      const analysis = newsClassifier.analyze(
        `Crypto Correlation Alert: ${eventText.substring(0, 100)}`,
        content,
        this.sourceName,
        response.url
      );
      analyses.push(analysis);
    } else if (content.length > 100) {
      const analysis = newsClassifier.analyze(
        headline,
        content,
        this.sourceName,
        response.url
      );
      analyses.push(analysis);
    }

    return analyses;
  }

  private applyCryptoScoring(analyses: NewsAnalysis[]): NewsAnalysis[] {
    const HIGH_IMPACT_KEYWORDS = [
      'bitcoin', 'BTC', 'crypto', 'ethereum', 'ETH', 'coinbase',
      'institutional bitcoin', 'bitcoin ETF', 'bitcoin correlation',
      'crypto market', 'digital asset', 'bitcoin adoption',
      'bitcoin whale', 'bitcoin miner', 'crypto regulation',
    ];

    const CORRELATION_KEYWORDS = [
      'S&P 500', 'nasdaq', 'dow jones', 'gold', 'silver',
      'dollar index', 'Treasury', 'bond', 'equity correlation',
      'risk-on', 'risk-off', 'safe haven', 'hedge',
    ];

    return analyses.map(analysis => {
      const text = `${analysis.headline} ${analysis.content}`.toLowerCase();
      const highImpactCount = HIGH_IMPACT_KEYWORDS.filter(k => text.includes(k)).length;
      const correlationCount = CORRELATION_KEYWORDS.filter(k => text.includes(k.toLowerCase())).length;

      const modifiedScores = { ...analysis.scores };

      if (highImpactCount > 0) {
        modifiedScores.institutionalImpactScore = Math.min(100, analysis.scores.institutionalImpactScore + 20);
        modifiedScores.volatilityScore = Math.min(100, analysis.scores.volatilityScore + highImpactCount * 10);
      }

      // High relevance for correlation analysis
      if (correlationCount > 0) {
        modifiedScores.durationScore = Math.min(100, analysis.scores.durationScore + correlationCount * 12);
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + correlationCount * 8);
      }

      // Bitcoin as macro asset
      if (text.includes('bitcoin') && (text.includes('macro') || text.includes('Fed') || text.includes('dollar'))) {
        modifiedScores.institutionalImpactScore = Math.min(100, modifiedScores.institutionalImpactScore + 15);
      }

      // Institutional adoption signals
      if (text.includes('institutional') || text.includes('ETF') || text.includes('adoption')) {
        modifiedScores.durationScore = Math.min(100, modifiedScores.durationScore + 10);
      }

      return { ...analysis, scores: modifiedScores };
    });
  }
}

export const cryptoCorrelationAgent = new CryptoCorrelationAgent();