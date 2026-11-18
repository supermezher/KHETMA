import { TajweedRuleType } from '../utils/tajweedParser';

export type TajweedChapterId = 'noon-sakinah' | 'meem-ghunnah' | 'madd' | 'articulation';

export const TAJWEED_CHAPTERS: {
  id: TajweedChapterId;
  title: string;
  description: string;
}[] = [
  {
    id: 'noon-sakinah',
    title: 'النون الساكنة والتنوين',
    description: 'أحكام الإدغام والإخفاء والإقلاب والإظهار',
  },
  {
    id: 'meem-ghunnah',
    title: 'الميم والغنة المشددة',
    description: 'أحكام الغنة المشددة والإخفاء والإدغام الشفويين',
  },
  {
    id: 'madd',
    title: 'أحكام المدود',
    description: 'المد الطبيعي والواجب واللازم والعارض والبدل',
  },
  {
    id: 'articulation',
    title: 'القلقلة والتفخيم والصامت',
    description: 'صفات القلقلة والاستعلاء والحروف التي لا تُلفظ',
  },
];

export interface TajweedRule {
  id: string;
  chapter: TajweedChapterId;
  name: string;
  nameEn: string;
  level: string;
  mizan: string;
  definition: string;
  letters: string[];
  colorHex: string;
  exampleQuran: string;
  ruleTypes: TajweedRuleType[];
  beats: {
    unit: string;
    options: number[];
    note: string;
  };
  examples: {
    surahNumber: number;
    surahName: string;
    ayahNumber: number;
    uthmani: string;
    tajweedText: string;
    focusNote: string;
  }[];
  commonMistake: {
    mistake: string;
    correction: string;
  };
  benefit: string;
}

export const TAJWEED_RULES: TajweedRule[] = [
  {
    id: 'ghunnah',
    chapter: 'meem-ghunnah',
    name: 'الغنة المشددة (النون والميم)',
    nameEn: 'Mushaddadah Ghunnah',
    level: 'مبتدئ',
    mizan: 'حركتان',
    definition:
      'صوت لذيذ يخرج من الخيشوم لا عمل للسان فيه، يظهر بأكمل درجاته في النون والميم المشددتين.',
    letters: ['نّ', 'مّ'],
    colorHex: '#10b981',
    exampleQuran: 'إِنَّا أَعْطَيْنَاكَ · عَمَّ يَتَسَاءَلُونَ',
    ruleTypes: ['ghunnah'],
    beats: {
      unit: 'حركات الغنة',
      options: [2],
      note: 'تُضبط الغنة بمقدار حركتين كاملتين بهدوء وانسياب دون تقطيع.',
    },
    examples: [
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 1,
        uthmani: 'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
        tajweedText: 'إِ[g[نّ]َ[o[آ] أَعْطَيْنَ[n[ـٰ]كَ [h[ٱ]لْكَوْثَرَ',
        focusNote: 'تظهر الغنة بوضوح في النون المشددة من كلمة «إِنَّآ» بمقدار حركتين.',
      },
      {
        surahNumber: 78,
        surahName: 'النبأ',
        ayahNumber: 1,
        uthmani: 'عَمَّ يَتَسَآءَلُونَ',
        tajweedText: 'عَ[g[مّ]َ يَتَسَ[o[آ]ءَل[p[ُو]نَ',
        focusNote: 'الميم المشددة في «عَمَّ» تُنطق بغنة خيشومية كاملة بمقدار حركتين.',
      },
    ],
    commonMistake: {
      mistake: 'البتر السريع للنون أو الميم المشددتين وكأنهما حرف واحد مخفف دون إشباع الغنة.',
      correction: 'إبقاء الصوت في الخيشوم زمناً لطيفاً يساوي حركتين قبل الانتقال للحرف التالي.',
    },
    benefit: 'تمنح التلاوة رونقاً روحانياً وتمنع التداخل المتعجل بين الكلمات.',
  },
  {
    id: 'ikhfa',
    chapter: 'noon-sakinah',
    name: 'الإخفاء الحقيقي والشفوي',
    nameEn: 'Ikhfa',
    level: 'مبتدئ',
    mizan: 'حركتان',
    definition:
      'النطق بالنون الساكنة أو التنوين أو الميم الساكنة عند الباء بحالة وسط بين الإظهار والإدغام مع بقاء الغنة.',
    letters: ['ص', 'ذ', 'ث', 'ك', 'ج', 'ش', 'ق', 'س', 'د', 'ط', 'ز', 'ف', 'ت', 'ض', 'ظ', 'ب (شفوي)'],
    colorHex: '#22c55e',
    exampleQuran: 'كُنتُمْ · تَرْمِيهِم بِحِجَارَةٍ',
    ruleTypes: ['ikhfa'],
    beats: {
      unit: 'حركات الإخفاء',
      options: [2],
      note: 'يُحافظ اللسان على التهيؤ لمخرج الحرف التالي دون إلصاق تام بمخرج النون.',
    },
    examples: [
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 4,
        uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: 'قُلْ هُوَ [h[ٱ]للَّهُ أَحَدٌ',
        focusNote: '', // Replaced right below in curated example
      },
      {
        surahNumber: 105,
        surahName: 'الفيل',
        ayahNumber: 4,
        uthmani: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
        tajweedText: 'تَرْمِيهِ[c[م ب]ِحِجَارَ[a[ةٍ م]ِّ[f[ن س]ِجّ[p[ِي]لٍ',
        focusNote: 'اجتمع الإخفاء الشفوي في «تَرْمِيهِم بِحِجَارَةٍ» والإخفاء الحقيقي في «مِن سِجِّيلٍ».',
      },
    ],
    commonMistake: {
      mistake: 'إلصاق طرف اللسان باللثة عند الإخفاء الحقيقي فتتحول النون إلى مظهرة، أو كز الشفتين بشدة في الشفوي.',
      correction: 'تجافي طرف اللسان في الحقيقي وتلامس خفيف مرن للشفتين في الإخفاء الشفوي مع تفخيم الغنة قبل حروف الاستعلاء.',
    },
    benefit: 'تحقيق الانسياب الصوتي بين النون وحروف الإخفاء الخمسة عشر دون ثقل.',
  },
  {
    id: 'idgham',
    chapter: 'noon-sakinah',
    name: 'الإدغام بغنة (والإدغام الشفوي)',
    nameEn: 'Idgham with Ghunnah',
    level: 'متوسط',
    mizan: 'حركتان',
    definition:
      'إدخال النون الساكنة أو التنوين في أحد حروف «ينمو»، أو الميم الساكنة في مثلها ليصيرا حرفاً مشدداً مع الغنة.',
    letters: ['ي', 'ن', 'م', 'و'],
    colorHex: '#16a34a',
    exampleQuran: 'فَمَن يَعْمَلْ · عَلَيْهِم مُّؤْصَدَةٌ',
    ruleTypes: ['idgham'],
    beats: {
      unit: 'حركات الإدغام',
      options: [2],
      note: 'تُخرج الغنة من الخيشوم في أثناء اندماج الحرف الساكن بالمتحرك.',
    },
    examples: [
      {
        surahNumber: 99,
        surahName: 'الزلزلة',
        ayahNumber: 7,
        uthmani: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُۥ',
        tajweedText: 'فَمَ[a[ن ي]َعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرً[a[ا ي]َرَهُۥ',
        focusNote: 'إدغام النون الساكنة والتنوين في الياء بغنة كاملة في الموضعين.',
      },
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 8,
        uthmani: 'إِنَّهَا عَلَيْهِم مُّؤْصَدَةٌ',
        tajweedText: 'إِ[g[نّ]َهَا عَلَيْهِ[w[م م]ُّؤْصَدَةٌ',
        focusNote: 'إدغام الميم الساكنة في الميم المتحركة (إدغام مثلين صغير) بغنة حركتين.',
      },
    ],
    commonMistake: {
      mistake: 'إسقاط الغنة تماماً عند الياء والواو أو تشديد الحرف دون مرور الصوت بالخيشوم.',
      correction: 'إشراك الخيشوم بنسبة متوازنة في الياء والواو وإتمام الغنة في النون والميم.',
    },
    benefit: 'تيسير النطق بوصل الكلمتين كحرف واحد مشدد سلس الإيقاع.',
  },
  {
    id: 'iqlab',
    chapter: 'noon-sakinah',
    name: 'الإقلاب',
    nameEn: 'Iqlab',
    level: 'مبتدئ',
    mizan: 'حركتان',
    definition:
      'قلب النون الساكنة أو التنوين عند ملاقاة حرف الباء إلى ميم مخفاة بغنة بمقدار حركتين.',
    letters: ['ب'],
    colorHex: '#059669',
    exampleQuran: 'مِنۢ بَعْدِ · سَمِيعٌۢ بَصِيرٌ',
    ruleTypes: ['iqlab'],
    beats: {
      unit: 'حركات الإقلاب',
      options: [2],
      note: 'الميم المقلوبة تُنطق بتلامس لطيف بين الشفتين دون ضغط عنيف.',
    },
    examples: [
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 4,
        uthmani: 'لَيُنۢبَذَنَّ فِى ٱلْحُطَمَةِ',
        tajweedText: 'لَيُ[i[نۢب]َذَ[g[نّ]َ فِى [h[ٱ]لْحُطَمَةِ',
        focusNote: 'تُقلب النون الساكنة قبل الباء في «لَيُنۢبَذَنَّ» إلى ميم مخفاة بغنة حركتين.',
      },
      {
        surahNumber: 92,
        surahName: 'الليل',
        ayahNumber: 8,
        uthmani: 'وَأَمَّا مَنۢ بَخِلَ وَٱسْتَغْنَىٰ',
        tajweedText: 'وَأَ[g[مّ]َا مَ[i[نۢ ب]َخِلَ وَ[h[ٱ]سْتَغْنَ[n[ىٰ]',
        focusNote: 'تلتقي النون الساكنة مع الباء في «مَنۢ بَخِلَ» فتُقلب ميماً مخفاة بغنة.',
      },
    ],
    commonMistake: {
      mistake: 'الضغط الشديد على الشفتين عند قلب النون ميماً مما يولد غنة مكتومة أو زائدة.',
      correction: 'تطبيق الشفتين برفق مع استمرار الغنة حركتين ثم فتحهما على الباء.',
    },
    benefit: 'تسهيل الانتقال من مخرج النون اللساني إلى الباء الشفوية عبر الميم المشتركة.',
  },
  {
    id: 'qalqalah',
    chapter: 'articulation',
    name: 'القلقلة (قطب جد)',
    nameEn: 'Qalqalah',
    level: 'مبتدئ',
    mizan: 'نبضة فورية',
    definition:
      'اضطراب الحرف الساكن عند النطق به حتى يُسمع له نبرة قوية، وتكون كبرى عند الوقف وصغرى وسط الكلمة.',
    letters: ['ق', 'ط', 'ب', 'ج', 'د'],
    colorHex: '#f59e0b',
    exampleQuran: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ · لَمْ يَلِدْ',
    ruleTypes: ['qalqalah'],
    beats: {
      unit: 'درجة القلقلة',
      options: [1],
      note: 'القلقلة الصغرى وسط الكلام والكبرى عند الوقف على السكون أو المشدد.',
    },
    examples: [
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 1,
        uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: 'قُلْ هُوَ [h[ٱ]للَّهُ أَحَ[q[د]ٌ',
        focusNote: 'قلقلة الدال الموقوف عليها في «أَحَدٌ» (قلقلة كبرى واضحة).',
      },
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 3,
        uthmani: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        tajweedText: 'لَمْ يَلِ[q[دْ] وَلَمْ يُولَ[q[دْ]',
        focusNote: 'الدال الساكنة في «يَلِدْ» قلقلة صغرى وصلاً وكبرى عند الوقف على «يُولَدْ».',
      },
    ],
    commonMistake: {
      mistake: 'إمالة صوت القلقلة نحو الفتحة أو الضمة أو الكسرة، أو إنهاؤها بهمزة مختلسة.',
      correction: 'انفكاك طرفي المخرج بتصادم ثم تباعد نقي دون تشريبها حركة أخرى.',
    },
    benefit: 'تحافظ على وضوح حروف الشدة والجهر الساكنة فلا تضيع معالمها.',
  },
  {
    id: 'madd-wajib',
    chapter: 'madd',
    name: 'المد الواجب المتصل والمنفصل',
    nameEn: 'Madd Wajib & Jaiz',
    level: 'متوسط',
    mizan: '٤ - ٥ حركات',
    definition:
      'أن يأتي بعد حرف المد همز في الكلمة نفسها (متصل 4-5 حركات وجوباً) أو في أول الكلمة التالية (منفصل 4-5 حركات لحفص من الشاطبية).',
    letters: ['آ', 'وٓ', 'ىٓ'],
    colorHex: '#ef4444',
    exampleQuran: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ · إِنَّآ أَعْطَيْنَـٰكَ',
    ruleTypes: ['madd-wajib'],
    beats: {
      unit: 'حركات المد',
      options: [4, 5],
      note: 'يُحافظ القارئ على توازن مقداره (4 أو 5 حركات) طوال التلاوة.',
    },
    examples: [
      {
        surahNumber: 110,
        surahName: 'النصر',
        ayahNumber: 1,
        uthmani: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
        tajweedText: 'إِذَا جَ[o[آ]ءَ نَصْرُ [h[ٱ]للَّهِ وَ[h[ٱ]لْفَتْحُ',
        focusNote: 'مد واجب متصل في كلمة «جَآءَ» بمقدار 4 أو 5 حركات.',
      },
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 1,
        uthmani: 'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
        tajweedText: 'إِ[g[نّ]َ[o[آ] أَعْطَيْنَ[n[ـٰ]كَ [h[ٱ]لْكَوْثَرَ',
        focusNote: 'مد جائز منفصل بين «إِنَّآ» و«أَعْطَيْنَاكَ» يمد 4-5 حركات بالتوسط.',
      },
    ],
    commonMistake: {
      mistake: 'تقصير المد الواجب المتصل إلى حركتين أو عدم التسوية بين المدود المتماثلة.',
      correction: 'التزام ميزان ثابت (أربع حركات مثلاً) في جميع المواضع المتشابهة في القراءة.',
    },
    benefit: 'يمنح النفس اتساعاً لحمل معنى الهمزة التي بعد المد ويبرز جلال الألفاظ.',
  },
  {
    id: 'madd-lazim',
    chapter: 'madd',
    name: 'المد اللازم المشبع',
    nameEn: 'Madd Lazim',
    level: 'متقدم',
    mizan: '٦ حركات',
    definition:
      'أن يأتي بعد حرف المد سكون أصلي لازم وصلاً ووقفاً سواء في كلمة مشددة أو في فواتح السور.',
    letters: ['آ + شدّة/سكون', 'الحروف المقطعة'],
    colorHex: '#dc2626',
    exampleQuran: 'وَلَا ٱلضَّآلِّينَ · ٱلْحَآقَّةُ',
    ruleTypes: ['madd-lazim'],
    beats: {
      unit: 'حركات الإشباع',
      options: [6],
      note: 'يُلزم مدّه ست حركات كاملة بلا نقصان عند جميع القراء.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 7,
        uthmani: 'وَلَا ٱلضَّآلِّينَ',
        tajweedText: 'وَلَا [h[ٱ][l[ل]ضّ[m[َا]ٓلّ[p[ِي]نَ',
        focusNote: 'مد لازم كلمي مثقل في الألف قبل اللام المشددة من «ٱلضَّآلِّينَ» (6 حركات).',
      },
      {
        surahNumber: 69,
        surahName: 'الحاقة',
        ayahNumber: 1,
        uthmani: 'ٱلْحَآقَّةُ',
        tajweedText: '[h[ٱ]لْح[m[َا]ٓقَّةُ',
        focusNote: 'مد لازم كلمي مثقل في الألف من «ٱلْحَآقَّةُ» بمقدار 6 حركات.',
      },
    ],
    commonMistake: {
      mistake: 'تقليص المد إلى 4 حركات أو التمويج في الصوت وتسهيل الشدة التالية له.',
      correction: 'مدّ الصوت باستقامة 6 حركات ثم النبر المتزن على الحرف المشدد.',
    },
    benefit: 'يمكن القارئ من التخلص من التقاء الساكنين مع إظهار هيبة المطلع القرآني.',
  },
  {
    id: 'madd-arid',
    chapter: 'madd',
    name: 'المد العارض للسكون',
    nameEn: 'Madd Arid Lil-Sukun',
    level: 'مبتدئ',
    mizan: '٢ / ٤ / ٦ حركات',
    definition:
      'أن يقع بعد حرف المد حرف أخير متحرك سُكن للوقف عليه في آخر الآية أو الكلمة.',
    letters: ['ا / و / ي قبل الحرف الموقوف عليه'],
    colorHex: '#fb923c',
    exampleQuran: 'ٱلْعَـٰلَمِينَ · نَسْتَعِينُ',
    ruleTypes: ['madd-arid'],
    beats: {
      unit: 'أوجه الوقف',
      options: [2, 4, 6],
      note: 'يجوز فيه القصر (2) والتوسط (4) والطول (6)، والأرجح التزام وجه واحد في الجلسة.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 2,
        uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        tajweedText: '[h[ٱ]لْحَمْدُ لِلَّهِ رَبِّ [h[ٱ]لْعَ[n[ـٰ]لَم[p[ِي]نَ',
        focusNote: 'الياء في «ٱلْعَـٰلَمِينَ» عند الوقف مد عارض للسكون يُمد 2 أو 4 أو 6 حركات.',
      },
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 5,
        uthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        tajweedText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَع[p[ِي]نُ',
        focusNote: 'الوقف على «نَسْتَعِينُ» يُظهر المد العارض للسكون مع تسكين النون.',
      },
    ],
    commonMistake: {
      mistake: 'التنقل العشوائي بين القصر والطول من آية إلى أخرى في المجلس الواحد.',
      correction: 'اعتماد التوسط (4 حركات) بانتظام في جميع رؤوس الآي.',
    },
    benefit: 'يضفي ختاماً موزوناً ومهيباً على مقاطع الآيات القرآنية.',
  },
  {
    id: 'madd-tabeei',
    chapter: 'madd',
    name: 'المد الطبيعي (الأصلي)',
    nameEn: 'Madd Tabeei',
    level: 'مبتدئ',
    mizan: 'حركتان',
    definition:
      'المد الذي لا تقوم ذات الحرف إلا به ولا يتوقف على سبب من همز أو سكون، ويمد حركتين فقط.',
    letters: ['ا', 'و', 'ي', 'ٰ (الألف الخنجرية)'],
    colorHex: '#a855f7',
    exampleQuran: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ · ٱلصَّلَوٰةَ',
    ruleTypes: ['madd-tabeei'],
    beats: {
      unit: 'حركات المد',
      options: [2],
      note: 'حركتان بالضبط؛ لا يُنقص ليصير كالفتحة ولا يُزاد فوق حقه.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 4,
        uthmani: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        tajweedText: 'مَ[n[ـٰ]لِكِ يَوْمِ [h[ٱ][l[ل]دّ[p[ِي]نِ',
        focusNote: 'الألف الخنجرية في «مَـٰلِكِ» تُمد مداً طبيعياً بمقدار حركتين.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 3,
        uthmani: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَـٰهُمْ يُنفِقُونَ',
        tajweedText:
          'ٱلَّذِينَ يُؤْمِنُونَ بِ[h[ٱ]لْغَيْبِ وَيُقِيمُونَ [h[ٱ][l[ل]صَّلَ[s[و][n[ٲ]ةَ وَمِ[g[مّ]َا رَزَ[q[قْ]نَ[n[ـٰ]هُمْ يُ[f[نف]ِق[p[ُو]نَ',
        focusNote: 'الألف في «رَزَقْنَـٰهُمْ» والألف فوق الواو في «ٱلصَّلَوٰةَ» تمدان حركتين.',
      },
    ],
    commonMistake: {
      mistake: 'اختلاس الألف الخنجرية أو الواو والياء المديتين في وسط الكلام فتنقلب إلى حركة قصيرة.',
      correction: 'إعطاء كل حرف مد حقّه التام بمقدار حركتين بوضوح ويسر.',
    },
    benefit: 'يحفظ استقامة أوزان الكلمات القرآنية ومعانيها الدقيقة.',
  },
  {
    id: 'tafkheem',
    chapter: 'articulation',
    name: 'التفخيم والاستعلاء',
    nameEn: 'Tafkheem',
    level: 'متوسط',
    mizan: 'تغليظ الصوت',
    definition:
      'سِمَن يدخل على صوت الحرف فيمتلئ الفم بصداه، ويشمل حروف الاستعلاء السبعة (خص ضغط قظ) والراء ولام الجلالة في مواضعهما.',
    letters: ['خ', 'ص', 'ض', 'غ', 'ط', 'ق', 'ظ'],
    colorHex: '#38bdf8',
    exampleQuran: 'خَالِدِينَ · قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
    ruleTypes: ['tafkheem'],
    beats: {
      unit: 'درجات التفخيم',
      options: [1],
      note: 'أقوى التفخيم المفتوح وبعده ألف، وأدناه المكسور مع بقاء أصل التفخيم.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 6,
        uthmani: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        tajweedText: '[h[ٱ]هْدِنَا [h[ٱ][l[ل][k[ص]ِّ[k[ر]َ[n[ٰ][k[ط]َ [h[ٱ]لْمُسْتَ[k[ق]ِيمَ',
        focusNote: 'الصاد والراء والطاء والقاف مفخمة في «ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ» حسب درجاتها.',
      },
      {
        surahNumber: 113,
        surahName: 'الفلق',
        ayahNumber: 1,
        uthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        tajweedText: '[k[ق]ُلْ أَعُوذُ بِ[k[ر]َبِّ [h[ٱ]لْفَلَ[q[ق]ِ',
        focusNote: 'القاف المضمومة والراء المفتوحة في «قُلْ ... بِرَبِّ» مفخمتان تفخيماً ظاهراً.',
      },
    ],
    commonMistake: {
      mistake: 'ترقيق حروف الاستعلاء أو ضم الشفتين عند تفخيمها مما يغير صفاء الفتحة.',
      correction: 'رفع أقصى اللسان وتقعير وسطه مع إبقاء الشفتين في وضعهما الطبيعي.',
    },
    benefit: 'يميز الحروف المفخمة عن نظائرها المرققة (مثل ق/ك، ط/ت، ص/س).',
  },
  {
    id: 'silent',
    chapter: 'articulation',
    name: 'الحروف الصامتة (همزة الوصل واللام الشمسية)',
    nameEn: 'Silent & Wasl Letters',
    level: 'مبتدئ',
    mizan: 'تُسقط وصلاً',
    definition:
      'حروف مرسومة في المصحف ولا تُلفظ عند الوصل، مثل همزة الوصل، واللام الشمسية المدغمة، والحروف الزائدة رسماً ذات الصفر المستدير.',
    letters: ['ٱ (وصل)', 'ل (شمسية)', 'اْ / وْ (زائدة)'],
    colorHex: '#64748b',
    exampleQuran: 'بِٱلْغَيْبِ · ٱلشَّمْسِ · أُو۟لَـٰٓئِكَ',
    ruleTypes: ['silent'],
    beats: {
      unit: 'حكم الحرف',
      options: [1],
      note: 'يظهر بلون رمادي هادئ في المصحف لتنبيه القارئ إلى سقوطه في درج الكلام.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 3,
        uthmani: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        tajweedText: '[h[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h[ٱ][l[ل]رَّح[p[ِي]مِ',
        focusNote: 'اللام الشمسية في «ٱلرَّحْمَـٰنِ» و«ٱلرَّحِيمِ» صامتة تدغم في الراء، وتسقط همزة الوصل وصلاً.',
      },
      {
        surahNumber: 109,
        surahName: 'الكافرون',
        ayahNumber: 6,
        uthmani: 'لَكُمْ دِينُكُمْ وَلِىَ دِينِ',
        tajweedText: 'لَكُمْ دِينُكُمْ وَلِىَ دِينِ',
        focusNote: '', // Replaced cleanly below with a silent letter verse
      },
    ],
    commonMistake: {
      mistake: 'الوقوع في إظهار اللام الشمسية أو نطق الواو والألف التي عليها صفر مستدير.',
      correction: 'العبور السلس فوق الحرف المرمّز باللون الرمادي والالتحام المباشر بالحرف المشدد بعده.',
    },
    benefit: 'ييسر القراءة الصحيحة للرسم العثماني دون عثرات أو لحن جلي.',
  },
];

// Ensure the second example of 'ikhfa' and 'silent' both align cleanly and trigger their ruleTypes!
TAJWEED_RULES[1].examples[0] = {
  surahNumber: 94,
  surahName: 'الشرح',
  ayahNumber: 1,
  uthmani: 'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ',
  tajweedText: 'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ',
  focusNote: '',
};
// Let's make TAJWEED_RULES[1].examples[0] a genuine Ikhfa verse! Surah 113:2 مِنْ شَرِّ مَا خَلَقَ
TAJWEED_RULES[1].examples[0] = {
  surahNumber: 113,
  surahName: 'الفلق',
  ayahNumber: 2,
  uthmani: 'مِن شَرِّ مَا خَلَقَ',
  tajweedText: 'مِ[f[ن ش]َرِّ مَا خَلَقَ',
  focusNote: 'إخفاء حقيقي للنون الساكنة عند الشين في «مِن شَرِّ» بغنة بمقدار حركتين.',
};
// And TAJWEED_RULES[10] ('silent') examples[1] — Surah 107:2 فَذَٰلِكَ ٱلَّذِى يَدُعُّ ٱلْيَتِيمَ
TAJWEED_RULES[10].examples[1] = {
  surahNumber: 107,
  surahName: 'الماعون',
  ayahNumber: 2,
  uthmani: 'فَذَٰلِكَ ٱلَّذِى يَدُعُّ ٱلْيَتِيمَ',
  tajweedText: 'فَذَ[n[ٰ]لِكَ [h[ٱ]لَّذِى يَدُعُّ [h[ٱ]لْيَتِيمَ',
  focusNote: 'تسقط همزة الوصل في درج الكلام عند الانتقال إلى «ٱلَّذِى» و«ٱلْيَتِيمَ».',
};

export type MakhrajRegionId = 'jawf' | 'halq' | 'lisan' | 'shafatan' | 'khayshum';

export interface MakhrajRegion {
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

export const MAKHARIJ_REGIONS: MakhrajRegion[] = [
  {
    id: 'jawf',
    name: 'الجوف',
    subtitle: 'خلاء الحلق والفم · حروف المد',
    description:
      'الفضاء الخالي الممتد داخل الحلق والفم، وتخرج منه حروف المد الثلاثة (الألف، الواو الساكنة المضموم ما قبلها، الياء الساكنة المكسور ما قبلها).',
    colorHex: '#a855f7',
    svgHighlightArea: { cx: 145, cy: 175, rx: 42, ry: 22, labelX: 145, labelY: 162 },
  },
  {
    id: 'halq',
    name: 'الحلق',
    subtitle: '٣ مخارج فرعية · ٦ حروف',
    description:
      'ينقسم إلى أقصى الحلق (ء هـ)، ووسط الحلق (ع ح)، وأدنى الحلق (غ خ)؛ وهي حروف الإظهار الحلقي.',
    colorHex: '#0ea5e9',
    svgHighlightArea: { cx: 214, cy: 256, rx: 24, ry: 42, labelX: 214, labelY: 258 },
  },
  {
    id: 'lisan',
    name: 'اللسان',
    subtitle: '١٠ مخارج فرعية · ١٨ حرفاً',
    description:
      'أكثر المخارج تفصيلاً؛ يشمل أقصى اللسان ووسطه وحافتيه وطرفه مع الحنك واللثة وأصول الثنايا.',
    colorHex: '#10b981',
    svgHighlightArea: { cx: 132, cy: 196, rx: 48, ry: 20, labelX: 132, labelY: 198 },
  },
  {
    id: 'shafatan',
    name: 'الشفتان',
    subtitle: 'مخرجان · ٤ حروف (ف، ب، م، و)',
    description:
      'تشمل بطن الشفة السفلى مع أطراف الثنايا العليا (الفاء) والشفتين معاً انطباقاً أو انضماماً (الباء والميم والواو المتحركة).',
    colorHex: '#f59e0b',
    svgHighlightArea: { cx: 68, cy: 184, rx: 18, ry: 20, labelX: 40, labelY: 184 },
  },
  {
    id: 'khayshum',
    name: 'الخيشوم',
    subtitle: 'أعلى الأنف · صوت الغنة',
    description:
      'أعلى التجويف الأنفي المنجذب إلى داخل الفم، ومنه تخرج صفة الغنة الملازمة للنون والميم في أحوالهما.',
    colorHex: '#22c55e',
    svgHighlightArea: { cx: 118, cy: 122, rx: 38, ry: 20, labelX: 118, labelY: 122 },
  },
];

export interface ArabicLetterMakhraj {
  id: string;
  letter: string;
  name: string;
  region: MakhrajRegionId;
  subMakhraj: string;
  exampleWord: string;
  qualities: string[];
  practicalTip: string;
  point: { x: number; y: number };
}

export const ARABIC_LETTERS_MAKHARIJ: ArabicLetterMakhraj[] = [
  {
    id: 'alif',
    letter: 'ا',
    name: 'الألف المدية',
    region: 'jawf',
    subMakhraj: 'الجوف (خلاء الفم والحلق)',
    exampleWord: 'قَالَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال (يتبع ما قبله)', 'الانفتاح'],
    practicalTip: 'افتح الفك برفق واجعل الصوت يمر من الجوف بحرية؛ وتذكر أن الألف تفخم بعد المفخم وترقق بعد المرقق.',
    point: { x: 145, y: 175 },
  },
  {
    id: 'waw-madd',
    letter: 'و',
    name: 'الواو المدية / الشفوية',
    region: 'shafatan',
    subMakhraj: 'الشفتان باستدارة (والجوف للمدية)',
    exampleWord: 'يُوقِنُونَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'اللين'],
    practicalTip: 'ضم الشفتين إلى الأمام مع ترك فرجة بسيطة ليمر منها الصوت بيسر.',
    point: { x: 66, y: 186 },
  },
  {
    id: 'ya-madd',
    letter: 'ي',
    name: 'الياء',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع الحنك الأعلى',
    exampleWord: 'إِيَّاكَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'اللين'],
    practicalTip: 'ارفع وسط اللسان نحو سقف الفم مع خفض الفك السفلي عند الكسر.',
    point: { x: 136, y: 182 },
  },
  {
    id: 'hamza',
    letter: 'ء',
    name: 'الهمزة',
    region: 'halq',
    subMakhraj: 'أقصى الحلق (الحنجرة)',
    exampleWord: 'أَحَدٌ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'انطقها بلطف من الحنجرة دون ضغط حاد أو تهوع ولا تفخمها قبل المفخم.',
    point: { x: 214, y: 286 },
  },
  {
    id: 'ha-big',
    letter: 'هـ',
    name: 'الهاء',
    region: 'halq',
    subMakhraj: 'أقصى الحلق',
    exampleWord: 'ٱهْدِنَا',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الخفاء'],
    practicalTip: 'قوِّ الهاء الساكنة وعند الوقف عليها حتى لا تختفي بسبب ضعفها وخفائها.',
    point: { x: 216, y: 280 },
  },
  {
    id: 'ayn',
    letter: 'ع',
    name: 'العين',
    region: 'halq',
    subMakhraj: 'وسط الحلق',
    exampleWord: 'نَعْبُدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الانفتاح'],
    practicalTip: 'لا تبالغ في عصر وسط الحلق بل أخرجه بانسياب متوازن بين الشدة والرخاوة.',
    point: { x: 214, y: 256 },
  },
  {
    id: 'ha-small',
    letter: 'ح',
    name: 'الحاء',
    region: 'halq',
    subMakhraj: 'وسط الحلق',
    exampleWord: 'ٱلرَّحْمَـٰنِ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'أجرِ النفس من وسط الحلق بصفاء بعيداً عن بحّة الخاء.',
    point: { x: 210, y: 250 },
  },
  {
    id: 'ghayn',
    letter: 'غ',
    name: 'الغين',
    region: 'halq',
    subMakhraj: 'أدنى الحلق مما يلي الفم',
    exampleWord: 'بِٱلْغَيْبِ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الانفتاح'],
    practicalTip: 'فخّم الغين من غير شخير، وحاذر من قلقلتها إذا سكنت نحو «أَفْرِغْ».',
    point: { x: 204, y: 224 },
  },
  {
    id: 'kha',
    letter: 'خ',
    name: 'الخاء',
    region: 'halq',
    subMakhraj: 'أدنى الحلق',
    exampleWord: 'خَالِدِينَ',
    qualities: ['الهمس', 'الرخاوة', 'الاستعلاء', 'الانفتاح'],
    practicalTip: 'حافظ على استعلائها دون شخير مبالغ فيه.',
    point: { x: 198, y: 218 },
  },
  {
    id: 'qaf',
    letter: 'ق',
    name: 'القاف',
    region: 'lisan',
    subMakhraj: 'أقصى اللسان مع الحنك اللحمي',
    exampleWord: 'ٱلْفَلَقِ',
    qualities: ['الجهر', 'الشدة', 'الاستعلاء', 'الانفتاح', 'القلقلة'],
    practicalTip: 'رجّع أقصى اللسان إلى اللهاة مع الحفاظ على استعلائها وإتمام قلقلتها عند السكون.',
    point: { x: 176, y: 190 },
  },
  {
    id: 'kaf',
    letter: 'ك',
    name: 'الكاف',
    region: 'lisan',
    subMakhraj: 'أقصى اللسان أسفل مخرج القاف',
    exampleWord: 'مَـٰلِكِ',
    qualities: ['الهمس', 'الشدة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'بعد انغلاق الشدة حرر نفساً لطيفاً بالهمس ولا تخلطه بصوت السين.',
    point: { x: 162, y: 186 },
  },
  {
    id: 'jim',
    letter: 'ج',
    name: 'الجيم',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع وسط الحنك الأعلى',
    exampleWord: 'جَآءَ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    practicalTip: 'أحكم إغلاق وسط اللسان على الحنك الأعلى تماماً كي لا تفشو الجيم وتتحول إلى شين.',
    point: { x: 142, y: 180 },
  },
  {
    id: 'shin',
    letter: 'ش',
    name: 'الشين',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع سقف الحنك',
    exampleWord: 'شَرِّ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'التفشي'],
    practicalTip: 'دع الهواء يتفشى داخل الفم ولا تضم الشفتين إلى الأمام.',
    point: { x: 138, y: 183 },
  },
  {
    id: 'dad',
    letter: 'ض',
    name: 'الضاد',
    region: 'lisan',
    subMakhraj: 'حافة اللسان مع ما يحاذيها من الأضراس العليا',
    exampleWord: 'ٱلضَّآلِّينَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الإطباق', 'الاستطالة'],
    practicalTip: 'اضغط بحافتي اللسان (أو إحداهما) على الأضراس العليا ودع الصوت يستطيل إلى الأمام دون قلقلة.',
    point: { x: 128, y: 186 },
  },
  {
    id: 'lam',
    letter: 'ل',
    name: 'اللام',
    region: 'lisan',
    subMakhraj: 'أدنى حافة اللسان إلى منتهاها مع اللثة',
    exampleWord: 'ٱلْحَمْدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال (وترقيقها أصل)', 'الانحراف'],
    practicalTip: 'رقّق اللام دائماً إلا في لفظ الجلالة بعد فتح أو ضم؛ وتجنب إدغامها في النون.',
    point: { x: 108, y: 182 },
  },
  {
    id: 'nun',
    letter: 'ن',
    name: 'النون',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع لثة الثنايا + الخيشوم',
    exampleWord: 'نَعْبُدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الغنة الخيشومية'],
    practicalTip: 'للنون جزء لساني وآخر خيشومي (الغنة) فلا تحبس أنفك فتتعطل غنتها.',
    point: { x: 102, y: 180 },
  },
  {
    id: 'ra',
    letter: 'ر',
    name: 'الراء',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مائلاً لظهره مع اللثة',
    exampleWord: 'رَبِّ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الانحراف', 'التكرير (يُضبط لا يُكثَر)'],
    practicalTip: 'ثبّت طرف اللسان مع بقاء فرجة ضيقة في المنتصف كي لا يتكرر ارتعاد اللسان.',
    point: { x: 100, y: 184 },
  },
  {
    id: 'ta-emphatic',
    letter: 'ط',
    name: 'الطاء',
    region: 'lisan',
    subMakhraj: 'ظهر طرف اللسان مع أصول الثنايا العليا',
    exampleWord: 'ٱلصِّرَٰطَ',
    qualities: ['الجهر', 'الشدة', 'الاستعلاء', 'الإطباق', 'القلقلة'],
    practicalTip: 'أقوى الحروف العربية؛ امنع تسرب الهواء معه لأنه مجهور شديد.',
    point: { x: 96, y: 186 },
  },
  {
    id: 'dal',
    letter: 'د',
    name: 'الدال',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أصول الثنايا العليا',
    exampleWord: 'يَلِدْ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    practicalTip: 'رقّق الدال خاصة إذا جاورت مفخماً، وأعطها قلقلة واضحة عند سكونها.',
    point: { x: 95, y: 188 },
  },
  {
    id: 'ta-light',
    letter: 'ت',
    name: 'التاء',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أصول الثنايا العليا',
    exampleWord: 'نَسْتَعِينُ',
    qualities: ['الهمس', 'الشدة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'تجنب تحويل همس التاء إلى صوت «تس» وتأكد من انحباس الصوت أولاً ثم همس خفيف.',
    point: { x: 94, y: 190 },
  },
  {
    id: 'sad',
    letter: 'ص',
    name: 'الصاد',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع الصفحة الداخلية للثنايا السفلى',
    exampleWord: 'ٱلصَّمَدُ',
    qualities: ['الهمس', 'الرخاوة', 'الاستعلاء', 'الإطباق', 'الصفير'],
    practicalTip: 'ارفع أقصى اللسان ولا تضم الشفتين؛ ودع الصفير يخرج حاداً مفخماً.',
    point: { x: 88, y: 192 },
  },
  {
    id: 'zay',
    letter: 'ز',
    name: 'الزاي',
    region: 'lisan',
    subMakhraj: 'أسلة اللسان مع ما بين الثنايا العليا والسفلى',
    exampleWord: 'رَزَقْنَـٰهُمْ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الصفير'],
    practicalTip: 'اهتزاز الحبال الصوتية (الجهر) هو الذي يميز الزاي عن السين.',
    point: { x: 88, y: 195 },
  },
  {
    id: 'sin',
    letter: 'س',
    name: 'السين',
    region: 'lisan',
    subMakhraj: 'أسلة اللسان مع الصفحة الداخلية للثنايا السفلى',
    exampleWord: 'سِجِّيلٍ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الصفير'],
    practicalTip: 'أخلص ترقيق السين دائماً حتى لو تلاها حرف استعلاء مثل «يَسْطُونَ».',
    point: { x: 87, y: 198 },
  },
  {
    id: 'zha',
    letter: 'ظ',
    name: 'الظاء',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    exampleWord: 'ٱلْعَظِيمُ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الإطباق'],
    practicalTip: 'أخرج طرف اللسان قليلاً مع تفخيمه؛ ولا تنطقها زاياً مفخمة كما في العامية.',
    point: { x: 78, y: 186 },
  },
  {
    id: 'dhal',
    letter: 'ذ',
    name: 'الذال',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    exampleWord: 'ذَرَّةٍ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'اجعل طرف اللسان ظاهراً عند أطراف الأسنان العليا ورقّق الصوت تماماً.',
    point: { x: 77, y: 190 },
  },
  {
    id: 'tha',
    letter: 'ث',
    name: 'الثاء',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    exampleWord: 'ٱلْكَوْثَرَ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'لا تقلبها سيناً؛ بل مرّر الهواء عبر طرف اللسان وأطراف الثنايا العليا.',
    point: { x: 76, y: 193 },
  },
  {
    id: 'fa',
    letter: 'ف',
    name: 'الفاء',
    region: 'shafatan',
    subMakhraj: 'بطن الشفة السفلى مع أطراف الثنايا العليا',
    exampleWord: 'فَصَلِّ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    practicalTip: 'امنع خلط الفاء بالباء أو ضعف همسها عند السكون.',
    point: { x: 70, y: 194 },
  },
  {
    id: 'ba',
    letter: 'ب',
    name: 'الباء',
    region: 'shafatan',
    subMakhraj: 'انطباق الشفتين',
    exampleWord: 'رَبِّ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    practicalTip: 'تنطبق الشفتان ثم تنفرجان بنبرة قلقلة إذا سكنت الباء، مثل «حَبْلٍ».',
    point: { x: 64, y: 188 },
  },
  {
    id: 'mim',
    letter: 'م',
    name: 'الميم',
    region: 'khayshum',
    subMakhraj: 'الشفتان معاً + الخيشوم للغنة',
    exampleWord: 'مَلِكِ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الغنة'],
    practicalTip: 'تشترك فيها الشفتان لإغلاق الفم والخيشوم لإخراج الغنة برقة.',
    point: { x: 118, y: 122 },
  },
];

export interface SimilarLetterPair {
  id: string;
  title: string;
  differenceSummary: string;
  letterIds: string[];
  quranExample: string;
}

export const SIMILAR_LETTER_PAIRS: SimilarLetterPair[] = [
  {
    id: 'dad-zha',
    title: 'الضاد (ض) والظاء (ظ)',
    differenceSummary:
      'الضاد تخرج من حافة اللسان مع الأضراس العليا ولا يخرج اللسان فيها إلى الأمام ولها استطالة، أما الظاء فتخرج من طرف اللسان مع أطراف الثنايا العليا.',
    letterIds: ['dad', 'zha'],
    quranExample: 'وَلَا ٱلضَّآلِّينَ · وَٱلْكَاظِمِينَ ٱلْغَيْظَ',
  },
  {
    id: 'qaf-kaf',
    title: 'القاف (ق) والكاف (ك)',
    differenceSummary:
      'القاف أعمق مخرجاً ومجهورة مستعلية مقلقلة عند سكونها، أما الكاف فأقرب لمقدمة الفم ومرققة مهموسة.',
    letterIds: ['qaf', 'kaf'],
    quranExample: 'قُلْ أَعُوذُ · إِيَّاكَ نَعْبُدُ',
  },
  {
    id: 'sad-sin',
    title: 'الصاد (ص) والسين (س)',
    differenceSummary:
      'يشتركان في المخرج والهمس والصفير والرخاوة، ويتميز الصاد بارتفاع أقصى اللسان وإطباق صوته وتفخيمه.',
    letterIds: ['sad', 'sin'],
    quranExample: 'وَٱلصَّـٰفَّـٰتِ · وَٱلسَّـٰبِقُونَ',
  },
  {
    id: 'ta-dal',
    title: 'الطاء (ط) والدال (د) والتاء (ت)',
    differenceSummary:
      'جميعها من أصول الثنايا العليا؛ فالطاء مفخمة مطبقة مقلقلة، والدال مرققة مجهورة مقلقلة، والتاء مرققة مهموسة بلا قلقلة.',
    letterIds: ['ta-emphatic', 'dal', 'ta-light'],
    quranExample: 'ٱلصِّرَٰطَ · أَحَدٌ · كَتَبَ',
  },
  {
    id: 'halq-pair',
    title: 'الحاء (ح) والهاء (هـ)',
    differenceSummary:
      'الحاء تخرج من وسط الحلق بنقاء رخو مهموس، والهاء أعمق منها من أقصى الحلق وأكثر خفاءً.',
    letterIds: ['ha-small', 'ha-big'],
    quranExample: 'ٱلرَّحْمَـٰنِ · ٱهْدِنَا',
  },
];

export type QuizCategoryId = 'noon-meem' | 'madd' | 'articulation' | 'makharij';
export type TajweedQuizQuestionType = 'mcq' | 'spot-word' | 'audio';

export interface TajweedQuizQuestion {
  id: number;
  category: QuizCategoryId;
  type: TajweedQuizQuestionType;
  difficulty: 'مبتدئ' | 'متوسط' | 'متقدم';
  question: string;
  ayahSnippet?: string;
  options: string[];
  correctIndex: number;
  spotAyah?: {
    surahNumber: number;
    surahName: string;
    ayahNumber: number;
    uthmani: string;
    tajweedText: string;
    targetWordIndices: number[];
  };
  audioRef?: {
    surahNumber: number;
    surahName: string;
    ayahNumber: number;
  };
  explanation: string;
}

export const TAJWEED_QUIZ: TajweedQuizQuestion[] = [
  {
    id: 1,
    category: 'noon-meem',
    type: 'mcq',
    difficulty: 'مبتدئ',
    question: 'ما مقدار الغنة في النون والميم المشددتين مثل قوله تعالى «عَمَّ يَتَسَآءَلُونَ»؟',
    ayahSnippet: 'عَمَّ يَتَسَآءَلُونَ',
    options: ['حركة واحدة فقط', 'حركتان كاملتان', 'أربع حركات', 'ست حركات'],
    correctIndex: 1,
    explanation: 'الغنة المشددة في النون والميم تكون أكمل ما تكون بمقدار حركتين بلا زيادة أو نقصان.',
  },
  {
    id: 2,
    category: 'noon-meem',
    type: 'spot-word',
    difficulty: 'مبتدئ',
    question: 'اضغط على الكلمة التي تحتوي على حكم «إقلاب» في الآية الكريمة:',
    options: [],
    correctIndex: 0,
    spotAyah: {
      surahNumber: 104,
      surahName: 'الهمزة',
      ayahNumber: 4,
      uthmani: 'كَلَّا ۖ لَيُنۢبَذَنَّ فِى ٱلْحُطَمَةِ',
      tajweedText: 'كَلَّا ۖ لَيُ[i[نۢب]َذَ[g[نّ]َ فِى [h[ٱ]لْحُطَمَةِ',
      targetWordIndices: [2],
    },
    explanation: 'في كلمة «لَيُنۢبَذَنَّ» جاءت النون الساكنة وبعدها الباء فتنقلب إلى ميم مخفاة بغنة حركتين.',
  },
  {
    id: 3,
    category: 'madd',
    type: 'spot-word',
    difficulty: 'متقدم',
    question: 'حدد الكلمة التي تتضمن «مداً لازماً مثقلاً» مقداره 6 حركات في نهاية سورة الفاتحة:',
    options: [],
    correctIndex: 0,
    spotAyah: {
      surahNumber: 1,
      surahName: 'الفاتحة',
      ayahNumber: 7,
      uthmani: 'غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      tajweedText: 'غَيْرِ [h[ٱ]لْمَغْضُوبِ عَلَيْهِمْ وَلَا [h[ٱ][l[ل]ضّ[m[َا]ٓلّ[p[ِي]نَ',
      targetWordIndices: [4],
    },
    explanation: 'كلمة «ٱلضَّآلِّينَ» فيها ألف مدية بعدها لام مشددة فيلزم مدّها 6 حركات.',
  },
  {
    id: 4,
    category: 'articulation',
    type: 'spot-word',
    difficulty: 'مبتدئ',
    question: 'اختر الكلمة المشتملة على «قلقلة كبرى» عند الوقف في سورة الإخلاص:',
    options: [],
    correctIndex: 0,
    spotAyah: {
      surahNumber: 112,
      surahName: 'الإخلاص',
      ayahNumber: 1,
      uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      tajweedText: 'قُلْ هُوَ [h[ٱ]للَّهُ أَحَ[q[د]ٌ',
      targetWordIndices: [3],
    },
    explanation: 'تقف على الدال من «أَحَدٌ» بالسكون العارض وهي من حروف (قطب جد) فتكون قلقلة كبرى.',
  },
  {
    id: 5,
    category: 'noon-meem',
    type: 'audio',
    difficulty: 'متوسط',
    question: 'استمع لتلاوة الآية الكريمة ثم حدد الحكم التجويدي الواقع بين «فَمَن» و«يَعْمَلْ»:',
    ayahSnippet: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُۥ',
    options: ['إظهار حلقي', 'إدغام بغنة حركتين', 'إقلاب', 'مد لازم'],
    correctIndex: 1,
    audioRef: {
      surahNumber: 99,
      surahName: 'الزلزلة',
      ayahNumber: 7,
    },
    explanation: 'التقت النون الساكنة مع الياء (من حروف ينمو) فالحكم إدغام بغنة بمقدار حركتين.',
  },
  {
    id: 6,
    category: 'madd',
    type: 'audio',
    difficulty: 'متوسط',
    question: 'استمع لتلاوة سورة النصر وحدد نوع المد في كلمة «جَآءَ» ومقداره:',
    ayahSnippet: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
    options: ['مد طبيعي حركتان', 'مد واجب متصل (4 - 5 حركات)', 'مد بدل حركتان', 'مد لازم 6 حركات'],
    correctIndex: 1,
    audioRef: {
      surahNumber: 110,
      surahName: 'النصر',
      ayahNumber: 1,
    },
    explanation: 'وقع الهمز بعد حرف المد في الكلمة نفسها في «جَآءَ» فهو مد واجب متصل (4 أو 5 حركات).',
  },
  {
    id: 7,
    category: 'makharij',
    type: 'mcq',
    difficulty: 'مبتدئ',
    question: 'من أي مخرج رئيسي تخرج حروف الإظهار الستة (ء هـ ع ح غ خ)؟',
    ayahSnippet: 'وَٱنْحَرْ · أَنْعَمْتَ',
    options: ['الجوف', 'الحلق', 'الشفتان', 'الخيشوم'],
    correctIndex: 1,
    explanation: 'تخرج هذه الحروف الستة من الحلق بأقسامه الثلاثة (أقصاه ووسطه وأدناه).',
  },
  {
    id: 8,
    category: 'makharij',
    type: 'mcq',
    difficulty: 'متوسط',
    question: 'أي حرف يتميز بصفة «الاستطالة» ويخرج من حافة اللسان مع الأضراس العليا؟',
    ayahSnippet: 'غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    options: ['الظاء (ظ)', 'الضاد (ض)', 'الصاد (ص)', 'الذال (ذ)'],
    correctIndex: 1,
    explanation: 'الاستطالة صفة يختص بها حرف الضاد حيث يمتد الصوت من مؤخرة الحافة إلى مقدمها.',
  },
];
