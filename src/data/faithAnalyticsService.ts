import { safeLocalStorage } from '../utils/safeStorage';

export interface DayActivity {
  date: string; // YYYY-MM-DD (Local)
  ayahCount: number;
  minutes: number;
}

export interface FaithStats {
  streakDays: number;
  totalAyahs: number;
  thisWeekAyahs: number;
  completedKhatmas: number;
  lastKhatmaDate: string | null;
  totalMinutes: number;
  currentKhatmaPage: number;
  history: Record<string, DayActivity>;
}

const STORAGE_KEY = 'bayan_faith_analytics_v2';

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysLocal(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function loadFaithStats(): FaithStats {
  const parsed = safeLocalStorage.getJSON<FaithStats | null>(STORAGE_KEY, null);
  if (parsed && typeof parsed.totalAyahs === 'number') {
    return calculateDynamicStats(parsed);
  }

  // Initial fresh user state (Honest 0 base until real reading/listening is recorded)
  const initial: FaithStats = {
    streakDays: 0,
    totalAyahs: 0,
    thisWeekAyahs: 0,
    completedKhatmas: 0,
    lastKhatmaDate: null,
    totalMinutes: 0,
    currentKhatmaPage: 1,
    history: {},
  };

  saveFaithStats(initial);
  return initial;
}

export function saveFaithStats(stats: FaithStats): void {
  safeLocalStorage.setJSON(STORAGE_KEY, stats);
}

function calculateDynamicStats(stats: FaithStats): FaithStats {
  const history = stats.history || {};
  const today = new Date();

  // Calculate real consecutive daily streak from local today backwards
  let streak = 0;
  const checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const todayStr = formatLocalDate(checkDate);
  const hasToday = Boolean(history[todayStr] && history[todayStr].ayahCount > 0);

  if (!hasToday) {
    // If not read today yet, check yesterday to preserve ongoing streak
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = formatLocalDate(checkDate);
    if (history[dateStr] && history[dateStr].ayahCount > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate this week's ayahs
  let weekAyahs = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dStr = formatLocalDate(d);
    if (history[dStr]) {
      weekAyahs += history[dStr].ayahCount || 0;
    }
  }

  // Total ayahs and minutes from history
  let totalAyahs = 0;
  let totalMinutes = 0;
  Object.values(history).forEach((h) => {
    totalAyahs += h.ayahCount || 0;
    totalMinutes += h.minutes || 0;
  });

  return {
    ...stats,
    streakDays: streak,
    totalAyahs,
    thisWeekAyahs: weekAyahs,
    totalMinutes: Math.round(totalMinutes),
    history,
  };
}

export function recordAyahReadActivity(ayahsCount = 1, minutesSpent = 0): void {
  if (ayahsCount <= 0 && minutesSpent <= 0) return;
  const stats = loadFaithStats();
  const todayStr = getTodayStr();

  if (!stats.history[todayStr]) {
    stats.history[todayStr] = {
      date: todayStr,
      ayahCount: 0,
      minutes: 0,
    };
  }

  stats.history[todayStr].ayahCount += Math.max(0, ayahsCount);
  stats.history[todayStr].minutes += Math.max(0, minutesSpent);

  const updated = calculateDynamicStats(stats);
  saveFaithStats(updated);
}

export function recordPageProgress(pageNum: number): void {
  const stats = loadFaithStats();
  const prevPage = stats.currentKhatmaPage || 1;
  const clampedPage = Math.min(604, Math.max(1, pageNum));
  stats.currentKhatmaPage = clampedPage;

  // Count a completed Khatma only when progressing sequentially into page 604 from the end of the Mushaf
  if (prevPage >= 580 && prevPage < 604 && clampedPage === 604 && stats.totalAyahs >= 50) {
    stats.completedKhatmas += 1;
    stats.lastKhatmaDate = getTodayStr();
  }
  saveFaithStats(stats);
}

export interface HeatmapDay {
  date: string;
  intensity: number; // 0 to 4
  ayahCount: number;
  minutes: number;
}

// Generate the 365-day heatmap strictly from genuine local-calendar user activity
export function generateRealHeatmapData(history: Record<string, DayActivity>): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const today = new Date();

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dateStr = formatLocalDate(d);

    const act = history[dateStr];
    let intensity = 0;
    let count = 0;
    let mins = 0;

    if (act && act.ayahCount > 0) {
      count = act.ayahCount;
      mins = Math.round(act.minutes || 0);
      if (count >= 70) intensity = 4;
      else if (count >= 30) intensity = 3;
      else if (count >= 10) intensity = 2;
      else intensity = 1;
    }

    days.push({
      date: dateStr,
      intensity,
      ayahCount: count,
      minutes: mins,
    });
  }

  return days;
}
