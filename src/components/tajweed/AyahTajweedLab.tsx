import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SURAHS_LIST } from '../../data/quranMetadata';
import { Ayah, getSurahData, sanitizeAyahText } from '../../data/quranService';
import { RECITERS_LIST, Reciter, getAyahAudioUrl } from '../../data/reciters';
import {
  TajweedRuleType,
  TajweedToken,
  alignUthmaniWithTajweed,
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
  rules: TajweedRuleType[];
  colorHex: string;
}[] = [
  { id: 'all', label: 'إظهار كل الأحكام', rules: [], colorHex: '#10b981' },
  {
    id: 'ghunnah-ikhfa',
    label: 'الغنة والإخفاء',
    rules: ['ghunnah', 'ikhfa'],
    colorHex: '#4ade80',
  },
  {
    id: 'idgham-iqlab',
    label: 'الإدغام والإقلاب',
    rules: ['idgham', 'iqlab'],
    colorHex: '#2dd4bf',
  },
  {
    id: 'madd',
    label: 'جميع المدود',
    rules: ['madd-tabeei', 'madd-badal', 'madd-wajib', 'madd-lazim', 'madd-arid'],
    colorHex: '#f43f5e',
  },
  { id: 'qalqalah', label: 'القلقلة', rules: ['qalqalah'], colorHex: '#38bdf8' },
  { id: 'silent', label: 'الحروف الصامتة', rules: ['silent'], colorHex: '#94a3b8' },
];

const CURATED_PRESETS: { label: string; surah: number; ayah: number }[] = [
  { label: 'الفاتحة: ٧', surah: 1, ayah: 7 },
  { label: 'البقرة: ٣', surah: 2, ayah: 3 },
  { label: 'البقرة: ٥', surah: 2, ayah: 5 },
  { label: 'البينة: ٤', surah: 98, ayah: 4 },
  { label: 'الفيل: ٤', surah: 105, ayah: 4 },
  { label: 'الإخلاص: ٤', surah: 112, ayah: 4 },
];

const RULE_DISPLAY_META: Record<
  TajweedRuleType,
  { label: string; colorHex: string; cssClass: string; filterId: IsolationFilterId }
> = {
  ghunnah: { label: 'غنة مشددة', colorHex: '#10b981', cssClass: 'tajweed-ghunnah', filterId: 'ghunnah-ikhfa' },
  ikhfa: { label: 'إخفاء', colorHex: '#4ade80', cssClass: 'tajweed-ikhfa', filterId: 'ghunnah-ikhfa' },
  idgham: { label: 'إدغام بغنة', colorHex: '#2dd4bf', cssClass: 'tajweed-idgham', filterId: 'idgham-iqlab' },
  iqlab: { label: 'إقلاب', colorHex: '#34d399', cssClass: 'tajweed-iqlab', filterId: 'idgham-iqlab' },
  qalqalah: { label: 'قلقلة', colorHex: '#38bdf8', cssClass: 'tajweed-qalqalah', filterId: 'qalqalah' },
  'madd-wajib': { label: 'مد متصل / منفصل', colorHex: '#f43f5e', cssClass: 'tajweed-madd-wajib', filterId: 'madd' },
  'madd-lazim': { label: 'مد لازم (6 حركات)', colorHex: '#ef4444', cssClass: 'tajweed-madd-lazim', filterId: 'madd' },
  'madd-arid': { label: 'مد عارض للسكون', colorHex: '#fb923c', cssClass: 'tajweed-madd-arid', filterId: 'madd' },
  'madd-tabeei': { label: 'مد طبيعي', colorHex: '#eab308', cssClass: 'tajweed-madd-tabeei', filterId: 'madd' },
  'madd-badal': { label: 'مد بدل', colorHex: '#facc15', cssClass: 'tajweed-madd-badal', filterId: 'madd' },
  tafkheem: { label: 'تفخيم', colorHex: '#60a5fa', cssClass: 'tajweed-tafkheem', filterId: 'all' },
  silent: { label: 'لا يُلفظ / إدغام بلا غنة', colorHex: '#94a3b8', cssClass: 'tajweed-silent', filterId: 'silent' },
};

export const AyahTajweedLab: React.FC<AyahTajweedLabProps> = ({
  selectedReciter,
  onNavigateToAyah,
}) => {
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
          setErrorMsg(err instanceof Error ? err.message : 'تعذر تحميل الآية الكريمة.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surahNumber, reloadNonce]);

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
      audioRef.current.onerror = () => {
        setIsPlayingAudio(false);
        setAudioError('تعذر تشغيل التلاوة الصوتية حالياً، تأكد من اتصال الإنترنت.');
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
        setAudioError('تعذر تشغيل الملف الصوتي في المتصفح.');
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
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">مختبر «حلّل الآية بنفسك»</h3>
            <p className="text-xs text-slate-400">
              اختر أي آية من القرآن الكريم واعزل أحكامها أو اضغط على أي كلمة لشرح سبب التلوين مع الاستماع
            </p>
          </div>

          {/* Surah + Ayah Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="اختر السورة"
              value={surahNumber}
              onChange={(e) => {
                setSurahNumber(Number(e.target.value));
                setAyahNumber(1);
                setSelectedWordIndex(null);
              }}
              className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {SURAHS_LIST.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. سورة {s.name}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setAyahNumber((a) => Math.max(1, a - 1));
                  setSelectedWordIndex(null);
                }}
                disabled={ayahNumber <= 1}
                className="p-2 text-slate-300 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title="الآية السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <select
                aria-label="رقم الآية"
                value={ayahNumber}
                onChange={(e) => {
                  setAyahNumber(Number(e.target.value));
                  setSelectedWordIndex(null);
                }}
                className="py-2 px-2 bg-transparent text-xs font-bold text-emerald-300 tabular-nums focus:outline-none cursor-pointer"
              >
                {Array.from({ length: surahMeta.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-slate-900 text-white">
                    الآية {n}
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
                className="p-2 text-slate-300 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title="الآية التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Curated Quick Examples Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            نماذج غنية بالأحكام:
          </span>
          {CURATED_PRESETS.map((preset) => {
            const isActive = surahNumber === preset.surah && ayahNumber === preset.ayah;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePickPreset(preset.surah, preset.ayah)}
                className={`py-1 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Ayah Analysis Stage */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        {/* Rule Isolation Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>عزل وتمييز الحكم داخل الآية:</span>
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
                      ? 'bg-slate-800 border-emerald-400 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: f.colorHex }}
                  />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ayah Surface */}
        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs text-slate-400">جارٍ جلب الرسم العثماني وأحكام التجويد للآية...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 rounded-xl bg-rose-950/20 border border-rose-500/30 text-center space-y-3">
            <p className="text-xs text-rose-200">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Clickable Words Canvas */}
            <div
              dir="rtl"
              className="p-5 sm:p-7 rounded-2xl bg-[#0b1117] border border-slate-800/90 text-center"
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
                        className={`inline cursor-pointer rounded-lg px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                          isWordSelected
                            ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                            : 'hover:bg-slate-800/70'
                        }`}
                        title="اضغط لعرض تحليل أحكام هذه الكلمة"
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
                            <span key={tIdx} className={meta.cssClass} title={tok.tooltip}>
                              {tok.text}
                            </span>
                          );
                        })}
                      </button>
                      {wIdx < parsedWords.length - 1 && ' '}
                    </React.Fragment>
                  );
                })}
                <span className="text-emerald-400 font-bold text-xl mx-2 tabular-nums">
                  ﴿{ayahNumber}﴾
                </span>
              </p>

              <p className="text-[11px] text-slate-400 mt-3">
                اضغط على أي كلمة في الآية أعلاه لعرض تفصيل أحكامها وحروفها الملونة
              </p>
            </div>

            {/* Selected Word Breakdown Inspector */}
            {selectedWordTokens && (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/35 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-emerald-300">تحليل الكلمة:</span>
                    <span className="font-quran text-2xl text-white">
                      {selectedWordTokens.map((t) => t.text).join('')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWordIndex(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    إغلاق
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
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5"
                          >
                            <span
                              className="w-3 h-3 rounded-full mt-1 shrink-0"
                              style={{ backgroundColor: meta?.colorHex || '#10b981' }}
                            />
                            <div className="text-xs space-y-0.5">
                              <div className="font-bold text-white flex items-center gap-2">
                                <span className="font-quran text-base" style={{ color: meta?.colorHex }}>
                                  {tok.text}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{meta?.label}</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed">{tok.tooltip}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-300">
                    كلمة خالية من أحكام التلوين الخاصة؛ تُقرأ حروفها وحركاتها بالنطق الأصلي المُظهر بوضوح.
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
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>إيقاف التلاوة</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>استمع بصوت {activeReciter.name.split(' ')[0]}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                    playbackRate === 0.75
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="إبطاء الصوت لسماع المدود والغنة بوضوح"
                >
                  السرعة: {playbackRate}x
                </button>

                {audioError && <span className="text-xs text-rose-400">{audioError}</span>}
              </div>

              {onNavigateToAyah && (
                <button
                  type="button"
                  onClick={() => onNavigateToAyah(surahNumber, ayahNumber)}
                  className="py-2 px-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>فتح في المصحف</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>

            {/* Live Rule Occurrences Summary */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إحصاء الأحكام المكتشفة في الآية</span>
                </span>
                <span className="text-slate-400 tabular-nums">
                  {surahMeta.name} · آية {ayahNumber}
                </span>
              </div>

              {ruleStats.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ruleStats.map(({ rule, count, meta }) => (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => setIsolationFilter(meta.filterId)}
                      className="py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs flex items-center gap-2 transition-colors cursor-pointer tabular-nums whitespace-nowrap"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.colorHex }}
                      />
                      <span className="text-slate-200 font-semibold">{meta.label}</span>
                      <span className="text-slate-400">({count})</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">لم تُسجل أحكام تلوين خاصة في هذه الآية القصيرة.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
