# SuperFx-Agent

An AI-powered multi-agent forex trading system that connects multiple large language models to MetaTrader 5 for autonomous trade analysis and execution. A team of four specialized AI agents debates every trade decision before anything is sent to the market.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  Trading Desk UI · Live Positions · Agent Timeline      │
└────────────────────────┬────────────────────────────────┘
                         │ REST / SSE
┌────────────────────────▼────────────────────────────────┐
│                  FastAPI Backend (api-v1)                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Multi-Agent Orchestrator            │   │
│  │                                                  │   │
│  │  [Analyst] → [Strategist] → [Risk Mgr] → [Lead] │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│  ┌──────────┐  ┌────────▼────────┐  ┌───────────────┐  │
│  │  LLM     │  │  Trade Executor │  │  Prop Firm    │  │
│  │  Engine  │  │  (Orders/Mgmt)  │  │  Compliance   │  │
│  └────┬─────┘  └────────┬────────┘  └───────────────┘  │
│       │                 │                               │
└───────┼─────────────────┼───────────────────────────────┘
        │                 │
   ┌────▼────┐     ┌──────▼──────┐
   │ OpenAI  │     │ MetaTrader5 │
   │ Gemini  │     │  (MT5)      │
   │ SeaLion │     └─────────────┘
   └─────────┘
```

---

## How It Works

### The Four-Agent Pipeline

Every trade goes through four AI agents in sequence, each powered by a configurable LLM provider:

| Agent | Role | What it does |
|---|---|---|
| **Analyst** | Market Reader | Reads OHLCV candles, spread, and account state. Identifies market structure and trend direction. |
| **Strategist** | Trade Planner | Takes the Analyst's read and applies the chosen strategy (ICT, SMC, etc.) to find entry, SL, and TP levels. |
| **Risk Manager** | Gate Keeper | Validates lot size, risk-reward ratio, and checks prop firm rules. Can reject the trade. |
| **Team Lead** | Final Decision | Weighs all three reports and issues the final `BUY`, `SELL`, or `HOLD` JSON decision. |

Each agent returns a structured JSON with `action`, `confidence`, `lot_size`, `entry_price`, `stop_loss`, `take_profit`, and `reason`. The Team Lead's output is what gets sent to MT5.

### Trading Modes

Select the personality of the agent team per session:

| Mode | Description |
|---|---|
| `scalper` | High-frequency, tight SL/TP, short holding time |
| `day_trader` | Intraday moves, closed before market end |
| `swing_trader` | Multi-day holds, wider SL/TP |
| `aggressive` | Higher risk tolerance, larger lot sizing |
| `mean_reversion` | Fades extremes, bets on price returning to mean |
| `breakout` | Enters confirmed breakouts above/below key levels |
| `auto` | Model chooses the best approach given market conditions |

### Trading Strategies

Combine a mode with a strategy for precise setups:

| Strategy | Description |
|---|---|
| `ict` | Inner Circle Trader — order blocks, fair value gaps, liquidity sweeps |
| `smc` | Smart Money Concepts — institutional footprints and market structure shifts |
| `supply_demand` | Classic supply/demand zone entries |
| `support_resistance` | Key horizontal level bounces and breaks |
| `trend_following` | Momentum entries in the direction of the trend |
| `breakout_retest` | Breaks a level then retests before entry |
| `none` | No strategy constraint — pure LLM discretion |

---

## Project Structure

```
SuperFx-Agent/
├── api-v1/                        # Python FastAPI backend
│   ├── app/
│   │   ├── api/routes/            # REST endpoints
│   │   │   ├── health.py          # Health check
│   │   │   ├── trading.py         # Single-agent trading
│   │   │   ├── multi_agent.py     # Multi-agent trading + SSE stream
│   │   │   ├── profiles.py        # Trading profiles CRUD
│   │   │   ├── runs.py            # Run history
│   │   │   └── logs.py            # Log streaming
│   │   ├── services/
│   │   │   ├── multi_agent.py     # Four-agent orchestrator
│   │   │   ├── llm_engine.py      # Multi-provider LLM client
│   │   │   ├── mt5_connector.py   # MetaTrader5 integration
│   │   │   ├── executor.py        # Order placement & management
│   │   │   ├── engine.py          # Central trading loop
│   │   │   ├── market_snapshot.py # OHLCV + account data
│   │   │   ├── scheduler.py       # Polling scheduler
│   │   │   ├── trading_cycle.py   # Per-cycle orchestration
│   │   │   ├── prop_compliance.py # Prop firm rule checker
│   │   │   ├── cycle_gate.py      # Prevents duplicate cycles
│   │   │   ├── run_recorder.py    # Persists run history
│   │   │   ├── profile_store.py   # Agent profile persistence
│   │   │   └── app_logger.py      # Structured logging
│   │   ├── prompts/
│   │   │   ├── modes/             # One prompt file per trading mode
│   │   │   └── strategies/        # One prompt file per strategy
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── db/                    # SQLAlchemy models + session
│   │   └── core/config.py         # Settings from .env
│   ├── .env.example
│   ├── requirements.txt
│   └── run.py
│
└── web-v1/                        # Next.js 16 frontend
    ├── app/                       # App Router pages
    │   ├── page.tsx               # Dashboard / workspace
    │   ├── multi-agent/page.tsx   # Multi-agent trading desk
    │   ├── trade/page.tsx         # Single-agent trade page
    │   ├── positions/page.tsx     # Open positions
    │   ├── history/page.tsx       # Trade history
    │   ├── runs/page.tsx          # Session runs
    │   ├── activity/page.tsx      # Activity log
    │   ├── connection/page.tsx    # MT5 connection settings
    │   └── prop-firm/page.tsx     # Prop firm dashboard
    ├── components/
    │   ├── multiAgent/            # Trading desk UI components
    │   │   ├── TradingFloor.tsx   # Main floor layout
    │   │   ├── AgentConfigCard.tsx
    │   │   ├── AgentTimeline.tsx  # Per-agent decision stream
    │   │   ├── LivePositionCard.tsx
    │   │   └── ...
    │   └── workspace/             # Shared workspace shell
    └── lib/                       # API clients and hooks
```

---

## Tech Stack

**Backend**
- Python 3.11+
- FastAPI + Uvicorn (async)
- MetaTrader5 Python package
- SQLAlchemy 2.0 (SQLite)
- Pydantic Settings

**Frontend**
- Next.js 16 + React 19
- TypeScript
- Tailwind CSS v4
- Server-Sent Events (SSE) for live streaming

**LLM Providers** (all configurable, use any combination)
- OpenAI (default: `gpt-4o-mini`)
- Google Gemini (default: `gemini-2.5-flash`)
- AI Singapore SEA-LION (default: `Llama-SEA-LION-v3.5-70B-R`)

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- MetaTrader 5 desktop app installed (Windows only for MT5)
- At least one LLM API key (OpenAI, Gemini, or SeaLion)

### 1. Backend Setup

```bash
cd api-v1

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# MT5 credentials
MT5_LOGIN=your_account_number
MT5_PASSWORD=your_password
MT5_SERVER=your_broker_server
MT5_DEMO_ONLY=true          # Set to false for live trading

# LLM providers — add at least one
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
SEALION_API_KEY=...

# Trading defaults
TRADE_TIMEFRAME=M5
CANDLE_COUNT=50
FIXED_LOT_SIZE=0.01
CONFIDENCE_THRESHOLD=0.6    # Minimum confidence to place a trade
ONE_POSITION_ONLY=true
```

```bash
# Start the API server
python run.py
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 2. Frontend Setup

```bash
cd web-v1

npm install
npm run dev
# UI available at http://localhost:3000
```

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/trading/start` | Start single-agent trading loop |
| `POST` | `/trading/stop` | Stop trading loop |
| `POST` | `/multi-agent/start` | Start multi-agent desk session |
| `GET` | `/multi-agent/stream` | SSE stream of agent decisions |
| `GET` | `/multi-agent/status` | Current session status |
| `GET` | `/profiles` | List trading profiles |
| `POST` | `/profiles` | Create a trading profile |
| `GET` | `/runs` | List past trading runs |
| `GET` | `/logs` | Stream application logs |

Full interactive docs: `http://localhost:8000/docs`

---

## Multi-Agent Session Flow

```
POST /multi-agent/start
  { symbol: "EURUSD", mode: "scalper", strategy: "ict",
    agents: [
      { name: "Analyst",      provider: "openai",  model: "gpt-4o-mini" },
      { name: "Strategist",   provider: "gemini",  model: "gemini-2.5-flash" },
      { name: "Risk Manager", provider: "sealion", model: "Llama-SEA-LION-v3.5-70B-R" },
      { name: "Team Lead",    provider: "openai",  model: "gpt-4o-mini" }
    ]
  }

  ↓ polling every N seconds

GET /multi-agent/stream   (SSE)
  → analyst_output event
  → strategist_output event
  → risk_manager_output event
  → team_lead_decision event  ← this triggers order placement
  → trade_executed event
```

Each event streams in real time to the Trading Desk UI, showing each agent's reasoning and the final outcome.

---

## Prop Firm Mode

Enable prop firm compliance to automatically enforce drawdown limits, daily loss caps, and position sizing rules required by funded account providers (FTMO, MyForexFunds, etc.).

The Risk Manager agent checks all rules before forwarding a decision to the Team Lead, and `prop_compliance.py` enforces hard stops before any order reaches MT5. The `PropFirmProgressBanner` in the UI shows real-time progress toward challenge targets.

---

## Safety Notes

- **Always start with `MT5_DEMO_ONLY=true`** to validate behavior on a demo account before going live.
- Set `CONFIDENCE_THRESHOLD` (0.0–1.0) to filter out low-conviction signals. A value of `0.6` or higher is recommended.
- `ONE_POSITION_ONLY=true` prevents the system from stacking multiple positions on the same symbol.
- All decisions and LLM outputs are logged to the `logs/` directory and stored in SQLite for auditing.

---

## License

MIT
