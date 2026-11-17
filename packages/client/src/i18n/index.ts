import { createContext, useContext } from 'react';
import en, { type Dict, type TKey } from './en';
import ru from './ru';

export type Lang = 'en' | 'ru';
export type { TKey };

export const dictionaries: Record<Lang, Dict> = { en, ru };

export const LangContext = createContext<Lang>('en');

export type TFunction = (key: TKey, params?: Record<string, string | number>) => string;

/** Translate + interpolate {placeholders}. Every user-visible string goes through here. */
export function translate(lang: Lang, key: TKey, params?: Record<string, string | number>): string {
  let out: string = dictionaries[lang][key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

export function useT(): TFunction {
  const lang = useContext(LangContext);
  return (key, params) => translate(lang, key, params);
}

export function useLang(): Lang {
  return useContext(LangContext);
}
