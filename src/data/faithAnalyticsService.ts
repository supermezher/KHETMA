import { safeLocalStorage } from '../utils/safeStorage';

export interface DailyActivityRecord {
  ayahs: number;
  minutes: number;
}

export interface FaithStats {
  totalAyahs: number;
  totalMinutes: number;
  completedKhatmas: number;
  currentKhatmaPage: number;
  streakDays: number;
  thisWeekAyahs: number;
  lastActiveDate: string | null;
  history: Record<string, DailyActivityRecord>;
}

export interface HeatmapDay {
  date: string;
  ayahCount: number;
  minutes: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

const STORAGE_KEY = 'bayan_faith_analytics_v2';

export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysLocal(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function createEmptyStats(): FaithStats {
  return {
    totalAyahs: 0,
    totalMinutes: 0,
    completedKhatmas: 0,
    currentKhatmaPage: 1,
    streakDays: 0,
    thisWeekAyahs: 0,
    lastActiveDate: null,
    history: {},
  };
}

function computeStreakDays(history: Record<string, DailyActivityRecord>, today: Date = new Date()): number {
  const todayStr = formatLocalDate(today);
  const yesterdayStr = formatLocalDate(addDaysLocal(today, -1));

  let cursor: Date | null = null;
  if ((history[todayStr]?.ayahs || 0) > 0 || (history[todayStr]?.minutes || 0) > 0) {
    cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else if ((history[yesterdayStr]?.ayahs || 0) > 0 || (history[yesterdayStr]?.minutes || 0) > 0) {
    cursor = addDaysLocal(today, -1);
  }

  if (!cursor) return 0;

  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const dateKey = formatLocalDate(addDaysLocal(cursor, -i));
    const entry = history[dateKey];
    if (entry && (entry.ayahs > 0 || entry.minutes > 0)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function computeThisWeekAyahs(history: Record<string, DailyActivityRecord>, today: Date = new Date()): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const key = formatLocalDate(addDaysLocal(today, -i));
    sum += history[key]?.ayahs || 0;
  }
  return sum;
}

export function loadFaithStats(): FaithStats {
  const saved = safeLocalStorage.getJSON<Partial<FaithStats> | null>(STORAGE_KEY, null);
  if (!saved || typeof saved !== 'object') {
    return createEmptyStats();
  }

  const cleanHistory: Record<string, DailyActivityRecord> = {};
  if (saved.history && typeof saved.history === 'object') {
    for (const [k, v] of Object.entries(saved.history)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') {
        const ayahs = Math.max(0, Math.round(Number((v as DailyActivityRecord).ayahs) || 0));
        const minutes = Math.max(0, Number((v as DailyActivityRecord).minutes) || 0);
        cleanHistory[k] = { ayahs, minutes };
      }
    }
  }

  const today = new Date();
  const streakDays = computeStreakDays(cleanHistory, today);
  const thisWeekAyahs = computeThisWeekAyahs(cleanHistory, today);

  return {
    totalAyahs: Math.max(0, Math.round(Number(saved.totalAyahs) || 0)),
    totalMinutes: Math.max(0, Math.round(Number(saved.totalMinutes) || 0)),
    completedKhatmas: Math.max(0, Math.round(Number(saved.completedKhatmas) || 0)),
    currentKhatmaPage: Math.min(604, Math.max(1, Math.round(Number(saved.currentKhatmaPage) || 1))),
    streakDays,
    thisWeekAyahs,
    lastActiveDate: typeof saved.lastActiveDate === 'string' ? saved.lastActiveDate : null,
    history: cleanHistory,
  };
}

function saveFaithStats(stats: FaithStats): FaithStats {
  const normalized: FaithStats = {
    ...stats,
    totalMinutes: Math.round(stats.totalMinutes),
    streakDays: computeStreakDays(stats.history),
    thisWeekAyahs: computeThisWeekAyahs(stats.history),
  };
  safeLocalStorage.setJSON(STORAGE_KEY, normalized);
  return normalized;
}

export function recordAyahReadActivity(ayahCount: number, minutesDelta: number = 0): FaithStats {
  const stats = loadFaithStats();
  const safeAyahs = Math.max(0, Math.round(ayahCount));
  const safeMinutes = Math.max(0, Number(minutesDelta) || 0);
  if (safeAyahs === 0 && safeMinutes === 0) return stats;

  const todayStr = formatLocalDate(new Date());
  const prevToday = stats.history[todayStr] || { ayahs: 0, minutes: 0 };

  stats.history[todayStr] = {
    ayahs: prevToday.ayahs + safeAyahs,
    minutes: Math.round((prevToday.minutes + safeMinutes) * 100) / 100,
  };
  stats.totalAyahs += safeAyahs;
  stats.totalMinutes = Math.round(stats.totalMinutes + safeMinutes);
  stats.lastActiveDate = todayStr;

  return saveFaithStats(stats);
}

export function recordPageProgress(pageNumber: number): FaithStats {
  const safePage = Math.min(604, Math.max(1, Math.round(pageNumber || 1)));
  const stats = loadFaithStats();
  const prevPage = stats.currentKhatmaPage;

  // Guard against accidental page-jump from beginning straight to page 604 without real reading
  if (safePage === 604 && prevPage >= 580 && prevPage < 604 && stats.totalAyahs >= 50) {
    stats.completedKhatmas += 1;
  }

  stats.currentKhatmaPage = safePage;
  return saveFaithStats(stats);
}

export function generateRealHeatmapData(
  history: Record<string, DailyActivityRecord>,
  daysCount: number = 365
): HeatmapDay[] {
  const today = new Date();
  const result: HeatmapDay[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = addDaysLocal(today, -i);
    const dateStr = formatLocalDate(d);
    const entry = history[dateStr];
    const ayahCount = entry?.ayahs || 0;
    const minutes = Math.round(entry?.minutes || 0);

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (ayahCount >= 50) intensity = 4;
    else if (ayahCount >= 25) intensity = 3;
    else if (ayahCount >= 10) intensity = 2;
    else if (ayahCount >= 1) intensity = 1;

    result.push({
      date: dateStr,
      ayahCount,
      minutes,
      intensity,
    });
  }

  return result;
}
