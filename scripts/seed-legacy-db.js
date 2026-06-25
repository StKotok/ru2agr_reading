// scripts/seed-legacy-db.js
// Засев IndexedDB данными старого пользователя v1.0.x для тестирования R2.
//
// Использование:
//   1. Открыть приложение (npm run dev) в браузере.
//   2. DevTools → Console → вставить содержимое этого файла → Enter.
//   3. Обновить страницу — миграция должна сработать.
//
// ⚠️ Этот скрипт ПЕРЕЗАПИСЫВАЕТ существующие данные в ru2agr_db.
//    Перед использованием убедиться, что текущие данные не нужны.

(async function seedLegacyDB() {
  const DB_NAME = 'ru2agr_db';
  const STORE_NAME = 'app_state';

  // Открываем БД
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Очищаем старые данные
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear().onsuccess = resolve;
    tx.onerror = () => reject(tx.error);
  });

  // ============================================================
  // settings — старый формат v1.0.x, без полей v2
  // ============================================================
  const legacySettings = {
    theme: 'auto',
    readingMode: 'mixed',
    wordLayer: 'words',
    intensity: 35,
    show: { diacritics: true, strongs: true, ruHint: true },
    onboarded: true
    // НЕТ: sourceLang, targetLang, translation — поля v2 появились позже
  };

  // ============================================================
  // dictionary — legacy-ключи v1.0.x (slug и freq-*)
  // ============================================================
  const legacyDictionary = {
    // slug-ключи (старый формат Синодальной эпохи)
    iesous: {
      status: 'known',
      showInText: true,
      intensity: 'often',
      addedAt: '2025-06-01',
      updatedAt: '2025-08-15'
    },
    logos: {
      status: 'learning',
      showInText: true,
      intensity: 'sometimes',
      addedAt: '2025-07-10'
    },
    theos: {
      status: 'known',
      showInText: true,
      intensity: 'often',
      addedAt: '2025-05-20'
    },
    // freq-* ключи (старый формат)
    'freq-26': {
      status: 'new',
      showInText: true,
      intensity: 'often',
      addedAt: '2025-09-01'
    },
    // Неоднозначный ключ: pneuma — если в core.json два lexeme с одним legacyKey,
    // должен остаться с _legacy:true
    pneuma: {
      status: 'learning',
      showInText: false,
      intensity: 'rare',
      addedAt: '2025-04-01'
    },
    // Неизвестный ключ — не存在于 core.json вообще
    'unknown-ancient-key': {
      status: 'new',
      showInText: true,
      intensity: 'often',
      addedAt: '2025-01-01'
    }
  };

  // ============================================================
  // progress — старый формат
  // ============================================================
  const legacyProgress = {
    letters: {
      α: { status: 'known', introducedAt: '2025-06-01' },
      β: { status: 'known', introducedAt: '2025-06-01' },
      γ: { status: 'learning', introducedAt: '2025-08-01' },
      δ: { status: 'known', introducedAt: '2025-06-01' },
      ε: { status: 'known', introducedAt: '2025-06-01' }
    },
    reading: {
      lastBook: 'john',
      lastScroll: 0.3
    },
    wordsToday: {
      date: '2025-09-15',
      added: ['iesous', 'logos', 'freq-26']
    }
  };

  // ============================================================
  // Пишем
  // ============================================================
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  await Promise.all([
    new Promise((resolve, reject) => {
      const req = store.put(JSON.parse(JSON.stringify(legacySettings)), 'settings');
      req.onsuccess = resolve;
      req.onerror = reject;
    }),
    new Promise((resolve, reject) => {
      const req = store.put(JSON.parse(JSON.stringify(legacyDictionary)), 'dictionary');
      req.onsuccess = resolve;
      req.onerror = reject;
    }),
    new Promise((resolve, reject) => {
      const req = store.put(JSON.parse(JSON.stringify(legacyProgress)), 'progress');
      req.onsuccess = resolve;
      req.onerror = reject;
    })
  ]);

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  console.log('✅ Legacy DB seeded successfully');
  console.log('   settings:', Object.keys(legacySettings).join(', '));
  console.log('   dictionary:', Object.keys(legacyDictionary).length, 'entries');
  console.log('   progress letters:', Object.keys(legacyProgress.letters).length);
  console.log('   progress wordsToday:', legacyProgress.wordsToday.added);
  console.log('');
  console.log('Теперь обнови страницу — миграция должна перенести:');
  console.log('  iesous → grc-iesoys-2fba61');
  console.log('  logos → grc-logos-04b1f3');
  console.log('  theos → grc-theos-3f4df2');
  console.log('  freq-26 → grc-agape-aa1d2f');
  console.log('  pneuma → _legacy:true (неоднозначный)');
  console.log('  unknown-ancient-key → _legacy:true (нет маппинга)');
})();
