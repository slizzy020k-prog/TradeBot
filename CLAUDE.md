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
│                    Multi-Tier RAG System                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Trade Quality Evaluation Layer           │  │
│  │  - Risk-adjusted performance scoring                  │  │
│  │  - Trend alignment, volatility, liquidity scoring     │  │
│  │  - Expected value calculation                         │  │
│  │  - Strategy adherence evaluation                      │  │
│  └──────────────────────────────────────────────────────┘  │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌─────────────────┐       ┌─────────────────────────────┐  │
│  │   SQLite        │       │       Qdrant               │  │
│  │   (Structured)  │       │       (Vectors)            │  │
│  │                 │       │                            │  │
│  │ - Trades        │       │ - Trade summaries          │  │
│  │ - Parameters    │       │ - Semantic search          │  │
│  │ - Quality scores│       │ - Similar trade recall      │  │
│  │ - Outcomes      │       │ - Pattern matching          │  │
│  └─────────────────┘       └─────────────────────────────┘  │
│           │                           │                     │
│           └─────────────┬──────────────┘                     │
│                         ▼                                    │
│           ┌──────────────────────────────┐                   │
│           │    AI Context Building        │                   │
│           │    (Enhanced memoryContext)   │                   │
│           └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**Legacy Services:**
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
│   ├── aiAnalysis.ts         # AI integration (MiniMax/Anthropic) with RAG
│   ├── database.ts           # SQLite for structured trade records
│   ├── embeddings.ts         # MiniMax embeddings for vectorization
│   ├── marketData.ts         # Market data fetching (Yahoo Finance)
│   ├── memory.ts             # Persistent memory & learning system
│   ├── ragContext.ts         # RAG context builder from Qdrant/SQLite
│   ├── riskManagement.ts     # Position sizing & loss limits
│   ├── tradeEvaluator.ts     # AI-based trade quality scoring
│   ├── tradingExecutor.ts    # Trade execution (Alpaca API)
│   ├── userInfoProcessor.ts  # User info ingestion & relevance scoring
│   └── vectorStore.ts        # Qdrant vector store integration
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    └── logger.ts             # Logging utility
```

---

## Services

### Database Service (`src/services/database.ts`)

**Purpose:** SQLite-based structured storage for trade records, parameters, and learning logs.

**Schema:**
- `trades` - Trade records with quality scores, evaluations, and outcomes
- `trade_parameters` - Detailed scoring breakdown per trade
- `learning_log` - AI-generated learnings from trade analysis

**Key Methods:**
- `insertTrade(trade, parameters)` - Store trade with parameters
- `updateTradeEvaluation(tradeId, evaluation)` - Attach quality score
- `getGoodTrades(symbol, limit)` - Get top-rated trades (quality >= 65)
- `getBadTrades(symbol, limit)` - Get poorly-rated trades (quality < 65)
- `getAllTradesWithOutcome(limit)` - Get trades with completed evaluations

### Embeddings Service (`src/services/embeddings.ts`)

**Purpose:** Generates vector embeddings using MiniMax API for trade similarity search.

**Implementation:** Uses MiniMax `emb-01` model via `https://api.minimaxi.com/v1/embeddings`

**Key Methods:**
- `getEmbedding(text)` - Get vector for any text
- `getTradeSummaryEmbedding(trade, evaluation)` - Create embedding from trade summary
- `createTradeSummaryText(trade, evaluation)` - Formats trade as searchable text

### Vector Store Service (`src/services/vectorStore.ts`)

**Purpose:** Qdrant-based semantic search for finding similar past trades.

**Implementation:** Uses local Qdrant service (default `localhost:6333`)

**Key Methods:**
- `upsertTrade(tradeId, payload)` - Store trade vector with payload
- `searchSimilar(symbol, limit)` - Find similar trades by symbol
- `searchByQuality(good, symbol, limit)` - Find good or bad trades by quality

### Trade Evaluator Service (`src/services/tradeEvaluator.ts`)

**Purpose:** AI-based trade quality evaluation using weighted scoring factors.

**Scoring Factors (weighted):**
- `trendAlignment` (15%) - Does trade follow established trend?
- `volatilitySuitability` (15%) - Did volatility conditions match strategy?
- `liquidityQuality` (15%) - Was liquidity sufficient for position size?
- `momentumConfirmation` (15%) - Were momentum signals strong?
- `executionEfficiency` (10%) - How well did execution price compare to expected?
- `marketConditionCompatibility` (15%) - Did market regime suit this trade type?
- `riskToReward` (10%) - Risk/reward ratio
- `riskScore` (5%) - Overall risk assessment

**Output:**
- `qualityScore` (0-100) - Weighted composite
- `isGoodTrade` (boolean) - Based on threshold (default >= 65)

### RAG Context Builder (`src/services/ragContext.ts`)

**Purpose:** Builds enhanced context for AI by querying both SQLite and Qdrant.

**Key Methods:**
- `buildContext(symbol)` - Retrieves good trades, bad trades, similar trades, learned parameters
- `formatContextForAI(ragContext)` - Formats as prompt section for AI

**Output includes:**
- Good trades with scoring breakdown
- Bad trades with failure analysis
- Similar trades from vector search
- Learned parameters from historical analysis
- Summary statistics (total good/bad trades, average quality)

### AI Analysis Service (`src/services/aiAnalysis.ts`)

**Purpose:** Makes trading recommendations based on market data, portfolio state, user info, and historical context.

**AI Providers:**
- `minimax` (default) - Uses MiniMax-M2.7 model via `https://api.minimaxi.com/v1/chat/completions`
- `anthropic` - Uses Claude 3.5 Sonnet via `@anthropic-ai/sdk`

**RAG Integration:** Before each analysis, the service:
1. Builds RAG context from SQLite (good/bad trades) and Qdrant (similar trades)
2. Includes learned parameters in the prompt
3. Asks AI to prioritize trades matching successful patterns and avoid unsuccessful patterns

**System Prompt:** Configured to act as an expert trading agent that considers:
1. Current market conditions and trends
2. User-provided information (news, tips, reports)
3. Past trading outcomes (what worked, what didn't) - via RAG
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

# Qdrant Vector Store (local service)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=tradebot_trades

# Trade Quality Evaluation
QUALITY_THRESHOLD=65   # Score >= this = good trade
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
  parameters?: TradeParameters;
}

interface TradeParameters {
  riskScore?: number;
  riskToReward?: number;
  trendAlignment?: number;
  volatilityScore?: number;
  liquidityScore?: number;
  momentumConfirmation?: number;
  executionEfficiency?: number;
  marketConditionScore?: number;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  holdingPeriod?: number;
  drawdown?: number;
  profitLoss?: number;
}

interface TradeEvaluation {
  qualityScore: number;
  isGoodTrade: boolean;
  evaluationDetails: TradeParameters;
  profitLoss?: number;
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

### 2026-05-15: Multi-Tier RAG System
- Added SQLite database service (`src/services/database.ts`) for structured trade records
- Added MiniMax embeddings service (`src/services/embeddings.ts`) for vectorization
- Added Qdrant vector store service (`src/services/vectorStore.ts`) for semantic search
- Added trade evaluator service (`src/services/tradeEvaluator.ts`) for AI-based quality scoring
- Added RAG context builder (`src/services/ragContext.ts`) for enhanced AI context
- Trade quality evaluation based on 8 weighted factors: trend alignment (15%), volatility suitability (15%), liquidity quality (15%), momentum confirmation (15%), execution efficiency (10%), market condition compatibility (15%), risk/reward ratio (10%), risk score (5%)
- Quality threshold of 65 - trades >= 65 are marked as "good", below are "bad"
- AI analysis now uses RAG context to recall similar trades and learned parameters
- Added Qdrant configuration (QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION)
- Added QUALITY_THRESHOLD config for trade classification

### 2026-05-15: Documentation Update
- Updated CLAUDE.md with complete RAG system documentation
- Added architecture diagrams for both legacy services and new RAG system
- Documented all new services: database, embeddings, vectorStore, tradeEvaluator, ragContext
- Updated project structure to include new service files
- Added RAG-related configuration options to documentation

---

## Notes for AI Agents

When making changes to this codebase:

1. **AI Service** - If changing AI provider logic, keep both MiniMax and Anthropic paths working. The `aiProvider` config field controls which is used.

2. **Memory System** - The memory service persists to `data/memory.json`. All trades and analyses are stored here. When adding new memory types, update the `MemoryEntry` interface.

3. **Risk Management** - Never remove the daily loss limit check. This is a critical safety feature.

4. **RAG System** - The multi-tier RAG system uses SQLite and Qdrant. When modifying:
   - `database.ts` - SQLite operations for structured trade data
   - `vectorStore.ts` - Qdrant operations for semantic search
   - `ragContext.ts` - Builds AI context from both stores
   - Always run `npx tsc` before committing to verify no type errors

5. **Trade Evaluation** - Trade quality scoring uses 8 weighted factors. The `tradeEvaluator.ts` service should be updated if the scoring model changes. Quality threshold (default 65) is configurable via `QUALITY_THRESHOLD`.

6. **TypeScript** - Always run `npx tsc` before committing to verify no type errors.

7. **Environment** - Never commit `.env` files with real API keys. Use `.env.example` as template.

8. **Testing** - Always test with `TRADING_MODE=paper` before considering live trading.

9. **Qdrant** - Requires local Qdrant service running on `QDRANT_HOST:QDRANT_PORT`. Vector store is optional but enables semantic trade similarity search.

---

## Security Considerations

- API keys stored in environment variables, never in code
- No hardcoded credentials in any source file
- All trades logged to memory for audit trail
- Risk management service enforces position and loss limits
- Paper trading mode available for safe testing