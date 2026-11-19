import { describe, expect, it } from 'vitest';
import { Ayah } from '../data/quranService';
import {
  buildFillBlankQuizPrompts,
  buildLinkingQuizPrompts,
  buildSurahPageSpans,
  computeMasterySummary,
  computePageMasteryStats,
  consumePendingMushafPageTarget,
  extractWordFirstLetterHint,
  filterAyahsInRange,
  findSurahForMushafPageFallback,
  findSurahsStartingOnMushafPage,
  getNextHiddenWordIndex,
  isMemorizationWordHidden,
  setPendingMushafPageTarget,
  consumePendingMushafPageState,
  SrsRecord,
} from '../utils/memorizationHelpers';

function makeSampleSurahAyahs(): Ayah[] {
  return [
    {
      numberInSurah: 1,
      overallNumber: 6226,
      text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      tafsir: 'قل يا محمد هو الله الواحد الأحد',
      juz: 30,
      page: 604,
      hizbQuarter: 240,
    },
    {
      numberInSurah: 2,
      overallNumber: 6227,
      text: 'ٱللَّهُ ٱلصَّمَدُ',
      tafsir: 'الله المقصود في الحوائج كلها',
      juz: 30,
      page: 604,
      hizbQuarter: 240,
    },
    {
      numberInSurah: 3,
      overallNumber: 6228,
      text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
      tafsir: 'ليس له ولد ولا والد',
      juz: 30,
      page: 604,
      hizbQuarter: 240,
    },
    {
      numberInSurah: 4,
      overallNumber: 6229,
      text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
      tafsir: 'ولم يكن له مثيل ولا شبيه',
      juz: 30,
      page: 604,
      hizbQuarter: 240,
    },
  ];
}

describe('Memorization Circle helpers', () => {
  it('extracts first Arabic grapheme cluster safely without orphan combining marks', () => {
    expect(extractWordFirstLetterHint('قُلْ')).toBe('قُـ');
    expect(extractWordFirstLetterHint('أَحَدٌ')).toBe('أَـ');
    expect(extractWordFirstLetterHint('و')).toBe('و');
    expect(extractWordFirstLetterHint('')).toBe('');
  });

  it('computes word hiding and progressive next-word hint indices across all patterns', () => {
    const empty = new Set<number>();

    expect(isMemorizationWordHidden(0, 'first-word-only', empty)).toBe(false);
    expect(isMemorizationWordHidden(1, 'first-word-only', empty)).toBe(true);
    expect(getNextHiddenWordIndex(4, 'first-word-only', empty)).toBe(1);

    expect(isMemorizationWordHidden(0, 'first-letter', empty)).toBe(true);
    expect(getNextHiddenWordIndex(4, 'first-letter', new Set([0, 1]))).toBe(2);

    expect(isMemorizationWordHidden(0, 'alternate-words', empty)).toBe(false);
    expect(isMemorizationWordHidden(1, 'alternate-words', empty)).toBe(true);
    expect(isMemorizationWordHidden(2, 'alternate-words', empty)).toBe(false);
    expect(getNextHiddenWordIndex(4, 'alternate-words', new Set([1]))).toBe(3);

    expect(getNextHiddenWordIndex(3, 'all-blank', new Set([0, 1, 2]))).toBeNull();
  });

  it('filters and clamps ayah spans reliably', () => {
    const ayahs = makeSampleSurahAyahs();
    expect(filterAyahsInRange(ayahs, 2, 3).map((a) => a.numberInSurah)).toEqual([2, 3]);
    expect(filterAyahsInRange(ayahs, 4, 2).map((a) => a.numberInSurah)).toEqual([2, 4].length ? [2, 3, 4] : []);
    expect(filterAyahsInRange(ayahs, -5, 99).map((a) => a.numberInSurah)).toEqual([1, 2, 3, 4]);
    expect(filterAyahsInRange([], 1, 5)).toEqual([]);
  });

  it('summarizes mastery breakdown and due-today counts accurately', () => {
    const ayahs = makeSampleSurahAyahs();
    const srsMap: Record<string, SrsRecord> = {
      '112:1': {
        status: 'mastered',
        intervalDays: 7,
        nextReviewDate: '2026-03-20',
        repetitions: 1,
        lastReviewedAt: '2026-03-13T10:00:00.000Z',
      },
      '112:2': {
        status: 'good',
        intervalDays: 3,
        nextReviewDate: '2026-03-10',
        repetitions: 1,
        lastReviewedAt: '2026-03-07T10:00:00.000Z',
      },
      '112:3': {
        status: 'needs-review',
        intervalDays: 1,
        nextReviewDate: '2026-03-11',
        repetitions: 0,
        lastReviewedAt: '2026-03-10T10:00:00.000Z',
      },
    };

    const summary = computeMasterySummary(ayahs, srsMap, 112, '2026-03-12');
    expect(summary).toEqual({
      total: 4,
      mastered: 1,
      good: 1,
      needsReview: 1,
      unrated: 1,
      dueCount: 3, // ayah 2 (past due), ayah 3 (past due), ayah 4 (unrated)
    });
  });

  it('builds duplicate-free linking and fill-in-the-blank quiz prompts', () => {
    const ayahs = makeSampleSurahAyahs();
    const range = filterAyahsInRange(ayahs, 1, 3);

    const linking = buildLinkingQuizPrompts(range, ayahs, 112);
    expect(linking.length).toBe(3);
    for (const item of linking) {
      const optionNums = item.options.map((o) => o.numberInSurah);
      expect(new Set(optionNums).size).toBe(optionNums.length);
      expect(optionNums).toContain(item.answerAyah.numberInSurah);
      expect(optionNums).not.toContain(item.promptAyah.numberInSurah);
    }

    const fillBlank = buildFillBlankQuizPrompts(ayahs, ayahs, 112);
    expect(fillBlank.length).toBeGreaterThan(0);
    for (const item of fillBlank) {
      expect(item.options).toContain(item.correctWord);
      expect(item.maskedWords[item.blankIndex]).toBe(item.correctWord);
      expect(new Set(item.options).size).toBe(item.options.length);
    }
  });

  it('groups Surah ayahs into authentic Mus\'haf page spans and computes per-page mastery', () => {
    const multiPageAyahs: Ayah[] = [
      { ...makeSampleSurahAyahs()[0], numberInSurah: 1, page: 2, juz: 1 },
      { ...makeSampleSurahAyahs()[1], numberInSurah: 2, page: 2, juz: 1 },
      { ...makeSampleSurahAyahs()[2], numberInSurah: 3, page: 3, juz: 1 },
      { ...makeSampleSurahAyahs()[3], numberInSurah: 4, page: 3, juz: 1 },
    ];

    const spans = buildSurahPageSpans(multiPageAyahs);
    expect(spans).toEqual([
      { pageNumber: 2, startAyah: 1, endAyah: 2, ayahCount: 2, juz: 1, hizbQuarter: 240 },
      { pageNumber: 3, startAyah: 3, endAyah: 4, ayahCount: 2, juz: 1, hizbQuarter: 240 },
    ]);

    const srsMap: Record<string, SrsRecord> = {
      '2:1': {
        status: 'mastered',
        intervalDays: 7,
        nextReviewDate: '2026-03-20',
        repetitions: 1,
        lastReviewedAt: '2026-03-13T10:00:00.000Z',
      },
      '2:2': {
        status: 'mastered',
        intervalDays: 7,
        nextReviewDate: '2026-03-20',
        repetitions: 1,
        lastReviewedAt: '2026-03-13T10:00:00.000Z',
      },
      '2:3': {
        status: 'good',
        intervalDays: 3,
        nextReviewDate: '2026-03-15',
        repetitions: 1,
        lastReviewedAt: '2026-03-12T10:00:00.000Z',
      },
    };

    const page2Stats = computePageMasteryStats(spans[0], multiPageAyahs, srsMap, 2, '2026-03-14');
    expect(page2Stats).toEqual({
      pageNumber: 2,
      totalAyahs: 2,
      masteredCount: 2,
      dueCount: 0,
      isFullyMastered: true,
      percent: 100,
    });

    const page3Stats = computePageMasteryStats(spans[1], multiPageAyahs, srsMap, 2, '2026-03-14');
    expect(page3Stats).toEqual({
      pageNumber: 3,
      totalAyahs: 2,
      masteredCount: 0,
      dueCount: 1,
      isFullyMastered: false,
      percent: 0,
    });
  });

  it('resolves Mus\'haf pages to owning Surahs and handles one-shot pending page navigation', () => {
    expect(findSurahForMushafPageFallback(1).number).toBe(1);
    expect(findSurahForMushafPageFallback(12).number).toBe(2);
    expect(findSurahForMushafPageFallback(50).number).toBe(3);
    expect(findSurahsStartingOnMushafPage(604).map((s) => s.number)).toEqual([112, 113, 114]);

    setPendingMushafPageTarget({ surahNumber: 18, pageNumber: 295 });
    expect(consumePendingMushafPageTarget(2)).toBeNull();
    expect(consumePendingMushafPageTarget(18)).toBe(295);
    expect(consumePendingMushafPageTarget(18)).toBeNull();

    setPendingMushafPageTarget({ surahNumber: 2, pageNumber: 3, reciteViewMode: 'full-page' });
    expect(consumePendingMushafPageState(2)).toEqual({
      pageNumber: 3,
      reciteViewMode: 'full-page',
    });
    expect(consumePendingMushafPageState(2)).toBeNull();
  });
});

