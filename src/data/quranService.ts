import { SURAHS_LIST, SurahMeta } from './quranMetadata';
import { idbCount, idbGet, idbGetAllValues, idbSet } from '../utils/quranIndexedDb';
import { normalizeArabicText } from '../utils/arabicNormalize';

export interface Ayah {
  numberInSurah: number;
  overallNumber: number;
  text: string;
  tajweedText?: string;
  tafsir: string;
  juz: number;
  page: number;
  hizbQuarter: number;
  reflectionQuestion?: string;
  practicalAction?: string;
  asbabNuzul?: string;
  irabHint?: string;
}

export interface SurahData {
  meta: SurahMeta;
  bismillahPre: boolean;
  ayahs: Ayah[];
}

export interface MushafPageAyah extends Ayah {
  surahNumber: number;
  surahName: string;
  revelationTypeAr: 'مكية' | 'مدنية';
  bismillahPre: boolean;
}

export interface MushafPageData {
  pageNumber: number;
  ayahs: MushafPageAyah[];
}

/**
 * Word timing tuple aligned with QuranReader & KidsHifzStore:
 * [wordPosition (1-based), segmentIndex, startMs, endMs]
 */
export type WordSegment = [number, number, number, number];

export interface QuranSearchMatch {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  overallNumber?: number;
  text: string;
}

export interface TafsirEdition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
}

export const TAFSIR_EDITIONS: TafsirEdition[] = [
  {
    id: 'ar.muyassar',
    name: 'التفسير الميسر',
    nameEn: 'Al-Muyassar',
    description: 'تفسير موجز واضح لمجمع الملك فهد',
    descriptionEn: 'Clear concise commentary · King Fahd Complex',
  },
  {
    id: 'ar.jalalayn',
    name: 'تفسير الجلالين',
    nameEn: 'Al-Jalalayn',
    description: 'الجلال المحلي والسيوطي · مختصر محرر',
    descriptionEn: 'Al-Mahalli & Al-Suyuti · Classical concise tafsir',
  },
  {
    id: 'ar.waseet',
    name: 'التفسير الوسيط',
    nameEn: 'Al-Waseet',
    description: 'د. محمد سيد طنطاوي · أسلوب أدبي معاصر',
    descriptionEn: 'Dr. M. S. Tantawi · Contemporary literary style',
  },
  {
    id: 'ar.baghawi',
    name: 'تفسير البغوي',
    nameEn: 'Al-Baghawi',
    description: 'معالم التنزيل · تفسير بالمأثور مختصر',
    descriptionEn: "Ma'alim al-Tanzil · Narration-based commentary",
  },
  {
    id: 'ar.qurtubi',
    name: 'تفسير القرطبي',
    nameEn: 'Al-Qurtubi',
    description: 'الجامع لأحكام القرآن · الفقه والاستنباط',
    descriptionEn: 'Al-Jami li-Ahkam al-Quran · Jurisprudence & rulings',
  },
];

export function getTafsirEditionName(edition: TafsirEdition, lang: 'ar' | 'en'): string {
  return lang === 'en' ? edition.nameEn : edition.name;
}

export function getTafsirEditionDescription(edition: TafsirEdition, lang: 'ar' | 'en'): string {
  return lang === 'en' ? edition.descriptionEn : edition.description;
}

const MARKS = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u200C\\u0640]*';
const LEADING_BISMILLAH_RE = new RegExp(
  `^\\s*ب${MARKS}س${MARKS}م${MARKS}\\s+[ٱا]ل${MARKS}ل${MARKS}ه${MARKS}\\s+[ٱا]ل${MARKS}ر${MARKS}ح${MARKS}م${MARKS}ن${MARKS}\\s+[ٱا]ل${MARKS}ر${MARKS}ح${MARKS}ي${MARKS}م${MARKS}\\s*`,
  'u'
);

export function sanitizeAyahText(
  text: string,
  surahNumber: number,
  ayahNumber: number
): string {
  const withoutBom = (text || '').replace(/^\uFEFF/, '').trim();
  if (surahNumber !== 1 && ayahNumber === 1) {
    return withoutBom.replace(LEADING_BISMILLAH_RE, '').trim();
  }
  return withoutBom;
}

export function cleanupLegacySurahLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('bayan_surah_cache_')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage access errors
  }
}

// Built-in offline fallback for core short Surahs so the reader works even without internet on first visit
const BUNDLED_OFFLINE_SURAHS: Record<number, SurahData> = {
  1: {
    meta: SURAHS_LIST[0],
    bismillahPre: false,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 1,
        text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        tafsir: 'أبتدئ قراءة القرآن باسم الله مستعيناً به، الله ذو الرحمة العامة والخاصة.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 2,
        overallNumber: 2,
        text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        tafsir: 'الثناء على الله بصفاته التي كلها أوصاف كمال، وبنعمه الظاهرة والباطنة، وهو رب الخلق أجمعين.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 3,
        overallNumber: 3,
        text: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        tafsir: 'الرحمن الذي وسعت رحمته جميع الخلق، والرحيم بالمؤمنين.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 4,
        overallNumber: 4,
        text: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        tafsir: 'المتفرد بالملك والحكم في يوم الحساب والجزاء.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 5,
        overallNumber: 5,
        text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        tafsir: 'نخصك وحدك بالعبادة ونستعين بك وحدك في جميع أمورنا.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 6,
        overallNumber: 6,
        text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        tafsir: 'دلّنا وأرشدنا وثبتنا على الطريق الواضح الموصل إلى مرضاتك.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
      {
        numberInSurah: 7,
        overallNumber: 7,
        text: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        tafsir: 'طريق الذين أنعمت عليهم من النبيين والصديقين والشهداء والصالحين، غير طريق المغضوب عليهم ولا الضالين.',
        juz: 1,
        page: 1,
        hizbQuarter: 1,
      },
    ],
  },
  112: {
    meta: SURAHS_LIST[111],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6222,
        text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tafsir: 'قل أيها الرسول: هو الله الواحد الأحد المتفرد بالألوهية والكمال.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 2,
        overallNumber: 6223,
        text: 'ٱللَّهُ ٱلصَّمَدُ',
        tafsir: 'الله وحده المقصود في قضاء الحوائج والرغائب، الكامل في غناه وصفاته.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 3,
        overallNumber: 6224,
        text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        tafsir: 'ليس له ولد ولا والد ولا صاحبة، تعالى وتنزه عن ذلك.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 4,
        overallNumber: 6225,
        text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        tafsir: 'وليس له مثيل ولا نظير في أسمائه ولا صفاته ولا أفعاله.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
    ],
  },
  113: {
    meta: SURAHS_LIST[112],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6226,
        text: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        tafsir: 'قل أعتصم وأتحصن برب الصبح الذي يفلقه عن ظلمة الليل.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 2,
        overallNumber: 6227,
        text: 'مِن شَرِّ مَا خَلَقَ',
        tafsir: 'من شر كل مخلوق فيه شر وأذى.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 3,
        overallNumber: 6228,
        text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
        tafsir: 'ومن شر ليل شديد الظلمة إذا دخل وتغلغل.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 4,
        overallNumber: 6229,
        text: 'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ',
        tafsir: 'ومن شر الساحرات اللاتي ينفثن في عقد الخيوط للتأثير بالأذى.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 5,
        overallNumber: 6230,
        text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        tafsir: 'ومن شر حاسد يتمنى زوال النعمة إذا أظهر حسده وعمل بمقتضاه.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
    ],
  },
  114: {
    meta: SURAHS_LIST[113],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6231,
        text: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        tafsir: 'قل ألتجئ وأتحصن برب الناس وحده، القادر على دفع شر الوسواس.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 2,
        overallNumber: 6232,
        text: 'مَلِكِ ٱلنَّاسِ',
        tafsir: 'متصرف في أمور الناس ومالكهم الغني عنهم.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 3,
        overallNumber: 6233,
        text: 'إِلَـٰهِ ٱلنَّاسِ',
        tafsir: 'معبودهم بحق الذي لا معبود سواه.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 4,
        overallNumber: 6234,
        text: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
        tafsir: 'من أذى الشيطان الذي يوسوس للناس ويختفي ويتراجع عند ذكر الله.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 5,
        overallNumber: 6235,
        text: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
        tafsir: 'الذي يبث الشكوك والشرور في قلوب الناس.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
      {
        numberInSurah: 6,
        overallNumber: 6236,
        text: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
        tafsir: 'من شياطين الجن وشياطين الإنس على حد سواء.',
        juz: 30,
        page: 604,
        hizbQuarter: 240,
      },
    ],
  },
};

export async function getSurahData(surahNumber: number): Promise<SurahData> {
  const safeNum = Math.min(114, Math.max(1, Math.floor(surahNumber)));
  const cacheKey = `surah_${safeNum}`;

  const cached = await idbGet<SurahData>('surahs', cacheKey);
  if (cached && Array.isArray(cached.ayahs) && cached.ayahs.length > 0) {
    return cached;
  }

  const meta = SURAHS_LIST[safeNum - 1] || SURAHS_LIST[0];
  const bismillahPre = safeNum !== 1 && safeNum !== 9;

  try {
    const [uthmaniRes, tajweedRes, tafsirRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/surah/${safeNum}/quran-uthmani`),
      fetch(`https://api.alquran.cloud/v1/surah/${safeNum}/quran-tajweed`).catch(() => null),
      fetch(`https://api.alquran.cloud/v1/surah/${safeNum}/ar.muyassar`).catch(() => null),
    ]);

    if (!uthmaniRes.ok) {
      throw new Error(`HTTP ${uthmaniRes.status}`);
    }

    const uthmaniJson = await uthmaniRes.json();
    const uthmaniAyahs: any[] = uthmaniJson?.data?.ayahs || [];

    let tajweedAyahs: any[] = [];
    if (tajweedRes && tajweedRes.ok) {
      const tajJson = await tajweedRes.json().catch(() => null);
      tajweedAyahs = tajJson?.data?.ayahs || [];
    }

    let tafsirAyahs: any[] = [];
    if (tafsirRes && tafsirRes.ok) {
      const tafJson = await tafsirRes.json().catch(() => null);
      tafsirAyahs = tafJson?.data?.ayahs || [];
    }

    if (uthmaniAyahs.length === 0) {
      throw new Error('Empty ayahs payload');
    }

    const ayahs: Ayah[] = uthmaniAyahs.map((item, idx) => {
      const numInSurah = Number(item.numberInSurah || idx + 1);
      const rawText = sanitizeAyahText(String(item.text || ''), safeNum, numInSurah);
      const rawTaj = tajweedAyahs[idx]?.text
        ? sanitizeAyahText(String(tajweedAyahs[idx].text), safeNum, numInSurah)
        : undefined;
      const rawTafsir = tafsirAyahs[idx]?.text
        ? String(tafsirAyahs[idx].text).trim()
        : 'التفسير الميسر غير متوفر مؤقتاً لهذه الآية.';

      return {
        numberInSurah: numInSurah,
        overallNumber: Number(item.number || idx + 1),
        text: rawText,
        tajweedText: rawTaj,
        tafsir: rawTafsir,
        juz: Number(item.juz || meta.juzNumber),
        page: Number(item.page || meta.startPage),
        hizbQuarter: Number(item.hizbQuarter || 1),
      };
    });

    const surahData: SurahData = { meta, bismillahPre, ayahs };
    await idbSet('surahs', cacheKey, surahData);
    return surahData;
  } catch (err) {
    const bundled = BUNDLED_OFFLINE_SURAHS[safeNum];
    if (bundled) {
      return bundled;
    }
    throw new Error(
      err instanceof Error && err.message
        ? `تعذر جلب سورة ${meta.name}: ${err.message}`
        : `تعذر جلب سورة ${meta.name}، تحقق من الاتصال بالإنترنت.`
    );
  }
}

export function assembleMushafPageFromSurahs(
  pageNumber: number,
  surahs: SurahData[]
): MushafPageData | null {
  const safePage = Math.min(604, Math.max(1, Math.floor(Number.isFinite(pageNumber) ? pageNumber : 1)));
  if (!Array.isArray(surahs) || surahs.length === 0) return null;

  const uniqueBySurah = new Map<number, SurahData>();
  for (const s of surahs) {
    const sNum = s?.meta?.number;
    if (!sNum || !Array.isArray(s.ayahs) || s.ayahs.length === 0) continue;
    if (!uniqueBySurah.has(sNum)) {
      uniqueBySurah.set(sNum, s);
    }
  }

  const orderedSurahs = Array.from(uniqueBySurah.values()).sort(
    (a, b) => a.meta.number - b.meta.number
  );

  const ayahs: MushafPageAyah[] = [];
  for (const surah of orderedSurahs) {
    const surahNumber = surah.meta.number;
    const surahMeta = SURAHS_LIST[surahNumber - 1] || surah.meta;
    const pageAyahs = surah.ayahs
      .filter((a) => Number(a.page) === safePage)
      .sort((a, b) => a.numberInSurah - b.numberInSurah);

    for (const a of pageAyahs) {
      ayahs.push({
        ...a,
        page: safePage,
        surahNumber,
        surahName: surahMeta.name,
        revelationTypeAr: surahMeta.revelationTypeAr,
        bismillahPre: typeof surah.bismillahPre === 'boolean'
          ? surah.bismillahPre
          : surahNumber !== 1 && surahNumber !== 9,
      });
    }
  }

  if (ayahs.length === 0) return null;
  return { pageNumber: safePage, ayahs };
}

export async function getMushafPageData(pageNumber: number): Promise<MushafPageData> {
  const safePage = Math.min(604, Math.max(1, Math.floor(pageNumber)));
  const cacheKey = `page_${safePage}`;

  const cached = await idbGet<MushafPageData>('pages', cacheKey);
  if (cached && Array.isArray(cached.ayahs) && cached.ayahs.length > 0) {
    return cached;
  }

  try {
    const [uthmaniRes, tajweedRes, tafsirRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/page/${safePage}/quran-uthmani`),
      fetch(`https://api.alquran.cloud/v1/page/${safePage}/quran-tajweed`).catch(() => null),
      fetch(`https://api.alquran.cloud/v1/page/${safePage}/ar.muyassar`).catch(() => null),
    ]);

    if (!uthmaniRes.ok) {
      throw new Error(`HTTP ${uthmaniRes.status}`);
    }

    const uthmaniJson = await uthmaniRes.json();
    const uthmaniAyahs: any[] = uthmaniJson?.data?.ayahs || [];

    let tajweedAyahs: any[] = [];
    if (tajweedRes && tajweedRes.ok) {
      const tajJson = await tajweedRes.json().catch(() => null);
      tajweedAyahs = tajJson?.data?.ayahs || [];
    }

    let tafsirAyahs: any[] = [];
    if (tafsirRes && tafsirRes.ok) {
      const tafJson = await tafsirRes.json().catch(() => null);
      tafsirAyahs = tafJson?.data?.ayahs || [];
    }

    const ayahs: MushafPageAyah[] = uthmaniAyahs.map((item, idx) => {
      const surahNumber = Number(item.surah?.number || 1);
      const surahMeta = SURAHS_LIST[surahNumber - 1] || SURAHS_LIST[0];
      const numInSurah = Number(item.numberInSurah || idx + 1);
      const rawText = sanitizeAyahText(String(item.text || ''), surahNumber, numInSurah);
      const rawTaj = tajweedAyahs[idx]?.text
        ? sanitizeAyahText(String(tajweedAyahs[idx].text), surahNumber, numInSurah)
        : undefined;
      const rawTafsir = tafsirAyahs[idx]?.text
        ? String(tafsirAyahs[idx].text).trim()
        : 'التفسير الميسر غير متوفر مؤقتاً لهذه الآية.';

      return {
        numberInSurah: numInSurah,
        overallNumber: Number(item.number || idx + 1),
        text: rawText,
        tajweedText: rawTaj,
        tafsir: rawTafsir,
        juz: Number(item.juz || surahMeta.juzNumber),
        page: safePage,
        hizbQuarter: Number(item.hizbQuarter || 1),
        surahNumber,
        surahName: surahMeta.name,
        revelationTypeAr: surahMeta.revelationTypeAr,
        bismillahPre: surahNumber !== 1 && surahNumber !== 9,
      };
    });

    const pageData: MushafPageData = { pageNumber: safePage, ayahs };
    await idbSet('pages', cacheKey, pageData);
    return pageData;
  } catch (err) {
    // Offline fallback: reconstruct any Mus'haf page from downloaded IndexedDB surahs + bundled offline surahs
    try {
      const cachedSurahs = await idbGetAllValues<SurahData>('surahs');
      const reconstructed = assembleMushafPageFromSurahs(safePage, [
        ...cachedSurahs,
        ...Object.values(BUNDLED_OFFLINE_SURAHS),
      ]);
      if (reconstructed && reconstructed.ayahs.length > 0) {
        return reconstructed;
      }
    } catch {
      // Fallback directly to bundled surahs if IndexedDB is unavailable
      const bundledPage = assembleMushafPageFromSurahs(
        safePage,
        Object.values(BUNDLED_OFFLINE_SURAHS)
      );
      if (bundledPage && bundledPage.ayahs.length > 0) {
        return bundledPage;
      }
    }

    throw new Error(
      err instanceof Error && err.message
        ? `تعذر تحميل الصفحة ${safePage}: ${err.message}`
        : `تعذر تحميل الصفحة ${safePage}، تأكد من اتصالك بالإنترنت.`
    );
  }
}

export async function getAyahTafsirByEdition(
  surahNumber: number,
  ayahNumber: number,
  editionId: string
): Promise<string> {
  const safeEdition = editionId || 'ar.muyassar';
  const cacheKey = `${safeEdition}:${surahNumber}:${ayahNumber}`;

  const cached = await idbGet<string>('tafsirs', cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/${encodeURIComponent(safeEdition)}`
  );
  if (!res.ok) {
    throw new Error(`تعذر جلب التفسير (${res.status})`);
  }
  const json = await res.json();
  const text = String(json?.data?.text || '').trim();
  if (!text) {
    throw new Error('لم يتم العثور على نص هذا التفسير لهذه الآية');
  }
  await idbSet('tafsirs', cacheKey, text);
  return text;
}

/**
 * Normalizes Quran.com per-ayah `by_chapter` segment tuples into canonical
 * 1-based single-word `[wordPos, wordPos, startMs, endMs]` entries sorted by startMs.
 * Handles stringified tuples (e.g. Sudais) and proportionally splits multi-word spans.
 */
export function normalizeQuranComSegments(rawSegs: unknown[]): WordSegment[] {
  const normalized: WordSegment[] = [];
  if (!Array.isArray(rawSegs)) return normalized;

  for (const seg of rawSegs) {
    if (!Array.isArray(seg)) continue;

    if (seg.length >= 4) {
      const s0 = Number(seg[0]);
      const s1 = Number(seg[1]);
      const startMs = Number(seg[2]);
      const endMs = Number(seg[3]);
      if (
        !Number.isFinite(s0) ||
        !Number.isFinite(s1) ||
        !Number.isFinite(startMs) ||
        !Number.isFinite(endMs) ||
        s0 < 0 ||
        endMs < startMs
      ) {
        continue;
      }

      const startPos = Math.max(1, Math.floor(s0) + 1);
      const endPos = Math.max(startPos, Math.floor(s1));
      const spanCount = endPos - startPos + 1;

      if (spanCount === 1) {
        normalized.push([startPos, startPos, startMs, endMs]);
      } else {
        const spanDur = Math.max(0, endMs - startMs);
        for (let offset = 0; offset < spanCount; offset++) {
          const wordPos = startPos + offset;
          const subStart = Math.round(startMs + (spanDur * offset) / spanCount);
          const subEnd = Math.round(startMs + (spanDur * (offset + 1)) / spanCount);
          normalized.push([wordPos, wordPos, subStart, subEnd]);
        }
      }
    } else if (seg.length === 3) {
      const s0 = Number(seg[0]);
      const startMs = Number(seg[1]);
      const endMs = Number(seg[2]);
      if (
        !Number.isFinite(s0) ||
        !Number.isFinite(startMs) ||
        !Number.isFinite(endMs) ||
        s0 < 0 ||
        endMs < startMs
      ) {
        continue;
      }
      const wordPos = Math.max(1, Math.floor(s0) + 1);
      normalized.push([wordPos, wordPos, startMs, endMs]);
    }
  }

  normalized.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
  return normalized;
}

export async function getSurahAudioSegments(
  recitationId: number,
  surahNumber: number
): Promise<Record<number, WordSegment[]>> {
  const cacheKey = `v2:${recitationId}:${surahNumber}`;
  const cached = await idbGet<Record<number, WordSegment[]>>('segments', cacheKey);
  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }

  try {
    const map: Record<number, WordSegment[]> = {};
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 20) {
      const res = await fetch(
        `https://api.quran.com/api/v4/recitations/${recitationId}/by_chapter/${surahNumber}?fields=segments&per_page=300&page=${page}`
      );
      if (!res.ok) break;
      const json = await res.json();
      const audioFiles: any[] = Array.isArray(json?.audio_files) ? json.audio_files : [];

      for (const item of audioFiles) {
        const verseKey = String(item?.verse_key || '');
        const parts = verseKey.split(':');
        const ayahNum = Number(parts[1]);
        if (!Number.isFinite(ayahNum) || ayahNum <= 0) continue;

        const normalizedSegs = normalizeQuranComSegments(item?.segments);
        if (normalizedSegs.length > 0) {
          map[ayahNum] = normalizedSegs;
        }
      }

      const nextPage = json?.pagination?.next_page;
      const reportedTotal = Number(json?.pagination?.total_pages || 1);
      totalPages = Number.isFinite(reportedTotal) && reportedTotal > 0 ? reportedTotal : 1;
      if (!nextPage || nextPage <= page) break;
      page = Number(nextPage);
    }

    if (Object.keys(map).length > 0) {
      await idbSet('segments', cacheKey, map);
    }
    return map;
  } catch {
    return {};
  }
}

export async function searchQuranAyahs(query: string): Promise<QuranSearchMatch[]> {
  const normalizedQuery = normalizeArabicText(query);
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const results: QuranSearchMatch[] = [];
  const seen = new Set<string>();

  const pushMatch = (m: QuranSearchMatch) => {
    const key = `${m.surahNumber}:${m.ayahNumber}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(m);
  };

  // 1) Search cached surahs in IndexedDB + bundled offline surahs
  try {
    const cachedSurahs = await idbGetAllValues<SurahData>('surahs');
    const pools = [...cachedSurahs, ...Object.values(BUNDLED_OFFLINE_SURAHS)];
    for (const surah of pools) {
      if (!surah?.meta || !Array.isArray(surah.ayahs)) continue;
      for (const ayah of surah.ayahs) {
        if (normalizeArabicText(ayah.text).includes(normalizedQuery)) {
          pushMatch({
            surahNumber: surah.meta.number,
            surahName: surah.meta.name,
            ayahNumber: ayah.numberInSurah,
            overallNumber: ayah.overallNumber,
            text: ayah.text,
          });
          if (results.length >= 50) return results;
        }
      }
    }
  } catch {
    // Continue to online search
  }

  // 2) Online AlQuran Cloud search across entire Mus'haf
  try {
    const res = await fetch(
      `https://api.alquran.cloud/v1/search/${encodeURIComponent(normalizedQuery)}/all/quran-simple-clean`
    );
    if (res.ok) {
      const json = await res.json();
      const matches: any[] = json?.data?.matches || [];
      for (const m of matches) {
        const sNum = Number(m?.surah?.number || 0);
        const aNum = Number(m?.numberInSurah || 0);
        if (!sNum || !aNum) continue;
        const meta = SURAHS_LIST[sNum - 1];
        pushMatch({
          surahNumber: sNum,
          surahName: meta?.name || String(m?.surah?.name || ''),
          ayahNumber: aNum,
          overallNumber: Number(m?.number || 0) || undefined,
          text: String(m?.text || ''),
        });
        if (results.length >= 60) break;
      }
    }
  } catch {
    // Return local matches seamlessly if offline
  }

  return results;
}

export async function getOfflineCachedSurahsCount(): Promise<number> {
  const count = await idbCount('surahs');
  return Math.max(Object.keys(BUNDLED_OFFLINE_SURAHS).length, count);
}

export async function downloadFullQuranOffline(
  onProgress?: (progress: { completed: number; total: number; failed: number }) => void
): Promise<{ completed: number; total: number; failed: number }> {
  const total = 114;
  let completed = 0;
  let failed = 0;

  const surahNumbers = Array.from({ length: total }, (_, idx) => idx + 1);
  const concurrency = 4;

  let cursor = 0;
  async function worker() {
    while (cursor < surahNumbers.length) {
      const surahNum = surahNumbers[cursor++];
      try {
        await getSurahData(surahNum);
        completed++;
      } catch {
        failed++;
      }
      onProgress?.({ completed, total, failed });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { completed, total, failed };
}
