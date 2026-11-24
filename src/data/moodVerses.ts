export interface MoodVerse {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  arabicText: string;
  tafsirHint: string;
  tafsirHintEn?: string;
  reflection: string;
  reflectionEn?: string;
}

export interface MoodVerseCategory {
  id: string;
  title: string;
  titleEn?: string;
  iconName: 'HeartHandshake' | 'ShieldAlert' | 'Activity' | 'Sparkles' | 'Sun';
  description: string;
  descriptionEn?: string;
  verses: MoodVerse[];
}

export const MOOD_CATEGORIES: MoodVerseCategory[] = [
  {
    id: 'sadness',
    title: 'عند الحزن والضيق',
    titleEn: 'In Sadness & Distress',
    iconName: 'HeartHandshake',
    description: 'آيات تجبر الكسر وتذكّر القلوب بأن رحمة الله أقرب إليها من أنفاسها.',
    descriptionEn: 'Verses that mend broken hearts and remind souls that Allah’s mercy is nearer than their breath.',
    verses: [
      {
        surahNumber: 94,
        surahName: 'الشرح',
        ayahNumber: 5,
        arabicText: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
        tafsirHint: 'مع كل شدة وضيق يسران من الله قريبان لا يتأخران، ولن يغلب عسر واحد يسرين.',
        tafsirHintEn: 'With every hardship come two eases from Allah—never delayed; one hardship can never overcome two eases.',
        reflection: 'العسر محاط باليسر في اللحظة نفسها؛ تلمّس ألطاف الله الخفية داخل محنتك.',
        reflectionEn: 'Ease accompanies hardship in the very same moment; look for Allah’s gentle kindness hidden inside your trial.',
      },
      {
        surahNumber: 93,
        surahName: 'الضحى',
        ayahNumber: 3,
        arabicText: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ',
        tafsirHint: 'ما تركك ربك يا محمد وما أبغضك حين تأخر عنك الوحي، بل عنايته بك دائمة.',
        tafsirHintEn: 'Your Lord has neither forsaken you nor is displeased when revelation paused; His care remains constant.',
        reflection: 'تأخر الإجابة أو مرور الغمامة لا يعني التخلي عنك؛ ربك يدبر لك ما لا تدركه الآن.',
        reflectionEn: 'A delayed answer or passing cloud does not mean abandonment; your Lord arranges good beyond what you see.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 286,
        arabicText: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
        tafsirHint: 'لا يحمّل الله نفساً فوق طاقتها وقدرتها في الدين ولا في البلاء.',
        tafsirHintEn: 'Allah does not burden any soul beyond what it can bear in faith or in trial.',
        reflection: 'كل اختبار تمُر به قد قدّر الله فيك القوة لتجاوزه؛ استعن به ولا تستسلم.',
        reflectionEn: 'Every test you face comes with the strength Allah placed within you to endure it; seek His help and persevere.',
      },
    ],
  },
  {
    id: 'anxiety',
    title: 'عند الخوف والقلق',
    titleEn: 'In Fear & Anxiety',
    iconName: 'ShieldAlert',
    description: 'رسائل ربانية تزرع الأمان وتطرد وساوس المستقبل.',
    descriptionEn: 'Divine reassurances that plant serenity and dispel fears about tomorrow.',
    verses: [
      {
        surahNumber: 9,
        surahName: 'التوبة',
        ayahNumber: 40,
        arabicText: 'لَا تَحْزَنْ إِنَّ ٱللَّهَ مَعَنَا',
        tafsirHint: 'كلمة النبي ﷺ لصاحبه في الغار؛ فمن كان الله معه بالحفظ والنصر فلا خوف عليه.',
        tafsirHintEn: 'The Prophet’s ﷺ words to his companion in the cave: whoever has Allah’s protection and aid has nothing to fear.',
        reflection: 'معية الله الخاصة تغلق أبواب القلق مهما اشتدت الأسباب الظاهرة.',
        reflectionEn: 'Allah’s special companionship closes the doors of anxiety, however overwhelming outward circumstances appear.',
      },
      {
        surahNumber: 65,
        surahName: 'الطلاق',
        ayahNumber: 3,
        arabicText: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَـٰلِغُ أَمْرِهِۦ',
        tafsirHint: 'من يعتمد بقلبه على الله كفاه ما أهمه، وأمره سبحانه نافذ لا يرد.',
        tafsirHintEn: 'Whoever relies sincerely upon Allah finds Him sufficient; His decree is always fulfilled.',
        reflection: 'خذ بالأسباب ثم اترك النتائج للوكيل الحكيم، فالمتوكل لا يخيب.',
        reflectionEn: 'Take your practical steps, then entrust the outcome to the Wise Disposer of affairs—reliance on Him never fails.',
      },
      {
        surahNumber: 20,
        surahName: 'طه',
        ayahNumber: 46,
        arabicText: 'قَالَ لَا تَخَافَآ ۖ إِنَّنِى مَعَكُمَآ أَسْمَعُ وَأَرَىٰ',
        tafsirHint: 'تثبيت من الله لموسى وهارون عليهما السلام قبل مواجهة الطاغية: أسمع قولكما وأرى حالكما.',
        tafsirHintEn: 'Allah’s reassurance to Musa and Harun before facing Pharaoh: I hear your words and see your state.',
        reflection: 'أنت مرئي ومسموع من رب العالمين في كل خطوة تخطوها.',
        reflectionEn: 'You are heard and watched over by the Lord of the Worlds with every step you take.',
      },
    ],
  },
  {
    id: 'serenity',
    title: 'لطلب السكينة والطمأنينة',
    titleEn: 'Seeking Peace & Tranquility',
    iconName: 'Activity',
    description: 'آيات تهدئ خفقان القلب وتفتح أبواب الذكر والرضا.',
    descriptionEn: 'Verses that quiet a restless heart and open the doors of remembrance and contentment.',
    verses: [
      {
        surahNumber: 13,
        surahName: 'الرعد',
        ayahNumber: 28,
        arabicText: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
        tafsirHint: 'القلوب القلقة الحائرة لا تجد راحتها الحقيقية وسكونها إلا بذكر الله وتلاوة كتابه.',
        tafsirHintEn: 'Troubled, wandering hearts find their true peace and stillness only through remembering Allah and reciting His Book.',
        reflection: 'اجعل لك ورداً هادئاً من القرآن والذكر كلما تزاحمت الأفكار في صدرك.',
        reflectionEn: 'Keep a quiet daily portion of Quran and dhikr whenever thoughts crowd your chest.',
      },
      {
        surahNumber: 48,
        surahName: 'الفتح',
        ayahNumber: 4,
        arabicText: 'هُوَ ٱلَّذِىٓ أَنزَلَ ٱلسَّكِينَةَ فِى قُلُوبِ ٱلْمُؤْمِنِينَ لِيَزْدَادُوٓا۟ إِيمَـٰنًا مَّعَ إِيمَـٰنِهِمْ',
        tafsirHint: 'السكينة منحة ربانية ينزلها الله على قلوب عباده وقت الاضطراب لتثبت وتزداد يقيناً.',
        tafsirHintEn: 'Serenity (Sakinah) is a divine gift Allah sends into believers’ hearts in times of turmoil to steady and deepen their faith.',
        reflection: 'اطلب السكينة من منزلها في السجود، فالسكون الحقيقي عطاء من السماء.',
        reflectionEn: 'Ask the Sender of Serenity during prostration; true inner calm is a gift from above.',
      },
      {
        surahNumber: 2,
        surahName: 'البقرة',
        ayahNumber: 186,
        arabicText: 'وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ',
        tafsirHint: 'لم يقل سبحانه فقل إني قريب، بل أجاب مباشرة: فإني قريب بلا واسطة ولا حجاب.',
        tafsirHintEn: 'Allah did not say “Tell them I am near,” but answered directly: “I am near”—with no barrier or intermediary.',
        reflection: 'رفع اليدين والمناجاة الصادقة أقصر طريق من همّك إلى رحمة الله.',
        reflectionEn: 'Raising your hands in sincere supplication is the shortest path from worry to Allah’s mercy.',
      },
    ],
  },
  {
    id: 'hope',
    title: 'عند الندم وطلب الرجاء',
    titleEn: 'In Regret & Hope',
    iconName: 'Sparkles',
    description: 'بشائر مغفرة الله التي تحيي الأمل مهما عظمت الزلات.',
    descriptionEn: 'Glad tidings of Allah’s forgiveness that revive hope regardless of past slips.',
    verses: [
      {
        surahNumber: 39,
        surahName: 'الزمر',
        ayahNumber: 53,
        arabicText: 'قُلْ يَـٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا',
        tafsirHint: 'نداء لطيف للمسرفين في الذنوب بألا ييأسوا، فمن تاب غفر الله ذنوبه كلها.',
        tafsirHintEn: 'A tender call to those who wronged themselves never to despair—for whoever turns back, Allah forgives all sins.',
        reflection: 'باب التوبة مفتوح على مصراعيه ما دام في العمر بقية؛ عُد إلى الله مطمئناً.',
        reflectionEn: 'The door of repentance remains wide open while life breathes; return to Allah with a peaceful heart.',
      },
      {
        surahNumber: 12,
        surahName: 'يوسف',
        ayahNumber: 87,
        arabicText: 'وَلَا تَا۟يْـَٔسُوا۟ مِن رَّوْحِ ٱللَّهِ ۖ إِنَّهُۥ لَا يَا۟يْـَٔسُ مِن رَّوْحِ ٱللَّهِ إِلَّا ٱلْقَوْمُ ٱلْكَـٰفِرُونَ',
        tafsirHint: 'لا تقطعوا رجاءكم من فرج الله ورحمته مهما اشتدت الكربات وتطاول البلاء.',
        tafsirHintEn: 'Never lose hope in Allah’s relief and soothing mercy, no matter how prolonged the hardship.',
        reflection: 'ما بين ليلة وضحاها يغيّر الله الأقدار كما جمع شمل يعقوب بيوسف عليهما السلام.',
        reflectionEn: 'From one night to the next, Allah transforms destinies—just as He reunited Yaqub with Yusuf.',
      },
    ],
  },
  {
    id: 'gratitude',
    title: 'عند الفرح والشكر والتوكل',
    titleEn: 'In Joy, Gratitude & Trust',
    iconName: 'Sun',
    description: 'آيات تقيّد النعم بالشكر وتزيد البركة والانشراح.',
    descriptionEn: 'Verses that preserve blessings through gratitude and expand peace and barakah.',
    verses: [
      {
        surahNumber: 14,
        surahName: 'إبراهيم',
        ayahNumber: 7,
        arabicText: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
        tafsirHint: 'وعد رباني مؤكد بأن شكر النعم بالقلب واللسان والعمل سبب لزيادتها وثباتها.',
        tafsirHintEn: 'A firm divine promise that gratitude in heart, tongue, and action brings increase and preservation of blessings.',
        reflection: 'احمد الله على كل نعمة تراها أو لا تراها، وأنفق مما آتاك لتدوم البركة.',
        reflectionEn: 'Thank Allah for every blessing seen and unseen, and share from what He gave you so barakah endures.',
      },
      {
        surahNumber: 10,
        surahName: 'يونس',
        ayahNumber: 58,
        arabicText: 'قُلْ بِفَضْلِ ٱللَّهِ وَبِرَحْمَتِهِۦ فَبِذَٰلِكَ فَلْيَفْرَحُوا۟ هُوَ خَيْرٌ مِّمَّا يَجْمَعُونَ',
        tafsirHint: 'أحق ما يُفرح به في الدنيا نعمة الهداية والقرآن والرحمة لا حطام الدنيا الفاني.',
        tafsirHintEn: 'What truly merits joy in this world is Allah’s grace, guidance, and the Quran—far better than fleeting wealth.',
        reflection: 'أعظم فرحة تدوم هي أن يوفقك الله لآية تهدي قلبك وطاعة تقربك منه.',
        reflectionEn: 'The most enduring joy is being guided to a verse that lights your heart and an act of obedience that draws you near.',
      },
    ],
  },
];

export function getMoodCategoryTitle(cat: MoodVerseCategory, lang: 'ar' | 'en'): string {
  return lang === 'en' ? cat.titleEn || cat.title : cat.title;
}

export function getMoodCategoryDescription(cat: MoodVerseCategory, lang: 'ar' | 'en'): string {
  return lang === 'en' ? cat.descriptionEn || cat.description : cat.description;
}

export function getMoodVerseTafsirHint(verse: MoodVerse, lang: 'ar' | 'en'): string {
  return lang === 'en' ? verse.tafsirHintEn || verse.tafsirHint : verse.tafsirHint;
}

export function getMoodVerseReflection(verse: MoodVerse, lang: 'ar' | 'en'): string {
  return lang === 'en' ? verse.reflectionEn || verse.reflection : verse.reflection;
}
