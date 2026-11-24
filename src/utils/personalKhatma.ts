import { SURAHS_LIST } from '../data/quranMetadata';
import { safeLocalStorage } from './safeStorage';
import type { PartClaim } from '../data/khatmaApiService';
import type { AppLanguage } from './i18n';

export const PERSONAL_KHATMA_STORAGE_KEY = 'bayan_khatma_plan';
export const PERSONAL_KHATMA_EVENT = 'bayan:khatma-plan-updated';
export const MUSHAF_TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;

export type KhatmaGoalMode = 'khatmas' | 'juz';

export interface DailyPrayerLog {
  date: string; // YYYY-MM-DD local calendar
  slots: [boolean, boolean, boolean, boolean, boolean];
}

export interface DailyReadPageLog {
  date: string; // YYYY-MM-DD local calendar
  pages: number[];
}

export interface KhatmaPlan {
  // Legacy required fields preserved verbatim for 100% backward compatibility & safe rollback
  targetDays: number;
  availableMinutesPerDay: number;
  pagesPerDay: number;
  pagesPerPrayer: number;
  createdAt: string;

  // Optional personal Khatma fields
  goalMode?: KhatmaGoalMode;
  targetKhatmas?: number;
  targetJuzCount?: number;
  startDate?: string; // YYYY-MM-DD local calendar
  completedPages?: number;
  dailyPrayersDone?: DailyPrayerLog;
  dailyReadLog?: DailyReadPageLog;
  lastSyncedMushafPage?: number;
  lastUpdatedAt?: string;
}

export const PRAYER_LABELS = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'] as const;
export const PRAYER_LABELS_EN = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export function getPrayerDisplayLabel(index: number, lang: AppLanguage): string {
  const safeIdx = Math.max(0, Math.min(4, Math.floor(index)));
  return lang === 'en' ? PRAYER_LABELS_EN[safeIdx] : PRAYER_LABELS[safeIdx];
}

// Standard Medina Mushaf Juz start/end pages (1..604)
export const JUZ_PAGE_RANGES: Array<{ juz: number; startPage: number; endPage: number; surahsHint: string }> = [
  { juz: 1, startPage: 1, endPage: 21, surahsHint: 'الفاتحة — البقرة' },
  { juz: 2, startPage: 22, endPage: 41, surahsHint: 'البقرة' },
  { juz: 3, startPage: 42, endPage: 61, surahsHint: 'البقرة — آل عمران' },
  { juz: 4, startPage: 62, endPage: 81, surahsHint: 'آل عمران — النساء' },
  { juz: 5, startPage: 82, endPage: 101, surahsHint: 'النساء' },
  { juz: 6, startPage: 102, endPage: 121, surahsHint: 'النساء — المائدة' },
  { juz: 7, startPage: 122, endPage: 141, surahsHint: 'المائدة — الأنعام' },
  { juz: 8, startPage: 142, endPage: 161, surahsHint: 'الأنعام — الأعراف' },
  { juz: 9, startPage: 162, endPage: 181, surahsHint: 'الأعراف — الأنفال' },
  { juz: 10, startPage: 182, endPage: 201, surahsHint: 'الأنفال — التوبة' },
  { juz: 11, startPage: 202, endPage: 221, surahsHint: 'التوبة — هود' },
  { juz: 12, startPage: 222, endPage: 241, surahsHint: 'هود — يوسف' },
  { juz: 13, startPage: 242, endPage: 261, surahsHint: 'يوسف — إبراهيم' },
  { juz: 14, startPage: 262, endPage: 281, surahsHint: 'الحجر — النحل' },
  { juz: 15, startPage: 282, endPage: 301, surahsHint: 'الإسراء — الكهف' },
  { juz: 16, startPage: 302, endPage: 321, surahsHint: 'الكهف — طه' },
  { juz: 17, startPage: 322, endPage: 341, surahsHint: 'الأنبياء — الحج' },
  { juz: 18, startPage: 342, endPage: 361, surahsHint: 'المؤمنون — الفرقان' },
  { juz: 19, startPage: 362, endPage: 381, surahsHint: 'الفرقان — النمل' },
  { juz: 20, startPage: 382, endPage: 401, surahsHint: 'النمل — العنكبوت' },
  { juz: 21, startPage: 402, endPage: 421, surahsHint: 'العنكبوت — الأحزاب' },
  { juz: 22, startPage: 422, endPage: 441, surahsHint: 'الأحزاب — يس' },
  { juz: 23, startPage: 442, endPage: 461, surahsHint: 'يس — الزمر' },
  { juz: 24, startPage: 462, endPage: 481, surahsHint: 'الزمر — فصلت' },
  { juz: 25, startPage: 482, endPage: 501, surahsHint: 'فصلت — الجاثية' },
  { juz: 26, startPage: 502, endPage: 521, surahsHint: 'الأحقاف — الذاريات' },
  { juz: 27, startPage: 522, endPage: 541, surahsHint: 'الذاريات — الحديد' },
  { juz: 28, startPage: 542, endPage: 561, surahsHint: 'المجادلة — التحريم' },
  { juz: 29, startPage: 562, endPage: 581, surahsHint: 'الملك — المرسلات' },
  { juz: 30, startPage: 582, endPage: 604, surahsHint: 'النبأ — الناس' },
];

export function formatLocalDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffLocalCalendarDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.floor((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function getJuzForMushafPage(page: number): number {
  const safePage = Math.max(1, Math.min(MUSHAF_TOTAL_PAGES, Math.floor(page)));
  const match = JUZ_PAGE_RANGES.find((r) => safePage >= r.startPage && safePage <= r.endPage);
  return match ? match.juz : 1;
}

export function getSurahAtMushafPage(page: number): { surahNumber: number; surahName: string; juzNumber: number } {
  const safePage = Math.max(1, Math.min(MUSHAF_TOTAL_PAGES, Math.floor(page)));
  let best = SURAHS_LIST[0];
  for (const surah of SURAHS_LIST) {
    if (surah.startPage <= safePage) {
      best = surah;
    } else {
      break;
    }
  }
  return {
    surahNumber: best.number,
    surahName: best.name,
    juzNumber: getJuzForMushafPage(safePage),
  };
}

export function splitPagesAcrossFivePrayers(dailyPages: number): [number, number, number, number, number] {
  const total = Math.max(1, Math.round(dailyPages));
  const base = Math.floor(total / 5);
  const rem = total % 5;
  return [
    base + (rem > 0 ? 1 : 0),
    base + (rem > 1 ? 1 : 0),
    base + (rem > 2 ? 1 : 0),
    base + (rem > 3 ? 1 : 0),
    base + (rem > 4 ? 1 : 0),
  ];
}

export interface CalculatedPlanPreview {
  goalMode: KhatmaGoalMode;
  targetKhatmas: number;
  targetJuzCount: number;
  targetDays: number;
  totalPages: number;
  totalJuz: number;
  pagesPerDay: number;
  pagesPerPrayer: number;
  prayerSplit: [number, number, number, number, number];
  juzPerDay: number;
  estimatedMinutesNeeded: number;
}

export function calculateKhatmaPlanMetrics(params: {
  goalMode: KhatmaGoalMode;
  targetKhatmas: number;
  targetJuzCount: number;
  targetDays: number;
}): CalculatedPlanPreview {
  const safeDays = Math.min(365, Math.max(1, Math.round(params.targetDays || 30)));
  const goalMode: KhatmaGoalMode = params.goalMode === 'juz' ? 'juz' : 'khatmas';
  const targetKhatmas = Math.min(12, Math.max(1, Math.round(params.targetKhatmas || 1)));
  const targetJuzCount = Math.min(TOTAL_JUZ, Math.max(1, Math.round(params.targetJuzCount || 30)));

  const totalJuz = goalMode === 'juz' ? targetJuzCount : targetKhatmas * TOTAL_JUZ;
  const totalPages =
    goalMode === 'juz'
      ? Math.max(20, JUZ_PAGE_RANGES[targetJuzCount - 1]?.endPage ?? Math.round((targetJuzCount / 30) * MUSHAF_TOTAL_PAGES))
      : targetKhatmas * MUSHAF_TOTAL_PAGES;

  const pagesPerDay = Math.ceil(totalPages / safeDays);
  const prayerSplit = splitPagesAcrossFivePrayers(pagesPerDay);
  const pagesPerPrayer = Math.ceil(pagesPerDay / 5);
  const juzPerDay = Number((totalJuz / safeDays).toFixed(2));
  const estimatedMinutesNeeded = Math.max(2, Math.round(pagesPerDay * 1.5));

  return {
    goalMode,
    targetKhatmas,
    targetJuzCount,
    targetDays: safeDays,
    totalPages,
    totalJuz,
    pagesPerDay,
    pagesPerPrayer,
    prayerSplit,
    juzPerDay,
    estimatedMinutesNeeded,
  };
}

export interface PersonalKhatmaStats {
  goalMode: KhatmaGoalMode;
  targetKhatmas: number;
  targetJuzCount: number;
  targetDays: number;
  totalPages: number;
  totalJuz: number;
  completedPages: number;
  remainingPages: number;
  progressPercent: number;
  pagesPerDay: number;
  juzPerDay: number;
  prayerSplit: [number, number, number, number, number];
  todayPrayers: [boolean, boolean, boolean, boolean, boolean];
  currentDayIndex: number;
  remainingDays: number;
  expectedPagesByToday: number;
  lagPages: number;
  gentleSpreadPagesPerDay: number;
  extraDaysNeeded: number;
  currentKhatmaNumber: number;
  currentPageInCycle: number;
  todayRangeStartPage: number;
  todayRangeEndPage: number;
  todayStartJuz: number;
  todayEndJuz: number;
  isFinished: boolean;
  startDate: string;
}

export function normalizePersonalKhatmaPlan(raw: KhatmaPlan, todayDate: Date = new Date()): KhatmaPlan {
  const goalMode: KhatmaGoalMode = raw.goalMode === 'juz' ? 'juz' : 'khatmas';
  const targetKhatmas = Math.min(12, Math.max(1, Math.round(raw.targetKhatmas || 1)));
  const targetJuzCount = Math.min(TOTAL_JUZ, Math.max(1, Math.round(raw.targetJuzCount || 30)));
  const targetDays = Math.min(365, Math.max(1, Math.round(raw.targetDays || 30)));

  const metrics = calculateKhatmaPlanMetrics({
    goalMode,
    targetKhatmas,
    targetJuzCount,
    targetDays,
  });

  const todayIso = formatLocalDateISO(todayDate);
  const fallbackStart = raw.createdAt ? raw.createdAt.slice(0, 10) : todayIso;
  const startDate = raw.startDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate) ? raw.startDate : fallbackStart;

  const safeCompleted = Math.min(
    metrics.totalPages,
    Math.max(0, Math.round(typeof raw.completedPages === 'number' ? raw.completedPages : 0))
  );

  const slots: [boolean, boolean, boolean, boolean, boolean] =
    raw.dailyPrayersDone?.date === todayIso &&
    Array.isArray(raw.dailyPrayersDone.slots) &&
    raw.dailyPrayersDone.slots.length === 5
      ? [
          Boolean(raw.dailyPrayersDone.slots[0]),
          Boolean(raw.dailyPrayersDone.slots[1]),
          Boolean(raw.dailyPrayersDone.slots[2]),
          Boolean(raw.dailyPrayersDone.slots[3]),
          Boolean(raw.dailyPrayersDone.slots[4]),
        ]
      : [false, false, false, false, false];

  const rawPages =
    raw.dailyReadLog?.date === todayIso && Array.isArray(raw.dailyReadLog.pages)
      ? Array.from(
          new Set(
            raw.dailyReadLog.pages
              .map((p) => Math.floor(Number(p)))
              .filter((p) => Number.isFinite(p) && p >= 1 && p <= MUSHAF_TOTAL_PAGES)
          )
        )
      : [];

  return {
    targetDays,
    availableMinutesPerDay: Math.max(5, Math.round(raw.availableMinutesPerDay || 20)),
    pagesPerDay: raw.pagesPerDay > 0 ? Math.round(raw.pagesPerDay) : metrics.pagesPerDay,
    pagesPerPrayer: raw.pagesPerPrayer > 0 ? Math.round(raw.pagesPerPrayer) : metrics.pagesPerPrayer,
    createdAt: raw.createdAt || new Date().toISOString(),
    goalMode,
    targetKhatmas,
    targetJuzCount,
    startDate,
    completedPages: safeCompleted,
    dailyPrayersDone: {
      date: todayIso,
      slots,
    },
    dailyReadLog: {
      date: todayIso,
      pages: rawPages,
    },
    lastSyncedMushafPage:
      typeof raw.lastSyncedMushafPage === 'number' &&
      raw.lastSyncedMushafPage >= 1 &&
      raw.lastSyncedMushafPage <= MUSHAF_TOTAL_PAGES
        ? Math.floor(raw.lastSyncedMushafPage)
        : undefined,
    lastUpdatedAt: raw.lastUpdatedAt,
  };
}

export function computePersonalKhatmaStats(rawPlan: KhatmaPlan, todayDate: Date = new Date()): PersonalKhatmaStats {
  const plan = normalizePersonalKhatmaPlan(rawPlan, todayDate);
  const metrics = calculateKhatmaPlanMetrics({
    goalMode: plan.goalMode || 'khatmas',
    targetKhatmas: plan.targetKhatmas || 1,
    targetJuzCount: plan.targetJuzCount || 30,
    targetDays: plan.targetDays,
  });

  const todayIso = formatLocalDateISO(todayDate);
  const startDate = plan.startDate || todayIso;
  const elapsed = Math.max(0, diffLocalCalendarDays(startDate, todayIso));
  const currentDayIndex = Math.min(plan.targetDays, elapsed + 1);
  const remainingDays = Math.max(1, plan.targetDays - elapsed);

  const completedPages = plan.completedPages ?? 0;
  const remainingPages = Math.max(0, metrics.totalPages - completedPages);
  const progressPercent = metrics.totalPages > 0 ? Math.min(100, Math.round((completedPages / metrics.totalPages) * 100)) : 0;

  const expectedPagesByToday = Math.min(metrics.totalPages, currentDayIndex * plan.pagesPerDay);
  const lagPages = Math.max(0, expectedPagesByToday - completedPages);
  const gentleSpreadPagesPerDay = Math.ceil(remainingPages / remainingDays);
  const extraDaysNeeded = plan.pagesPerDay > 0 ? Math.max(1, Math.ceil(lagPages / plan.pagesPerDay)) : 1;

  const isFinished = completedPages >= metrics.totalPages;
  const currentKhatmaNumber = isFinished
    ? metrics.targetKhatmas
    : Math.min(metrics.targetKhatmas, Math.floor(completedPages / MUSHAF_TOTAL_PAGES) + 1);

  const cycleCompleted = isFinished ? MUSHAF_TOTAL_PAGES : completedPages % MUSHAF_TOTAL_PAGES;
  const currentPageInCycle = isFinished ? MUSHAF_TOTAL_PAGES : cycleCompleted + 1;
  const todayRangeStartPage = currentPageInCycle;
  const todayRangeEndPage = isFinished
    ? MUSHAF_TOTAL_PAGES
    : Math.min(MUSHAF_TOTAL_PAGES, currentPageInCycle + plan.pagesPerDay - 1);

  const todayStartJuz = getJuzForMushafPage(todayRangeStartPage);
  const todayEndJuz = getJuzForMushafPage(todayRangeEndPage);

  return {
    goalMode: metrics.goalMode,
    targetKhatmas: metrics.targetKhatmas,
    targetJuzCount: metrics.targetJuzCount,
    targetDays: plan.targetDays,
    totalPages: metrics.totalPages,
    totalJuz: metrics.totalJuz,
    completedPages,
    remainingPages,
    progressPercent,
    pagesPerDay: plan.pagesPerDay,
    juzPerDay: metrics.juzPerDay,
    prayerSplit: splitPagesAcrossFivePrayers(plan.pagesPerDay),
    todayPrayers: plan.dailyPrayersDone?.slots || [false, false, false, false, false],
    currentDayIndex,
    remainingDays,
    expectedPagesByToday,
    lagPages,
    gentleSpreadPagesPerDay,
    extraDaysNeeded,
    currentKhatmaNumber,
    currentPageInCycle,
    todayRangeStartPage,
    todayRangeEndPage,
    todayStartJuz,
    todayEndJuz,
    isFinished,
    startDate,
  };
}

/**
 * Builds 30 PartClaim descriptors for the KhatmaRing SVG emblem from the current cycle progress.
 */
export function buildPersonalRingParts(stats: PersonalKhatmaStats): PartClaim[] {
  const cycleEndPage =
    stats.goalMode === 'juz'
      ? stats.totalPages
      : stats.isFinished
      ? MUSHAF_TOTAL_PAGES
      : stats.completedPages % MUSHAF_TOTAL_PAGES;

  const currentJuz = getJuzForMushafPage(stats.currentPageInCycle);
  const targetJuzMax = stats.goalMode === 'juz' ? stats.targetJuzCount : TOTAL_JUZ;

  return JUZ_PAGE_RANGES.map((range) => {
    const withinTarget = range.juz <= targetJuzMax;
    const isCompleted = withinTarget && (stats.isFinished || cycleEndPage >= range.endPage);
    const isCurrent = withinTarget && !isCompleted && range.juz === currentJuz && cycleEndPage >= range.startPage - 1;

    return {
      juzNumber: range.juz,
      juzName: `الجزء ${range.juz}`,
      claimedBy: isCompleted ? '✓' : isCurrent ? '●' : null,
      isCompleted,
      surahsCovered: range.surahsHint,
    };
  });
}

export function loadPersonalKhatmaPlan(todayDate: Date = new Date()): KhatmaPlan | null {
  const raw = safeLocalStorage.getJSON<KhatmaPlan | null>(PERSONAL_KHATMA_STORAGE_KEY, null);
  if (!raw || typeof raw !== 'object' || typeof raw.targetDays !== 'number' || raw.targetDays <= 0) {
    return null;
  }
  return normalizePersonalKhatmaPlan(raw, todayDate);
}

export function savePersonalKhatmaPlan(plan: KhatmaPlan, todayDate: Date = new Date()): KhatmaPlan {
  const normalized = normalizePersonalKhatmaPlan(
    {
      ...plan,
      lastUpdatedAt: new Date().toISOString(),
    },
    todayDate
  );
  safeLocalStorage.setJSON(PERSONAL_KHATMA_STORAGE_KEY, normalized);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PERSONAL_KHATMA_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function clearPersonalKhatmaPlan(): void {
  safeLocalStorage.removeItem(PERSONAL_KHATMA_STORAGE_KEY);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PERSONAL_KHATMA_EVENT, { detail: null }));
  }
}

export interface DailyWirdSummary {
  hasPlan: boolean;
  todayPagesRead: number;
  todayPagesList: number[];
  dailyTargetPages: number;
  todayPercent: number;
  completedPages: number;
  totalPages: number;
  totalPercent: number;
  isTodayComplete: boolean;
}

export function getDailyWirdSummary(
  plan: KhatmaPlan | null,
  todayDate: Date = new Date()
): DailyWirdSummary {
  if (!plan) {
    return {
      hasPlan: false,
      todayPagesRead: 0,
      todayPagesList: [],
      dailyTargetPages: 0,
      todayPercent: 0,
      completedPages: 0,
      totalPages: MUSHAF_TOTAL_PAGES,
      totalPercent: 0,
      isTodayComplete: false,
    };
  }
  const normalized = normalizePersonalKhatmaPlan(plan, todayDate);
  const stats = computePersonalKhatmaStats(normalized, todayDate);
  const todayPagesList = normalized.dailyReadLog?.pages || [];
  const todayPagesRead = todayPagesList.length;
  const dailyTargetPages = Math.max(1, stats.pagesPerDay);
  const todayPercent = Math.min(100, Math.round((todayPagesRead / dailyTargetPages) * 100));

  return {
    hasPlan: true,
    todayPagesRead,
    todayPagesList,
    dailyTargetPages,
    todayPercent,
    completedPages: stats.completedPages,
    totalPages: stats.totalPages,
    totalPercent: stats.progressPercent,
    isTodayComplete: todayPagesRead >= dailyTargetPages || stats.isFinished,
  };
}

/**
 * Credits a Mus'haf page (1..604) into today's personal Khatma daily log once per calendar day.
 * Safe no-op when no active Personal Khatma plan exists.
 */
export function recordMushafPageReadInWird(
  pageNumber: number,
  todayDate: Date = new Date()
): { updatedPlan: KhatmaPlan | null; addedPage: boolean } {
  const existing = loadPersonalKhatmaPlan(todayDate);
  if (!existing) {
    return { updatedPlan: null, addedPage: false };
  }

  const safePage = Math.min(
    MUSHAF_TOTAL_PAGES,
    Math.max(1, Math.floor(Number.isFinite(pageNumber) ? pageNumber : 1))
  );
  const todayIso = formatLocalDateISO(todayDate);
  const normalized = normalizePersonalKhatmaPlan(existing, todayDate);
  const stats = computePersonalKhatmaStats(normalized, todayDate);
  const prevPages = normalized.dailyReadLog?.pages || [];

  if (prevPages.includes(safePage)) {
    if (normalized.lastSyncedMushafPage !== safePage) {
      const updated = savePersonalKhatmaPlan(
        {
          ...normalized,
          lastSyncedMushafPage: safePage,
        },
        todayDate
      );
      return { updatedPlan: updated, addedPage: false };
    }
    return { updatedPlan: normalized, addedPage: false };
  }

  const nextCompleted = Math.min(stats.totalPages, (normalized.completedPages || 0) + 1);
  const updated = savePersonalKhatmaPlan(
    {
      ...normalized,
      completedPages: nextCompleted,
      lastSyncedMushafPage: safePage,
      dailyReadLog: {
        date: todayIso,
        pages: [...prevPages, safePage],
      },
    },
    todayDate
  );

  return { updatedPlan: updated, addedPage: true };
}

