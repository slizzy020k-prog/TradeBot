import axios from 'axios';
import { AIAnalysisRequest, AIAnalysisResponse } from '../types';
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

Be careful and conservative when confidence is low. Never recommend a trade that contradicts strong market trends without compelling evidence.

IMPORTANT: Respond using this exact format:
RECOMMENDATION: buy/sell/hold
CONFIDENCE: 0-100
REASONING: your explanation
QUANTITY: (optional) number
STOP_LOSS: (optional) price
TAKE_PROFIT: (optional) price`;

export class AIAnalysisService {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const prompt = this.buildAnalysisPrompt(request);

      if (config.aiProvider === 'minimax') {
        return await this.analyzeWithMiniMax(prompt);
      } else {
        return await this.analyzeWithAnthropic(prompt);
      }
    } catch (error) {
      logger.error('AI analysis failed:', error);
      throw error;
    }
  }

  private async analyzeWithMiniMax(prompt: string): Promise<AIAnalysisResponse> {
    if (!config.miniMaxApiKey) {
      throw new Error('MINIMAX_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        'https://api.minimaxi.com/v1/chat/completions',
        {
          model: 'MiniMax-M2.7',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_completion_tokens: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.miniMaxApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const text = response.data.choices[0].message.content;
      return this.parseAIResponse(text);
    } catch (error: any) {
      logger.error('MiniMax API error:', error.response?.data || error.message);
      throw error;
    }
  }

  private async analyzeWithAnthropic(prompt: string): Promise<AIAnalysisResponse> {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: config.anthropicApiKey });

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      const text = 'text' in contentBlock ? contentBlock.text : '';
      return this.parseAIResponse(text);
    } catch (error) {
      logger.error('Anthropic API error:', error);
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