import { beforeEach, describe, expect, it } from 'vitest';
import {
  areRecitedWordsEquivalent,
  evaluateRecitationAgainstAyah,
  normalizeQuranWordForMatch,
} from '../utils/recitationMatcher';
import {
  getDailyWirdSummary,
  loadPersonalKhatmaPlan,
  recordMushafPageReadInWird,
  savePersonalKhatmaPlan,
} from '../utils/personalKhatma';

function installMemoryStorage() {
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
}

describe('Phase 2: Smart Quranic Voice Recitation Matcher', () => {
  it('matches Uthmani dagger-alef and special words against modern Arabic ASR transcripts', () => {
    expect(normalizeQuranWordForMatch('ٱلصَّلَوٰةَ')).toBe('الصلاه');
    expect(areRecitedWordsEquivalent('ٱلرَّحْمَـٰنِ', 'الرحمن')).toBe(true);
    expect(areRecitedWordsEquivalent('مَـٰلِكِ', 'مالك')).toBe(true);
    expect(areRecitedWordsEquivalent('ٱلْكِتَـٰبُ', 'الكتاب')).toBe(true);
    expect(areRecitedWordsEquivalent('ٱلْعَـٰلَمِينَ', 'العالمين')).toBe(true);
    expect(areRecitedWordsEquivalent('ٱلصَّلَوٰةَ', 'الصلاة')).toBe(true);
    expect(areRecitedWordsEquivalent('يَـٰٓأَيُّهَا', 'ياايها')).toBe(true);
  });

  it('ignores Quranic pause marks (waqf symbols) when counting and aligning Ayah words', () => {
    const words = ['ذَٰلِكَ', 'ٱلْكِتَـٰبُ', 'لَا', 'رَيْبَ', 'ۛ', 'فِيهِ', 'ۛ', 'هُدًى', 'لِّلْمُتَّقِينَ'];
    const full = evaluateRecitationAgainstAyah(words, 'ذلك الكتاب لا ريب فيه هدى للمتقين');

    expect(full.totalExpectedSpokenWords).toBe(7);
    expect(full.matchedCount).toBe(7);
    expect(full.matchedRawIndices).toEqual([0, 1, 2, 3, 5, 7, 8]);
    expect(full.accuracyPercent).toBe(100);
    expect(full.nextExpectedRawIndex).toBeNull();
    expect(full.isComplete).toBe(true);
  });

  it('tracks partial recitation, compound "يا أيها" splits, and points to next missed word', () => {
    const words = ['يَـٰٓأَيُّهَا', 'ٱلنَّاسُ', 'ٱعْبُدُوا۟', 'رَبَّكُمُ'];
    const partial = evaluateRecitationAgainstAyah(words, 'يا ايها الناس');

    expect(partial.matchedRawIndices).toEqual([0, 1]);
    expect(partial.matchedCount).toBe(2);
    expect(partial.accuracyPercent).toBe(50);
    expect(partial.nextExpectedRawIndex).toBe(2);
    expect(partial.isComplete).toBe(false);
  });

  it('aligns sequential words safely even when lookahead catches a skipped short word', () => {
    const words = ['بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَـٰنِ', 'ٱلرَّحِيمِ'];
    const res = evaluateRecitationAgainstAyah(words, 'بسم الرحمن الرحيم');

    expect(res.matchedRawIndices).toEqual([0, 2, 3]);
    expect(res.nextExpectedRawIndex).toBe(1);
    expect(res.isComplete).toBe(false);
  });
});

describe('Phase 2: Unified Daily Wird & Reading Progress Sync', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('returns safe no-op when no active personal Khatma plan exists', () => {
    const res = recordMushafPageReadInWird(12, new Date(2026, 10, 19));
    expect(res.updatedPlan).toBeNull();
    expect(res.addedPage).toBe(false);

    const summary = getDailyWirdSummary(null, new Date(2026, 10, 19));
    expect(summary.hasPlan).toBe(false);
    expect(summary.todayPagesRead).toBe(0);
  });

  it('credits unique Mus\'haf pages per calendar day without double-counting and rolls over cleanly next day', () => {
    const day1 = new Date(2026, 10, 19);
    const day2 = new Date(2026, 10, 20);

    savePersonalKhatmaPlan(
      {
        targetDays: 30,
        availableMinutesPerDay: 30,
        pagesPerDay: 20,
        pagesPerPrayer: 4,
        createdAt: '2026-11-19T08:00:00.000Z',
        goalMode: 'khatmas',
        targetKhatmas: 1,
        startDate: '2026-11-19',
        completedPages: 0,
      },
      day1
    );

    const first = recordMushafPageReadInWird(5, day1);
    expect(first.addedPage).toBe(true);
    expect(first.updatedPlan?.completedPages).toBe(1);
    expect(first.updatedPlan?.dailyReadLog?.pages).toEqual([5]);

    // Re-visiting same page same day should not double-count
    const duplicate = recordMushafPageReadInWird(5, day1);
    expect(duplicate.addedPage).toBe(false);
    expect(duplicate.updatedPlan?.completedPages).toBe(1);

    // Another page same day increments both dailyReadLog and completedPages
    const second = recordMushafPageReadInWird(6, day1);
    expect(second.addedPage).toBe(true);
    expect(second.updatedPlan?.completedPages).toBe(2);
    expect(second.updatedPlan?.dailyReadLog?.pages).toEqual([5, 6]);

    const summaryDay1 = getDailyWirdSummary(loadPersonalKhatmaPlan(day1), day1);
    expect(summaryDay1.hasPlan).toBe(true);
    expect(summaryDay1.todayPagesRead).toBe(2);
    expect(summaryDay1.dailyTargetPages).toBe(20);
    expect(summaryDay1.todayPercent).toBe(10);
    expect(summaryDay1.isTodayComplete).toBe(false);

    // On a new calendar day, previous completedPages persist while dailyReadLog starts fresh
    const summaryDay2BeforeRead = getDailyWirdSummary(loadPersonalKhatmaPlan(day2), day2);
    expect(summaryDay2BeforeRead.todayPagesRead).toBe(0);
    expect(summaryDay2BeforeRead.completedPages).toBe(2);

    const day2Read = recordMushafPageReadInWird(5, day2);
    expect(day2Read.addedPage).toBe(true);
    expect(day2Read.updatedPlan?.completedPages).toBe(3);
    expect(day2Read.updatedPlan?.dailyReadLog?.pages).toEqual([5]);
  });
});
