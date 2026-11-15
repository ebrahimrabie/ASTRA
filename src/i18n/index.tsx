import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import arDict from '../../locales/ar.json';
import enDict from '../../locales/en.json';
import { ApiHttpError, ApiUnreachableError } from '../api/client';
import { useAstra } from '../context/AstraContext';
import type { UserPreferences } from '../types';

export type LocaleLanguage = UserPreferences['language'];
export type NumeralPreference = UserPreferences['numerals'];

type DictNode = string | { [key: string]: DictNode };

const DICTIONARIES: Record<LocaleLanguage, Record<string, DictNode>> = {
  en: enDict as unknown as Record<string, DictNode>,
  ar: arDict as unknown as Record<string, DictNode>,
};

function getNestedValue(
  dict: Record<string, DictNode>,
  dotKey: string
): string | null {
  const normalizedKey = dotKey.startsWith('alerts.titles.')
    ? `alerts_titles.${dotKey.slice('alerts.titles.'.length)}`
    : dotKey;

  const parts = normalizedKey.split('.');
  // Fast walk supporting keys that themselves contain dots at leaf level (e.g. R-RAD-05.doctor_info)
  let current: DictNode | undefined = dict;
  for (let i = 0; i < parts.length; i += 1) {
    if (typeof current !== 'object' || current === null) {
      return null;
    }
    const part = parts[i];
    if (part in current) {
      current = current[part];
    } else {
      const remaining = parts.slice(i).join('.');
      if (remaining in current && typeof current[remaining] === 'string') {
        return current[remaining] as string;
      }
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

export function translateText(
  lang: LocaleLanguage,
  key: string,
  params?: Record<string, unknown>
): string {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.en;
  const fallback = DICTIONARIES.en;
  let template = getNestedValue(dict, key) ?? getNestedValue(fallback, key) ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replaceAll(`{${k}}`, String(v ?? ''));
    }
  }
  return template;
}

export function translateStatusText(lang: LocaleLanguage, code: string): string {
  const upper = code.toUpperCase();
  const spaced = upper.replaceAll('_', ' ');
  const direct =
    getNestedValue(DICTIONARIES[lang] ?? DICTIONARIES.en, `status.${code}`) ??
    getNestedValue(DICTIONARIES[lang] ?? DICTIONARIES.en, `status.${upper}`) ??
    getNestedValue(DICTIONARIES[lang] ?? DICTIONARIES.en, `status.${spaced}`);
  if (direct) return direct;

  const enDirect =
    getNestedValue(DICTIONARIES.en, `status.${code}`) ??
    getNestedValue(DICTIONARIES.en, `status.${upper}`) ??
    getNestedValue(DICTIONARIES.en, `status.${spaced}`);
  return enDirect ?? code.replaceAll('_', ' ');
}

export function translateProvenanceText(
  lang: LocaleLanguage,
  provenance: string
): string {
  return (
    getNestedValue(DICTIONARIES[lang] ?? DICTIONARIES.en, `provenance.${provenance}`) ??
    provenance
  );
}

export function translateErrorMessage(
  lang: LocaleLanguage,
  err: unknown,
  fallbackKey = 'errors.UNKNOWN_ERROR'
): string {
  if (err instanceof ApiUnreachableError) {
    return translateText(lang, 'errors.API_UNREACHABLE');
  }
  if (err instanceof ApiHttpError && err.code) {
    const key = `errors.${err.code}`;
    const candidate = getNestedValue(DICTIONARIES[lang] ?? DICTIONARIES.en, key);
    if (candidate) return candidate;
  }
  if (err instanceof Error && err.message && lang === 'en') {
    return err.message;
  }
  return translateText(lang, fallbackKey);
}

export function formatNonClinicalNumber(
  lang: LocaleLanguage,
  numerals: NumeralPreference,
  value: number
): string {
  if (!Number.isFinite(value)) return String(value);
  if (lang === 'ar' && numerals === 'arabic_indic') {
    return new Intl.NumberFormat('ar-EG-u-nu-arab').format(value);
  }
  if (lang === 'ar') {
    return new Intl.NumberFormat('ar-EG-u-nu-latn').format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatUtcIsoTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 19).replace('T', ' ');
}

interface I18nContextValue {
  lang: LocaleLanguage;
  dir: 'ltr' | 'rtl';
  numerals: NumeralPreference;
  t: (key: string, params?: Record<string, unknown>) => string;
  trStatus: (code: string) => string;
  trProvenance: (provenance: string) => string;
  trError: (err: unknown, fallbackKey?: string) => string;
  formatNum: (value: number) => string;
  formatWeekday: (utcEpochMs: number, style?: 'short' | 'long') => string;
  formatUtcIso: (utcEpochMs: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useAstra();
  const lang: LocaleLanguage = preferences.language === 'ar' ? 'ar' : 'en';
  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';
  const numerals: NumeralPreference =
    preferences.numerals === 'arabic_indic' ? 'arabic_indic' : 'western';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
      document.title = translateText(lang, 'app.documentTitle');
    }
  }, [lang, dir]);

  const t = useCallback(
    (key: string, params?: Record<string, unknown>) => translateText(lang, key, params),
    [lang]
  );

  const trStatus = useCallback(
    (code: string) => translateStatusText(lang, code),
    [lang]
  );

  const trProvenance = useCallback(
    (provenance: string) => translateProvenanceText(lang, provenance),
    [lang]
  );

  const trError = useCallback(
    (err: unknown, fallbackKey?: string) => translateErrorMessage(lang, err, fallbackKey),
    [lang]
  );

  const formatNum = useCallback(
    (value: number) => formatNonClinicalNumber(lang, numerals, value),
    [lang, numerals]
  );

  const formatWeekday = useCallback(
    (utcEpochMs: number, style: 'short' | 'long' = 'short') => {
      const locale =
        lang === 'ar'
          ? numerals === 'arabic_indic'
            ? 'ar-EG-u-nu-arab'
            : 'ar-EG-u-nu-latn'
          : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        weekday: style,
        timeZone: 'UTC',
      }).format(new Date(utcEpochMs));
    },
    [lang, numerals]
  );

  const formatUtcIso = useCallback((utcEpochMs: number) => formatUtcIsoTimestamp(utcEpochMs), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      dir,
      numerals,
      t,
      trStatus,
      trProvenance,
      trError,
      formatNum,
      formatWeekday,
      formatUtcIso,
    }),
    [lang, dir, numerals, t, trStatus, trProvenance, trError, formatNum, formatWeekday, formatUtcIso]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback if used outside I18nProvider
  return {
    lang: 'en',
    dir: 'ltr',
    numerals: 'western',
    t: (key, params) => translateText('en', key, params),
    trStatus: (code) => translateStatusText('en', code),
    trProvenance: (p) => translateProvenanceText('en', p),
    trError: (err, fallbackKey) => translateErrorMessage('en', err, fallbackKey),
    formatNum: (value) => formatNonClinicalNumber('en', 'western', value),
    formatWeekday: (ms, style = 'short') =>
      new Intl.DateTimeFormat('en-US', { weekday: style, timeZone: 'UTC' }).format(
        new Date(ms)
      ),
    formatUtcIso: formatUtcIsoTimestamp,
  };
}
