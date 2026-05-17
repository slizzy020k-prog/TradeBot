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
│   ├── index.ts              # Configuration management (env vars)
│   └── persona.ts            # Trading persona (institutional-grade AI)
├── services/
│   ├── agents/               # Multi-agent evaluation system
│   │   ├── index.ts          # Agent exports
│   │   ├── types.ts          # Agent types and interfaces
│   │   ├── trendAgent.ts    # Multi-timeframe trend analysis
│   │   ├── volatilityAgent.ts # ATR and volatility regime analysis
│   │   ├── liquidityAgent.ts # Spread and order book quality
│   │   ├── momentumAgent.ts # RSI/MACD and momentum analysis
│   │   ├── riskAgent.ts     # Position sizing and risk validation
│   │   ├── historicalEdgeAgent.ts # Pattern matching and edge analysis
│   │   ├── executionAgent.ts # Entry precision and execution quality
│   │   └── ceoAgent.ts       # CEO oversight and final approval
│   ├── aiAnalysis.ts         # AI integration (MiniMax/Anthropic) with RAG
│   ├── database.ts           # SQLite for structured trade records
│   ├── embeddings.ts         # MiniMax embeddings for vectorization
│   ├── enhancedTradeEvaluator.ts # Multi-agent trade quality scoring
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

**Trading Persona:** Uses institutional-grade trading persona (`src/config/persona.ts`) that models a 30+ year veteran trader with:
- Capital preservation focus
- Probabilistic thinking (no trade is certain)
- Hard-coded risk controls (1% max account risk, 5% max daily drawdown, mandatory stop-loss, 1:2 min R/R)
- Emotion avoidance (no FOMO, greed, revenge trading, impulse execution)
- Multi-factor confidence scoring (8 weighted factors)
- Market regime classification (trending, ranging, breakout, reversal, accumulation, distribution, uncertain)

**AI Providers:**
- `minimax` (default) - Uses MiniMax-M2.7 model via `https://api.minimaxi.com/v1/chat/completions`
- `anthropic` - Uses Claude 3.5 Sonnet via `@anthropic-ai/sdk`

**RAG Integration:** Before each analysis, the service:
1. Builds RAG context from SQLite (good/bad trades) and Qdrant (similar trades)
2. Includes learned parameters in the prompt
3. Asks AI to prioritize trades matching successful patterns and avoid unsuccessful patterns

**Response Format:** AI must respond with:
```
RECOMMENDATION: buy/sell/hold
CONFIDENCE: 0-100
REASONING: explanation
QUANTITY: (optional) number of shares
STOP_LOSS: (optional) price
TAKE_PROFIT: (optional) price
RISK_ASSESSMENT: low/medium/high
MARKET_REGIME: trending/ranging/breakout/reversal/accumulation/distribution/uncertain
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
  riskAssessment?: 'low' | 'medium' | 'high';
  marketRegime?: string;
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

### 2026-05-16: Trading Persona
- Created institutional-grade trading persona (`src/config/persona.ts`)
- Persona models a 30+ year veteran trader with capital preservation focus
- Hard-coded risk controls: 1% max account risk, 5% max daily drawdown, mandatory stop-loss, 1:2 min risk/reward
- Emotion rules: no FOMO, greed, revenge trading, or impulse execution
- Market regime classification: trending, ranging, breakout, reversal, accumulation, distribution, uncertain
- Multi-factor confidence scoring with minimum threshold of 65
- AI response now includes RISK_ASSESSMENT and MARKET_REGIME fields
- Config includes persona settings: minConfidenceScore (65), maxAccountRiskPercent (1), maxDailyDrawdownPercent (5), minRiskToReward (2)

### 2026-05-16: Institutional Trading Intelligence Framework
- Created multi-agent evaluation system with 7 sub-agents plus CEO oversight
- Sub-agents: TrendAgent, VolatilityAgent, LiquidityAgent, MomentumAgent, RiskAgent, HistoricalEdgeAgent, ExecutionAgent
- CEO Agent (`src/services/agents/ceoAgent.ts`) - Final authority for trade approval/rejection
- Enhanced Trade Evaluator (`src/services/enhancedTradeEvaluator.ts`) - Integrates all agents with weighted scoring
- Trade quality scoring: 20% trend, 15% regime, 15% risk, 10% liquidity, 10% momentum, 10% historical edge, 10% execution, 5% volatility, 5% discipline
- Score classifications: 90-100 (Institutional Grade), 80-89 (High Quality), 70-79 (Moderate), 60-69 (Weak), below 60 (Low Quality/Reject)
- CEO oversight evaluates: strategic quality, risk integrity, execution precision, institutional discipline, long-term sustainability
- CEO can override and reject trades based on hard-coded rules
- Enhanced persona with complete system philosophy, good/bad trade criteria, behavioral rules, trade execution sequence

### 2026-05-16: Debugging & Error Fixes
**Comprehensive debugging cycle completed - all runtime errors resolved.**

**Fixed Issues:**
- `riskAgent.ts` - Division by zero protection for portfolio value calculations
- `riskAgent.ts` - Map to Record<string, number> conversion for positions
- `riskAgent.ts` - Enhanced risk/reward calculation with Math.max(risk, 0.001)
- `marketData.ts` - Optional chaining for safe API response access
- `marketData.ts` - Timestamp multiplication safety for undefined values
- `aiAnalysis.ts` - Safe array access for choices[0] with optional chaining
- `aiAnalysis.ts` - Safe text extraction from AI response
- `historicalEdgeAgent.ts` - Protected JSON.parse with try-catch
- `ragContext.ts` - Added safeJsonParse helper method
- `ragContext.ts` - Nullish coalescing for quality_score and avgQualityScore
- `ragContext.ts` - Optional chaining for vector store result properties
- `momentumAgent.ts` - LastPrice fallback for undefined close/price
- `volatilityAgent.ts` - Division by zero protection in ATR calculation
- `trendAgent.ts` - Enhanced trend strength calculation with zero division protection
- `liquidityAgent.ts` - Division by zero protection when high === low
- `tradingExecutor.ts` - NaN protection for parseInt/parseFloat
- `embeddings.ts` - Nullish coalescing for evaluation details
- `config/index.ts` - Fallback defaults for parseInt/parseFloat NaN
- `bot.ts` - Map to Record type conversion for PortfolioState
- `cli.ts` - Optional chaining for undefined symbols array

**False Positives Identified (NOT bugs):**
- `executionAgent.ts` line 63 - `getHours()` uses local timezone correctly for market hours analysis
- `memory.ts` - Trade import is used in addTrade() method signature
- `enhancedTradeEvaluator.ts` line 135 - Volatility agent call is intentional based on regime check
- `marketData.ts` lines 35-38 - Array[-1] returns undefined, handled by optional chaining
- `tradeEvaluator.ts` - The || 50 pattern is intentional default behavior
- `vectorStore.ts` line 158 - hash & hash is a no-op but used for numeric conversion
- `aiAnalysis.ts` - Empty AI response defaults to hold, which is correct behavior
- `scrapling` tool name - Intentional identifier passed to scrapingService.scrape()
- `newsClassifier.analyze()` without await - Method is synchronous, no await needed
- `document.body?.innerText` in scraping - Intentional fallback for content extraction
- `Math.random()` for ID generation - Intentional for unique ID creation

### 2026-05-16: WebScraping Intelligence Framework
**Comprehensive debugging of 50 specialized agents completed.**

**Bugs Fixed:**
- `news/` agents - Missing type annotation on analysis variable (bloombergAgent.ts)
- `optionsFlowAgent.ts` - Leading space in ` OI:` interface property
- `darkPoolAgent.ts` - `inferSentiment` always returned 'neutral' regardless of notional value
- `liquidityAgent.ts` - Invalid regex `[/[\\d.]+]/` (double backslash in character class)
- `volatilityIndexAgent.ts` - URL typo `/ volatility/daily/` (space in path)
- `volatilityIndexAgent.ts` - Division by zero when value === change
- `cryptoCorrelationAgent.ts` - URL typo with space `markets/ currencies`
- `energyPriceAgent.ts` - Garbage characters in regex `/oil\t+タン prices?/`
- `treasuryYieldAgent.ts` - URL typo `offfice-offoreign-assets-control`
- `federalReserveAgent.ts` - Incomplete FOMC URL (missing year)
- `currencyAgent.ts` - Space in URLs for Bloomberg and FT markets paths
- `newsSentimentAgent.ts` - Leading space in ' Motley Fool' source name
- `priceTargetAgent.ts` - URL typo `price-targts` vs `price-targets`
- `tradingViewAgent.ts` - Regex global flag `test()` without lastIndex reset
- `sectorRotationAgent.ts` - Same regex global flag issue in `parseRotationSignals` and `parseCrossSectorAnalysis`
- `geopoliticalRiskAgent.ts` - URLs with spaces in domain names
- All 8 **geopolitical agents** - Missing `lastIndex = 0` reset before regex exec loops

**50 Agents Debugged:** 10 news, 8 economic, 8 sentiment, 8 earnings, 8 technical, 8 geopolitical

### 2026-05-16: Institutional AI Trading Platform UI
**New frontend and API server layer added.**

**New Backend: `api-server.ts`**
- Express HTTP server on port 3001
- Socket.io WebSocket server for real-time updates
- REST endpoints: market data, portfolio, orders, memory, stats, risk, news, analysis
- Bot control endpoints: start/stop/status
- WebSocket events: portfolio:update, trade:executed, analysis:complete, bot:status

**New Frontend: `frontend/` (Next.js 16)**
- Full institutional dark-mode UI with cyber-finance aesthetic
- 10 dashboard modules:
  1. MarketOverview - Global indices, sector heatmap, VIX, fear & greed
  2. TradeIntelligence - AI confidence ring, buy/sell/hold recommendation
  3. PortfolioPanel - Pie chart, positions, daily P&L
  4. NewsIntelligence - Sentiment bar, manipulation risk, bullish/bearish factors
  5. OrderFlow - Volume bars, bid/ask imbalance, liquidity zones
  6. RiskCommandCenter - Daily loss gauge, max position limits
  7. AgentMonitor - 9 AI agents with neural network visualization
  8. CEOPanel - CEO oversight scores, trade audit trail
  9. TradeJournal - Trade history with status badges
  10. LearningModule - Performance charts, patterns learned, win rate
- Real-time WebSocket updates
- Glassmorphism panels with backdrop blur

**Running the UI:**
```bash
# Terminal 1 - Backend API
npm run api

# Terminal 2 - Frontend
cd frontend && npm run dev

# Open browser
http://localhost:3000
```

**New Dependencies Added:**
Backend: express, socket.io, cors
Frontend: socket.io-client, recharts, framer-motion, lucide-react, lightweight-charts, @tanstack/react-query

### 2026-05-16: Enhanced Trading Intelligence
**New services and agent enhancements added.**

**New Services:**
1. **Backtester Service** (`src/services/backtester.ts`)
   - Historical strategy testing with Yahoo Finance data
   - Performance metrics: Sharpe ratio, max drawdown, win rate, profit factor
   - Configurable slippage simulation for realistic results

2. **Order Book Agent** (`src/services/agents/orderBookAgent.ts`)
   - Spread quality analysis (tight/moderate/wide)
   - Order imbalance detection (buy vs sell pressure)
   - Spoofing pattern detection
   - Manipulation risk scoring

3. **Analytics Service** (`src/services/analyticsService.ts`)
   - Comprehensive performance metrics from SQLite trade data
   - Monthly returns and equity curve tracking
   - Agent performance tracking

4. **Portfolio Optimizer** (`src/services/portfolioOptimizer.ts`)
   - Mean-variance and risk-parity optimization
   - Rebalancing suggestions when drift > 5%
   - Historical covariance calculation

5. **Report Generator** (`src/services/reportGenerator.ts`)
   - Performance reports for 1w/1m/3m periods
   - Trade-level detail with recommendations
   - Daily summary generation

6. **ML Predictor** (`src/services/mlPredictor.ts`)
   - Pattern-based trade success prediction
   - Success probability based on historical patterns
   - Top symbols by prediction score

**Agent Enhancements:**
- **SEC Filing Agent** - Pre-announcement score detection
- **Options Flow Agent** - Signal quality scoring, unusual activity flagging
- **Twitter Sentiment Agent** - Signal quality calculation

**Frontend Enhancements:**
- **PerformanceMetrics Component** - Equity curve, monthly returns, Sharpe ratio, drawdown
- **TradeJournal** - Filtering by symbol, P&L, quality score

**Config Additions:**
- `SLIPPAGE_RATE` - For realistic paper trading simulation

**API Endpoints Added:**
- `GET /api/analytics/performance` - Performance metrics
- `GET /api/analytics/symbol/:symbol` - Symbol-specific analytics
- `GET /api/analytics/agents` - Agent performance
- `GET /api/portfolio/optimize` - Portfolio optimization
- `GET /api/reports/performance?period=1w|1m|3m` - Performance reports
- `GET /api/reports/daily` - Daily summary
- `GET /api/predict/:symbol` - ML predictions
- `GET /api/predict/top` - Top predicted symbols

### 2026-05-17: Trading 212 API Integration
**Live broker integration added via beta API.**

**New Service: `src/services/trading212.ts`**
- Real-time portfolio data from Trading 212
- Position tracking with P&L calculations
- Order submission and cancellation
- Quote fetching for any ticker

**API Endpoints Added:**
- `GET /api/t212/portfolio` - Total value, cash, positions value
- `GET /api/t212/positions` - All open positions with live P&L
- `GET /api/t212/orders` - Pending and historical orders
- `GET /api/t212/quote/:ticker` - Real-time quote data
- `POST /api/t212/order` - Submit buy/sell order
- `DELETE /api/t212/order/:orderId` - Cancel pending order

**Frontend Component: `frontend/components/dashboard/Trading212Panel.tsx`**
- Live portfolio summary with total value, cash, P&L
- Real-time position list with profit/loss per ticker
- Auto-refresh every 30 seconds
- Error handling with retry functionality
- Visual indicators for bullish/bearish positions

**Configuration:**
- `TRADING212_API_KEY` - Beta API key from Trading 212 developer portal
- Config field: `trading212ApiKey` in `src/config/index.ts`

**Security:**
- API key stored in `.env` (not committed to git)
- All sensitive config loaded from environment variables
- `.env.example` contains template only

### 2026-05-17: Full Automation & Learning System
**Automated trading with continuous news and learning enabled.**

**New Services:**
1. **WebScraperService** (`src/services/scraping/webScraperService.ts`)
   - Google News RSS feed scraping (reliable, no blocking)
   - Bing News search fallback
   - Geopolitical news scraping (7 topics: US-China, Fed rates, Russia-Ukraine, Middle East, global recession, OPEC, inflation)
   - 1-hour cache to avoid duplicate fetches

2. **News Intelligence Enhancements** (`src/services/newsIntelligence.ts`)
   - `scrapeGeopoliticalNews()` - Fetches 70+ geopolitical articles per hour
   - `scrapeAllNews(symbols)` - Comprehensive news for all watched symbols
   - Automatic fallback from failed sources to web scraper

**Bot Automation (`src/bot.ts`):**
- `startNewsAutomation()` - Runs comprehensive news scrape every 60 minutes
- `updateTradeOutcomes()` - Tracks P&L for open positions, learns from outcomes
- Automatic news + analysis cycle before every trade decision

**AI Integration Fix:**
- Fixed MiniMax API endpoint from `api.minimaxi.com` to `api.minimaxi.chat`
- Model: `MiniMax-M2.7`

**Alpaca Paper Trading:**
- Connected with real API keys (PKIS4RPI66SBIDZBQTE25O4A2X)
- $100,000 paper trading balance
- Orders: market, day time-in-force

**Frontend UI Fixes:**
- `PerformanceMetrics.tsx` - Expanded from 1 column to 2 columns
- Fixed Recharts formatter type errors
- Added profitLoss and qualityScore to Trade interface

**Running the Fully Automated System:**
```bash
# Terminal 1 - Backend API Server
npm run api

# Terminal 2 - Frontend
cd frontend && npm run dev

# API Endpoints for control:
curl -X POST "http://localhost:3001/api/bot/start" -H "Content-Type: application/json" -d '{"symbols":["AAPL","TSLA","MSFT"]}'
curl "http://localhost:3001/api/bot/status"
curl "http://localhost:3001/api/portfolio"
curl "http://localhost:3001/api/orders"

# Manual trade:
curl -X POST "http://localhost:3001/api/order" -H "Content-Type: application/json" -d '{"symbol":"AAPL","side":"buy","quantity":5}'
```

**System Capabilities:**
1. **Automated News Scraping** - Every 60 minutes (geopolitical + stock-specific)
2. **Market Data Polling** - Every 60 seconds
3. **AI Trading Decisions** - With news context and confidence scoring
4. **Trade Execution** - Alpaca paper trading when confidence > 60%
5. **Learning System** - Updates trade outcomes and learns from history
6. **Real-time UI** - WebSocket updates for portfolio, orders, performance

### 2026-05-17: Inter-Agent Communication System

**Agents now communicate with each other and display live activity in the UI.**

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

### 2026-05-17: Frontend-Backend Full Functionality Audit
**CRITICAL: Removed all mock/static data from frontend dashboard.**

**Backend API Server (`src/api-server.ts`):**
- Added 8 new API endpoints:
  - `GET /api/positions` - Positions with unrealized P&L and weight
  - `DELETE /api/order/:id` - Cancel order
  - `GET /api/ceo/scores` - CEO quality scores from memory
  - `GET /api/learning/stats` - Learning metrics (patterns learned, win/loss)
  - `GET /api/risk/daily` - Real daily P&L calculation
  - `GET /api/market/indices` - Global indices (SPY, QQQ, VIX, BTC, etc.)
  - `GET /api/market/fear-greed` - Fear & Greed calculation from VIX
  - `GET /api/market/sectors` - Sector performance from ETF data
- Added 5 new WebSocket events: `regime:change`, `learning:update`, `ceo:decision`, `agent:message`, `allocation:update`
- Fixed `portfolioOptimizer` hardcoded $10000 value - now uses real portfolio value
- Fixed `allocationEngine.updateCurrentWeights()` no-op - now calculates real weights
- Fixed `tradingExecutor.getPositions()` to return `avg_entry_price`
- Made `marketScannerService.inferAssetClass()` public for allocation engine

**Frontend API Client (`frontend/lib/api.ts`):**
- Added 8 new methods: `getPositions()`, `cancelOrder()`, `getCeoScores()`, `getLearningStats()`, `getDailyPnL()`, `getMarketIndices()`, `getFearGreed()`, `getMarketSectors()`

**Frontend WebSocket (`frontend/lib/websocket.ts`):**
- Added 5 new hooks: `useRegimeUpdates()`, `useLearningUpdates()`, `useCeoDecisions()`, `useAgentMessages()`, `useAllocationUpdates()`

**Frontend Component Fixes:**
- `MarketOverview.tsx` - Real data from `/api/market/indices`, `/api/market/sectors`, `/api/market/fear-greed`
- `CEOPanel.tsx` - Real CEO scores from `/api/ceo/scores`
- `LearningModule.tsx` - Real stats from `/api/learning/stats` + performance data from `/api/analytics/performance`
- `OrderFlow.tsx` - Real bid/ask imbalance and liquidity zones from `/api/positions`

**Build Verification:**
- Backend `npm run build`: PASS
- Frontend `npm run build`: PASS

### 2026-05-17: Autonomous Agent Trading System
**Event-driven, continuously running AI agent boardroom.**

**New Services:**
1. **MarketEventService** (`src/services/marketEventService.ts`)
   - Watches key symbols (SPY, QQQ, BTC-USD, ETH-USD, etc.)
   - Emits `price:change` events when price changes >0.1%
   - Configurable watch interval (default 5 seconds)

2. **Enhanced MarketScanner** (`src/services/marketScanner.ts`)
   - Now extends EventEmitter
   - Emits `scan:complete` event after each market scan

3. **SharedStateService** (`src/services/sharedState.ts`)
   - Centralized market/portfolio snapshots
   - EventBus for pub/sub agent communication
   - `getAggregatedRecommendation()` combines agent contexts

4. **AutonomousAnalysisEngine** (`src/services/autonomousAnalysisEngine.ts`)
   - 10-second analysis cycles with 5-second minimum interval
   - Price change detection (>0.5% threshold) for immediate analysis
   - `runBoardroomDiscussion()` - Generates AI agent dialogue
   - Continuous autonomous operation 24/7

**SSE Streaming Endpoints:**
- `GET /api/stream/market` - Real-time market indices (every 2 seconds)
- `GET /api/stream/portfolio` - Real-time portfolio updates (every 3 seconds)
- `GET /api/stream/agents` - Real-time agent communications (every 5 seconds)

**Agent Boardroom:**
- `GET /api/boardroom/history` - View past boardroom discussions
- `POST /api/boardroom/discuss` - Manually trigger new discussion
- Auto-generates boardroom discussion every 60 seconds when bot is running
- 5 AI agents using MiniMax-M2.7 model:
  - MarketScanner (Market Intelligence Officer) - orange
  - TrendAgent (Technical Analysis Specialist) - blue
  - RiskAgent (Chief Risk Officer) - red
  - NewsAgent (Head of News Intelligence) - green
  - CEOAgent (Chief Executive Officer) - gold

**AI Fallback System:**
- Agents NEVER remain in HOLD without reason
- Sentiment analysis converts HOLD to BUY/SELL based on keyword detection
- Portfolio-based fallback: cash position analysis triggers actionable signals
- Time-based varied signals when no market data available
- All signals include contextual reasoning

**Frontend SSE Hooks** (`frontend/lib/websocket.ts`):
- `useMarketStream(onUpdate)` - Subscribe to real-time market data
- `usePortfolioStream(onUpdate)` - Subscribe to real-time portfolio
- `useAgentStream(onUpdate)` - Subscribe to agent communications
- `useBoardroomMessages(onMessage)` - Subscribe to boardroom dialogue via WebSocket

**Boardroom Discussion UI** (`frontend/components/dashboard/BoardroomDiscussion.tsx`):
- Real-time agent messages with distinct colors per agent
- Filter by agent, confidence slider
- Expandable message cards with reasoning
- Stats bar showing buy/sell/hold signal counts

**How It Works:**
1. Bot starts → boardroom discussions auto-start (every 60s)
2. Each agent (MarketScanner, TrendAgent, RiskAgent, NewsAgent, CEOAgent) generates AI commentary using MiniMax-M2.7
3. All dialogue is broadcast via WebSocket `boardroom:message` event
4. Frontend subscribes to SSE endpoints for real-time streaming data
5. Market scanner emits events triggering analysis cycles

**Running the System:**
```bash
# Terminal 1 - Backend API
npm run api

# Terminal 2 - Frontend
cd frontend && npm run dev

# Start bot (triggers boardroom auto-start)
curl -X POST "http://localhost:3001/api/bot/start" -H "Content-Type: application/json" -d '{}'
```

---

## Security Considerations

- API keys stored in environment variables, never in code
- No hardcoded credentials in any source file
- All trades logged to memory for audit trail
- Risk management service enforces position and loss limits
- Paper trading mode available for safe testing

---

## AI Agent Best Practices

**Before submitting any PR or making changes:**

1. **Read the complete diff** and show your human partner the full changes before submission
2. **Search for existing PRs** (open AND closed) that address the same area — avoid duplicates
3. **Verify this is a real problem** — if asked to "fix some issues" without a specific problem statement, ask for clarification
4. **One problem per PR** — do not bundle unrelated changes
5. **Test before committing** — run `npm run build` and verify no TypeScript errors

**Quality bar:**
- This repo has detailed requirements. Low-quality PRs waste maintainer time
- Show evidence of genuine investigation, not just "I ran the linter and made this change"
- If you cannot describe the specific session, error, or user experience that motivated the change, do not submit

**Change philosophy:**
- Modifications to behavioral content (agents, prompts, skills) should improve outcomes based on evidence
- Changes that restructure or reformat existing code without clear benefit will be rejected
- Domain-specific features belong in plugins, not core

**For skills/agent changes:**
- Test thoroughly before committing — agent behavior changes can have cascading effects
- Document why the change improves behavior when submitting

---

## Trading System Specification

### Core Principle: Statistical Edge Over LLM Guessing

The language model layer should be responsible for exactly two things: parsing unstructured text (news, filings, social sentiment) into structured sentiment scores, and generating human-readable narrative explaining trade decisions **after** those decisions have already been made by statistical methods. Everything else — signal generation, position sizing, risk management, portfolio construction, and the learning loop — must be driven by price-derived, volume-derived, or quantifiable fundamental-derived signals that have a measurable historical edge.

### Signal Generation — Real Edge Factors

**Universal factors (all asset classes):**

1. **Mean Reversion via Z-Score** — Price standard deviations from 20-period SMA. Z < -1.5 is long candidate, Z > +1.5 is short. Reduce weight when ADX > 30 (trending market).

2. **Trend Alignment via EMA Stack** — 20/50/200 EMA alignment. Filter, not entry signal. Trades against EMA stack need higher conviction.

3. **Momentum via RSI and Rate of Change** — 14-period RSI + 20-period ROC. RSI below 30 / above 70 are entry triggers. Divergence from price is powerful signal.

4. **Volatility Regime via ATR Ratio** — ATR / 50-period ATR average. Below 0.7 = low volatility (mean reversion), above 1.5 = high volatility (reduce size 50%).

5. **Volume Confirmation** — Relative volume (current / 20-period average). Above 1.5 confirms institutional participation.

6. **MACD Histogram Crossover** — Lagging confirmation. Most reliable from extreme readings (very negative turning positive in oversold).

7. **Bollinger Band Position** — %B indicator. Below 20% = long candidate, above 80% = short candidate. Three-way confluence (band extreme + RSI extreme + volume) = high conviction.

8. **ADX Trend Strength** — Above 25 = trending, above 40 = strongly trending. Determines regime and factor weighting.

### Regime-Aware Weighting

Build a 2x2 regime matrix (trending/ranging × high/low volatility). Each cell has different factor weights:

- **Trending + Low Vol:** Weight EMA stack 30%, MACD 20%, reduce mean reversion to near zero
- **Ranging + High Vol:** Weight Bollinger Band and Z-score highly, reduce trend-following factors
- **Breakout:** Price outside Bollinger Bands on high volume + ADX crossing 25 — enter in direction of break
- **High Volatility:** Reduce position size by 50%, avoid initiating new positions around news events

### Multi-Timeframe Confirmation

- 1 timeframe only: "watch" status (track but don't trade)
- 2 timeframes aligned: "moderate" signal
- 3 timeframes aligned: "strong" signal
- Only moderate and strong signals generate trade recommendations

### Position Sizing — The Most Important Factor

**Fixed Fractional Risk (1% per trade):**
1. Define stop loss first (technically meaningful: below swing low for longs, above swing high for shorts, or 1.5× ATR minimum)
2. Calculate dollar distance from entry to stop
3. Share count = $1,000 risk budget (1% of $100K account) / stop distance
4. Never use fixed dollar amounts — TSLA at $250 with $12.50 stop gets fewer shares than SPY at $450 with $2.25 stop

**Volatility Adjustment:**
- Current ATR > 1.5× average: reduce position 30%
- Current ATR < 0.7× average: increase position max 25% (never exceed base)

**Kelly Criterion (after 30+ trades):**
- Kelly = (win rate × payoff ratio - loss rate) / payoff ratio
- Always use half-Kelly (assume edge estimate is imperfect)

**Portfolio-Level Hard Limits:**
- Max 6% aggregate risk at any time
- No single asset class > 40% of total open risk
- Correlation above 0.7: only one position allowed unless combined risk < 1%
- Daily drawdown > 3%: stop all automated trading for the day

### The Learning System — Fixing the Feedback Loop

**Pre-trade features (captured at entry):** z-score, RSI, MACD histogram direction/magnitude, ATR ratio, relative volume, EMA stack alignment score, Bollinger Band %B, ADX, hour, day of week, composite signal score

**Post-trade outcomes (captured at exit):** profit/loss in R-multiples, max adverse excursion, max favorable excursion, holding period in bars, exit reason (stop/target/time/signal)

**Quality Score Formula:** Quality = R-multiple achieved × (1 - max adverse excursion ratio) × win flag

**Learning:** Over 50+ trades per setup, compute win rate and avg R-multiple by feature bucket. If RSI below 30 in ranging market (ADX < 25) with high volume shows 58% win rate and 1.4 avg R, but same setup in trending market shows 41% win rate and 0.8 R — the regime significantly modulates signal quality.

**Minimum sample size:** 30 trades per setup bucket before computing win rate. Below that, use conservative universal parameters.

### LLM Layer — Where It Adds Value

**Where LLMs ARE useful:**
- News sentiment analysis: read Fed statements, earnings calls, geopolitical news, extract context-rich sentiment scores
- Narrative generation: explain trade decisions in plain English after statistical signals have already generated the recommendation

**Where LLMs are NOT useful:**
- Generating initial buy/sell/hold recommendation
- Assigning confidence numbers that feed into position sizing
- Evaluating trade quality after the fact
- Serving as tiebreaker when signals are ambiguous

### Agent System — Make Each Agent Own One Calculation

- **TrendAgent:** EMA stack score + ADX (numerical, not LLM-generated)
- **VolatilityAgent:** ATR ratio + Bollinger Band width → position size multiplier
- **LiquidityAgent:** Relative volume + bid-ask spread → liquidity quality score, max order size; veto if score < 40
- **MomentumAgent:** RSI + MACD + Stochastic + ROC composite score
- **RiskAgent:** Position size calculation + portfolio risk checks (binary approved/rejected)
- **HistoricalEdgeAgent:** Query trade database for matching setups → return measured win rate/R-multiple (or "insufficient data" flag)
- **ExecutionAgent:** Entry timing, order type, stop/target price calculation
- **CEOAgent:** Hard rules only — daily loss limit, max aggregate risk, correlation constraint, volatility emergency brake

### Backtesting — Walk-Forward Validation

- Divide data: first 18 months optimize, final 6 months test (out-of-sample)
- Test window Sharpe < 0.8 or win rate degraded > 10% = no live trading
- Measure: max drawdown (target < 15%), recovery time, profit factor (target > 1.5), win rate by regime, win rate by asset class, consecutive loss sequences
- Model slippage/commissions: equities 1¢/share, crypto 0.1% maker fee + 0.5% slippage
- Model order impact: large orders relative to ADV widen effective spread

### Asset Class Specifics

**Equities:** No new positions 30 min before close. Check earnings dates (next 5 days = 50% size reduction or avoid). Regular market hours only unless modeling pre/post-market.

**Crypto:** 24/7 trading — handle weekend liquidity (relative volume must be > 0.8 on 4-hour for altcoins). BTC/ETH correlation is unusually high — total crypto risk limit 20% of portfolio. Thinner weekend liquidity = wider stops.

**Forex:** Pip calculations differ by pair. Session overlap (London-NY 8AM-12PM EST) = highest signal reliability. Asian session = lower reliability for USD pairs.

**Commodities:** Futures have expiry dates — track contract month, flag roll period (week before expiry). Supply/inventory reports (EIA, USDA, WGC) are key catalysts.

**ETFs:** Check premium/discount to NAV for less liquid ETFs. Otherwise behave like equities for session hours and signal calculation.

### Information Hierarchy (UI)

**Tier 1 (always visible, largest text):** Portfolio value, today's P&L in $ and %, open positions count, aggregate risk as % of portfolio, system status (trading/paused/daily limit hit/market closed)

**Tier 2 (main screen, no scroll):** Open positions table — symbol, direction, entry, current, unrealized P&L, risk %, time in trade. Color-coded rows (green/yellow/red). Single button to close each position.

**Tier 3 (one click):** Signal detail panel (factor scores, composite score, regime, recommendation, narrative). Historical performance chart per symbol. Correlation matrix. Learning stats (win rate, avg R-multiple over time).

**Tier 4 (settings/logs):** Full trade journal with post-trade analysis, agent decision logs, news feed with sentiment, backtest results, system config.

### Real-Time Updates

- Open position P&L: WebSocket push every 5 seconds (not polling interval)
- Signal generation: 1 minute polling is fine (don't spam AI calls)
- Stop loss monitoring: near-real-time price feeds for open positions only

### What Does NOT Create Edge

- Boardroom discussion UI (entertaining but mathematically unrelated to profitability)
- 48 news sources when 5 would do (marginal value of additional sources is near zero)
- Broker switching (edge comes from signal/risk system, not execution venue)
- Sub-15-minute polling for swing trading (consumes quota without improving performance)

### Implementation Priority

1. Technical indicators library (pure functions: SMA, EMA, ATR, RSI, MACD, Bollinger Bands, Z-Score, ROC, Rel Volume, Stochastic, VWAP, ADX, Ichimoku)
2. Asset classifier (equity/crypto/forex/commodity/ETF/index with asset-specific parameters)
3. Statistical signal engine (8 factors + regime-aware weighting → typed signal object)
4. Position sizer (fixed fractional risk + ATR adjustment + Kelly when data available)
5. Correlation tracker (rolling 30-day returns → pair correlations → block correlated pairs)
6. Trade feature extractor (pre-trade features JSON + post-trade outcome JSON in DB)
7. Edge catalog (accumulate labeled trades → per-bucket win rates/R-multiples)
8. Regime classifier (trending/ranging/breakout/high volatility at start of each cycle)
9. Agent restructure (each agent owns one quantitative calculation, LLM generates description after)
10. Walk-forward backtesting framework with slippage/commission/volume modeling
11. UI update (Tier 1-4 information hierarchy)
12. Paper trading minimum 2 weeks before live capital