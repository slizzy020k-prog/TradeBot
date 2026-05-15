# TradeBot - AI-Powered Trading Bot

## Project Overview

TradeBot is an intelligent trading system that analyzes market data, learns from historical trades, and makes informed trading decisions using AI. It supports both crypto and stock markets via Alpaca API.

**Key Capabilities:**
- Real-time market data fetching (Yahoo Finance)
- AI-powered trade recommendations (MiniMax/Anthropic)
- Learning from trade outcomes to improve decisions
- Risk management with position sizing and daily loss limits
- User information injection (news, tips, analysis)
- Memory system that tracks all trades and learnings

**Tech Stack:** TypeScript, Node.js, MiniMax API (primary), Alpaca API (trading)

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Build
npm run build

# Start trading (paper mode)
npm run cli start AAPL TSLA

# View help
npm run cli help
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         TradeBot                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ MarketData │  │   AI        │  │  TradingExecutor     │  │
│  │ Service    │  │   Analysis  │  │  Service             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Memory   │  │ RiskMgmt    │  │  UserInfoProcessor  │  │
│  │   Service  │  │   Service   │  │  Service             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── bot.ts                    # Main trading loop orchestrator
├── cli.ts                    # CLI interface for controlling the bot
├── config/
│   └── index.ts              # Configuration management (env vars)
├── services/
│   ├── aiAnalysis.ts         # AI integration (MiniMax/Anthropic)
│   ├── marketData.ts         # Market data fetching (Yahoo Finance)
│   ├── memory.ts             # Persistent memory & learning system
│   ├── riskManagement.ts     # Position sizing & loss limits
│   ├── tradingExecutor.ts    # Trade execution (Alpaca API)
│   └── userInfoProcessor.ts  # User info ingestion & relevance scoring
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    └── logger.ts             # Logging utility
```

---

## Services

### AI Analysis Service (`src/services/aiAnalysis.ts`)

**Purpose:** Makes trading recommendations based on market data, portfolio state, user info, and historical context.

**AI Providers:**
- `minimax` (default) - Uses MiniMax-M2.7 model via `https://api.minimaxi.com/v1/chat/completions`
- `anthropic` - Uses Claude 3.5 Sonnet via `@anthropic-ai/sdk`

**System Prompt:** Configured to act as an expert trading agent that considers:
1. Current market conditions and trends
2. User-provided information (news, tips, reports)
3. Past trading outcomes (what worked, what didn't)
4. Risk management principles

**Response Format:** AI must respond with:
```
RECOMMENDATION: buy/sell/hold
CONFIDENCE: 0-100
REASONING: explanation
QUANTITY: (optional) number of shares
STOP_LOSS: (optional) price
TAKE_PROFIT: (optional) price
```

### Market Data Service (`src/services/marketData.ts`)

**Purpose:** Fetches real-time and historical market data.

**Implementation:** Uses Yahoo Finance API (free, no API key required)
- Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- Caches quotes for 60 seconds to avoid rate limiting

**Key Methods:**
- `getQuote(symbol)` - Current price, volume, OHLC data
- `getQuotes(symbols[])` - Batch fetch for multiple symbols
- `getHistorical(symbol, interval, range)` - Historical data for pattern analysis

### Memory Service (`src/services/memory.ts`)

**Purpose:** Stores all trading context and learns from outcomes.

**Data Stored:**
- Trade history with outcomes (profit/loss)
- AI analysis results and recommendations
- User-provided information
- Market events

**Learning:** Tracks win/loss ratio from completed trades to inform future decisions.

**Persistence:** JSON file at `data/memory.json`

### Risk Management Service (`src/services/riskManagement.ts`)

**Purpose:** Enforces trading rules to prevent excessive losses.

**Checks:**
- `checkPositionSize()` - Limits total position value
- `checkDailyLossLimit()` - Stops trading if daily loss exceeds threshold
- `calculateStopLoss()` / `calculateTakeProfit()` - Risk/reward calculations

**Defaults:**
- Max position size: $1,000
- Max daily loss: $200

### Trading Executor Service (`src/services/tradingExecutor.ts`)

**Purpose:** Executes trades via Alpaca API.

**Modes:**
- Paper trading (default) - Real API, no real money
- Live trading - Real money, requires `TRADING_MODE=live`

**Key Methods:**
- `getPortfolioState()` - Current cash, positions, total value
- `submitOrder(symbol, side, quantity)` - Place a trade
- `getOrderStatus(orderId)` - Check order fill status
- `cancelOrder(orderId)` - Cancel pending order

### User Info Processor (`src/services/userInfoProcessor.ts`)

**Purpose:** Ingests user-provided information (news, tips, analysis) and scores relevance.

**Features:**
- Auto-scores relevance (0-100) based on keywords
- Positive keywords: bullish, buy, upgrade, positive, growth, opportunity
- Negative keywords: bearish, sell, downgrade, negative, risk, warning
- Auto-clears info older than 24 hours

---

## Configuration (`.env`)

```bash
# AI Provider (minimax or anthropic)
AI_PROVIDER=minimax

# MiniMax API Key (primary)
MINIMAX_API_KEY=sk-cp-...

# Anthropic API Key (alternate)
ANTHROPIC_API_KEY=sk-ant-...

# Alpaca API Keys (trading)
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...

# Trading Mode
TRADING_MODE=paper   # or 'live' for real money

# Timing
POLL_INTERVAL_MS=60000   # How often to check market (1 minute)

# Risk Limits
MAX_POSITION_SIZE=1000   # Max $ per trade
MAX_DAILY_LOSS=200       # Stop if daily loss exceeds this

# Data
DATA_DIR=./data
```

---

## CLI Commands

```bash
# Start bot watching symbols
npm run cli start AAPL TSLA BTC-USD

# Stop bot
npm run cli stop

# Check status
npm run cli status

# Add user information
npm run cli add-info "Breaking news: Apple announces new product"

# View memory/learning stats
npm run cli stats

# Help
npm run cli help
```

---

## Main Bot Loop (`src/bot.ts`)

The bot runs in a continuous loop:

1. **Fetch Market Data** - Get current prices for watched symbols
2. **Get Portfolio State** - Cash, positions, total value
3. **Build Context** - Recent trades, user info, memory context
4. **Query AI** - Get recommendation (buy/sell/hold) with confidence
5. **Apply Risk Rules** - Check position size, daily loss limits
6. **Execute Trade** - If recommendation is confident (>60%) and approved by risk management
7. **Log to Memory** - Store trade, analysis, outcome
8. **Wait** - Sleep for poll interval, then repeat

---

## Types (`src/types/index.ts`)

Key interfaces:

```typescript
interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
}

interface AIAnalysisResponse {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedQuantity?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'trade' | 'analysis' | 'user_info' | 'market_event';
  content: string;
  metadata?: Record<string, unknown>;
  outcome?: { tradeId: string; profitLoss: number; exitedAt: number };
}
```

---

## Development

```bash
# Build
npm run build

# Run in development
npm run dev

# Start CLI
npm run cli <command>
```

---

## Change Log

### 2026-05-15: Initial Setup
- Created TypeScript project structure
- Implemented all core services (market data, AI analysis, memory, risk management, trading executor, user info processor)
- Built CLI interface
- Configured for both MiniMax and Anthropic AI providers

### 2026-05-15: MiniMax Integration
- Added MiniMax API as primary AI provider
- MiniMax uses `https://api.minimaxi.com/v1/chat/completions` with model `MiniMax-M2.7`
- Configurable via `AI_PROVIDER` env var (values: `minimax` or `anthropic`)
- Added `miniMaxApiKey` to config system

---

## Notes for AI Agents

When making changes to this codebase:

1. **AI Service** - If changing AI provider logic, keep both MiniMax and Anthropic paths working. The `aiProvider` config field controls which is used.

2. **Memory System** - The memory service persists to `data/memory.json`. All trades and analyses are stored here. When adding new memory types, update the `MemoryEntry` interface.

3. **Risk Management** - Never remove the daily loss limit check. This is a critical safety feature.

4. **TypeScript** - Always run `npx tsc` before committing to verify no type errors.

5. **Environment** - Never commit `.env` files with real API keys. Use `.env.example` as template.

6. **Testing** - Always test with `TRADING_MODE=paper` before considering live trading.

---

## Security Considerations

- API keys stored in environment variables, never in code
- No hardcoded credentials in any source file
- All trades logged to memory for audit trail
- Risk management service enforces position and loss limits
- Paper trading mode available for safe testing