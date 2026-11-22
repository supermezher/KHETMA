import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRANSLATION_EDITION_ID,
  MAX_TRANSLATION_FONT_SIZE,
  MIN_TRANSLATION_FONT_SIZE,
  TRANSLATION_EDITIONS,
  clampTranslationFontSize,
  filterTranslatedVerses,
  filterTranslationSurahs,
  getSurahComparisonTranslations,
  getSurahWithTranslation,
  getTranslationEditionById,
  importVerifiedTranslationJson,
  isTranslationFavorited,
  loadTranslationPrefs,
  saveTranslationPrefs,
  toggleTranslationFavorite,
} from '../data/translationsService';

describe('translationsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers approved Swedish and English editions cleanly with direction metadata', () => {
    expect(TRANSLATION_EDITIONS.length).toBeGreaterThanOrEqual(2);

    const swedish = TRANSLATION_EDITIONS.find((e) => e.id === 'sv.bernstrom');
    const english = TRANSLATION_EDITIONS.find((e) => e.id === 'en.sahih');

    expect(swedish).toBeDefined();
    expect(swedish?.langCode).toBe('sv');
    expect(swedish?.dir).toBe('ltr');
    expect(swedish?.translatorName).toContain('Knut Bernström');

    expect(english).toBeDefined();
    expect(english?.langCode).toBe('en');
    expect(english?.dir).toBe('ltr');
    expect(english?.translatorName).toContain('Saheeh International');
  });

  it('resolves edition by id or language code and falls back safely for unknown identifiers', () => {
    expect(getTranslationEditionById('en.sahih').id).toBe('en.sahih');
    expect(getTranslationEditionById('en').id).toBe('en.sahih');
    expect(getTranslationEditionById('sv.bernstrom').id).toBe('sv.bernstrom');
    expect(getTranslationEditionById('sv').id).toBe('sv.bernstrom');
    expect(getTranslationEditionById('nonexistent.lang').id).toBe(DEFAULT_TRANSLATION_EDITION_ID);
  });

  it('clamps translation font size within readable bounds and supports all 4 display modes', () => {
    expect(clampTranslationFontSize(8)).toBe(MIN_TRANSLATION_FONT_SIZE);
    expect(clampTranslationFontSize(40)).toBe(MAX_TRANSLATION_FONT_SIZE);
    expect(clampTranslationFontSize(18.6)).toBe(19);
    expect(clampTranslationFontSize(Number.NaN)).toBe(16);

    const defaults = loadTranslationPrefs();
    expect(defaults.displayMode).toBe('split');
    saveTranslationPrefs({
      editionId: 'en.sahih',
      displayMode: 'compare',
      fontSize: 18,
      surahNumber: 18,
    });
  });

  it('filters Surahs by Arabic name, English transliteration, English meaning, or Surah number', () => {
    expect(filterTranslationSurahs('')).toHaveLength(114);

    const byNum = filterTranslationSurahs('112');
    expect(byNum).toHaveLength(1);
    expect(byNum[0].name).toBe('الإخلاص');

    const byArabic = filterTranslationSurahs('الكهف');
    expect(byArabic.some((s) => s.number === 18)).toBe(true);

    const byEnglishName = filterTranslationSurahs('al-fatihah');
    expect(byEnglishName.some((s) => s.number === 1)).toBe(true);

    const byMeaning = filterTranslationSurahs('opening');
    expect(byMeaning.some((s) => s.number === 1)).toBe(true);
  });

  it('filters translated verses by ayah number, normalized Arabic script, or translated text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const fatihahSv = await getSurahWithTranslation(1, 'sv.bernstrom');

    expect(fatihahSv.verses).toHaveLength(7);

    const byNum = filterTranslatedVerses(fatihahSv.verses, '5');
    expect(byNum).toHaveLength(1);
    expect(byNum[0].ayahNumber).toBe(5);

    const byArabic = filterTranslatedVerses(fatihahSv.verses, 'نستعين');
    expect(byArabic).toHaveLength(1);
    expect(byArabic[0].ayahNumber).toBe(5);

    const bySwedish = filterTranslatedVerses(fatihahSv.verses, 'domens dag');
    expect(bySwedish).toHaveLength(1);
    expect(bySwedish[0].ayahNumber).toBe(4);
  });

  it('serves bundled offline starter Surahs (1, 112, 113, 114) seamlessly in both languages when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const expectedCounts: Record<number, number> = {
      1: 7,
      112: 4,
      113: 5,
      114: 6,
    };

    for (const editionId of ['sv.bernstrom', 'en.sahih']) {
      for (const [surahStr, expectedLen] of Object.entries(expectedCounts)) {
        const surahNum = Number(surahStr);
        const res = await getSurahWithTranslation(surahNum, editionId);
        expect(res.source).toBe('bundled');
        expect(res.surahNumber).toBe(surahNum);
        expect(res.edition.id).toBe(editionId);
        expect(res.verses).toHaveLength(expectedLen);
        expect(res.bismillahPre).toBe(surahNum !== 1 && surahNum !== 9);
        for (const v of res.verses) {
          expect(v.arabicText.trim().length).toBeGreaterThan(0);
          expect(v.translationText.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('loads all editions in parallel for multi-language comparison mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const comparison = await getSurahComparisonTranslations(112);
    expect(comparison).toHaveLength(TRANSLATION_EDITIONS.length);
    expect(comparison[0].verses).toHaveLength(4);
    expect(comparison[1].verses).toHaveLength(4);
    expect(comparison[0].edition.langCode).toBe('sv');
    expect(comparison[1].edition.langCode).toBe('en');
  });

  it('toggles translation favorites deterministically without duplicates', () => {
    let list = toggleTranslationFavorite([], {
      surahNumber: 1,
      surahName: 'الفاتحة',
      englishName: 'Al-Fatihah',
      ayahNumber: 5,
      arabicText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      translationText: 'Dig tillber vi; Dig anropar vi om hjälp.',
      editionId: 'sv.bernstrom',
      editionTitle: 'الترجمة السويدية',
      dir: 'ltr',
    });

    expect(list).toHaveLength(1);
    expect(isTranslationFavorited(list, 'sv.bernstrom', 1, 5)).toBe(true);
    expect(isTranslationFavorited(list, 'en.sahih', 1, 5)).toBe(false);

    // Toggling the same entry again removes it cleanly
    list = toggleTranslationFavorite(list, {
      surahNumber: 1,
      surahName: 'الفاتحة',
      englishName: 'Al-Fatihah',
      ayahNumber: 5,
      arabicText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      translationText: 'Dig tillber vi; Dig anropar vi om hjälp.',
      editionId: 'sv.bernstrom',
      editionTitle: 'الترجمة السويدية',
      dir: 'ltr',
    });
    expect(list).toHaveLength(0);
    expect(isTranslationFavorited(list, 'sv.bernstrom', 1, 5)).toBe(false);
  });

  it('validates strict verse count, order, and language on verified JSON import', async () => {
    const valid = await importVerifiedTranslationJson({
      surah_number: 112,
      target_language: 'sv',
      verses: [
        { ayah_number: 1, arabic_text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Säg: Han är Gud - En,' },
        { ayah_number: 2, arabic_text: 'ٱللَّهُ ٱلصَّمَدُ', translation: 'Gud, den Evige.' },
        { ayah_number: 3, arabic_text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', translation: 'Han har inte avlat och inte blivit avlad,' },
        { ayah_number: 4, arabic_text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', translation: 'och ingen finns som kan liknas vid Honom.' },
      ],
    });
    expect(valid.source).toBe('custom-json');
    expect(valid.edition.id).toBe('sv.bernstrom');
    expect(valid.verses).toHaveLength(4);

    // Rejects mismatched verse count
    await expect(
      importVerifiedTranslationJson({
        surah_number: 112,
        target_language: 'en',
        verses: [{ ayah_number: 1, arabic_text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Say He is Allah, One' }],
      })
    ).rejects.toThrow();

    // Rejects unknown target language
    await expect(
      importVerifiedTranslationJson({
        surah_number: 112,
        target_language: 'xx',
        verses: [],
      })
    ).rejects.toThrow();
  });

  it('parses dual-edition API response cleanly and strips leading BOM & Basmala on Surahs 2..114 (except 9)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            edition: { identifier: 'quran-uthmani' },
            ayahs: [
              {
                number: 6208,
                numberInSurah: 1,
                text: '\uFEFFبِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
                juz: 30,
                page: 602,
              },
              {
                number: 6209,
                numberInSurah: 2,
                text: 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ',
                juz: 30,
                page: 602,
              },
              {
                number: 6210,
                numberInSurah: 3,
                text: 'إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ',
                juz: 30,
                page: 602,
              },
            ],
          },
          {
            edition: { identifier: 'sv.bernstrom' },
            ayahs: [
              { number: 6208, numberInSurah: 1, text: 'VI HAR sannerligen gett dig det goda i överflöd!' },
              { number: 6209, numberInSurah: 2, text: 'Be därför till din Herre och förrätta [ditt] offer!' },
              { number: 6210, numberInSurah: 3, text: 'Det är den som hatar dig som är den avskurne!' },
            ],
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await getSurahWithTranslation(108, 'sv.bernstrom');
    expect(res.source).toBe('api');
    expect(res.bismillahPre).toBe(true);
    expect(res.verses).toHaveLength(3);
    expect(res.verses[0].arabicText).toBe('إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ');
    expect(res.verses[0].translationText).toBe('VI HAR sannerligen gett dig det goda i överflöd!');
  });
});
