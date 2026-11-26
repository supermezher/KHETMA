import { describe, expect, it } from 'vitest';
import { MAX_BACKUP_FILE_BYTES, validateAndParseUserBackup } from '../utils/userBackup';
import { PartClaim, sanitizeLocalKhatmaParts } from '../data/khatmaApiService';
import { SecretRateLimiter } from '../server/khatmaStore';

function buildFallbackParts(): PartClaim[] {
  return Array.from({ length: 30 }, (_, i) => ({
    juzNumber: i + 1,
    juzName: `الجزء ${i + 1}`,
    claimedBy: null,
    isCompleted: false,
  }));
}

describe('User backup size limits & deep field sanitization', () => {
  it('rejects backup payloads exceeding 5 MB before JSON.parse', () => {
    const oversized = '{"app":"bayan-quran","version":2,"pad":"' + 'a'.repeat(MAX_BACKUP_FILE_BYTES + 100) + '"}';
    const res = validateAndParseUserBackup(oversized);
    expect(res.ok).toBe(false);
  });

  it('sanitizes corrupted faithStats, SRS cards, khatmaPlan, quizStats, bookmarksMeta, and readerPrefs', () => {
    const dirtyBackup = JSON.stringify({
      app: 'bayan-quran',
      version: 2,
      exportedAt: '2026-11-25T00:00:00Z',
      journalNotes: [],
      faithStats: {
        totalAyahs: 'invalid-nan',
        totalMinutes: -50,
        completedKhatmas: 2,
        currentKhatmaPage: 9999,
        streakDays: 'bad',
        thisWeekAyahs: 15,
        lastActiveDate: 'not-a-date',
        history: {
          '2026-11-25': { ayahs: 12, minutes: 8 },
          badKey: { ayahs: 99, minutes: 99 },
        },
      },
      memorizationSrs: {
        '1:1': { status: 'mastered', intervalDays: 7, nextReviewDate: '2026-12-01', repetitions: 2, lastReviewedAt: '2026-11-25' },
        'bad-key': { status: 'mastered', intervalDays: 7 },
        '2:1': { status: 'hacked-status', intervalDays: 7 },
      },
      bookmarks: {
        bayan_bookmark_1: '5',
        bayan_bookmark_999: '1',
      },
      bookmarksMeta: {
        '1': { surahNumber: 1, ayahNumber: 5, label: 'invalid-label', page: 1 },
        '999': { surahNumber: 999, ayahNumber: 1 },
      },
      khatmaPlan: {
        targetDays: 30,
        availableMinutesPerDay: 20,
        pagesPerDay: 20,
        pagesPerPrayer: 4,
        createdAt: '2026-11-25',
        dailyReadLog: { date: '2026-11-25', pages: [1, 2, 9999, -5] },
      },
      tajweedMastered: ['ghunnah', 123, '', 'ikhfa'],
      tajweedQuizStats: {
        'noon-meem': { answered: 5, correct: 99 },
        madd: 'corrupt',
      },
      readerPrefs: {
        theme: 'malicious',
        fontSize: 999,
        autoScrollSpeed: 0.5,
        isTajweedActive: 'yes',
      },
    });

    const parsed = validateAndParseUserBackup(dirtyBackup);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data.faithStats).toEqual({
      totalAyahs: 0,
      totalMinutes: 0,
      completedKhatmas: 2,
      currentKhatmaPage: 604,
      streakDays: 0,
      thisWeekAyahs: 15,
      lastActiveDate: null,
      history: { '2026-11-25': { ayahs: 12, minutes: 8 } },
    });
    expect(Object.keys(parsed.data.memorizationSrs)).toEqual(['1:1']);
    expect(parsed.data.bookmarks).toEqual({ bayan_bookmark_1: '5' });
    expect((parsed.data.bookmarksMeta?.['1'] as { label: string }).label).toBe('وقف القراءة');
    expect(parsed.data.bookmarksMeta?.['999']).toBeUndefined();
    expect((parsed.data.khatmaPlan?.dailyReadLog as { pages: number[] }).pages).toEqual([1, 2]);
    expect(parsed.data.tajweedMastered).toEqual(['ghunnah', 'ikhfa']);
    expect(parsed.data.tajweedQuizStats).toEqual({
      'noon-meem': { answered: 5, correct: 5 },
      madd: { answered: 0, correct: 0 },
      articulation: { answered: 0, correct: 0 },
      makharij: { answered: 0, correct: 0 },
    });
    expect(parsed.data.readerPrefs).toEqual({
      fontSize: 48,
      autoScrollSpeed: 0.5,
    });
  });

  it('sanitizes localStorage collective khatma parts and recovers cleanly from malformed items', () => {
    const fallback = buildFallbackParts();
    const cleaned = sanitizeLocalKhatmaParts(
      [
        null,
        { juzNumber: 0, claimedBy: 'x' },
        { juzNumber: 35, claimedBy: 'y' },
        { juzNumber: 1, claimedBy: 123 },
        { juzNumber: 2, claimedBy: ' أحمد ', isCompleted: true },
        { juzNumber: 3, claimedBy: null, isCompleted: true },
      ],
      fallback
    );

    expect(cleaned).toHaveLength(30);
    expect(cleaned[0].claimedBy).toBeNull();
    expect(cleaned[1].claimedBy).toBe('أحمد');
    expect(cleaned[1].isCompleted).toBe(true);
    // Unclaimed part cannot stay marked completed
    expect(cleaned[2].claimedBy).toBeNull();
    expect(cleaned[2].isCompleted).toBe(false);

    expect(sanitizeLocalKhatmaParts('not-an-array', fallback)).toBe(fallback);
  });

  it('expires stale unblocked window counts cleanly on SecretRateLimiter.recordAttempt', () => {
    const limiter = new SecretRateLimiter(3, 10_000);
    const t0 = 1_000_000;
    limiter.recordAttempt('k', t0);
    limiter.recordAttempt('k', t0 + 100);
    // Window expires after 10_000ms without hitting block limit
    limiter.recordAttempt('k', t0 + 15_000);
    limiter.recordAttempt('k', t0 + 15_100);
    expect(limiter.check('k', t0 + 15_200).allowed).toBe(true);
  });
});
