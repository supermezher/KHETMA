export interface AudioAyahRef {
  surah: number;
  ayah: number;
  label?: string;
  labelEn?: string;
}

export interface RuqyahItem {
  id: string;
  category: 'quranic' | 'prophetic' | 'sakina';
  title: string;
  titleEn?: string;
  source: string;
  sourceEn?: string;
  arabicText: string;
  repeatTarget: number;
  virtueAndFadl: string;
  virtueAndFadlEn?: string;
  hadithGrade?: string;
  hadithGradeEn?: string;
  instruction?: string;
  instructionEn?: string;
  surahNumber?: number;
  ayahNumber?: number;
  audioSequence?: AudioAyahRef[];
  isCustom?: boolean;
  createdAt?: string;
}

export interface RuqyahEtiquette {
  id: string;
  title: string;
  titleEn?: string;
  desc: string;
  descEn?: string;
}

export const RUQYAH_ETIQUETTES: RuqyahEtiquette[] = [
  {
    id: '١',
    title: 'إخلاص النية والتوكل على الله',
    titleEn: 'Sincere Intention & Reliance on Allah',
    desc: 'أن يعتقد الراقي والمرقي أن الرقية سبب شرعي لا تنفع إلا بإذن الله وقدرته، فالشافي هو الله وحده.',
    descEn: 'Both reciter and listener believe Ruqyah is a lawful means that heals only by Allah’s leave; He alone is the Healer.',
  },
  {
    id: '٢',
    title: 'أن تكون بكلام الله وأسمائه وصفاته',
    titleEn: 'Recited from the Quran & Authentic Duas',
    desc: 'أو بالأدعية النبوية المأثورة الصحيحة باللسان العربي المفهوم، بعيداً عن أي ألفاظ مبهمة أو بدعية.',
    descEn: 'Using Allah’s words, Names, Attributes, or authentic Prophetic supplications in clear speech—free from innovations.',
  },
  {
    id: '٣',
    title: 'الطهارة والوضوء واستقبال القبلة',
    titleEn: 'Purity, Wudu & Facing Qiblah',
    desc: 'يُستحب أن يكون القارئ على طهارة ووضوء، حاضراً بقلبه متدبراً معاني الآيات والأدعية التي يقرؤها.',
    descEn: 'It is recommended to be in a state of Wudu with a present heart, pondering the meanings of the verses and duas.',
  },
  {
    id: '٤',
    title: 'النفث والجمع في الكفين',
    titleEn: 'Gentle Blowing & Wiping with Palms',
    desc: 'من السنة النفث اليسير (هواء مع رذاذ خفيف جداً) في الكفين أو على موضع الألم ومسحه باليمين رجاء الشفاء.',
    descEn: 'Following the Sunnah of blowing lightly into the palms or over the area of pain and wiping with the right hand.',
  },
  {
    id: '٥',
    title: 'رقية المسلم لنفسه وأهله',
    titleEn: 'Performing Ruqyah for Oneself & Family',
    desc: 'أكمل الرقية وأبركها أن يرقي المؤمن نفسه وأبناءه مباشرة بصدق التضرع، اقتداءً بهدي النبي ﷺ.',
    descEn: 'The most complete and blessed Ruqyah is when a believer sincerely recites over themselves and their family.',
  },
  {
    id: '٦',
    title: 'اليقين وحسن الظن وعدم الاستعجال',
    titleEn: 'Certainty, Hope & Patience',
    desc: 'المداومة على الأذكار اليومية والرقية بيقين في رحمة الله دون قنوط، مع الأخذ بالأسباب الطبية المشروعة.',
    descEn: 'Persevere with daily Adhkar and Ruqyah with full trust in Allah’s mercy, alongside lawful medical care.',
  },
];

export const RUQYAH_ITEMS: RuqyahItem[] = [
  {
    id: 'q-fatiha',
    category: 'quranic',
    title: 'سورة الفاتحة (أمّ الكتاب والرقية الشافية)',
    titleEn: 'Surah Al-Fatihah (The Mother of the Book & Healing Ruqyah)',
    source: 'سورة الفاتحة · الآيات ١ - ٧',
    sourceEn: 'Surah Al-Fatihah · Verses 1–7',
    arabicText:
      'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ۝ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ ۝ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ۝ مَـٰلِكِ يَوْمِ ٱلدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ ۝ صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    repeatTarget: 7,
    virtueAndFadl:
      'أعظم سورة في القرآن وسماها النبي ﷺ «الرُّقية»، وقد رقى بها الصحابي الجليل اللديغ فبرئ بإذن الله.',
    virtueAndFadlEn:
      'The greatest Surah of the Quran, called “Ar-Ruqyah” by the Prophet ﷺ; a Companion recited it over one stung by a scorpion and he recovered by Allah’s leave.',
    hadithGrade: 'ثابت في الصحيحين',
    hadithGradeEn: 'Agreed Upon (Bukhari & Muslim)',
    instruction: 'تُقرأ بتدبر ويُنفث على موضع الألم أو في ماء طاهر.',
    instructionEn: 'Recite mindfully and blow gently over the area of pain or into pure water.',
    surahNumber: 1,
    ayahNumber: 1,
    audioSequence: [
      { surah: 1, ayah: 1, label: 'الآية ١', labelEn: 'Ayah 1' },
      { surah: 1, ayah: 2, label: 'الآية ٢', labelEn: 'Ayah 2' },
      { surah: 1, ayah: 3, label: 'الآية ٣', labelEn: 'Ayah 3' },
      { surah: 1, ayah: 4, label: 'الآية ٤', labelEn: 'Ayah 4' },
      { surah: 1, ayah: 5, label: 'الآية ٥', labelEn: 'Ayah 5' },
      { surah: 1, ayah: 6, label: 'الآية ٦', labelEn: 'Ayah 6' },
      { surah: 1, ayah: 7, label: 'الآية ٧', labelEn: 'Ayah 7' },
    ],
  },
  {
    id: 'q-kursi',
    category: 'quranic',
    title: 'آية الكرسي (سيدة آي القرآن الكريم)',
    titleEn: 'Ayat al-Kursi (Verse of the Throne)',
    source: 'سورة البقرة · الآية ٢٥٥',
    sourceEn: 'Surah Al-Baqarah · Verse 255',
    arabicText:
      'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ',
    repeatTarget: 3,
    virtueAndFadl:
      'من قرأها لم يزل عليه من الله حافظ ولا يقربه شيطان حتى يصبح، وهي حرز عظيم للنفس والبيت.',
    virtueAndFadlEn:
      'Whoever recites it has a guardian from Allah over them and no devil approaches until morning—a mighty shield for soul and home.',
    hadithGrade: 'صحيح البخاري',
    hadithGradeEn: 'Sahih Al-Bukhari',
    instruction: 'تُقرأ في الصباح والمساء وعند النوم وضمن أوراد الرقية.',
    instructionEn: 'Recite morning, evening, before sleep, and within Ruqyah sessions.',
    surahNumber: 2,
    ayahNumber: 255,
    audioSequence: [{ surah: 2, ayah: 255, label: 'آية الكرسي', labelEn: 'Ayat al-Kursi' }],
  },
  {
    id: 'q-baqarah-end',
    category: 'quranic',
    title: 'خواتيم سورة البقرة (آمن الرسول)',
    titleEn: 'Last Two Verses of Al-Baqarah',
    source: 'سورة البقرة · الآيتان ٢٨٥ - ٢٨٦',
    sourceEn: 'Surah Al-Baqarah · Verses 285–286',
    arabicText:
      'ءَامَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَ ۚ كُلٌّ ءَامَنَ بِٱللَّهِ وَمَلَـٰٓئِكَتِهِۦ وَكُتُبِهِۦ وَرُسُلِهِۦ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِۦ ۚ وَقَالُوا۟ سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ ٱلْمُصِيرُ ۝ لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ ۚ أَنتَ مَوْلَىٰنَا فَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَـٰفِرِينَ',
    repeatTarget: 1,
    virtueAndFadl:
      'قال النبي ﷺ: «الآيتان من آخر سورة البقرة، من قرأهما في ليلة كفتاه»، أي كفتاه من كل شر وسوء وآفة.',
    virtueAndFadlEn:
      'The Prophet ﷺ said: “Whoever recites the last two verses of Surah Al-Baqarah at night, they will suffice him” against every harm and evil.',
    hadithGrade: 'متفق عليه',
    hadithGradeEn: 'Agreed Upon (Bukhari & Muslim)',
    instruction: 'تُقرأ كل ليلة وفي الرقية مع استحضار معاني الدعاء في آخرها.',
    instructionEn: 'Recite nightly and during Ruqyah while reflecting on its closing supplications.',
    surahNumber: 2,
    ayahNumber: 285,
    audioSequence: [
      { surah: 2, ayah: 285, label: 'الآية ٢٨٥', labelEn: 'Ayah 285' },
      { surah: 2, ayah: 286, label: 'الآية ٢٨٦', labelEn: 'Ayah 286' },
    ],
  },
  {
    id: 'q-muawwidhat',
    category: 'quranic',
    title: 'المعوذات الثلاث (الإخلاص والفلق والناس)',
    titleEn: 'The Three Protecting Surahs (Al-Ikhlas, Al-Falaq & An-Nas)',
    source: 'سور الإخلاص والفلق والناس',
    sourceEn: 'Surahs 112, 113 & 114',
    arabicText:
      'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَـٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
    repeatTarget: 3,
    virtueAndFadl:
      'ما استعاذ متعوذ بمثلهن؛ كان النبي ﷺ يجمع كفيه عند النوم وفي المرض وينفث فيهما ويقرأ المعوذات ويمسح جسده.',
    virtueAndFadlEn:
      'Nothing equals them in seeking refuge; the Prophet ﷺ would cup his palms, blow lightly, recite them, and wipe over his body.',
    hadithGrade: 'صحيح البخاري ومسلم',
    hadithGradeEn: 'Sahih Al-Bukhari & Muslim',
    instruction: 'اجمع كفيك وانفث فيهما برفق ثم اقرأ السور الثلاث وامسح بهما الرأس والوجه وما أقبل من الجسد 3 مرات.',
    instructionEn: 'Cup both palms, blow lightly, recite the three Surahs, and wipe head, face, and body 3 times.',
    surahNumber: 112,
    ayahNumber: 1,
    audioSequence: [
      { surah: 112, ayah: 1, label: 'الإخلاص ١', labelEn: 'Al-Ikhlas 1' },
      { surah: 112, ayah: 2, label: 'الإخلاص ٢', labelEn: 'Al-Ikhlas 2' },
      { surah: 112, ayah: 3, label: 'الإخلاص ٣', labelEn: 'Al-Ikhlas 3' },
      { surah: 112, ayah: 4, label: 'الإخلاص ٤', labelEn: 'Al-Ikhlas 4' },
      { surah: 113, ayah: 1, label: 'الفلق ١', labelEn: 'Al-Falaq 1' },
      { surah: 113, ayah: 2, label: 'الفلق ٢', labelEn: 'Al-Falaq 2' },
      { surah: 113, ayah: 3, label: 'الفلق ٣', labelEn: 'Al-Falaq 3' },
      { surah: 113, ayah: 4, label: 'الفلق ٤', labelEn: 'Al-Falaq 4' },
      { surah: 113, ayah: 5, label: 'الفلق ٥', labelEn: 'Al-Falaq 5' },
      { surah: 114, ayah: 1, label: 'الناس ١', labelEn: 'An-Nas 1' },
      { surah: 114, ayah: 2, label: 'الناس ٢', labelEn: 'An-Nas 2' },
      { surah: 114, ayah: 3, label: 'الناس ٣', labelEn: 'An-Nas 3' },
      { surah: 114, ayah: 4, label: 'الناس ٤', labelEn: 'An-Nas 4' },
      { surah: 114, ayah: 5, label: 'الناس ٥', labelEn: 'An-Nas 5' },
      { surah: 114, ayah: 6, label: 'الناس ٦', labelEn: 'An-Nas 6' },
    ],
  },
  {
    id: 'q-healing-isra',
    category: 'quranic',
    title: 'آية الشفاء والرحمة للمؤمنين',
    titleEn: 'Verse of Healing & Mercy',
    source: 'سورة الإسراء · الآية ٨٢',
    sourceEn: 'Surah Al-Isra · Verse 82',
    arabicText:
      'وَنُنَزِّلُ مِنَ ٱلْقُرْءَانِ مَا هُوَ شِفَآءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ ۙ وَلَا يَزِيدُ ٱلظَّـٰلِمِينَ إِلَّا خَسَارًا',
    repeatTarget: 3,
    virtueAndFadl:
      'تذكّر القلب بأن القرآن شفاء شامل لأدواء الصدور وأسقام الأبدان لمن أقبل عليه مصدقاً موقناً.',
    virtueAndFadlEn:
      'Reminds the heart that the Quran is complete healing for ailments of both chest and body for those who receive it with certainty.',
    hadithGrade: 'قرآن كريم',
    hadithGradeEn: 'Holy Quran',
    instruction: 'اقرأها باستشعار نور القرآن وشفائه.',
    instructionEn: 'Recite while feeling the light and healing of the Quran.',
    surahNumber: 17,
    ayahNumber: 82,
    audioSequence: [{ surah: 17, ayah: 82, label: 'الإسراء ٨٢', labelEn: 'Al-Isra 82' }],
  },
  {
    id: 'p-jibril',
    category: 'prophetic',
    title: 'رقية جبريل عليه السلام للنبي ﷺ',
    titleEn: 'Jibril’s Ruqyah for the Prophet ﷺ',
    source: 'صحيح مسلم · حديث أبي سعيد الخدري',
    sourceEn: 'Sahih Muslim · Narrated by Abu Sa’id al-Khudri',
    arabicText:
      'بِاسْمِ اللهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللهُ يَشْفِيكَ، بِاسْمِ اللهِ أَرْقِيكَ',
    repeatTarget: 3,
    virtueAndFadl:
      'رقى بها أمين الوحي جبريل عليه السلام رسول الله ﷺ لما اشتكى؛ وهي جامعة شاملة للتحصين والشفاء.',
    virtueAndFadlEn:
      'Recited by Angel Jibril over the Messenger ﷺ when he felt unwell—a comprehensive prayer for protection and healing.',
    hadithGrade: 'صحيح مسلم',
    hadithGradeEn: 'Sahih Muslim',
    instruction: 'إذا رقى الإنسان نفسه يقول: «باسم الله أرقي نفسي... الله يشفيني».',
    instructionEn: 'When reciting over oneself, say: “Bismillahi arqi nafsi... Allahu yashfini.”',
  },
  {
    id: 'p-rabbinnas',
    category: 'prophetic',
    title: 'دعاء مسح موضع الألم وطلب الشفاء',
    titleEn: 'Supplication While Wiping the Area of Pain',
    source: 'متفق عليه · حديث عائشة رضي الله عنها',
    sourceEn: 'Agreed Upon · Narrated by Aishah (may Allah be pleased with her)',
    arabicText:
      'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ البَاسَ، اشْفِهِ وَأَنْتَ الشَّافِي، لا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لا يُغَادِرُ سَقَمًا',
    repeatTarget: 3,
    virtueAndFadl:
      'كان النبي ﷺ يعوّذ به بعض أهله ويمسح بيده اليمنى على المريض، وفيه تفويض الشفاء التام لله وحده.',
    virtueAndFadlEn:
      'The Prophet ﷺ recited it while wiping with his right hand over the ill, affirming that complete cure belongs to Allah alone.',
    hadithGrade: 'صحيح البخاري ومسلم',
    hadithGradeEn: 'Sahih Al-Bukhari & Muslim',
    instruction: 'ضع يدك اليمنى على موضع الألم أو الرأس وامسح مع قراءة الدعاء.',
    instructionEn: 'Place your right hand on the aching spot or head and wipe gently while reciting.',
  },
  {
    id: 'p-pain-hand',
    category: 'prophetic',
    title: 'الاستعاذة النبوية لوضع اليد على موضع الوجع',
    titleEn: 'Prophetic Refuge When Placing Hand on Pain',
    source: 'صحيح مسلم · حديث عثمان بن أبي العاص',
    sourceEn: 'Sahih Muslim · Narrated by Uthman ibn Abi al-As',
    arabicText: 'بِسْمِ اللهِ (ثلاثاً) · أَعُوذُ بِاللهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
    repeatTarget: 7,
    virtueAndFadl:
      'أرشد النبي ﷺ الصحابي حين شكا وجعاً في جسده إلى وضع يده على موضع الألم وقول «بسم الله» ثلاثاً ثم هذا الدعاء سبع مرات، فذهب ما به.',
    virtueAndFadlEn:
      'The Prophet ﷺ instructed his companion to place his hand on the pain, say “Bismillah” three times, then repeat this dua seven times.',
    hadithGrade: 'صحيح مسلم',
    hadithGradeEn: 'Sahih Muslim',
    instruction: 'ضع يدك على موضع الألم في الجسد، قل «بسم الله» 3 مرات، ثم كرر الدعاء 7 مرات.',
    instructionEn: 'Place your hand on the painful area, say Bismillah 3 times, then repeat this refuge 7 times.',
  },
  {
    id: 'p-tahsin-children',
    category: 'prophetic',
    title: 'تعويذ الأبناء والأهل بكلمات الله التامات',
    titleEn: 'Seeking Protection for Children & Family',
    source: 'صحيح البخاري · حديث ابن عباس رضي الله عنهما',
    sourceEn: 'Sahih Al-Bukhari · Narrated by Ibn Abbas',
    arabicText:
      'أُعِيذُكُمَا بِكَلِمَاتِ اللهِ التَّامَّةِ، مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    repeatTarget: 3,
    virtueAndFadl:
      'كان النبي ﷺ يعوّذ بها الحسن والحسين رضي الله عنهما ويقول: إن أباكما إبراهيم كان يعوّذ بها إسماعيل وإسحاق.',
    virtueAndFadlEn:
      'The Prophet ﷺ used this prayer to shield Al-Hasan and Al-Husayn, saying Prophet Ibrahim used it for Ismail and Ishaq.',
    hadithGrade: 'صحيح البخاري',
    hadithGradeEn: 'Sahih Al-Bukhari',
    instruction: 'يُقال بصيغة المفرد للذكر أو الأنثى أو الجمع للأبناء عند النوم والخروج.',
    instructionEn: 'Recite in singular or plural form over children at bedtime and before leaving home.',
  },
  {
    id: 'p-asalu-allah',
    category: 'prophetic',
    title: 'الدعاء السُباعي عند عيادة المريض',
    titleEn: 'Sevenfold Healing Dua When Visiting the Sick',
    source: 'سنن أبي داود والترمذي · صححه الألباني',
    sourceEn: 'Abu Dawud & At-Tirmidhi · Graded Sahih',
    arabicText: 'أَسْأَلُ اللهَ الْعَظِيمَ، رَبَّ الْعَرْشِ الْعَظِيمِ، أَنْ يَشْفِيَكَ',
    repeatTarget: 7,
    virtueAndFadl:
      'من عاد مريضاً لم يحضر أجله فقال عنده هذا الدعاء سبع مرات عافاه الله من ذلك المرض بإذنه.',
    virtueAndFadlEn:
      'Whoever visits an ill person whose appointed time has not come and says this 7 times, Allah grants recovery by His leave.',
    hadithGrade: 'صحيح · أبو داود',
    hadithGradeEn: 'Sahih · Abu Dawud',
    instruction: 'يُقرأ سبع مرات عند عيادة المريض أو على النفس (أن يشفيني).',
    instructionEn: 'Repeat 7 times when visiting the sick or for oneself (“an yashfini”).',
  },
  {
    id: 's-hasbunallah',
    category: 'sakina',
    title: 'تفويض الأمر ودعاء الشدة والكرب',
    titleEn: 'Entrusting Affairs & Supplication in Hardship',
    source: 'القرآن الكريم والصحيحان',
    sourceEn: 'Holy Quran & Authentic Sunnah',
    arabicText:
      'حَسْبُنَا ٱللَّهُ وَنِعْمَ ٱلْوَكِيلُ ۝ لَآ إِلَـٰهَ إِلَّآ أَنتَ سُبْحَـٰنَكَ إِنِّى كُنتُ مِنَ ٱلظَّـٰلِمِينَ',
    repeatTarget: 3,
    virtueAndFadl:
      'كلمة قالها إبراهيم عليه السلام حين أُلقي في النار وقالها النبي ﷺ وأصحابه، ودعاء ذي النون الذي ما دعا به مكروب إلا فرّج الله عنه.',
    virtueAndFadlEn:
      'Words spoken by Ibrahim and Muhammad ﷺ, paired with the prayer of Yunus through which no distressed person calls upon Allah except He relieves them.',
    hadithGrade: 'ثابت في القرآن والسنة',
    hadithGradeEn: 'Authentic Quran & Sunnah',
    instruction: 'ردّدها بقلب مطمئن لتفريج الهموم والقلق واستنزال السكينة.',
    instructionEn: 'Repeat calmly from the heart to relieve worry and invite tranquility.',
  },
  {
    id: 's-karb',
    category: 'sakina',
    title: 'دعاء الكرب العظيم وتهدئة الخوف',
    titleEn: 'Supplication in Deep Distress & Fear',
    source: 'متفق عليه · حديث ابن عباس',
    sourceEn: 'Agreed Upon · Narrated by Ibn Abbas',
    arabicText:
      'لَا إِلَهَ إِلَّا اللهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
    repeatTarget: 3,
    virtueAndFadl:
      'كان النبي ﷺ يدعو به عند الكرب، فيستحضر به القلب عظمة الله وربوبيته للكون كله فتسكن النفس.',
    virtueAndFadlEn:
      'The Prophet ﷺ recited this during distress, calling to mind Allah’s greatness and Lordship over the entire creation.',
    hadithGrade: 'صحيح البخاري ومسلم',
    hadithGradeEn: 'Sahih Al-Bukhari & Muslim',
    instruction: 'يُقرأ عند الضيق النفسي واضطراب الصدر مع النفس العميق والتوكل.',
    instructionEn: 'Recite during inner tightness with deep, calm breathing and trust in Allah.',
  },
  {
    id: 's-hamm',
    category: 'sakina',
    title: 'دعاء ذهاب الهم والحزن وانشراح الصدر',
    titleEn: 'Supplication to Remove Grief & Expand the Chest',
    source: 'مسند أحمد · صححه الألباني',
    sourceEn: 'Musnad Ahmad · Graded Sahih',
    arabicText:
      'اللَّهُمَّ إِنِّي عَبْدُكَ، ابْنُ عَبْدِكَ، ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ، مَاضٍ فِيَّ حُكْمُكَ، عَدْلٌ فِيَّ قَضَاؤُكَ، أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ سَمَّيْتَ بِهِ نَفْسَكَ، أَوْ عَلَّمْتَهُ أَحَدًا مِنْ خَلْقِكَ، أَوْ أَنْزَلْتَهُ فِي كِتَابِكَ، أَوِ اسْتَأْثَرْتَ بِهِ فِي عِلْمِ الْغَيْبِ عِنْدَكَ، أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي، وَنُورَ صَدْرِي، وَجَلَاءَ حُزْنِي، وَذَهَابَ هَمِّي',
    repeatTarget: 1,
    virtueAndFadl:
      'ما قاله أحد أصابه هم وحزن إلا أذهب الله همه وحزنه وأبدله مكانه فرحاً.',
    virtueAndFadlEn:
      'Whoever says this when afflicted by sorrow or anxiety, Allah removes their grief and replaces it with joy.',
    hadithGrade: 'صحيح',
    hadithGradeEn: 'Sahih',
    instruction: 'يُقرأ بخشوع عند ثقل الصدر أو الحزن والتمسك بالقرآن ربيعاً للقلب.',
    instructionEn: 'Recite humbly whenever sorrow weighs down the heart, seeking light in the Quran.',
  },
];

export function getRuqyahEtiquetteTitle(etiquette: RuqyahEtiquette, lang: 'ar' | 'en'): string {
  return lang === 'en' ? etiquette.titleEn || etiquette.title : etiquette.title;
}

export function getRuqyahEtiquetteDesc(etiquette: RuqyahEtiquette, lang: 'ar' | 'en'): string {
  return lang === 'en' ? etiquette.descEn || etiquette.desc : etiquette.desc;
}

export function getRuqyahItemTitle(item: RuqyahItem, lang: 'ar' | 'en'): string {
  return lang === 'en' ? item.titleEn || item.title : item.title;
}

export function getRuqyahItemSource(item: RuqyahItem, lang: 'ar' | 'en'): string {
  return lang === 'en' ? item.sourceEn || item.source : item.source;
}

export function getRuqyahItemVirtue(item: RuqyahItem, lang: 'ar' | 'en'): string {
  return lang === 'en' ? item.virtueAndFadlEn || item.virtueAndFadl : item.virtueAndFadl;
}

export function getRuqyahItemGrade(item: RuqyahItem, lang: 'ar' | 'en'): string | undefined {
  return lang === 'en' ? item.hadithGradeEn || item.hadithGrade : item.hadithGrade;
}

export function getRuqyahItemInstruction(item: RuqyahItem, lang: 'ar' | 'en'): string | undefined {
  return lang === 'en' ? item.instructionEn || item.instruction : item.instruction;
}

export function getRuqyahAudioStepLabel(ref: AudioAyahRef, lang: 'ar' | 'en'): string {
  if (lang === 'en') {
    return ref.labelEn || ref.label || `Ayah ${ref.ayah}`;
  }
  return ref.label || `الآية ${ref.ayah}`;
}
