import { describe, it, expect } from 'vitest';
import { transliterateGreek } from '../scripts/lib/greek-translit.mjs';

describe('transliterateGreek', () => {
  const cases = [
    ['καί', 'kai'],
    ['θεός', 'theos'],
    ['λόγος', 'logos'],
    ['δέ', 'de'],
    ['ὁ', 'ho'],                // густое придыхание
    ['αὐτός', 'autos'],         // дифтонг αυ
    ['οὐρανός', 'ouranos'],     // дифтонг ου
    ['υἱός', 'huios'],          // дифтонг υι + придыхание
    ['εὑρίσκω', 'heurisko'],    // придыхание на дифтонге ευ
    ['ῥῆμα', 'rhema'],          // ῥ → rh
    ['ἄγγελος', 'angelos'],     // носовая γγ → ng
    ['Ἰησοῦς', 'Iesous'],       // заглавная сохраняется
    ['ψυχή', 'psyche'],         // одиночная υ → y
    ['ζωή', 'zoe'],
  ];
  for (const [grc, lat] of cases) {
    it(`${grc} → ${lat}`, () => expect(transliterateGreek(grc)).toBe(lat));
  }
  it('возвращает чистый ASCII', () => {
    for (const [grc] of cases) {
      expect(transliterateGreek(grc)).toMatch(/^[A-Za-z]+$/);
    }
  });
});
