import { Ayah, sanitizeAyahText } from '../data/quranService';
import { SURAHS_LIST, SurahMeta } from '../data/quranMetadata';
import { formatLocalDate, addDaysLocal } from '../data/faithAnalyticsService';
import { splitArabicGraphemeClusters } from './tajweedParser';

export type MemorizationRepeatTarget = 1 | 2 | 3 | 'loop';
export type HidePattern = 'first-word-only' | 'first-letter' | 'alternate-words' | 'all-blank';
export type StudyTab = 'recite' | 'linking-quiz';
export type QuizMode = 'next-ayah' | 'fill-blank';
export type SrsRating = 'needs-review' | 'good' | 'mastered';
export type HifzScopeMode = 'ayah-range' | 'mushaf-page';
export type ReciteViewMode = 'single-ayah' | 'full-page';

export interface SrsRecord {
  status: SrsRating;
  intervalDays: number;
  nextReviewDate: string; // YYYY-MM-DD local
  repetitions: number;
  lastReviewedAt: string;
}

export const SRS_STORAGE_KEY = 'bayan_memorization_srs_v2';

export function computeNextSrsState(
  prev: SrsRecord | undefined,
  rating: SrsRating,
  today = new Date()
): SrsRecord {
  const prevReps = prev?.repetitions || 0;
  let intervalDays = 1;
  const repetitions = rating === 'needs-review' ? 0 : prevReps + 1;

  if (rating === 'needs-review') {
    intervalDays = 1;
  } else if (rating === 'good') {
    intervalDays = prev?.intervalDays ? Math.min(14, Math.max(3, Math.round(prev.intervalDays * 2))) : 3;
  } else {
    intervalDays = prev?.intervalDays ? Math.min(30, Math.max(7, Math.round(prev.intervalDays * 2.5))) : 7;
  }

  return {
    status: rating,
    intervalDays,
    nextReviewDate: formatLocalDate(addDaysLocal(today, intervalDays)),
    repetitions,
    lastReviewedAt: today.toISOString(),
  };
}

export function extractWordFirstLetterHint(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return '';
  const clusters = splitArabicGraphemeClusters(trimmed);
  const first = clusters[0] || trimmed.charAt(0);
  return clusters.length > 1 ? `${first}ـ` : first;
}

export function isMemorizationWordHidden(
  index: number,
  hidePattern: HidePattern,
  revealedIndices: ReadonlySet<number>
): boolean {
  if (revealedIndices.has(index)) return false;
  if (hidePattern === 'all-blank' || hidePattern === 'first-letter') return true;
  if (hidePattern === 'first-word-only') return index > 0;
  if (hidePattern === 'alternate-words') return index % 2 === 1;
  return false;
}

export function getNextHiddenWordIndex(
  wordCount: number,
  hidePattern: HidePattern,
  revealedIndices: ReadonlySet<number>
): number | null {
  for (let i = 0; i < wordCount; i++) {
    if (isMemorizationWordHidden(i, hidePattern, revealedIndices)) {
      return i;
    }
  }
  return null;
}

export function filterAyahsInRange(ayahs: Ayah[], startAyah: number, endAyah: number): Ayah[] {
  if (ayahs.length === 0) return [];
  const minBound = ayahs[0].numberInSurah;
  const maxBound = ayahs[ayahs.length - 1].numberInSurah;
  const normalizedStart = Math.max(minBound, Math.min(startAyah, endAyah));
  const normalizedEnd = Math.min(maxBound, Math.max(startAyah, endAyah));
  return ayahs.filter((a) => a.numberInSurah >= normalizedStart && a.numberInSurah <= normalizedEnd);
}

export interface MasterySummary {
  total: number;
  mastered: number;
  good: number;
  needsReview: number;
  unrated: number;
  dueCount: number;
}

export function computeMasterySummary(
  ayahs: Ayah[],
  srsMap: Record<string, SrsRecord>,
  surahNumber: number,
  todayStr: string
): MasterySummary {
  let mastered = 0;
  let good = 0;
  let needsReview = 0;
  let unrated = 0;
  let dueCount = 0;

  for (const ayah of ayahs) {
    const rec = srsMap[`${surahNumber}:${ayah.numberInSurah}`];
    if (!rec) {
      unrated += 1;
      dueCount += 1;
      continue;
    }
    if (rec.status === 'mastered') mastered += 1;
    else if (rec.status === 'good') good += 1;
    else needsReview += 1;

    if (rec.nextReviewDate <= todayStr) {
      dueCount += 1;
    }
  }

  return {
    total: ayahs.length,
    mastered,
    good,
    needsReview,
    unrated,
    dueCount,
  };
}

export interface LinkingQuizPrompt {
  id: string;
  promptAyah: Ayah;
  answerAyah: Ayah;
  options: Ayah[];
}

function deterministicScore(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 10000;
  return x - Math.floor(x);
}

export function buildLinkingQuizPrompts(
  rangeAyahs: Ayah[],
  allSurahAyahs: Ayah[],
  surahNumber: number
): LinkingQuizPrompt[] {
  if (allSurahAyahs.length < 2) return [];

  const ayahByNumber = new Map<number, Ayah>();
  for (const a of allSurahAyahs) {
    ayahByNumber.set(a.numberInSurah, a);
  }

  const prompts: LinkingQuizPrompt[] = [];
  for (let i = 0; i < rangeAyahs.length; i++) {
    const promptAyah = rangeAyahs[i];
    const nextAyah = ayahByNumber.get(promptAyah.numberInSurah + 1);
    if (!nextAyah) continue;

    const candidatePool = allSurahAyahs.filter(
      (candidate) =>
        candidate.numberInSurah !== nextAyah.numberInSurah &&
        candidate.numberInSurah !== promptAyah.numberInSurah
    );

    const distractors = [...candidatePool]
      .sort(
        (a, b) =>
          deterministicScore(a.numberInSurah, promptAyah.numberInSurah + surahNumber) -
          deterministicScore(b.numberInSurah, promptAyah.numberInSurah + surahNumber)
      )
      .slice(0, 3);

    const options = [nextAyah, ...distractors].sort(
      (a, b) =>
        deterministicScore(a.numberInSurah + 7, promptAyah.numberInSurah * 3) -
        deterministicScore(b.numberInSurah + 7, promptAyah.numberInSurah * 3)
    );

    prompts.push({
      id: `${surahNumber}:${promptAyah.numberInSurah}`,
      promptAyah,
      answerAyah: nextAyah,
      options,
    });
  }

  return prompts;
}

export interface FillBlankQuizPrompt {
  id: string;
  ayah: Ayah;
  maskedWords: string[];
  blankIndex: number;
  correctWord: string;
  options: string[];
}

function stripDiacriticsForComparison(word: string): string {
  return word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
}

export function buildFillBlankQuizPrompts(
  rangeAyahs: Ayah[],
  allSurahAyahs: Ayah[],
  surahNumber: number
): FillBlankQuizPrompt[] {
  const allSurahWords: string[] = [];
  for (const a of allSurahAyahs) {
    const clean = sanitizeAyahText(a.text, surahNumber, a.numberInSurah);
    for (const w of clean.split(/\s+/)) {
      const stripped = stripDiacriticsForComparison(w);
      if (stripped.length >= 2) {
        allSurahWords.push(w);
      }
    }
  }

  const prompts: FillBlankQuizPrompt[] = [];

  for (const ayah of rangeAyahs) {
    const clean = sanitizeAyahText(ayah.text, surahNumber, ayah.numberInSurah);
    const words = clean.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) continue;

    // Pick a substantive word (avoid index 0 if possible so verse opening gives context)
    const candidateIndices = words
      .map((w, idx) => ({ w, idx, baseLen: stripDiacriticsForComparison(w).length }))
      .filter((item) => item.idx > 0 && item.baseLen >= 3);

    const chosen =
      candidateIndices.length > 0
        ? candidateIndices[
            Math.floor(
              deterministicScore(ayah.numberInSurah, surahNumber) * candidateIndices.length
            )
          ]
        : { w: words[words.length - 1], idx: words.length - 1 };

    const correctNorm = stripDiacriticsForComparison(chosen.w);
    const seenNorms = new Set<string>([correctNorm]);
    const distractors: string[] = [];

    const sortedPool = [...allSurahWords].sort(
      (a, b) =>
        deterministicScore(a.length + a.charCodeAt(0), ayah.numberInSurah) -
        deterministicScore(b.length + b.charCodeAt(0), ayah.numberInSurah)
    );

    for (const candidate of sortedPool) {
      const norm = stripDiacriticsForComparison(candidate);
      if (!seenNorms.has(norm) && norm.length >= 2) {
        seenNorms.add(norm);
        distractors.push(candidate);
        if (distractors.length === 3) break;
      }
    }

    if (distractors.length < 1) continue;

    const options = [chosen.w, ...distractors].sort(
      (a, b) =>
        deterministicScore(a.charCodeAt(0), chosen.idx + ayah.numberInSurah) -
        deterministicScore(b.charCodeAt(0), chosen.idx + ayah.numberInSurah)
    );

    prompts.push({
      id: `${surahNumber}:${ayah.numberInSurah}:blank`,
      ayah,
      maskedWords: words,
      blankIndex: chosen.idx,
      correctWord: chosen.w,
      options,
    });
  }

  return prompts;
}

export interface MushafPageSpan {
  pageNumber: number;
  startAyah: number;
  endAyah: number;
  ayahCount: number;
  juz: number;
  hizbQuarter: number;
}

export interface PageMasteryStats {
  pageNumber: number;
  totalAyahs: number;
  masteredCount: number;
  dueCount: number;
  isFullyMastered: boolean;
  percent: number;
}

/**
 * Groups ordered Surah ayahs into exact Medina Mus'haf face (page) spans
 * using the verified `page`, `juz`, and `hizbQuarter` metadata on each Ayah.
 */
export function buildSurahPageSpans(ayahs: Ayah[]): MushafPageSpan[] {
  if (ayahs.length === 0) return [];
  const spans: MushafPageSpan[] = [];
  let current: MushafPageSpan | null = null;

  for (const ayah of ayahs) {
    const pageNum = Math.max(1, Math.min(604, ayah.page || 1));
    if (!current || current.pageNumber !== pageNum) {
      if (current) spans.push(current);
      current = {
        pageNumber: pageNum,
        startAyah: ayah.numberInSurah,
        endAyah: ayah.numberInSurah,
        ayahCount: 1,
        juz: ayah.juz || 1,
        hizbQuarter: ayah.hizbQuarter || 1,
      };
    } else {
      current.endAyah = ayah.numberInSurah;
      current.ayahCount += 1;
    }
  }

  if (current) spans.push(current);
  return spans;
}

/**
 * Computes SRS mastery breakdown for a given Mus'haf page span within a Surah.
 */
export function computePageMasteryStats(
  pageSpan: MushafPageSpan,
  ayahs: Ayah[],
  srsMap: Record<string, SrsRecord>,
  surahNumber: number,
  todayStr: string
): PageMasteryStats {
  const pageAyahs = filterAyahsInRange(ayahs, pageSpan.startAyah, pageSpan.endAyah);
  const summary = computeMasterySummary(pageAyahs, srsMap, surahNumber, todayStr);
  const percent =
    summary.total > 0 ? Math.round((summary.mastered / summary.total) * 100) : 0;
  return {
    pageNumber: pageSpan.pageNumber,
    totalAyahs: summary.total,
    masteredCount: summary.mastered,
    dueCount: summary.dueCount,
    isFullyMastered: summary.total > 0 && summary.mastered === summary.total,
    percent,
  };
}

/**
 * Offline fallback lookup on the 114-Surah Mus'haf matrix (`startPage`) to resolve
 * which Surah owns or starts on a given Mus'haf page (1..604).
 */
export function findSurahForMushafPageFallback(pageNumber: number): SurahMeta {
  const safePage = Math.max(1, Math.min(604, Math.round(pageNumber)));
  const startingHere = SURAHS_LIST.filter((s) => s.startPage === safePage);
  if (startingHere.length > 0) {
    return startingHere[0];
  }
  let candidate = SURAHS_LIST[0];
  for (const surah of SURAHS_LIST) {
    if (surah.startPage <= safePage) {
      candidate = surah;
    } else {
      break;
    }
  }
  return candidate;
}

/**
 * Returns Surahs known from metadata to start on the given Mus'haf page.
 */
export function findSurahsStartingOnMushafPage(pageNumber: number): SurahMeta[] {
  const safePage = Math.max(1, Math.min(604, Math.round(pageNumber)));
  return SURAHS_LIST.filter((s) => s.startPage === safePage);
}

export interface PendingMushafPageTarget {
  surahNumber: number;
  pageNumber: number;
}

let pendingMushafPageTarget: PendingMushafPageTarget | null = null;

export function setPendingMushafPageTarget(target: PendingMushafPageTarget | null): void {
  pendingMushafPageTarget = target;
}

export function consumePendingMushafPageTarget(surahNumber: number): number | null {
  if (pendingMushafPageTarget && pendingMushafPageTarget.surahNumber === surahNumber) {
    const page = pendingMushafPageTarget.pageNumber;
    pendingMushafPageTarget = null;
    return page;
  }
  return null;
}

