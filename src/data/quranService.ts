import { SURAHS_LIST, SurahMeta } from './quranMetadata';
import { safeLocalStorage } from '../utils/safeStorage';
import { idbGet, idbSet, idbGetAllValues, idbCount } from '../utils/quranIndexedDb';
import { normalizeArabicText } from '../utils/arabicNormalize';

export interface Ayah {
  numberInSurah: number;
  overallNumber: number;
  text: string;
  tajweedText?: string;
  tafsir: string;
  irabHint?: string;
  asbabNuzul?: string;
  reflectionQuestion?: string;
  practicalAction?: string;
  juz: number;
  page: number;
  hizbQuarter: number;
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

export interface TafsirEdition {
  id: string;
  name: string;
  description: string;
}

export const TAFSIR_EDITIONS: TafsirEdition[] = [
  { id: 'ar.muyassar', name: 'التفسير الميسر', description: 'مجمع الملك فهد لطباعة المصحف الشريف' },
  { id: 'ar.jalalayn', name: 'تفسير الجلالين', description: 'تفسير وجيز ميسّر المعاني' },
  { id: 'ar.waseet', name: 'التفسير الوسيط', description: 'تفسير محمد سيد طنطاوي' },
  { id: 'ar.baghawi', name: 'تفسير البغوي', description: 'معالم التنزيل في التفسير والأثر' },
  { id: 'ar.qurtubi', name: 'تفسير القرطبي', description: 'الجامع لأحكام القرآن' },
];

export interface QuranSearchMatch {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  overallNumber: number;
}

// Tuple from Quran.com segments: [wordStartIndex, wordEndIndex, startMs, endMs]
export type WordSegment = [number, number, number, number];

// Curated authentic preloaded dataset with full Tafsir and verified overallNumber
export const PRELOADED_SURAHS: Record<number, SurahData> = {
  // Surah 1: Al-Fatiha (Ayahs 1 - 7, overall 1 - 7)
  1: {
    meta: SURAHS_LIST[0],
    bismillahPre: false,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 1,
        text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
        tajweedText: 'بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h:3[ٱ][l[ل]رَّح[p[ِي]مِ',
        tafsir: 'أبتدئ قراءتي مستعيناً باسم الله مستحضراً رحمته الواسعة التي وسعت كل شيء، ورحمته الخاصة بعباده المؤمنين.',
        irabHint: 'الباء حرف جر للمصاحبة والاستعانة، (اسمِ) مجرور، و(اللهِ) لفظ الجلالة مضاف إليه، (الرحمنِ الرحيمِ) نعتان جليلان.',
        asbabNuzul: 'فاتحة الكتاب وأم القرآن، أنزلت بمكة وقيل بالمدينة، وهي أعظم سورة في كتاب الله.',
        reflectionQuestion: 'لماذا افتتح الله كتابه بصفتي الرحمة (الرحمن الرحيم) وليس بصفتي الجبروت والقوة؟',
        practicalAction: 'لا تبدأ عملاً، أكلاً، أو سفراً اليوم إلا واستحضر اسم الله برجاء التوفيق والبركة.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 2,
        overallNumber: 2,
        text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
        tajweedText: 'ٱلْحَمْدُ لِلَّهِ رَبِّ [h:4[ٱ]لْعَ[n[ـٰ]لَم[p[ِي]نَ',
        tafsir: 'الثناء الكامل المطلق لله وحده بجميع صفات كماله ونعمه الظاهرة والباطنة، وهو المربي لجميع الخلق برعايته.',
        irabHint: 'الـ في (الحمدُ) لاستغراق جميع المحامد، (ربِّ) نعت أو بدل مجرور، (العالمينَ) مضاف إليه مجرور بالياء لأنه ملحق بجمع المذكر السالم.',
        reflectionQuestion: 'هل تشعر أن حمدك لله نابع من حب وتأمل في تفاصيل نعم يومك أم مجرد لفظ روتيني؟',
        practicalAction: 'عدد ثلاث نعم خفية أنعم الله بها عليك اليوم (كالأنفاس، والأمن، وراحة البال) وقل بقلبك: الحمد لله.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 3,
        overallNumber: 3,
        text: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
        tajweedText: 'ٱ[l[ل]رَّحْمَ[n[ـٰ]نِ [h:3[ٱ][l[ل]رَّح[p[ِي]مِ',
        tafsir: 'الرحمن: ذو الرحمة العامة الشاملة لجميع المخلوقات في الدنيا، والرحيم: ذو الرحمة الخاصة بالمؤمنين في الآخرة.',
        irabHint: 'صفتان مشبهتان مشتقتان من الرحمة، (الرحمن) على وزن فعلان يدل على الامتلاء، و(الرحيم) على وزن فعيل يدل على الدوام.',
        reflectionQuestion: 'كيف تنعكس رحمة الله بك على تعاملك اليومي مع المخطئين ومن هم تحت إدارتك ورعايتك؟',
        practicalAction: 'ارحم مسكيناً أو خادماً أو حيواناً، فإنما يرحم الله من عباده الرحماء.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 4,
        overallNumber: 4,
        text: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
        tajweedText: 'مَ[n[ـٰ]لِكِ يَوْمِ [h:5[ٱ][l[ل]دّ[p[ِي]نِ',
        tafsir: 'المالك المتصرف وحده بيوم الحساب والجزاء، يوم لا تملك نفس لنفس شيئاً والأمر يومئذ لله.',
        irabHint: '(مالكِ) صفة ثالثة للفظ الجلالة، و(يومِ) مضاف إليه، و(الدينِ) مضاف إليه ثانٍ بمعنى الجزاء والحساب.',
        reflectionQuestion: 'ما هو العمل الصالح الذي أعددته ليومٍ ينفرد فيه الملك الجبار بالقضاء بين الخلائق؟',
        practicalAction: 'تحلل من مظلمة بينك وبين أحد قبل أن يؤخذ من حسناتك في يوم الجزاء.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 5,
        overallNumber: 5,
        text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        tajweedText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَع[p[ِي]نُ',
        tafsir: 'نخصك وحدك بالعبادة والتذلل، ونخصك وحدك بطلب العون في كل شؤوننا، فلا نعبد غيرك ولا نتوكل إلا عليك.',
        irabHint: 'تقديم المعمول (إياك) يفيد الحصر والاختصاص والاهتمام، أي: لا نعبد إلا أنت.',
        reflectionQuestion: 'سر القرآن في الفاتحة، وسر الفاتحة في (إياك نعبد وإياك نستعين).. هل تبرأت اليوم من حولك وقوتك ولجأت لقوة الله؟',
        practicalAction: 'عندما يستعصي عليك أمر معقد في عملك أو حياتك، كرر بيقين: لا حول ولا قوة إلا بالله، وإياك نستعين.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 6,
        overallNumber: 6,
        text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        tajweedText: 'ٱهْدِنَا [h:6[ٱ][l[ل]صِّر[n[َٲ]طَ [h:7[ٱ]لْمُسْتَق[p[ِي]مَ',
        tafsir: 'دلّنا ووفّقنا وثبّتنا على الطريق الواضح الموصل إلى رضاك وجنتك، وهو دين الإسلام الحق.',
        irabHint: '(اهدِنا) فعل دعاء مبني على حذف حرف العلة، و(نا) مفعول به أول، و(الصراطَ) مفعول به ثانٍ، و(المستقيمَ) نعت منصوب.',
        reflectionQuestion: 'أنت مهتدٍ للإسلام، فلماذا تطلب الهداية في كل ركعة؟ لأنك تحتاج التثبيت، والزيادة، والتوفيق في التفاصيل!',
        practicalAction: 'ادع الله بإخلاص أن يبصرك بالحق في مسألة تتردد فيها ولا تعرف أين الخير فيها.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      },
      {
        numberInSurah: 7,
        overallNumber: 7,
        text: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        tajweedText: 'صِر[n[َٲ]طَ [h:8[ٱ]لَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ [h:9[ٱ]لْمَغْضُوبِ عَلَيْهِمْ وَلَا [h:10[ٱ][l[ل]ضّ[m[َا]ٓلّ[p[ِي]نَ',
        tafsir: 'طريق النبيين والصديقين والشهداء والصالحين، لا طريق من علموا الحق فتركوه (المغضوب عليهم)، ولا من عبدوا الله على جهل وضلال (الضالين).',
        irabHint: '(صراطَ) بدل مطابق من الصراط الأول منصوب، (غيرِ) بدل أو نعت، (ولا) لتأكيد النفي، (الضالين) معطوف مجرور بالياء.',
        reflectionQuestion: 'أي القوافل تتبع في أفكارك وقدواتك اليوم؟ قافلة المنعم عليهم أم المنحرفين عن الجادة؟',
        practicalAction: 'قل بعد ختم السورة (آمين) بقلب حاضر راجياً إجابة هذا الدعاء الجامع الشافي.',
        juz: 1,
        page: 1,
        hizbQuarter: 1
      }
    ]
  },

  // Surah 112: Al-Ikhlas (Ayahs 1 - 4, overall 6222 - 6225)
  112: {
    meta: SURAHS_LIST[111],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6222,
        text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: 'قُلْ هُوَ [h:8078[ٱ]للَّهُ أَحَ[q[د]ٌ',
        tafsir: 'قل أيها النبي لمن سألوك عن ربك: هو الله المتفرد بالألوهية والربوبية والأسماء والصفات، لا شريك له ولا مثيل.',
        irabHint: '(قل) فعل أمر، (هو) ضمير الشأن مبتدأ أول، (الله) مبتدأ ثانٍ أو علم، (أحد) خبر.',
        asbabNuzul: 'سأل المشركون رسول الله ﷺ: انسب لنا ربك أمِن ذهب هو أم من فضة؟ فأنزل الله هذه السورة العظيمة تعدل ثلث القرآن.',
        reflectionQuestion: 'هل تشعر بوحدانية الله في كل قرار بحيث لا ترجو أحداً سواه ولا تخشى أحداً دونه؟',
        practicalAction: 'اقرأ سورة الإخلاص مستحضراً أنها تعدل ثلث القرآن في الفضل والمكانة كما صح في الحديث الشريف (صحيح البخاري: 5015)، واجعلها رفيقة ليلك ونهارك.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 2,
        overallNumber: 6223,
        text: 'ٱللَّهُ ٱلصَّمَدُ',
        tajweedText: 'ٱللَّهُ [h:14675[ٱ][l[ل]صَّمَ[q[د]ُ',
        tafsir: 'السيد المقصود في قضاء الحوائج والرغائب، الذي تصمد وتفزع إليه الخلائق كلها في نوائبها وهو الغني عنها.',
        irabHint: '(الصمد) خبر مرفوع للمبتدأ (الله)، وتعرّفه بأل للدلالة على كمال الصمدية وانحصارها فيه.',
        reflectionQuestion: 'الصمد: الذي تقصده كل القلوب عند الاضطرار.. إلى من تلجأ أنت أول ما تقع في كربة؟',
        practicalAction: 'إذا حزّك أمر مفاجئ، اصمد وتوجه فوراً إلى الصمد بركعتين قبل استشارة أي بشري.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 3,
        overallNumber: 6224,
        text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        tajweedText: 'لَمْ يَلِ[q:14676[دْ] وَلَمْ يُولَ[q:14677[دْ]',
        tafsir: 'منزه عن اتخاذ الولد، ولم يلد أحداً ولم يلده أحد، لكمال غناه وأزليته وأبديته سبحانه.',
        irabHint: '(لم يلد) فعل مضارع مجزوم بلم، وعطف (ولم يولد) نفي للعلة الفاعلة والقابلة.',
        reflectionQuestion: 'تنزيه الله عن النقص البشري يبني في عقلك معنى الألوهية الحقة الخالصة من الخرافات.',
        practicalAction: 'احمد الله على نعمة التوحيد النقي الذي يحرر العقل من الشرك والأوهام.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 4,
        overallNumber: 6225,
        text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        tajweedText: 'وَلَمْ يَك[u:2596[ُن ل]َّهُ[n[ۥ] كُفُوًا أَحَ[q[د]ُۢ',
        tafsir: 'ولم يكن له مماثلاً ولا نظيراً ولا مكافئاً أحد في ذاته أو صفاته أو أفعاله.',
        irabHint: '(كفواً) خبر كان مقدم منصوب، و(أحدٌ) اسم كان مؤخر مرفوع، وتقديم الخبر لإظهار نفي الكفاءة ابتداءً.',
        reflectionQuestion: 'لا شيء يشبه الله في رحمته ولطفه وتدبيره لأمرك، فاطمئن لتقديره.',
        practicalAction: 'عظّم شعائر الله بلسانك وقلبك، ورسخ هذا التوحيد الصافي في نفوس أهلك وأبنائك.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      }
    ]
  },

  // Surah 113: Al-Falaq (Ayahs 1 - 5, overall 6226 - 6230)
  113: {
    meta: SURAHS_LIST[112],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6226,
        text: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        tajweedText: 'قُلْ أَعُوذُ بِرَبِّ [h:14678[ٱ]لْفَلَ[q[ق]ِ',
        tafsir: 'قل: ألتجئ وأتحصن برب الصبح الذي يفلق الظلام بنور الفجر، وخالق كل ما ينفلق كالحب والنوى.',
        irabHint: '(الفلق) الصبح أو كل ما يفلقه الله، مضاف إليه مجرور.',
        reflectionQuestion: 'كما يفلق الله ظلمة الليل الدامس بنور الفجر الوضاء، قادر على فلق ظلمات همك بنور الفرج.',
        practicalAction: 'ابدأ صباحك بالاستعاذة برب الفلق من كل ما تخافه وتحذره.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 2,
        overallNumber: 6227,
        text: 'مِن شَرِّ مَا خَلَقَ',
        tajweedText: 'مِ[f:14679[ن ش]َرِّ مَا خَلَ[q[ق]َ',
        tafsir: 'من أذى وشر جميع المخلوقات التي خلقها من إنس وجن وحيوان وجماد.',
        irabHint: '(ما) اسم موصول في محل جر مضاف إليه، وصلته (خلق).',
        reflectionQuestion: 'استعاذة جامعة تشمل كل شرور العالم المنظور وغير المنظور في خمس كلمات!',
        practicalAction: 'استشعر حماية الله لك وحصانته عند خروجك من بيتك ومخالطتك للناس.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 3,
        overallNumber: 6228,
        text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
        tajweedText: 'وَمِ[f:14680[ن ش]َرِّ غَاسِقٍ إِذَا وَقَ[q[ب]َ',
        tafsir: 'ومن شر الليل المظلم إذا دخل وسكنت حركته وانتشرت فيه الهوام وذوو النوايا الخبيثة.',
        irabHint: '(غاسق) الليل أو القمر، (وقب) دخل وظلم.',
        reflectionQuestion: 'الليل مظنة الضعف الإنساني واستيقاظ المخاوف، وتحصين القرآن يملأ ليلك سكينة.',
        practicalAction: 'اقرأ المعوذات في كفيك وامسح بهما جسدك قبل النوم كما كان يفعل النبي ﷺ.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 4,
        overallNumber: 6229,
        text: 'وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ',
        tajweedText: 'وَمِ[f:14680[ن ش]َرِّ [h:14681[ٱ][l[ل][g[نّ]َفَّ[n[ـٰ]ثَ[n[ـٰ]تِ فِى [h:14682[ٱ]لْعُقَ[q[د]ِ',
        tafsir: 'ومن شر السواحر اللاتي يعقدن الخيوط وينفثن فيها بريق السحر والأذى لإفساد العلاقات والنفوس.',
        irabHint: '(النفاثات) صيغة مبالغة على وزن فعالات، (في العقد) متعلق بالنفاثات.',
        reflectionQuestion: 'كيد السحرة والمفسدين يبطله التوكل على الله وقراءة القرآن، فلا خوف مع كتاب الله.',
        practicalAction: 'لا تلتفت للخرافات والشعوذات، واكتفِ بالرقى الشرعية المأثورة.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 5,
        overallNumber: 6230,
        text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        tajweedText: 'وَمِ[f:14680[ن ش]َرِّ حَاسِدٍ إِذَا حَسَ[q[د]َ',
        tafsir: 'ومن شر من يتمنى زوال نعمة الله عن غيره إذا أظهر حسده وسعى في إلحاق الضرر بالمحسود.',
        irabHint: '(إذا حسد) قيد مهم، فالحسد لا يضر إلا إذا تفاعل وأخرج شره بالعين أو الفعل.',
        reflectionQuestion: 'الحاسد يعترض في باطنه على قسمة الله بين عباده.. طهّر قلبك من الغل تكن أسعد الناس.',
        practicalAction: 'إذا رأيت ما يعجبك في نفسك أو مالك أو غيرك، فبرّك فوراً وقل: ما شاء الله لا قوة إلا بالله، اللهم بارك له.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      }
    ]
  },

  // Surah 114: An-Nas (Ayahs 1 - 6, overall 6231 - 6236)
  114: {
    meta: SURAHS_LIST[113],
    bismillahPre: true,
    ayahs: [
      {
        numberInSurah: 1,
        overallNumber: 6231,
        text: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        tajweedText: 'قُلْ أَعُوذُ بِرَبِّ [h:14683[ٱ][l[ل][g[نّ][p[َا]سِ',
        tafsir: 'قل: ألتجئ برب الناس وخالقهم ومدبر أمورهم ومربيهم بنعمه.',
        irabHint: '(برب الناس) تخصيص الناس بالذكر تشريفاً وتذكيراً بضعفهم وحاجتهم إليه.',
        reflectionQuestion: 'أنت من الناس، وخالقك هو رب الناس، فلماذا تطلب الأمان من غير ربك؟',
        practicalAction: 'اجعل لسانك رطباً بالاستعاذة عند توارد الأفكار المزعجة.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 2,
        overallNumber: 6232,
        text: 'مَلِكِ ٱلنَّاسِ',
        tajweedText: 'مَلِكِ [h:14684[ٱ][l[ل][g[نّ][p[َا]سِ',
        tafsir: 'الملك الحق لجميع البشر، المتصرف فيهم بعدله وقدرته، وكل الملوك دونه عبيد.',
        irabHint: '(ملكِ الناس) عطف بيان أو بدل من رب الناس.',
        reflectionQuestion: 'حين تستحضر أن ملك الناس معك، تتضاءل في عينك كل قوى الأرض الظالمة.',
        practicalAction: 'لا ترجُ من الملوك والحكام ما لا يقدر عليه إلا مالك الملك سبحانه.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 3,
        overallNumber: 6233,
        text: 'إِلَٰهِ ٱلنَّاسِ',
        tajweedText: 'إِلَ[n[ـٰ]هِ [h:14685[ٱ][l[ل][g[نّ][p[َا]سِ',
        tafsir: 'معبودهم الحق الذي لا معبود سواه، والمستحق وحده لإخلاص المحبة والخشية والتذلل.',
        irabHint: '(إله الناس) صفة ثالثة تؤكد حصر العبادة.',
        reflectionQuestion: 'تكرار (الناس) يؤكد أهمية حماية هذا المخلوق من ألد أعدائه (الشيطان).',
        practicalAction: 'جدد لا إله إلا الله بصدق، فالإله هو المألوه المحبوب المطاع.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 4,
        overallNumber: 6234,
        text: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
        tajweedText: 'مِ[f:14679[ن ش]َرِّ [h:14686[ٱ]لْوَسْوَاسِ [h:14687[ٱ]لْخَ[g[نّ][p[َا]سِ',
        tafsir: 'من شر الشيطان الذي يلقي الشبهات والشهوات خفية في الصدور، فإذا ذكر العبد ربه خنس وتراجع واختفى.',
        irabHint: '(الوسواس) مصدر سمي به الفاعل مبالغة، (الخناس) صيغة مبالغة لكثير الاختفاء عند ذكر الله.',
        reflectionQuestion: 'الشيطان لا يملك سلطاناً يجبرك، سلاحه الوحيد هو "الوسوسة".. وعلاجه الفوري "ذكر الله" ليخنس!',
        practicalAction: 'حين تهجم عليك وسوسة معصية أو قنوط، اقطع حبل التفكير فوراً بذكر الله والاستعاذة.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 5,
        overallNumber: 6235,
        text: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
        tajweedText: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ [h:14688[ٱ][l[ل][g[نّ][p[َا]سِ',
        tafsir: 'الذي يبث الشر والشكوك في قلوب الناس بحيلة وخفاء.',
        irabHint: '(في صدور الناس) الصدر هو ساحة المعركة ومحل القلب، والوسوسة تبدأ فيه.',
        reflectionQuestion: 'راقب خواطر صدرك.. فما كان يدعوك للخير فهو من الملك أو الفطرة، وما كان يدعوك للشر فهو من الوسواس.',
        practicalAction: 'نظف صدرك من الأحقاد والشكوك بالاستغفار وقراءة القرآن المتدبر.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      },
      {
        numberInSurah: 6,
        overallNumber: 6236,
        text: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
        tajweedText: 'مِنَ [h:6531[ٱ]لْجِ[g[نّ]َةِ وَ[h:824[ٱ][l[ل][g[نّ][p[َا]سِ',
        tafsir: 'الوسوسة تكون من شياطين الجن بإلقاء الخواطر الخفية، ومن شياطين الإنس بالأقوال المضللة وجلساء السوء.',
        irabHint: '(من الجنة) بيان لمن يوسوس، (والناس) معطوف.',
        reflectionQuestion: 'شيطان الإنس قد يكون أخطر لأنه يأتيك بثياب الناصح الصديق.. فاختر صحبة تعينك على طاعة الله.',
        practicalAction: 'ابتعد عن أي رفيق أو محتوى رقمي يجر قلبك إلى الغفلة والتشكيك في دينك.',
        juz: 30,
        page: 604,
        hizbQuarter: 120
      }
    ]
  }
};

/**
 * Sanitizes Ayah text to remove UTF-8 BOM and prevent Bismillah duplication on non-Fatiha opening ayahs.
 */
export function sanitizeAyahText(text: string, surahNumber: number, ayahNumber: number): string {
  if (!text) return '';
  let clean = text.replace(/^\uFEFF/, '').trim();
  if (surahNumber !== 1 && ayahNumber === 1) {
    const bismillahRegex = /^ب[\u064B-\u065F\u0670\u0640]*س[\u064B-\u065F\u0670\u0640]*م[\u064B-\u065F\u0670\u0640]*\s+[ٱا]لل[\u064B-\u065F\u0670\u0640]*ه[\u064B-\u065F\u0670\u0640]*\s+[ٱا]لر[\u064B-\u065F\u0670\u0640]*ح[\u064B-\u065F\u0670\u0640]*م[\u064B-\u065F\u0670\u0640]*ن[\u064B-\u065F\u0670\u0640]*\s+[ٱا]لر[\u064B-\u065F\u0670\u0640]*ح[\u064B-\u065F\u0670\u0640]*ي[\u064B-\u065F\u0670\u0640]*م[\u064B-\u065F\u0670\u0640]*\s*/u;
    clean = clean.replace(bismillahRegex, '').trim();
  }
  return clean;
}

/**
 * Fetcher with IndexedDB + LocalStorage Offline-first Cache.
 */
export async function getSurahData(surahNumber: number): Promise<SurahData> {
  if (PRELOADED_SURAHS[surahNumber]) {
    return PRELOADED_SURAHS[surahNumber];
  }

  const meta = SURAHS_LIST.find((s) => s.number === surahNumber) || SURAHS_LIST[0];
  const idbKey = `surah_${surahNumber}`;

  const idbCached = await idbGet<SurahData>('surahs', idbKey);
  if (idbCached && Array.isArray(idbCached.ayahs) && idbCached.ayahs.length === meta.numberOfAyahs) {
    return idbCached;
  }

  const cacheKey = `bayan_surah_cache_v2_${surahNumber}`;
  const cached = safeLocalStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed: SurahData = JSON.parse(cached);
      if (parsed.ayahs && parsed.ayahs.length === meta.numberOfAyahs) {
        parsed.ayahs[0].text = sanitizeAyahText(parsed.ayahs[0].text, surahNumber, 1);
        if (parsed.ayahs[0].tajweedText) {
          parsed.ayahs[0].tajweedText = sanitizeAyahText(parsed.ayahs[0].tajweedText, surahNumber, 1);
        }
        await idbSet('surahs', idbKey, parsed);
        return parsed;
      }
    } catch {
      // invalid cache, continue to fetch
    }
  }

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,quran-tajweed,ar.muyassar`);
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بالخادم لتحميل سورة ${meta.name} (رمز الاستجابة: ${res.status}). يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة.`);
  }

  const json = await res.json();
  if (json.code !== 200 || !json.data || json.data.length < 3) {
    throw new Error(`تعذر معالجة بيانات سورة ${meta.name} من المصدر المعتمد.`);
  }

  const uthmaniData = json.data[0];
  const tajweedData = json.data[1];
  const tafsirData = json.data[2];

  if (!Array.isArray(uthmaniData.ayahs) || uthmaniData.ayahs.length !== meta.numberOfAyahs) {
    throw new Error(`عدد آيات سورة ${meta.name} المستلمة (${uthmaniData.ayahs?.length || 0}) لا يتطابق مع العدد المعتمد (${meta.numberOfAyahs}).`);
  }

  const ayahs: Ayah[] = uthmaniData.ayahs.map((a: any, idx: number) => {
    const tafsirItem = tafsirData?.ayahs?.[idx];
    const tajweedItem = tajweedData?.ayahs?.[idx];
    const rawText: string = a.text || '';
    const cleanedText = sanitizeAyahText(rawText, surahNumber, a.numberInSurah);
    const cleanedTajweed = tajweedItem?.text ? sanitizeAyahText(tajweedItem.text, surahNumber, a.numberInSurah) : undefined;

    return {
      numberInSurah: a.numberInSurah,
      overallNumber: a.number,
      text: cleanedText,
      tajweedText: cleanedTajweed,
      tafsir: tafsirItem && tafsirItem.text ? tafsirItem.text : 'التفسير الميسر المعتمد لهذه الآية الكريمة.',
      juz: a.juz,
      page: a.page,
      hizbQuarter: a.hizbQuarter
    };
  });

  const surahResult: SurahData = {
    meta,
    bismillahPre: surahNumber !== 1 && surahNumber !== 9,
    ayahs
  };

  await idbSet('surahs', idbKey, surahResult);
  safeLocalStorage.setItem(cacheKey, JSON.stringify(surahResult));

  return surahResult;
}

/**
 * Fetches a genuine Medina Mushaf page (1..604) with Uthmani text, Tajweed, and Tafsir Muyassar.
 */
export async function getMushafPageData(pageNumber: number): Promise<MushafPageData> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    throw new Error('رقم الصفحة يجب أن يكون بين 1 و 604');
  }

  const cacheKey = `page_${pageNumber}`;
  const cached = await idbGet<MushafPageData>('pages', cacheKey);
  if (cached && Array.isArray(cached.ayahs) && cached.ayahs.length > 0) {
    return cached;
  }

  const [uthmaniRes, tajweedRes, tafsirRes] = await Promise.all([
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`),
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-tajweed`),
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/ar.muyassar`),
  ]);

  if (!uthmaniRes.ok) {
    throw new Error(`تعذر تحميل صفحة المصحف رقم ${pageNumber}`);
  }

  const [uthmaniJson, tajweedJson, tafsirJson] = await Promise.all([
    uthmaniRes.json(),
    tajweedRes.ok ? tajweedRes.json() : Promise.resolve(null),
    tafsirRes.ok ? tafsirRes.json() : Promise.resolve(null),
  ]);

  const rawAyahs = uthmaniJson?.data?.ayahs;
  if (!Array.isArray(rawAyahs) || rawAyahs.length === 0) {
    throw new Error(`لم يتم العثور على آيات في الصفحة ${pageNumber}`);
  }

  const tajweedAyahs = tajweedJson?.data?.ayahs || [];
  const tafsirAyahs = tafsirJson?.data?.ayahs || [];

  const ayahs: MushafPageAyah[] = rawAyahs.map((a: any, idx: number) => {
    const sNum: number = a.surah?.number || 1;
    const localMeta = SURAHS_LIST.find((s) => s.number === sNum);
    const sName = localMeta?.name || (a.surah?.name || '').replace(/^سُورَةُ\s+/, '');
    const cleanedText = sanitizeAyahText(a.text || '', sNum, a.numberInSurah);
    const cleanedTajweed = tajweedAyahs[idx]?.text
      ? sanitizeAyahText(tajweedAyahs[idx].text, sNum, a.numberInSurah)
      : undefined;

    return {
      numberInSurah: a.numberInSurah,
      overallNumber: a.number,
      text: cleanedText,
      tajweedText: cleanedTajweed,
      tafsir: tafsirAyahs[idx]?.text || 'التفسير الميسر المعتمد لهذه الآية الكريمة.',
      juz: a.juz,
      page: a.page,
      hizbQuarter: a.hizbQuarter,
      surahNumber: sNum,
      surahName: sName,
      revelationTypeAr: localMeta?.revelationTypeAr || 'مكية',
      bismillahPre: sNum !== 1 && sNum !== 9,
    };
  });

  const pageData: MushafPageData = { pageNumber, ayahs };
  await idbSet('pages', cacheKey, pageData);
  return pageData;
}

/**
 * Loads & caches a full Surah's Tafsir for a chosen edition, then returns the ayah text.
 */
export async function getAyahTafsirByEdition(
  surahNumber: number,
  ayahNumber: number,
  editionId: string
): Promise<string> {
  const validEdition = TAFSIR_EDITIONS.find((e) => e.id === editionId) ? editionId : 'ar.muyassar';
  const cacheKey = `${validEdition}:${surahNumber}`;

  const cachedMap = await idbGet<Record<number, string>>('tafsirs', cacheKey);
  if (cachedMap && cachedMap[ayahNumber]) {
    return cachedMap[ayahNumber];
  }

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${validEdition}`);
  if (!res.ok) {
    throw new Error('تعذر جلب التفسير المختار، يرجى التحقق من اتصال الإنترنت.');
  }

  const json = await res.json();
  const list = json?.data?.ayahs;
  if (!Array.isArray(list)) {
    throw new Error('استجابة التفسير غير صالحة.');
  }

  const map: Record<number, string> = {};
  for (const item of list) {
    if (typeof item.numberInSurah === 'number' && typeof item.text === 'string') {
      map[item.numberInSurah] = item.text;
    }
  }

  await idbSet('tafsirs', cacheKey, map);
  return map[ayahNumber] || 'لا يتوفر نص لهذا التفسير في هذه الآية.';
}

/**
 * Full-Quran search across cached IndexedDB surahs + live API search when online.
 */
export async function searchQuranAyahs(query: string): Promise<QuranSearchMatch[]> {
  const normalized = normalizeArabicText(query);
  if (normalized.length < 2) return [];

  const results: QuranSearchMatch[] = [];
  const seen = new Set<string>();

  const pushMatch = (m: QuranSearchMatch) => {
    const key = `${m.surahNumber}:${m.ayahNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(m);
    }
  };

  // 1. Search local preloaded & IndexedDB cached surahs immediately (works offline!)
  const cachedSurahs = await idbGetAllValues<SurahData>('surahs');
  const localPool: SurahData[] = [...Object.values(PRELOADED_SURAHS), ...cachedSurahs];

  for (const surah of localPool) {
    for (const ayah of surah.ayahs) {
      if (normalizeArabicText(ayah.text).includes(normalized)) {
        pushMatch({
          surahNumber: surah.meta.number,
          surahName: surah.meta.name,
          ayahNumber: ayah.numberInSurah,
          text: ayah.text,
          overallNumber: ayah.overallNumber,
        });
        if (results.length >= 60) break;
      }
    }
    if (results.length >= 60) break;
  }

  // 2. Query remote search index across all 114 surahs when online
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.alquran.cloud/v1/search/${encodeURIComponent(normalized)}/all/quran-simple-clean`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const matches = json?.data?.matches;
      if (Array.isArray(matches)) {
        for (const m of matches.slice(0, 60)) {
          const sNum: number = m.surah?.number;
          if (!sNum) continue;
          const localMeta = SURAHS_LIST.find((s) => s.number === sNum);
          pushMatch({
            surahNumber: sNum,
            surahName: localMeta?.name || m.surah?.name || `سورة ${sNum}`,
            ayahNumber: m.numberInSurah,
            text: (m.text || '').replace(/^\uFEFF/, ''),
            overallNumber: m.number,
          });
        }
      }
    }
  } catch {
    // Offline or network timeout -> local matches still returned cleanly
  }

  return results;
}

/**
 * Fetches real per-word audio segment timestamps from Quran.com v4 API and caches them.
 * Returns map of ayahNumber -> WordSegment[] or empty object on failure.
 */
export async function getSurahAudioSegments(
  recitationId: number | undefined,
  surahNumber: number
): Promise<Record<number, WordSegment[]>> {
  if (!recitationId) return {};

  const cacheKey = `seg_${recitationId}_${surahNumber}`;
  const cached = await idbGet<Record<number, WordSegment[]>>('segments', cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.quran.com/api/v4/recitations/${recitationId}/by_chapter/${surahNumber}?fields=segments`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return {};

    const json = await res.json();
    const files = json?.audio_files;
    if (!Array.isArray(files)) return {};

    const result: Record<number, WordSegment[]> = {};
    for (const f of files) {
      if (typeof f.verse_key === 'string' && Array.isArray(f.segments)) {
        const [, ayahStr] = f.verse_key.split(':');
        const ayahNum = parseInt(ayahStr, 10);
        if (Number.isInteger(ayahNum) && ayahNum >= 1) {
          result[ayahNum] = f.segments.filter(
            (seg: unknown): seg is WordSegment =>
              Array.isArray(seg) && seg.length >= 4 && typeof seg[2] === 'number' && typeof seg[3] === 'number'
          );
        }
      }
    }

    if (Object.keys(result).length > 0) {
      await idbSet('segments', cacheKey, result);
    }
    return result;
  } catch {
    return {};
  }
}

export async function getOfflineCachedSurahsCount(): Promise<number> {
  const count = await idbCount('surahs');
  return Math.max(count, Object.keys(PRELOADED_SURAHS).length);
}

/**
 * Downloads all 114 surahs into IndexedDB for full offline reading and search.
 */
export async function downloadFullQuranOffline(
  onProgress?: (stats: { completed: number; total: number; failed: number }) => void
): Promise<{ completed: number; total: number; failed: number }> {
  const total = SURAHS_LIST.length;
  let completed = 0;
  let failed = 0;
  const concurrency = 3;

  for (let i = 0; i < total; i += concurrency) {
    const batch = SURAHS_LIST.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (s) => {
        try {
          await getSurahData(s.number);
          completed++;
        } catch {
          failed++;
        }
        onProgress?.({ completed, total, failed });
      })
    );
  }

  return { completed, total, failed };
}
