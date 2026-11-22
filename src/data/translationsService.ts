import { SURAHS_LIST, SurahMeta } from './quranMetadata';
import { getSurahData, sanitizeAyahText } from './quranService';
import { idbGet, idbGetAllValues, idbSet } from '../utils/quranIndexedDb';
import { normalizeArabicText } from '../utils/arabicNormalize';
import { safeLocalStorage } from '../utils/safeStorage';

export type TranslationDirection = 'ltr' | 'rtl';
export type TranslationDisplayMode = 'split' | 'bilingual' | 'compare' | 'translation-only';

export interface TranslationEdition {
  id: string;
  langCode: string;
  dir: TranslationDirection;
  arabicTitle: string;
  nativeTitle: string;
  translatorName: string;
  sourceLabel: string;
  descriptionAr: string;
  bismillahText: string;
}

export interface TranslatedVerse {
  ayahNumber: number;
  overallNumber?: number;
  arabicText: string;
  translationText: string;
  juz?: number;
  page?: number;
}

export interface TranslatedSurahData {
  surahNumber: number;
  meta: SurahMeta;
  edition: TranslationEdition;
  bismillahPre: boolean;
  verses: TranslatedVerse[];
  source: 'cache' | 'api' | 'bundled' | 'custom-json';
}

export interface TranslationPrefs {
  editionId: string;
  displayMode: TranslationDisplayMode;
  fontSize: number;
  surahNumber: number;
}

export interface TranslationFavoriteEntry {
  key: string;
  surahNumber: number;
  surahName: string;
  englishName: string;
  ayahNumber: number;
  overallNumber?: number;
  arabicText: string;
  translationText: string;
  editionId: string;
  editionTitle: string;
  dir: TranslationDirection;
  savedAt: string;
}

export const TRANSLATION_PREFS_KEY = 'bayan_translations_prefs_v1';
export const TRANSLATION_FAVORITES_KEY = 'bayan_translation_favorites_v1';
export const DEFAULT_TRANSLATION_EDITION_ID = 'sv.bernstrom';
export const MIN_TRANSLATION_FONT_SIZE = 14;
export const MAX_TRANSLATION_FONT_SIZE = 26;

/**
 * Extensible registry of approved Quran meaning translations.
 * To add a new language in the future (e.g., French, Turkish, German, Urdu),
 * append a single entry here; UI, IndexedDB caching, search, and direction handling adapt automatically.
 */
export const TRANSLATION_EDITIONS: TranslationEdition[] = [
  {
    id: 'sv.bernstrom',
    langCode: 'sv',
    dir: 'ltr',
    arabicTitle: 'الترجمة السويدية',
    nativeTitle: 'Svenska — Koranens budskap',
    translatorName: 'Knut Bernström',
    sourceLabel: 'Koranens budskap (معتمد)',
    descriptionAr:
      'ترجمة معاني القرآن الكريم إلى اللغة السويدية الفصيحة بقلم محمد كنوت برنستروم، مع مقابلة نصية أمينة بالرسم العثماني.',
    bismillahText: 'I GUDS, DEN NÅDERIKES, DEN BARMHÄRTIGES NAMN',
  },
  {
    id: 'en.sahih',
    langCode: 'en',
    dir: 'ltr',
    arabicTitle: 'الترجمة الإنجليزية',
    nativeTitle: 'English — Saheeh International',
    translatorName: 'Saheeh International',
    sourceLabel: 'Saheeh International (معتمد)',
    descriptionAr:
      'ترجمة معاني القرآن الكريم إلى اللغة الإنجليزية بأسلوب رصين واضح المعاني ومنضبط الدلالة.',
    bismillahText: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
  },
];

const BUNDLED_STARTER_TRANSLATIONS: Record<string, Record<number, TranslatedVerse[]>> = {
  'sv.bernstrom': {
    1: [
      {
        ayahNumber: 1,
        overallNumber: 1,
        arabicText: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translationText: 'I GUDS, DEN NÅDERIKES, DEN BARMHÄRTIGES NAMN',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 2,
        overallNumber: 2,
        arabicText: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        translationText: 'Lov och pris tillkommer Gud, världarnas Herre,',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 3,
        overallNumber: 3,
        arabicText: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translationText: 'den Nåderike, den Barmhärtige,',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 4,
        overallNumber: 4,
        arabicText: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        translationText: 'som allena råder över Domens dag!',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 5,
        overallNumber: 5,
        arabicText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        translationText: 'Dig tillber vi; Dig anropar vi om hjälp.',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 6,
        overallNumber: 6,
        arabicText: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        translationText: 'Led oss på den raka vägen -',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 7,
        overallNumber: 7,
        arabicText: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        translationText:
          'den väg de vandrat som Du har välsignat med Dina gåvor; inte de som har drabbats av [Din] vrede och inte de som har gått vilse!',
        juz: 1,
        page: 1,
      },
    ],
    112: [
      {
        ayahNumber: 1,
        overallNumber: 6222,
        arabicText: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        translationText: 'SÄG: "Han är Gud - En,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6223,
        arabicText: 'ٱللَّهُ ٱلصَّمَدُ',
        translationText: 'Gud, den Evige, den av skapelsen Oberoende, av vilken alla beror.',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6224,
        arabicText: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        translationText: 'Han har inte avlat och inte blivit avlad,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6225,
        arabicText: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        translationText: 'och ingen finns som kan liknas vid Honom."',
        juz: 30,
        page: 604,
      },
    ],
    113: [
      {
        ayahNumber: 1,
        overallNumber: 6226,
        arabicText: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        translationText: 'SÄG: "Jag söker skydd hos gryningens Herre,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6227,
        arabicText: 'مِن شَرِّ مَا خَلَقَ',
        translationText: 'mot det onda i det som Han har skapat,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6228,
        arabicText: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
        translationText: 'och mot det onda i nattens tätnande mörker,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6229,
        arabicText: 'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ',
        translationText: 'och mot det onda från dem som blåser på knutar,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 5,
        overallNumber: 6230,
        arabicText: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        translationText: 'och mot det onda i avundsmannens avund!"',
        juz: 30,
        page: 604,
      },
    ],
    114: [
      {
        ayahNumber: 1,
        overallNumber: 6231,
        arabicText: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        translationText: 'SÄG: "Jag söker skydd hos människornas Herre,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6232,
        arabicText: 'مَلِكِ ٱلنَّاسِ',
        translationText: 'människornas Konung,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6233,
        arabicText: 'إِلَـٰهِ ٱلنَّاسِ',
        translationText: 'människornas Gud,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6234,
        arabicText: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
        translationText: 'mot det onda från den förrädiske frestaren som drar sig undan,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 5,
        overallNumber: 6235,
        arabicText: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
        translationText: 'som viskar ont i människornas hjärtan,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 6,
        overallNumber: 6236,
        arabicText: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
        translationText: 'både osynliga väsen och människor."',
        juz: 30,
        page: 604,
      },
    ],
  },
  'en.sahih': {
    1: [
      {
        ayahNumber: 1,
        overallNumber: 1,
        arabicText: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translationText: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 2,
        overallNumber: 2,
        arabicText: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        translationText: '[All] praise is [due] to Allah, Lord of the worlds -',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 3,
        overallNumber: 3,
        arabicText: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translationText: 'The Entirely Merciful, the Especially Merciful,',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 4,
        overallNumber: 4,
        arabicText: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        translationText: 'Sovereign of the Day of Recompense.',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 5,
        overallNumber: 5,
        arabicText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        translationText: 'It is You we worship and You we ask for help.',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 6,
        overallNumber: 6,
        arabicText: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        translationText: 'Guide us to the straight path -',
        juz: 1,
        page: 1,
      },
      {
        ayahNumber: 7,
        overallNumber: 7,
        arabicText: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        translationText:
          'The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.',
        juz: 1,
        page: 1,
      },
    ],
    112: [
      {
        ayahNumber: 1,
        overallNumber: 6222,
        arabicText: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        translationText: 'Say, "He is Allah, [who is] One,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6223,
        arabicText: 'ٱللَّهُ ٱلصَّمَدُ',
        translationText: 'Allah, the Eternal Refuge.',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6224,
        arabicText: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        translationText: 'He neither begets nor is born,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6225,
        arabicText: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        translationText: 'Nor is there to Him any equivalent."',
        juz: 30,
        page: 604,
      },
    ],
    113: [
      {
        ayahNumber: 1,
        overallNumber: 6226,
        arabicText: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        translationText: 'Say, "I seek refuge in the Lord of daybreak',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6227,
        arabicText: 'مِن شَرِّ مَا خَلَقَ',
        translationText: 'From the evil of that which He created',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6228,
        arabicText: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
        translationText: 'And from the evil of darkness when it settles',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6229,
        arabicText: 'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ',
        translationText: 'And from the evil of the blowers in knots',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 5,
        overallNumber: 6230,
        arabicText: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        translationText: 'And from the evil of an envier when he envies."',
        juz: 30,
        page: 604,
      },
    ],
    114: [
      {
        ayahNumber: 1,
        overallNumber: 6231,
        arabicText: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        translationText: 'Say, "I seek refuge in the Lord of mankind,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 2,
        overallNumber: 6232,
        arabicText: 'مَلِكِ ٱلنَّاسِ',
        translationText: 'The Sovereign of mankind.',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 3,
        overallNumber: 6233,
        arabicText: 'إِلَـٰهِ ٱلنَّاسِ',
        translationText: 'The God of mankind,',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 4,
        overallNumber: 6234,
        arabicText: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
        translationText: 'From the evil of the retreating whisperer -',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 5,
        overallNumber: 6235,
        arabicText: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
        translationText: 'Who whispers [evil] into the breasts of mankind -',
        juz: 30,
        page: 604,
      },
      {
        ayahNumber: 6,
        overallNumber: 6236,
        arabicText: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
        translationText: 'From among the jinn and mankind."',
        juz: 30,
        page: 604,
      },
    ],
  },
};

export function getTranslationEditionById(editionId: string): TranslationEdition {
  return (
    TRANSLATION_EDITIONS.find((ed) => ed.id === editionId || ed.langCode === editionId) ||
    TRANSLATION_EDITIONS[0]
  );
}

export function clampTranslationFontSize(value: number): number {
  if (!Number.isFinite(value)) return 16;
  return Math.min(MAX_TRANSLATION_FONT_SIZE, Math.max(MIN_TRANSLATION_FONT_SIZE, Math.round(value)));
}

const VALID_DISPLAY_MODES = new Set<TranslationDisplayMode>([
  'split',
  'bilingual',
  'compare',
  'translation-only',
]);

export function loadTranslationPrefs(): TranslationPrefs {
  const saved = safeLocalStorage.getJSON<Partial<TranslationPrefs>>(TRANSLATION_PREFS_KEY, {});
  const edition = getTranslationEditionById(saved?.editionId || DEFAULT_TRANSLATION_EDITION_ID);
  const displayMode: TranslationDisplayMode =
    saved?.displayMode && VALID_DISPLAY_MODES.has(saved.displayMode) ? saved.displayMode : 'split';
  const fontSize = clampTranslationFontSize(
    typeof saved?.fontSize === 'number' ? saved.fontSize : 16
  );
  const rawSurah = Number(saved?.surahNumber);
  const surahNumber = Number.isInteger(rawSurah) && rawSurah >= 1 && rawSurah <= 114 ? rawSurah : 1;

  return {
    editionId: edition.id,
    displayMode,
    fontSize,
    surahNumber,
  };
}

export function saveTranslationPrefs(prefs: TranslationPrefs): void {
  const mode: TranslationDisplayMode = VALID_DISPLAY_MODES.has(prefs.displayMode)
    ? prefs.displayMode
    : 'split';
  safeLocalStorage.setJSON(TRANSLATION_PREFS_KEY, {
    editionId: getTranslationEditionById(prefs.editionId).id,
    displayMode: mode,
    fontSize: clampTranslationFontSize(prefs.fontSize),
    surahNumber: Math.min(114, Math.max(1, Math.round(prefs.surahNumber || 1))),
  });
}

export function buildTranslationFavoriteKey(
  editionId: string,
  surahNumber: number,
  ayahNumber: number
): string {
  return `${editionId}:${surahNumber}:${ayahNumber}`;
}

export function loadTranslationFavorites(): TranslationFavoriteEntry[] {
  const raw = safeLocalStorage.getJSON<unknown[]>(TRANSLATION_FAVORITES_KEY, []);
  if (!Array.isArray(raw)) return [];
  const valid: TranslationFavoriteEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<TranslationFavoriteEntry>;
    if (
      typeof rec.surahNumber !== 'number' ||
      typeof rec.ayahNumber !== 'number' ||
      typeof rec.translationText !== 'string' ||
      typeof rec.editionId !== 'string'
    ) {
      continue;
    }
    const edition = getTranslationEditionById(rec.editionId);
    const meta = SURAHS_LIST[rec.surahNumber - 1];
    if (!meta) continue;
    valid.push({
      key: buildTranslationFavoriteKey(edition.id, rec.surahNumber, rec.ayahNumber),
      surahNumber: rec.surahNumber,
      surahName: rec.surahName || meta.name,
      englishName: rec.englishName || meta.englishName,
      ayahNumber: rec.ayahNumber,
      overallNumber: typeof rec.overallNumber === 'number' ? rec.overallNumber : undefined,
      arabicText: typeof rec.arabicText === 'string' ? rec.arabicText : '',
      translationText: rec.translationText,
      editionId: edition.id,
      editionTitle: rec.editionTitle || edition.arabicTitle,
      dir: rec.dir === 'rtl' ? 'rtl' : edition.dir,
      savedAt: typeof rec.savedAt === 'string' ? rec.savedAt : new Date().toISOString(),
    });
  }
  return valid;
}

export function isTranslationFavorited(
  favorites: TranslationFavoriteEntry[],
  editionId: string,
  surahNumber: number,
  ayahNumber: number
): boolean {
  const key = buildTranslationFavoriteKey(editionId, surahNumber, ayahNumber);
  return favorites.some((f) => f.key === key);
}

export function toggleTranslationFavorite(
  favorites: TranslationFavoriteEntry[],
  entry: Omit<TranslationFavoriteEntry, 'key' | 'savedAt'>
): TranslationFavoriteEntry[] {
  const key = buildTranslationFavoriteKey(entry.editionId, entry.surahNumber, entry.ayahNumber);
  const exists = favorites.some((f) => f.key === key);
  const next = exists
    ? favorites.filter((f) => f.key !== key)
    : [{ ...entry, key, savedAt: new Date().toISOString() }, ...favorites];
  safeLocalStorage.setJSON(TRANSLATION_FAVORITES_KEY, next);
  return next;
}

function getCacheKey(editionId: string, surahNumber: number): string {
  return `tr:${editionId}:${surahNumber}`;
}

export function filterTranslationSurahs(query: string): SurahMeta[] {
  const trimmed = query.trim();
  if (!trimmed) return SURAHS_LIST;

  const normalizedAr = normalizeArabicText(trimmed);
  const lower = trimmed.toLowerCase();

  return SURAHS_LIST.filter((s) => {
    if (String(s.number) === trimmed) return true;
    if (normalizedAr && normalizeArabicText(s.name).includes(normalizedAr)) return true;
    if (s.englishName.toLowerCase().includes(lower)) return true;
    if (s.englishNameTranslation.toLowerCase().includes(lower)) return true;
    return false;
  });
}

export function filterTranslatedVerses(verses: TranslatedVerse[], query: string): TranslatedVerse[] {
  const trimmed = query.trim();
  if (!trimmed) return verses;

  const numericTarget = Number(trimmed);
  const isPureDigits = /^\d+$/.test(trimmed);
  const normalizedAr = normalizeArabicText(trimmed);
  const lower = trimmed.toLowerCase();

  return verses.filter((v) => {
    if (isPureDigits && Number.isFinite(numericTarget) && v.ayahNumber === numericTarget) {
      return true;
    }
    if (normalizedAr && normalizeArabicText(v.arabicText).includes(normalizedAr)) {
      return true;
    }
    if (v.translationText.toLowerCase().includes(lower)) {
      return true;
    }
    return false;
  });
}

export async function getCachedSurahNumbersForEdition(editionId: string): Promise<Set<number>> {
  const edition = getTranslationEditionById(editionId);
  const set = new Set<number>(
    Object.keys(BUNDLED_STARTER_TRANSLATIONS[edition.id] || {}).map((n) => Number(n))
  );
  try {
    const allEntries = await idbGetAllValues<unknown>('tafsirs');
    for (const entry of allEntries) {
      if (
        entry &&
        typeof entry === 'object' &&
        'edition' in entry &&
        'surahNumber' in entry &&
        'verses' in entry
      ) {
        const rec = entry as Partial<TranslatedSurahData>;
        if (rec.edition?.id === edition.id && typeof rec.surahNumber === 'number') {
          set.add(rec.surahNumber);
        }
      }
    }
  } catch {
    // Keep bundled set safely
  }
  return set;
}

export async function getCachedTranslationCountForEdition(editionId: string): Promise<number> {
  const set = await getCachedSurahNumbersForEdition(editionId);
  return set.size;
}

export interface VerifiedTranslationJsonInput {
  surah_number: number;
  target_language: string;
  verses: Array<{
    ayah_number: number;
    arabic_text: string;
    translation: string;
  }>;
}

/**
 * Validates and imports a manually audited Surah translation JSON document
 * matching the strict bilingual contract:
 * { surah_number, target_language, verses: [{ ayah_number, arabic_text, translation }] }
 */
export async function importVerifiedTranslationJson(
  rawJson: string | VerifiedTranslationJsonInput
): Promise<TranslatedSurahData> {
  const parsed: unknown = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('صيغة JSON غير صالحة.');
  }
  const obj = parsed as Partial<VerifiedTranslationJsonInput>;
  const surahNum = Number(obj.surah_number);
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    throw new Error('رقم السورة (surah_number) يجب أن يكون بين 1 و 114.');
  }

  const meta = SURAHS_LIST[surahNum - 1];
  const langInput = String(obj.target_language || '').trim().toLowerCase();
  const edition = TRANSLATION_EDITIONS.find(
    (e) => e.langCode.toLowerCase() === langInput || e.id.toLowerCase() === langInput
  );
  if (!edition) {
    throw new Error(
      `اللغة المستهدفة (${langInput || 'غير محددة'}) غير مسجلة في دليل الترجمات الحالي.`
    );
  }

  if (!Array.isArray(obj.verses) || obj.verses.length !== meta.numberOfAyahs) {
    throw new Error(
      `عدد الآيات يجب أن يطابق عدد آيات سورة ${meta.name} (${meta.numberOfAyahs}) دون زيادة أو نقصان.`
    );
  }

  const seenAyahs = new Set<number>();
  const verses: TranslatedVerse[] = obj.verses.map((row, idx) => {
    const ayahNum = Number(row?.ayah_number);
    if (!Number.isInteger(ayahNum) || ayahNum !== idx + 1 || seenAyahs.has(ayahNum)) {
      throw new Error(`ترتيب أو رقم الآية غير مطابق عند الموضع ${idx + 1}.`);
    }
    seenAyahs.add(ayahNum);

    const rawArabic = String(row?.arabic_text || '').replace(/^\uFEFF/, '').trim();
    const translation = String(row?.translation || '').trim();
    if (!rawArabic || !translation) {
      throw new Error(`النص العربي أو الترجمة فارغ في الآية رقم ${ayahNum}.`);
    }

    return {
      ayahNumber: ayahNum,
      arabicText: sanitizeAyahText(rawArabic, surahNum, ayahNum),
      translationText: translation,
    };
  });

  const payload: TranslatedSurahData = {
    surahNumber: surahNum,
    meta,
    edition,
    bismillahPre: surahNum !== 1 && surahNum !== 9,
    verses,
    source: 'custom-json',
  };

  await idbSet('tafsirs', getCacheKey(edition.id, surahNum), payload);
  return payload;
}

export async function getSurahWithTranslation(
  surahNumber: number,
  editionId: string
): Promise<TranslatedSurahData> {
  const safeSurah = Math.min(114, Math.max(1, Math.round(surahNumber || 1)));
  const edition = getTranslationEditionById(editionId);
  const meta = SURAHS_LIST[safeSurah - 1];
  const bismillahPre = safeSurah !== 1 && safeSurah !== 9;
  const cacheKey = getCacheKey(edition.id, safeSurah);

  // 1) Check persistent IndexedDB cache first
  const cached = await idbGet<TranslatedSurahData>('tafsirs', cacheKey);
  if (cached && Array.isArray(cached.verses) && cached.verses.length > 0) {
    return {
      ...cached,
      edition,
      meta,
      source: cached.source === 'custom-json' ? 'custom-json' : 'cache',
    };
  }

  // 2) Try fetching paired Arabic (quran-uthmani) + target translation in one request
  try {
    const dualRes = await fetch(
      `https://api.alquran.cloud/v1/surah/${safeSurah}/editions/quran-uthmani,${encodeURIComponent(edition.id)}`
    );
    if (dualRes.ok) {
      const json = await dualRes.json();
      const blocks: any[] = Array.isArray(json?.data) ? json.data : [];
      const arabicBlock =
        blocks.find((b) => b?.edition?.identifier === 'quran-uthmani') || blocks[0];
      const transBlock =
        blocks.find((b) => b?.edition?.identifier === edition.id) || blocks[1];

      const arabicAyahs: any[] = Array.isArray(arabicBlock?.ayahs) ? arabicBlock.ayahs : [];
      const transAyahs: any[] = Array.isArray(transBlock?.ayahs) ? transBlock.ayahs : [];

      if (transAyahs.length > 0 && arabicAyahs.length === transAyahs.length) {
        const verses: TranslatedVerse[] = transAyahs.map((tAyah, idx) => {
          const aAyah = arabicAyahs[idx] || {};
          const ayahNumber = Number(tAyah?.numberInSurah ?? aAyah?.numberInSurah ?? idx + 1);
          const rawArabic = String(aAyah?.text || '').replace(/^\uFEFF/, '').trim();
          return {
            ayahNumber,
            overallNumber: Number(aAyah?.number || tAyah?.number || 0) || undefined,
            arabicText: sanitizeAyahText(rawArabic, safeSurah, ayahNumber),
            translationText: String(tAyah?.text || '').trim(),
            juz: Number(aAyah?.juz || 0) || undefined,
            page: Number(aAyah?.page || 0) || undefined,
          };
        });

        const payload: TranslatedSurahData = {
          surahNumber: safeSurah,
          meta,
          edition,
          bismillahPre,
          verses,
          source: 'api',
        };
        await idbSet('tafsirs', cacheKey, payload);
        return payload;
      }
    }
  } catch {
    // Fall through to split fallback
  }

  // 3) Fallback: load local Arabic Surah (getSurahData) + single translation endpoint
  try {
    const [arabicSurah, transRes] = await Promise.all([
      getSurahData(safeSurah),
      fetch(`https://api.alquran.cloud/v1/surah/${safeSurah}/${encodeURIComponent(edition.id)}`),
    ]);

    if (transRes.ok) {
      const json = await transRes.json();
      const transAyahs: any[] = Array.isArray(json?.data?.ayahs) ? json.data.ayahs : [];

      if (transAyahs.length > 0) {
        const transByNum = new Map<number, string>();
        for (const t of transAyahs) {
          const n = Number(t?.numberInSurah || 0);
          if (n > 0) transByNum.set(n, String(t?.text || '').trim());
        }

        const verses: TranslatedVerse[] = arabicSurah.ayahs.map((a) => ({
          ayahNumber: a.numberInSurah,
          overallNumber: a.overallNumber,
          arabicText: sanitizeAyahText(a.text, safeSurah, a.numberInSurah),
          translationText: transByNum.get(a.numberInSurah) || '',
          juz: a.juz,
          page: a.page,
        }));

        if (verses.every((v) => v.translationText.length > 0)) {
          const payload: TranslatedSurahData = {
            surahNumber: safeSurah,
            meta,
            edition,
            bismillahPre,
            verses,
            source: 'api',
          };
          await idbSet('tafsirs', cacheKey, payload);
          return payload;
        }
      }
    }
  } catch {
    // Fall through to bundled starter Surahs
  }

  // 4) Bundled offline starter Surahs (1, 112, 113, 114)
  const bundled = BUNDLED_STARTER_TRANSLATIONS[edition.id]?.[safeSurah];
  if (bundled && bundled.length > 0) {
    return {
      surahNumber: safeSurah,
      meta,
      edition,
      bismillahPre,
      verses: bundled,
      source: 'bundled',
    };
  }

  throw new Error(
    `تعذر تحميل ${edition.arabicTitle} لسورة ${meta.name} حالياً؛ يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة.`
  );
}

/**
 * Fetches all registered translation editions for a Surah in parallel (used in Compare mode).
 */
export async function getSurahComparisonTranslations(
  surahNumber: number
): Promise<TranslatedSurahData[]> {
  const results = await Promise.all(
    TRANSLATION_EDITIONS.map((edition) => getSurahWithTranslation(surahNumber, edition.id))
  );
  return results;
}

/**
 * Downloads all 114 Surahs of a translation edition into IndexedDB for full offline availability.
 */
export async function downloadEditionOffline(
  editionId: string,
  onProgress?: (progress: { completed: number; total: number; failed: number }) => void,
  signal?: AbortSignal
): Promise<{ completed: number; total: number; failed: number; aborted: boolean }> {
  const edition = getTranslationEditionById(editionId);
  const total = 114;
  let completed = 0;
  let failed = 0;
  let aborted = false;

  const surahNumbers = Array.from({ length: total }, (_, idx) => idx + 1);
  let cursor = 0;
  const concurrency = 4;

  async function worker() {
    while (cursor < surahNumbers.length) {
      if (signal?.aborted) {
        aborted = true;
        return;
      }
      const surahNum = surahNumbers[cursor++];
      try {
        await getSurahWithTranslation(surahNum, edition.id);
        completed += 1;
      } catch {
        failed += 1;
      }
      onProgress?.({ completed, total, failed });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { completed, total, failed, aborted };
}

