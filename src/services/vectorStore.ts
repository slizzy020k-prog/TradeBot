import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';
import { logger } from '../utils/logger';
import { embeddingsService, TradeSummary } from './embeddings';

export interface TradeVectorPayload {
  symbol: string;
  side: string;
  qualityScore: number;
  isGoodTrade: boolean;
  trendAlignment: number;
  volatilityScore: number;
  liquidityScore: number;
  riskToReward: number;
  profitLoss: number | null;
  tradeText: string;
}

export interface NewsVectorPayload {
  symbol: string;
  headline: string;
  content: string;
  url: string;
  source: string;
  classification: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  volatilityScore: number;
  confidenceScore: number;
  institutionalImpactScore: number;
  durationScore: number;
  manipulationRiskScore: number;
  keyThemes: string[];
  relevantSymbols: string[];
  timestamp: number;
}

export class VectorStoreService {
  private client: QdrantClient;
  private collectionName: string;

  constructor() {
    const host = config.qdrantHost || 'localhost';
    const port = config.qdrantPort || 6333;
    this.collectionName = config.qdrantCollection || 'tradebot_trades';
    this.client = new QdrantClient({ url: `http://${host}:${port}` });
  }

  async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c: { name: string }) => c.name === this.collectionName);

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: { size: 1536, distance: 'Cosine' },
        });
        logger.info(`Created Qdrant collection: ${this.collectionName}`);
      }
    } catch (error) {
      logger.warn('Qdrant collection check failed (may not be running):', error);
    }
  }

  async upsertTrade(tradeId: string, payload: TradeVectorPayload): Promise<string | null> {
    try {
      await this.ensureCollection();

      const vector = await embeddingsService.getEmbedding(payload.tradeText);

      const id = this.hashId(tradeId);

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector,
            payload: {
              tradeId,
              symbol: payload.symbol,
              side: payload.side,
              qualityScore: payload.qualityScore,
              isGoodTrade: payload.isGoodTrade ? 1 : 0,
              trendAlignment: payload.trendAlignment,
              volatilityScore: payload.volatilityScore,
              liquidityScore: payload.liquidityScore,
              riskToReward: payload.riskToReward,
              profitLoss: payload.profitLoss,
            },
          },
        ],
      });

      logger.debug(`Upserted trade ${tradeId} to Qdrant`);
      return id;
    } catch (error) {
      logger.error('Failed to upsert to Qdrant:', error);
      return null;
    }
  }

  async upsertNews(newsId: string, vector: number[], payload: NewsVectorPayload): Promise<string | null> {
    try {
      await this.ensureCollection();

      const id = this.hashId(newsId);

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector,
            payload: {
              newsId,
              symbol: payload.symbol,
              headline: payload.headline,
              content: payload.content,
              url: payload.url,
              source: payload.source,
              classification: payload.classification,
              sentimentScore: payload.sentimentScore,
              volatilityScore: payload.volatilityScore,
              confidenceScore: payload.confidenceScore,
              institutionalImpactScore: payload.institutionalImpactScore,
              durationScore: payload.durationScore,
              manipulationRiskScore: payload.manipulationRiskScore,
              keyThemes: JSON.stringify(payload.keyThemes),
              relevantSymbols: JSON.stringify(payload.relevantSymbols),
              timestamp: payload.timestamp,
            },
          },
        ],
      });

      logger.debug(`Upserted news ${newsId} to Qdrant`);
      return id;
    } catch (error) {
      logger.error('Failed to upsert news to Qdrant:', error);
      return null;
    }
  }

  async searchSimilar(symbol: string, limit: number = 5): Promise<TradeVectorPayload[]> {
    try {
      const searchText = `Trade for ${symbol} with similar pattern`;
      const queryVector = await embeddingsService.getEmbedding(searchText);

      const results = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        filter: {
          must: [
            {
              key: 'symbol',
              match: { value: symbol },
            },
          ],
        },
      });

      return this.mapSearchResults(results);
    } catch (error) {
      logger.error('Qdrant search failed:', error);
      return [];
    }
  }

  async searchByQuality(good: boolean, symbol: string, limit: number = 5): Promise<TradeVectorPayload[]> {
    try {
      const qualityText = good
        ? `High quality successful trade for ${symbol}`
        : `Low quality unsuccessful trade for ${symbol}`;
      const queryVector = await embeddingsService.getEmbedding(qualityText);

      const results = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        filter: {
          must: [
            { key: 'symbol', match: { value: symbol } },
            { key: 'isGoodTrade', match: { value: good ? 1 : 0 } },
          ],
        },
      });

      return this.mapSearchResults(results);
    } catch (error) {
      logger.error('Qdrant quality search failed:', error);
      return [];
    }
  }

  private mapSearchResults(results: unknown[]): TradeVectorPayload[] {
    return results.map((r: any) => {
      const payload = r.payload || {};
      return {
        tradeId: payload.tradeId as string,
        symbol: payload.symbol as string,
        side: payload.side as string,
        qualityScore: payload.qualityScore as number,
        isGoodTrade: payload.isGoodTrade === 1,
        trendAlignment: payload.trendAlignment as number,
        volatilityScore: payload.volatilityScore as number,
        liquidityScore: payload.liquidityScore as number,
        riskToReward: payload.riskToReward as number,
        profitLoss: payload.profitLoss as number | null,
        tradeText: '',
      };
    });
  }

  private hashId(tradeId: string): string {
    let hash = 0;
    for (let i = 0; i < tradeId.length; i++) {
      const char = tradeId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
}

export const vectorStoreService = new VectorStoreService();