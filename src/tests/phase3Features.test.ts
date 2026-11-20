import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOOKMARK_KEY_PREFIX,
  getBookmarkMapBySurah,
  loadAllBookmarks,
  removeSurahBookmark,
  toggleSurahBookmark,
  updateBookmarkLabel,
} from '../utils/bookmarksStore';
import {
  buildUserBackupPayload,
  restoreUserBackupData,
  validateAndParseUserBackup,
} from '../utils/userBackup';

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

describe('Phase 3: Unified Bookmarks Store & Backup Integrity', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('discovers legacy bayan_bookmark_* keys automatically with Surah metadata', () => {
    window.localStorage.setItem(`${BOOKMARK_KEY_PREFIX}18`, '10');
    window.localStorage.setItem(`${BOOKMARK_KEY_PREFIX}1`, '5');

    const entries = loadAllBookmarks();
    expect(entries).toHaveLength(2);

    const kahf = entries.find((e) => e.surahNumber === 18);
    expect(kahf).toBeDefined();
    expect(kahf?.surahName).toBe('الكهف');
    expect(kahf?.ayahNumber).toBe(10);
    expect(kahf?.label).toBe('وقف القراءة');

    expect(getBookmarkMapBySurah()).toEqual({ 1: 5, 18: 10 });
  });

  it('toggles, labels, and removes bookmarks while keeping legacy keys synced', () => {
    const added = toggleSurahBookmark({
      surahNumber: 2,
      surahName: 'البقرة',
      ayahNumber: 255,
      page: 42,
      ayahSnippet: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ',
      label: 'تدبر ودعاء',
    });

    expect(added.bookmarkedAyah).toBe(255);
    expect(window.localStorage.getItem(`${BOOKMARK_KEY_PREFIX}2`)).toBe('255');
    expect(added.entries[0].label).toBe('تدبر ودعاء');
    expect(added.entries[0].page).toBe(42);

    const relabeled = updateBookmarkLabel(2, 'مراجعة الحفظ');
    expect(relabeled[0].label).toBe('مراجعة الحفظ');

    // Re-toggling same Ayah removes both legacy key and metadata
    const toggledOff = toggleSurahBookmark({
      surahNumber: 2,
      ayahNumber: 255,
    });
    expect(toggledOff.bookmarkedAyah).toBeNull();
    expect(window.localStorage.getItem(`${BOOKMARK_KEY_PREFIX}2`)).toBeNull();
    expect(loadAllBookmarks()).toHaveLength(0);

    toggleSurahBookmark({ surahNumber: 36, ayahNumber: 12, page: 441 });
    expect(loadAllBookmarks()).toHaveLength(1);
    expect(removeSurahBookmark(36)).toHaveLength(0);
  });

  it('exports and restores rich bookmark metadata alongside journal notes cleanly', async () => {
    toggleSurahBookmark({
      surahNumber: 112,
      surahName: 'الإخلاص',
      ayahNumber: 1,
      page: 604,
      ayahSnippet: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      label: 'مراجعة الحفظ',
    });

    const payload = buildUserBackupPayload([
      {
        ayahId: 6222,
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 1,
        text: 'تأمل في توحيد الله وصفاته',
        date: '2026-11-19',
      },
    ]);

    const json = JSON.stringify(payload);
    // Simulate fresh browser storage
    installMemoryStorage();
    expect(loadAllBookmarks()).toHaveLength(0);

    const parsed = validateAndParseUserBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const restored = await restoreUserBackupData(parsed.data);
    expect(restored.bookmarksCount).toBe(1);
    expect(restored.notesCount).toBe(1);

    const restoredBookmarks = loadAllBookmarks();
    expect(restoredBookmarks).toHaveLength(1);
    expect(restoredBookmarks[0].surahNumber).toBe(112);
    expect(restoredBookmarks[0].label).toBe('مراجعة الحفظ');
    expect(restoredBookmarks[0].ayahSnippet).toBe('قُلْ هُوَ ٱللَّهُ أَحَدٌ');
  });
});
