import { getAyahAudioUrl } from '../data/reciters';

const CACHE_NAME = 'bayan-recitation-cache-v1';

/**
 * Checks if all verses of a Surah are cached offline for a specific reciter.
 */
export async function isSurahCached(
  reciterKey: string,
  surahNumber: number,
  totalAyahs: number
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || totalAyahs <= 0) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const checks = Array.from({ length: totalAyahs }, (_, idx) => {
      const url = getAyahAudioUrl(reciterKey, surahNumber, idx + 1);
      return cache.match(url);
    });
    const matches = await Promise.all(checks);
    return matches.every(Boolean);
  } catch (err) {
    console.warn('Failed to check audio cache:', err);
    return false;
  }
}

/**
 * Downloads and caches all verse audio files for a Surah and reciter into browser CacheStorage.
 */
export async function cacheSurahAudio(
  reciterKey: string,
  surahNumber: number,
  totalAyahs: number,
  onProgress?: (completed: number, total: number) => void
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('متصفحك لا يدعم واجهة التخزين المؤقت دون اتصال (Cache API)');
  }

  const cache = await caches.open(CACHE_NAME);
  let completed = 0;
  let failedCount = 0;
  const CHUNK_SIZE = 4;

  for (let i = 1; i <= totalAyahs; i += CHUNK_SIZE) {
    const chunkAyahs: number[] = [];
    for (let j = i; j < i + CHUNK_SIZE && j <= totalAyahs; j++) {
      chunkAyahs.push(j);
    }

    await Promise.all(
      chunkAyahs.map(async (ayahNum) => {
        const url = getAyahAudioUrl(reciterKey, surahNumber, ayahNum);
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
              await cache.put(url, res.clone());
            } else {
              failedCount++;
            }
          }
        } catch (fetchErr) {
          failedCount++;
          console.warn(`Failed to cache ayah ${ayahNum} of surah ${surahNumber}:`, fetchErr);
        } finally {
          completed++;
          onProgress?.(completed, totalAyahs);
        }
      })
    );
  }

  if (failedCount > 0) {
    throw new Error(`تعذر تحميل ${failedCount} آية. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.`);
  }

  return true;
}

/**
 * Removes cached audio for a specific surah and reciter to free space if requested.
 */
export async function clearSurahAudioCache(
  reciterKey: string,
  surahNumber: number,
  totalAyahs: number
): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (let i = 1; i <= totalAyahs; i++) {
      const url = getAyahAudioUrl(reciterKey, surahNumber, i);
      await cache.delete(url);
    }
  } catch (err) {
    console.warn('Failed to clear surah audio cache:', err);
  }
}

/**
 * Attempts to retrieve a cached audio blob URL for zero-latency or offline playback.
 */
export async function getCachedAudioBlobUrl(url: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    if (res) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('Error reading audio from cache:', err);
  }
  return null;
}
