import { scrapingService, ScrapingResponse } from '../../scraping';
import { newsClassifier, NewsAnalysis } from '../../newsClassifier';
import { logger } from '../../../utils/logger';

export class GlassDoorSentimentAgent {
  private sourceName: string = 'GlassDoor';
  private baseUrl: string = 'https://glassdoor.com';

  async scrape(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape major company reviews
      const companyUrls = [
        'https://www.glassdoor.com/Reviews/apple-reviews-SIR.htm',
        'https://www.glassdoor.com/Reviews/tesla-reviews-SIR.htm',
        'https://www.glassdoor.com/Reviews/nvidia-reviews-SIR.htm',
        'https://www.glassdoor.com/Reviews/microsoft-reviews-SIR.htm',
        'https://www.glassdoor.com/Reviews/amazon-reviews-SIR.htm'
      ];

      const results = await scrapingService.scrapeBatch(companyUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const reviews = this.parseCompanyReviews(result);
          analyses.push(...reviews);
        }
      }

      return analyses;
    } catch (error) {
      logger.error(`${this.sourceName}: Error scraping GlassDoor`, error);
      return [];
    }
  }

  async analyzeSentiment(): Promise<NewsAnalysis[]> {
    try {
      const analyses: NewsAnalysis[] = [];

      // Scrape company reviews for sentiment analysis
      const companies = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'];
      const companyUrls = companies.map(symbol =>
        `https://www.glassdoor.com/Reviews/recent-reviews-SIR.htm?filterEmploymentType=R&filterRating=3`
      );

      const results = await scrapingService.scrapeBatch(companyUrls, 'playwright');

      for (const result of results) {
        if (result.success && result.content) {
          const reviews = this.parseReviews(result);
          analyses.push(...reviews);
        }
      }

      // Classify reviews
      const classified = analyses.map(a => {
        const combined = `${a.headline} ${a.content}`;
        return newsClassifier.analyze(a.headline, combined, this.sourceName, a.url);
      });

      // Filter for manipulation risk (GlassDoor has lower manipulation risk)
      const filtered = classified.filter(a => a.scores.manipulationRiskScore < 70);

      logger.info(`${this.sourceName}: Analyzed ${classified.length} reviews, ${filtered.length} passed filter`);
      return filtered;

    } catch (error) {
      logger.error(`${this.sourceName}: Error analyzing sentiment`, error);
      return [];
    }
  }

  private parseCompanyReviews(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Extract company name from URL
      const companyMatch = response.url.match(/Reviews\/([^/-]+)-reviews/i);
      const companyName = companyMatch ? companyMatch[1] : 'Unknown';

      // Parse review structure
      const reviewPattern = /"headline":"([^"]+)"/g;
      const prosPattern = /"pros":"([^"]+)"/g;
      const consPattern = /"cons":"([^"]+)"/g;
      const ratingPattern = /"overallRating":(\d+\.?\d*)/g;
      const authorPattern = /"authorInfo":"([^"]+)"/g;

      const headlines = [...response.content.matchAll(reviewPattern)].map(m => this.decodeUnicode(m[1]));
      const pros = [...response.content.matchAll(prosPattern)].map(m => this.decodeUnicode(m[1]));
      const cons = [...response.content.matchAll(consPattern)].map(m => this.decodeUnicode(m[1]));
      const ratings = [...response.content.matchAll(ratingPattern)].map(m => parseFloat(m[1]));
      const authors = [...response.content.matchAll(authorPattern)].map(m => m[1]);

      for (let i = 0; i < Math.min(headlines.length, 20); i++) {
        const headline = headlines[i];
        const pro = pros[i] || '';
        const con = cons[i] || '';
        const rating = ratings[i] || 3;
        const author = authors[i] || 'Anonymous';

        if (headline.length > 10) {
          const sentiment = this.calculateReviewSentiment(pro, con, rating);

          analyses.push({
            headline: headline.substring(0, 200),
            content: `Pros: ${pro.substring(0, 300)}\nCons: ${con.substring(0, 300)}`,
            url: response.url,
            source: `${this.sourceName} - ${companyName}`,
            timestamp: Date.now(),
            scores: {
              sentimentScore: sentiment.score,
              volatilityScore: 25,
              confidenceScore: this.calculateReviewConfidence(rating, author),
              institutionalImpactScore: sentiment.impact,
              durationScore: 70, // Long-term company sentiment
              manipulationRiskScore: this.calculateManipulationRisk(headline, pro, con)
            },
            classification: sentiment.classification,
            keyThemes: this.extractThemes(pro, con),
            relevantSymbols: [companyName]
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing company reviews`, error);
    }

    return analyses;
  }

  private parseReviews(response: ScrapingResponse): NewsAnalysis[] {
    const analyses: NewsAnalysis[] = [];

    try {
      // Parse review pattern from HTML
      const headlinePattern = /"headline":"([^"]+)"/g;
      const bodyPattern = /"body":"([^"]+)"/g;
      const ratingPattern = /"rating":(\d+)/g;
      const datePattern = /"dateOfReview":"([^"]+)"/g;

      const headlines = [...response.content.matchAll(headlinePattern)].map(m => this.decodeUnicode(m[1]));
      const bodies = [...response.content.matchAll(bodyPattern)].map(m => this.decodeUnicode(m[1]));
      const ratings = [...response.content.matchAll(ratingPattern)].map(m => parseInt(m[1]));
      const dates = [...response.content.matchAll(datePattern)].map(m => m[1]);

      for (let i = 0; i < Math.min(headlines.length, 25); i++) {
        const headline = headlines[i];
        const body = bodies[i] || '';
        const rating = ratings[i] || 3;
        const date = dates[i] || '';

        if (headline.length > 10) {
          const sentiment = this.calculateReviewSentiment(body, '', rating);

          analyses.push({
            headline: headline.substring(0, 200),
            content: body.substring(0, 500),
            url: response.url,
            source: this.sourceName,
            timestamp: date ? new Date(date).getTime() : Date.now(),
            scores: {
              sentimentScore: sentiment.score,
              volatilityScore: 20,
              confidenceScore: this.calculateReviewConfidence(rating, 'Anonymous'),
              institutionalImpactScore: sentiment.impact,
              durationScore: 75,
              manipulationRiskScore: 15
            },
            classification: sentiment.classification,
            keyThemes: this.extractThemes(body, ''),
            relevantSymbols: this.extractSymbols(headline, body)
          });
        }
      }
    } catch (error) {
      logger.error(`${this.sourceName}: Error parsing reviews`, error);
    }

    return analyses;
  }

  private decodeUnicode(str: string): string {
    return str
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"');
  }

  private calculateReviewSentiment(pros: string, cons: string, rating: number): { score: number; classification: 'bullish' | 'bearish' | 'neutral'; impact: number } {
    // Rating-based score (1-5 scale)
    let score = ((rating - 3) / 2) * 100;

    // Pros contribute positively
    const prosLower = pros.toLowerCase();
    const bullishTerms = ['great', 'excellent', 'amazing', 'growth', 'innovative', 'strong', 'leadership'];
    for (const term of bullishTerms) {
      if (prosLower.includes(term)) score += 10;
    }

    // Cons contribute negatively
    const consLower = cons.toLowerCase();
    const bearishTerms = ['poor', 'bad', 'toxic', 'layoffs', 'cuts', 'decline', 'weak', 'issues'];
    for (const term of bearishTerms) {
      if (consLower.includes(term)) score -= 10;
    }

    // Classify
    let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (score > 20) classification = 'bullish';
    else if (score < -20) classification = 'bearish';

    // Institutional impact based on pros mentions
    let impact = 30;
    if (prosLower.includes('management') || prosLower.includes('leadership')) impact += 25;
    if (prosLower.includes('growth') || prosLower.includes('revenue')) impact += 20;
    if (consLower.includes('leadership') || consLower.includes('executives')) impact += 20;

    return {
      score: Math.max(-100, Math.min(100, score)),
      classification,
      impact: Math.min(100, impact)
    };
  }

  private calculateReviewConfidence(rating: number, author: string): number {
    let confidence = 40;

    // Higher ratings = more confident
    if (rating >= 4) confidence += 20;
    if (rating <= 2) confidence += 15;

    // Named authors (not anonymous) = higher confidence
    if (!author.toLowerCase().includes('anonymous')) {
      confidence += 15;
    }

    return Math.min(85, confidence);
  }

  private calculateManipulationRisk(headline: string, pros: string, cons: string): number {
    let risk = 15; // GlassDoor has lower base manipulation risk

    // Check for fake review patterns
    const fakeIndicators = ['excellent everywhere', 'perfect in every', 'amazing company'];
    for (const indicator of fakeIndicators) {
      if (pros.toLowerCase().includes(indicator.toLowerCase())) {
        risk += 25;
      }
    }

    // Very short reviews may be less reliable
    if (pros.length < 50 && cons.length < 50) risk += 15;

    // Extremely negative reviews might be targeted
    if (cons.length > 300 && pros.length < 50) risk += 10;

    return Math.min(85, risk);
  }

  private extractSymbols(headline: string, body: string): string[] {
    const symbols: string[] = [];
    const text = `${headline} ${body}`.toUpperCase();

    // Common ticker patterns
    const tickerPattern = /\b([A-Z]{1,5})\b/g;
    const matches = text.match(tickerPattern) || [];

    const knownStocks = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'FB', 'AMD', 'INTC'];
    for (const match of matches) {
      if (knownStocks.includes(match)) {
        symbols.push(match);
      }
    }

    return [...new Set(symbols)].slice(0, 5);
  }

  private extractThemes(pros: string, cons: string): string[] {
    const themes: string[] = [];
    const text = `${pros} ${cons}`.toLowerCase();

    const themeMap: Record<string, string[]> = {
      'culture': ['culture', 'work environment', 'team', 'colleagues', 'atmosphere'],
      'leadership': ['leadership', 'management', 'executives', 'CEO', 'vision'],
      'growth': ['growth', 'career', 'opportunities', 'promotion', 'learning'],
      'compensation': ['compensation', 'salary', 'benefits', 'stock', 'pay'],
      'work-life': ['work-life balance', 'hours', 'remote', 'flexible', 'vacation']
    };

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(k => text.includes(k))) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 4);
  }
}

export const glassDoorSentimentAgent = new GlassDoorSentimentAgent();