import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clampAutoScrollSpeed, formatArabicSpeedLabel, getArabicJuzLabel } from './mushafGestures';

export type AppLanguage = 'ar' | 'en';
export type AppDirection = 'rtl' | 'ltr';

export const APP_LANGUAGE_STORAGE_KEY = 'bayan_app_lang_v1';

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function toArabicIndicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);
}

export function formatLocalizedDigits(value: number | string, lang: AppLanguage): string {
  return lang === 'en' ? String(value) : toArabicIndicDigits(value);
}

export function formatAppNumber(value: number, lang: AppLanguage): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG');
}

export function getJuzLabel(juzNumber: number, lang: AppLanguage): string {
  if (lang === 'en') {
    const safeJuz = Math.min(30, Math.max(1, Math.round(Number.isFinite(juzNumber) ? juzNumber : 1)));
    return `Juz ${safeJuz}`;
  }
  return getArabicJuzLabel(juzNumber);
}

export function formatSpeedLabel(speed: number, lang: AppLanguage): string {
  if (lang === 'en') {
    return `${clampAutoScrollSpeed(speed).toFixed(1)}×`;
  }
  return formatArabicSpeedLabel(speed);
}

export function getAutoScrollPresetLabel(presetId: string, lang: AppLanguage): string {
  if (lang === 'en') {
    if (presetId === 'tahqiq') return 'Slow (Tahqiq)';
    if (presetId === 'tadwir') return 'Balanced (Tadwir)';
    if (presetId === 'hadr') return 'Fast (Hadr)';
    return presetId;
  }
  if (presetId === 'tahqiq') return 'تحقيق وتدبّر';
  if (presetId === 'tadwir') return 'تدوير معتدل';
  if (presetId === 'hadr') return 'حدر ومراجعة';
  return presetId;
}

export function readStoredAppLanguage(): AppLanguage {
  try {
    if (typeof window === 'undefined') return 'ar';
    const raw = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
    return raw === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

interface LanguageContextValue {
  lang: AppLanguage;
  dir: AppDirection;
  isEnglish: boolean;
  setLang: (next: AppLanguage) => void;
  toggleLang: () => void;
  t: <T>(ar: T, en: T) => T;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  dir: 'rtl',
  isEnglish: false,
  setLang: () => {},
  toggleLang: () => {},
  t: (ar) => ar,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => readStoredAppLanguage());

  const dir: AppDirection = lang === 'en' ? 'ltr' : 'rtl';
  const isEnglish = lang === 'en';

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
      document.title =
        lang === 'en'
          ? "Bayan — Interactive Digital Mus'haf"
          : 'بَيَان - المصحف الرقمي التفاعلي الشامل';
    }
  }, [lang, dir]);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next === 'en' ? 'en' : 'ar');
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const t = useCallback(
    <T,>(ar: T, en: T): T => (lang === 'en' ? en : ar),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir,
      isEnglish,
      setLang,
      toggleLang,
      t,
    }),
    [lang, dir, isEnglish, setLang, toggleLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
