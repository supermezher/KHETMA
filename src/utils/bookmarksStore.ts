import { SURAHS_LIST } from '../data/quranMetadata';
import { safeLocalStorage } from './safeStorage';
import type { AppLanguage } from './i18n';

export const BOOKMARK_KEY_PREFIX = 'bayan_bookmark_';
export const BOOKMARKS_META_STORAGE_KEY = 'bayan_bookmarks_meta_v1';
export const BOOKMARKS_UPDATED_EVENT = 'bayan:bookmarks-updated';

export type BookmarkCategoryLabel = 'وقف القراءة' | 'مراجعة الحفظ' | 'تدبر ودعاء' | 'عام';

export const BOOKMARK_LABELS: BookmarkCategoryLabel[] = [
  'وقف القراءة',
  'مراجعة الحفظ',
  'تدبر ودعاء',
  'عام',
];

const BOOKMARK_LABELS_EN: Record<BookmarkCategoryLabel, string> = {
  'وقف القراءة': 'Reading Stop',
  'مراجعة الحفظ': 'Hifz Review',
  'تدبر ودعاء': 'Tadabbur & Dua',
  'عام': 'General',
};

export function getBookmarkDisplayLabel(
  label: BookmarkCategoryLabel,
  lang: AppLanguage
): string {
  if (lang === 'en') {
    return BOOKMARK_LABELS_EN[label] || 'General';
  }
  return label;
}

export interface SavedBookmarkEntry {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  page?: number;
  ayahSnippet?: string;
  label: BookmarkCategoryLabel;
  savedAt: string;
}

function getSurahNameFallback(surahNumber: number): string {
  return SURAHS_LIST.find((s) => s.number === surahNumber)?.name || `السورة ${surahNumber}`;
}

function getSurahStartPageFallback(surahNumber: number): number | undefined {
  return SURAHS_LIST.find((s) => s.number === surahNumber)?.startPage;
}

function normalizeBookmarkLabel(label: unknown): BookmarkCategoryLabel {
  if (
    label === 'وقف القراءة' ||
    label === 'مراجعة الحفظ' ||
    label === 'تدبر ودعاء' ||
    label === 'عام'
  ) {
    return label;
  }
  return 'وقف القراءة';
}

function loadRawMetaMap(): Record<string, SavedBookmarkEntry> {
  const raw = safeLocalStorage.getJSON<Record<string, unknown>>(BOOKMARKS_META_STORAGE_KEY, {});
  if (!raw || typeof raw !== 'object') return {};

  const out: Record<string, SavedBookmarkEntry> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const rec = val as Record<string, unknown>;
    const surahNumber = Number(rec.surahNumber ?? key);
    const ayahNumber = Number(rec.ayahNumber);
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) continue;
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) continue;

    out[String(surahNumber)] = {
      surahNumber,
      surahName:
        typeof rec.surahName === 'string' && rec.surahName.trim()
          ? rec.surahName.trim()
          : getSurahNameFallback(surahNumber),
      ayahNumber,
      page:
        typeof rec.page === 'number' && Number.isFinite(rec.page) && rec.page >= 1
          ? Math.floor(rec.page)
          : getSurahStartPageFallback(surahNumber),
      ayahSnippet: typeof rec.ayahSnippet === 'string' ? rec.ayahSnippet.trim().slice(0, 140) : undefined,
      label: normalizeBookmarkLabel(rec.label),
      savedAt:
        typeof rec.savedAt === 'string' && rec.savedAt.trim()
          ? rec.savedAt
          : new Date().toISOString(),
    };
  }
  return out;
}

function emitBookmarksUpdated(list: SavedBookmarkEntry[]) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(BOOKMARKS_UPDATED_EVENT, { detail: list }));
  }
}

/**
 * Loads all bookmarks across 114 surahs by merging legacy `bayan_bookmark_<surahNumber>` keys
 * with rich metadata stored in `bayan_bookmarks_meta_v1`. Sorted newest-first.
 */
export function loadAllBookmarks(): SavedBookmarkEntry[] {
  const metaMap = loadRawMetaMap();
  const merged = new Map<number, SavedBookmarkEntry>();

  // 1. Scan legacy single-key bookmarks in localStorage so pre-Phase-3 bookmarks appear immediately
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(BOOKMARK_KEY_PREFIX)) continue;
        const surahStr = key.slice(BOOKMARK_KEY_PREFIX.length);
        const surahNumber = Number(surahStr);
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) continue;

        const ayahNumber = Number(safeLocalStorage.getItem(key));
        if (!Number.isInteger(ayahNumber) || ayahNumber < 1) continue;

        const existingMeta = metaMap[String(surahNumber)];
        if (existingMeta && existingMeta.ayahNumber === ayahNumber) {
          merged.set(surahNumber, existingMeta);
        } else {
          merged.set(surahNumber, {
            surahNumber,
            surahName: existingMeta?.surahName || getSurahNameFallback(surahNumber),
            ayahNumber,
            page: existingMeta?.page || getSurahStartPageFallback(surahNumber),
            ayahSnippet: existingMeta?.ayahNumber === ayahNumber ? existingMeta.ayahSnippet : undefined,
            label: existingMeta?.label || 'وقف القراءة',
            savedAt: existingMeta?.savedAt || new Date().toISOString(),
          });
        }
      }
    } catch {
      // Fallback to metaMap if storage iteration fails
    }
  }

  // Fallback if window.localStorage enumeration wasn't populated but metaMap has valid entries
  if (merged.size === 0) {
    for (const entry of Object.values(metaMap)) {
      const legacyVal = safeLocalStorage.getItem(`${BOOKMARK_KEY_PREFIX}${entry.surahNumber}`);
      if (legacyVal === null || Number(legacyVal) === entry.ayahNumber) {
        if (legacyVal !== null) {
          merged.set(entry.surahNumber, entry);
        }
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getBookmarkMapBySurah(): Record<number, number> {
  const entries = loadAllBookmarks();
  const map: Record<number, number> = {};
  for (const entry of entries) {
    map[entry.surahNumber] = entry.ayahNumber;
  }
  return map;
}

export function toggleSurahBookmark(input: {
  surahNumber: number;
  surahName?: string;
  ayahNumber: number;
  page?: number;
  ayahSnippet?: string;
  label?: BookmarkCategoryLabel;
}): { bookmarkedAyah: number | null; entries: SavedBookmarkEntry[] } {
  const { surahNumber, ayahNumber } = input;
  const legacyKey = `${BOOKMARK_KEY_PREFIX}${surahNumber}`;
  const currentAyah = Number(safeLocalStorage.getItem(legacyKey) || 0) || null;
  const metaMap = loadRawMetaMap();

  if (currentAyah === ayahNumber) {
    safeLocalStorage.removeItem(legacyKey);
    delete metaMap[String(surahNumber)];
    safeLocalStorage.setJSON(BOOKMARKS_META_STORAGE_KEY, metaMap);
    const entries = loadAllBookmarks();
    emitBookmarksUpdated(entries);
    return { bookmarkedAyah: null, entries };
  }

  const nextEntry: SavedBookmarkEntry = {
    surahNumber,
    surahName: input.surahName?.trim() || getSurahNameFallback(surahNumber),
    ayahNumber,
    page:
      typeof input.page === 'number' && Number.isFinite(input.page) && input.page >= 1
        ? Math.floor(input.page)
        : getSurahStartPageFallback(surahNumber),
    ayahSnippet: input.ayahSnippet ? input.ayahSnippet.trim().slice(0, 140) : undefined,
    label: normalizeBookmarkLabel(input.label ?? metaMap[String(surahNumber)]?.label),
    savedAt: new Date().toISOString(),
  };

  safeLocalStorage.setItem(legacyKey, String(ayahNumber));
  metaMap[String(surahNumber)] = nextEntry;
  safeLocalStorage.setJSON(BOOKMARKS_META_STORAGE_KEY, metaMap);

  const entries = loadAllBookmarks();
  emitBookmarksUpdated(entries);
  return { bookmarkedAyah: ayahNumber, entries };
}

export function updateBookmarkLabel(
  surahNumber: number,
  label: BookmarkCategoryLabel
): SavedBookmarkEntry[] {
  const entries = loadAllBookmarks();
  const target = entries.find((e) => e.surahNumber === surahNumber);
  if (!target) return entries;

  const metaMap = loadRawMetaMap();
  metaMap[String(surahNumber)] = {
    ...target,
    label: normalizeBookmarkLabel(label),
  };
  safeLocalStorage.setJSON(BOOKMARKS_META_STORAGE_KEY, metaMap);

  const updated = loadAllBookmarks();
  emitBookmarksUpdated(updated);
  return updated;
}

export function removeSurahBookmark(surahNumber: number): SavedBookmarkEntry[] {
  safeLocalStorage.removeItem(`${BOOKMARK_KEY_PREFIX}${surahNumber}`);
  const metaMap = loadRawMetaMap();
  if (metaMap[String(surahNumber)]) {
    delete metaMap[String(surahNumber)];
    safeLocalStorage.setJSON(BOOKMARKS_META_STORAGE_KEY, metaMap);
  }
  const updated = loadAllBookmarks();
  emitBookmarksUpdated(updated);
  return updated;
}
