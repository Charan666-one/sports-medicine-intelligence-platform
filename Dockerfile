# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

# System deps for native modules (pdf-parse, prisma engines).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Upgrade first: the base image's OS packages (e.g. libgnutls30, libcap2)
# lag behind Debian security patches between node:20-slim rebuilds.
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Fresh production-only install (not a copy of the build stage's
# node_modules) so build-only tooling (vite, esbuild, eslint, vitest, ...)
# never ends up in the image that actually runs — smaller image, smaller
# attack surface. tsx and the prisma CLI are real `dependencies` (this
# runtime executes TypeScript directly via tsx and runs `prisma migrate
# deploy` on boot), so they're included.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/dist ./dist
COPY --from=build /app/tsconfig*.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts

# Runtime data (uploads, OCR model) lives on a volume; the DB is external Postgres.
RUN mkdir -p uploads data/tessdata
VOLUME ["/app/uploads", "/app/data"]

EXPOSE 3000

# Apply committed migrations, seed on first boot (ignored if data already
# exists), then start the server (serves API + built frontend).
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || echo 'seed skipped (data exists)') && npm run start"]
