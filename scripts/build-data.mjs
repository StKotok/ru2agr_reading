// scripts/build-data.mjs — оркестратор атомарной генерации данных
// Запускает все build-скрипты во временную директорию, затем атомарно заменяет assets/data/.

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, renameSync, existsSync } from 'node:fs';

const TIMESTAMP = Date.now();
const TMP_DIR = `assets/.data-tmp-${TIMESTAMP}`;
const BACKUP_DIR = `assets/data.backup-${TIMESTAMP}`;

const SCRIPTS = [
  { name: 'build-bibles.mjs', desc: 'Greek + BSB books' },
  { name: 'build-lexicon.mjs', desc: 'Lexicon packs' },
  { name: 'build-align.mjs', desc: 'Alignment packs' },
  { name: 'build-app-config.mjs', desc: 'App config + manifest' }
];

function run(cmd, opts = {}) {
  console.log(`\n  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

try {
  console.log(`=== Atomic data generation ===`);
  console.log(`Temp dir: ${TMP_DIR}`);

  // Clean up any orphaned tmp dir
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  mkdirSync(TMP_DIR, { recursive: true });

  const env = { ...process.env, BUILD_DATA_DIR: TMP_DIR };

  // Run each build script
  for (const script of SCRIPTS) {
    console.log(`\n=== ${script.name} — ${script.desc} ===`);
    run(`node scripts/${script.name}`, { env });
  }

  // Verify on tmp dir
  console.log(`\n=== verify-data.mjs ===`);
  run(`node scripts/verify-data.mjs`, { env });

  // Atomic replacement
  console.log(`\n=== Atomic replacement ===`);
  let backedUp = false;
  if (existsSync('assets/data')) {
    renameSync('assets/data', BACKUP_DIR);
    backedUp = true;
    console.log(`  Backup: assets/data → ${BACKUP_DIR}`);
  }

  try {
    renameSync(TMP_DIR, 'assets/data');
    console.log(`  Renamed: ${TMP_DIR} → assets/data`);
  } catch (renameErr) {
    // Rollback
    if (backedUp) {
      renameSync(BACKUP_DIR, 'assets/data');
      console.log(`  ROLLBACK: restored assets/data from backup`);
    }
    throw renameErr;
  }

  // Clean up backup
  if (backedUp) {
    rmSync(BACKUP_DIR, { recursive: true, force: true });
    console.log(`  Cleaned up backup`);
  }

  console.log(`\n✓ Atomic generation complete`);
} catch (err) {
  // Clean up tmp dir on failure
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  console.error(`\n✗ Generation failed, old data preserved:`, err.message);
  process.exit(1);
}
