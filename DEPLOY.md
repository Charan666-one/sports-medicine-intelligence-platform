# Deployment

The app runs as **two processes from one image**: the API (`src/server.ts`,
serves the REST API + built frontend) and the asynchronous ingestion worker
(`src/worker.ts`, processes the Redis/BullMQ queue the API enqueues report
uploads onto — see the README's "Asynchronous ingestion" section). Both need
PostgreSQL and Redis. This is **not** a microservices split — same codebase,
same image, two `CMD`s.

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| **Purpose** | Development | Pre-release verification against production-like infra | Live traffic |
| **Database** | `docker compose up -d db redis`, or your own Postgres/Redis | Managed Postgres + Redis (separate instances from prod) | Managed Postgres + Redis, automated backups + PITR enabled |
| **Secrets** | `npm run setup` generates dev-only values in `.env` | Distinct, strong secrets — never copied from production | Distinct, strong secrets; rotate on suspected compromise |
| **`NODE_ENV`** | `development` | `production` | `production` |
| **`CORS_ORIGIN`** | `*` (default) | The staging URL, explicit | The production URL, explicit |
| **Seed data** | `npm run setup` seeds a demo admin | Do **not** seed; create real accounts | Never seed |
| **Migrations** | `npm run db:migrate` (interactive, creates new migrations) | `prisma migrate deploy` (applies committed migrations only) | Same — `migrate deploy` only, never `migrate dev` |
| **Worker** | `npm run worker` in a second terminal | Separate worker process/service, same image | Separate worker process/service, same image |

Promote a build from staging to production by promoting the **same
container image** (or the same git commit for a Node-without-Docker
deploy) — never rebuild from source for production after staging passed.

## Option A — Render (one-click, recommended for local/staging trials)

This repo ships a **Render Blueprint** (`render.yaml`): a managed Postgres
instance, a managed Redis (Key Value) instance, the web service, and an
ingestion-worker service definition.

1. Push this branch to GitHub.
2. In Render: **New → Blueprint** → select this repository.
3. Render provisions Postgres + Redis, injects their connection strings,
   builds the Dockerfile, generates strong `JWT_SECRET`/`ENCRYPTION_KEY`,
   and attaches a 1 GB disk to the web service for uploads. Migrations
   apply automatically on each boot (`prisma migrate deploy`).
4. After the first deploy, copy your service URL (e.g.
   `https://nexus-sports-medicine.onrender.com`) and set **`CORS_ORIGIN`**
   to it in the service's Environment tab, then redeploy.
5. Open the URL. On first boot the database is seeded, so you can log in
   with the demo admin (`admin@sportsmed.com` / `Admin@12345`) — **change
   it immediately**, or register a fresh account.

Optional: set `GEMINI_API_KEY` to enable LLM-enhanced summaries.

> ⚠ **The `nexus-ingestion-worker` service in `render.yaml` is defined but
> `autoDeploy: false` — do not enable it as-is with the default `local`
> storage driver.** Render disks cannot be attached to more than one
> service, so the worker can't read files the web service wrote to local
> disk. Report uploads will queue but never process until either (a) you
> set `STORAGE_DRIVER=s3` plus the `STORAGE_S3_*` vars on **both** the web
> and worker services (see `.env.example`) so uploads go to a shared bucket
> instead of the per-service disk — the fix, and the recommended setup for
> this service split — or (b) you run the worker as a second process
> alongside the web service on the same host instead of a separate Render
> service. Async ingestion is fully functional today via docker-compose or
> any single-host deployment (Option B/C below) even on the `local` driver,
> where both processes share a filesystem; the S3 driver is what makes the
> split-service Render layout (and any multi-instance deployment) safe.

## Option B — Any Docker host (Fly.io, Railway, a VM)

Requires a reachable PostgreSQL 16 and Redis 7, and both processes sharing
the uploads volume.

```bash
docker build -t nexus .

# API
docker run -d --name nexus-api -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:pass@host:5432/nexus?schema=public" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e CORS_ORIGIN="https://your-domain.example" \
  -v nexus_uploads:/app/uploads \
  nexus

# Worker (same image, different command, same uploads volume)
docker run -d --name nexus-worker \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:pass@host:5432/nexus?schema=public" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -v nexus_uploads:/app/uploads \
  -p 9091:9091 \
  nexus sh -c "npx prisma migrate deploy && npm run start:worker"
```

The `-p 9091:9091` exposes the worker's own metrics server — see the
Metrics note under Production notes below for why the worker needs a
separate scrape target from the API's `/api/metrics`.

Or use `docker compose up --build`, which wires all four services (`db`,
`redis`, `app`, `worker`) with a shared uploads volume — see
`docker-compose.yml`.

The shared `-v nexus_uploads:/app/uploads` volume above is only needed for
the default `local` storage driver. Add `-e STORAGE_DRIVER=s3` plus the
`STORAGE_S3_*` vars to both the API and worker commands instead and the
volume becomes unnecessary — each process talks to the bucket directly.

## Option C — Node without Docker

Run both processes (in separate terminals/services), pointing at the same
PostgreSQL, Redis, and uploads directory:

```bash
npm ci
npm run build
export NODE_ENV=production
export DATABASE_URL="postgresql://user:pass@host:5432/nexus?schema=public"
export REDIS_URL="redis://host:6379"
export JWT_SECRET=... ENCRYPTION_KEY=... CORS_ORIGIN=https://your-domain

npx prisma migrate deploy
npm run start          # API — terminal/service 1
npm run start:worker   # worker — terminal/service 2
```

## Rollback

Application code: redeploy the previous image tag / git commit — the
server is stateless aside from the DB, Redis queue, and the uploads
volume, so this is safe at any time.

Database migrations are the risky part — **take a backup before every
deploy that carries a migration** (see the README's Backup & restore
section). `prisma migrate deploy` only ever applies forward; there is no
automatic down-migration. To roll back a bad migration:
1. Restore the pre-migration backup into a scratch database and verify it.
2. If the migration was purely additive (new nullable column/table) and no
   application code depends on it yet, it's usually safe to leave it and
   just roll back the application code.
3. If it changed/removed something existing app code (old or new) depends
   on, restore the backup over the real database — accepting the data-loss
   window back to that backup — then redeploy the previous application
   version.
There is currently no automated rollback tooling; this is a manual,
backup-driven process. Rehearse it against a scratch database before you
need it for real.

## Production notes

- **Secrets** (`JWT_SECRET`, `ENCRYPTION_KEY`) are required in production
  and must be strong; `ENCRYPTION_KEY` must stay **stable** or encrypted
  rows become unreadable. Render generates and persists them for you.
- **Database**: PostgreSQL 16. Schema changes ship as committed Prisma
  migrations and are applied with `prisma migrate deploy` on boot. **Take
  a backup before every deploy** that carries a migration (see the Backup
  & restore section in the README) and enable your provider's automated
  backups / PITR.
- **Redis**: required for the ingestion queue (BullMQ) and the realtime
  event bridge between the worker and API processes. Not optional in
  production — without it, uploads queue but are never processed.
- **Uploads**: by default (`STORAGE_DRIVER=local`) uploaded file binaries
  are written to `/app/uploads` (ephemeral unless mounted), and the API and
  worker processes need access to the **same** uploads path — see the
  disk-sharing warning under Option A. Set `STORAGE_DRIVER=s3` (plus the
  `STORAGE_S3_*` vars — any S3-compatible endpoint works, not just AWS) to
  persist uploads to a bucket instead; this is required for any deployment
  where the API and worker don't share a filesystem, and recommended for
  production regardless (a local disk is not durable across
  redeploys/restarts). The extracted/parsed biomarker data is persisted in
  the DB either way, independent of where the original file bytes live.
- **Rate limiting** is in-memory; for multiple API instances behind a load
  balancer, back it with Redis instead (not yet implemented — tracked in
  `ENGINEERING_READINESS.md`).
- **Health checks**: point your platform's health check at
  `GET /api/health/ready` (checks Postgres + Redis connectivity), not
  `GET /api/health` (pure liveness, always 200) — see the README.
- **Metrics**: `GET /api/metrics` (API process) exposes Prometheus text-
  format metrics — HTTP request rate/latency/status by route template and
  default Node process metrics. Open by default like the health endpoints;
  set `METRICS_TOKEN` to gate it with a bearer token if you can't restrict
  the path at the ingress layer. **Also scrape the worker**: since it's a
  separate process, `ingestion_jobs_total` (async pipeline health) only
  ever gets incremented there and is exposed on its own server at
  `GET :$WORKER_METRICS_PORT/metrics` (default port `9091`, no path
  prefix). A Prometheus config for this app needs both targets, not just
  the API's. No bundled dashboard or alerting (tracked in
  `ENGINEERING_READINESS.md`).
