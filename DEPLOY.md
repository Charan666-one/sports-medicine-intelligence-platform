# Deployment

The app is a single Node service that serves the API **and** the built frontend,
so any host that runs a Docker container (or Node 20) works. Below is a
one-click path via Render, plus notes for other hosts.

## Option A — Render (one-click, recommended)

This repo ships a **Render Blueprint** (`render.yaml`).

1. Push this branch to GitHub (already done).
2. In Render: **New → Blueprint** → select this repository.
3. Render reads `render.yaml`, builds the Dockerfile, generates strong
   `JWT_SECRET` and `ENCRYPTION_KEY`, and attaches a 1 GB persistent disk for the
   SQLite database.
4. After the first deploy, copy your service URL (e.g.
   `https://nexus-sports-medicine.onrender.com`) and set **`CORS_ORIGIN`** to it
   in the service's Environment tab, then redeploy.
5. Open the URL. On first boot the database is seeded, so you can log in with the
   demo admin (`admin@sportsmed.com` / `Admin@12345`) — **change it immediately**,
   or register a fresh account.

Optional: set `GEMINI_API_KEY` to enable LLM-enhanced summaries.

## Option B — Any Docker host (Fly.io, Railway, a VM)

```bash
docker build -t nexus .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="file:/app/data/prod.db" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e CORS_ORIGIN="https://your-domain.example" \
  -v nexus_data:/app/data \
  nexus
```

Or use `docker compose up --build` (see `docker-compose.yml`).

## Option C — Node without Docker

```bash
npm ci
npm run build
NODE_ENV=production \
DATABASE_URL="file:./prisma/prod.db" \
JWT_SECRET=... ENCRYPTION_KEY=... CORS_ORIGIN=https://your-domain \
npx prisma db push && npm run start
```

## Production notes

- **Secrets** (`JWT_SECRET`, `ENCRYPTION_KEY`) are required in production and must
  be strong; `ENCRYPTION_KEY` must stay **stable** or encrypted rows become
  unreadable. Render generates and persists them for you.
- **Database**: SQLite on a persistent disk is fine for a single instance / demo.
  For multi-instance or heavier load, migrate to **Postgres** (switch the Prisma
  datasource provider and `DATABASE_URL`) and use Prisma migrations.
- **Uploads**: uploaded file binaries are written to `/app/uploads` (ephemeral).
  The extracted data is persisted in the DB; mount a disk there too if you need to
  retain the original files.
- **Rate limiting** is in-memory; for multiple instances back it with Redis.
