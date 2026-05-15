import Anthropic from '@anthropic-ai/sdk';
import { AIAnalysisRequest, AIAnalysisResponse, MarketData, Trade, MemoryEntry, UserInfo, PortfolioState } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

const SYSTEM_PROMPT = `You are an expert trading AI agent. Your role is to analyze market data, user-provided information, and historical context to make informed trading recommendations.

You must:
1. Consider current market conditions and trends
2. Take into account any user-provided information (news, reports, tips)
3. Learn from past trading outcomes stored in memory
4. Apply risk management principles
5. Provide clear, confidence-weighted recommendations

For each analysis, respond with:
- recommendation: "buy", "sell", or "hold"
- confidence: 0-100 scale
- reasoning: explanation of your decision
- (optional) suggestedQuantity, stopLoss, takeProfit

Be careful and conservative when confidence is low. Never recommend a trade that contradicts strong market trends without compelling evidence.`;

export class AIAnalysisService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      if (!config.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    return this.client;
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const prompt = this.buildAnalysisPrompt(request);
      const response = await this.getClient().messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      const text = 'text' in contentBlock ? contentBlock.text : '';
      return this.parseAIResponse(text);
    } catch (error) {
      logger.error('AI analysis failed:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(request: AIAnalysisRequest): string {
    const { marketData, portfolioState, recentTrades, userInfos, memoryContext } = request;

    let prompt = `Analyze the following market data:\n`;
    marketData.forEach(md => {
      prompt += `- ${md.symbol}: $${md.price} (volume: ${md.volume || 'N/A'})\n`;
    });

    prompt += `\nPortfolio State:\n`;
    prompt += `- Cash: $${portfolioState.cash}\n`;
    prompt += `- Total Value: $${portfolioState.totalValue}\n`;
    prompt += `- Daily P&L: $${portfolioState.dailyPnL}\n`;
    prompt += `- Positions: ${Array.from(portfolioState.positions.entries()).map(([s, q]) => `${s}: ${q}`).join(', ') || 'none'}\n`;

    if (userInfos.length > 0) {
      prompt += `\nUser-Provided Information:\n`;
      userInfos.forEach(ui => {
        prompt += `- [${new Date(ui.timestamp).toISOString()}] ${ui.content}\n`;
      });
    }

    if (memoryContext.length > 0) {
      prompt += `\nRecent Context (from memory):\n`;
      memoryContext.slice(-5).forEach(mc => {
        prompt += `- [${mc.type}] ${mc.content}\n`;
      });
    }

    if (recentTrades.length > 0) {
      prompt += `\nRecent Trades:\n`;
      recentTrades.slice(-5).forEach(t => {
        prompt += `- ${t.side.toUpperCase()} ${t.quantity} ${t.symbol} @ $${t.price} (${t.status})\n`;
      });
    }

    prompt += `\n\nProvide your trading recommendation in this exact format:
RECOMMENDATION: buy/sell/hold
CONFIDENCE: 0-100
REASONING: explanation
QUANTITY: (optional) number of shares
STOP_LOSS: (optional) price
TAKE_PROFIT: (optional) price`;

    return prompt;
  }

  private parseAIResponse(text: string): AIAnalysisResponse {
    const lines = text.split('\n');
    let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 50;
    let reasoning = '';
    let suggestedQuantity: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim().toLowerCase();

      if (key.toUpperCase().includes('RECOMMENDATION')) {
        if (value.includes('buy')) recommendation = 'buy';
        else if (value.includes('sell')) recommendation = 'sell';
        else recommendation = 'hold';
      } else if (key.toUpperCase().includes('CONFIDENCE')) {
        const num = parseInt(value, 10);
        if (!isNaN(num)) confidence = Math.min(100, Math.max(0, num));
      } else if (key.toUpperCase().includes('REASONING')) {
        reasoning = valueParts.join(':').trim();
      } else if (key.toUpperCase().includes('QUANTITY')) {
        const num = parseFloat(value);
        if (!isNaN(num)) suggestedQuantity = num;
      } else if (key.toUpperCase().includes('STOP_LOSS')) {
        const num = parseFloat(value);
        if (!isNaN(num)) stopLoss = num;
      } else if (key.toUpperCase().includes('TAKE_PROFIT')) {
        const num = parseFloat(value);
        if (!isNaN(num)) takeProfit = num;
      }
    }

    return { recommendation, confidence, reasoning, suggestedQuantity, stopLoss, takeProfit };
  }
}

export const aiAnalysisService = new AIAnalysisService();