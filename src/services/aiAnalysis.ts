import axios from 'axios';
import { AIAnalysisRequest, AIAnalysisResponse } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ragContextBuilder } from './ragContext';
import { TRADING_PERSONA, PERSONA_CONFIG } from '../config/persona';

export class AIAnalysisService {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const prompt = await this.buildAnalysisPrompt(request);

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
            { role: 'system', content: TRADING_PERSONA },
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

      const choice = response.data.choices?.[0];
      const text = choice?.message?.content || '';
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
        system: TRADING_PERSONA,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content?.[0];
      const text = contentBlock && 'text' in contentBlock ? contentBlock.text : '';
      return this.parseAIResponse(text);
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw error;
    }
  }

  private async buildAnalysisPrompt(request: AIAnalysisRequest): Promise<string> {
    const { marketData, portfolioState, recentTrades, userInfos, memoryContext } = request;

    const ragContext = await ragContextBuilder.buildContext(marketData[0]?.symbol || 'UNKNOWN');
    const ragContextText = ragContextBuilder.formatContextForAI(ragContext);

    let prompt = ragContextText;
    prompt += `\n\n=== CURRENT MARKET DATA ===\n`;
    marketData.forEach(md => {
      prompt += `- ${md.symbol}: $${md.price} (volume: ${md.volume || 'N/A'})\n`;
    });

    prompt += `\n=== PORTFOLIO STATE ===\n`;
    prompt += `- Cash: $${portfolioState.cash}\n`;
    prompt += `- Total Value: $${portfolioState.totalValue}\n`;
    prompt += `- Daily P&L: $${portfolioState.dailyPnL}\n`;
    prompt += `- Positions: ${Object.entries(portfolioState.positions).map(([s, q]) => `${s}: ${q}`).join(', ') || 'none'}\n`;

    if (userInfos.length > 0) {
      prompt += `\n=== USER-PROVIDED INFORMATION ===\n`;
      userInfos.forEach(ui => {
        prompt += `- [${new Date(ui.timestamp).toISOString()}] ${ui.content}\n`;
      });
    }

    if (memoryContext.length > 0) {
      prompt += `\n=== RECENT MEMORY ===\n`;
      memoryContext.slice(-5).forEach(mc => {
        prompt += `- [${mc.type}] ${mc.content}\n`;
      });
    }

    if (recentTrades.length > 0) {
      prompt += `\n=== RECENT TRADES ===\n`;
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
    let riskAssessment: 'low' | 'medium' | 'high' | undefined;
    let marketRegime: string | undefined;

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
      } else if (key.toUpperCase().includes('RISK_ASSESSMENT')) {
        if (value.includes('low')) riskAssessment = 'low';
        else if (value.includes('high')) riskAssessment = 'high';
        else if (value.includes('medium')) riskAssessment = 'medium';
      } else if (key.toUpperCase().includes('MARKET_REGIME')) {
        marketRegime = valueParts.join(':').trim();
      }
    }

    logger.info(`AI Response: ${recommendation.toUpperCase()} confidence=${confidence} risk=${riskAssessment || 'N/A'} regime=${marketRegime || 'N/A'}`);

    return {
      recommendation,
      confidence,
      reasoning,
      suggestedQuantity,
      stopLoss,
      takeProfit,
      riskAssessment,
      marketRegime,
    };
  }
}

export const aiAnalysisService = new AIAnalysisService();