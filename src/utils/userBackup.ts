import { safeLocalStorage } from './safeStorage';
import { idbSet } from './quranIndexedDb';

export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  bookmarksMeta?: Record<string, unknown> | null;
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
const BOOKMARKS_META_KEY = 'bayan_bookmarks_meta_v1';
const CUSTOM_RUQYAH_KEY = 'bayan_custom_ruqyah_items';
const KHATMA_PLAN_KEY = 'bayan_khatma_plan';
const TAJWEED_MASTERED_KEY = 'bayan_tajweed_mastered_v1';
const TAJWEED_QUIZ_KEY = 'bayan_tajweed_quiz_stats_v1';
export const READER_PREFS_KEY = 'bayan_reader_prefs_v1';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length * 2;
}

export function sanitizeJournalNotesList(rawList: unknown): ValidatedJournalNote[] {
  if (!Array.isArray(rawList)) return [];
  const valid: ValidatedJournalNote[] = [];

  for (const item of rawList) {
    if (!isPlainObject(item)) continue;
    const ayahId = Number(item.ayahId);
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const date = typeof item.date === 'string' && item.date.trim()
      ? item.date.trim().slice(0, 32)
      : new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(ayahId) || ayahId < 1 || !text) continue;

    valid.push({
      ayahId: Math.floor(ayahId),
      surahNumber:
        typeof item.surahNumber === 'number' && Number.isInteger(item.surahNumber) && item.surahNumber >= 1 && item.surahNumber <= 114
          ? item.surahNumber
          : undefined,
      surahName: typeof item.surahName === 'string' ? item.surahName.slice(0, 60) : undefined,
      ayahNumber:
        typeof item.ayahNumber === 'number' && Number.isInteger(item.ayahNumber) && item.ayahNumber >= 1
          ? item.ayahNumber
          : undefined,
      text: text.slice(0, 5000),
      date,
    });
  }

  return valid;
}

export function sanitizeFaithStats(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null;

  const totalAyahs = Number(raw.totalAyahs);
  const totalMinutes = Number(raw.totalMinutes);
  const completedKhatmas = Number(raw.completedKhatmas);
  const currentKhatmaPage = Number(raw.currentKhatmaPage);
  const streakDays = Number(raw.streakDays);
  const thisWeekAyahs = Number(raw.thisWeekAyahs);

  const cleanHistory: Record<string, { ayahs: number; minutes: number }> = {};
  if (isPlainObject(raw.history)) {
    let count = 0;
    for (const [k, v] of Object.entries(raw.history)) {
      if (count >= 2000) break;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isPlainObject(v)) continue;
      const ayahs = Math.max(0, Math.round(Number(v.ayahs) || 0));
      const minutes = Math.max(0, Math.round((Number(v.minutes) || 0) * 100) / 100);
      cleanHistory[k] = { ayahs, minutes };
      count++;
    }
  }

  return {
    totalAyahs: Number.isFinite(totalAyahs) ? Math.max(0, Math.round(totalAyahs)) : 0,
    totalMinutes: Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0,
    completedKhatmas: Number.isFinite(completedKhatmas) ? Math.max(0, Math.round(completedKhatmas)) : 0,
    currentKhatmaPage: Number.isFinite(currentKhatmaPage)
      ? Math.min(604, Math.max(1, Math.round(currentKhatmaPage)))
      : 1,
    streakDays: Number.isFinite(streakDays) ? Math.max(0, Math.round(streakDays)) : 0,
    thisWeekAyahs: Number.isFinite(thisWeekAyahs) ? Math.max(0, Math.round(thisWeekAyahs)) : 0,
    lastActiveDate:
      typeof raw.lastActiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastActiveDate)
        ? raw.lastActiveDate
        : null,
    history: cleanHistory,
  };
}

export function sanitizeMemorizationSrs(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!/^\d{1,3}:\d{1,3}$/.test(key) || !isPlainObject(val)) continue;
    const [surahStr, ayahStr] = key.split(':');
    const surahNum = Number(surahStr);
    const ayahNum = Number(ayahStr);
    if (surahNum < 1 || surahNum > 114 || ayahNum < 1 || ayahNum > 286) continue;

    const status = val.status;
    if (status !== 'needs-review' && status !== 'good' && status !== 'mastered') continue;

    const intervalDays = Number(val.intervalDays);
    const repetitions = Number(val.repetitions);
    if (!Number.isFinite(intervalDays) || intervalDays < 0 || !Number.isFinite(repetitions) || repetitions < 0) {
      continue;
    }

    const nextReviewDate =
      typeof val.nextReviewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.nextReviewDate)
        ? val.nextReviewDate
        : new Date().toISOString().slice(0, 10);
    const lastReviewedAt =
      typeof val.lastReviewedAt === 'string' && val.lastReviewedAt.trim()
        ? val.lastReviewedAt.trim().slice(0, 40)
        : new Date().toISOString().slice(0, 10);

    out[key] = {
      status,
      intervalDays: Math.min(3650, Math.max(1, Math.round(intervalDays))),
      nextReviewDate,
      repetitions: Math.min(10000, Math.max(0, Math.round(repetitions))),
      lastReviewedAt,
    };
  }
  return out;
}

export function sanitizeBookmarksMeta(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const out: Record<string, unknown> = {};
  const validLabels = new Set(['وقف القراءة', 'مراجعة الحفظ', 'تدبر ودعاء', 'عام']);

  for (const [key, val] of Object.entries(raw)) {
    if (!isPlainObject(val)) continue;
    const surahNumber = Number(val.surahNumber ?? key);
    const ayahNumber = Number(val.ayahNumber);
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) continue;
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > 286) continue;

    const entry: Record<string, unknown> = {
      surahNumber,
      surahName:
        typeof val.surahName === 'string' && val.surahName.trim()
          ? val.surahName.trim().slice(0, 60)
          : `السورة ${surahNumber}`,
      ayahNumber,
      label: typeof val.label === 'string' && validLabels.has(val.label) ? val.label : 'وقف القراءة',
      savedAt:
        typeof val.savedAt === 'string' && val.savedAt.trim()
          ? val.savedAt.trim().slice(0, 40)
          : new Date().toISOString(),
    };

    if (typeof val.page === 'number' && Number.isFinite(val.page) && val.page >= 1 && val.page <= 604) {
      entry.page = Math.floor(val.page);
    }
    if (typeof val.ayahSnippet === 'string' && val.ayahSnippet.trim()) {
      entry.ayahSnippet = val.ayahSnippet.trim().slice(0, 140);
    }
    out[String(surahNumber)] = entry;
  }

  return out;
}

export function sanitizeCustomRuqyah(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const validCategories = new Set(['quranic', 'prophetic', 'sakina']);
  const out: unknown[] = [];

  for (const item of raw) {
    if (out.length >= 200) break;
    if (!isPlainObject(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 80) : '';
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '';
    const arabicText = typeof item.arabicText === 'string' ? item.arabicText.trim().slice(0, 4000) : '';
    const category = typeof item.category === 'string' && validCategories.has(item.category) ? item.category : null;
    if (!id || !title || !arabicText || !category) continue;

    const repeatRaw = Number(item.repeatTarget);
    const repeatTarget = Number.isFinite(repeatRaw) ? Math.min(100, Math.max(1, Math.round(repeatRaw))) : 3;

    const cleanAudioRefs: Array<{ surahNumber: number; startAyah: number; endAyah?: number }> = [];
    if (Array.isArray(item.audioRefs)) {
      for (const ref of item.audioRefs.slice(0, 20)) {
        if (!isPlainObject(ref)) continue;
        const surahNumber = Number(ref.surahNumber);
        const startAyah = Number(ref.startAyah);
        const endAyah = ref.endAyah !== undefined ? Number(ref.endAyah) : undefined;
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) continue;
        if (!Number.isInteger(startAyah) || startAyah < 1 || startAyah > 286) continue;
        cleanAudioRefs.push({
          surahNumber,
          startAyah,
          ...(endAyah !== undefined && Number.isInteger(endAyah) && endAyah >= startAyah && endAyah <= 286
            ? { endAyah }
            : {}),
        });
      }
    }

    out.push({
      id,
      category,
      title,
      source: typeof item.source === 'string' ? item.source.trim().slice(0, 160) : '',
      arabicText,
      repeatTarget,
      virtue: typeof item.virtue === 'string' ? item.virtue.trim().slice(0, 500) : '',
      ...(typeof item.grade === 'string' && item.grade.trim() ? { grade: item.grade.trim().slice(0, 120) } : {}),
      ...(typeof item.instruction === 'string' && item.instruction.trim()
        ? { instruction: item.instruction.trim().slice(0, 400) }
        : {}),
      ...(cleanAudioRefs.length > 0 ? { audioRefs: cleanAudioRefs } : {}),
    });
  }

  return out;
}

export function sanitizeKhatmaPlan(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const targetDays = Number(raw.targetDays);
  const availableMinutesPerDay = Number(raw.availableMinutesPerDay);
  const pagesPerDay = Number(raw.pagesPerDay);
  const pagesPerPrayer = Number(raw.pagesPerPrayer);
  if (
    !Number.isFinite(targetDays) ||
    targetDays < 1 ||
    !Number.isFinite(availableMinutesPerDay) ||
    availableMinutesPerDay < 1 ||
    !Number.isFinite(pagesPerDay) ||
    pagesPerDay <= 0 ||
    !Number.isFinite(pagesPerPrayer) ||
    pagesPerPrayer < 0
  ) {
    return undefined;
  }

  const out: Record<string, unknown> = {
    targetDays: Math.min(3650, Math.round(targetDays)),
    availableMinutesPerDay: Math.min(1440, Math.round(availableMinutesPerDay)),
    pagesPerDay: Math.min(604, Math.round(pagesPerDay * 100) / 100),
    pagesPerPrayer: Math.min(604, Math.round(pagesPerPrayer * 100) / 100),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt.trim().slice(0, 40)
        : new Date().toISOString(),
  };

  if (raw.goalMode === 'khatmas' || raw.goalMode === 'juz') out.goalMode = raw.goalMode;
  if (typeof raw.targetKhatmas === 'number' && Number.isFinite(raw.targetKhatmas) && raw.targetKhatmas >= 1) {
    out.targetKhatmas = Math.min(100, Math.round(raw.targetKhatmas));
  }
  if (typeof raw.targetJuzCount === 'number' && Number.isFinite(raw.targetJuzCount) && raw.targetJuzCount >= 1) {
    out.targetJuzCount = Math.min(300, Math.round(raw.targetJuzCount));
  }
  if (typeof raw.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)) {
    out.startDate = raw.startDate;
  }
  if (typeof raw.completedPages === 'number' && Number.isFinite(raw.completedPages) && raw.completedPages >= 0) {
    out.completedPages = Math.min(60400, Math.round(raw.completedPages));
  }
  if (
    isPlainObject(raw.dailyPrayersDone) &&
    typeof raw.dailyPrayersDone.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyPrayersDone.date) &&
    Array.isArray(raw.dailyPrayersDone.slots) &&
    raw.dailyPrayersDone.slots.length === 5
  ) {
    out.dailyPrayersDone = {
      date: raw.dailyPrayersDone.date,
      slots: raw.dailyPrayersDone.slots.map((s) => Boolean(s)),
    };
  }
  if (
    isPlainObject(raw.dailyReadLog) &&
    typeof raw.dailyReadLog.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyReadLog.date) &&
    Array.isArray(raw.dailyReadLog.pages)
  ) {
    const cleanPages = Array.from(
      new Set(
        raw.dailyReadLog.pages
          .map((p) => Number(p))
          .filter((p) => Number.isInteger(p) && p >= 1 && p <= 604)
      )
    );
    out.dailyReadLog = { date: raw.dailyReadLog.date, pages: cleanPages };
  }
  if (
    typeof raw.lastSyncedMushafPage === 'number' &&
    Number.isInteger(raw.lastSyncedMushafPage) &&
    raw.lastSyncedMushafPage >= 1 &&
    raw.lastSyncedMushafPage <= 604
  ) {
    out.lastSyncedMushafPage = raw.lastSyncedMushafPage;
  }
  if (typeof raw.lastUpdatedAt === 'string' && raw.lastUpdatedAt.trim()) {
    out.lastUpdatedAt = raw.lastUpdatedAt.trim().slice(0, 40);
  }

  return out;
}

export function sanitizeTajweedMastered(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const unique = new Set<string>();
  for (const item of raw) {
    if (unique.size >= 200) break;
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, 80);
    if (trimmed) unique.add(trimmed);
  }
  return Array.from(unique);
}

export function sanitizeTajweedQuizStats(raw: unknown): Record<string, { answered: number; correct: number }> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const keys = ['noon-meem', 'madd', 'articulation', 'makharij'] as const;
  const out: Record<string, { answered: number; correct: number }> = {};

  for (const k of keys) {
    const entry = raw[k];
    if (isPlainObject(entry)) {
      const answered = Math.max(0, Math.min(100000, Math.round(Number(entry.answered) || 0)));
      const correct = Math.max(0, Math.min(answered, Math.round(Number(entry.correct) || 0)));
      out[k] = { answered, correct };
    } else {
      out[k] = { answered: 0, correct: 0 };
    }
  }

  return out;
}

export function sanitizeReaderPrefs(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const out: Record<string, unknown> = {};

  if (raw.theme === 'parchment' || raw.theme === 'sepia' || raw.theme === 'dark' || raw.theme === 'emerald') {
    out.theme = raw.theme;
  }
  if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)) {
    out.fontSize = Math.min(48, Math.max(18, Math.round(raw.fontSize)));
  }
  if (typeof raw.isTajweedActive === 'boolean') {
    out.isTajweedActive = raw.isTajweedActive;
  }
  if (typeof raw.selectedReciterId === 'string' && raw.selectedReciterId.trim()) {
    out.selectedReciterId = raw.selectedReciterId.trim().slice(0, 60);
  }
  if (raw.readerMode === 'page' || raw.readerMode === 'surah') {
    out.readerMode = raw.readerMode;
  }
  if (typeof raw.isRuledLines === 'boolean') {
    out.isRuledLines = raw.isRuledLines;
  }
  if (typeof raw.autoAdvancePage === 'boolean') {
    out.autoAdvancePage = raw.autoAdvancePage;
  }
  if (typeof raw.autoScrollSpeed === 'number' && Number.isFinite(raw.autoScrollSpeed)) {
    out.autoScrollSpeed = Math.min(4, Math.max(0.25, Math.round(raw.autoScrollSpeed * 100) / 100));
  }
  if (typeof raw.adaptiveScrollPace === 'boolean') {
    out.adaptiveScrollPace = raw.adaptiveScrollPace;
  }
  if (typeof raw.isManualHighlightMode === 'boolean') {
    out.isManualHighlightMode = raw.isManualHighlightMode;
  }

  return Object.keys(out).length > 0 ? out : undefined;
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
  const bookmarksMeta = safeLocalStorage.getJSON<Record<string, unknown> | null>(BOOKMARKS_META_KEY, null);

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
    memorizationSrs: isPlainObject(memorizationSrs) ? memorizationSrs : {},
    bookmarks,
    bookmarksMeta: isPlainObject(bookmarksMeta) ? bookmarksMeta : null,
    customRuqyah: Array.isArray(customRuqyah) ? customRuqyah : [],
    khatmaPlan: isPlainObject(khatmaPlan) ? khatmaPlan : null,
    tajweedMastered: Array.isArray(tajweedMastered) ? tajweedMastered : [],
    tajweedQuizStats: isPlainObject(tajweedQuizStats) ? tajweedQuizStats : null,
    readerPrefs: isPlainObject(readerPrefs) ? readerPrefs : null,
  };
}

export function validateAndParseUserBackup(
  rawJson: string
): { ok: true; data: BayanUserBackup } | { ok: false; error: string } {
  if (typeof rawJson !== 'string' || !rawJson.trim()) {
    return { ok: false, error: 'تعذر قراءة الملف: الملف فارغ أو غير صالح' };
  }
  if (rawJson.length > MAX_BACKUP_FILE_BYTES || getUtf8ByteLength(rawJson) > MAX_BACKUP_FILE_BYTES) {
    return { ok: false, error: 'حجم ملف النسخة الاحتياطية يتجاوز الحد الأقصى المسموح به (5 ميجابايت)' };
  }

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
      !isPlainObject(parsed) ||
      parsed.app !== 'bayan-quran' ||
      (parsed.version !== 1 && parsed.version !== 2)
    ) {
      return { ok: false, error: 'صيغة ملف النسخ الاحتياطي غير صالحة أو لا تخص تطبيق بيان' };
    }

    const sanitizedBookmarks: Record<string, string> = {};
    if (isPlainObject(parsed.bookmarks)) {
      for (const [k, v] of Object.entries(parsed.bookmarks)) {
        if (/^bayan_bookmark_(\d{1,3})$/.test(k) && typeof v === 'string' && /^\d{1,3}$/.test(v)) {
          const surahNum = Number(k.slice(BOOKMARK_PREFIX.length));
          const ayahNum = Number(v);
          if (surahNum >= 1 && surahNum <= 114 && ayahNum >= 1 && ayahNum <= 286) {
            sanitizedBookmarks[k] = String(ayahNum);
          }
        }
      }
    }

    return {
      ok: true,
      data: {
        app: 'bayan-quran',
        version: parsed.version,
        exportedAt:
          typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim()
            ? parsed.exportedAt.trim().slice(0, 40)
            : new Date().toISOString(),
        journalNotes: sanitizeJournalNotesList(parsed.journalNotes),
        faithStats: sanitizeFaithStats(parsed.faithStats),
        memorizationSrs: sanitizeMemorizationSrs(parsed.memorizationSrs),
        bookmarks: sanitizedBookmarks,
        bookmarksMeta: sanitizeBookmarksMeta(parsed.bookmarksMeta),
        customRuqyah: sanitizeCustomRuqyah(parsed.customRuqyah),
        khatmaPlan: sanitizeKhatmaPlan(parsed.khatmaPlan),
        tajweedMastered: sanitizeTajweedMastered(parsed.tajweedMastered),
        tajweedQuizStats: sanitizeTajweedQuizStats(parsed.tajweedQuizStats),
        readerPrefs: sanitizeReaderPrefs(parsed.readerPrefs),
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
  if (backup.bookmarksMeta) {
    ok = safeLocalStorage.setJSON(BOOKMARKS_META_KEY, backup.bookmarksMeta) && ok;
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
