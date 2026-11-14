import { beforeEach, describe, expect, it } from 'vitest';
import { sanitizeAyahText } from '../data/quranService';
import { normalizeArabicText } from '../utils/arabicNormalize';
import {
  addDaysLocal,
  formatLocalDate,
  loadFaithStats,
  recordAyahReadActivity,
  recordPageProgress,
} from '../data/faithAnalyticsService';
import { computeNextSrsState } from '../components/MemorizationMode';
import {
  buildUserBackupPayload,
  restoreUserBackupData,
  validateAndParseUserBackup,
} from '../utils/userBackup';
import { resolveAudioEndedTransition } from '../components/AudioPlayerBar';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: mockStorage },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });

  return store;
}

describe('Quran text normalization & sanitization', () => {
  it('strips UTF-8 BOM and removes prefixed Bismillah on Surah != 1 Ayah 1 only', () => {
    const withBom = '\uFEFFبِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ قُلْ هُوَ ٱللَّهُ أَحَدٌ';
    expect(sanitizeAyahText(withBom, 112, 1)).toBe('قُلْ هُوَ ٱللَّهُ أَحَدٌ');

    // Al-Fatiha ayah 1 keeps Bismillah cleanly without BOM
    const fatiha1 = '\uFEFFبِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
    expect(sanitizeAyahText(fatiha1, 1, 1)).toBe('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ');
  });

  it('normalizes Arabic text for search regardless of tashkeel or hamza forms', () => {
    expect(normalizeArabicText('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')).toBe('بسم الله الرحمن الرحيم');
    expect(normalizeArabicText('آلُ إِبْرَاهِيمَ وَالمُؤْمِنُونَ')).toBe('ال ابراهيم والمومنون');
    expect(normalizeArabicText('الصَّلَاةُ عَلَىٰ النَّبِيِّ')).toBe('الصلاه علي النبي');
  });
});

describe('Memorization SRS scheduler & Faith Analytics', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('computes accurate local-calendar spaced repetition intervals', () => {
    const base = new Date(2026, 2, 10); // 2026-03-10

    const firstMastered = computeNextSrsState(undefined, 'mastered', base);
    expect(firstMastered.intervalDays).toBe(7);
    expect(firstMastered.repetitions).toBe(1);
    expect(firstMastered.nextReviewDate).toBe(formatLocalDate(addDaysLocal(base, 7)));
    expect(firstMastered.nextReviewDate).toBe('2026-03-17');

    const secondMastered = computeNextSrsState(firstMastered, 'mastered', addDaysLocal(base, 7));
    expect(secondMastered.intervalDays).toBe(18);
    expect(secondMastered.repetitions).toBe(2);

    const resetReview = computeNextSrsState(secondMastered, 'needs-review', base);
    expect(resetReview.intervalDays).toBe(1);
    expect(resetReview.repetitions).toBe(0);
    expect(resetReview.nextReviewDate).toBe('2026-03-11');
  });

  it('guards against false Khatma completion jumps while crediting sequential completion', () => {
    // Jumping from page 1 to page 604 with 0 ayahs should NOT count a khatma
    recordPageProgress(604);
    expect(loadFaithStats().completedKhatmas).toBe(0);

    // Reading >= 50 ayahs and progressing from page 590 -> 604 SHOULD count 1 khatma
    recordAyahReadActivity(60, 20);
    recordPageProgress(590);
    recordPageProgress(604);
    const updated = loadFaithStats();
    expect(updated.completedKhatmas).toBe(1);
    expect(updated.totalAyahs).toBe(60);
    expect(updated.streakDays).toBe(1);
  });
});

describe('User backup export, validation & restore', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('exports, validates, and restores notes, bookmarks, and SRS cards cleanly', () => {
    window.localStorage.setItem(
      'bayan_journal_notes',
      JSON.stringify([{ ayahId: 1, surahNumber: 1, surahName: 'الفاتحة', ayahNumber: 1, text: 'خاطرة', date: '2026-03-10' }])
    );
    window.localStorage.setItem('bayan_bookmark_2', '255');
    window.localStorage.setItem('bayan_memorization_srs_v2', JSON.stringify({ '1:1': { status: 'mastered', intervalDays: 7, nextReviewDate: '2026-03-17', repetitions: 1, lastReviewedAt: '2026-03-10' } }));

    const backup = buildUserBackupPayload();
    const raw = JSON.stringify(backup);

    // Clear storage and validate round-trip restore
    window.localStorage.clear();
    const parsed = validateAndParseUserBackup(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const counts = restoreUserBackupData(parsed.data);
      expect(counts).toEqual({ notesCount: 1, bookmarksCount: 1, srsCount: 1 });
      expect(window.localStorage.getItem('bayan_bookmark_2')).toBe('255');
    }

    expect(validateAndParseUserBackup('{"app":"other"}').ok).toBe(false);
    expect(validateAndParseUserBackup('{invalid-json').ok).toBe(false);
  });
});

describe('Memorization Loop single-ayah playback & repeat transitions', () => {
  it('stops cleanly after 1 ayah in memorization mode without advancing through the rest of the Surah', () => {
    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 1,
        repeatMode: 'none',
        currentRepeatCount: 1,
        currentAyahNumber: 2,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'stop' });
  });

  it('repeats the exact same ayah 2 or 3 times when selected, then stops cleanly', () => {
    // 2x repeat
    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 2,
        repeatMode: 'none',
        currentRepeatCount: 1,
        currentAyahNumber: 3,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'replay-same-ayah', nextRepeatCount: 2 });

    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 2,
        repeatMode: 'none',
        currentRepeatCount: 2,
        currentAyahNumber: 3,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'stop' });

    // 3x repeat
    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 3,
        repeatMode: 'none',
        currentRepeatCount: 1,
        currentAyahNumber: 3,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'replay-same-ayah', nextRepeatCount: 2 });

    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 3,
        repeatMode: 'none',
        currentRepeatCount: 2,
        currentAyahNumber: 3,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'replay-same-ayah', nextRepeatCount: 3 });

    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: true,
        memorizationRepeatTarget: 3,
        repeatMode: 'none',
        currentRepeatCount: 3,
        currentAyahNumber: 3,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'stop' });
  });

  it('continues advancing sequentially only when outside memorization mode', () => {
    expect(
      resolveAudioEndedTransition({
        stopAfterAyahMode: false,
        memorizationRepeatTarget: 1,
        repeatMode: 'none',
        currentRepeatCount: 1,
        currentAyahNumber: 2,
        totalAyahs: 7,
      })
    ).toEqual({ type: 'advance-next-ayah', nextAyahNumber: 3 });
  });
});

