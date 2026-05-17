# TradeBot Pro

An institutional-grade AI-powered trading system that autonomously analyzes markets, communicates across 8 specialized AI agents, and executes trades via Alpaca paper trading.

## Current Status

**Market Status: CLOSED** — Trading runs on NYSE hours (9:30 AM - 4:00 PM ET, Monday-Friday). Orders queue when market is closed and fill when market opens.

**Paper Trading Balance: $100,000** — Real-time Alpaca paper trading with live market data.

---

## Features

### Multi-Agent Trading Intelligence

**8 AI Agents communicating in real-time:**

| Agent | Role |
|-------|------|
| TrendAgent | Multi-timeframe trend analysis |
| VolatilityAgent | ATR and regime detection |
| LiquidityAgent | Spread and order book quality |
| MomentumAgent | RSI/MACD and momentum signals |
| RiskAgent | Position sizing validation |
| HistoricalEdgeAgent | Pattern matching and recall |
| ExecutionAgent | Entry precision analysis |
| CEOAgent | Final trade approval/rejection |

Each agent broadcasts its analysis and findings to all other agents, creating a collaborative decision-making process visible in real-time through the AgentMonitor dashboard panel.

### Automated Trading Loop

Every tick (60 seconds by default):

1. **Market Data** — Fetches live quotes for 23 symbols
2. **News Scraping** — Google News RSS for all watched symbols (every 15 minutes)
3. **Yahoo Finance Scraping** — Detailed quote data for all symbols (every 15 minutes)
4. **Multi-Agent Evaluation** — All 8 agents analyze the primary symbol
5. **AI Analysis** — MiniMax AI provides trade recommendation with confidence score
6. **Trade Execution** — If combined confidence > 50% and recommendation isn't HOLD, a market order is submitted

### Watched Symbols (23)

**Tech:** AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA  
**Financials:** BRK-B, JPM, V  
**Healthcare:** JNJ  
**Consumer:** PG, KO, PEP  
**Telecom:** VZ, T  
**Energy:** XOM, CVX, COP, SLB  
**Crypto:** BTC-USD, ETH-USD, SOL-USD

### Fundamental Data

MarketData includes dividendRate, dividendYield, marketCap, peRatio, eps, fiftyTwoWeekHigh/Low — allowing the AI to factor in income investing (high-yield dividends like VZ, T, KO) vs growth investing (TSLA, NVDA).

### News Intelligence

- **Geopolitical News** — Scraped every 15 minutes from Google News RSS
- **Per-Symbol News** — 10 articles per symbol with sentiment analysis
- **Manipulation Risk Detection** — News intelligence can block trades if manipulation risk > 50%

### Real-Time Dashboard

WebSocket-connected frontend at `http://localhost:3000` showing:

- Market Overview (indices, VIX, fear/greed)
- Trade Intelligence (AI confidence ring, recommendation)
- Portfolio Panel (positions, daily P&L)
- News Intelligence (sentiment, manipulation risk)
- Order Flow (volume bars, bid/ask imbalance)
- Risk Command Center (daily loss gauge)
- **AgentMonitor** (live agent communications — the key feature)
- CEO Panel, Trade Journal, Learning Module, Performance Metrics

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys:
#   MINIMAX_API_KEY - for AI analysis
#   ALPACA_API_KEY / ALPACA_SECRET_KEY - from https://app.alpaca.markets
```

### 3. Build

```bash
npm run build
```

### 4. Start Backend API Server

```bash
npm run api
# Runs on http://localhost:3001
```

### 5. Start Frontend (separate terminal)

```bash
cd frontend && npm run dev
# Opens http://localhost:3000
```

### 6. Start Trading Bot

```bash
# Via API
curl -X POST "http://localhost:3001/api/bot/start" \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","TSLA","MSFT","NVDA","GOOGL"]}'

# Or via CLI
npm run cli start AAPL TSLA MSFT NVDA GOOGL
```

### 7. Monitor in Browser

Open `http://localhost:3000` and watch the **AgentMonitor** panel — you'll see all 8 agents communicating their analysis in real-time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                     │
│  localhost:3000 — Real-time WebSocket dashboard            │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket / HTTP
┌─────────────────────────────────────────────────────────────┐
│                    API Server (Express)                      │
│  localhost:3001 — REST + Socket.io                         │
│  - /api/bot/start|stop|status — Bot control                 │
│  - /api/market/:symbols — Yahoo Finance data                │
│  - /api/portfolio — Alpaca positions                        │
│  - /api/agent/comm — Live agent messages                   │
│  - /api/news/:symbol — News intelligence                    │
│  - /api/orders — Order management                          │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      TradeBot Core                          │
│  - Multi-agent evaluation (8 agents)                       │
│  - AI analysis (MiniMax) with RAG context                 │
│  - News intelligence (Google News RSS)                     │
│  - Risk management (position sizing, daily loss limits)    │
│  - Memory & learning (SQLite + Qdrant)                     │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  - Alpaca Paper Trading API (real orders, simulated fill)  │
│  - Yahoo Finance (market data)                               │
│  - MiniMax AI (trade recommendations)                       │
│  - Google News RSS (news scraping)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables (.env)

```bash
# AI Provider — 'minimax' (default) or 'anthropic'
AI_PROVIDER=minimax

# MiniMax API Key — Primary AI analysis
MINIMAX_API_KEY=sk-cp-...

# Anthropic API Key — Alternate AI provider
ANTHROPIC_API_KEY=sk-ant-...

# Alpaca API Keys — From https://app.alpaca.markets
ALPACA_API_KEY=PKV3L4VHQZUQIRITDF5OHIGLAS
ALPACA_SECRET_KEY=FUBieKcVZA8oZMDuJbrPkZJNnpHu2Pimb8ziTYvp23ff

# Trading Mode — 'paper' (default) or 'live'
TRADING_MODE=paper

# Polling Interval — How often to run tick (ms)
POLL_INTERVAL_MS=60000

# Risk Limits
MAX_POSITION_SIZE=1000    # Max $ per trade
MAX_DAILY_LOSS=200        # Stop if daily loss exceeds this

# Quality Threshold — Minimum score for "good" trade
QUALITY_THRESHOLD=65

# Slippage Rate — For paper trading simulation
SLIPPAGE_RATE=0.0005
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bot/start` | POST | Start trading bot with symbols |
| `/api/bot/stop` | POST | Stop the trading bot |
| `/api/bot/status` | GET | Check if bot is running |
| `/api/market/:symbols` | GET | Fetch quotes from Yahoo Finance |
| `/api/portfolio` | GET | Alpaca portfolio state |
| `/api/orders` | GET | All orders (pending + filled) |
| `/api/order` | POST | Submit a trade order |
| `/api/agent/comm` | GET | Live agent messages & decisions |
| `/api/news/:symbol` | GET | News intelligence for symbol |
| `/api/stats` | GET | Memory & learning stats |
| `/api/risk` | GET | Risk management status |

---

## How the Agent Communication Works

Every tick, the bot runs a multi-agent evaluation cycle:

1. **MarketDataAgent** broadcasts: "Market data updated: N symbols"
2. **NewsAgent** broadcasts sentiment for each symbol
3. **System** announces: "Starting multi-agent evaluation for [SYMBOL]"
4. **TrendAgent** broadcasts its score and directional bias
5. **VolatilityAgent** broadcasts ATR regime and score
6. **LiquidityAgent** broadcasts spread quality and score
7. **MomentumAgent** broadcasts RSI, MACD, and score
8. **RiskAgent** broadcasts position validation and score
9. **HistoricalEdgeAgent** broadcasts pattern matches and score
10. **ExecutionAgent** broadcasts execution quality score
11. **CEOAgent** broadcasts final recommendation: BUY/SELL/HOLD with confidence

The **AgentMonitor** dashboard panel displays all these messages in real-time with message type icons (analysis, recommendation, warning, approval, rejection).

---

## Market Hours & Trading

**NYSE Trading Hours:** 9:30 AM - 4:00 PM ET, Monday-Friday

**What happens when the market is closed:**

- Bot continues to run and analyze
- Orders are submitted with `status: accepted` but don't fill
- When market opens, queued orders fill in sequence

**Paper Trading Note:** Alpaca paper trading simulates real market conditions. Orders may not fill instantly even during market hours if there's low liquidity or price gaps.

---

## Troubleshooting

**Bot not trading?**

1. Check market is open: `curl http://localhost:3001/api/bot/status`
2. Check agent messages: `curl http://localhost:3001/api/agent/comm`
3. Check confidence scores — combined AI + CEO must be > 50%

**Orders not filling?**

- Market may be closed (check `/api/clock`)
- Try a limit order instead of market order

**AgentMonitor empty?**

- Refresh the frontend
- Check WebSocket connection in browser console
- Verify API server is running on port 3001

---

## Tech Stack

- **Backend:** TypeScript, Node.js, Express, Socket.io
- **Frontend:** Next.js 16, React, Recharts, Framer Motion, Lucide icons
- **AI:** MiniMax M2.7 (primary), Anthropic Claude (alternate)
- **Data:** Yahoo Finance, Google News RSS
- **Trading:** Alpaca Paper Trading API
- **Database:** SQLite + Qdrant vector store
- **Agents:** 8 sub-agents + CEO oversight + 5 boardroom agents

---

## Autonomous Agent Boardroom

The system features a **live boardroom discussion** where 5 AI agents continuously communicate:

| Agent | Color | Role |
|-------|-------|------|
| MarketScanner | Orange | Market Intelligence Officer |
| TrendAgent | Blue | Technical Analysis Specialist |
| RiskAgent | Red | Chief Risk Officer |
| NewsAgent | Green | Head of News Intelligence |
| CEOAgent | Gold | Chief Executive Officer |

**Key Features:**
- Agents NEVER output generic HOLD — all signals have contextual reasoning
- Sentiment analysis converts HOLD to BUY/SELL based on keyword detection
- Portfolio-based fallback when AI returns generic responses
- Time-based signal variation for continuous market engagement
- Boardroom auto-generates every 60 seconds when bot is running

**View Boardroom:**
1. Open `http://localhost:3000` in browser
2. Scroll to "Boardroom Discussion" panel (bottom center)
3. Watch live agent dialogue with color-coded messages

---

## Project Structure

```
TradeBot/
├── src/
│   ├── bot.ts              # Main trading loop orchestrator
│   ├── api-server.ts       # Express HTTP + WebSocket server
│   ├── cli.ts              # CLI interface
│   ├── config/
│   │   ├── index.ts        # Environment configuration
│   │   └── persona.ts     # Institutional trading persona
│   ├── services/
│   │   ├── agents/         # Multi-agent evaluation
│   │   │   ├── trendAgent.ts
│   │   │   ├── volatilityAgent.ts
│   │   │   ├── liquidityAgent.ts
│   │   │   ├── momentumAgent.ts
│   │   │   ├── riskAgent.ts
│   │   │   ├── historicalEdgeAgent.ts
│   │   │   ├── executionAgent.ts
│   │   │   └── ceoAgent.ts
│   │   ├── agentCommunication.ts  # Inter-agent messaging
│   │   ├── aiAnalysis.ts           # AI integration with RAG
│   │   ├── autonomousAnalysisEngine.ts # 24/7 autonomous analysis
│   │   ├── sharedState.ts          # Shared state + EventBus
│   │   ├── marketEventService.ts   # Price change detection
│   │   ├── marketScanner.ts       # Enhanced scanner with events
│   │   ├── marketData.ts          # Yahoo Finance data
│   │   ├── tradingExecutor.ts     # Alpaca API
│   │   ├── newsIntelligence.ts    # Google News scraping
│   │   ├── memory.ts              # Persistent memory
│   │   ├── riskManagement.ts     # Position sizing
│   │   └── database.ts            # SQLite
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── frontend/
│   ├── app/
│   │   └── page.tsx               # Main dashboard
│   └── components/
│       └── dashboard/
│           ├── AgentMonitor.tsx   # Live agent feed
│           ├── BoardroomDiscussion.tsx # Live agent boardroom
│           ├── MarketOverview.tsx
│           ├── TradeIntelligence.tsx
│           ├── PortfolioPanel.tsx
│           └── ... (12 total panels)
└── data/
    └── memory.json               # Persistent memory
```