# AEO Multi-AI Diagnostic Engine

An AI-powered product and brand analysis tool that runs your query through three simulated AI models (Groq, GPT-style, Gemini-style) and returns a unified strategy with rankings, competitor insights, and actionable recommendations.

---

## What it does

- Accepts a product or brand query (e.g. "best laptop for coding", "AI writing tool")
- Runs analysis through three AI model personas using the Groq API
- Compares model outputs and scores them on business quality
- Returns a **Final Strategy** with:
  - Recommended action
  - Focus keywords
  - Positioning statement
  - Price strategy
  - Quick win
  - Expected impact metrics

Domain-aware logic handles: physical products, laptops/tech, AI tools, SaaS platforms, and job platforms.

---

## Project structure

```
/
├── backend/          # Node.js + Express API
├── frontend/         # React + Vite UI
├── .gitignore
└── README.md
```

---

## Running the backend

```bash
cd backend
cp .env.example .env       # then add your GROQ_API_KEY
npm install
npm start
```

Server runs at `http://localhost:5000`

**API endpoint:**
```
POST /api/analyze
Content-Type: application/json

{ "query": "best laptop for coding" }
```

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs at `http://localhost:5173`

Make sure the backend is running before using the UI.

---

## Environment variables

Create `backend/.env` from the example:

```
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

Get a free API key at [console.groq.com](https://console.groq.com).

---

## Tech stack

| Layer    | Stack                              |
|----------|------------------------------------|
| Backend  | Node.js, Express, Groq API (Llama 3) |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| AI       | Groq `llama-3.1-8b-instant`        |
