# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

# System deps for native modules (sharp, pdf-parse, prisma engines).
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

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy installed deps (incl. prisma client, tsx) and app sources.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig*.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts

# Runtime data (uploads, OCR model) lives on a volume; the DB is external Postgres.
RUN mkdir -p uploads data/tessdata
VOLUME ["/app/uploads", "/app/data"]

EXPOSE 3000

# Apply committed migrations, seed on first boot (ignored if data already
# exists), then start the server (serves API + built frontend).
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || echo 'seed skipped (data exists)') && npm run start"]
