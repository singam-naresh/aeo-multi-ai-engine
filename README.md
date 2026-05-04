# AEO Multi-AI Diagnostic Engine

An AI-powered product analysis system that runs a search query through multiple AI model personas, scores their outputs, and generates a data-driven strategy to improve product visibility in AI-driven search.

---

## Overview

When a user submits a product query (e.g. "best laptop for coding"), the system:

1. Runs the query through three AI model personas — Groq, GPT-style, and Gemini-style — each with a distinct analytical tone
2. Scores and compares the outputs using a quality-based scoring model
3. Extracts intent signals from the query and AI outputs
4. Generates a unified strategy with keywords, positioning, pricing, and a quick win
5. Optionally enriches signals with lightweight search data (DuckDuckGo)
6. Persists results to SQLite and exposes an analytics dashboard

---

## Key Features

- **Multi-model analysis** — three AI personas (Groq, GPT-style, Gemini-style) run in parallel
- **Intent detection** — classifies queries into gaming, camera, coding, budget, AI tools, jobs, and more
- **Adaptive strategy generation** — multi-candidate scoring selects the best non-generic strategy
- **Signal grounding** — extracts recurring themes from AI outputs and optional search snippets
- **Confidence scoring** — transparent 0.50–0.90 score based on signal quality and keyword strength
- **Query normalization** — cleans raw input (`"mobile phone for gamers, below 20k"` → `"gaming phone under 20000"`)
- **Sentence repair** — fixes broken text left by metric removal
- **SQLite analytics** — tracks queries, intents, and winning models per user or globally
- **Optional JWT authentication** — register/login to scope analytics to your account
- **Guest mode** — full functionality without an account

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS        |
| Backend   | Node.js, Express, ES Modules                    |
| Database  | SQLite via `better-sqlite3`                     |
| Auth      | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)      |
| AI        | Groq API — `llama-3.1-8b-instant`               |
| Scraping  | DuckDuckGo HTML (optional, 2s timeout)          |

---

## Architecture

```
User Query
    │
    ▼
normalizeQueryText()          ← clean input, expand abbreviations
    │
    ▼
extractIntent()               ← detect primary + secondary intent
getLightweightSignals()       ← budget / comparison / feature signal
    │
    ▼
┌─────────────────────────────────────────┐
│  Parallel AI calls (Groq API × 3)       │
│  analyzeProduct()  analyzeProductGPT()  │
│  analyzeProductGemini()                 │
└─────────────────────────────────────────┘
    │
    ▼
cleanModelResult()            ← remove fake metrics, filter weak suggestions
compareModels()               ← quality-based scoring (not length-based)
    │
    ▼
generateDynamicKeywords()     ← LLM keyword call → validate → fallback pool
generateStrategyCandidates()  ← 3 candidates per intent → score → best
refineWithSignals()           ← append signal-specific angle if missing
    │
    ▼
getGroundSignals()            ← count signal words in AI outputs + scrape
buildEvidence()               ← 1-sentence grounding statement
computeConfidence()           ← 0.50–0.90 transparent score
    │
    ▼
finalStrategy                 ← recommendedAction, keywords, positioning,
                                 priceStrategy, quickWin, evidence, confidence
    │
    ├── Response sent to frontend
    │
    └── setImmediate() → SQLite writes (non-blocking)
                       → saveQuery / saveResult / logAnalytics
```

---

## Running Locally

### Backend

```bash
cd backend
cp .env.example .env      # fill in your keys
npm install
npm start
```

Server runs at `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs at `http://localhost:5173`

---

## Environment Variables

Create `backend/.env` from the example:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
JWT_SECRET=your_jwt_secret_here_change_in_production
```

Get a free Groq API key at [console.groq.com](https://console.groq.com).

---

## API Endpoints

| Method | Path                   | Auth     | Description                        |
|--------|------------------------|----------|------------------------------------|
| POST   | `/api/analyze`         | Optional | Run multi-model analysis           |
| GET    | `/api/analytics`       | Optional | Usage stats (scoped if logged in)  |
| POST   | `/api/auth/register`   | None     | Create account, returns JWT        |
| POST   | `/api/auth/login`      | None     | Login, returns JWT                 |

### POST `/api/analyze`

```json
{ "query": "best laptop for coding" }
```

Response includes: `groq`, `gpt`, `gemini` model results, `comparison`, and `finalStrategy` with `recommendedAction`, `focusKeywords`, `positioning`, `priceStrategy`, `quickWin`, `evidence`, `confidence`, `groundSignals`.

---

## Demo Flow

1. Open `http://localhost:5173`
2. Enter a product query — e.g. `"gaming phone under 20000"` or `"best laptop for coding"`
3. The system analyzes across three AI models simultaneously
4. Results appear: model rankings, insights, comparison winner
5. The **Winning Strategy** card shows keywords, positioning, quick win, and confidence score
6. Click any keyword chip to re-analyze with that keyword
7. Click **Apply Strategy** to copy the strategy and re-run with the top keyword
8. Visit `/analytics` to see usage trends

---

## Notes

- Authentication is fully optional — all features work in guest mode
- The SQLite database is local and not committed to the repository
- DuckDuckGo scraping is best-effort with a 2-second timeout; failures are silent
- The in-memory query cache has a 10-minute TTL to avoid redundant API calls
- No fake metrics are ever returned — all numbers are derived from real signals
