# TradeBot - Institutional AI Trading Platform

## Dependencies

### Backend (Node.js/TypeScript)

**Core Dependencies:**
- `express` ^4.21.0 - HTTP server
- `socket.io` ^4.8.0 - WebSocket server
- `cors` ^2.8.5 - Cross-origin resource sharing
- `axios` ^1.16.1 - HTTP client
- `better-sqlite3` ^12.10.0 - SQLite database
- `dotenv` ^17.4.2 - Environment variables
- `ts-node` ^10.9.2 - TypeScript execution
- `typescript` ^6.0.3 - TypeScript compiler
- `@anthropic-ai/sdk` ^0.96.0 - Anthropic AI
- `@qdrant/js-client-rest` ^1.18.0 - Vector database client

**Type Definitions:**
- `@types/cors` ^2.8.17
- `@types/express` ^5.0.0
- `@types/node` ^25.8.0
- `@types/better-sqlite3` ^7.6.13

**Dev Dependencies:**
- `@playwright/test` ^1.60.0
- `playwright` ^1.60.0

**Backend Installation:**
```bash
npm install
npm run build
```

**Run Backend:**
```bash
npm run api     # Starts API server on port 3001
npm run dev    # Builds and runs in dev mode
```

---

### Frontend (Next.js 16)

**Core Dependencies:**
- `next` ^16.2.6 - React framework
- `react` ^19.0.0 - UI library
- `react-dom` ^19.0.0 - React DOM
- `socket.io-client` - WebSocket client
- `recharts` - Charts library
- `framer-motion` - Animations
- `lucide-react` - Icons
- `lightweight-charts` - TradingView charts
- `@tanstack/react-query` - Data fetching

**Frontend Installation:**
```bash
cd frontend
npm install
```

**Run Frontend:**
```bash
npm run dev     # Starts Next.js on port 3000
npm run build   # Production build
```

---

### External Services (Required)

**AI Providers (one required):**
- MiniMax API key (`MINIMAX_API_KEY`) - Primary
- Anthropic API key (`ANTHROPIC_API_KEY`) - Alternate

**Trading Platform:**
- Alpaca API (`ALPACA_API_KEY`, `ALPACA_SECRET_KEY`) - Paper or live trading

**Vector Database (optional):**
- Qdrant (`QDRANT_HOST`, `QDRANT_PORT`) - For semantic search

---

### Environment Variables

Create a `.env` file in the root directory:

```bash
# AI Provider
AI_PROVIDER=minimax
MINIMAX_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Alpaca Trading
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_key_here
TRADING_MODE=paper

# Timing
POLL_INTERVAL_MS=60000

# Risk Limits
MAX_POSITION_SIZE=1000
MAX_DAILY_LOSS=200

# Data
DATA_DIR=./data

# Qdrant Vector Store
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=tradebot_trades

# Trade Quality
QUALITY_THRESHOLD=65

# API Server
API_PORT=3001
```

Create a `.env.local` file in `frontend/`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### Running the Application

**1. Start Backend (Terminal 1):**
```bash
cd c:\Users\Conan\Downloads\TradeBot-master
npm run api
```

**2. Start Frontend (Terminal 2):**
```bash
cd c:\Users\Conan\Downloads\TradeBot-master\frontend
npm run dev
```

**3. Open Browser:**
```
http://localhost:3000
```

---

### Quick Start Commands

```bash
# Install all dependencies
npm install && cd frontend && npm install && cd ..

# Build TypeScript
npm run build

# Start API server only
npm run api

# Start frontend only
cd frontend && npm run dev

# Run CLI
npm run cli start AAPL TSLA
npm run cli stop
npm run cli status
npm run cli stats
```

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  (localhost:3000) - 14 dashboard modules                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket + REST + SSE
                               │ (localhost:3001)
┌──────────────────────────────▼──────────────────────────────┐
│                    API Server Layer                          │
│  Express + Socket.io - Bridges frontend to TradeBot services│
│  - REST endpoints for market/portfolio/orders/stats        │
│  - WebSocket for real-time boardroom messages              │
│  - SSE streams for market/portfolio/agent data             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    TradeBot Backend                         │
│  marketDataService, tradingExecutorService, aiAnalysis     │
│  memoryService, riskManagementService, newsIntelligence   │
│  autonomousAnalysisEngine - 24/7 continuous operation     │
│  sharedState + EventBus - Centralized agent communication  │
└─────────────────────────────────────────────────────────────┘
```

---

### Key Features

1. **Autonomous 24/7 Operation**
   - Continuous analysis cycles every 10 seconds
   - Price change detection triggers immediate analysis
   - No human intervention required

2. **Agent Boardroom**
   - 5 AI agents generating live commentary
   - Color-coded messages (MarketScanner=orange, TrendAgent=blue, etc.)
   - Never outputs generic HOLD — all signals have reasoning

3. **AI Fallback System**
   - Sentiment analysis converts HOLD to actionable signals
   - Portfolio-based fallback when AI returns generic responses
   - Time-based signal variation for engagement

4. **Real-Time Dashboard**
   - BoardroomDiscussion panel with live agent dialogue
   - Agent filtering and confidence slider
   - WebSocket + SSE for instant updates