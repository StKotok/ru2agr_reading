import { describe, it, expect } from 'vitest';
import { stripDiacritics, finalSigma, preserveCase, getRules, isPunctuationOrSpace } from '../src/engine/rules.js';

describe('stripDiacritics', () => {
  it('удаляет острое ударение: λόγος → λογος', () => {
    expect(stripDiacritics('λόγος')).toBe('λογος');
  });

  it('удаляет облегчённое придыхание: ἄνθρωπος → ανθρωπος', () => {
    expect(stripDiacritics('ἄνθρωπος')).toBe('ανθρωπος');
  });

  it('удаляет густое придыхание: ἁμαρτία → αμαρτια', () => {
    expect(stripDiacritics('ἁμαρτία')).toBe('αμαρτια');
  });

  it('удаляет циркумфлекс: πνεῦμα → πνευμα', () => {
    expect(stripDiacritics('πνεῦμα')).toBe('πνευμα');
  });

  it('сохраняет финальную сигму на конце слова', () => {
    // После удаления диакритики σ на конце должна стать ς
    const result = stripDiacritics('λόγος');
    expect(result).toBe('λογος');
  });

  it('удаляет диерезу: προϊόν → προιον', () => {
    // Если диереза есть в исходном слове
    expect(stripDiacritics('προϊόν')).toBe('προιον');
  });

  it('удаляет гравис: τιμὴ → τιμη', () => {
    expect(stripDiacritics('τιμὴ')).toBe('τιμη');
  });

  it('корректно обрабатывает слово без диакритики', () => {
    expect(stripDiacritics('λογος')).toBe('λογος');
  });
});

describe('finalSigma', () => {
  it('σ → ς перед пробелом', () => {
    const original = 'λογος εστιν';
    expect(finalSigma('σ', 4, 1, original)).toBe('ς');
  });

  it('σ → ς перед концом строки', () => {
    const original = 'λογος';
    expect(finalSigma('σ', 4, 1, original)).toBe('ς');
  });

  it('σ остаётся σ перед буквой', () => {
    const original = 'σοφια';
    expect(finalSigma('σ', 0, 1, original)).toBe('σ');
  });

  it('σ → ς перед запятой', () => {
    const original = 'λογος, και';
    expect(finalSigma('σ', 4, 1, original)).toBe('ς');
  });

  it('возвращает исходный символ если не σ', () => {
    expect(finalSigma('α', 0, 1, 'αβγ')).toBe('α');
  });
});

describe('preserveCase', () => {
  it('сохраняет заглавную первую букву: Слово → Σλοβο', () => {
    expect(preserveCase('σλοβο', 'Слово')).toBe('Σλοβο');
  });

  it('сохраняет нижний регистр: слово → σλοβο', () => {
    expect(preserveCase('σλοβο', 'слово')).toBe('σλοβο');
  });

  it('сохраняет ВЕРХНИЙ РЕГИСТР: СЛОВО → ΣΛΟΒΟ', () => {
    expect(preserveCase('σλοβο', 'СЛОВО')).toBe('ΣΛΟΒΟ');
  });

  it('корректно обрабатывает одиночную заглавную: А → Α', () => {
    expect(preserveCase('α', 'А')).toBe('Α');
  });

  it('возвращает исходную замену если первый символ не буква', () => {
    expect(preserveCase('σλοβο', '123')).toBe('σλοβο');
  });
});

describe('isPunctuationOrSpace', () => {
  it('null → true', () => {
    expect(isPunctuationOrSpace(null)).toBe(true);
  });

  it('undefined → true', () => {
    expect(isPunctuationOrSpace(undefined)).toBe(true);
  });

  it('пробел → true', () => {
    expect(isPunctuationOrSpace(' ')).toBe(true);
  });

  it('запятая → true', () => {
    expect(isPunctuationOrSpace(',')).toBe(true);
  });

  it('буква → false', () => {
    expect(isPunctuationOrSpace('α')).toBe(false);
  });
});

describe('getRules', () => {
  it('getRules() без аргументов возвращает латиницу (32 правила)', () => {
    const rules = getRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBe(32);
  });

  it('getRules("latin") — 32 правила', () => {
    const rules = getRules('latin');
    expect(rules.length).toBe(32);
  });

  it('getRules("cyrillic") — 38 правил', () => {
    const rules = getRules('cyrillic');
    expect(rules.length).toBe(38);
  });

  it('каждое правило имеет поля ru и gr (latin)', () => {
    const rules = getRules('latin');
    for (const rule of rules) {
      expect(rule).toHaveProperty('ru');
      expect(rule).toHaveProperty('gr');
      expect(typeof rule.ru).toBe('string');
      expect(typeof rule.gr).toBe('string');
    }
  });

  it('каждое правило имеет поля ru и gr (cyrillic)', () => {
    const rules = getRules('cyrillic');
    for (const rule of rules) {
      expect(rule).toHaveProperty('ru');
      expect(rule).toHaveProperty('gr');
      expect(typeof rule.ru).toBe('string');
      expect(typeof rule.gr).toBe('string');
    }
  });

  it('диграфы идут раньше одиночных букв (latin)', () => {
    const rules = getRules('latin');
    let firstSingleIdx = -1;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].ru.length === 1 && !rules[i].regex) {
        firstSingleIdx = i;
        break;
      }
    }
    for (let i = 0; i < firstSingleIdx; i++) {
      expect(rules[i].ru.length > 1 || rules[i].regex).toBe(true);
    }
  });

  it('диграфы идут раньше одиночных букв (cyrillic)', () => {
    const rules = getRules('cyrillic');
    let firstSingleIdx = -1;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].ru.length === 1 && !rules[i].regex) {
        firstSingleIdx = i;
        break;
      }
    }
    for (let i = 0; i < firstSingleIdx; i++) {
      expect(rules[i].ru.length > 1 || rules[i].regex).toBe(true);
    }
  });

  it('латиница: содержит th→θ, ph→φ, ch→χ', () => {
    const rules = getRules('latin');
    const findRu = (ru) => rules.find(r => r.ru === ru);
    expect(findRu('th').gr).toBe('θ');
    expect(findRu('ph').gr).toBe('φ');
    expect(findRu('ch').gr).toBe('χ');
  });

  it('латиница: содержит w→ω (визуальная мнемоника)', () => {
    const rules = getRules('latin');
    const wRule = rules.find(r => r.ru === 'w');
    expect(wRule).toBeDefined();
    expect(wRule.gr).toBe('ω');
  });

  it('кириллица: содержит кс→ξ, пс→ψ, тх→θ', () => {
    const rules = getRules('cyrillic');
    const findRu = (ru) => rules.find(r => r.ru === ru);
    expect(findRu('кс').gr).toBe('ξ');
    expect(findRu('пс').gr).toBe('ψ');
    expect(findRu('тх').gr).toBe('θ');
  });

  it('кириллица: regex-правило для г перед е/и', () => {
    const rules = getRules('cyrillic');
    const gRule = rules.find(r => r.ru === 'г(?=[еи])');
    expect(gRule).toBeDefined();
    expect(gRule.regex).toBe(true);
    expect(gRule.gr).toBe('γ');
  });
});
