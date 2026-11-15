import { safeLocalStorage } from './safeStorage';
import { idbSet } from './quranIndexedDb';

export interface ValidatedJournalNote {
  ayahId: number;
  surahNumber?: number;
  surahName?: string;
  ayahNumber?: number;
  text: string;
  date: string;
}

export interface BayanUserBackup {
  app: 'bayan-quran';
  version: 1 | 2;
  exportedAt: string;
  journalNotes: ValidatedJournalNote[];
  faithStats: Record<string, unknown> | null;
  memorizationSrs: Record<string, unknown>;
  bookmarks: Record<string, string>;
  customRuqyah?: unknown[];
  khatmaPlan?: Record<string, unknown> | null;
  tajweedMastered?: unknown[];
  tajweedQuizStats?: Record<string, unknown> | null;
  readerPrefs?: Record<string, unknown> | null;
}

const JOURNAL_KEY = 'bayan_journal_notes';
const FAITH_KEY = 'bayan_faith_analytics_v2';
const SRS_KEY = 'bayan_memorization_srs_v2';
const BOOKMARK_PREFIX = 'bayan_bookmark_';
const CUSTOM_RUQYAH_KEY = 'bayan_custom_ruqyah_items';
const KHATMA_PLAN_KEY = 'bayan_khatma_plan';
const TAJWEED_MASTERED_KEY = 'bayan_tajweed_mastered_v1';
const TAJWEED_QUIZ_KEY = 'bayan_tajweed_quiz_stats_v1';
export const READER_PREFS_KEY = 'bayan_reader_prefs_v1';

export function sanitizeJournalNotesList(rawList: unknown): ValidatedJournalNote[] {
  if (!Array.isArray(rawList)) return [];
  const valid: ValidatedJournalNote[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const ayahId = Number(rec.ayahId);
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    const date = typeof rec.date === 'string' && rec.date.trim()
      ? rec.date.trim()
      : new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(ayahId) || ayahId < 1 || !text) continue;

    valid.push({
      ayahId: Math.floor(ayahId),
      surahNumber: typeof rec.surahNumber === 'number' && Number.isFinite(rec.surahNumber) ? rec.surahNumber : undefined,
      surahName: typeof rec.surahName === 'string' ? rec.surahName : undefined,
      ayahNumber: typeof rec.ayahNumber === 'number' && Number.isFinite(rec.ayahNumber) ? rec.ayahNumber : undefined,
      text,
      date,
    });
  }

  return valid;
}

export function buildUserBackupPayload(overrideNotes?: ValidatedJournalNote[]): BayanUserBackup {
  const journalNotes = overrideNotes
    ? sanitizeJournalNotesList(overrideNotes)
    : sanitizeJournalNotesList(safeLocalStorage.getJSON<unknown[]>(JOURNAL_KEY, []));
  const faithStats = safeLocalStorage.getJSON<Record<string, unknown> | null>(FAITH_KEY, null);
  const memorizationSrs = safeLocalStorage.getJSON<Record<string, unknown>>(SRS_KEY, {});
  const customRuqyah = safeLocalStorage.getJSON<unknown[]>(CUSTOM_RUQYAH_KEY, []);
  const khatmaPlan = safeLocalStorage.getJSON<Record<string, unknown> | null>(KHATMA_PLAN_KEY, null);
  const tajweedMastered = safeLocalStorage.getJSON<unknown[]>(TAJWEED_MASTERED_KEY, []);
  const tajweedQuizStats = safeLocalStorage.getJSON<Record<string, unknown> | null>(TAJWEED_QUIZ_KEY, null);
  const readerPrefs = safeLocalStorage.getJSON<Record<string, unknown> | null>(READER_PREFS_KEY, null);

  const bookmarks: Record<string, string> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(BOOKMARK_PREFIX)) {
          const val = safeLocalStorage.getItem(key);
          if (val) bookmarks[key] = val;
        }
      }
    } catch {
      // Ignore storage access restriction
    }
  }

  return {
    app: 'bayan-quran',
    version: 2,
    exportedAt: new Date().toISOString(),
    journalNotes,
    faithStats,
    memorizationSrs: memorizationSrs && typeof memorizationSrs === 'object' ? memorizationSrs : {},
    bookmarks,
    customRuqyah: Array.isArray(customRuqyah) ? customRuqyah : [],
    khatmaPlan: khatmaPlan && typeof khatmaPlan === 'object' ? khatmaPlan : null,
    tajweedMastered: Array.isArray(tajweedMastered) ? tajweedMastered : [],
    tajweedQuizStats: tajweedQuizStats && typeof tajweedQuizStats === 'object' ? tajweedQuizStats : null,
    readerPrefs: readerPrefs && typeof readerPrefs === 'object' ? readerPrefs : null,
  };
}

export function validateAndParseUserBackup(
  rawJson: string
): { ok: true; data: BayanUserBackup } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);

    // Compatibility with legacy standalone journal array exports
    if (Array.isArray(parsed)) {
      const sanitizedNotes = sanitizeJournalNotesList(parsed);
      return {
        ok: true,
        data: {
          app: 'bayan-quran',
          version: 2,
          exportedAt: new Date().toISOString(),
          journalNotes: sanitizedNotes,
          faithStats: null,
          memorizationSrs: {},
          bookmarks: {},
        },
      };
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.app !== 'bayan-quran' ||
      (parsed.version !== 1 && parsed.version !== 2)
    ) {
      return { ok: false, error: 'صيغة ملف النسخ الاحتياطي غير صالحة أو لا تخص تطبيق بيان' };
    }

    const sanitizedBookmarks: Record<string, string> = {};
    if (parsed.bookmarks && typeof parsed.bookmarks === 'object') {
      for (const [k, v] of Object.entries(parsed.bookmarks)) {
        if (/^bayan_bookmark_\d+$/.test(k) && typeof v === 'string' && /^\d+$/.test(v)) {
          sanitizedBookmarks[k] = v;
        }
      }
    }

    return {
      ok: true,
      data: {
        app: 'bayan-quran',
        version: parsed.version,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
        journalNotes: sanitizeJournalNotesList(parsed.journalNotes),
        faithStats: parsed.faithStats && typeof parsed.faithStats === 'object' ? parsed.faithStats : null,
        memorizationSrs: parsed.memorizationSrs && typeof parsed.memorizationSrs === 'object' ? parsed.memorizationSrs : {},
        bookmarks: sanitizedBookmarks,
        customRuqyah: Array.isArray(parsed.customRuqyah) ? parsed.customRuqyah : undefined,
        khatmaPlan: parsed.khatmaPlan && typeof parsed.khatmaPlan === 'object' ? parsed.khatmaPlan : undefined,
        tajweedMastered: Array.isArray(parsed.tajweedMastered) ? parsed.tajweedMastered : undefined,
        tajweedQuizStats:
          parsed.tajweedQuizStats && typeof parsed.tajweedQuizStats === 'object'
            ? parsed.tajweedQuizStats
            : undefined,
        readerPrefs: parsed.readerPrefs && typeof parsed.readerPrefs === 'object' ? parsed.readerPrefs : undefined,
      },
    };
  } catch {
    return { ok: false, error: 'تعذر قراءة الملف: تأكد من اختيار ملف JSON سليم' };
  }
}

export async function restoreUserBackupData(
  backup: BayanUserBackup
): Promise<{ notesCount: number; bookmarksCount: number; srsCount: number; persistedOk: boolean }> {
  let ok = safeLocalStorage.setJSON(JOURNAL_KEY, backup.journalNotes);
  await idbSet('user_data', JOURNAL_KEY, backup.journalNotes).catch(() => false);

  if (backup.faithStats) {
    ok = safeLocalStorage.setJSON(FAITH_KEY, backup.faithStats) && ok;
  }
  if (Object.keys(backup.memorizationSrs).length > 0) {
    ok = safeLocalStorage.setJSON(SRS_KEY, backup.memorizationSrs) && ok;
  }
  if (backup.customRuqyah !== undefined) {
    ok = safeLocalStorage.setJSON(CUSTOM_RUQYAH_KEY, backup.customRuqyah) && ok;
  }
  if (backup.khatmaPlan) {
    ok = safeLocalStorage.setJSON(KHATMA_PLAN_KEY, backup.khatmaPlan) && ok;
  }
  if (backup.tajweedMastered !== undefined) {
    ok = safeLocalStorage.setJSON(TAJWEED_MASTERED_KEY, backup.tajweedMastered) && ok;
  }
  if (backup.tajweedQuizStats) {
    ok = safeLocalStorage.setJSON(TAJWEED_QUIZ_KEY, backup.tajweedQuizStats) && ok;
  }
  if (backup.readerPrefs) {
    ok = safeLocalStorage.setJSON(READER_PREFS_KEY, backup.readerPrefs) && ok;
  }

  let bookmarksCount = 0;
  for (const [k, v] of Object.entries(backup.bookmarks)) {
    ok = safeLocalStorage.setItem(k, v) && ok;
    bookmarksCount++;
  }

  return {
    notesCount: backup.journalNotes.length,
    bookmarksCount,
    srsCount: Object.keys(backup.memorizationSrs).length,
    persistedOk: ok,
  };
}
