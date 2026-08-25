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
> `autoDeploy: false` — do not enable it as-is.** Render disks cannot be
> attached to more than one service, so the worker can't read files the
> web service wrote to local disk. Report uploads will queue but never
> process until either (a) you run the worker as a second process
> alongside the web service on the same host instead of a separate Render
> service, or (b) Phase 2 (S3-compatible object storage) replaces local
> disk as the upload backing store — tracked in `ENGINEERING_READINESS.md`.
> Async ingestion is fully functional today via docker-compose or any
> single-host deployment (Option B/C below), where both processes share a
> filesystem.

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
  nexus sh -c "npx prisma migrate deploy && npm run start:worker"
```

Or use `docker compose up --build`, which wires all four services (`db`,
`redis`, `app`, `worker`) with a shared uploads volume — see
`docker-compose.yml`.

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
- **Uploads**: uploaded file binaries are written to `/app/uploads`
  (ephemeral unless mounted). Both the API and worker processes need
  access to the **same** uploads path — see the disk-sharing warning under
  Option A. The extracted/parsed data is persisted in the DB regardless.
- **Rate limiting** is in-memory; for multiple API instances behind a load
  balancer, back it with Redis instead (not yet implemented — tracked in
  `ENGINEERING_READINESS.md`).
- **Health checks**: point your platform's health check at
  `GET /api/health/ready` (checks Postgres + Redis connectivity), not
  `GET /api/health` (pure liveness, always 200) — see the README.
