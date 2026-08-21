/**
 * One-shot project bootstrap for local development.
 *
 * Steps:
 *   1. Ensure a `.env` file exists (copied from `.env.example` if missing).
 *   2. Generate the Prisma client.
 *   3. Push the schema into the SQLite database (creates dev.db).
 *   4. Seed the database with demo data.
 *
 * Run with:  npm run setup
 */
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

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

// 3-5. Prisma client + database + seed
run('npx prisma generate');
run('npx prisma db push');
run('npx prisma db seed');

console.log('\n✅ Setup complete. Start the app with:  npm run dev');
