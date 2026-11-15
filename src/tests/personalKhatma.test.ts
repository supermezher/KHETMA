import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPersonalRingParts,
  calculateKhatmaPlanMetrics,
  computePersonalKhatmaStats,
  getJuzForMushafPage,
  getSurahAtMushafPage,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  normalizePersonalKhatmaPlan,
  PERSONAL_KHATMA_STORAGE_KEY,
  savePersonalKhatmaPlan,
  splitPagesAcrossFivePrayers,
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

describe('Personal Khatma calculator & backward-compatible storage', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('calculates 3 Khatmas in 30 days (Ramadan) accurately across prayers', () => {
    const metrics = calculateKhatmaPlanMetrics({
      goalMode: 'khatmas',
      targetKhatmas: 3,
      targetJuzCount: 30,
      targetDays: 30,
    });

    expect(metrics.totalJuz).toBe(90);
    expect(metrics.totalPages).toBe(1812);
    expect(metrics.pagesPerDay).toBe(61);
    expect(metrics.juzPerDay).toBe(3);
    expect(metrics.prayerSplit).toEqual([13, 12, 12, 12, 12]);
    expect(metrics.prayerSplit.reduce((a, b) => a + b, 0)).toBe(61);
  });

  it('calculates 29-day Ramadan safety buffer and custom Juz plans', () => {
    const ramadan29 = calculateKhatmaPlanMetrics({
      goalMode: 'khatmas',
      targetKhatmas: 3,
      targetJuzCount: 30,
      targetDays: 29,
    });
    expect(ramadan29.pagesPerDay).toBe(63);

    const tenJuz = calculateKhatmaPlanMetrics({
      goalMode: 'juz',
      targetKhatmas: 1,
      targetJuzCount: 10,
      targetDays: 15,
    });
    expect(tenJuz.totalJuz).toBe(10);
    expect(tenJuz.totalPages).toBe(201);
    expect(tenJuz.pagesPerDay).toBe(14);
  });

  it('normalizes legacy bayat_khatma_plan objects without losing compatibility', () => {
    const legacy: KhatmaPlan = {
      targetDays: 30,
      availableMinutesPerDay: 20,
      pagesPerDay: 21,
      pagesPerPrayer: 5,
      createdAt: '2026-03-01T10:00:00.000Z',
    };
    window.localStorage.setItem(PERSONAL_KHATMA_STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadPersonalKhatmaPlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.targetDays).toBe(30);
    expect(loaded!.pagesPerDay).toBe(21);
    expect(loaded!.goalMode).toBe('khatmas');
    expect(loaded!.targetKhatmas).toBe(1);
    expect(loaded!.completedPages).toBe(0);
    expect(loaded!.startDate).toBe('2026-03-01');
  });

  it('computes lag, gentle catch-up pace, cycle Juz ring parts, and Mushaf navigation accurately', () => {
    const plan = normalizePersonalKhatmaPlan({
      targetDays: 30,
      availableMinutesPerDay: 90,
      pagesPerDay: 61,
      pagesPerPrayer: 13,
      createdAt: '2026-11-01T08:00:00.000Z',
      goalMode: 'khatmas',
      targetKhatmas: 3,
      startDate: '2026-11-01',
      completedPages: 120,
    });

    // Day 5 (Nov 5): expected = 5 * 61 = 305, completed = 120 -> lag = 185
    const stats = computePersonalKhatmaStats(plan, new Date(2026, 10, 5));
    expect(stats.currentDayIndex).toBe(5);
    expect(stats.expectedPagesByToday).toBe(305);
    expect(stats.lagPages).toBe(185);
    expect(stats.currentKhatmaNumber).toBe(1);
    expect(stats.currentPageInCycle).toBe(121);
    expect(stats.gentleSpreadPagesPerDay).toBe(Math.ceil((1812 - 120) / 26));
    expect(stats.extraDaysNeeded).toBe(Math.ceil(185 / 61));

    const ring = buildPersonalRingParts(stats);
    expect(ring).toHaveLength(30);
    // Pages 1..120 covers Juz 1..5 fully (endPage of Juz 5 = 101; Juz 6 = 102..121)
    expect(ring.filter((p) => p.isCompleted)).toHaveLength(5);
    expect(ring[5].juzNumber).toBe(6);
    expect(ring[5].claimedBy).toBe('●');

    savePersonalKhatmaPlan(plan);
    expect(loadPersonalKhatmaPlan()?.completedPages).toBe(120);

    expect(getJuzForMushafPage(1)).toBe(1);
    expect(getJuzForMushafPage(604)).toBe(30);
    expect(getSurahAtMushafPage(106).surahNumber).toBe(5); // Al-Ma'idah starts at p.106
    expect(splitPagesAcrossFivePrayers(7)).toEqual([2, 2, 1, 1, 1]);
  });
});
