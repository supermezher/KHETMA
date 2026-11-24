import { TajweedRuleType } from '../utils/tajweedParser';

export type TajweedChapterId = 'noon-sakinah' | 'meem-ghunnah' | 'madd' | 'articulation';

export const TAJWEED_CHAPTERS: {
  id: TajweedChapterId;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
}[] = [
  {
    id: 'noon-sakinah',
    title: 'النون الساكنة والتنوين',
    titleEn: 'Noon Sakinah & Tanween',
    description: 'أحكام الإدغام والإخفاء والإقلاب والإظهار',
    descriptionEn: 'Rules of Idgham, Ikhfa, Iqlab & Idhhar',
  },
  {
    id: 'meem-ghunnah',
    title: 'الميم والغنة المشددة',
    titleEn: 'Meem & Mushaddadah Ghunnah',
    description: 'أحكام الغنة المشددة والإخفاء والإدغام الشفويين',
    descriptionEn: 'Mushaddadah Ghunnah, Labial Ikhfa & Labial Idgham',
  },
  {
    id: 'madd',
    title: 'أحكام المدود',
    titleEn: 'Rules of Elongation (Madd)',
    description: 'المد الطبيعي والواجب واللازم والعارض والبدل',
    descriptionEn: 'Natural, Obligatory, Necessary, Pause & Exchange Madd',
  },
  {
    id: 'articulation',
    title: 'القلقلة والتفخيم والصامت',
    titleEn: 'Qalqalah, Tafkheem & Silent Letters',
    description: 'صفات القلقلة والاستعلاء والحروف التي لا تُلفظ',
    descriptionEn: 'Echoing bounce, heavy articulation & silent letters',
  },
];

export interface TajweedRule {
  id: string;
  chapter: TajweedChapterId;
  name: string;
  nameEn: string;
  level: string;
  levelEn?: string;
  mizan: string;
  mizanEn?: string;
  definition: string;
  definitionEn?: string;
  letters: string[];
  colorHex: string;
  exampleQuran: string;
  ruleTypes: TajweedRuleType[];
  beats: {
    unit: string;
    unitEn?: string;
    options: number[];
    note: string;
    noteEn?: string;
  };
  examples: {
    surahNumber: number;
    surahName: string;
    ayahNumber: number;
    uthmani: string;
    tajweedText: string;
    focusNote: string;
    focusNoteEn?: string;
  }[];
  commonMistake: {
    mistake: string;
    mistakeEn?: string;
    correction: string;
    correctionEn?: string;
  };
  benefit: string;
  benefitEn?: string;
}

export const TAJWEED_RULES: TajweedRule[] = [
  {
    id: 'ghunnah',
    chapter: 'meem-ghunnah',
    name: 'الغنة المشددة (النون والميم)',
    nameEn: 'Mushaddadah Ghunnah (Noon & Meem)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'حركتان',
    mizanEn: '2 counts',
    definition:
      'صوت لذيذ يخرج من الخيشوم لا عمل للسان فيه، يظهر بأكمل درجاته في النون والميم المشددتين.',
    definitionEn:
      'A pleasant nasal resonance emerging from the nasal passage (Khayshum) with no tongue action, clearest on doubled Noon (نّ) and Meem (مّ).',
    letters: ['نّ', 'مّ'],
    colorHex: '#10b981',
    exampleQuran: 'إِنَّا أَعْطَيْنَاكَ · عَمَّ يَتَسَاءَلُونَ',
    ruleTypes: ['ghunnah'],
    beats: {
      unit: 'حركات الغنة',
      unitEn: 'Ghunnah counts',
      options: [2],
      note: 'تُضبط الغنة بمقدار حركتين كاملتين بهدوء وانسياب دون تقطيع.',
      noteEn: 'Hold the nasal resonance calmly for two full counts without clipping.',
    },
    examples: [
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 1,
        uthmani: 'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
        tajweedText: 'إِ[g[نّ]َ[o[آ] أَعْطَيْنَ[n[ـٰ]كَ [h[ٱ]لْكَوْثَرَ',
        focusNote: 'تظهر الغنة بوضوح في النون المشددة من كلمة «إِنَّآ» بمقدار حركتين.',
        focusNoteEn: 'Clear 2-count ghunnah appears on the doubled Noon (نّ) in “إِنَّآ”.',
      },
      {
        surahNumber: 78,
        surahName: 'النبأ',
        ayahNumber: 1,
        uthmani: 'عَمَّ يَتَسَآءَلُونَ',
        tajweedText: 'عَ[g[مّ]َ يَتَسَ[o[آ]ءَل[p[ُو]نَ',
        focusNote: 'الميم المشددة في «عَمَّ» تُنطق بغنة خيشومية كاملة بمقدار حركتين.',
        focusNoteEn: 'The doubled Meem (مّ) in “عَمَّ” is held with a full 2-count nasal resonance.',
      },
    ],
    commonMistake: {
      mistake: 'البتر السريع للنون أو الميم المشددتين وكأنهما حرف واحد مخفف دون إشباع الغنة.',
      mistakeEn: 'Rushing past doubled Noon or Meem as if single light letters without completing the ghunnah.',
      correction: 'إبقاء الصوت في الخيشوم زمناً لطيفاً يساوي حركتين قبل الانتقال للحرف التالي.',
      correctionEn: 'Sustain the gentle nasal sound in the Khayshum for 2 counts before moving to the next vowel.',
    },
    benefit: 'تمنح التلاوة رونقاً روحانياً وتمنع التداخل المتعجل بين الكلمات.',
    benefitEn: 'Adds serene beauty to recitation and prevents rushed blending between words.',
  },
  {
    id: 'ikhfa',
    chapter: 'noon-sakinah',
    name: 'الإخفاء الحقيقي والشفوي',
    nameEn: 'Ikhfa (True & Labial Concealment)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'حركتان',
    mizanEn: '2 counts',
    definition:
      'النطق بالنون الساكنة أو التنوين أو الميم الساكنة عند الباء بحالة وسط بين الإظهار والإدغام مع بقاء الغنة.',
    definitionEn:
      'Pronouncing Noon Sakinah, Tanween, or Meem Sakinah (before Ba) in a state between clear articulation and full merging while keeping a 2-count ghunnah.',
    letters: ['ص', 'ذ', 'ث', 'ك', 'ج', 'ش', 'ق', 'س', 'د', 'ط', 'ز', 'ف', 'ت', 'ض', 'ظ', 'ب (شفوي)'],
    colorHex: '#22c55e',
    exampleQuran: 'كُنتُمْ · تَرْمِيهِم بِحِجَارَةٍ',
    ruleTypes: ['ikhfa'],
    beats: {
      unit: 'حركات الإخفاء',
      unitEn: 'Ikhfa counts',
      options: [2],
      note: 'يُحافظ اللسان على التهيؤ لمخرج الحرف التالي دون إلصاق تام بمخرج النون.',
      noteEn: 'Poise the tongue near the next letter’s articulation point without pressing tightly at the Noon point.',
    },
    examples: [
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 4,
        uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: 'قُلْ هُوَ [h[ٱ]للَّهُ أَحَدٌ',
        focusNote: '',
        focusNoteEn: '',
      },
      {
        surahNumber: 105,
        surahName: 'الفيل',
        ayahNumber: 4,
        uthmani: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
        tajweedText: 'تَرْمِيهِ[c[م ب]ِحِجَارَ[a[ةٍ م]ِّ[f[ن س]ِجّ[p[ِي]لٍ',
        focusNote: 'اجتمع الإخفاء الشفوي في «تَرْمِيهِم بِحِجَارَةٍ» والإخفاء الحقيقي في «مِن سِجِّيلٍ».',
        focusNoteEn: 'Labial Ikhfa appears in “تَرْمِيهِم بِحِجَارَةٍ” and True Ikhfa in “مِن سِجِّيلٍ”.',
      },
    ],
    commonMistake: {
      mistake: 'إلصاق طرف اللسان باللثة عند الإخفاء الحقيقي فتتحول النون إلى مظهرة، أو كز الشفتين بشدة في الشفوي.',
      mistakeEn: 'Pressing the tongue tip onto the gums (turning Ikhfa into Idhhar) or clenching the lips tightly in Labial Ikhfa.',
      correction: 'تجافي طرف اللسان في الحقيقي وتلامس خفيف مرن للشفتين في الإخفاء الشفوي مع تفخيم الغنة قبل حروف الاستعلاء.',
      correctionEn: 'Hover the tongue slightly away in True Ikhfa, keep a soft lip touch in Labial Ikhfa, and thicken ghunnah before heavy letters.',
    },
    benefit: 'تحقيق الانسياب الصوتي بين النون وحروف الإخفاء الخمسة عشر دون ثقل.',
    benefitEn: 'Creates smooth phonetic transition between Noon and the 15 Ikhfa letters.',
  },
  {
    id: 'idgham',
    chapter: 'noon-sakinah',
    name: 'الإدغام بغنة (والإدغام الشفوي)',
    nameEn: 'Idgham with Ghunnah (& Labial Idgham)',
    level: 'متوسط',
    levelEn: 'Intermediate',
    mizan: 'حركتان',
    mizanEn: '2 counts',
    definition:
      'إدخال النون الساكنة أو التنوين في أحد حروف «ينمو»، أو الميم الساكنة في مثلها ليصيرا حرفاً مشدداً مع الغنة.',
    definitionEn:
      'Merging Noon Sakinah or Tanween into one of the letters “ي ن م و”, or Meem Sakinah into another Meem, becoming one doubled sound with ghunnah.',
    letters: ['ي', 'ن', 'م', 'و'],
    colorHex: '#16a34a',
    exampleQuran: 'فَمَن يَعْمَلْ · عَلَيْهِم مُّؤْصَدَةٌ',
    ruleTypes: ['idgham'],
    beats: {
      unit: 'حركات الإدغام',
      unitEn: 'Idgham counts',
      options: [2],
      note: 'تُخرج الغنة من الخيشوم في أثناء اندماج الحرف الساكن بالمتحرك.',
      noteEn: 'Let the nasal ghunnah flow smoothly as the sakinah letter merges into the following vowelized letter.',
    },
    examples: [
      {
        surahNumber: 99,
        surahName: 'الزلزلة',
        ayahNumber: 7,
        uthmani: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُۥ',
        tajweedText: 'فَمَ[a[ن ي]َعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرً[a[ا ي]َرَهُۥ',
        focusNote: 'إدغام النون الساكنة والتنوين في الياء بغنة كاملة في الموضعين.',
        focusNoteEn: 'Both Noon Sakinah and Tanween merge into Ya (ي) with full 2-count ghunnah.',
      },
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 8,
        uthmani: 'إِنَّهَا عَلَيْهِم مُّؤْصَدَةٌ',
        tajweedText: 'إِ[g[نّ]َهَا عَلَيْهِ[w[م م]ُّؤْصَدَةٌ',
        focusNote: 'إدغام الميم الساكنة في الميم المتحركة (إدغام مثلين صغير) بغنة حركتين.',
        focusNoteEn: 'Meem Sakinah merges into the following Meem (Labial Idgham) with 2 counts of ghunnah.',
      },
    ],
    commonMistake: {
      mistake: 'إسقاط الغنة تماماً عند الياء والواو أو تشديد الحرف دون مرور الصوت بالخيشوم.',
      mistakeEn: 'Dropping ghunnah completely before Ya and Waw, or pronouncing a hard shaddah without nasal resonance.',
      correction: 'إشراك الخيشوم بنسبة متوازنة في الياء والواو وإتمام الغنة في النون والميم.',
      correctionEn: 'Blend nasal resonance naturally into Ya and Waw, and complete full ghunnah for Noon and Meem.',
    },
    benefit: 'تيسير النطق بوصل الكلمتين كحرف واحد مشدد سلس الإيقاع.',
    benefitEn: 'Eases pronunciation by uniting two words into a fluid, rhythmic sound.',
  },
  {
    id: 'iqlab',
    chapter: 'noon-sakinah',
    name: 'الإقلاب',
    nameEn: 'Iqlab (Conversion)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'حركتان',
    mizanEn: '2 counts',
    definition:
      'قلب النون الساكنة أو التنوين عند ملاقاة حرف الباء إلى ميم مخفاة بغنة بمقدار حركتين.',
    definitionEn:
      'Converting Noon Sakinah or Tanween before the letter Ba (ب) into a concealed Meem accompanied by a 2-count ghunnah.',
    letters: ['ب'],
    colorHex: '#059669',
    exampleQuran: 'مِنۢ بَعْدِ · سَمِيعٌۢ بَصِيرٌ',
    ruleTypes: ['iqlab'],
    beats: {
      unit: 'حركات الإقلاب',
      unitEn: 'Iqlab counts',
      options: [2],
      note: 'الميم المقلوبة تُنطق بتلامس لطيف بين الشفتين دون ضغط عنيف.',
      noteEn: 'Pronounce the converted Meem with gentle lip contact rather than hard pressing.',
    },
    examples: [
      {
        surahNumber: 104,
        surahName: 'الهمزة',
        ayahNumber: 4,
        uthmani: 'لَيُنۢبَذَنَّ فِى ٱلْحُطَمَةِ',
        tajweedText: 'لَيُ[i[نۢب]َذَ[g[نّ]َ فِى [h[ٱ]لْحُطَمَةِ',
        focusNote: 'تُقلب النون الساكنة قبل الباء في «لَيُنۢبَذَنَّ» إلى ميم مخفاة بغنة حركتين.',
        focusNoteEn: 'Noon before Ba in “لَيُنۢبَذَنَّ” converts into a concealed Meem held for 2 counts.',
      },
      {
        surahNumber: 92,
        surahName: 'الليل',
        ayahNumber: 8,
        uthmani: 'وَأَمَّا مَنۢ بَخِلَ وَٱسْتَغْنَىٰ',
        tajweedText: 'وَأَ[g[مّ]َا مَ[i[نۢ ب]َخِلَ وَ[h[ٱ]سْتَغْنَ[n[ىٰ]',
        focusNote: 'تلتقي النون الساكنة مع الباء في «مَنۢ بَخِلَ» فتُقلب ميماً مخفاة بغنة.',
        focusNoteEn: 'Noon Sakinah meets Ba in “مَنۢ بَخِلَ” and converts to a concealed Meem with ghunnah.',
      },
    ],
    commonMistake: {
      mistake: 'الضغط الشديد على الشفتين عند قلب النون ميماً مما يولد غنة مكتومة أو زائدة.',
      mistakeEn: 'Over-squeezing the lips when converting Noon to Meem, causing a muffled or strained nasal tone.',
      correction: 'تطبيق الشفتين برفق مع استمرار الغنة حركتين ثم فتحهما على الباء.',
      correctionEn: 'Bring the lips together gently for 2 counts of ghunnah, then release smoothly into Ba.',
    },
    benefit: 'تسهيل الانتقال من مخرج النون اللساني إلى الباء الشفوية عبر الميم المشتركة.',
    benefitEn: 'Bridges the tongue-tip Noon smoothly to the labial Ba via the shared labial Meem.',
  },
  {
    id: 'qalqalah',
    chapter: 'articulation',
    name: 'القلقلة (قطب جد)',
    nameEn: 'Qalqalah (ق ط ب ج د)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'نبضة فورية',
    mizanEn: 'Crisp echo',
    definition:
      'اضطراب الحرف الساكن عند النطق به حتى يُسمع له نبرة قوية، وتكون كبرى عند الوقف وصغرى وسط الكلمة.',
    definitionEn:
      'A clear echoing bounce upon releasing a quiescent letter from (ق ط ب ج د)—lighter mid-word (Sughra) and stronger at a pause (Kubra).',
    letters: ['ق', 'ط', 'ب', 'ج', 'د'],
    colorHex: '#f59e0b',
    exampleQuran: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ · لَمْ يَلِدْ',
    ruleTypes: ['qalqalah'],
    beats: {
      unit: 'درجة القلقلة',
      unitEn: 'Qalqalah level',
      options: [1],
      note: 'القلقلة الصغرى وسط الكلام والكبرى عند الوقف على السكون أو المشدد.',
      noteEn: 'Notice the crisp bounce without adding any extra vowel sound after the consonant.',
    },
    examples: [
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 1,
        uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        tajweedText: 'قُلْ هُوَ [h[ٱ]للَّهُ أَحَ[q[د]ٌ',
        focusNote: 'قلقلة الدال الموقوف عليها في «أَحَدٌ» (قلقلة كبرى واضحة).',
        focusNoteEn: 'Pausing on Dal in “أَحَدٌ” produces a strong Major Qalqalah.',
      },
      {
        surahNumber: 112,
        surahName: 'الإخلاص',
        ayahNumber: 3,
        uthmani: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        tajweedText: 'لَمْ يَلِ[q[دْ] وَلَمْ يُولَ[q[دْ]',
        focusNote: 'الدال الساكنة في «يَلِدْ» قلقلة صغرى وصلاً وكبرى عند الوقف على «يُولَدْ».',
        focusNoteEn: 'Dal in “يَلِدْ” carries Minor Qalqalah in speech and Major Qalqalah on stopping at “يُولَدْ”.',
      },
    ],
    commonMistake: {
      mistake: 'إمالة صوت القلقلة نحو الفتحة أو الضمة أو الكسرة، أو إنهاؤها بهمزة مختلسة.',
      mistakeEn: 'Tilting the echo toward an unwanted Fatha/Damma/Kasra vowel, or cutting it abruptly with a Hamza.',
      correction: 'انفكاك طرفي المخرج بتصادم ثم تباعد نقي دون تشريبها حركة أخرى.',
      correctionEn: 'Release the articulation organs cleanly with pure consonant resonance and no added vowel.',
    },
    benefit: 'تحافظ على وضوح حروف الشدة والجهر الساكنة فلا تضيع معالمها.',
    benefitEn: 'Keeps stopped voiced plosive letters crisp and audible when sukooned.',
  },
  {
    id: 'madd-wajib',
    chapter: 'madd',
    name: 'المد الواجب المتصل والمنفصل',
    nameEn: 'Madd Wajib & Jaiz (Connected & Separated)',
    level: 'متوسط',
    levelEn: 'Intermediate',
    mizan: '٤ - ٥ حركات',
    mizanEn: '4–5 counts',
    definition:
      'أن يأتي بعد حرف المد همز في الكلمة نفسها (متصل 4-5 حركات وجوباً) أو في أول الكلمة التالية (منفصل 4-5 حركات لحفص من الشاطبية).',
    definitionEn:
      'A Madd letter followed by a Hamza in the same word (Obligatory Connected: 4–5 counts) or at the start of the next word (Permissible Separated: 4–5 counts).',
    letters: ['آ', 'وٓ', 'ىٓ'],
    colorHex: '#ef4444',
    exampleQuran: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ · إِنَّآ أَعْطَيْنَـٰكَ',
    ruleTypes: ['madd-wajib'],
    beats: {
      unit: 'حركات المد',
      unitEn: 'Madd counts',
      options: [4, 5],
      note: 'يُحافظ القارئ على توازن مقداره (4 أو 5 حركات) طوال التلاوة.',
      noteEn: 'Maintain a steady length of 4 or 5 counts consistently throughout recitation.',
    },
    examples: [
      {
        surahNumber: 110,
        surahName: 'النصر',
        ayahNumber: 1,
        uthmani: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
        tajweedText: 'إِذَا جَ[o[آ]ءَ نَصْرُ [h[ٱ]للَّهِ وَ[h[ٱ]لْفَتْحُ',
        focusNote: 'مد واجب متصل في كلمة «جَآءَ» بمقدار 4 أو 5 حركات.',
        focusNoteEn: 'Obligatory Connected Madd in “جَآءَ” sustained for 4 or 5 counts.',
      },
      {
        surahNumber: 108,
        surahName: 'الكوثر',
        ayahNumber: 1,
        uthmani: 'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
        tajweedText: 'إِ[g[نّ]َ[o[آ] أَعْطَيْنَ[n[ـٰ]كَ [h[ٱ]لْكَوْثَرَ',
        focusNote: 'مد جائز منفصل بين «إِنَّآ» و«أَعْطَيْنَاكَ» يمد 4-5 حركات بالتوسط.',
        focusNoteEn: 'Separated Madd between “إِنَّآ” and “أَعْطَيْنَـٰكَ” stretched smoothly for 4–5 counts.',
      },
    ],
    commonMistake: {
      mistake: 'تقصير المد الواجب المتصل إلى حركتين أو عدم التسوية بين المدود المتماثلة.',
      mistakeEn: 'Shortening Obligatory Madd to 2 counts or varying lengths inconsistently across verses.',
      correction: 'التزام ميزان ثابت (أربع حركات مثلاً) في جميع المواضع المتشابهة في القراءة.',
      correctionEn: 'Commit to one steady measure (such as 4 counts) across all comparable occurrences.',
    },
    benefit: 'يمنح النفس اتساعاً لحمل معنى الهمزة التي بعد المد ويبرز جلال الألفاظ.',
    benefitEn: 'Prepares the breath gracefully for the Hamza and highlights the majesty of the wording.',
  },
  {
    id: 'madd-lazim',
    chapter: 'madd',
    name: 'المد اللازم المشبع',
    nameEn: 'Madd Lazim (Necessary 6-Count Elongation)',
    level: 'متقدم',
    levelEn: 'Advanced',
    mizan: '٦ حركات',
    mizanEn: '6 counts',
    definition:
      'أن يأتي بعد حرف المد سكون أصلي لازم وصلاً ووقفاً سواء في كلمة مشددة أو في فواتح السور.',
    definitionEn:
      'A Madd letter followed by a permanent Sukoon (or Shaddah), whether within a word or opening Surah letters—always 6 full counts.',
    letters: ['آ + شدّة/سكون', 'الحروف المقطعة'],
    colorHex: '#dc2626',
    exampleQuran: 'وَلَا ٱلضَّآلِّينَ · ٱلْحَآقَّةُ',
    ruleTypes: ['madd-lazim'],
    beats: {
      unit: 'حركات الإشباع',
      unitEn: 'Full Madd counts',
      options: [6],
      note: 'يُلزم مدّه ست حركات كاملة بلا نقصان عند جميع القراء.',
      noteEn: 'Must be elongated to a full 6 counts by consensus of all reciters.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 7,
        uthmani: 'وَلَا ٱلضَّآلِّينَ',
        tajweedText: 'وَلَا [h[ٱ][l[ل]ضّ[m[َا]ٓلّ[p[ِي]نَ',
        focusNote: 'مد لازم كلمي مثقل في الألف قبل اللام المشددة من «ٱلضَّآلِّينَ» (6 حركات).',
        focusNoteEn: 'Heavy Word Madd Lazim on the Alif before the doubled Lam in “ٱلضَّآلِّينَ” (6 counts).',
      },
      {
        surahNumber: 69,
        surahName: 'الحاقة',
        ayahNumber: 1,
        uthmani: 'ٱلْحَآقَّةُ',
        tajweedText: '[h[ٱ]لْح[m[َا]ٓقَّةُ',
        focusNote: 'مد لازم كلمي مثقل في الألف من «ٱلْحَآقَّةُ» بمقدار 6 حركات.',
        focusNoteEn: 'Heavy Word Madd Lazim in “ٱلْحَآقَّةُ” held for 6 full counts.',
      },
    ],
    commonMistake: {
      mistake: 'تقليص المد إلى 4 حركات أو التمويج في الصوت وتسهيل الشدة التالية له.',
      mistakeEn: 'Cutting the elongation down to 4 counts, wavering the voice, or weakening the following Shaddah.',
      correction: 'مدّ الصوت باستقامة 6 حركات ثم النبر المتزن على الحرف المشدد.',
      correctionEn: 'Sustain a steady, level tone for 6 counts and land firmly on the doubled consonant.',
    },
    benefit: 'يمكن القارئ من التخلص من التقاء الساكنين مع إظهار هيبة المطلع القرآني.',
    benefitEn: 'Separates consecutive sukoons smoothly while conveying awe and clarity.',
  },
  {
    id: 'madd-arid',
    chapter: 'madd',
    name: 'المد العارض للسكون',
    nameEn: 'Madd Arid Lil-Sukun (Pause Madd)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: '٢ / ٤ / ٦ حركات',
    mizanEn: '2 / 4 / 6 counts',
    definition:
      'أن يقع بعد حرف المد حرف أخير متحرك سُكن للوقف عليه في آخر الآية أو الكلمة.',
    definitionEn:
      'When a final vowelized letter is made quiescent due to pausing right after a Madd letter at the end of a verse or phrase.',
    letters: ['ا / و / ي قبل الحرف الموقوف عليه'],
    colorHex: '#fb923c',
    exampleQuran: 'ٱلْعَـٰلَمِينَ · نَسْتَعِينُ',
    ruleTypes: ['madd-arid'],
    beats: {
      unit: 'أوجه الوقف',
      unitEn: 'Pause count options',
      options: [2, 4, 6],
      note: 'يجوز فيه القصر (2) والتوسط (4) والطول (6)، والأرجح التزام وجه واحد في الجلسة.',
      noteEn: 'Permits 2, 4, or 6 counts on stopping—best to keep one consistent choice per sitting.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 2,
        uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        tajweedText: '[h[ٱ]لْحَمْدُ لِلَّهِ رَبِّ [h[ٱ]لْعَ[n[ـٰ]لَم[p[ِي]نَ',
        focusNote: 'الياء في «ٱلْعَـٰلَمِينَ» عند الوقف مد عارض للسكون يُمد 2 أو 4 أو 6 حركات.',
        focusNoteEn: 'Pausing on “ٱلْعَـٰلَمِينَ” makes the Ya a Pause Madd of 2, 4, or 6 counts.',
      },
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 5,
        uthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        tajweedText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَع[p[ِي]نُ',
        focusNote: 'الوقف على «نَسْتَعِينُ» يُظهر المد العارض للسكون مع تسكين النون.',
        focusNoteEn: 'Stopping at “نَسْتَعِينُ” softens the final Noon into sukoon with Pause Madd.',
      },
    ],
    commonMistake: {
      mistake: 'التنقل العشوائي بين القصر والطول من آية إلى أخرى في المجلس الواحد.',
      mistakeEn: 'Randomly jumping between 2 and 6 counts from one verse ending to the next.',
      correction: 'اعتماد التوسط (4 حركات) بانتظام في جميع رؤوس الآي.',
      correctionEn: 'Keep a balanced 4-count cadence consistently at verse endings.',
    },
    benefit: 'يضفي ختاماً موزوناً ومهيباً على مقاطع الآيات القرآنية.',
    benefitEn: 'Bestows a serene, balanced cadence at the close of Quranic verses.',
  },
  {
    id: 'madd-tabeei',
    chapter: 'madd',
    name: 'المد الطبيعي (الأصلي)',
    nameEn: 'Madd Tabeei (Natural Elongation)',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'حركتان',
    mizanEn: '2 counts',
    definition:
      'المد الذي لا تقوم ذات الحرف إلا به ولا يتوقف على سبب من همز أو سكون، ويمد حركتين فقط.',
    definitionEn:
      'The foundational 2-count vowel lengthening independent of Hamza or Sukoon—essential to the word’s exact sound and meaning.',
    letters: ['ا', 'و', 'ي', 'ٰ (الألف الخنجرية)'],
    colorHex: '#a855f7',
    exampleQuran: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ · ٱلصَّلَوٰةَ',
    ruleTypes: ['madd-tabeei'],
    beats: {
      unit: 'حركات المد',
      unitEn: 'Natural counts',
      options: [2],
      note: 'حركتان بالضبط؛ لا يُنقص ليصير كالفتحة ولا يُزاد فوق حقه.',
      noteEn: 'Hold for exactly 2 counts—neither clipped to a short vowel nor over-stretched.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 4,
        uthmani: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        tajweedText: 'مَ[n[ـٰ]لِكِ يَوْمِ [h[ٱ][l[ل]دّ[p[ِي]نِ',
        focusNote: 'الألف الخنجرية في «مَـٰلِكِ» تُمد مداً طبيعياً بمقدار حركتين.',
        focusNoteEn: 'The superscript Dagger Alif in “مَـٰلِكِ” is lengthened naturally for 2 counts.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 3,
        uthmani: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَـٰهُمْ يُنفِقُونَ',
        tajweedText:
          'ٱلَّذِينَ يُؤْمِنُونَ بِ[h[ٱ]لْغَيْبِ وَيُقِيمُونَ [h[ٱ][l[ل]صَّلَ[s[و][n[ٲ]ةَ وَمِ[g[مّ]َا رَزَ[q[قْ]نَ[n[ـٰ]هُمْ يُ[f[نف]ِق[p[ُو]نَ',
        focusNote: 'الألف في «رَزَقْنَـٰهُمْ» والألف فوق الواو في «ٱلصَّلَوٰةَ» تمدان حركتين.',
        focusNoteEn: 'The Dagger Alif in “رَزَقْنَـٰهُمْ” and above Waw in “ٱلصَّلَوٰةَ” each receive 2 counts.',
      },
    ],
    commonMistake: {
      mistake: 'اختلاس الألف الخنجرية أو الواو والياء المديتين في وسط الكلام فتنقلب إلى حركة قصيرة.',
      mistakeEn: 'Swallowing Dagger Alifs or mid-word long vowels so they collapse into short vowels.',
      correction: 'إعطاء كل حرف مد حقّه التام بمقدار حركتين بوضوح ويسر.',
      correctionEn: 'Give every natural long vowel its crisp, effortless 2-count duration.',
    },
    benefit: 'يحفظ استقامة أوزان الكلمات القرآنية ومعانيها الدقيقة.',
    benefitEn: 'Preserves exact Quranic word forms and prevents altering meanings.',
  },
  {
    id: 'tafkheem',
    chapter: 'articulation',
    name: 'التفخيم والاستعلاء',
    nameEn: 'Tafkheem (Heavy Articulation)',
    level: 'متوسط',
    levelEn: 'Intermediate',
    mizan: 'تغليظ الصوت',
    mizanEn: 'Full resonance',
    definition:
      'سِمَن يدخل على صوت الحرف فيمتلئ الفم بصداه، ويشمل حروف الاستعلاء السبعة (خص ضغط قظ) والراء ولام الجلالة في مواضعهما.',
    definitionEn:
      'A rich fullness of sound filling the mouth through raising the back of the tongue, covering the 7 Isti‘la letters (خ ص ض غ ط ق ظ) plus heavy Ra and Allah’s Lam.',
    letters: ['خ', 'ص', 'ض', 'غ', 'ط', 'ق', 'ظ'],
    colorHex: '#38bdf8',
    exampleQuran: 'خَالِدِينَ · قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
    ruleTypes: ['tafkheem'],
    beats: {
      unit: 'درجات التفخيم',
      unitEn: 'Heaviness guide',
      options: [1],
      note: 'أقوى التفخيم المفتوح وبعده ألف، وأدناه المكسور مع بقاء أصل التفخيم.',
      noteEn: 'Heaviest when carrying Fatha + Alif; lightest with Kasra while preserving heaviness.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 6,
        uthmani: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        tajweedText: '[h[ٱ]هْدِنَا [h[ٱ][l[ل][k[ص]ِّ[k[ر]َ[n[ٰ][k[ط]َ [h[ٱ]لْمُسْتَ[k[ق]ِيمَ',
        focusNote: 'الصاد والراء والطاء والقاف مفخمة في «ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ» حسب درجاتها.',
        focusNoteEn: 'Sad, Ra, Ta, and Qaf in “ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ” carry ranked degrees of heaviness.',
      },
      {
        surahNumber: 113,
        surahName: 'الفلق',
        ayahNumber: 1,
        uthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        tajweedText: '[k[ق]ُلْ أَعُوذُ بِ[k[ر]َبِّ [h[ٱ]لْفَلَ[q[ق]ِ',
        focusNote: 'القاف المضمومة والراء المفتوحة في «قُلْ ... بِرَبِّ» مفخمتان تفخيماً ظاهراً.',
        focusNoteEn: 'Both Qaf in “قُلْ” and Fatha-voweled Ra in “بِرَبِّ” are pronounced with clear Tafkheem.',
      },
    ],
    commonMistake: {
      mistake: 'ترقيق حروف الاستعلاء أو ضم الشفتين عند تفخيمها مما يغير صفاء الفتحة.',
      mistakeEn: 'Thinning heavy letters into light equivalents or rounding the lips artificially during Fatha.',
      correction: 'رفع أقصى اللسان وتقعير وسطه مع إبقاء الشفتين في وضعهما الطبيعي.',
      correctionEn: 'Elevate the back of the tongue while keeping the lips relaxed and unrounded.',
    },
    benefit: 'يميز الحروف المفخمة عن نظائرها المرققة (مثل ق/ك، ط/ت، ص/س).',
    benefitEn: 'Clearly distinguishes heavy consonants from light counterparts (ق/ك, ط/ت, ص/س).',
  },
  {
    id: 'silent',
    chapter: 'articulation',
    name: 'الحروف الصامتة (همزة الوصل واللام الشمسية)',
    nameEn: 'Silent & Wasl Letters',
    level: 'مبتدئ',
    levelEn: 'Beginner',
    mizan: 'تُسقط وصلاً',
    mizanEn: 'Elided in flow',
    definition:
      'حروف مرسومة في المصحف ولا تُلفظ عند الوصل، مثل همزة الوصل، واللام الشمسية المدغمة، والحروف الزائدة رسماً ذات الصفر المستدير.',
    definitionEn:
      'Letters written in the Uthmani script that are skipped in connected reading—including Hamzat al-Wasl, assimilated Solar Lam, and zero-marked silent letters.',
    letters: ['ٱ (وصل)', 'ل (شمسية)', 'اْ / وْ (زائدة)'],
    colorHex: '#64748b',
    exampleQuran: 'بِٱلْغَيْبِ · ٱلشَّمْسِ · أُو۟لَـٰٓئِكَ',
    ruleTypes: ['silent'],
    beats: {
      unit: 'حكم الحرف',
      unitEn: 'Silent rule',
      options: [1],
      note: 'يظهر بلون رمادي هادئ في المصحف لتنبيه القارئ إلى سقوطه في درج الكلام.',
      noteEn: 'Shown in muted gray in Bayan to signal skipping smoothly to the next pronounced sound.',
    },
    examples: [
      {
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 3,
        uthmani: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        tajweedText: '[h[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h[ٱ][l[ل]رَّح[p[ِي]مِ',
        focusNote: 'اللام الشمسية في «ٱلرَّحْمَـٰنِ» و«ٱلرَّحِيمِ» صامتة تدغم في الراء، وتسقط همزة الوصل وصلاً.',
        focusNoteEn: 'Solar Lam in “ٱلرَّحْمَـٰنِ” assimilates silently into Ra, and Hamzat al-Wasl elides when connected.',
      },
      {
        surahNumber: 109,
        surahName: 'الكافرون',
        ayahNumber: 6,
        uthmani: 'لَكُمْ دِينُكُمْ وَلِىَ دِينِ',
        tajweedText: 'لَكُمْ دِينُكُمْ وَلِىَ دِينِ',
        focusNote: '',
        focusNoteEn: '',
      },
    ],
    commonMistake: {
      mistake: 'الوقوع في إظهار اللام الشمسية أو نطق الواو والألف التي عليها صفر مستدير.',
      mistakeEn: 'Pronouncing a Solar Lam or sounding silent Alif/Waw marked with a circular zero.',
      correction: 'العبور السلس فوق الحرف المرمّز باللون الرمادي والالتحام المباشر بالحرف المشدد بعده.',
      correctionEn: 'Glide past the gray-marked letter directly into the doubled consonant after it.',
    },
    benefit: 'ييسر القراءة الصحيحة للرسم العثماني دون عثرات أو لحن جلي.',
    benefitEn: 'Makes reading classic Uthmani orthography fluid and error-free.',
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
  focusNoteEn: '',
};
// Let's make TAJWEED_RULES[1].examples[0] a genuine Ikhfa verse! Surah 113:2 مِنْ شَرِّ مَا خَلَقَ
TAJWEED_RULES[1].examples[0] = {
  surahNumber: 113,
  surahName: 'الفلق',
  ayahNumber: 2,
  uthmani: 'مِن شَرِّ مَا خَلَقَ',
  tajweedText: 'مِ[f[ن ش]َرِّ مَا خَلَقَ',
  focusNote: 'إخفاء حقيقي للنون الساكنة عند الشين في «مِن شَرِّ» بغنة بمقدار حركتين.',
  focusNoteEn: 'True Ikhfa of Noon Sakinah before Shin in “مِن شَرِّ” with a 2-count ghunnah.',
};
// And TAJWEED_RULES[10] ('silent') examples[1] — Surah 107:2 فَذَٰلِكَ ٱلَّذِى يَدُعُّ ٱلْيَتِيمَ
TAJWEED_RULES[10].examples[1] = {
  surahNumber: 107,
  surahName: 'الماعون',
  ayahNumber: 2,
  uthmani: 'فَذَٰلِكَ ٱلَّذِى يَدُعُّ ٱلْيَتِيمَ',
  tajweedText: 'فَذَ[n[ٰ]لِكَ [h[ٱ]لَّذِى يَدُعُّ [h[ٱ]لْيَتِيمَ',
  focusNote: 'تسقط همزة الوصل في درج الكلام عند الانتقال إلى «ٱلَّذِى» و«ٱلْيَتِيمَ».',
  focusNoteEn: 'Hamzat al-Wasl drops in connected flow into “ٱلَّذِى” and “ٱلْيَتِيمَ”.',
};

export type MakhrajRegionId = 'jawf' | 'halq' | 'lisan' | 'shafatan' | 'khayshum';

export interface MakhrajRegion {
  id: MakhrajRegionId;
  name: string;
  nameEn?: string;
  subtitle: string;
  subtitleEn?: string;
  description: string;
  descriptionEn?: string;
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
    nameEn: 'Jawf',
    subtitle: 'خلاء الحلق والفم · حروف المد',
    subtitleEn: 'Oral & Throat Cavity · Madd Letters',
    description:
      'الفضاء الخالي الممتد داخل الحلق والفم، وتخرج منه حروف المد الثلاثة (الألف، الواو الساكنة المضموم ما قبلها، الياء الساكنة المكسور ما قبلها).',
    descriptionEn:
      'The empty cavity extending through throat and mouth, from which the three Madd vowels (ا، و، ي) emerge.',
    colorHex: '#a855f7',
    svgHighlightArea: { cx: 145, cy: 175, rx: 42, ry: 22, labelX: 145, labelY: 162 },
  },
  {
    id: 'halq',
    name: 'الحلق',
    nameEn: 'Throat',
    subtitle: '٣ مخارج فرعية · ٦ حروف',
    subtitleEn: '3 Sub-points · 6 Letters',
    description:
      'ينقسم إلى أقصى الحلق (ء هـ)، ووسط الحلق (ع ح)، وأدنى الحلق (غ خ)؛ وهي حروف الإظهار الحلقي.',
    descriptionEn:
      'Divided into deepest throat (ء هـ), middle throat (ع ح), and upper throat (غ خ)—the six Throat Idhhar letters.',
    colorHex: '#0ea5e9',
    svgHighlightArea: { cx: 214, cy: 256, rx: 24, ry: 42, labelX: 214, labelY: 258 },
  },
  {
    id: 'lisan',
    name: 'اللسان',
    nameEn: 'Tongue',
    subtitle: '١٠ مخارج فرعية · ١٨ حرفاً',
    subtitleEn: '10 Sub-points · 18 Letters',
    description:
      'أكثر المخارج تفصيلاً؛ يشمل أقصى اللسان ووسطه وحافتيه وطرفه مع الحنك واللثة وأصول الثنايا.',
    descriptionEn:
      'The most detailed region, spanning root, middle, sides, and tip of the tongue meeting palate, gums, and incisors.',
    colorHex: '#10b981',
    svgHighlightArea: { cx: 132, cy: 196, rx: 48, ry: 20, labelX: 132, labelY: 198 },
  },
  {
    id: 'shafatan',
    name: 'الشفتان',
    nameEn: 'Lips',
    subtitle: 'مخرجان · ٤ حروف (ف، ب، م، و)',
    subtitleEn: '2 Sub-points · 4 Letters (ف، ب، م، و)',
    description:
      'تشمل بطن الشفة السفلى مع أطراف الثنايا العليا (الفاء) والشفتين معاً انطباقاً أو انضماماً (الباء والميم والواو المتحركة).',
    descriptionEn:
      'Includes inner lower lip with upper front teeth (ف) and both lips closing or rounding (ب، م، و).',
    colorHex: '#f59e0b',
    svgHighlightArea: { cx: 68, cy: 184, rx: 18, ry: 20, labelX: 40, labelY: 184 },
  },
  {
    id: 'khayshum',
    name: 'الخيشوم',
    nameEn: 'Nasal',
    subtitle: 'أعلى الأنف · صوت الغنة',
    subtitleEn: 'Upper Nasal Passage · Ghunnah',
    description:
      'أعلى التجويف الأنفي المنجذب إلى داخل الفم، ومنه تخرج صفة الغنة الملازمة للنون والميم في أحوالهما.',
    descriptionEn:
      'The upper nasal passage connected inside the mouth, producing the nasal resonance (ghunnah) of Noon and Meem.',
    colorHex: '#22c55e',
    svgHighlightArea: { cx: 118, cy: 122, rx: 38, ry: 20, labelX: 118, labelY: 122 },
  },
];

export interface ArabicLetterMakhraj {
  id: string;
  letter: string;
  name: string;
  nameEn?: string;
  region: MakhrajRegionId;
  subMakhraj: string;
  subMakhrajEn?: string;
  exampleWord: string;
  qualities: string[];
  qualitiesEn?: string[];
  practicalTip: string;
  practicalTipEn?: string;
  point: { x: number; y: number };
}

export const ARABIC_LETTERS_MAKHARIJ: ArabicLetterMakhraj[] = [
  {
    id: 'alif',
    letter: 'ا',
    name: 'الألف المدية',
    nameEn: 'Madd Alif',
    region: 'jawf',
    subMakhraj: 'الجوف (خلاء الفم والحلق)',
    subMakhrajEn: 'Al-Jawf (Oral & Throat Cavity)',
    exampleWord: 'قَالَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال (يتبع ما قبله)', 'الانفتاح'],
    qualitiesEn: ['Voiced', 'Continuous airflow', 'Follows preceding heaviness', 'Open mouth'],
    practicalTip: 'افتح الفك برفق واجعل الصوت يمر من الجوف بحرية؛ وتذكر أن الألف تفخم بعد المفخم وترقق بعد المرقق.',
    practicalTipEn: 'Open the jaw gently so sound flows freely from the cavity; Alif becomes heavy after heavy letters and light after light ones.',
    point: { x: 145, y: 175 },
  },
  {
    id: 'waw-madd',
    letter: 'و',
    name: 'الواو المدية / الشفوية',
    nameEn: 'Waw (Madd & Labial)',
    region: 'shafatan',
    subMakhraj: 'الشفتان باستدارة (والجوف للمدية)',
    subMakhrajEn: 'Rounded lips (and Jawf when Madd)',
    exampleWord: 'يُوقِنُونَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'اللين'],
    qualitiesEn: ['Voiced', 'Soft airflow', 'Lightness', 'Open palate', 'Softness (Lin)'],
    practicalTip: 'ضم الشفتين إلى الأمام مع ترك فرجة بسيطة ليمر منها الصوت بيسر.',
    practicalTipEn: 'Round both lips forward while leaving a small opening for smooth airflow.',
    point: { x: 66, y: 186 },
  },
  {
    id: 'ya-madd',
    letter: 'ي',
    name: 'الياء',
    nameEn: 'Ya',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع الحنك الأعلى',
    subMakhrajEn: 'Middle tongue with upper palate',
    exampleWord: 'إِيَّاكَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'اللين'],
    qualitiesEn: ['Voiced', 'Soft airflow', 'Lightness', 'Openness', 'Softness (Lin)'],
    practicalTip: 'ارفع وسط اللسان نحو سقف الفم مع خفض الفك السفلي عند الكسر.',
    practicalTipEn: 'Raise the middle of the tongue toward the palate while lowering the jaw cleanly for Kasra.',
    point: { x: 136, y: 182 },
  },
  {
    id: 'hamza',
    letter: 'ء',
    name: 'الهمزة',
    nameEn: 'Hamza',
    region: 'halq',
    subMakhraj: 'أقصى الحلق (الحنجرة)',
    subMakhrajEn: 'Deepest throat (glottis)',
    exampleWord: 'أَحَدٌ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Voiced', 'Stopped (Shiddah)', 'Lightness', 'Openness'],
    practicalTip: 'انطقها بلطف من الحنجرة دون ضغط حاد أو تهوع ولا تفخمها قبل المفخم.',
    practicalTipEn: 'Release cleanly from the glottis without harsh straining, and keep it light before heavy letters.',
    point: { x: 214, y: 286 },
  },
  {
    id: 'ha-big',
    letter: 'هـ',
    name: 'الهاء',
    nameEn: 'Ha (Deep)',
    region: 'halq',
    subMakhraj: 'أقصى الحلق',
    subMakhrajEn: 'Deepest throat',
    exampleWord: 'ٱهْدِنَا',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الخفاء'],
    qualitiesEn: ['Whispered breath', 'Soft airflow', 'Lightness', 'Openness', 'Subtlety'],
    practicalTip: 'قوِّ الهاء الساكنة وعند الوقف عليها حتى لا تختفي بسبب ضعفها وخفائها.',
    practicalTipEn: 'Support Ha clearly when quiescent or at a pause so its gentle breath sound does not vanish.',
    point: { x: 216, y: 280 },
  },
  {
    id: 'ayn',
    letter: 'ع',
    name: 'العين',
    nameEn: 'Ayn',
    region: 'halq',
    subMakhraj: 'وسط الحلق',
    subMakhrajEn: 'Middle throat',
    exampleWord: 'نَعْبُدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Voiced', 'Moderate flow (Tawassut)', 'Lightness', 'Openness'],
    practicalTip: 'لا تبالغ في عصر وسط الحلق بل أخرجه بانسياب متوازن بين الشدة والرخاوة.',
    practicalTipEn: 'Avoid over-squeezing the mid-throat; let Ayn flow naturally with balanced moderate duration.',
    point: { x: 214, y: 256 },
  },
  {
    id: 'ha-small',
    letter: 'ح',
    name: 'الحاء',
    nameEn: 'Ha (Middle Throat)',
    region: 'halq',
    subMakhraj: 'وسط الحلق',
    subMakhrajEn: 'Middle throat',
    exampleWord: 'ٱلرَّحْمَـٰنِ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Whispered breath', 'Continuous airflow', 'Lightness', 'Openness'],
    practicalTip: 'أجرِ النفس من وسط الحلق بصفاء بعيداً عن بحّة الخاء.',
    practicalTipEn: 'Let clear breath pass smoothly from the middle throat without the rasp of Kha.',
    point: { x: 210, y: 250 },
  },
  {
    id: 'ghayn',
    letter: 'غ',
    name: 'الغين',
    nameEn: 'Ghayn',
    region: 'halq',
    subMakhraj: 'أدنى الحلق مما يلي الفم',
    subMakhrajEn: 'Upper throat near the mouth',
    exampleWord: 'بِٱلْغَيْبِ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الانفتاح'],
    qualitiesEn: ['Voiced', 'Continuous flow', 'Heavy (Isti‘la)', 'Openness'],
    practicalTip: 'فخّم الغين من غير شخير، وحاذر من قلقلتها إذا سكنت نحو «أَفْرِغْ».',
    practicalTipEn: 'Keep Ghayn heavy without snoring vibration, and avoid bouncing it when quiescent (e.g., “أَفْرِغْ”).',
    point: { x: 204, y: 224 },
  },
  {
    id: 'kha',
    letter: 'خ',
    name: 'الخاء',
    nameEn: 'Kha',
    region: 'halq',
    subMakhraj: 'أدنى الحلق',
    subMakhrajEn: 'Upper throat',
    exampleWord: 'خَالِدِينَ',
    qualities: ['الهمس', 'الرخاوة', 'الاستعلاء', 'الانفتاح'],
    qualitiesEn: ['Whispered breath', 'Continuous flow', 'Heavy (Isti‘la)', 'Openness'],
    practicalTip: 'حافظ على استعلائها دون شخير مبالغ فيه.',
    practicalTipEn: 'Maintain crisp upper-throat heaviness without exaggerated rasping.',
    point: { x: 198, y: 218 },
  },
  {
    id: 'qaf',
    letter: 'ق',
    name: 'القاف',
    nameEn: 'Qaf',
    region: 'lisan',
    subMakhraj: 'أقصى اللسان مع الحنك اللحمي',
    subMakhrajEn: 'Deepest tongue with soft palate',
    exampleWord: 'ٱلْفَلَقِ',
    qualities: ['الجهر', 'الشدة', 'الاستعلاء', 'الانفتاح', 'القلقلة'],
    qualitiesEn: ['Voiced', 'Stopped', 'Heavy', 'Openness', 'Qalqalah'],
    practicalTip: 'رجّع أقصى اللسان إلى اللهاة مع الحفاظ على استعلائها وإتمام قلقلتها عند السكون.',
    practicalTipEn: 'Press the back of the tongue against the soft palate with full heaviness and clean Qalqalah when quiescent.',
    point: { x: 176, y: 190 },
  },
  {
    id: 'kaf',
    letter: 'ك',
    name: 'الكاف',
    nameEn: 'Kaf',
    region: 'lisan',
    subMakhraj: 'أقصى اللسان أسفل مخرج القاف',
    subMakhrajEn: 'Back of tongue forward of Qaf',
    exampleWord: 'مَـٰلِكِ',
    qualities: ['الهمس', 'الشدة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Light breath release', 'Stopped', 'Lightness', 'Openness'],
    practicalTip: 'بعد انغلاق الشدة حرر نفساً لطيفاً بالهمس ولا تخلطه بصوت السين.',
    practicalTipEn: 'After full closure, release a gentle breath whisper without mixing in a “s” hissing sound.',
    point: { x: 162, y: 186 },
  },
  {
    id: 'jim',
    letter: 'ج',
    name: 'الجيم',
    nameEn: 'Jeem',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع وسط الحنك الأعلى',
    subMakhrajEn: 'Middle tongue with hard palate',
    exampleWord: 'جَآءَ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    qualitiesEn: ['Voiced', 'Stopped', 'Lightness', 'Openness', 'Qalqalah'],
    practicalTip: 'أحكم إغلاق وسط اللسان على الحنك الأعلى تماماً كي لا تفشو الجيم وتتحول إلى شين.',
    practicalTipEn: 'Seal the middle of the tongue firmly to the palate so Jeem does not leak air like Shin.',
    point: { x: 142, y: 180 },
  },
  {
    id: 'shin',
    letter: 'ش',
    name: 'الشين',
    nameEn: 'Sheen',
    region: 'lisan',
    subMakhraj: 'وسط اللسان مع سقف الحنك',
    subMakhrajEn: 'Middle tongue near roof of mouth',
    exampleWord: 'شَرِّ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'التفشي'],
    qualitiesEn: ['Breath', 'Continuous flow', 'Lightness', 'Openness', 'Spread air (Tafashshi)'],
    practicalTip: 'دع الهواء يتفشى داخل الفم ولا تضم الشفتين إلى الأمام.',
    practicalTipEn: 'Let the breath spread across the mouth cavity without puckering the lips forward.',
    point: { x: 138, y: 183 },
  },
  {
    id: 'dad',
    letter: 'ض',
    name: 'الضاد',
    nameEn: 'Dad',
    region: 'lisan',
    subMakhraj: 'حافة اللسان مع ما يحاذيها من الأضراس العليا',
    subMakhrajEn: 'Side edge of tongue against upper molars',
    exampleWord: 'ٱلضَّآلِّينَ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الإطباق', 'الاستطالة'],
    qualitiesEn: ['Voiced', 'Continuous flow', 'Heavy', 'Enclosed (Itbaq)', 'Elongated slide (Istitalah)'],
    practicalTip: 'اضغط بحافتي اللسان (أو إحداهما) على الأضراس العليا ودع الصوت يستطيل إلى الأمام دون قلقلة.',
    practicalTipEn: 'Press the side of the tongue along the upper molars and glide forward smoothly without bouncing.',
    point: { x: 128, y: 186 },
  },
  {
    id: 'lam',
    letter: 'ل',
    name: 'اللام',
    nameEn: 'Lam',
    region: 'lisan',
    subMakhraj: 'أدنى حافة اللسان إلى منتهاها مع اللثة',
    subMakhrajEn: 'Front side-edges to tip of tongue against gums',
    exampleWord: 'ٱلْحَمْدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال (وترقيقها أصل)', 'الانحراف'],
    qualitiesEn: ['Voiced', 'Moderate flow', 'Light by default', 'Lateral glide (Inhiraf)'],
    practicalTip: 'رقّق اللام دائماً إلا في لفظ الجلالة بعد فتح أو ضم؛ وتجنب إدغامها في النون.',
    practicalTipEn: 'Keep Lam light always except in the name of Allah after Fatha or Damma; avoid merging it into Noon.',
    point: { x: 108, y: 182 },
  },
  {
    id: 'nun',
    letter: 'ن',
    name: 'النون',
    nameEn: 'Noon',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع لثة الثنايا + الخيشوم',
    subMakhrajEn: 'Tongue tip with upper gums + Khayshum',
    exampleWord: 'نَعْبُدُ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الغنة الخيشومية'],
    qualitiesEn: ['Voiced', 'Moderate flow', 'Lightness', 'Inherent nasal ghunnah'],
    practicalTip: 'للنون جزء لساني وآخر خيشومي (الغنة) فلا تحبس أنفك فتتعطل غنتها.',
    practicalTipEn: 'Noon combines a tongue articulation with nasal resonance—keep the nasal passage relaxed.',
    point: { x: 102, y: 180 },
  },
  {
    id: 'ra',
    letter: 'ر',
    name: 'الراء',
    nameEn: 'Ra',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مائلاً لظهره مع اللثة',
    subMakhrajEn: 'Upper side of tongue tip with upper gums',
    exampleWord: 'رَبِّ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الانحراف', 'التكرير (يُضبط لا يُكثَر)'],
    qualitiesEn: ['Voiced', 'Moderate flow', 'Slight glide', 'Controlled single tap'],
    practicalTip: 'ثبّت طرف اللسان مع بقاء فرجة ضيقة في المنتصف كي لا يتكرر ارتعاد اللسان.',
    practicalTipEn: 'Hold the tongue tip steady with a tiny central gap so it does not roll repeatedly.',
    point: { x: 100, y: 184 },
  },
  {
    id: 'ta-emphatic',
    letter: 'ط',
    name: 'الطاء',
    nameEn: 'Ta (Heavy)',
    region: 'lisan',
    subMakhraj: 'ظهر طرف اللسان مع أصول الثنايا العليا',
    subMakhrajEn: 'Top of tongue tip at roots of upper incisors',
    exampleWord: 'ٱلصِّرَٰطَ',
    qualities: ['الجهر', 'الشدة', 'الاستعلاء', 'الإطباق', 'القلقلة'],
    qualitiesEn: ['Voiced', 'Stopped', 'Heavy', 'Enclosed', 'Qalqalah'],
    practicalTip: 'أقوى الحروف العربية؛ امنع تسرب الهواء معه لأنه مجهور شديد.',
    practicalTipEn: 'The strongest Arabic letter; avoid any breathy leak since it is fully voiced and stopped.',
    point: { x: 96, y: 186 },
  },
  {
    id: 'dal',
    letter: 'د',
    name: 'الدال',
    nameEn: 'Dal',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أصول الثنايا العليا',
    subMakhrajEn: 'Tongue tip at roots of upper incisors',
    exampleWord: 'يَلِدْ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    qualitiesEn: ['Voiced', 'Stopped', 'Light', 'Open', 'Qalqalah'],
    practicalTip: 'رقّق الدال خاصة إذا جاورت مفخماً، وأعطها قلقلة واضحة عند سكونها.',
    practicalTipEn: 'Keep Dal light even next to heavy letters, and give a crisp Qalqalah when quiescent.',
    point: { x: 95, y: 188 },
  },
  {
    id: 'ta-light',
    letter: 'ت',
    name: 'التاء',
    nameEn: 'Ta (Light)',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أصول الثنايا العليا',
    subMakhrajEn: 'Tongue tip at roots of upper incisors',
    exampleWord: 'نَسْتَعِينُ',
    qualities: ['الهمس', 'الشدة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Light breath release', 'Stopped', 'Light', 'Open'],
    practicalTip: 'تجنب تحويل همس التاء إلى صوت «تس» وتأكد من انحباس الصوت أولاً ثم همس خفيف.',
    practicalTipEn: 'Avoid turning Ta’s whisper into a harsh “ts” hiss; stop cleanly first then release soft breath.',
    point: { x: 94, y: 190 },
  },
  {
    id: 'sad',
    letter: 'ص',
    name: 'الصاد',
    nameEn: 'Sad',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع الصفحة الداخلية للثنايا السفلى',
    subMakhrajEn: 'Tongue tip near inner lower incisors',
    exampleWord: 'ٱلصَّمَدُ',
    qualities: ['الهمس', 'الرخاوة', 'الاستعلاء', 'الإطباق', 'الصفير'],
    qualitiesEn: ['Breath', 'Continuous flow', 'Heavy', 'Enclosed', 'Whistle (Safeer)'],
    practicalTip: 'ارفع أقصى اللسان ولا تضم الشفتين؛ ودع الصفير يخرج حاداً مفخماً.',
    practicalTipEn: 'Elevate the back of the tongue without lip-puckering; let a crisp, full whistle emerge.',
    point: { x: 88, y: 192 },
  },
  {
    id: 'zay',
    letter: 'ز',
    name: 'الزاي',
    nameEn: 'Zay',
    region: 'lisan',
    subMakhraj: 'أسلة اللسان مع ما بين الثنايا العليا والسفلى',
    subMakhrajEn: 'Tongue apex between upper & lower incisors',
    exampleWord: 'رَزَقْنَـٰهُمْ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الصفير'],
    qualitiesEn: ['Voiced', 'Continuous flow', 'Light', 'Open', 'Whistle (Safeer)'],
    practicalTip: 'اهتزاز الحبال الصوتية (الجهر) هو الذي يميز الزاي عن السين.',
    practicalTipEn: 'Vocal cord vibration distinguishes Zay cleanly from the whispered Seen.',
    point: { x: 88, y: 195 },
  },
  {
    id: 'sin',
    letter: 'س',
    name: 'السين',
    nameEn: 'Seen',
    region: 'lisan',
    subMakhraj: 'أسلة اللسان مع الصفحة الداخلية للثنايا السفلى',
    subMakhrajEn: 'Tongue apex near inner lower incisors',
    exampleWord: 'سِجِّيلٍ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح', 'الصفير'],
    qualitiesEn: ['Breath', 'Continuous flow', 'Light', 'Open', 'Whistle (Safeer)'],
    practicalTip: 'أخلص ترقيق السين دائماً حتى لو تلاها حرف استعلاء مثل «يَسْطُونَ».',
    practicalTipEn: 'Keep Seen thoroughly light even when followed by a heavy letter like “يَسْطُونَ”.',
    point: { x: 87, y: 198 },
  },
  {
    id: 'zha',
    letter: 'ظ',
    name: 'الظاء',
    nameEn: 'Dha (Heavy)',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    subMakhrajEn: 'Tongue tip at edge of upper incisors',
    exampleWord: 'ٱلْعَظِيمُ',
    qualities: ['الجهر', 'الرخاوة', 'الاستعلاء', 'الإطباق'],
    qualitiesEn: ['Voiced', 'Continuous flow', 'Heavy', 'Enclosed'],
    practicalTip: 'أخرج طرف اللسان قليلاً مع تفخيمه؛ ولا تنطقها زاياً مفخمة كما في العامية.',
    practicalTipEn: 'Extend the tongue tip slightly to the upper teeth edge with heaviness—do not pronounce as heavy Zay.',
    point: { x: 78, y: 186 },
  },
  {
    id: 'dhal',
    letter: 'ذ',
    name: 'الذال',
    nameEn: 'Dhal (Light)',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    subMakhrajEn: 'Tongue tip at edge of upper incisors',
    exampleWord: 'ذَرَّةٍ',
    qualities: ['الجهر', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Voiced', 'Continuous flow', 'Light', 'Open'],
    practicalTip: 'اجعل طرف اللسان ظاهراً عند أطراف الأسنان العليا ورقّق الصوت تماماً.',
    practicalTipEn: 'Touch the tongue tip lightly to the upper teeth edge with pure lightness.',
    point: { x: 77, y: 190 },
  },
  {
    id: 'tha',
    letter: 'ث',
    name: 'الثاء',
    nameEn: 'Tha',
    region: 'lisan',
    subMakhraj: 'طرف اللسان مع أطراف الثنايا العليا',
    subMakhrajEn: 'Tongue tip at edge of upper incisors',
    exampleWord: 'ٱلْكَوْثَرَ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Breath', 'Continuous flow', 'Light', 'Open'],
    practicalTip: 'لا تقلبها سيناً؛ بل مرّر الهواء عبر طرف اللسان وأطراف الثنايا العليا.',
    practicalTipEn: 'Do not substitute Seen; let air pass softly between the tongue tip and upper front teeth.',
    point: { x: 76, y: 193 },
  },
  {
    id: 'fa',
    letter: 'ف',
    name: 'الفاء',
    nameEn: 'Fa',
    region: 'shafatan',
    subMakhraj: 'بطن الشفة السفلى مع أطراف الثنايا العليا',
    subMakhrajEn: 'Inner lower lip with upper front teeth',
    exampleWord: 'فَصَلِّ',
    qualities: ['الهمس', 'الرخاوة', 'الاستفال', 'الانفتاح'],
    qualitiesEn: ['Breath', 'Continuous flow', 'Light', 'Open'],
    practicalTip: 'امنع خلط الفاء بالباء أو ضعف همسها عند السكون.',
    practicalTipEn: 'Keep the airflow clear on quiescent Fa without letting it mute or sound like Ba.',
    point: { x: 70, y: 194 },
  },
  {
    id: 'ba',
    letter: 'ب',
    name: 'الباء',
    nameEn: 'Ba',
    region: 'shafatan',
    subMakhraj: 'انطباق الشفتين',
    subMakhrajEn: 'Both lips pressed together',
    exampleWord: 'رَبِّ',
    qualities: ['الجهر', 'الشدة', 'الاستفال', 'الانفتاح', 'القلقلة'],
    qualitiesEn: ['Voiced', 'Stopped', 'Light', 'Open', 'Qalqalah'],
    practicalTip: 'تنطبق الشفتان ثم تنفرجان بنبرة قلقلة إذا سكنت الباء، مثل «حَبْلٍ».',
    practicalTipEn: 'Close both lips gently and release with crisp Qalqalah when quiescent, as in “حَبْلٍ”.',
    point: { x: 64, y: 188 },
  },
  {
    id: 'mim',
    letter: 'م',
    name: 'الميم',
    nameEn: 'Meem',
    region: 'khayshum',
    subMakhraj: 'الشفتان معاً + الخيشوم للغنة',
    subMakhrajEn: 'Both lips + Khayshum for nasal resonance',
    exampleWord: 'مَلِكِ',
    qualities: ['الجهر', 'التوسط (البينية)', 'الاستفال', 'الغنة'],
    qualitiesEn: ['Voiced', 'Moderate flow', 'Light', 'Inherent Ghunnah'],
    practicalTip: 'تشترك فيها الشفتان لإغلاق الفم والخيشوم لإخراج الغنة برقة.',
    practicalTipEn: 'Close the lips softly while allowing gentle nasal resonance through the Khayshum.',
    point: { x: 118, y: 122 },
  },
];

export interface SimilarLetterPair {
  id: string;
  title: string;
  titleEn?: string;
  differenceSummary: string;
  differenceSummaryEn?: string;
  letterIds: string[];
  quranExample: string;
}

export const SIMILAR_LETTER_PAIRS: SimilarLetterPair[] = [
  {
    id: 'dad-zha',
    title: 'الضاد (ض) والظاء (ظ)',
    titleEn: 'Dad (ض) vs. Dha (ظ)',
    differenceSummary:
      'الضاد تخرج من حافة اللسان مع الأضراس العليا ولا يخرج اللسان فيها إلى الأمام ولها استطالة، أما الظاء فتخرج من طرف اللسان مع أطراف الثنايا العليا.',
    differenceSummaryEn:
      'Dad emerges from the side edge of the tongue along the upper molars without protruding forward, while Dha places the tongue tip at the upper front teeth.',
    letterIds: ['dad', 'zha'],
    quranExample: 'وَلَا ٱلضَّآلِّينَ · وَٱلْكَاظِمِينَ ٱلْغَيْظَ',
  },
  {
    id: 'qaf-kaf',
    title: 'القاف (ق) والكاف (ك)',
    titleEn: 'Qaf (ق) vs. Kaf (ك)',
    differenceSummary:
      'القاف أعمق مخرجاً ومجهورة مستعلية مقلقلة عند سكونها، أما الكاف فأقرب لمقدمة الفم ومرققة مهموسة.',
    differenceSummaryEn:
      'Qaf is deeper at the soft palate, voiced, heavy, and gets Qalqalah on sukoon; Kaf is further forward, light, and releases soft breath.',
    letterIds: ['qaf', 'kaf'],
    quranExample: 'قُلْ أَعُوذُ · إِيَّاكَ نَعْبُدُ',
  },
  {
    id: 'sad-sin',
    title: 'الصاد (ص) والسين (س)',
    titleEn: 'Sad (ص) vs. Seen (س)',
    differenceSummary:
      'يشتركان في المخرج والهمس والصفير والرخاوة، ويتميز الصاد بارتفاع أقصى اللسان وإطباق صوته وتفخيمه.',
    differenceSummaryEn:
      'Both share whistle, breath, and articulation point; Sad raises and encloses the back of the tongue for full heaviness while Seen stays light.',
    letterIds: ['sad', 'sin'],
    quranExample: 'وَٱلصَّـٰفَّـٰتِ · وَٱلسَّـٰبِقُونَ',
  },
  {
    id: 'ta-dal',
    title: 'الطاء (ط) والدال (د) والتاء (ت)',
    titleEn: 'Ta (ط), Dal (د) & Ta (ت)',
    differenceSummary:
      'جميعها من أصول الثنايا العليا؛ فالطاء مفخمة مطبقة مقلقلة، والدال مرققة مجهورة مقلقلة، والتاء مرققة مهموسة بلا قلقلة.',
    differenceSummaryEn:
      'All share the upper incisor roots: heavy Ta is enclosed with Qalqalah; Dal is light, voiced with Qalqalah; light Ta is whispered with no bounce.',
    letterIds: ['ta-emphatic', 'dal', 'ta-light'],
    quranExample: 'ٱلصِّرَٰطَ · أَحَدٌ · كَتَبَ',
  },
  {
    id: 'halq-pair',
    title: 'الحاء (ح) والهاء (هـ)',
    titleEn: 'Middle Ha (ح) vs. Deep Ha (هـ)',
    differenceSummary:
      'الحاء تخرج من وسط الحلق بنقاء رخو مهموس، والهاء أعمق منها من أقصى الحلق وأكثر خفاءً.',
    differenceSummaryEn:
      'Middle Ha flows clearly from the center of the throat, whereas Deep Ha originates lower at the glottis with a softer, subtler sound.',
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
  difficultyEn?: string;
  question: string;
  questionEn?: string;
  ayahSnippet?: string;
  options: string[];
  optionsEn?: string[];
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
  explanationEn?: string;
}

export const TAJWEED_QUIZ: TajweedQuizQuestion[] = [
  {
    id: 1,
    category: 'noon-meem',
    type: 'mcq',
    difficulty: 'مبتدئ',
    difficultyEn: 'Beginner',
    question: 'ما مقدار الغنة في النون والميم المشددتين مثل قوله تعالى «عَمَّ يَتَسَآءَلُونَ»؟',
    questionEn: 'How long is the ghunnah held on doubled Noon or Meem, as in «عَمَّ يَتَسَآءَلُونَ»?',
    ayahSnippet: 'عَمَّ يَتَسَآءَلُونَ',
    options: ['حركة واحدة فقط', 'حركتان كاملتان', 'أربع حركات', 'ست حركات'],
    optionsEn: ['1 count only', '2 full counts', '4 counts', '6 counts'],
    correctIndex: 1,
    explanation: 'الغنة المشددة في النون والميم تكون أكمل ما تكون بمقدار حركتين بلا زيادة أو نقصان.',
    explanationEn: 'Mushaddadah Ghunnah on Noon and Meem is sustained at its fullest level for exactly 2 counts.',
  },
  {
    id: 2,
    category: 'noon-meem',
    type: 'spot-word',
    difficulty: 'مبتدئ',
    difficultyEn: 'Beginner',
    question: 'اضغط على الكلمة التي تحتوي على حكم «إقلاب» في الآية الكريمة:',
    questionEn: 'Tap the word containing an «Iqlab» rule in this verse:',
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
    explanationEn: 'In «لَيُنۢبَذَنَّ», Noon Sakinah precedes Ba, converting into a concealed Meem with a 2-count ghunnah.',
  },
  {
    id: 3,
    category: 'madd',
    type: 'spot-word',
    difficulty: 'متقدم',
    difficultyEn: 'Advanced',
    question: 'حدد الكلمة التي تتضمن «مداً لازماً مثقلاً» مقداره 6 حركات في نهاية سورة الفاتحة:',
    questionEn: 'Select the word containing a «Heavy Madd Lazim» (6 counts) at the end of Surah Al-Fatihah:',
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
    explanationEn: 'The word «ٱلضَّآلِّينَ» has a Madd Alif followed by a doubled Lam, requiring a full 6-count elongation.',
  },
  {
    id: 4,
    category: 'articulation',
    type: 'spot-word',
    difficulty: 'مبتدئ',
    difficultyEn: 'Beginner',
    question: 'اختر الكلمة المشتملة على «قلقلة كبرى» عند الوقف في سورة الإخلاص:',
    questionEn: 'Tap the word demonstrating «Major Qalqalah» upon stopping in Surah Al-Ikhlas:',
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
    explanationEn: 'Stopping on final Dal in «أَحَدٌ» (one of ق ط ب ج د) produces a clear Major Qalqalah.',
  },
  {
    id: 5,
    category: 'noon-meem',
    type: 'audio',
    difficulty: 'متوسط',
    difficultyEn: 'Intermediate',
    question: 'استمع لتلاوة الآية الكريمة ثم حدد الحكم التجويدي الواقع بين «فَمَن» و«يَعْمَلْ»:',
    questionEn: 'Listen to the recitation and identify the Tajweed rule between «فَمَن» and «يَعْمَلْ»:',
    ayahSnippet: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُۥ',
    options: ['إظهار حلقي', 'إدغام بغنة حركتين', 'إقلاب', 'مد لازم'],
    optionsEn: ['Throat Idhhar', 'Idgham with Ghunnah (2 counts)', 'Iqlab', 'Madd Lazim'],
    correctIndex: 1,
    audioRef: {
      surahNumber: 99,
      surahName: 'الزلزلة',
      ayahNumber: 7,
    },
    explanation: 'التقت النون الساكنة مع الياء (من حروف ينمو) فالحكم إدغام بغنة بمقدار حركتين.',
    explanationEn: 'Noon Sakinah meets Ya (from ي ن م و), forming an Idgham with 2-count ghunnah.',
  },
  {
    id: 6,
    category: 'madd',
    type: 'audio',
    difficulty: 'متوسط',
    difficultyEn: 'Intermediate',
    question: 'استمع لتلاوة سورة النصر وحدد نوع المد في كلمة «جَآءَ» ومقداره:',
    questionEn: 'Listen to Surah An-Nasr and identify the Madd type and count in «جَآءَ»:',
    ayahSnippet: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
    options: ['مد طبيعي حركتان', 'مد واجب متصل (4 - 5 حركات)', 'مد بدل حركتان', 'مد لازم 6 حركات'],
    optionsEn: ['Natural Madd (2 counts)', 'Obligatory Connected Madd (4–5 counts)', 'Madd Badal (2 counts)', 'Madd Lazim (6 counts)'],
    correctIndex: 1,
    audioRef: {
      surahNumber: 110,
      surahName: 'النصر',
      ayahNumber: 1,
    },
    explanation: 'وقع الهمز بعد حرف المد في الكلمة نفسها في «جَآءَ» فهو مد واجب متصل (4 أو 5 حركات).',
    explanationEn: 'Hamza follows the Madd Alif within the same word «جَآءَ», making it Obligatory Connected Madd (4–5 counts).',
  },
  {
    id: 7,
    category: 'makharij',
    type: 'mcq',
    difficulty: 'مبتدئ',
    difficultyEn: 'Beginner',
    question: 'من أي مخرج رئيسي تخرج حروف الإظهار الستة (ء هـ ع ح غ خ)؟',
    questionEn: 'From which main articulation region do the six Idhhar letters (ء هـ ع ح غ خ) originate?',
    ayahSnippet: 'وَٱنْحَرْ · أَنْعَمْتَ',
    options: ['الجوف', 'الحلق', 'الشفتان', 'الخيشوم'],
    optionsEn: ['Oral Cavity (Al-Jawf)', 'Throat (Al-Halq)', 'Lips (Ash-Shafatan)', 'Nasal Passage (Al-Khayshum)'],
    correctIndex: 1,
    explanation: 'تخرج هذه الحروف الستة من الحلق بأقسامه الثلاثة (أقصاه ووسطه وأدناه).',
    explanationEn: 'All six letters emerge from the three sections of the throat (deep, middle, and upper).',
  },
  {
    id: 8,
    category: 'makharij',
    type: 'mcq',
    difficulty: 'متوسط',
    difficultyEn: 'Intermediate',
    question: 'أي حرف يتميز بصفة «الاستطالة» ويخرج من حافة اللسان مع الأضراس العليا؟',
    questionEn: 'Which letter is uniquely known for «Istitalah» (lateral glide) from the tongue edge against the upper molars?',
    ayahSnippet: 'غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    options: ['الظاء (ظ)', 'الضاد (ض)', 'الصاد (ص)', 'الذال (ذ)'],
    optionsEn: ['Dha (ظ)', 'Dad (ض)', 'Sad (ص)', 'Dhal (ذ)'],
    correctIndex: 1,
    explanation: 'الاستطالة صفة يختص بها حرف الضاد حيث يمتد الصوت من مؤخرة الحافة إلى مقدمها.',
    explanationEn: 'Istitalah is exclusive to Dad (ض), where pressure slides smoothly from back molars toward the front.',
  },
];

export function getTajweedChapterTitle(
  chapter: (typeof TAJWEED_CHAPTERS)[number],
  lang: 'ar' | 'en'
): string {
  return lang === 'en' ? chapter.titleEn : chapter.title;
}

export function getTajweedChapterDescription(
  chapter: (typeof TAJWEED_CHAPTERS)[number],
  lang: 'ar' | 'en'
): string {
  return lang === 'en' ? chapter.descriptionEn : chapter.description;
}

export function getTajweedRuleDisplayName(rule: TajweedRule, lang: 'ar' | 'en'): string {
  return lang === 'en' ? rule.nameEn : rule.name;
}

export function getTajweedRuleLevel(rule: TajweedRule, lang: 'ar' | 'en'): string {
  return lang === 'en' ? rule.levelEn || rule.level : rule.level;
}

export function getTajweedRuleMizan(rule: TajweedRule, lang: 'ar' | 'en'): string {
  return lang === 'en' ? rule.mizanEn || rule.mizan : rule.mizan;
}

export function getTajweedRuleDefinition(rule: TajweedRule, lang: 'ar' | 'en'): string {
  return lang === 'en' ? rule.definitionEn || rule.definition : rule.definition;
}

export function getTajweedRuleBenefit(rule: TajweedRule, lang: 'ar' | 'en'): string {
  return lang === 'en' ? rule.benefitEn || rule.benefit : rule.benefit;
}

export function getMakhrajRegionName(region: MakhrajRegion, lang: 'ar' | 'en'): string {
  return lang === 'en' ? region.nameEn || region.name : region.name;
}

export function getMakhrajRegionSubtitle(region: MakhrajRegion, lang: 'ar' | 'en'): string {
  return lang === 'en' ? region.subtitleEn || region.subtitle : region.subtitle;
}

export function getMakhrajRegionDescription(region: MakhrajRegion, lang: 'ar' | 'en'): string {
  return lang === 'en' ? region.descriptionEn || region.description : region.description;
}

export function getLetterMakhrajName(letter: ArabicLetterMakhraj, lang: 'ar' | 'en'): string {
  return lang === 'en' ? letter.nameEn || letter.name : letter.name;
}

export function getLetterSubMakhraj(letter: ArabicLetterMakhraj, lang: 'ar' | 'en'): string {
  return lang === 'en' ? letter.subMakhrajEn || letter.subMakhraj : letter.subMakhraj;
}

export function getLetterQualities(letter: ArabicLetterMakhraj, lang: 'ar' | 'en'): string[] {
  return lang === 'en' ? letter.qualitiesEn || letter.qualities : letter.qualities;
}

export function getLetterPracticalTip(letter: ArabicLetterMakhraj, lang: 'ar' | 'en'): string {
  return lang === 'en' ? letter.practicalTipEn || letter.practicalTip : letter.practicalTip;
}

export function getSimilarPairTitle(pair: SimilarLetterPair, lang: 'ar' | 'en'): string {
  return lang === 'en' ? pair.titleEn || pair.title : pair.title;
}

export function getSimilarPairSummary(pair: SimilarLetterPair, lang: 'ar' | 'en'): string {
  return lang === 'en' ? pair.differenceSummaryEn || pair.differenceSummary : pair.differenceSummary;
}

export function getQuizQuestionDifficulty(q: TajweedQuizQuestion, lang: 'ar' | 'en'): string {
  if (lang === 'en') {
    if (q.difficultyEn) return q.difficultyEn;
    if (q.difficulty === 'متقدم') return 'Advanced';
    if (q.difficulty === 'متوسط') return 'Intermediate';
    return 'Beginner';
  }
  return q.difficulty;
}

export function getQuizQuestionText(q: TajweedQuizQuestion, lang: 'ar' | 'en'): string {
  return lang === 'en' ? q.questionEn || q.question : q.question;
}

export function getQuizQuestionOptions(q: TajweedQuizQuestion, lang: 'ar' | 'en'): string[] {
  return lang === 'en' ? q.optionsEn || q.options : q.options;
}

export function getQuizQuestionExplanation(q: TajweedQuizQuestion, lang: 'ar' | 'en'): string {
  return lang === 'en' ? q.explanationEn || q.explanation : q.explanation;
}
