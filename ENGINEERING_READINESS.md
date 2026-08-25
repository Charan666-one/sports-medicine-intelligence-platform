# NEXUS Sports Medicine Intelligence Platform — Engineering Readiness Report

**Date:** 2026-08-25
**Scope:** Full-stack athlete intelligence and anti-doping risk-screening platform (Express/TypeScript API + Prisma/Postgres + Redis/BullMQ worker + React frontend).
**Verdict up front:** **NOT production-ready.** Core security, correctness, and data-integrity engineering is solid and verified. Several capabilities a real deployment needs — durable file storage, MFA, API docs, broad test coverage, and operational metrics — are not built. Do not deploy to handle real athlete medical data until the "Blockers" section below is closed out.

---

## 1. Readiness Score

| Dimension | Score (0–5) | Basis |
|---|---|---|
| Correctness (core domain logic) | 4/5 | Deterministic ingestion, risk scoring, and longitudinal analysis are tested and evaluated against externally-grounded labels; one known, documented model limitation (see §6). |
| Security | 3/5 | Tenant isolation, encryption at rest, rotating refresh tokens, CI secret/container scanning all verified. No MFA. No dependency-confusion/SSRF review. No pen test. |
| Data integrity | 4/5 | Idempotent ingestion, checksum dedup, dead-letter handling, field-level AES-256-GCM encryption, provenance-tagged AI predictions. Durable (S3-compatible) file storage now exists but is opt-in and defaults off (see Blocker B1) — the default deployment is still non-durable. |
| Test coverage | 3/5 | 78 tests passing, 0 lint/type errors, **30.04%** statement coverage on `src/services/**` (up from 24.2% earlier this session — see B5). The refresh-token rotation/reuse-detection logic (the most security-critical code added this session, previously untested) and the alert resolve/escalate lifecycle (including cross-tenant protection) now have dedicated coverage. Controllers/routes as a whole are still mostly untested, and the coverage config only measures `src/services/**` at all — route handlers aren't even in the denominator. |
| Operability | 3/5 | Liveness + readiness health checks, request-ID correlation, structured logs, and a Prometheus metrics endpoint (HTTP latency/error-rate, ingestion pipeline health) all exist and are verified live. Still no dashboards, no alerting actually configured, no queue-depth metric, no load testing. |
| Documentation | 3/5 | README, DEPLOY.md are current and detailed. No OpenAPI spec, no SECURITY.md/THREAT_MODEL.md, no DATA_MODEL.md. |

**Overall: 3/5 — solid, honestly-tested core engine; not yet an operable production service.**

This is a considered judgment call, not a formula average — correctness and data integrity carry more weight than documentation for a system handling health data.

---

## 2. What Is Actually Done and Verified

Everything below was implemented **and independently verified** in this engineering pass (not just written and assumed to work):

- **Asynchronous, idempotent ingestion pipeline** (Redis/BullMQ worker, checksum-based dedup, dead-letter queue on repeated failure, tenant-scoped job status polling) — verified via real headless-browser upload sessions (OCR path and dead-letter path) and dedicated unit tests (`tests/checksum.test.ts`, `tests/ingestionRetry.test.ts`).
- **Data-quality-aware AI engine**: ingested reports are validated into a `DATA_ERROR` / `PHYSIOLOGICAL_ANOMALY` / `RISK_SIGNAL` taxonomy; a CRITICAL alert is automatically downgraded to a "data quality review" when its top driver is a suspected scan/extraction error rather than a real physiological signal, so bad OCR doesn't get reported to an analyst as a doping-risk finding.
- **Field-level encryption at rest** (AES-256-GCM via a Prisma `$extends()` wrapper) applied to sensitive medical fields on write and transparently decrypted on read.
- **Rotating refresh tokens** with reuse detection: short-lived (15 min) JWT access tokens, single-use opaque refresh tokens with a replacement chain, a 15s grace window to tolerate benign concurrent-request races, and full session-chain revocation on detected reuse. Silent frontend refresh-and-retry on 401.
- **Tenant isolation**, verified with a real supertest + Postgres integration suite (`tests/authorization.integration.test.ts`) exercising the full authorization matrix, not just unit-level assertions.
- **Reproducible AI predictions**: every `AIPrediction` row carries `engineVersion`, `rulesVersion`, and a hash of its input, so any historical prediction can be traced to exactly what code and data produced it.
- **Longitudinal intelligence beyond single-point anomaly detection**: a coefficient-of-variation-based stability index, and binary-segmentation change-point detection (same family as WADA ABP-style step-change flags) that catches a sustained regime shift even after it stops looking anomalous point-to-point. Both are unit-tested (`tests/anomalyScoring.test.ts`, `tests/changePointDetection.test.ts`), with known method limitations documented in-source rather than hidden.
- **Model evaluation against externally-grounded labels** (not the code's own thresholds): `tests/modelEvaluation.test.ts` computes precision/recall/F1/confusion-matrix against a synthetic dataset labeled from WADA reference criteria. This **found and documented a real design characteristic**: the engine requires 2+ corroborating markers before it will raise HIGH/CRITICAL, so isolated single-marker extreme readings (3 of 4 domain-flagged cases in the `singleMarkerSet` fixture) are not caught. This is reported as a known, quantified gap — not silently patched by relabeling the test.
- **Explainability / "never claim to prove doping" audit** (this session): every user-facing text generator in the reasoning path was read in full and checked. `medicalReasoning.service.ts`, `reasoningEngine.service.ts`, and `investigationAssistant.service.ts` were confirmed compliant (deterministic, template-based on real data, "risk"/"deviation"/"stability" framing only). `geminiEnhancement.service.ts` had a real gap — the LLM prompt had no explicit guardrail — fixed by adding an explicit instruction forbidding "doping"/"cheating"/"guilty" framing and requiring risk-indicator framing only.
- **Container and dependency security scanning wired into CI**: Trivy container scan (CRITICAL/HIGH, with a narrowly-scoped, per-CVE-documented `.trivyignore`), gitleaks secret scan, `npm audit --audit-level=high`, Dependabot for npm/docker/actions. All three CI jobs (`verify`, `secret-scan`, `container-scan`) are green on the current head commit.
- **Liveness/readiness separation**: `/api/health` (always 200, restart-safe) vs. `/api/health/ready` (checks Postgres + Redis with bounded timeouts, 503 on failure, traffic-routing-safe) — the readiness check's Redis client was deliberately built fail-fast (`maxRetriesPerRequest: 1`, 2s connect timeout) after live testing caught the shared BullMQ-tuned client hanging indefinitely when Redis was down.
- **Request-ID correlation** end-to-end (generated or honored from `X-Request-Id`, echoed in responses, included in error bodies and logs).
- **Alert lifecycle already existed and was verified, not newly built**: resolve/escalate endpoints with audit logging (`AuditService.log` + `AuditService.record`) were already present in `alert.controller.ts` — confirmed during this pass rather than assumed.
- **Optional S3-compatible durable storage** (`src/services/storage.service.ts`): the ingestion controller and worker now go through a `StorageService` abstraction instead of assuming a shared local disk. With `STORAGE_DRIVER=s3` configured, uploads persist to a bucket and the worker materializes a local temp copy only for the duration of OCR/PDF/CSV parsing. The default (`local`) driver's behavior is byte-for-byte unchanged from before, so this is additive, not a rewrite of the upload path. Unit-tested with the S3 client mocked (`tests/storage.service.test.ts`) — not yet exercised against a real bucket. See Blocker B1 for what's still required to actually rely on this in production.
- **Prometheus metrics endpoint** (`src/utils/metrics.ts`, `GET /api/metrics`): request-duration histogram (bounded-cardinality route-template labels, not raw paths), an `ingestion_jobs_total` counter tracking async pipeline health, and default Node process metrics. Verified with real requests against the live dev server (curl), not just unit tests — confirmed the histogram populates with correctly-labeled series. See Blocker B4 for what's still missing (a dashboard/alerting stack to actually consume it).

## 3. Verification Pass (this session, on the current head commit)

| Check | Result |
|---|---|
| `npm run typecheck` | Pass, 0 errors |
| `npm run lint` | Pass, 0 errors, 59 pre-existing warnings (all unused-import/var style warnings, none touching this session's changes) |
| `npm run test` | Pass, 60/60 tests, 10/10 files |
| `npm run test:coverage` | 24.2% statements / 21.24% branches / 39.88% functions / 24.68% lines — see §5 |
| `npm run build` (production Vite build) | Pass, 8.84s, one pre-existing chunk-size warning (>500kB main bundle, not addressed — see §5) |
| CI: `verify` job | Green |
| CI: `secret-scan` (gitleaks) | Green |
| CI: `container-scan` (Trivy, CRITICAL/HIGH) | Green |
| DB migrations | 5 migrations present (`init`, ingestion jobs, data-quality findings, AI prediction provenance, refresh tokens), applied cleanly in dev throughout this session |
| Tenant isolation | Verified via integration test suite, not just code review |
| Ingestion end-to-end | Verified via live headless-browser sessions (auto-match upload, explicit-athlete upload, dead-letter path) |
| Intelligence engine vs. evaluation dataset | Verified via `modelEvaluation.test.ts`; one real gap found and documented (§2, single-marker corroboration) |

No penetration test, load test, or external security audit has been performed. "Security: 3/5" reflects that gap explicitly.

**Post-B1/B4/B5 follow-up verification** (after the storage-driver, metrics-endpoint, and test-coverage work below): `npm run typecheck`/`lint`/`test`/`build` re-run clean — 78/78 tests (60 original + 4 storage + 2 metrics + 7 refresh-token + 5 alert-lifecycle), 0 type/lint errors, production build unchanged. `GET /api/metrics` smoke-tested against the live dev server (not just unit tests) and confirmed to expose correctly-labeled `http_request_duration_seconds` and `ingestion_jobs_total` series. Statement coverage (`src/services/**`) up to 30.04% from 24.2%.

## 4. Architecture (unchanged in shape from the original app — no rewrite, no microservices)

Single Express/TypeScript API + a Postgres database (Prisma) + one BullMQ worker process for async ingestion + a React/Vite frontend. No new services were introduced; the worker was added because ingestion (OCR + parsing + AI scoring) is genuinely long-running and needed to move off the request thread — not for architectural novelty. Routes: `/auth`, `/athletes`, `/reports`, `/alerts`, `/inspections`, `/analytics`, `/anti-doping`, `/stats` — all but `/auth` require a valid JWT (`protect` middleware) and are org-scoped.

## 5. Known Gaps (not blockers, but real limitations to track)

- **Test coverage is low (24.2%) outside the modules this session touched directly.** Controllers and routes have essentially no unit coverage; correctness there currently relies on the authorization integration suite and manual/live verification, not automated regression coverage. A controller-level regression could ship undetected.
- **Frontend bundle is a single ~1.49MB (401KB gzip) chunk.** Not code-split. Not a functional bug, but a real performance characteristic for slow connections — flagged, not fixed, since no performance profiling was done to justify prioritizing it over correctness/security work.
- **List endpoints (`GET /athletes`, `GET /reports`, etc.) are unbounded** (no pagination) except `GET /alerts` (`take: 50`). Fine at current expected roster scale (tens to low hundreds of athletes per org); would need pagination before it's safe at materially larger scale.
- **`stabilityIndex` is computed per-athlete, applied uniformly across all reports for that athlete in a given scoring pass**, not yet a true per-report/within-window signal. Documented in-source as an honest simplification, not hidden.
- **Change-point detection cannot distinguish a genuine step-change from a smooth gradual trend** — both trigger detection by design (documented in `changePointDetection.ts`); this is a known characteristic of single-changepoint binary segmentation, not a bug, but an analyst reading a "regime shift" flag should know it could be either.

## 6. Blockers to "Production Ready" (must be closed before real deployment)

These are the gaps that specifically make the "NOT production-ready" verdict correct — each is either a data-durability risk, a security posture gap for handling athlete medical data, or a capability the original directive scoped in but this pass did not reach:

- **B1 — File storage is local disk by default, not durable. PARTIALLY ADDRESSED.** A `StorageService` abstraction (`src/services/storage.service.ts`) now supports an S3-compatible backend: set `STORAGE_DRIVER=s3` plus the `STORAGE_S3_*` vars (see `.env.example`) and uploads are persisted to a bucket (AWS S3 or any compatible endpoint — MinIO, R2, etc.) instead of the container's own disk; the worker downloads to a temp file for parsing and deletes it afterward. This is **opt-in, not the default** — `STORAGE_DRIVER=local` (the old behavior, writing to `uploads/medical_reports/` via `multer.diskStorage`) remains the default so no existing dev/staging setup breaks. **A production deployment must explicitly set `STORAGE_DRIVER=s3`** — deploying with the default is still exactly as non-durable as before. Downgraded from a hard blocker to a configuration requirement: the capability exists and is tested (`tests/storage.service.test.ts`, S3 calls mocked), but nothing enforces it's actually turned on for a given deployment, and it has not been exercised against a real S3 bucket/MinIO instance in this session (only via a mocked SDK) — treat as unverified in a live environment until it is.
- **B2 — No multi-factor authentication.** Login is password + JWT only. For a system handling athlete medical/doping-risk data, MFA (TOTP at minimum) should gate at least ADMIN-level accounts before production use. **Not implemented this session.**
- **B3 — No API specification (OpenAPI/Swagger).** Endpoints are implemented and route-tested but not formally documented as a contract; there is no machine-readable spec for client generation, contract testing, or third-party integration review. **Not implemented this session.**
- **B4 — No operational metrics/alerting beyond health checks. PARTIALLY ADDRESSED.** `GET /api/metrics` (`src/utils/metrics.ts`) now exposes Prometheus text-format metrics: default Node process metrics, `http_request_duration_seconds` (method/route-template/status), and `ingestion_jobs_total` (completed/retry/dead_letter) — enough for a Prometheus-compatible collector to alert on error rate, latency, or a stalled ingestion pipeline. What's still missing: **no dashboard and no alerting are actually configured** — this is an exporter, not a monitoring stack; someone still has to point a Prometheus server at it and build the dashboards/alert rules. No queue-depth (Redis/BullMQ backlog size) metric yet either. Optionally gated by `METRICS_TOKEN`; open by default like the existing health endpoints.
- **B5 — Test coverage gap (§5) is a blocker, not just a note, for a system of this sensitivity. PARTIALLY ADDRESSED.** Statement coverage is up to 30.04% (from 24.2%): added `tests/refreshToken.service.test.ts` (7 tests directly exercising rotation, the 15s reuse-grace window, out-of-grace theft detection + full session revocation, expiry, single/all-session revocation — previously zero automated coverage on the most security-critical logic in the codebase, and writing these tests caught a wrong assumption of my own about the grace-window's return value, which the test now documents correctly) and extended the authorization integration suite with 5 alert-lifecycle tests (cross-tenant resolve/escalate protection, tenant-scoped listing, persisted state changes). Still true: route handlers as a whole remain mostly untested, and the `vitest.config.ts` coverage `include` is scoped to `src/services/**` only — controllers, routes, and middleware aren't measured at all, so the real application-wide percentage is lower than 30.04% suggests.
- **B6 — No independent security review.** No penetration test, no SSRF/dependency-confusion review beyond automated container/secret scanning, no formal threat model document. Reasonable for a security-conscious internal build; not sufficient for production handling of sensitive athlete data.

## 7. Explicit Statement

Per the governing engineering directive for this work: **this platform is not claimed to be production-ready.** The core intelligence engine, ingestion pipeline, and tenant-security model are built to a genuinely high, independently-verified standard — real bugs were found and fixed through live testing (not just code review) throughout this engineering pass, and known limitations were documented rather than hidden or worked around with fake fixes. But B1–B6 above are real, unresolved gaps. Closing B1 (durable storage) and B5 (test coverage) should be the next priorities before any deployment handling real athlete data; B2/B3/B4/B6 should follow before the platform is exposed beyond a trusted internal pilot.
