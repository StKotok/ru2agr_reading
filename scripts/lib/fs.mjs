// scripts/lib/fs.mjs — общие файловые утилиты для всех build/verify скриптов
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const SOURCE_ROOT = resolve('docs/source-data');

// Куда писать app-ready данные.
// При запуске через оркестратор (build-data.mjs) переменная указывает на временную
// директорию; при ручном запуске — на assets/data.
export const DATA_ROOT = resolve(process.env.BUILD_DATA_DIR || 'assets/data');

export function readSourceJson(relPath) {
  const abs = join(SOURCE_ROOT, relPath);
  return JSON.parse(readFileSync(abs, 'utf8'));
}

export function readDataJson(relPath) {
  const abs = join(DATA_ROOT, relPath);
  return JSON.parse(readFileSync(abs, 'utf8'));
}

export function writeDataJson(relPath, data) {
  const abs = join(DATA_ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  // Без форматирования ради размера; читаемость не нужна в app-ready
  writeFileSync(abs, JSON.stringify(data));
}

export { existsSync };
