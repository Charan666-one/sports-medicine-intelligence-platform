/**
 * One-shot project bootstrap for local development.
 *
 * Steps:
 *   1. Ensure a `.env` file exists (copied from `.env.example` if missing).
 *   2. Generate the Prisma client.
 *   3. Apply Prisma migrations to the configured PostgreSQL database.
 *   4. Seed the database with demo data.
 *
 * Run with:  npm run setup
 */
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

// 1. .env
const envPath = resolve(root, '.env');
const envExamplePath = resolve(root, '.env.example');
if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    console.log('✔ Created .env from .env.example (edit it to add your GEMINI_API_KEY).');
  } else {
    console.warn('⚠ No .env or .env.example found — you may need to create .env manually.');
  }
} else {
  console.log('✔ .env already exists — leaving it untouched.');
}

// 1b. Fill in strong secrets if they are still the placeholders.
try {
  let env = readFileSync(envPath, 'utf8');
  const ensureSecret = (key, generator) => {
    const re = new RegExp(`^${key}=.*$`, 'm');
    const current = env.match(re)?.[0]?.split('=').slice(1).join('=').replace(/^"|"$/g, '') ?? '';
    const looksPlaceholder = !current || /change-me|please|min-16|32-byte/i.test(current);
    if (looksPlaceholder) {
      const value = generator();
      env = re.test(env) ? env.replace(re, `${key}="${value}"`) : `${env}\n${key}="${value}"`;
      console.log(`✔ Generated ${key}.`);
    }
  };
  ensureSecret('JWT_SECRET', () => randomBytes(48).toString('base64url'));
  ensureSecret('ENCRYPTION_KEY', () => randomBytes(32).toString('hex'));
  writeFileSync(envPath, env);
} catch (err) {
  console.warn(`⚠ Could not auto-generate secrets (${err.message}). Set JWT_SECRET and ENCRYPTION_KEY in .env manually.`);
}

// 2. OCR model for image ingestion (best-effort — needs internet once)
const tessDir = resolve(root, 'data/tessdata');
const tessFile = resolve(tessDir, 'eng.traineddata.gz');
if (!existsSync(tessFile)) {
  try {
    mkdirSync(tessDir, { recursive: true });
    console.log('\n▶ Downloading OCR model (eng.traineddata.gz, ~10MB)…');
    const url = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tessFile));
    console.log('✔ OCR model cached at data/tessdata/eng.traineddata.gz');
  } catch (err) {
    console.warn(`⚠ Could not pre-download the OCR model (${err.message}). Image OCR will fetch it on first use if online.`);
  }
} else {
  console.log('✔ OCR model already present.');
}

// 3-5. Prisma client + migrations + seed (PostgreSQL).
//   Requires a reachable Postgres (see docker-compose `db` service or a local
//   cluster). `migrate deploy` applies committed migrations idempotently.
run('npx prisma generate');
run('npx prisma migrate deploy');
run('npx prisma db seed');

console.log('\n✅ Setup complete. Start the app with:  npm run dev');
console.log('   Need a database? `docker compose up -d db` starts local Postgres.');
