import { TajweedRuleType } from '../utils/tajweedParser';

export type TajweedChapterId = 'noon-meem' | 'madd' | 'articulation';
export type QuizCategoryId = TajweedChapterId | 'makharij';

export interface TajweedChapter {
  id: TajweedChapterId;
  title: string;
  subtitle: string;
}

export interface TajweedExample {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  uthmani: string;
  tajweedText: string;
  focusNote: string;
}

export interface TajweedRule {
  id: string;
  name: string;
  nameEn: string;
  colorHex: string;
  cssClass: string;
  category:
    | 'ghunnah'
    | 'izhar'
    | 'ikhfa'
    | 'idgham'
    | 'qalqalah'
    | 'madd'
    | 'tafkheem'
    | 'silent';
  chapter: TajweedChapterId;
  level: 'أساسي' | 'متوسط' | 'متقدم';
  ruleTypes: TajweedRuleType[];
  definition: string;
  letters: string[];
  mizan: string;
  exampleQuran: string;
  exampleExplanation: string;
  benefit: string;
  examples: TajweedExample[];
  beats: {
    options: number[];
    unit: string;
    note: string;
  };
  commonMistake: {
    mistake: string;
    correction: string;
  };
}

export const TAJWEED_CHAPTERS: TajweedChapter[] = [
  {
    id: 'noon-meem',
    title: 'أحكام النون والميم والغنة',
    subtitle: 'الإظهار، الإدغام، الإقلاب، الإخفاء، والغنة المشددة',
  },
  {
    id: 'madd',
    title: 'أحكام المدود ومقاديرها',
    subtitle: 'الطبيعي والبدل، المتصل والمنفصل، اللازم، والعارض للسكون',
  },
  {
    id: 'articulation',
    title: 'القلقلة والتفخيم والصامت',
    subtitle: 'قطب جد، خص ضغط قظ، والحروف الساقطة في درج الكلام',
  },
];

export const TAJWEED_RULES: TajweedRule[] = [
  {
    id: 'ghunnah',
    name: 'الغُنّة المشددة',
    nameEn: 'Ghunnah (Nasalization)',
    colorHex: '#10b981',
    cssClass: 'tajweed-ghunnah',
    category: 'ghunnah',
    chapter: 'noon-meem',
    level: 'أساسي',
    ruleTypes: ['ghunnah'],
    definition: 'صوت رخيم لذيذ يخرج من الخيشوم ملازم للنون والميم المشددتين بمقدار حركتين وصلاً ووقفاً.',
    letters: ['نّ', 'مّ'],
    mizan: 'حركتان (كالقبض والبسط)',
    exampleQuran: 'عَمَّ يَتَسَآءَلُونَ / قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
    exampleExplanation: 'إبقاء صوت الغنة في الخيشوم بمقدار حركتين دون بتر أو تمطيط مبالغ فيه.',
    benefit: 'إعطاء النون والميم المشددتين كمال حقهما الصوتي وجمال الترتيل.',
    examples: [
      {
        surahNumber: 78,
        surahName: 'النبأ',
        ayahNumber: 1,
        uthmani: 'عَمَّ يَتَسَآءَلُونَ',
        tajweedText: 'عَ[g[مّ]َ يَتَسَ[o[آ]]ءَل[p[ُو]]نَ',
        focusNote: 'الميم المشددة في ﴿عَمَّ﴾ تغن بمقدار حركتين من الخيشوم.',
      },
      {
        surahNumber: 114,
        surahName: 'الناس',
        ayahNumber: 1,
        uthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        tajweedText: 'قُلْ أَعُوذُ بِرَبِّ [h[ٱ]][l[ل]][g[نّ]][p[ا]]سِ',
        focusNote: 'النون المشددة في ﴿ٱلنَّاسِ﴾ تغن حركتين بعد إدغام اللام الشمسية.',
      },
    ],
    beats: {
      options: [2],
      unit: 'حركتان',
      note: 'تُقاس بمقدار قبض الإصبع أو بسطه بسرعة متوسطة منضبطة.',
    },
    commonMistake: {
      mistake: 'خطف النون والميم المشددتين كحرف واحد عادي دون إشباع الغنة، أو تحريك الفك عند الغنة.',
      correction: 'الاعتماد على الخيشوم مع ثبات الشفتين في الميم وطرف اللسان في النون طوال زمن الحركتين.',
    },
  },
  {
    id: 'izhar',
    name: 'الإظهار الحلقي والشفوي',
    nameEn: 'Izhar (Clear Pronunciation)',
    colorHex: '#e2e8f0',
    cssClass: 'text-slate-100',
    category: 'izhar',
    chapter: 'noon-meem',
    level: 'أساسي',
    ruleTypes: [],
    definition: 'إخراج النون الساكنة أو التنوين (عند حروف الحلق) والميم الساكنة (عند باقي الحروف عدا الباء والميم) من مخرجها بوضوح تام دون غنة زائدة أو سكت.',
    letters: ['ء', 'هـ', 'ع', 'ح', 'غ', 'خ (للحلق)'],
    mizan: 'نطق واضح بلا غنة زائدة (بلا تلوين خاص)',
    exampleQuran: 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ / أَنْعَمْتَ عَلَيْهِمْ غَيْرِ',
    exampleExplanation: 'تُنطق النون الساكنة والميم الساكنة بصوت صافٍ واضح يظهر في المصحف باللون الأساسي دون تلوين.',
    benefit: 'تحقيق وضوح المخارج ومنع تداخل الحروف المتباعدة.',
    examples: [
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 2,
        uthmani: 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ',
        tajweedText: 'فَصَلِّ لِرَبِّكَ وَ[h[ٱ]]نْحَرْ',
        focusNote: 'النون الساكنة في ﴿وَٱنْحَرْ﴾ تلاقي حرف الحاء فتُظهر بوضوح تام دون غنة زائدة.',
      },
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 7,
        uthmani: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        tajweedText: 'صِر[n[َٲ]]طَ [h[ٱ]]لَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ [h[ٱ]]لْمَغْضُوبِ عَلَيْهِمْ وَلَا [h[ٱ]][l[ل]]ضّ[m[َا]]ٓلّ[p[ِي]]نَ',
        focusNote: 'إظهار حلقي في ﴿أَنْعَمْتَ﴾ (نْ + ع)، وإظهار شفوي في ﴿عَلَيْهِمْ غَيْرِ﴾ و﴿عَلَيْهِمْ وَلَا﴾.',
      },
    ],
    beats: {
      options: [],
      unit: 'زمن الحرف الساكن الطبيعي',
      note: 'لا يُزاد فيه زمن الغنة ولا يُقطع الصوت بسكتة، بل يُنطق بسلاسة ووضوح.',
    },
    commonMistake: {
      mistake: 'قلقلة النون الساكنة أو السكت عليها، أو إخفاء الميم الساكنة عند الواو والفاء لقرب المخرج.',
      correction: 'اقرع طرف اللسان في اللثة بلطف في النون، وأطبق الشفتين بوضوح في الميم خصوصاً عند الواو والفاء.',
    },
  },
  {
    id: 'ikhfa',
    name: 'الإخفاء الحقيقي والشفوي',
    nameEn: 'Ikhfa (Concealment)',
    colorHex: '#4ade80',
    cssClass: 'tajweed-ikhfa',
    category: 'ikhfa',
    chapter: 'noon-meem',
    level: 'أساسي',
    ruleTypes: ['ikhfa'],
    definition: 'النطق بالحرف بصفة متوسطة بين الإظهار والإدغام عارٍ عن التشديد مع بقاء غنة بمقدار حركتين وتفخيمها أو ترقيقها تبعاً للحرف التالي.',
    letters: ['ص', 'ذ', 'ث', 'ك', 'ج', 'ش', 'ق', 'س', 'د', 'ط', 'ز', 'ف', 'ت', 'ض', 'ظ', 'ب (شفوي)'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ / تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
    exampleExplanation: 'مراعاة تهيئة الفم لمخرج الحرف التالي أثناء الغنة؛ فتُرقق الغنة عند الفاء والسين وتُفخم عند القاف والصاد.',
    benefit: 'سلاسة الانتقال الصوتي وتزيين التلاوة بالرنين الخيشومي المتوازن.',
    examples: [
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 3,
        uthmani: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
        tajweedText: 'ٱلَّذِينَ يُؤْمِنُونَ بِ[h:13[ٱ]]لْغَيْبِ وَيُقِيمُونَ [h:14[ٱ]][l[ل]]صَّلَ[s[و]][n[ٲ]]ةَ وَمِ[g[مّ]]َا رَزَ[q:15[قْ]]نَ[n[ـٰ]]هُمْ يُ[f:16[نف]]ِق[p[ُو]]نَ',
        focusNote: 'في ﴿يُنفِقُونَ﴾ تُخفى النون الساكنة عند الفاء بغنة مرققة بمقدار حركتين.',
      },
      {
        surahNumber: 105,
        surahName: 'الفيل',
        ayahNumber: 4,
        uthmani: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
        tajweedText: 'تَرْمِيهِ[c[م]] بِحِجَارَ[a[ةٍ مّ]]ِ[f[ن]] سِجّ[p[ِي]]لٍ',
        focusNote: 'تجمع الآية بين الإخفاء الشفوي ﴿تَرْمِيهِم بِحِجَارَةٍ﴾ والإخفاء الحقيقي ﴿مِّن سِجِّيلٍ﴾.',
      },
    ],
    beats: {
      options: [2],
      unit: 'حركتان',
      note: 'زمن الغنة المخفاة يساوي حركتين مع تجافي طرف اللسان عن مخرج النون.',
    },
    commonMistake: {
      mistake: 'إلصاق طرف اللسان بسقف الحنك عند إخفاء النون فيتحول الصوت إلى إظهار، أو تفخيم الغنة قبل الحروف المرققة.',
      correction: 'أبقِ اللسان معلقاً قريباً من مخرج الحرف التالي دون التصاق، وفخّم الغنة فقط إذا تلاها حرف استعلاء.',
    },
  },
  {
    id: 'idgham',
    name: 'الإدغام بغنة والإدغام الشفوي',
    nameEn: 'Idgham with Ghunnah',
    colorHex: '#2dd4bf',
    cssClass: 'tajweed-idgham',
    category: 'idgham',
    chapter: 'noon-meem',
    level: 'أساسي',
    ruleTypes: ['idgham'],
    definition: 'إدخال النون الساكنة أو التنوين في حروف (ينمو)، أو الميم الساكنة في مثلها بحيث يصيران حرفاً واحداً مشدداً مع بقاء غنة حركتين.',
    letters: ['ي', 'ن', 'م', 'و (ينمو)'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'هُدًى مِّن رَّبِّهِمْ / إِنَّهَا عَلَيْهِم مُّؤْصَدَةٌ',
    exampleExplanation: 'تندمج النون أو التنوين في الحرف التالي مع ظهور الغنة من الخيشوم في كلمة واحدة صوتياً.',
    benefit: 'تخفيف النطق وتحقيق الانسجام الصوتي الفصيح بين الكلمات.',
    examples: [
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 5,
        uthmani: 'أُو۟لَٰٓئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ وَأُو۟لَٰٓئِكَ هُمُ ٱلْمُفْلِحُونَ',
        tajweedText: 'أُو[s[۟]]لَ[n[ـٰ]][o[ٓ]]ئِكَ عَلَ[n[ىٰ]] هُد[a[ًى مّ]]ِ[u[ن]] رَّبِّهِمْ وَأُو[s[۟]]لَ[n[ـٰ]][o[ٓ]]ئِكَ هُمُ [h[ٱ]]لْمُفْلِح[p[ُو]]نَ',
        focusNote: '﴿هُدًى مِّن﴾ إدغام كامل بغنة حركتين، بينما ﴿مِّن رَّبِّهِمْ﴾ إدغام بغير غنة (بالرمادي).',
      },
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 8,
        uthmani: 'إِنَّهَا عَلَيْهِم مُّؤْصَدَةٌ',
        tajweedText: 'إِ[g[نّ]]َهَا عَلَيْهِ[w[م مّ]]ُؤْصَدَةٌ',
        focusNote: '﴿عَلَيْهِم مُّؤْصَدَةٌ﴾ ميم ساكنة بعدها ميم متحركة ← إدغام شفوي (مثلين صغير) بغنة حركتين.',
      },
    ],
    beats: {
      options: [2],
      unit: 'حركتان',
      note: 'تمتد الغنة بمقدار حركتين قبل الانتقال الكامل لصوت الحرف المدغم فيه.',
    },
    commonMistake: {
      mistake: 'الإدغام مع الياء والواو دون إشراك الخيشوم في الغنة (وهو إدغام ناقص في حفص يجب فيه بقاء الغنة).',
      correction: 'أخرج نصف الصوت من الفم مع الياء والواو والنصف الآخر من الخيشوم بمقدار حركتين.',
    },
  },
  {
    id: 'iqlab',
    name: 'الإقلاب',
    nameEn: 'Iqlab (Conversion to Meem)',
    colorHex: '#34d399',
    cssClass: 'tajweed-iqlab',
    category: 'idgham',
    chapter: 'noon-meem',
    level: 'متوسط',
    ruleTypes: ['iqlab'],
    definition: 'قلب النون الساكنة أو التنوين ميماً خالصة مخفاة بغنة بمقدار حركتين عند ملاقاة حرف الباء في كلمة أو كلمتين.',
    letters: ['ب (مع ميم قائمة ۢ)'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'كَلَّا لَيُنۢبَذَنَّ فِى ٱلْحُطَمَةِ / إِلَّا مِنۢ بَعْدِ',
    exampleExplanation: 'تُقلب النون إلى ميم خفيفة وتوضع علامة الميم القائمة (ۢ) في المصحف الشريف تنبيهاً للقارئ.',
    benefit: 'تيسير الانتقال المخرجي بين النون اللسانية والباء الشفوية.',
    examples: [
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 4,
        uthmani: 'كَلَّا لَيُنۢبَذَنَّ فِى ٱلْحُطَمَةِ',
        tajweedText: 'كَلَّا لَيُ[i[نۢ]]بَذَ[g[نّ]]َ فِى [h[ٱ]]لْحُطَمَةِ',
        focusNote: 'إقلاب في كلمة واحدة ﴿لَيُنۢبَذَنَّ﴾ حيث التقت النون بالباء.',
      },
      {
        surahNumber: 98,
        surahName: 'البينة',
        ayahNumber: 4,
        uthmani: 'وَمَا تَفَرَّقَ ٱلَّذِينَ أُوتُوا۟ ٱلْكِتَٰبَ إِلَّا مِنۢ بَعْدِ مَا جَآءَتْهُمُ ٱلْبَيِّنَةُ',
        tajweedText: 'وَمَا تَفَرَّقَ [h[ٱ]]لَّذِينَ أُوتُو[s[ا۟]] [h[ٱ]]لْكِتَ[n[ـٰ]]بَ إِلَّا مِ[i[نۢ]] بَعْدِ مَا جَ[o[آ]]ءَتْهُمُ [h[ٱ]]لْبَيِّنَةُ',
        focusNote: 'إقلاب بين كلمتين في ﴿مِنۢ بَعْدِ﴾ مع بقاء الغنة حركتين.',
      },
    ],
    beats: {
      options: [2],
      unit: 'حركتان',
      note: 'تنطبق الشفتان برفق دون كزٍّ أو شدّ، ويخرج صوت الغنة حركتين من الخيشوم.',
    },
    commonMistake: {
      mistake: 'الضغط الشديد على الشفتين وإغلاقهما بقوة، أو فتح فرجة واضحة بين الشفتين.',
      correction: 'تلامس الشفتين بلطف وخفة تامة حتى تنساب الغنة رقيقة دون تكلّف.',
    },
  },
  {
    id: 'madd-tabeei',
    name: 'المد الطبيعي ومد البدل (الذهبي الكموني)',
    nameEn: 'Madd Tabeei & Badal (2 Counts)',
    colorHex: '#eab308',
    cssClass: 'tajweed-madd-tabeei',
    category: 'madd',
    chapter: 'madd',
    level: 'أساسي',
    ruleTypes: ['madd-tabeei', 'madd-badal'],
    definition: 'مد بمقدار حركتين لا تقوم ذات الحرف إلا به ولا يتوقف على سبب همز أو سكون (ويشمل الألف الخنجرية، ومد العوض، ومد البدل حيث يتقدم الهمز على حرف المد).',
    letters: ['ٰ (ألف خنجرية)', 'ا', 'و', 'ي', 'ءَا / إِي / أُو'],
    mizan: 'حركتان في رواية حفص',
    exampleQuran: 'وَيُقِيمُونَ ٱلصَّلَوٰةَ / وَبَشِّرِ ٱلَّذِينَ ءَامَنُوا۟',
    exampleExplanation: 'يُمد بمقدار حركتين متساويتين؛ وفي ﴿ٱلصَّلَوٰةَ﴾ الواو زائدة رسماً والألف الخنجرية هي الممدودة.',
    benefit: 'استقامة التلاوة وحفظ أوزان الكلمات القرآنية من الاختلاس أو التمطيط.',
    examples: [
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 3,
        uthmani: 'وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
        tajweedText: 'وَيُقِيمُونَ [h[ٱ]][l[ل]]صَّلَ[s[و]][n[ٲ]]ةَ وَمِ[g[مّ]]َا رَزَ[q[قْ]]نَ[n[ـٰ]]هُمْ يُ[f[نف]]ِق[p[ُو]]نَ',
        focusNote: 'الألف الخنجرية في ﴿ٱلصَّلَوٰةَ﴾ و﴿رَزَقْنَٰهُمْ﴾ تُمد حركتين تماماً.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 25,
        uthmani: 'وَبَشِّرِ ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ',
        tajweedText: 'وَبَشِّرِ [h[ٱ]]لَّذِينَ ءَ[n[ا]]مَنُو[s[ا۟]] وَعَمِلُو[s[ا۟]] [h[ٱ]][l[ل]]صَّ[n[ـٰ]]لِحَ[n[ـٰ]]تِ',
        focusNote: 'مد بدل حركتان في ﴿ءَامَنُوا۟﴾، ومد طبيعي بالألف الخنجرية في ﴿ٱلصَّٰلِحَٰتِ﴾.',
      },
    ],
    beats: {
      options: [2],
      unit: 'حركتان',
      note: 'حركتان فقط لا تُقصر إلى فتحة واحدة ولا تُزاد إلى ثلاث.',
    },
    commonMistake: {
      mistake: 'اختلاس المد الطبيعي وجعله كالفتحة السريعة عند الوصل، أو زيادته عن حركتين في أواخر الكلمات.',
      correction: 'المساواة التامة بين كل المدود الطبيعية في المصحف بمقدار حركتين منضبطتين.',
    },
  },
  {
    id: 'madd-wajib',
    name: 'المد المتصل والمنفصل (الأحمر)',
    nameEn: 'Madd Wajib & Jaiz (4-5 Counts)',
    colorHex: '#f43f5e',
    cssClass: 'tajweed-madd-wajib',
    category: 'madd',
    chapter: 'madd',
    level: 'متوسط',
    ruleTypes: ['madd-wajib'],
    definition: 'إطالة الصوت بحرف المد إذا تلاه همز في نفس الكلمة (واجب متصل)، أو في أول الكلمة التالية (جائز منفصل).',
    letters: ['ا + ء', 'و + ء', 'ي + ء'],
    mizan: '4 إلى 5 حركات (في التوسط لحفص)',
    exampleQuran: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ / إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ',
    exampleExplanation: 'يمتد الصوت بمقدار 4 أو 5 حركات متساوية؛ المتصل واجب عند جميع القراء والمنفصل يلتزم القارئ فيه بمقدار موحد.',
    benefit: 'الوقار والتمكين في مواطن النداء والوحي والتأكيد الإلهي.',
    examples: [
      {
        surahNumber: 110,
        surahName: 'النصر',
        ayahNumber: 1,
        uthmani: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
        tajweedText: 'إِذَا جَ[o[آ]]ءَ نَصْرُ [h[ٱ]للَّهِ وَ[h[ٱ]لْفَتْحُ',
        focusNote: '﴿جَآءَ﴾ مد واجب متصل لاجتماع حرف المد والهمزة في كلمة واحدة.',
      },
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 1,
        uthmani: 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ',
        tajweedText: 'إِ[g[نّ]][o[آ]] أَعْطَيْنَ[n[ـٰ]]كَ [h[ٱ]لْكَوْثَرَ',
        focusNote: '﴿إِنَّآ أَعْطَيْنَٰكَ﴾ مد جائز منفصل لأن المد في آخر الكلمة الأولى والهمزة في أول الثانية.',
      },
    ],
    beats: {
      options: [4, 5],
      unit: 'حركات',
      note: 'التزم بمقدار واحد (4 أو 5 حركات) طوال قراءتك للمساواة في المدود.',
    },
    commonMistake: {
      mistake: 'التفاوت في الزمن بين المتصل والمنفصل في نفس الجلسة، أو قصر الواجب المتصل لحركتين.',
      correction: 'ضبط زمن 4 حركات باستمرار عبر ميزان الحركات حتى يصير ملكة سمعية ثابتة.',
    },
  },
  {
    id: 'madd-lazim',
    name: 'المد اللازم (الأحمر القاني)',
    nameEn: 'Madd Lazim (6 Counts)',
    colorHex: '#ef4444',
    cssClass: 'tajweed-madd-lazim',
    category: 'madd',
    chapter: 'madd',
    level: 'متقدم',
    ruleTypes: ['madd-lazim'],
    definition: 'أن يأتي بعد حرف المد سكون أصلي لازم وصلاً ووقفاً في كلمة واحدة (كلمِيّ مثقل أو مخفف) أو في فواتح السور المقطعة (حرفيّ).',
    letters: ['ا + سكون/شدة', 'و + سكون/شدة', 'ي + سكون/شدة'],
    mizan: '6 حركات مشبعة وجوباً',
    exampleQuran: 'وَلَا ٱلضَّآلِّينَ / الٓمٓ',
    exampleExplanation: 'أطول المدود في القرآن الكريم بإجماع القراء، يُمد 6 حركات كاملة قبل النطق بالحرف المشدد.',
    benefit: 'التمكين من النطق بالساكنين وإظهار جلال الكلمات القرآنية.',
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 7,
        uthmani: 'غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        tajweedText: 'غَيْرِ [h[ٱ]]لْمَغْضُوبِ عَلَيْهِمْ وَلَا [h[ٱ]][l[ل]]ضّ[m[َا]]ٓلّ[p[ِي]]نَ',
        focusNote: '﴿ٱلضَّآلِّينَ﴾ مد لازم كلمي مثقل: ألف المد تلتقي باللام المشددة ← 6 حركات وجوباً.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 1,
        uthmani: 'الٓمٓ',
        tajweedText: 'ا[m[لٓ]][m[مٓ]]',
        focusNote: 'فواتح السور: اللام تُمد 6 حركات ثم تُدغم ميمها في الميم التالية بغنة، ثم تُمد الميم 6 حركات.',
      },
    ],
    beats: {
      options: [6],
      unit: 'حركات وجوباً',
      note: 'إشباع كامل بمقدار 6 حركات قبل تشديد الحرف التالي مباشرة.',
    },
    commonMistake: {
      mistake: 'عدم استكمال الست حركات في ﴿ٱلضَّآلِّينَ﴾ أو عدم تشديد اللام بعد المد أو نبر الصوت بتموج أثناء المد.',
      correction: 'حافظ على نبرة مستقيمة ثابتة لست حركات ثم انتقل للام المشددة بوضوح.',
    },
  },
  {
    id: 'madd-arid',
    name: 'المد العارض للسكون (البرتقالي)',
    nameEn: 'Madd Arid lis-Sukoon',
    colorHex: '#fb923c',
    cssClass: 'tajweed-madd-arid',
    category: 'madd',
    chapter: 'madd',
    level: 'أساسي',
    ruleTypes: ['madd-arid'],
    definition: 'وقوع حرف المد قبل الحرف الأخير من الكلمة عند الوقف عليه بالسكون العارض، ويُمد جوازاً بمقدار حركتين أو أربع أو ست حركات.',
    letters: ['ا', 'و', 'ي (قبل الحرف الموقوف عليه)'],
    mizan: '2 أو 4 أو 6 حركات جوازاً عند الوقف',
    exampleQuran: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ / إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    exampleExplanation: 'يثبت المد عند الوقف ويزول في الوصل فيعود مداً طبيعياً حركتين.',
    benefit: 'تناسق فواصل الآيات وإحداث إيقاع ختامي هادئ عند الوقف.',
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 2,
        uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
        tajweedText: '[h[ٱ]]لْحَمْدُ لِلَّهِ رَبِّ [h[ٱ]]لْعَ[n[ـٰ]]لَم[p[ِي]]نَ',
        focusNote: 'عند الوقف على ﴿ٱلْعَٰلَمِينَ﴾ تُسكن النون وتُمد الياء (2 أو 4 أو 6 حركات).',
      },
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 5,
        uthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        tajweedText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَع[p[ِي]]نُ',
        focusNote: 'الياء قبل النون الموقوف عليها في ﴿نَسْتَعِينُ﴾ تُمد عارضاً للسكون.',
      },
    ],
    beats: {
      options: [2, 4, 6],
      unit: 'حركات جوازاً',
      note: 'اختر التوسط (4 حركات) كأنسب ميزان، واحرص على ألا يزيد المقصور على الممدود المتصل.',
    },
    commonMistake: {
      mistake: 'الوقوف على الآيات بأزمنة عشوائية (مرة حركتان ومرة ست) أو غنّ الياء والواو من الخيشوم.',
      correction: 'أخرج المد العارض من الجوف خالصاً دون خيشوم، واثبت على عدد حركات متناسق طوال التلاوة.',
    },
  },
  {
    id: 'qalqalah',
    name: 'القلقلة (صغرى وكبرى)',
    nameEn: 'Qalqalah (Echoing)',
    colorHex: '#38bdf8',
    cssClass: 'tajweed-qalqalah',
    category: 'qalqalah',
    chapter: 'articulation',
    level: 'أساسي',
    ruleTypes: ['qalqalah'],
    definition: 'اضطراب الصوت في مخرج الحرف الساكن من حروف (قطب جد) حتى يُسمع له نبرة ارتداد واضحة دون أن يشوبه فتح أو كسر أو ضم.',
    letters: ['ق', 'ط', 'ب', 'ج', 'د (قطب جد)'],
    mizan: 'نبرة ارتداد لحظية (صغرى في الوسط، كبرى عند الوقف)',
    exampleQuran: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ / إِنَّ بَطْشَ رَبِّكَ لَشَدِيدٌ',
    exampleExplanation: 'تكون صغرى وسط الكلمة أو الوصل، وكبرى واضحة عند الوقف على آخر الكلمة، وأشدها على المشدد الموقوف عليه.',
    benefit: 'تحرير الحروف الشديدة المجهورة من الانحباس التام وبيان صوتها.',
    examples: [
      {
        surahNumber: 113,
        surahName: 'الفلق',
        ayahNumber: 1,
        uthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        tajweedText: 'قُلْ أَعُوذُ بِرَبِّ [h:14678[ٱ]]لْفَلَ[q[ق]]ِ',
        focusNote: 'القاف في ﴿ٱلْفَلَقِ﴾ عند الوقف عليها تأخذ قلقلة كبرى ظاهرة.',
      },
      {
        surahNumber: 85,
        surahName: 'البروج',
        ayahNumber: 12,
        uthmani: 'إِنَّ بَطْشَ رَبِّكَ لَشَدِيدٌ',
        tajweedText: 'إِ[g[نّ]]َ بَ[q[طْ]]شَ رَبِّكَ لَشَدِ[p[ي]][q[دٌ]]',
        focusNote: 'تجمع الآية بين القلقلة الصغرى ﴿بَطْشَ﴾ والقلقلة الكبرى عند الوقف على ﴿لَشَدِيدٌ﴾.',
      },
    ],
    beats: {
      options: [],
      unit: 'اهتزازة صوتية لحظية',
      note: 'ارتداد سريع ينفك فيه عضوا النطق دون حركة تميل إلى الفتحة أو الكسرة.',
    },
    commonMistake: {
      mistake: 'تمويل القلقلة نحو الفتح (مثل: أحدَ) أو قطعها بهمز في النهاية، أو قلقلة الحرف المتحرك.',
      correction: 'التصادم ثم التباعد الصافي في المخرج حال السكون فقط دون فتح الفكين.',
    },
  },
  {
    id: 'tafkheem',
    name: 'التفخيم والاستعلاء (الأزرق الملكي)',
    nameEn: 'Tafkheem (Emphatic Letters)',
    colorHex: '#60a5fa',
    cssClass: 'tajweed-tafkheem',
    category: 'tafkheem',
    chapter: 'articulation',
    level: 'متوسط',
    ruleTypes: ['tafkheem'],
    definition: 'تسمين يدخل على صوت الحرف فيمتلئ الفم بصداه في حروف الاستعلاء السبعة (خص ضغط قظ)، وكذلك الراء ولام لفظ الجلالة في أحوال التفخيم.',
    letters: ['خ', 'ص', 'ض', 'غ', 'ط', 'ق', 'ظ (خص ضغط قظ)'],
    mizan: '5 مراتب حسب الحركة (أعلاها المفتوح بعده ألف)',
    exampleQuran: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ / قُلْ هُوَ ٱللَّهُ أَحَدٌ',
    exampleExplanation: 'يرتفع أقصى اللسان إلى الحنك الأعلى فيتردد الصدى في قبة الفم دون مبالغة في ضم الشفتين.',
    benefit: 'تفريق الحروف المفخمة عن المرققة المجاورة لها ومنح التلاوة فخامتها العربية.',
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 6,
        uthmani: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        tajweedText: 'ٱهْدِنَا [h[ٱ]][l[ل]][k[صّ]]ِ[k[ر]][n[َٲ]][k[ط]]َ [h[ٱ]]لْمُسْتَ[k[ق]][p[ِي]]مَ',
        focusNote: 'تأمل تفخيم الصاد والراء المفتوحة والطاء في ﴿ٱلصِّرَٰطَ﴾ مقابل ترقيق السين والتاء في ﴿ٱلْمُسْتَقِيمَ﴾.',
      },
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 1,
        uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: '[k[ق]]ُلْ هُوَ [h[ٱ]][k[لّ]]َهِ أَحَ[q[د]]ٌ'.replace('َهِ', 'َهُ'),
        focusNote: 'القاف المضمومة في ﴿قُلْ﴾ ولام لفظ الجلالة بعد الضم في ﴿ٱللَّهُ﴾ كلاهما مفخم.',
      },
    ],
    beats: {
      options: [],
      unit: 'تقعّر اللسان وتصعيد الصدى',
      note: 'يتصعد الصوت لقبة الحنك الأعلى بترفع أقصى اللسان وليس بتكوير الشفتين للأمام.',
    },
    commonMistake: {
      mistake: 'ضم الشفتين عند نطق الصاد والطاء المفتوحة، أو سحب التفخيم إلى الحرف المرقق المجاور (مثل تفخيم التاء في ٱلْمُسْتَقِيمَ).',
      correction: 'أبقِ الشفتين في وضع طبيعي مع الفتحة وخلص الحرف المرقق فوراً قبل المفخم وبعده.',
    },
  },
  {
    id: 'silent',
    name: 'حروف لا تُلفظ وإدغام بلا غنة (الرمادي)',
    nameEn: 'Silent & Completely Assimilated Letters',
    colorHex: '#94a3b8',
    cssClass: 'tajweed-silent',
    category: 'silent',
    chapter: 'articulation',
    level: 'أساسي',
    ruleTypes: ['silent'],
    definition: 'حروف ثابتة في الرسم العثماني لكنها تسقط في النطق: كهمزة الوصل في درج الكلام، واللام الشمسية، والألف الفارقة (ا۟)، والنون المدغمة إدغاماً كاملاً بغير غنة في اللام والراء.',
    letters: ['ٱ (همزة الوصل)', 'ل (اللام الشمسية)', 'ا۟ / و۟ (سكون مستدير)', 'نْ ← ل / ر'],
    mizan: 'تسقط في اللفظ (تُتجاوز عند الوصل)',
    exampleQuran: 'وَٱلشَّمْسِ وَضُحَىٰهَا / وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
    exampleExplanation: 'تُلوّن بالرمادي في المصحف لتنبيه العين إلى عدم النطق بها في الوصل.',
    benefit: 'حفظ اللسان من اللحن الجلي عند قراءة الرسم العثماني المتقن.',
    examples: [
      {
        surahNumber: 91,
        surahName: 'الشمس',
        ayahNumber: 1,
        uthmani: 'وَٱلشَّمْسِ وَضُحَىٰهَا',
        tajweedText: 'وَ[h[ٱ]][l[ل]]شَّمْسِ وَضُحَ[n[ـٰ]]هَا',
        focusNote: 'تُسقط همزة الوصل واللام الشمسية فتنتقل من الواو إلى الشين المشددة مباشرة (وَشَّمْسِ).',
      },
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 4,
        uthmani: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        tajweedText: 'وَلَمْ يَك[u:2596[ُن ل]]َّهُ[n[ۥ]] كُفُوًا أَحَ[q[د]]ُۢ',
        focusNote: 'تدغم النون الساكنة في اللام إدغاماً كاملاً بلا غنة ﴿يَكُن لَّهُۥ﴾ فتسقط النون بالكلية.',
      },
    ],
    beats: {
      options: [],
      unit: 'تجاوز لحظي في النطق',
      note: 'مرور مباشر من الحرف السابق للحرف المشدد أو المتحرك التالي.',
    },
    commonMistake: {
      mistake: 'نطق همزة الوصل في وسط الكلام، أو نطق الألف الفارقة أو الواو ذات السكون المستدير في ﴿أُو۟لَٰٓئِكَ﴾.',
      correction: 'انتبه للون الرمادي في المصحف وتجاوز الحرف المرسوم تماماً أثناء وصل القراءة.',
    },
  },
];

/* ============================================================================
 * PHASE 2 DATA: MAKHARIJ AL-HURUF & LETTER QUALITIES (أطلس المخارج والصفات)
 * ========================================================================== */

export type MakhrajRegionId = 'jawf' | 'halq' | 'lisan' | 'shafatan' | 'khayshum';

export interface MakhrajRegionInfo {
  id: MakhrajRegionId;
  name: string;
  subtitle: string;
  description: string;
  colorHex: string;
  svgHighlightArea: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    labelX: number;
    labelY: number;
  };
}

export interface ArabicLetterMakhraj {
  id: string;
  letter: string;
  name: string;
  region: MakhrajRegionId;
  subMakhraj: string;
  qualities: string[];
  practicalTip: string;
  exampleWord: string;
  point: { x: number; y: number };
}

export interface SimilarLetterPair {
  id: string;
  title: string;
  letterIds: string[];
  differenceSummary: string;
  quranExample: string;
}

export const MAKHARIJ_REGIONS: MakhrajRegionInfo[] = [
  {
    id: 'jawf',
    name: 'الجوف',
    subtitle: 'الخلاء الممتد في الحلق والفم',
    description: 'مخرج مقدّر لحروف المد الثلاثة (ا، و، ي الساكنات المجانس ما قبلها لحركتها)، يمتد فيها الصوت ولا ينقطع في موضع محدد.',
    colorHex: '#f59e0b',
    svgHighlightArea: { cx: 180, cy: 185, rx: 45, ry: 34, labelX: 180, labelY: 188 },
  },
  {
    id: 'halq',
    name: 'الحلق',
    subtitle: 'أقصى ووسط وأدنى الحلق',
    description: 'مخرج محقق ينقسم إلى ثلاثة مواضع (أقصى: ء هـ، وسط: ع ح، أدنى: غ خ)، وتخرج منه حروف الإظهار الحلقي الستة.',
    colorHex: '#0ea5e9',
    svgHighlightArea: { cx: 215, cy: 262, rx: 28, ry: 44, labelX: 266, labelY: 262 },
  },
  {
    id: 'lisan',
    name: 'اللسان',
    subtitle: 'أقصى، وسط، حافة، وطرف اللسان',
    description: 'أوسع المخارج ويضم 10 مخارج فرعية لثمانية عشر حرفاً؛ تختلف فيها أوضاع التقعر والالتصاق والانحراف والصفير.',
    colorHex: '#10b981',
    svgHighlightArea: { cx: 145, cy: 192, rx: 52, ry: 22, labelX: 145, labelY: 228 },
  },
  {
    id: 'shafatan',
    name: 'الشفتان',
    subtitle: 'بطن الشفة السفلى والشفتان معاً',
    description: 'مخرج أحرف (ف، ب، م، و غير المدية)، وتتفاوت بين انطباق كامل في الباء والميم واستدارة في الواو وملاصقة الثنايا في الفاء.',
    colorHex: '#f43f5e',
    svgHighlightArea: { cx: 68, cy: 186, rx: 18, ry: 22, labelX: 34, labelY: 186 },
  },
  {
    id: 'khayshum',
    name: 'الخيشوم',
    subtitle: 'أعلى الأنف المتصل بالبلعوم',
    description: 'مخرج الغنة الملازمة للنون والميم في أحوال الغنة المشددة والإدغام والإقلاب والإخفاء؛ وهو مخرج هوائي صوتي رنان.',
    colorHex: '#14b8a6',
    svgHighlightArea: { cx: 138, cy: 112, rx: 46, ry: 22, labelX: 138, labelY: 112 },
  },
];

export const ARABIC_LETTERS_MAKHARIJ: ArabicLetterMakhraj[] = [
  { id: 'madd-alef', letter: 'ا / و / ي', name: 'حروف المد الثلاثة', region: 'jawf', subMakhraj: 'الجوف (الفم والحلق معاً)', qualities: ['مخرج مقدّر', 'جهر', 'رخاوة', 'تمد حركتين فأكثر'], practicalTip: 'افتح الجوف في الألف، وضم الشفتين دون تكلف في الواو، واخفض الفك السفلي في الياء دون غنة أنف.', exampleWord: 'نُوحِيهَا', point: { x: 180, y: 186 } },
  { id: 'hamza', letter: 'أ / ء', name: 'الهمزة', region: 'halq', subMakhraj: 'أقصى الحلق (الأوتار الصوتية)', qualities: ['جهر', 'شدة', 'استفال', 'انفتاح'], practicalTip: 'تنطق بانطباق الوترين الصوتيين وانفتاحهما بلطف دون نبرة حادة أو تسهيل مفرط.', exampleWord: 'أَنعَمْتَ', point: { x: 215, y: 292 } },
  { id: 'ha', letter: 'هـ', name: 'الهاء', region: 'halq', subMakhraj: 'أقصى الحلق', qualities: ['همس', 'رخاوة', 'استفال', 'انفتاح'], practicalTip: 'أخرج نفساً هادئاً واضحاً من أقصى الحلق خاصة إذا سكنت أو تطرفت مثل ﴿ٱهْدِنَا﴾.', exampleWord: 'ٱهْدِنَا', point: { x: 215, y: 282 } },
  { id: 'ayn', letter: 'ع', name: 'العين', region: 'halq', subMakhraj: 'وسط الحلق (لسان المزمار)', qualities: ['جهر', 'توسط (بينية)', 'استفال', 'انفتاح'], practicalTip: 'تجنب تشديد العين حتى لا تنقطع ولا ترخيها كالحاء؛ حافظ على وسطيتها العذبة.', exampleWord: 'نَعْبُدُ', point: { x: 215, y: 256 } },
  { id: 'hha', letter: 'ح', name: 'الحاء', region: 'halq', subMakhraj: 'وسط الحلق', qualities: ['همس', 'رخاوة', 'استفال', 'انفتاح'], practicalTip: 'صفّ هواء الحاء من وسط الحلق بنقاء حتى لا تختلط بالهاء أو الخاء.', exampleWord: 'ٱلرَّحْمَٰنِ', point: { x: 215, y: 248 } },
  { id: 'ghayn', letter: 'غ', name: 'الغين', region: 'halq', subMakhraj: 'أدنى الحلق', qualities: ['جهر', 'رخاوة', 'استعلاء (تفخيم)', 'انفتاح'], practicalTip: 'فخّم الغين من أدنى الحلق دون اهتزاز مبالغ فيه ودون خلطها بالخاء.', exampleWord: 'غَيْرِ', point: { x: 205, y: 218 } },
  { id: 'kha', letter: 'خ', name: 'الخاء', region: 'halq', subMakhraj: 'أدنى الحلق', qualities: ['همس', 'رخاوة', 'استعلاء (تفخيم)', 'انفتاح'], practicalTip: 'أدنى الحلق من جهة الفم مع تصعد الصوت للأعلى وتفخيم لطيف غير مخدش.', exampleWord: 'خَٰلِدِينَ', point: { x: 202, y: 210 } },
  { id: 'qaf', letter: 'ق', name: 'القاف', region: 'lisan', subMakhraj: 'أقصى اللسان مع الحنك اللحمي', qualities: ['جهر', 'شدة', 'استعلاء', 'قلقلة عند السكون'], practicalTip: 'ألصق أقصى اللسان بالمنطقة الرخوة من سقف الفم لتفخيمه، وأظهر قلقلته عند السكون.', exampleWord: 'ٱلْفَلَقِ', point: { x: 185, y: 188 } },
  { id: 'kaf', letter: 'ك', name: 'الكاف', region: 'lisan', subMakhraj: 'أقصى اللسان أسفل مخرج القاف', qualities: ['همس (عند السكون)', 'شدة', 'استفال', 'انفتاح'], practicalTip: 'انحباس الصوت أولاً ثم همس خفيف عند الانفكاك في الساكن، ولا تفخمها كالقاف.', exampleWord: 'إِيَّاكَ', point: { x: 172, y: 182 } },
  { id: 'jim', letter: 'ج', name: 'الجيم', region: 'lisan', subMakhraj: 'وسط اللسان مع الحنك الأعلى', qualities: ['جهر', 'شدة', 'استفال', 'قلقلة عند السكون'], practicalTip: 'يغلق وسط اللسان مخرجه تماماً دون هواء أو تفشٍّ كالشين.', exampleWord: 'جَآءَ', point: { x: 152, y: 176 } },
  { id: 'shin', letter: 'ش', name: 'الشين', region: 'lisan', subMakhraj: 'وسط اللسان مع الحنك الأعلى', qualities: ['همس', 'رخاوة', 'تفشٍّ', 'استفال'], practicalTip: 'انتشار الهواء في الفم بصفة التفشي خصوصاً عند تشديدها أو سكونها.', exampleWord: 'شَرِّ', point: { x: 146, y: 175 } },
  { id: 'ya', letter: 'ي', name: 'الياء غير المدية', region: 'lisan', subMakhraj: 'وسط اللسان', qualities: ['جهر', 'رخاوة', 'استفال', 'لين عند السكون بعد فتح'], practicalTip: 'المتحركة أو اللينة تخرج من وسط اللسان بارتفاعه نحو الحنك بخلاف الياء المدية الجوفية.', exampleWord: 'بَيْتِ', point: { x: 140, y: 175 } },
  { id: 'dad', letter: 'ض', name: 'الضاد', region: 'lisan', subMakhraj: 'إحدى حافتي اللسان مع الأضراس العليا', qualities: ['جهر', 'رخاوة', 'استعلاء', 'إطباق', 'استطالة'], practicalTip: 'يمتد الصوت بطول حافة اللسان حتى أصول الثنايا بصفة الاستطالة دون تحريكه للذال أو الظاء.', exampleWord: 'ٱلضَّآلِّينَ', point: { x: 132, y: 180 } },
  { id: 'lam', letter: 'ل', name: 'اللام', region: 'lisan', subMakhraj: 'أدنى حافة اللسان إلى منتهى طرفه', qualities: ['جهر', 'توسط', 'انحراف', 'استفال (إلا في لفظ الجلالة أحياناً)'], practicalTip: 'انحراف الصوت لجانبي طرف اللسان؛ تُفخم في ﴿ٱللَّهُ﴾ بعد فتح أو ضم وتُرقق بعد كسر.', exampleWord: 'لِلَّهِ', point: { x: 112, y: 176 } },
  { id: 'nun', letter: 'ن', name: 'النون', region: 'lisan', subMakhraj: 'طرف اللسان + غنة الخيشوم', qualities: ['جهر', 'توسط', 'غنة أصلية', 'استفال'], practicalTip: 'مخرج لساني يُكمل بالرنين الخيشومي، ويتغير حكمها بحسب الحرف التالي.', exampleWord: 'ٱلنَّاسِ', point: { x: 105, y: 176 } },
  { id: 'ra', letter: 'ر', name: 'الراء', region: 'lisan', subMakhraj: 'طرف اللسان قريب من ظهره', qualities: ['جهر', 'توسط', 'انحراف', 'تكرير (ليُجتنَب المبالغة فيه)'], practicalTip: 'اترك فرجة صغيرة وسط طرف اللسان ليخرج الصوت بيسر دون ارتعاد متعدد مبالغ.', exampleWord: 'ٱلرَّحِيمِ', point: { x: 108, y: 173 } },
  { id: 'ta-emphatic', letter: 'ط', name: 'الطاء', region: 'lisan', subMakhraj: 'طرف اللسان مع أصول الثنايا العليا', qualities: ['جهر', 'شدة', 'استعلاء', 'إطباق', 'قلقلة'], practicalTip: 'أقوى الحروف العربية جميعاً؛ لا يخرج معها نفس (همس) وتُقلقل إذا سكنت.', exampleWord: 'ٱلصِّرَٰطَ', point: { x: 96, y: 176 } },
  { id: 'dal', letter: 'د', name: 'الدال', region: 'lisan', subMakhraj: 'طرف اللسان مع أصول الثنايا العليا', qualities: ['جهر', 'شدة', 'استفال', 'قلقلة عند السكون'], practicalTip: 'تشارك الطاء والتاء في المخرج لكنها مرققة وتُقلقل حال السكون مثل ﴿أَحَدٌ﴾.', exampleWord: 'أَحَدٌ', point: { x: 96, y: 180 } },
  { id: 'ta', letter: 'ت', name: 'التاء', region: 'lisan', subMakhraj: 'طرف اللسان مع أصول الثنايا العليا', qualities: ['همس', 'شدة', 'استفال', 'انفتاح'], practicalTip: 'احذر تفخيمها عند مجاورة المفخم وأظهر همسها اللطيف حال سكونها مثل ﴿كُتِبَتْ﴾.', exampleWord: 'أَنْعَمْتَ', point: { x: 95, y: 183 } },
  { id: 'sad', letter: 'ص', name: 'الصاد', region: 'lisan', subMakhraj: 'طرف اللسان مع صفحة الثنايا السفلى', qualities: ['همس', 'رخاوة', 'صفير', 'استعلاء', 'إطباق'], practicalTip: 'تشترك مع السين في الصفير وتتميز برفع أقصى اللسان والإطباق لتفخيمها.', exampleWord: 'ٱلصَّمَدُ', point: { x: 92, y: 192 } },
  { id: 'sin', letter: 'س', name: 'السين', region: 'lisan', subMakhraj: 'طرف اللسان مع صفحة الثنايا السفلى', qualities: ['همس', 'رخاوة', 'صفير', 'استفال', 'انفتاح'], practicalTip: 'صفير ناعم مرقق لا يتحول إلى صاد عند مجاورة الطاء أو القاف نحو ﴿مُسْتَقِيمَ﴾.', exampleWord: 'بِسْمِ', point: { x: 90, y: 194 } },
  { id: 'zay', letter: 'ز', name: 'الزاي', region: 'lisan', subMakhraj: 'طرف اللسان مع صفحة الثنايا السفلى', qualities: ['جهر', 'رخاوة', 'صفير', 'استفال', 'انفتاح'], practicalTip: 'تخرج من موضع السين بصفة الجهر؛ تجنب إخراجها من بين الأسنان كالذال.', exampleWord: 'رَزَقْنَٰهُمْ', point: { x: 91, y: 190 } },
  { id: 'za-emphatic', letter: 'ظ', name: 'الظاء', region: 'lisan', subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا', qualities: ['جهر', 'رخاوة', 'استعلاء', 'إطباق'], practicalTip: 'أخرج طرف اللسان قليلاً عند أطراف الثنايا مع استعلاء اللسان من الخلف لتفخيمها.', exampleWord: 'ٱلظَّٰلِمِينَ', point: { x: 84, y: 184 } },
  { id: 'dhal', letter: 'ذ', name: 'الذال', region: 'lisan', subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا', qualities: ['جهر', 'رخاوة', 'استفال', 'انفتاح'], practicalTip: 'مخرجها لثوي مع طرف الثنايا العليا كالظاء لكنها مرققة منفتحة.', exampleWord: 'ٱلَّذِينَ', point: { x: 84, y: 187 } },
  { id: 'tha', letter: 'ث', name: 'الثاء', region: 'lisan', subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا', qualities: ['همس', 'رخاوة', 'استفال', 'انفتاح'], practicalTip: 'طرف اللسان على حافة الثنايا العليا مع جريان النفس والهمس، لا تخلطها بالسين.', exampleWord: 'ٱلْكَوْثَرَ', point: { x: 83, y: 189 } },
  { id: 'fa', letter: 'ف', name: 'الفاء', region: 'shafatan', subMakhraj: 'أطراف الثنايا العليا مع بطن الشفة السفلى', qualities: ['همس', 'رخاوة', 'استفال', 'انفتاح'], practicalTip: 'اتصل بلطف بين الثنايا العليا وبطن الشفة السفلى، ولا تخفِ الميم الساكنة عندها.', exampleWord: 'ٱلْفَلَقِ', point: { x: 75, y: 192 } },
  { id: 'ba', letter: 'ب', name: 'الباء', region: 'shafatan', subMakhraj: 'انطباق الشفتين', qualities: ['جهر', 'شدة', 'استفال', 'قلقلة عند السكون'], practicalTip: 'تخرج بانطباق أقوى للداخل قليلاً من الميم وتُقلقل إذا سكنت نحو ﴿وَتَبَّ﴾.', exampleWord: 'بِرَبِّ', point: { x: 66, y: 186 } },
  { id: 'mim', letter: 'م', name: 'الميم', region: 'shafatan', subMakhraj: 'انطباق الشفتين + غنة الخيشوم', qualities: ['جهر', 'توسط', 'غنة أصلية', 'استفال'], practicalTip: 'شطرها الشفوي بالانطباق اليسير وشطرها الخيشومي بالرنين الموزون.', exampleWord: 'ٱلْحَمْدُ', point: { x: 66, y: 184 } },
  { id: 'waw', letter: 'و', name: 'الواو غير المدية', region: 'shafatan', subMakhraj: 'استدارة الشفتين مع انفتاح يسير', qualities: ['جهر', 'رخاوة', 'استفال', 'لين عند السكون بعد فتح'], practicalTip: 'استدارة كاملة للشفتين للأمام دون غنة أنفية، بعكس الواو المدية التي تنطلق من الجوف.', exampleWord: 'يَوْمِ', point: { x: 60, y: 186 } },
  { id: 'khayshum-ghunnah', letter: 'غنة ن/م', name: 'الخيشوم (صوت الغنة)', region: 'khayshum', subMakhraj: 'أقصى الأنف (التجويف الخيشومي)', qualities: ['ملازمة للنون والميم', 'حركتان في الإدغام والإخفاء والإقلاب والمشدد'], practicalTip: 'اختبار عملي: لو أمسكت الأنف أثناء الغنة انقطع الصوت تماماً، وإلا فالقراءة خاطئة من الفم.', exampleWord: 'عَمَّ / مِۢن بَعْدِ', point: { x: 138, y: 112 } },
];

export const SIMILAR_LETTER_PAIRS: SimilarLetterPair[] = [
  {
    id: 'sin-sad',
    title: 'س ضد ص (الترقيق والتفخيم في الصفير)',
    letterIds: ['sin', 'sad'],
    differenceSummary: 'كلاهما يخرج من طرف اللسان وصفحة الثنايا السفلى مع الصفير، لكن (ص) يرتفع معها أقصى اللسان ويُطبق فينتج تفخيم واضح بعكس (س) المرققة.',
    quranExample: 'عَسَىٰ / عَصَىٰ · ٱلْمُسْتَقِيمَ / ٱلصِّرَٰطَ',
  },
  {
    id: 'dhal-zay-za',
    title: 'ذ ضد ز ضد ظ (إخراج اللسان والصفير)',
    letterIds: ['dhal', 'zay', 'za-emphatic'],
    differenceSummary: '(ذ، ظ) تخرجان بإبراز طرف اللسان عند أطراف الثنايا العليا (ذ مرققة، ظ مفخمة)، أما (ز) فتخرج من الداخل دون إخراج اللسان وبصفير واضح.',
    quranExample: 'ٱلَّذِينَ / رَزَقْنَٰهُمْ / ٱلظَّٰلِمِينَ',
  },
  {
    id: 'ta-tta',
    title: 'ت ضد ط (الهمس مقابل الجهر والإطباق)',
    letterIds: ['ta', 'ta-emphatic'],
    differenceSummary: 'يتحدان في المخرج، لكن (ط) مجهورة مطبقة مفخمة لا يخرج معها نفس وتُقلقل حال السكون، بينما (ت) مرققة منفتحة مهموسة.',
    quranExample: 'ٱلطَّامَّةُ / تَبَّتْ',
  },
  {
    id: 'dad-dal',
    title: 'د ضد ض (الشدة مقابل الاستطالة)',
    letterIds: ['dal', 'dad'],
    differenceSummary: '(د) حرف طرفي مرقق شديد يقلقل عند سكونه، بينما (ض) تخرج من حافة اللسان مع الأضراس بصفة الاستطالة والرخاوة دون قلقلة.',
    quranExample: 'أَحَدٌ / ٱلضَّآلِّينَ',
  },
  {
    id: 'qaf-kaf',
    title: 'ق ضد ك (أقصى اللسان والهمس)',
    letterIds: ['qaf', 'kaf'],
    differenceSummary: '(ق) أعمق مخرجاً في اللسان ومفخمة وتقلقل حال السكون، بينما (ك) أقرب للفم ومرققة ومهموسة عند السكون.',
    quranExample: 'قُلْ / إِيَّاكَ / ٱلْكَوْثَرَ',
  },
];

/* ============================================================================
 * PHASE 3 DATA: MULTI-MODE GRADED QUIZ BANK (منظومة الاختبارات التفاعلية)
 * ========================================================================== */

export type TajweedQuizQuestionType = 'mcq' | 'spot-word' | 'audio';

export interface TajweedQuizQuestion {
  id: number;
  type: TajweedQuizQuestionType;
  category: QuizCategoryId;
  difficulty: 'أساسي' | 'متوسط' | 'متقدم';
  question: string;
  ayahSnippet: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ruleCategory: string;
  // Optional data for spot-word interactive ayah click questions
  spotAyah?: {
    uthmani: string;
    tajweedText: string;
    targetWordIndices: number[];
    targetRuleLabel: string;
  };
  // Optional audio reference for listening test questions
  audioRef?: {
    surahNumber: number;
    surahName: string;
    ayahNumber: number;
  };
}

export const TAJWEED_QUIZ: TajweedQuizQuestion[] = [
  {
    id: 1,
    type: 'mcq',
    category: 'noon-meem',
    difficulty: 'أساسي',
    question: 'ما هو حكم النون الساكنة في قوله تعالى: ﴿مِنۢ بَعْدِ﴾؟',
    ayahSnippet: 'إِلَّا مِنۢ بَعْدِ مَا جَآءَتْهُمُ ٱلْبَيِّنَةُ',
    options: ['إظهار حلقي', 'إقلاب (قلب النون ميماً مخفاة بغنة)', 'إدغام بغنة', 'إخفاء حقيقي'],
    correctIndex: 1,
    explanation: 'تقلب النون الساكنة أو التنوين ميماً مخفاة بغنة حركتين إذا جاء بعدها حرف الباء، وتوضع ميم قائمة صغيرة (ۢ) بالمصحف.',
    ruleCategory: 'iqlab',
  },
  {
    id: 2,
    type: 'spot-word',
    category: 'noon-meem',
    difficulty: 'أساسي',
    question: 'اضغط على الكلمة التي تحوي «غنة نون أو ميم مشددة» في الآية:',
    ayahSnippet: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
    options: [],
    correctIndex: 0,
    explanation: 'في كلمة ﴿وَمِمَّا﴾ ميم مشددة تُغن من الخيشوم بمقدار حركتين، أما ﴿يُنفِقُونَ﴾ فحكمها إخفاء حقيقي.',
    ruleCategory: 'ghunnah',
    spotAyah: {
      uthmani: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
      tajweedText: 'ٱلَّذِينَ يُؤْمِنُونَ بِ[h:13[ٱ]]لْغَيْبِ وَيُقِيمُونَ [h:14[ٱ]][l[ل]]صَّلَ[s[و]][n[ٲ]]ةَ وَمِ[g[مّ]]َا رَزَ[q:15[قْ]]نَ[n[ـٰ]]هُمْ يُ[f:16[نف]]ِق[p[ُو]]نَ',
      targetWordIndices: [5],
      targetRuleLabel: 'غنة ميم مشددة (وَمِمَّا)',
    },
  },
  {
    id: 3,
    type: 'audio',
    category: 'noon-meem',
    difficulty: 'متوسط',
    question: 'استمع إلى الآية ثم حدّد نوع الإخفاء الأول في قوله تعالى ﴿تَرْمِيهِم بِحِجَارَةٍ﴾:',
    ayahSnippet: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
    options: ['إظهار شفوي بدون غنة', 'إخفاء شفوي (ميم ساكنة بعدها باء)', 'إقلاب نون ساكنة', 'إدغام متماثلين'],
    correctIndex: 1,
    explanation: 'الميم الساكنة في آخر ﴿تَرْمِيهِم﴾ لاقت الباء في ﴿بِحِجَارَةٍ﴾، فالحكم إخفاء شفوي بغنة حركتين.',
    ruleCategory: 'ikhfa',
    audioRef: { surahNumber: 105, surahName: 'الفيل', ayahNumber: 4 },
  },
  {
    id: 4,
    type: 'mcq',
    category: 'noon-meem',
    difficulty: 'أساسي',
    question: 'ما حكم الميم المشددة في قوله تعالى: ﴿عَمَّ يَتَسَآءَلُونَ﴾؟',
    ayahSnippet: 'عَمَّ يَتَسَآءَلُونَ ﴿١﴾ عَنِ ٱلنَّبَإِ ٱلْعَظِيمِ',
    options: ['إخفاء شفوي', 'غنة مشددة بمقدار حركتين', 'إدغام مثلين', 'إظهار مطلق'],
    correctIndex: 1,
    explanation: 'النون والميم المشددتان حكمهما الغنة المشددة بمقدار حركتين وصلاً ووقفاً، وصوتها يخرج من الخيشوم.',
    ruleCategory: 'ghunnah',
  },
  {
    id: 5,
    type: 'mcq',
    category: 'noon-meem',
    difficulty: 'متوسط',
    question: 'في قوله تعالى: ﴿وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ﴾، ما حكم النون الساكنة قبل اللام؟',
    ayahSnippet: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
    options: ['إدغام بغنة', 'إدغام كامل بغير غنة', 'إظهار حلقي', 'إخفاء حقيقي'],
    correctIndex: 1,
    explanation: 'اللام والراء هما حرفا الإدغام بغير غنة، فتسقط النون الساكنة بالكلية وتُشدد اللام.',
    ruleCategory: 'silent',
  },
  {
    id: 6,
    type: 'mcq',
    category: 'madd',
    difficulty: 'أساسي',
    question: 'كم عدد حركات المد اللازم في قوله تعالى: ﴿وَلَا ٱلضَّآلِّينَ﴾؟',
    ayahSnippet: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    options: ['حركتان', '4 حركات', '6 حركات وجوباً', 'يجوز فيه الوجهان'],
    correctIndex: 2,
    explanation: 'المد اللازم الكلمي المثقل يمد بمقدار 6 حركات مشبعة وجوباً عند جميع القراء لمجيء السكون الأصلي المشدد بعد حرف المد.',
    ruleCategory: 'madd',
  },
  {
    id: 7,
    type: 'audio',
    category: 'madd',
    difficulty: 'متوسط',
    question: 'استمع لتلاوة سورة الكوثر (الآية ١): ما نوع المد في بداية الآية ﴿إِنَّآ أَعْطَيْنَٰكَ﴾؟',
    ayahSnippet: 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ',
    options: ['مد واجب متصل في كلمة واحدة', 'مد جائز منفصل (4-5 حركات)', 'مد لازم كلمي (6 حركات)', 'مد عارض للسكون'],
    correctIndex: 1,
    explanation: 'حرف المد (آ) في نهاية كلمة ﴿إِنَّآ﴾ والهمزة في أول كلمة ﴿أَعْطَيْنَٰكَ﴾، لذلك فهو مد جائز منفصل.',
    ruleCategory: 'madd',
    audioRef: { surahNumber: 108, surahName: 'الكوثر', ayahNumber: 1 },
  },
  {
    id: 8,
    type: 'spot-word',
    category: 'madd',
    difficulty: 'متوسط',
    question: 'اضغط على الكلمة التي تحوي «مداً لازماً (6 حركات وجوباً)» في الآية:',
    ayahSnippet: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    options: [],
    correctIndex: 0,
    explanation: 'كلمة ﴿ٱلضَّآلِّينَ﴾ تحوي ألف مد بعدها لام مشددة، وهو مد لازم كلمي مثقل يُمد 6 حركات.',
    ruleCategory: 'madd',
    spotAyah: {
      uthmani: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      tajweedText: 'صِر[n[َٲ]]طَ [h[ٱ]]لَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ [h[ٱ]]لْمَغْضُوبِ عَلَيْهِمْ وَلَا [h[ٱ]][l[ل]]ضّ[m[َا]]ٓلّ[p[ِي]]نَ',
      targetWordIndices: [8],
      targetRuleLabel: 'مد لازم كلمي مثقل (ٱلضَّآلِّينَ)',
    },
  },
  {
    id: 9,
    type: 'mcq',
    category: 'madd',
    difficulty: 'أساسي',
    question: 'ما وظيفة الواو في كلمة ﴿ٱلصَّلَوٰةَ﴾ وفق الرسم العثماني؟',
    ayahSnippet: 'وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
    options: ['تُنطق واواً مضمومة', 'تُمد واواً بمقدار 4 حركات', 'واو رسماً لا تُلفظ والألف الخنجرية فوقها هي الممدودة حركتين', 'تُقلقل عند الوقف'],
    correctIndex: 2,
    explanation: 'في الرسم العثماني لكلمات مثل ﴿ٱلصَّلَوٰةَ﴾ و﴿ٱلزَّكَوٰةَ﴾، الواو كرسي صامت وتُنطق الألف الخنجرية فوقها مداً طبيعياً حركتين.',
    ruleCategory: 'madd',
  },
  {
    id: 10,
    type: 'mcq',
    category: 'madd',
    difficulty: 'أساسي',
    question: 'عند الوقف على ﴿ٱلْعَٰلَمِينَ﴾، ما مقدار المد العارض للسكون الجائز؟',
    ayahSnippet: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    options: ['حركة واحدة فقط', 'حركتان أو 4 أو 6 حركات', '5 حركات وجوباً', 'لا يُمد عند الوقف'],
    correctIndex: 1,
    explanation: 'المد العارض للسكون يجوز فيه القصر (2) أو التوسط (4) أو الطول (6) حركات حال الوقف على الحرف الأخير.',
    ruleCategory: 'madd',
  },
  {
    id: 11,
    type: 'mcq',
    category: 'articulation',
    difficulty: 'أساسي',
    question: 'أي من الحروف الآتية هو أحد حروف القلقلة (قطب جد)؟',
    ayahSnippet: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ﴿١﴾ ٱللَّهُ ٱلصَّمَدُ ﴿٢﴾',
    options: ['الدال (د)', 'السين (س)', 'الراء (ر)', 'الحاء (ح)'],
    correctIndex: 0,
    explanation: 'حروف القلقلة خمسة مجموعة في (قَطْبُ جَدٍّ)، وعند الوقف على ﴿أَحَدٌ﴾ تُقلقل الدال قلقلة كبرى واضحة.',
    ruleCategory: 'qalqalah',
  },
  {
    id: 12,
    type: 'spot-word',
    category: 'articulation',
    difficulty: 'أساسي',
    question: 'اضغط على الكلمة التي تحوي «قلقلة صغرى» في وسط الكلمة:',
    ayahSnippet: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
    options: [],
    correctIndex: 0,
    explanation: 'في كلمة ﴿رَزَقْنَٰهُمْ﴾ تأتي القاف الساكنة في وسط الكلمة، فتُقلقل قلقلة صغرى واضحة دون تحريكها.',
    ruleCategory: 'qalqalah',
    spotAyah: {
      uthmani: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
      tajweedText: 'ٱلَّذِينَ يُؤْمِنُونَ بِ[h:13[ٱ]]لْغَيْبِ وَيُقِيمُونَ [h:14[ٱ]][l[ل]]صَّلَ[s[و]][n[ٲ]]ةَ وَمِ[g[مّ]]َا رَزَ[q:15[قْ]]نَ[n[ـٰ]]هُمْ يُ[f:16[نف]]ِق[p[ُو]]نَ',
      targetWordIndices: [6],
      targetRuleLabel: 'قلقلة صغرى في وسط الكلمة (رَزَقْنَٰهُمْ)',
    },
  },
  {
    id: 13,
    type: 'audio',
    category: 'articulation',
    difficulty: 'أساسي',
    question: 'استمع إلى الآية الأولى من سورة الفلق: أين تظهر القلقلة الكبرى بوضوح؟',
    ayahSnippet: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
    options: ['في حرف القاف الأول ﴿قُلْ﴾', 'في حرف القاف الموقوف عليه آخر ﴿ٱلْفَلَقِ﴾', 'في حرف الباء ﴿بِرَبِّ﴾', 'لا توجد قلقلة في الآية'],
    correctIndex: 1,
    explanation: 'القاف في ﴿قُلْ﴾ متحركة بالضم فلا تُقلقل، أما القاف في آخر ﴿ٱلْفَلَقِ﴾ فتسكن عند الوقف وتُقلقل قلقلة كبرى.',
    ruleCategory: 'qalqalah',
    audioRef: { surahNumber: 113, surahName: 'الفلق', ayahNumber: 1 },
  },
  {
    id: 14,
    type: 'mcq',
    category: 'articulation',
    difficulty: 'متوسط',
    question: 'ما الحروف التي تسقط نطقاً في قوله تعالى: ﴿وَٱلشَّمْسِ﴾ باللون الرمادي؟',
    ayahSnippet: 'وَٱلشَّمْسِ وَضُحَىٰهَا',
    options: ['حرف الواو فقط', 'همزة الوصل واللام الشمسية المدغمة', 'حرف الشين المشددة', 'حرف الميم الساكنة'],
    correctIndex: 1,
    explanation: 'تسقط همزة الوصل وصلاً وتُدغم اللام الشمسية في الشين، فتُنطق مباشرة (وَشَّمْسِ).',
    ruleCategory: 'silent',
  },
  {
    id: 15,
    type: 'mcq',
    category: 'makharij',
    difficulty: 'أساسي',
    question: 'من أين تخرج حروف المد الثلاثة (الألف، الواو الساكنة بعد ضم، الياء الساكنة بعد كسر)؟',
    ayahSnippet: 'نُوحِيهَا',
    options: ['أقصى الحلق', 'طرف اللسان', 'الجوف (خلاء الحلق والفم)', 'الخيشوم'],
    correctIndex: 2,
    explanation: 'حروف المد الثلاثة تخرج من الجوف (مخرج مقدّر يمتد عبر الخلاء في الحلق والفم).',
    ruleCategory: 'madd',
  },
  {
    id: 16,
    type: 'mcq',
    category: 'makharij',
    difficulty: 'متوسط',
    question: 'ما الفرق الجوهري بين حرفي (السين) و(الصاد) مع اشتراكهما في المخرج والصفير؟',
    ayahSnippet: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
    options: ['السين فيها غنة والصاد لا', 'الصاد تتميز بالاستعلاء والإطباق والتفخيم بينما السين مرققة منفتحة', 'السين تخرج من الشفتين', 'الصاد تقلقل عند الوقف'],
    correctIndex: 1,
    explanation: 'كلاهما من حروف الصفير من طرف اللسان، لكن الصاد من حروف الاستعلاء والإطباق (خص ضغط قظ) فتُفخم، والسين مستفلة منفتحة مرققة.',
    ruleCategory: 'tafkheem',
  },
  {
    id: 17,
    type: 'mcq',
    category: 'makharij',
    difficulty: 'متوسط',
    question: 'أيّ الحروف التالية يشترك اللسان والخيشوم معاً في إخراج صوته الأصلي؟',
    ayahSnippet: 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ',
    options: ['اللام والراء', 'القاف والكاف', 'النون والميم', 'العين والحاء'],
    correctIndex: 2,
    explanation: 'للنون مخرج لساني ومخرج خيشومي (الغنة)، وللميم مخرج شفوي ومخرج خيشومي (الغنة).',
    ruleCategory: 'ghunnah',
  },
  {
    id: 18,
    type: 'mcq',
    category: 'makharij',
    difficulty: 'متقدم',
    question: 'ما هي الصفة الفريدة التي ينفرد بها حرف الضاد (ض) عن سائر الحروف العربية؟',
    ayahSnippet: 'وَلَا ٱلضَّآلِّينَ',
    options: ['القلقلة', 'التفشّي', 'الاستطالة (امتداد الصوت بطول حافة اللسان)', 'الصفير'],
    correctIndex: 2,
    explanation: 'الاستطالة هي امتداد الصوت في مخرج الضاد من أول حافة اللسان إلى آخرها، وهي صفة خاصة بالضاد وحدها.',
    ruleCategory: 'tafkheem',
  },
];
