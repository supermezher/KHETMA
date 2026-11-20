import { describe, expect, it } from 'vitest';
import { assembleMushafPageFromSurahs, SurahData } from '../data/quranService';
import { SURAHS_LIST } from '../data/quranMetadata';
import { buildMediaSessionMetadataPayload } from '../components/AudioPlayerBar';

function makeDummySurah(
  surahNumber: number,
  ayahDefs: Array<{ num: number; page: number; text?: string }>
): SurahData {
  const meta = SURAHS_LIST[surahNumber - 1];
  return {
    meta,
    bismillahPre: surahNumber !== 1 && surahNumber !== 9,
    ayahs: ayahDefs.map((def) => ({
      numberInSurah: def.num,
      overallNumber: surahNumber * 100 + def.num,
      text: def.text || `نص الآية ${def.num}`,
      tafsir: `تفسير الآية ${def.num}`,
      juz: meta.juzNumber,
      page: def.page,
      hizbQuarter: 1,
    })),
  };
}

describe('Offline 604-page Mus’haf assembly', () => {
  it('assembles a multi-surah page cleanly in exact Surah & Ayah order and deduplicates repeated Surahs', () => {
    const s114 = makeDummySurah(114, [
      { num: 2, page: 604 },
      { num: 1, page: 604 },
    ]);
    const s112 = makeDummySurah(112, [
      { num: 1, page: 604 },
      { num: 2, page: 604 },
    ]);
    const s113 = makeDummySurah(113, [{ num: 1, page: 604 }]);

    const page = assembleMushafPageFromSurahs(604, [s114, s112, s113, s112]);
    expect(page).not.toBeNull();
    expect(page!.pageNumber).toBe(604);
    expect(page!.ayahs.map((a) => `${a.surahNumber}:${a.numberInSurah}`)).toEqual([
      '112:1',
      '112:2',
      '113:1',
      '114:1',
      '114:2',
    ]);
    expect(page!.ayahs[0].surahName).toBe(SURAHS_LIST[111].name);
    expect(page!.ayahs[0].bismillahPre).toBe(true);
  });

  it('clamps page numbers and extracts any intermediate page from downloaded Surahs', () => {
    const baqara = makeDummySurah(2, [
      { num: 1, page: 2 },
      { num: 2, page: 2 },
      { num: 6, page: 3 },
    ]);

    const page2 = assembleMushafPageFromSurahs(2, [baqara]);
    expect(page2?.pageNumber).toBe(2);
    expect(page2?.ayahs.map((a) => a.numberInSurah)).toEqual([1, 2]);

    const clampedHigh = assembleMushafPageFromSurahs(999, [
      makeDummySurah(112, [{ num: 1, page: 604 }]),
    ]);
    expect(clampedHigh?.pageNumber).toBe(604);
    expect(clampedHigh?.ayahs).toHaveLength(1);

    const clampedLow = assembleMushafPageFromSurahs(0, [
      makeDummySurah(1, [{ num: 1, page: 1 }]),
    ]);
    expect(clampedLow?.pageNumber).toBe(1);
    expect(clampedLow?.ayahs[0].bismillahPre).toBe(false);
  });

  it('returns null when requested page is not present in cached Surahs', () => {
    const baqara = makeDummySurah(2, [{ num: 1, page: 2 }]);
    expect(assembleMushafPageFromSurahs(250, [baqara])).toBeNull();
    expect(assembleMushafPageFromSurahs(2, [])).toBeNull();
  });
});

describe('Media Session lock-screen metadata payload', () => {
  it('builds formatted Arabic metadata with artwork paths', () => {
    const payload = buildMediaSessionMetadataPayload('البقرة', 255, 'مشاري راشد العفاسي');
    expect(payload.title).toBe('سورة البقرة · الآية ٢٥٥');
    expect(payload.artist).toBe('مشاري راشد العفاسي');
    expect(payload.album).toBe('بيان — المصحف الشريف');
    expect(payload.artwork).toEqual([
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ]);
  });

  it('normalizes empty or out-of-range inputs safely', () => {
    const payload = buildMediaSessionMetadataPayload('  ', -3, '');
    expect(payload.title).toBe('سورة القرآن الكريم · الآية ١');
    expect(payload.artist).toBe('الشيخ');
  });
});
