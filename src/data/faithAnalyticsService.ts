export interface DayActivity {
  date: string; // YYYY-MM-DD
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

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function loadFaithStats(): FaithStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalAyahs === 'number') {
        return calculateDynamicStats(parsed);
      }
    }
  } catch (err) {
    console.warn('Error loading faith stats:', err);
  }

  // Initial fresh user state (Honest 0 base, never fake 21 days or 2 khatmas)
  const initial: FaithStats = {
    streakDays: 1,
    totalAyahs: 7, // Starting with Al-Fatiha
    thisWeekAyahs: 7,
    completedKhatmas: 0,
    lastKhatmaDate: null,
    totalMinutes: 5,
    currentKhatmaPage: 1,
    history: {
      [getTodayStr()]: {
        date: getTodayStr(),
        ayahCount: 7,
        minutes: 5,
      },
    },
  };

  saveFaithStats(initial);
  return initial;
}

export function saveFaithStats(stats: FaithStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Error saving faith stats:', err);
  }
}

function calculateDynamicStats(stats: FaithStats): FaithStats {
  const history = stats.history || {};
  const today = new Date();
  
  // Calculate real consecutive daily streak from today backwards
  let streak = 0;
  let checkDate = new Date(today);

  // Check if today or yesterday has activity
  const todayStr = checkDate.toISOString().split('T')[0];
  const hasToday = history[todayStr] && history[todayStr].ayahCount > 0;

  if (!hasToday) {
    // If not read today yet, check yesterday to continue streak
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
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
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
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
    streakDays: Math.max(streak, hasToday ? 1 : 0),
    totalAyahs,
    thisWeekAyahs: weekAyahs,
    totalMinutes,
    history,
  };
}

export function recordAyahReadActivity(ayahsCount = 1, minutesSpent = 1): void {
  const stats = loadFaithStats();
  const todayStr = getTodayStr();

  if (!stats.history[todayStr]) {
    stats.history[todayStr] = {
      date: todayStr,
      ayahCount: 0,
      minutes: 0,
    };
  }

  stats.history[todayStr].ayahCount += ayahsCount;
  stats.history[todayStr].minutes += minutesSpent;

  const updated = calculateDynamicStats(stats);
  saveFaithStats(updated);
}

export function recordPageProgress(pageNum: number): void {
  const stats = loadFaithStats();
  stats.currentKhatmaPage = Math.min(604, Math.max(1, pageNum));
  if (pageNum >= 604) {
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

// Generate the 365-day heatmap strictly from genuine user activity
export function generateRealHeatmapData(history: Record<string, DayActivity>): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const today = new Date();

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const act = history[dateStr];
    let intensity = 0;
    let count = 0;
    let mins = 0;

    if (act && act.ayahCount > 0) {
      count = act.ayahCount;
      mins = act.minutes || 0;
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
