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
import { existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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

// 2-4. Prisma client + database + seed
run('npx prisma generate');
run('npx prisma db push');
run('npx prisma db seed');

console.log('\n✅ Setup complete. Start the app with:  npm run dev');
