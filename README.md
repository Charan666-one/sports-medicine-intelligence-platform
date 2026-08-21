<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# NEXUS — Sports Medicine & Anti-Doping Intelligence Platform

AI-powered biological-passport and athlete-intelligence monitoring system.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind
- **Backend:** Node.js (Express) + Prisma + SQLite + Socket.IO
- **AI/ML:** In-process risk & anomaly engine (`ml-random-forest`, `ml-isolation-forest`, `simple-statistics`) with optional Gemini LLM enhancement
- **Optional ML micro-service:** Python FastAPI (`ml-service/`)

The Express server serves the API **and** the Vite frontend from a single
process, so you only need to run one command.

## Run locally

**Prerequisites:** Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. One-shot bootstrap: creates .env, generates the Prisma client,
#    creates the SQLite database, and seeds demo data.
npm run setup

# 3. Start the app (API + frontend) on http://localhost:3000
npm run dev
```

That's it — open http://localhost:3000.

### Optional: enable Gemini LLM enhancement

The app runs fully deterministically without an API key. To enable
LLM-enhanced medical summaries, set a real key in `.env`:

```
GEMINI_API_KEY="your-real-key"
```

Leaving the placeholder value keeps all AI reasoning deterministic and makes
no external network calls.

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + frontend (development) |
| `npm run setup` | Create `.env`, generate Prisma client, push schema, seed |
| `npm run db:push` | Sync the Prisma schema into the database |
| `npm run db:seed` | Re-seed demo data |
| `npm run build` | Build the frontend bundle (`dist/`) |
| `npm run lint` | Type-check with `tsc --noEmit` |

## Optional Python ML service

The FastAPI service in `ml-service/` is standalone and not required by the
Node app. To run it:

```bash
cd ml-service
pip install -r requirements.txt
python train_model.py   # generates ml-service/saved_models/*
uvicorn app:app --reload --port 8000
```
