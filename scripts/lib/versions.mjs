// scripts/lib/versions.mjs — единый источник версий данных
// Правки здесь обновляют ВСЕ паки и manifest (через build-app-config.mjs)

export const SOURCE_DATA_VERSION = 'sblgnt-macula-clean-v1';
export const NORMALIZATION_VERSION = 'bsb-text-v2';

// Ожидаемый хеш enriched-снимка (из enriched/source-manifest.json).
// verify check #21 сверяет его; при регенерации enriched обновить ОБА: версию и этот хеш.
export const EXPECTED_SOURCE_FILE_SHA256 =
  '7f71504fdee8659bdd9f85342e4103d645864c2851b8205915bb298f0c004cc5';
