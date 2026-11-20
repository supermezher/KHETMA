import { safeLocalStorage } from './safeStorage';

export type AppTheme = 'dark' | 'light';

export const APP_THEME_KEY = 'bayan_app_theme_v1';
export const APP_THEME_EVENT = 'bayan:app-theme-updated';

export interface LastReadingPosition {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  page?: number;
  updatedAt: number;
}

export const LAST_READING_KEY = 'bayan_last_reading_v1';
export const LAST_READING_EVENT = 'bayan:last-reading-updated';

export function loadAppTheme(): AppTheme {
  const raw = safeLocalStorage.getItem(APP_THEME_KEY);
  return raw === 'light' ? 'light' : 'dark';
}

export function applyAppTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#10161f' : '#F6EFDD');
  }
}

export function saveAppTheme(theme: AppTheme): void {
  safeLocalStorage.setItem(APP_THEME_KEY, theme);
  applyAppTheme(theme);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AppTheme>(APP_THEME_EVENT, { detail: theme }));
  }
}

export function loadLastReadingPosition(): LastReadingPosition | null {
  const saved = safeLocalStorage.getJSON<Partial<LastReadingPosition> | null>(
    LAST_READING_KEY,
    null
  );
  if (
    !saved ||
    typeof saved.surahNumber !== 'number' ||
    saved.surahNumber < 1 ||
    saved.surahNumber > 114 ||
    typeof saved.ayahNumber !== 'number' ||
    saved.ayahNumber < 1
  ) {
    return null;
  }
  return {
    surahNumber: Math.floor(saved.surahNumber),
    surahName: typeof saved.surahName === 'string' && saved.surahName.trim() ? saved.surahName : '',
    ayahNumber: Math.floor(saved.ayahNumber),
    page: typeof saved.page === 'number' && saved.page >= 1 ? Math.floor(saved.page) : undefined,
    updatedAt: typeof saved.updatedAt === 'number' ? saved.updatedAt : Date.now(),
  };
}

export function saveLastReadingPosition(pos: LastReadingPosition): void {
  if (pos.surahNumber < 1 || pos.surahNumber > 114 || pos.ayahNumber < 1) return;
  safeLocalStorage.setJSON(LAST_READING_KEY, pos);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<LastReadingPosition>(LAST_READING_EVENT, { detail: pos }));
  }
}
