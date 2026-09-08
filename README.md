

# NEXUS — Sports Medicine & Anti-Doping Intelligence Platform

AI-powered biological-passport and athlete-intelligence monitoring system.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind
- **Backend:** Node.js (Express) + Prisma + PostgreSQL + Socket.IO
- **AI/ML:** In-process risk & anomaly engine (`ml-random-forest`, `ml-isolation-forest`, `simple-statistics`) with optional Gemini LLM enhancement

The Express server serves the API **and** the Vite frontend from a single
process, so you only need to run one command.

## Run locally

**Prerequisites:** Node.js 20+, a PostgreSQL 16 database, and Redis 7.

```bash
# 1. Install dependencies
npm install

# 2. Start local PostgreSQL + Redis (skip if you already have your own)
docker compose up -d db redis

# 3. One-shot bootstrap: creates .env (+ strong secrets), generates the Prisma
#    client, applies migrations, seeds demo data, caches the OCR model.
npm run setup

# 4. Start the API + frontend on http://localhost:3000
npm run dev

# 5. In a second terminal, start the ingestion worker (required — report
#    uploads are queued by the API and processed by this process; without
#    it, uploads stay QUEUED forever).
npm run worker
```

If you use your own database/Redis, point `DATABASE_URL` / `REDIS_URL` in
`.env` at them before step 3.

That's it — open http://localhost:3000.

### Logging in

The app is protected by JWT authentication. `npm run setup` seeds a demo admin:

```
email:    admin@sportsmed.com
password: Admin@12345
```

The login form pre-fills these for convenience — **change them after first
login** (you can also register a new account from the login screen).

### Uploading a report (real analysis)

Go to **Reports → Upload**. Drop a **PDF**, **image (PNG/JPG)**, or **CSV** lab
report. The upload is queued and processed **asynchronously** by the ingestion
worker (see below) — PDF text extraction / OCR / CSV parsing → biomarker
normalization → physiological validation → deterministic risk & anomaly
scoring — auto-detects the athlete from the file. The UI polls the job and/or
listens for realtime completion events and shows the computed result once
it's ready. No demo/mock data is generated.

CSV format (header optional): `parameter,value,unit`

## Asynchronous ingestion

Report ingestion (OCR/parsing + risk analysis) runs off the HTTP request path,
in a separate **worker process** (`src/worker.ts`), not inline in the API
process (`src/server.ts`). Same codebase and Docker image, two process types —
this is deliberately **not** a microservice.

- **Queue**: Redis + BullMQ (`src/queues/ingestion.queue.ts`). The API enqueues
  a job and returns `202 Accepted` immediately with an `ingestionJobId`.
- **Durable status**: every job is also written to the `IngestionJob` table in
  Postgres (`QUEUED → PROCESSING → COMPLETED | FAILED | DEAD_LETTER`), so job
  history and status polling never depend on Redis retention or availability.
  Poll `GET /api/v1/reports/ingestion-jobs/:id`.
- **Idempotency**: each upload is checksummed (SHA-256); a duplicate
  submission (double-click, client retry) within the same organization reuses
  the existing job instead of processing it twice.
- **Retry / dead-letter**: jobs retry up to 3 times with exponential backoff;
  a job that fails on its final attempt is marked `DEAD_LETTER` with the
  captured error, rather than retried forever or silently dropped.
- **Realtime bridge**: the worker has no HTTP server or Socket.IO clients of
  its own, so `SocketService` publishes events over Redis pub/sub, and the API
  process relays them to connected clients — the frontend still gets live
  `pipeline:update` / `ingestion:completed` / `ingestion:failed` events.
- **Storage** (`src/services/storage.service.ts`): where the uploaded file
  bytes end up. `STORAGE_DRIVER=local` (default) keeps them on the
  container's own disk — simple, but not durable and only works when the
  API and worker share a filesystem. `STORAGE_DRIVER=s3` uploads to an
  S3-compatible bucket instead (real AWS S3 or any compatible endpoint —
  MinIO, R2, etc.) and is what the worker actually reads from during
  parsing (`StorageService.materializeLocal` downloads to a temp file,
  parses, then deletes the temp copy — OCR/PDF/CSV parsing itself is
  unchanged, it always sees a local path). See `.env.example` for the
  `STORAGE_S3_*` vars and `DEPLOY.md` for when this is required vs. optional.

Run the worker with `npm run worker` (dev, hot-reload) or
`npm run start:worker` (production). It must be running for uploads to
actually process — the API only enqueues them.

## Versioned analysis & reproducibility

`AIPrediction` rows are append-only (a new analysis never overwrites or
updates a prior one — history is preserved by construction) and each row
records the exact provenance of the classification that produced it:

- `engineVersion` — the deterministic risk/anomaly engine code version
- `rulesVersion` — the physiological threshold/rules version (`POP_LIMITS`,
  risk-class bounds in `AIEngineService`)
- `inputHash` — SHA-256 of the exact feature vector the prediction was
  computed from (`sha256Json`, `src/utils/checksum.ts`)

Given the same `inputHash` and the same `engineVersion`/`rulesVersion`, a
prediction is independently reproducible — bump the version constants in
`AIEngineService` whenever the classification logic or thresholds change.

## Longitudinal intelligence: change-point detection

Single-point anomaly detection (above) answers "is the latest reading
unusual?" — it can't catch a doping-style step-change that then stabilizes
at a new (elevated) level, since after a few reports at the new level
nothing looks anomalous point-to-point anymore. `GET /athletes/:id/statistics`
now also runs change-point detection (`src/services/changePointDetection.ts`)
per biomarker: exhaustive single-change-point mean-shift detection (binary
segmentation) over the athlete's full ordered history, flagging the split
with the largest before/after difference in pooled-standard-error units.

This also flags a sustained gradual drift, not only a sharp jump — that's
intentional (a steady multi-month trend is itself longitudinally relevant),
not a bug. A true trend-vs-step distinction would need a different method;
see the module's doc comment. Surfaced on the athlete detail page under
"Longitudinal Findings" alongside statistical anomalies.

## Data quality vs. risk signal

A flagged biomarker reading can mean very different things, and conflating
them is itself a risk — a mis-scanned document should never read as a
doping alert. Every ingestion categorizes findings (`src/types/dataQuality.ts`):

- **DATA_ERROR** — the value isn't physiologically possible for a living
  human, or extraction confidence was too low to trust it. Most likely an
  OCR/parsing mistake; needs re-verification against the source document.
- **PHYSIOLOGICAL_ANOMALY** — plausible and real, but statistically atypical
  for this athlete, with no independent population-level red flag.
- **RISK_SIGNAL** — independently crosses a population-level threshold
  associated with doping risk, regardless of the athlete's own history.

Findings are stored per-report (`MedicalReport.dataQualityFindings`) and
shown on the report detail view. Critically, if the strongest driver of a
CRITICAL/anomalous AI finding is a biomarker that was independently flagged
as a likely data error from the same upload, the system raises a
lower-severity **"DATA QUALITY REVIEW"** alert instead of a CRITICAL
**"AI INTELLIGENCE ALERT"** — a probable extraction mistake never gets
framed as a confirmed risk signal (`AIEngineService.processAthleteAIUpdate`).

### Security & data privacy

- **Auth on every API route** (JWT); realtime socket channel is authenticated too.
- **Short-lived access tokens + rotating refresh tokens** (Phase 9): the JWT
  access token expires in 15 minutes (`JWT_EXPIRES_IN`); sessions stay alive
  via an opaque, single-use refresh token (`POST /auth/refresh`) rotated on
  every use and stored server-side only as a SHA-256 hash. Reusing an
  already-rotated token outside a short grace window (tolerates near-
  simultaneous requests from the same browser) is treated as token theft and
  revokes every active session for that user. `POST /auth/logout` revokes
  the current refresh token. The frontend API client (`src/lib/api.ts`)
  transparently refreshes-and-retries once on a 401 before giving up.
- **Encryption at rest**: sensitive free-text medical fields (raw OCR text,
  extracted JSON, medical history) are AES-256-GCM encrypted in the database.
- **Secrets**: `JWT_SECRET` and `ENCRYPTION_KEY` are required (auto-generated by
  `npm run setup`); the app refuses to start in production without strong values.
- **Hardening**: Helmet security headers (with CSP in production), CORS allow-list,
  request rate limiting, body-size limits, and PII-safe logging (no query logging).
- **Audit trail**: logins, registrations, ingestions, and alert changes are
  recorded (who / what / when / IP) in the ActivityLog and AuditLog tables.
- **CI security gates**: `npm audit --audit-level=high` (dependency
  vulnerabilities), `gitleaks` (committed-secret scanning), and a Trivy scan
  of the built Docker image (CRITICAL/HIGH) all run on every push/PR and
  block merge on failure. Dependabot keeps npm/Docker/Actions dependencies
  patched weekly. `.trivyignore` suppresses a handful of CVEs confined to
  npm's own bundled CLI dependencies (not this project's code — see the
  file's comments); re-check it after bumping the npm version in the
  Dockerfile, since the exact CVE IDs shift between npm patch releases.
- **Multi-factor authentication** (TOTP, `src/services/mfa.service.ts`): opt-in
  per account via Settings → Account Security. Enrollment (`POST
  /auth/mfa/setup`) generates a pending secret + QR code; it only takes
  effect once proven with a real code (`POST /auth/mfa/enable`), which also
  issues 8 single-use backup codes (bcrypt-hashed, shown once). Once
  enabled, `POST /auth/login` no longer returns session tokens for that
  account — it returns a narrow, 5-minute `mfaToken` (rejected outright by
  the `protect` middleware if someone tries to use it as a normal bearer
  token) that must be exchanged via `POST /auth/mfa/challenge` with a live
  TOTP code or an unused backup code. The TOTP secret itself is encrypted
  at rest via the same field-level AES-256-GCM mechanism as medical data.
  Disabling MFA (`POST /auth/mfa/disable`) requires re-entering the current
  password. Verified end-to-end via a live browser session (register →
  enroll → scan QR → confirm → log out → MFA-gated login → wrong code
  rejected → backup code accepted), not just unit tests.

### Optional: enable Gemini LLM enhancement

The app runs fully deterministically without an API key. To enable
LLM-enhanced medical summaries, set a real key in `.env`:

```
GEMINI_API_KEY="your-real-key"
```

Leaving the placeholder value keeps all AI reasoning deterministic and makes
no external network calls.

## API documentation

The full REST API is documented as an OpenAPI 3.0 spec: `openapi.yaml`
(hand-authored — every path was cross-checked against the actual route
files, not generated from decorators, so it can't silently drift without a
human noticing in review). Served two ways once the app is running:

- **`GET /api/docs`** — interactive Swagger UI (try requests, see
  request/response shapes, which endpoints need a Bearer token — auth
  requirements are correct per-endpoint, e.g. `/auth/register`/`/auth/login`
  are unlocked, everything else is locked).
- **`GET /api/openapi.json`** — the raw spec, for external tooling
  (Postman, codegen, contract tests).

`npm run docs:validate` validates `openapi.yaml` against the OpenAPI 3.0
schema (structural correctness — not that it matches the code, which is a
manual review responsibility) and runs in CI on every push/PR.

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + frontend (development) |
| `npm run worker` | Start the asynchronous ingestion worker (development, hot-reload) |
| `npm run start:worker` | Start the ingestion worker (production) |
| `npm run setup` | Create `.env` (+ secrets), generate Prisma client, apply migrations, seed, cache OCR model |
| `npm run db:migrate` | Create/apply a migration in development (`prisma migrate dev`) |
| `npm run db:migrate:deploy` | Apply committed migrations (CI / production) |
| `npm run db:seed` | Re-seed demo data |
| `npm run db:studio` | Open Prisma Studio against the database |
| `npm run build` | Build the frontend bundle (`dist/`) |
| `npm run typecheck` | Strict type-check (`tsc --noEmit`); `typecheck:server` checks the backend without DOM libs |
| `npm run lint` | ESLint (flat config, typescript-eslint); `lint:fix` to auto-fix |
| `npm run format` | Prettier write; `format:check` to verify |
| `npm run test` | Run the Vitest unit suite; `test:coverage` for coverage |
| `npm run check` | typecheck + lint + test (the CI gate) |
| `npm run docs:validate` | Validate `openapi.yaml` against the OpenAPI 3.0 schema |

## Development & quality

- **TypeScript** runs in `strict` mode. `tsconfig.json` covers the frontend + shared code; `tsconfig.server.json` type-checks the backend without DOM libs.
- **ESLint + Prettier** are configured (`eslint.config.js`, `.prettierrc.json`).
- **Vitest** unit tests live in `tests/` (crypto, biomarker normalization/extraction, validation).
- **Integration tests** (`tests/*.integration.test.ts`) exercise the real
  Express app + a real Postgres database via `supertest` — no mocks.
  `authorization.integration.test.ts` covers the authorization matrix:
  unauthenticated → 401, cross-tenant read → 404 (not leaked), tenant-list
  scoping, non-admin role on an admin-only mutation → 403, admin → 200/201.
- **Model evaluation** (`tests/modelEvaluation.test.ts`, Phase 7): the
  deterministic risk-classification and anomaly-detection logic is scored
  against a synthetic, domain-labeled dataset (`tests/fixtures/`, dev/val/
  test split — no real athlete data) using standard precision/recall/F1 and
  a confusion matrix (`src/utils/evaluationMetrics.ts`). Current test-set
  numbers: precision/recall/F1 = 1.0 on the primary (multi-marker)
  evaluation. A separate, explicitly-documented case set shows the engine's
  known conservative behavior: an isolated extreme single-marker reading
  (e.g. EPO or T/E ratio alone) does not reach HIGH/CRITICAL by design —
  it requires >=2 corroborating markers, a deliberate false-positive
  guard, not a bug — 3 of 4 such cases in that set are domain-flagged as
  arguably alert-worthy but are not currently flagged. Tracked in
  `ENGINEERING_READINESS.md`.
- **CI**: `.github/workflows/ci.yml` runs typecheck → lint → test → build on every push/PR.
- **Logging** uses `pino` (pretty in dev, JSON in prod) with secret/PII redaction.
- **Request IDs** (Phase 10 API quality): every request gets an ID — reused
  from an inbound `X-Request-Id` header if an upstream proxy already set
  one, otherwise a fresh UUID. It's attached to every log line for that
  request, echoed back as the `X-Request-Id` response header, and included
  in every JSON error body (`{ "requestId": "..." }`) — a client-reported
  failure can be correlated straight to server logs.
- **Health checks** (Phase 12): `GET /api/health` is liveness — always 200 if
  the process is up, checks nothing external, safe for a restart decision.
  `GET /api/health/ready` is readiness — pings Postgres and Redis with a 2s
  timeout each and returns 503 if either is unreachable, so an orchestrator
  stops routing traffic to an instance that can't actually serve it. Render
  is configured to use the readiness endpoint (`render.yaml`); Docker
  Compose's `app` healthcheck uses it too.
- **Metrics** (Phase 12, `src/utils/metrics.ts`): `GET /api/metrics` on the
  API exposes Prometheus text-format metrics — default Node process
  metrics (CPU, memory, event loop) and `http_request_duration_seconds` (a
  histogram labeled by method/route-template/status, so cardinality stays
  bounded regardless of data volume). `ingestion_jobs_total` (labeled by
  terminal status: `completed` / `retry` / `dead_letter`) is incremented in
  the **worker** process, not the API — since they're separate OS processes
  that don't share prom-client's in-memory registry, the worker exposes its
  own metrics server (`GET :$WORKER_METRICS_PORT/metrics`, default `9091`,
  `src/utils/metricsServer.ts`). A real deployment scrapes **both**
  targets. Open by default (`METRICS_TOKEN` optionally gates the API's
  endpoint — see `.env.example`); no bundled dashboard or alerting.

## Docker

```bash
# Build and run the full stack (app + worker + PostgreSQL + Redis)
JWT_SECRET=$(openssl rand -base64 48) \
ENCRYPTION_KEY=$(openssl rand -hex 32) \
CORS_ORIGIN=http://localhost:3000 \
docker compose up --build
```

`docker-compose.yml` runs four services: `db` (PostgreSQL), `redis`, `app`
(API + frontend, port 3000), and `worker` (asynchronous ingestion — same
image as `app`, different command). The image builds the frontend, applies
Prisma migrations on start, and serves the API + frontend on port 3000.
PostgreSQL data, Redis data, uploads, and the OCR model persist on named
volumes; `app` and `worker` share the `app_uploads` volume so the worker can
read files the API wrote.

> **Render note:** Render disks cannot be attached to more than one service,
> so `app` and a separately-deployed `nexus-ingestion-worker` service cannot
> share local-disk uploads there — see `render.yaml` and
> `ENGINEERING_READINESS.md` for this known limitation and its fix (Phase 2:
> S3-compatible object storage).

## Database

PostgreSQL 16 via Prisma, with migrations committed under `prisma/migrations`.

- **Change the schema:** edit `prisma/schema.prisma`, then `npm run db:migrate`
  (creates a migration and applies it locally).
- **Deploy:** `npm run db:migrate:deploy` applies committed migrations
  idempotently — this runs automatically in the Docker image and in CI.
- **Seed data** lives in `prisma/seed.ts`, deliberately separate from migrations.

### Backup & restore

```bash
# Backup (compressed custom-format dump)
pg_dump "$DATABASE_URL" --format=custom --file=nexus-$(date +%F).dump

# Restore into an empty database
pg_restore --dbname="$DATABASE_URL" --clean --if-exists nexus-2026-01-01.dump

# Verify a restore before trusting it
psql "$DATABASE_URL" -c 'SELECT count(*) FROM "Athlete";'
```

Take backups **before every migration deploy**. On managed Postgres (e.g. Render),
enable the provider's automated daily backups and point-in-time recovery in
addition to these dumps. Restores must be rehearsed into a scratch database —
an untested backup is not a backup.
