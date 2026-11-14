import { safeLocalStorage } from './safeStorage';

export interface BayanUserBackup {
  app: 'bayan-quran';
  version: 1;
  exportedAt: string;
  journalNotes: unknown[];
  faithStats: Record<string, unknown> | null;
  memorizationSrs: Record<string, unknown>;
  bookmarks: Record<string, string>;
}

const JOURNAL_KEY = 'bayan_journal_notes';
const FAITH_KEY = 'bayan_faith_analytics_v2';
const SRS_KEY = 'bayan_memorization_srs_v2';
const BOOKMARK_PREFIX = 'bayan_bookmark_';

export function buildUserBackupPayload(): BayanUserBackup {
  const journalNotes = safeLocalStorage.getJSON<unknown[]>(JOURNAL_KEY, []);
  const faithStats = safeLocalStorage.getJSON<Record<string, unknown> | null>(FAITH_KEY, null);
  const memorizationSrs = safeLocalStorage.getJSON<Record<string, unknown>>(SRS_KEY, {});
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
    version: 1,
    exportedAt: new Date().toISOString(),
    journalNotes: Array.isArray(journalNotes) ? journalNotes : [],
    faithStats,
    memorizationSrs: memorizationSrs && typeof memorizationSrs === 'object' ? memorizationSrs : {},
    bookmarks,
  };
}

export function validateAndParseUserBackup(rawJson: string): { ok: true; data: BayanUserBackup } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || parsed.app !== 'bayan-quran' || parsed.version !== 1) {
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
        version: 1,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
        journalNotes: Array.isArray(parsed.journalNotes) ? parsed.journalNotes : [],
        faithStats: parsed.faithStats && typeof parsed.faithStats === 'object' ? parsed.faithStats : null,
        memorizationSrs: parsed.memorizationSrs && typeof parsed.memorizationSrs === 'object' ? parsed.memorizationSrs : {},
        bookmarks: sanitizedBookmarks,
      },
    };
  } catch {
    return { ok: false, error: 'تعذر قراءة الملف: تأكد من اختيار ملف JSON سليم' };
  }
}

export function restoreUserBackupData(backup: BayanUserBackup): { notesCount: number; bookmarksCount: number; srsCount: number } {
  safeLocalStorage.setJSON(JOURNAL_KEY, backup.journalNotes);
  if (backup.faithStats) {
    safeLocalStorage.setJSON(FAITH_KEY, backup.faithStats);
  }
  safeLocalStorage.setJSON(SRS_KEY, backup.memorizationSrs);

  let bookmarksCount = 0;
  for (const [k, v] of Object.entries(backup.bookmarks)) {
    safeLocalStorage.setItem(k, v);
    bookmarksCount++;
  }

  return {
    notesCount: backup.journalNotes.length,
    bookmarksCount,
    srsCount: Object.keys(backup.memorizationSrs).length,
  };
}
