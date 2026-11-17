import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import ru from '../src/i18n/ru';
import { translate } from '../src/i18n';

const PARAM_RE = /\{(\w+)\}/g;

function paramsOf(template: string): string[] {
  return [...template.matchAll(PARAM_RE)].map((m) => m[1]);
}

describe('i18n dictionaries', () => {
  it('have identical key sets in EN and RU', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `en:${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(ru)) {
      expect(value.trim().length, `ru:${key}`).toBeGreaterThan(0);
    }
  });

  it('use the same interpolation params in both languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(paramsOf(ru[key]).sort(), key).toEqual(paramsOf(en[key]).sort());
    }
  });

  it('interpolates placeholders', () => {
    expect(translate('en', 'topbar.turn', { turn: 3, limit: 50 })).toBe('Turn 3 of 50');
    expect(translate('ru', 'topbar.turn', { turn: 3, limit: 50 })).toBe('Ход 3 из 50');
    expect(translate('ru', 'side.state')).toBe('Корпорация');
  });
});
