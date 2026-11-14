export interface TajweedRule {
  id: string;
  name: string;
  nameEn: string;
  colorHex: string;
  cssClass: string;
  category: 'ghunnah' | 'ikhfa' | 'idgham' | 'qalqalah' | 'madd' | 'tafkheem' | 'silent';
  definition: string;
  letters: string[];
  mizan: string; // e.g. "حركتان", "4-5 حركات"
  exampleQuran: string;
  exampleExplanation: string;
  benefit: string;
}

export const TAJWEED_RULES: TajweedRule[] = [
  {
    id: 'ghunnah',
    name: 'الغُنّة المشددة',
    nameEn: 'Ghunnah',
    colorHex: '#10b981',
    cssClass: 'tajweed-ghunnah',
    category: 'ghunnah',
    definition: 'صوت رخيم يخرج من الخيشوم ملازم للنون والميم المشددتين بمقدار حركتين.',
    letters: ['نّ', 'مّ'],
    mizan: 'حركتان (كالقبض والبسط)',
    exampleQuran: 'إِنَّ ٱلَّذِينَ كَفَرُوا۟ / عَمَّ يَتَسَآءَلُونَ',
    exampleExplanation: 'النطق بصوت الغنة من الخيشوم دون زيادة أو نقصان مع الحفاظ على التشديد.',
    benefit: 'إعطاء الحرف كمال حقه الصوتي وعدم الإسراع فيه.'
  },
  {
    id: 'ikhfa',
    name: 'الإخفاء الحقيقي والشفوي',
    nameEn: 'Ikhfa (Concealment)',
    colorHex: '#4ade80',
    cssClass: 'tajweed-ikhfa',
    category: 'ikhfa',
    definition: 'النطق بالحرف بصفة بين الإظهار والإدغام عارٍ عن التشديد مع بقاء الغنة.',
    letters: ['ص', 'ذ', 'ث', 'ك', 'ج', 'ش', 'ق', 'س', 'د', 'ط', 'ز', 'ف', 'ت', 'ض', 'ظ'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'مِن قَبْلِ / كُنتُمْ / هُم بِمُؤْمِنِينَ',
    exampleExplanation: 'ستر مخرج النون الساكنة أو الميم الساكنة عند الباء مع إبقاء الغنة بمقدار حركتين.',
    benefit: 'سلاسة الانتقال الصوتي وتزيين القراءة بالرنين الخيشومي الهادئ.'
  },
  {
    id: 'idgham',
    name: 'الإدغام بغنة والإدغام الشفوي',
    nameEn: 'Idgham with Ghunnah',
    colorHex: '#2dd4bf',
    cssClass: 'tajweed-idgham',
    category: 'idgham',
    definition: 'إدخال النون الساكنة أو التنوين في حروف (ي ن م و) أو الميم الساكنة في مثلها مع بقاء الغنة حركتين.',
    letters: ['ي', 'ن', 'م', 'و (ينمو)'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'مَن يَقُولُ / هُدًۭى مِّن / وَأَنتُم مُّعْرِضُونَ',
    exampleExplanation: 'تُدغم النون أو التنوين في الحرف التالي مع ظهور الغنة من الخيشوم، أما الإدغام بغير غنة (في اللام والراء) فتسقط النون بالكلية.',
    benefit: 'التخفيف والانسجام اللساني الفصيح.'
  },
  {
    id: 'iqlab',
    name: 'الإقلاب',
    nameEn: 'Iqlab (Conversion to Meem)',
    colorHex: '#34d399',
    cssClass: 'tajweed-iqlab',
    category: 'idgham',
    definition: 'قلب النون الساكنة أو التنوين ميماً مخفاة بغنة حركتين عند ملاقاة حرف الباء.',
    letters: ['ب (مع ميم صغيرة ۢ)'],
    mizan: 'حركتان بغنة',
    exampleQuran: 'مِۢن بَعْدِ / أَنۢبِئْهُم / أَلِيمٌۢ بِمَا',
    exampleExplanation: 'تُنطق النون ميماً مع تقليل انطباق الشفتين وإظهار الغنة رقيقة.',
    benefit: 'سهولة النطق وتجانس الأصوات بين النون والباء.'
  },
  {
    id: 'qalqalah',
    name: 'القلقلة (صغرى وكبرى)',
    nameEn: 'Qalqalah (Echoing)',
    colorHex: '#38bdf8',
    cssClass: 'tajweed-qalqalah',
    category: 'qalqalah',
    definition: 'اضطراب الصوت عند النطق بالحرف الساكن حتى يُسمع له نبرة قوية تميزه.',
    letters: ['ق', 'ط', 'ب', 'ج', 'د (قطب جد)'],
    mizan: 'نبرة صوتية اضطرابية سريعة',
    exampleQuran: 'ٱلْفَلَقِ ﴿١﴾ / تَبَّتْ يَدَآ أَبِى لَهَبٍ وَتَبَّ / رَزَقْنَٰهُمْ',
    exampleExplanation: 'تكون كبرى عند الوقف على الحرف المشدد أو المخفف، وصغرى في وسط الكلمة أو الكلام.',
    benefit: 'بيان صفة الشدة والجهر في الحرف وعدم ضياعه.'
  },
  {
    id: 'madd-wajib',
    name: 'المد المتصل والمنفصل (الأحمر)',
    nameEn: 'Madd Wajib & Jaiz (4-5 Counts)',
    colorHex: '#f43f5e',
    cssClass: 'tajweed-madd-wajib',
    category: 'madd',
    definition: 'إطالة الصوت بحرف المد إذا جاء بعده همز في كلمة واحدة (متصل) أو كلمتين (منفصل).',
    letters: ['ا', 'و', 'ي'],
    mizan: '4 إلى 5 حركات (المتصل واجب، والمنفصل جائز)',
    exampleQuran: 'جَآءَ / سُوٓءَ / بِمَآ أُنزِلَ / ٱلسَّمَآءِ',
    exampleExplanation: 'مد الصوت بزمن متساوٍ يملأ النفس خشوعاً ويزين الترتيل.',
    benefit: 'التأني والتمكين المعنوي لكلمات التعظيم والنداء والوحي.'
  },
  {
    id: 'madd-lazim',
    name: 'المد اللازم (الأحمر القاني)',
    nameEn: 'Madd Lazim (6 Counts)',
    colorHex: '#ef4444',
    cssClass: 'tajweed-madd-lazim',
    category: 'madd',
    definition: 'أن يأتي بعد حرف المد سكون أصلي لازم وصلاً ووقفاً في كلمة أو في حرف هجائي.',
    letters: ['ا', 'و', 'ي'],
    mizan: '6 حركات مشبعة وجوباً',
    exampleQuran: 'وَلَا ٱلضَّآلِّينَ / ٱلصَّآخَّةُ / الٓمٓ / قٓ',
    exampleExplanation: 'أطول المدود في القرآن، يُمد 6 حركات كاملة دون تسرع.',
    benefit: 'هيبة الكلمة وجلال معناها في مواقف الفصل والإنذار وفواتح السور.'
  },
  {
    id: 'madd-arid',
    name: 'المد العارض للسكون (البرتقالي)',
    nameEn: 'Madd Arid lis-Sukoon',
    colorHex: '#fb923c',
    cssClass: 'tajweed-madd-arid',
    category: 'madd',
    definition: 'أن يقع بعد حرف المد سكون عارض لأجل الوقف على أواخر الكلمات والآيات.',
    letters: ['ا', 'و', 'ي'],
    mizan: '2 أو 4 أو 6 حركات (جوازاً عند الوقف)',
    exampleQuran: 'ٱلْعَٰلَمِينَ ﴿٢﴾ / ٱلرَّحِيمِ ﴿٣﴾ / نَسْتَعِينُ ﴿٥﴾',
    exampleExplanation: 'يمد حركتين كالقصر أو أربعاً كتوسط أو ستاً كطول عند الوقوف على رأس الآية.',
    benefit: 'تنسيق أزمنة القراءة وإعطاء فواصل الآيات جمالها وهدوءها.'
  },
  {
    id: 'madd-tabeei',
    name: 'المد الطبيعي ومد البدل (الذهبي الكموني)',
    nameEn: 'Madd Tabeei & Badal (2 Counts)',
    colorHex: '#eab308',
    cssClass: 'tajweed-madd-tabeei',
    category: 'madd',
    definition: 'مد بمقدار حركتين في الألف الخنجرية، أو حين يتقدم الهمز على حرف المد في كلمة واحدة (البدل).',
    letters: ['ٰ (ألف خنجرية)', 'آ (ءَا)', 'إِي', 'أُو'],
    mizan: 'حركتان في رواية حفص',
    exampleQuran: 'ٱلصَّلَوٰةَ / ٱلرَّحْمَٰنِ / ءَامَنُوا۟ / ذَٰلِكَ',
    exampleExplanation: 'يمد بمقدار حركتين فقط دون زيادة أو نقصان؛ وفي كلمة ﴿ٱلصَّلَوٰةَ﴾ تكون الواو رسماً صامتاً والألف الخنجرية فوقها هي الممدودة.',
    benefit: 'استقامة التلاوة وصحة ضبط الحروف الخنجرية ومدود البدل.'
  },
  {
    id: 'tafkheem',
    name: 'التفخيم والاستعلاء (الأزرق الداكن)',
    nameEn: 'Tafkheem (Emphatic letters)',
    colorHex: '#60a5fa',
    cssClass: 'tajweed-tafkheem',
    category: 'tafkheem',
    definition: 'سِمن يدخل على صوت الحرف حتى يمتلئ الفم بصداه، في حروف الاستعلاء وبعض أحوال الراء ولام لفظ الجلالة.',
    letters: ['خ', 'ص', 'ض', 'غ', 'ط', 'ق', 'ظ (خص ضغط قظ)'],
    mizan: 'حسب مرتبة الحرف (المفتوح بعده ألف، ثم المفتوح، إلخ)',
    exampleQuran: 'خَٰلِدِينَ / ٱلصِّرَٰطَ / ٱلظَّٰلِمِينَ / قَالَ',
    exampleExplanation: 'رفع أقصى اللسان إلى الحنك الأعلى وتوجيه الصوت للأعلى.',
    benefit: 'فخامة الجرس اللغوي القرآني وتمييز الحروف القوية من الضعيفة.'
  },
  {
    id: 'silent',
    name: 'حروف لا تُلفظ وإدغام بلا غنة (الرمادي)',
    nameEn: 'Silent & Completely Assimilated Letters',
    colorHex: '#94a3b8',
    cssClass: 'tajweed-silent',
    category: 'silent',
    definition: 'حروف تُكتب في الرسم العثماني ولكنها تسقط في النطق: كهمزة الوصل وصلاً، واللام الشمسية، والألف الفارقة، والنون المدغمة إدغاماً كاملاً بغير غنة في اللام والراء.',
    letters: ['ٱ (همزة الوصل)', 'ل (اللام الشمسية)', 'ا۟ (الألف الفارقة)', 'و۟ / ي۟', 'نْ ← ل / ر'],
    mizan: 'تسقط في النطق (لا تُلفظ)',
    exampleQuran: 'وَٱلَّذِينَ / كَفَرُوا۟ / أُو۟لَٰٓئِكَ / مِن رَّبِّهِمْ / قَد تَّبَيَّنَ',
    exampleExplanation: 'تُلوّن بالرمادي لتنبيه القارئ إلى تجاوزها وعدم نطقها أثناء الوصل.',
    benefit: 'صيانة اللسان عن اللحن الجلي وتصحيح قراءة الرسم العثماني.'
  }
];

export interface TajweedQuizQuestion {
  id: number;
  question: string;
  ayahSnippet: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ruleCategory: string;
}

export const TAJWEED_QUIZ: TajweedQuizQuestion[] = [
  {
    id: 1,
    question: 'ما هو حكم النون الساكنة في قوله تعالى: ﴿مِن بَعْدِ﴾؟',
    ayahSnippet: 'مِن بَعْدِ مَآ جَآءَتْهُمُ ٱلْبَيِّنَاتُ',
    options: ['إظهار حلقي', 'إقلاب (قلب النون ميماً مع الغنة)', 'إدغام بغنة', 'إخفاء حقيقي'],
    correctIndex: 1,
    explanation: 'تقلب النون الساكنة أو التنوين ميماً مخفاة بغنة حركتين إذا جاء بعدها حرف الباء، وتوضع ميم قائمة صغيرة (ۢ) بالمصحف.',
    ruleCategory: 'ikhfa'
  },
  {
    id: 2,
    question: 'كم عدد حركات المد اللازم في قوله تعالى: ﴿وَلَا ٱلضَّآلِّينَ﴾؟',
    ayahSnippet: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    options: ['حركتان', '4 حركات', '6 حركات وجوباً', 'يجوز فيه الوجهان'],
    correctIndex: 2,
    explanation: 'المد اللازم الكلمي المثقل يمد بمقدار 6 حركات مشبعة وجوباً عند جميع القراء لمجيء السكون الأصلي بعد حرف المد.',
    ruleCategory: 'madd'
  },
  {
    id: 3,
    question: 'أي من الحروف الآتية هو أحد حروف القلقلة (قطب جد)؟',
    ayahSnippet: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ﴿١﴾ ٱللَّهُ ٱلصَّمَدُ ﴿٢﴾',
    options: ['الدال (د)', 'السين (س)', 'الراء (ر)', 'الحاء (ح)'],
    correctIndex: 0,
    explanation: 'حروف القلقلة خمسة مجموعة في جملة (قَطْبُ جَدٍّ)، وعند الوقف عليها في ﴿أَحَدْ﴾ تقلقل قلقلة كبرى واضحة.',
    ruleCategory: 'qalqalah'
  },
  {
    id: 4,
    question: 'ما حكم الميم المشددة في قوله تعالى: ﴿عَمَّ يَتَسَآءَلُونَ﴾؟',
    ayahSnippet: 'عَمَّ يَتَسَآءَلُونَ ﴿١﴾ عَنِ النَّبَإِ الْعَظِيمِ',
    options: ['إخفاء شفوي', 'غنة مشددة بمقدار حركتين', 'إدغام مثلين', 'إظهار مطلق'],
    correctIndex: 1,
    explanation: 'النون والميم المشددتان حكمهما الغنة المشددة بمقدار حركتين وصلاً ووقفاً، وصوتها يخرج من الخيشوم.',
    ruleCategory: 'ghunnah'
  }
];
