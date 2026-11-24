import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SURAHS_LIST, getSurahDisplayName } from '../../data/quranMetadata';
import { Ayah, getSurahData, sanitizeAyahText } from '../../data/quranService';
import { RECITERS_LIST, Reciter, getAyahAudioUrl, getReciterDisplayName } from '../../data/reciters';
import { formatLocalizedDigits, useLanguage } from '../../utils/i18n';
import {
  TajweedRuleType,
  TajweedToken,
  alignUthmaniWithTajweed,
  getTajweedTokenTooltip,
  parseWordTajweed,
} from '../../utils/tajweedParser';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Volume2,
} from 'lucide-react';

interface AyahTajweedLabProps {
  selectedReciter?: Reciter;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
}

type IsolationFilterId =
  | 'all'
  | 'ghunnah-ikhfa'
  | 'idgham-iqlab'
  | 'madd'
  | 'qalqalah'
  | 'silent';

const ISOLATION_FILTERS: {
  id: IsolationFilterId;
  label: string;
  labelEn: string;
  rules: TajweedRuleType[];
  colorHex: string;
}[] = [
  { id: 'all', label: 'إظهار كل الأحكام', labelEn: 'All Rules', rules: [], colorHex: '#10b981' },
  {
    id: 'ghunnah-ikhfa',
    label: 'الغنة والإخفاء',
    labelEn: 'Ghunnah & Ikhfa',
    rules: ['ghunnah', 'ikhfa'],
    colorHex: '#4ade80',
  },
  {
    id: 'idgham-iqlab',
    label: 'الإدغام والإقلاب',
    labelEn: 'Idgham & Iqlab',
    rules: ['idgham', 'iqlab'],
    colorHex: '#2dd4bf',
  },
  {
    id: 'madd',
    label: 'جميع المدود',
    labelEn: 'All Madd Rules',
    rules: ['madd-tabeei', 'madd-badal', 'madd-wajib', 'madd-lazim', 'madd-arid'],
    colorHex: '#f43f5e',
  },
  { id: 'qalqalah', label: 'القلقلة', labelEn: 'Qalqalah', rules: ['qalqalah'], colorHex: '#38bdf8' },
  { id: 'silent', label: 'الحروف الصامتة', labelEn: 'Silent Letters', rules: ['silent'], colorHex: '#94a3b8' },
];

const CURATED_PRESETS: { surah: number; ayah: number }[] = [
  { surah: 1, ayah: 7 },
  { surah: 2, ayah: 3 },
  { surah: 2, ayah: 5 },
  { surah: 98, ayah: 4 },
  { surah: 105, ayah: 4 },
  { surah: 112, ayah: 4 },
];

const RULE_DISPLAY_META: Record<
  TajweedRuleType,
  { label: string; labelEn: string; colorHex: string; cssClass: string; filterId: IsolationFilterId }
> = {
  ghunnah: { label: 'غنة مشددة', labelEn: 'Mushaddadah Ghunnah', colorHex: '#10b981', cssClass: 'tajweed-ghunnah', filterId: 'ghunnah-ikhfa' },
  ikhfa: { label: 'إخفاء', labelEn: 'Ikhfa', colorHex: '#4ade80', cssClass: 'tajweed-ikhfa', filterId: 'ghunnah-ikhfa' },
  idgham: { label: 'إدغام بغنة', labelEn: 'Idgham w/ Ghunnah', colorHex: '#2dd4bf', cssClass: 'tajweed-idgham', filterId: 'idgham-iqlab' },
  iqlab: { label: 'إقلاب', labelEn: 'Iqlab', colorHex: '#34d399', cssClass: 'tajweed-iqlab', filterId: 'idgham-iqlab' },
  qalqalah: { label: 'قلقلة', labelEn: 'Qalqalah', colorHex: '#38bdf8', cssClass: 'tajweed-qalqalah', filterId: 'qalqalah' },
  'madd-wajib': { label: 'مد متصل / منفصل', labelEn: 'Connected / Separated Madd', colorHex: '#f43f5e', cssClass: 'tajweed-madd-wajib', filterId: 'madd' },
  'madd-lazim': { label: 'مد لازم (6 حركات)', labelEn: 'Madd Lazim (6 counts)', colorHex: '#ef4444', cssClass: 'tajweed-madd-lazim', filterId: 'madd' },
  'madd-arid': { label: 'مد عارض للسكون', labelEn: 'Pause Madd (Arid)', colorHex: '#fb923c', cssClass: 'tajweed-madd-arid', filterId: 'madd' },
  'madd-tabeei': { label: 'مد طبيعي', labelEn: 'Natural Madd', colorHex: '#eab308', cssClass: 'tajweed-madd-tabeei', filterId: 'madd' },
  'madd-badal': { label: 'مد بدل', labelEn: 'Madd Badal', colorHex: '#facc15', cssClass: 'tajweed-madd-badal', filterId: 'madd' },
  tafkheem: { label: 'تفخيم', labelEn: 'Tafkheem (Heavy)', colorHex: '#60a5fa', cssClass: 'tajweed-tafkheem', filterId: 'all' },
  silent: { label: 'لا يُلفظ / إدغام بلا غنة', labelEn: 'Silent / Idgham w/o Ghunnah', colorHex: '#94a3b8', cssClass: 'tajweed-silent', filterId: 'silent' },
};

export const AyahTajweedLab: React.FC<AyahTajweedLabProps> = ({
  selectedReciter,
  onNavigateToAyah,
}) => {
  const { lang, isEnglish } = useLanguage();
  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [ayahNumber, setAyahNumber] = useState<number>(7);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [isolationFilter, setIsolationFilter] = useState<IsolationFilterId>('all');
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  // Audio preview state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<0.75 | 1>(1);
  const playbackRateRef = useRef<0.75 | 1>(playbackRate);
  playbackRateRef.current = playbackRate;
  const [audioError, setAudioError] = useState<string | null>(null);

  const activeReciter = selectedReciter || RECITERS_LIST[0];
  const surahMeta = useMemo(
    () => SURAHS_LIST.find((s) => s.number === surahNumber) || SURAHS_LIST[0],
    [surahNumber]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMsg(null);
    setSelectedWordIndex(null);

    getSurahData(surahNumber)
      .then((data) => {
        if (!cancelled) {
          setAyahs(data.ayahs);
          setIsLoading(false);
          setAyahNumber((prev) => Math.min(Math.max(1, prev), data.ayahs.length));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : isEnglish
              ? 'Unable to load the Ayah right now.'
              : 'تعذر تحميل الآية الكريمة.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surahNumber, reloadNonce, isEnglish]);

  // Stop audio when changing ayah or unmounting
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);
    setAudioError(null);
  }, [surahNumber, ayahNumber]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const currentAyah = useMemo(
    () => ayahs.find((a) => a.numberInSurah === ayahNumber) || ayahs[0] || null,
    [ayahs, ayahNumber]
  );

  const parsedWords: TajweedToken[][] = useMemo(() => {
    if (!currentAyah) return [];
    const cleanUthmani = sanitizeAyahText(currentAyah.text, surahNumber, currentAyah.numberInSurah);
    const cleanTajweed = currentAyah.tajweedText
      ? sanitizeAyahText(currentAyah.tajweedText, surahNumber, currentAyah.numberInSurah)
      : undefined;

    if (cleanTajweed && cleanTajweed.includes('[')) {
      return alignUthmaniWithTajweed(cleanUthmani, cleanTajweed);
    }

    const rawWords = cleanUthmani.trim().split(/\s+/);
    return rawWords.map((w, idx) => parseWordTajweed(w, idx === 0, idx === rawWords.length - 1));
  }, [currentAyah, surahNumber]);

  // Compute live occurrence stats for every rule in this ayah
  const ruleStats = useMemo(() => {
    const counts = new Map<TajweedRuleType, number>();
    parsedWords.forEach((word) => {
      word.forEach((tok) => {
        if (tok.rule) {
          counts.set(tok.rule, (counts.get(tok.rule) || 0) + 1);
        }
      });
    });
    return Array.from(counts.entries()).map(([rule, count]) => ({
      rule,
      count,
      meta: RULE_DISPLAY_META[rule],
    }));
  }, [parsedWords]);

  const activeFilterRules = useMemo(() => {
    return ISOLATION_FILTERS.find((f) => f.id === isolationFilter)?.rules || [];
  }, [isolationFilter]);

  const selectedWordTokens = useMemo(() => {
    if (selectedWordIndex === null) return null;
    return parsedWords[selectedWordIndex] || null;
  }, [parsedWords, selectedWordIndex]);

  const handleToggleAudio = () => {
    setAudioError(null);
    const url = getAyahAudioUrl(activeReciter.serverKey, surahNumber, ayahNumber);
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setIsPlayingAudio(false);
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackRateRef.current;
        }
      };
      audioRef.current.onerror = () => {
        setIsPlayingAudio(false);
        setAudioError(
          isEnglish
            ? 'Unable to play recitation right now; please check your internet connection.'
            : 'تعذر تشغيل التلاوة الصوتية حالياً، تأكد من اتصال الإنترنت.'
        );
      };
    }

    const audio = audioRef.current;
    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (audio.src !== url) {
      audio.src = url;
    }
    audio.playbackRate = playbackRate;
    audio
      .play()
      .then(() => setIsPlayingAudio(true))
      .catch(() => {
        setIsPlayingAudio(false);
        setAudioError(
          isEnglish
            ? 'Unable to play the audio file in this browser.'
            : 'تعذر تشغيل الملف الصوتي في المتصفح.'
        );
      });
  };

  const handlePickPreset = (surah: number, ayah: number) => {
    setSurahNumber(surah);
    setAyahNumber(ayah);
    setSelectedWordIndex(null);
    setIsolationFilter('all');
  };

  return (
    <div className="space-y-5">
      {/* Selector & Curated Presets Bar */}
      <div className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-white">
              {isEnglish ? 'Interactive «Dissect the Ayah» Lab' : 'مختبر «حلّل الآية بنفسك»'}
            </h3>
            <p className="text-xs text-[#6B6251] dark:text-slate-400">
              {isEnglish
                ? 'Choose any Ayah from the Quran, isolate its rules, or tap any word to inspect color reasons while listening'
                : 'اختر أي آية من القرآن الكريم واعزل أحكامها أو اضغط على أي كلمة لشرح سبب التلوين مع الاستماع'}
            </p>
          </div>

          {/* Surah + Ayah Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={isEnglish ? 'Select Surah' : 'اختر السورة'}
              value={surahNumber}
              onChange={(e) => {
                setSurahNumber(Number(e.target.value));
                setAyahNumber(1);
                setSelectedWordIndex(null);
              }}
              className="py-2 px-3 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700 text-xs font-bold text-[#1B1A17] dark:text-white focus:outline-none focus:border-[#D9B45A] cursor-pointer"
            >
              {SURAHS_LIST.map((s) => (
                <option key={s.number} value={s.number} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-white">
                  {formatLocalizedDigits(s.number, lang)}. {isEnglish ? getSurahDisplayName(s, lang) : `سورة ${s.name}`}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-white dark:bg-slate-950 rounded-xl border border-[#D9B45A]/35 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setAyahNumber((a) => Math.max(1, a - 1));
                  setSelectedWordIndex(null);
                }}
                disabled={ayahNumber <= 1}
                className="p-2 text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title={isEnglish ? 'Previous Ayah' : 'الآية السابقة'}
              >
                {isEnglish ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <select
                aria-label={isEnglish ? 'Ayah Number' : 'رقم الآية'}
                value={ayahNumber}
                onChange={(e) => {
                  setAyahNumber(Number(e.target.value));
                  setSelectedWordIndex(null);
                }}
                className="py-2 px-2 bg-transparent text-xs font-bold text-[#1F3A6E] dark:text-[#D9B45A] tabular-nums focus:outline-none cursor-pointer"
              >
                {Array.from({ length: surahMeta.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-white">
                    {isEnglish ? `Ayah ${n}` : `الآية ${formatLocalizedDigits(n, lang)}`}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setAyahNumber((a) => Math.min(surahMeta.numberOfAyahs, a + 1));
                  setSelectedWordIndex(null);
                }}
                disabled={ayahNumber >= surahMeta.numberOfAyahs}
                className="p-2 text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title={isEnglish ? 'Next Ayah' : 'الآية التالية'}
              >
                {isEnglish ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Curated Quick Examples Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800/80">
          <span className="text-[11px] font-semibold text-[#6B6251] dark:text-slate-400 whitespace-nowrap">
            {isEnglish ? 'Rich Rule Examples:' : 'نماذج غنية بالأحكام:'}
          </span>
          {CURATED_PRESETS.map((preset) => {
            const isActive = surahNumber === preset.surah && ayahNumber === preset.ayah;
            const presetSurah = SURAHS_LIST.find((s) => s.number === preset.surah);
            const presetLabel = presetSurah
              ? `${getSurahDisplayName(presetSurah, lang)}: ${formatLocalizedDigits(preset.ayah, lang)}`
              : `${preset.surah}:${preset.ayah}`;
            return (
              <button
                key={`${preset.surah}-${preset.ayah}`}
                type="button"
                onClick={() => handlePickPreset(preset.surah, preset.ayah)}
                className={`py-1 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-[#1F3A6E] border-[#648CD4]/50 text-[#F6EFDD]'
                    : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:border-[#D9B45A]/50 dark:hover:border-slate-700'
                }`}
              >
                {presetLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Ayah Analysis Stage */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 space-y-5">
        {/* Rule Isolation Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D9B45A]/20 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B1A17] dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
            <span>{isEnglish ? 'Isolate & Highlight Rule:' : 'عزل وتمييز الحكم داخل الآية:'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ISOLATION_FILTERS.map((f) => {
              const isActive = isolationFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setIsolationFilter(f.id)}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#1F3A6E] border-[#D9B45A] text-[#F6EFDD] shadow-sm'
                      : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: f.colorHex }}
                  />
                  <span>{isEnglish ? f.labelEn : f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ayah Surface */}
        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin mx-auto" />
            <p className="text-xs text-[#6B6251] dark:text-slate-400">
              {isEnglish ? 'Loading Uthmani script and Tajweed rules…' : 'جارٍ جلب الرسم العثماني وأحكام التجويد للآية...'}
            </p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-500/30 text-center space-y-3">
            <p className="text-xs text-rose-800 dark:text-rose-200">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="py-2 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Retry' : 'إعادة المحاولة'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Clickable Words Canvas (Kept deep ink so Tajweed rule colors stay luminous & legible) */}
            <div
              dir="rtl"
              lang="ar"
              className="p-5 sm:p-7 rounded-2xl bg-[#0b1117] border border-[#1F3A6E]/35 dark:border-slate-800/90 text-center shadow-inner"
            >
              <p className="font-quran text-2xl sm:text-3xl leading-[2.6] text-slate-100 select-text">
                {parsedWords.map((wordTokens, wIdx) => {
                  const isWordSelected = selectedWordIndex === wIdx;
                  const hasMatchingRule =
                    isolationFilter === 'all' ||
                    wordTokens.some((tok) => tok.rule && activeFilterRules.includes(tok.rule));

                  return (
                    <React.Fragment key={wIdx}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedWordIndex((prev) => (prev === wIdx ? null : wIdx))
                        }
                        className={`inline cursor-pointer rounded-lg px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                          isWordSelected
                            ? 'bg-[#D9B45A]/20 ring-1 ring-[#D9B45A]'
                            : 'hover:bg-slate-800/70'
                        }`}
                        title={isEnglish ? 'Tap to inspect this word’s Tajweed rules' : 'اضغط لعرض تحليل أحكام هذه الكلمة'}
                      >
                        {wordTokens.map((tok, tIdx) => {
                          const isRuleMatched =
                            tok.rule &&
                            (isolationFilter === 'all' || activeFilterRules.includes(tok.rule));

                          if (!tok.rule) {
                            return (
                              <span
                                key={tIdx}
                                className={
                                  isolationFilter !== 'all' && !hasMatchingRule
                                    ? 'text-slate-500'
                                    : undefined
                                }
                              >
                                {tok.text}
                              </span>
                            );
                          }

                          const meta = RULE_DISPLAY_META[tok.rule];
                          if (!isRuleMatched) {
                            return (
                              <span key={tIdx} className="text-slate-500">
                                {tok.text}
                              </span>
                            );
                          }

                          return (
                            <span key={tIdx} className={meta.cssClass} title={getTajweedTokenTooltip(tok, lang)}>
                              {tok.text}
                            </span>
                          );
                        })}
                      </button>
                      {wIdx < parsedWords.length - 1 && ' '}
                    </React.Fragment>
                  );
                })}
                <span className="text-[#D9B45A] font-bold text-xl mx-2 tabular-nums">
                  ﴿{formatLocalizedDigits(ayahNumber, lang)}﴾
                </span>
              </p>

              <p dir={isEnglish ? 'ltr' : 'rtl'} className="text-[11px] text-slate-400 mt-3">
                {isEnglish
                  ? 'Tap any word above to view its colored Tajweed rules breakdown'
                  : 'اضغط على أي كلمة في الآية أعلاه لعرض تفصيل أحكامها وحروفها الملونة'}
              </p>
            </div>

            {/* Selected Word Breakdown Inspector */}
            {selectedWordTokens && (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/45 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#D9B45A]/20 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
                      {isEnglish ? 'Word Analysis:' : 'تحليل الكلمة:'}
                    </span>
                    <span dir="rtl" lang="ar" className="font-quran text-2xl text-[#1B1A17] dark:text-white">
                      {selectedWordTokens.map((t) => t.text).join('')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWordIndex(null)}
                    className="text-xs text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
                  >
                    {isEnglish ? 'Close' : 'إغلاق'}
                  </button>
                </div>

                {selectedWordTokens.some((t) => t.rule) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedWordTokens
                      .filter((t) => Boolean(t.rule))
                      .map((tok, idx) => {
                        const meta = tok.rule ? RULE_DISPLAY_META[tok.rule] : undefined;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 flex items-start gap-2.5"
                          >
                            <span
                              className="w-3 h-3 rounded-full mt-1 shrink-0"
                              style={{ backgroundColor: meta?.colorHex || '#D9B45A' }}
                            />
                            <div className="text-xs space-y-0.5">
                              <div className="font-bold text-[#1B1A17] dark:text-white flex items-center gap-2">
                                <span
                                  dir="rtl"
                                  lang="ar"
                                  className="font-quran text-base px-1.5 py-0.5 rounded bg-[#0b1117]"
                                  style={{ color: meta?.colorHex }}
                                >
                                  {tok.text}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{meta ? (isEnglish ? meta.labelEn : meta.label) : ''}</span>
                              </div>
                              <p className="text-[#4B4539] dark:text-slate-300 leading-relaxed">
                                {getTajweedTokenTooltip(tok, lang)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-[#4B4539] dark:text-slate-300">
                    {isEnglish
                      ? 'No special color-coded Tajweed rule on this word; letters are pronounced clearly in their natural form.'
                      : 'كلمة خالية من أحكام التلوين الخاصة؛ تُقرأ حروفها وحركاتها بالنطق الأصلي المُظهر بوضوح.'}
                  </p>
                )}
              </div>
            )}

            {/* Action Bar: Real Reciter Audio + Open in Mushaf */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    isPlayingAudio
                      ? 'bg-[#D9B45A] text-[#1B1A17]'
                      : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>{isEnglish ? 'Pause Recitation' : 'إيقاف التلاوة'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isEnglish
                          ? `Listen (${getReciterDisplayName(activeReciter, lang)})`
                          : `استمع بصوت ${activeReciter.name.split(' ')[0]}`}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                    playbackRate === 0.75
                      ? 'bg-sky-50 dark:bg-sky-500/20 border-sky-400 text-sky-900 dark:text-sky-200'
                      : 'bg-white dark:bg-slate-950 border-[#D9B45A]/30 dark:border-slate-700 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                  title={isEnglish ? 'Slow down audio to hear Madd and Ghunnah clearly' : 'إبطاء الصوت لسماع المدود والغنة بوضوح'}
                >
                  {isEnglish ? `Speed: ${playbackRate}x` : `السرعة: ${playbackRate}x`}
                </button>

                {audioError && <span className="text-xs text-rose-600 dark:text-rose-400">{audioError}</span>}
              </div>

              {onNavigateToAyah && (
                <button
                  type="button"
                  onClick={() => onNavigateToAyah(surahNumber, ayahNumber)}
                  className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2]/60 dark:hover:bg-slate-800 border border-[#D9B45A]/35 dark:border-slate-700 text-xs font-semibold text-[#1B1A17] dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                  <span>{isEnglish ? 'Open in Mushaf' : 'فتح في المصحف'}</span>
                  <ExternalLink className="w-3 h-3 text-[#6B6251] dark:text-slate-400" />
                </button>
              )}
            </div>

            {/* Live Rule Occurrences Summary */}
            <div className="pt-4 border-t border-[#D9B45A]/20 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1B1A17] dark:text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                  <span>{isEnglish ? 'Detected Rules Breakdown' : 'إحصاء الأحكام المكتشفة في الآية'}</span>
                </span>
                <span className="text-[#6B6251] dark:text-slate-400 tabular-nums">
                  {getSurahDisplayName(surahMeta, lang)} ·{' '}
                  {isEnglish ? `Ayah ${ayahNumber}` : `آية ${formatLocalizedDigits(ayahNumber, lang)}`}
                </span>
              </div>

              {ruleStats.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ruleStats.map(({ rule, count, meta }) => (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => setIsolationFilter(meta.filterId)}
                      className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-950 hover:bg-[#F3E9D2]/60 dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-xs flex items-center gap-2 transition-colors cursor-pointer tabular-nums whitespace-nowrap"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.colorHex }}
                      />
                      <span className="text-[#1B1A17] dark:text-slate-200 font-semibold">
                        {isEnglish ? meta.labelEn : meta.label}
                      </span>
                      <span className="text-[#6B6251] dark:text-slate-400">
                        ({formatLocalizedDigits(count, lang)})
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B6251] dark:text-slate-400">
                  {isEnglish
                    ? 'No special color-coded Tajweed rules detected in this short Ayah.'
                    : 'لم تُسجل أحكام تلوين خاصة في هذه الآية القصيرة.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
