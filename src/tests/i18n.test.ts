import { describe, expect, it } from 'vitest';
import {
  APP_LANGUAGE_STORAGE_KEY,
  formatAppNumber,
  formatLocalizedDigits,
  formatSpeedLabel,
  getAutoScrollPresetLabel,
  getJuzLabel,
  toArabicIndicDigits,
} from '../utils/i18n';
import {
  RECITERS_LIST,
  getReciterDisplayCountry,
  getReciterDisplayName,
  getReciterDisplayStyle,
} from '../data/reciters';
import {
  SURAHS_LIST,
  getRevelationTypeLabel,
  getSurahDisplayName,
  getSurahFullTitle,
} from '../data/quranMetadata';
import { buildMediaSessionMetadataPayload } from '../components/AudioPlayerBar';
import { getPrayerDisplayLabel } from '../utils/personalKhatma';
import { getBookmarkDisplayLabel } from '../utils/bookmarksStore';
import {
  formatParentGateQuestion,
  getGardenStageDisplayName,
  getKidAvatarDisplayLabel,
} from '../utils/kidsHifzStore';
import {
  TAJWEED_CHAPTERS,
  TAJWEED_RULES,
  TAJWEED_QUIZ,
  getTajweedChapterTitle,
  getTajweedRuleDisplayName,
  getTajweedRuleLevel,
  getTajweedRuleMizan,
  getQuizQuestionDifficulty,
  getQuizQuestionText,
  getQuizQuestionOptions,
} from '../data/tajweedRules';
import {
  RUQYAH_ETIQUETTES,
  RUQYAH_ITEMS,
  getRuqyahEtiquetteTitle,
  getRuqyahItemTitle,
  getRuqyahItemSource,
} from '../data/ruqyahData';
import { getTajweedRuleLabel, getTajweedTokenTooltip } from '../utils/tajweedParser';

describe('Phase 1 i18n utilities', () => {
  it('uses stable storage key and formats digits for AR and EN', () => {
    expect(APP_LANGUAGE_STORAGE_KEY).toBe('bayan_app_lang_v1');
    expect(toArabicIndicDigits(114)).toBe('١١٤');
    expect(formatLocalizedDigits(604, 'ar')).toBe('٦٠٤');
    expect(formatLocalizedDigits(604, 'en')).toBe('604');
    expect(formatAppNumber(6236, 'en')).toBe('6,236');
  });

  it('formats Juz labels, auto-scroll speed labels, and presets for AR and EN', () => {
    expect(getJuzLabel(30, 'en')).toBe('Juz 30');
    expect(getJuzLabel(30, 'ar')).toContain('الجزء');
    expect(formatSpeedLabel(1.5, 'en')).toBe('1.5×');
    expect(formatSpeedLabel(1.5, 'ar')).toContain('×');
    expect(getAutoScrollPresetLabel('tahqiq', 'en')).toBe('Slow (Tahqiq)');
    expect(getAutoScrollPresetLabel('tadwir', 'ar')).toBe('تدوير معتدل');
    expect(getAutoScrollPresetLabel('hadr', 'en')).toBe('Fast (Hadr)');
  });
});

describe('Phase 1 bilingual reciters & Surah metadata helpers', () => {
  it('provides English and Arabic metadata for every reciter in RECITERS_LIST', () => {
    expect(RECITERS_LIST.length).toBeGreaterThan(0);
    for (const reciter of RECITERS_LIST) {
      expect(getReciterDisplayName(reciter, 'ar')).toBe(reciter.name);
      expect(getReciterDisplayName(reciter, 'en')).toBeTruthy();
      expect(getReciterDisplayName(reciter, 'en')).not.toBe(reciter.name);
      expect(getReciterDisplayStyle(reciter, 'en')).toBeTruthy();
      expect(getReciterDisplayCountry(reciter, 'en')).toBeTruthy();
    }
  });

  it('formats Surah display names, full titles, and revelation types accurately', () => {
    const baqarah = SURAHS_LIST[1];
    const kahf = SURAHS_LIST[17];

    expect(getSurahDisplayName(baqarah, 'ar')).toBe('البقرة');
    expect(getSurahDisplayName(baqarah, 'en')).toBe('Al-Baqarah');
    expect(getSurahFullTitle(kahf, 'ar')).toBe('سورة الكهف');
    expect(getSurahFullTitle(kahf, 'en')).toBe('Surah Al-Kahf');
    expect(getRevelationTypeLabel('Meccan', 'ar')).toBe('مكية');
    expect(getRevelationTypeLabel('Medinan', 'en')).toBe('Medinan');
  });

  it('builds Media Session metadata in both Arabic (default) and English', () => {
    const arPayload = buildMediaSessionMetadataPayload('البقرة', 255, 'مشاري راشد العفاسي');
    expect(arPayload.title).toBe('سورة البقرة · الآية ٢٥٥');
    expect(arPayload.album).toBe('بيان — المصحف الشريف');

    const enPayload = buildMediaSessionMetadataPayload('Al-Baqarah', 255, 'Mishary Rashid Alafasy', 'en');
    expect(enPayload.title).toBe('Surah Al-Baqarah · Ayah 255');
    expect(enPayload.artist).toBe('Mishary Rashid Alafasy');
    expect(enPayload.album).toBe("Bayan — The Noble Mus'haf");
  });
});

describe('Phase 2 bilingual interactive, Khatma, Journal & Kids Hifz helpers', () => {
  it('formats prayer display labels for AR and EN', () => {
    expect(getPrayerDisplayLabel(0, 'ar')).toBe('الفجر');
    expect(getPrayerDisplayLabel(4, 'ar')).toBe('العشاء');
    expect(getPrayerDisplayLabel(0, 'en')).toBe('Fajr');
    expect(getPrayerDisplayLabel(1, 'en')).toBe('Dhuhr');
    expect(getPrayerDisplayLabel(2, 'en')).toBe('Asr');
    expect(getPrayerDisplayLabel(3, 'en')).toBe('Maghrib');
    expect(getPrayerDisplayLabel(4, 'en')).toBe('Isha');
  });

  it('formats bookmark category labels for AR and EN', () => {
    expect(getBookmarkDisplayLabel('وقف القراءة', 'ar')).toBe('وقف القراءة');
    expect(getBookmarkDisplayLabel('وقف القراءة', 'en')).toBe('Reading Stop');
    expect(getBookmarkDisplayLabel('مراجعة الحفظ', 'en')).toBe('Hifz Review');
    expect(getBookmarkDisplayLabel('تدبر ودعاء', 'en')).toBe('Tadabbur & Dua');
    expect(getBookmarkDisplayLabel('عام', 'en')).toBe('General');
  });

  it('formats Kids Hifz avatars, garden stages, and parent math gate questions', () => {
    expect(getKidAvatarDisplayLabel('star', 'ar')).toBe('نجمة مضيئة');
    expect(getKidAvatarDisplayLabel('crown', 'en')).toBe("Qur'an Crown");
    expect(getKidAvatarDisplayLabel('sprout', 'en')).toBe('Hifz Sprout');

    expect(getGardenStageDisplayName(1, 'ar')).toBe('بذرة طيبة');
    expect(getGardenStageDisplayName(1, 'en')).toBe('Good Seed');
    expect(getGardenStageDisplayName(5, 'en')).toBe('Huffaz Garden');

    const challenge = { a: 6, b: 4, answer: 24, questionText: 'كم ناتج ضرب 6 × 4 ؟' };
    expect(formatParentGateQuestion(challenge, 'ar')).toBe('كم ناتج ضرب 6 × 4 ؟');
    expect(formatParentGateQuestion(challenge, 'en')).toBe('What is 6 × 4?');
  });
});

describe('Phase 3 bilingual Tajweed & Ruqyah helpers', () => {
  it('provides Arabic and English labels for Tajweed chapters, rules, and parser tokens', () => {
    expect(TAJWEED_CHAPTERS.length).toBeGreaterThan(0);
    expect(getTajweedChapterTitle(TAJWEED_CHAPTERS[0], 'ar')).toBeTruthy();
    expect(getTajweedChapterTitle(TAJWEED_CHAPTERS[0], 'en')).toBeTruthy();

    const firstRule = TAJWEED_RULES[0];
    expect(getTajweedRuleDisplayName(firstRule, 'ar')).toBe(firstRule.name);
    expect(getTajweedRuleDisplayName(firstRule, 'en')).toBe(firstRule.nameEn);
    expect(getTajweedRuleLevel(firstRule, 'en')).toBe('Beginner');
    expect(getTajweedRuleMizan(firstRule, 'en')).toBe('2 counts');

    expect(getTajweedRuleLabel('ghunnah', 'en')).toBe('Mushaddadah Ghunnah');
    expect(getTajweedTokenTooltip({ rule: 'ghunnah', tooltip: 'غنة حركتان' }, 'en')).toBe(
      'Mushaddadah Ghunnah'
    );
  });

  it('provides Arabic and English content for Tajweed quiz questions and Ruqyah items', () => {
    const q = TAJWEED_QUIZ[0];
    expect(getQuizQuestionText(q, 'en')).toBeTruthy();
    expect(getQuizQuestionOptions(q, 'en').length).toBe(q.options.length);
    expect(getQuizQuestionDifficulty(q, 'en')).toBeTruthy();

    expect(getRuqyahEtiquetteTitle(RUQYAH_ETIQUETTES[0], 'en')).toBeTruthy();
    expect(getRuqyahItemTitle(RUQYAH_ITEMS[0], 'en')).toBeTruthy();
    expect(getRuqyahItemSource(RUQYAH_ITEMS[0], 'en')).toBeTruthy();
  });
});
