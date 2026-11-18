import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TAJWEED_CHAPTERS,
  TAJWEED_RULES,
  TajweedChapterId,
  TajweedRule,
} from '../data/tajweedRules';
import { RECITERS_LIST, Reciter, getAyahAudioUrl } from '../data/reciters';
import { normalizeArabicText } from '../utils/arabicNormalize';
import { safeLocalStorage } from '../utils/safeStorage';
import { alignUthmaniWithTajweed, TajweedRuleType } from '../utils/tajweedParser';
import { MakharijAtlas } from './tajweed/MakharijAtlas';
import { AyahTajweedLab } from './tajweed/AyahTajweedLab';
import { TajweedQuizHub } from './tajweed/TajweedQuizHub';
import {
  Award,
  BookOpen,
  Check,
  Compass,
  ExternalLink,
  Eye,
  FlaskConical,
  HelpCircle,
  Pause,
  Play,
  Search,
  Timer,
  X,
} from 'lucide-react';

interface TajweedEncyclopediaProps {
  selectedReciter?: Reciter;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
}

type EncyclopediaTab = 'rules' | 'makharij' | 'lab' | 'quiz';

const MASTERED_STORAGE_KEY = 'bayan_tajweed_mastered_v1';

const RULE_CLASS_MAP: Record<TajweedRuleType, string> = {
  silent: 'tajweed-silent',
  ghunnah: 'tajweed-ghunnah',
  ikhfa: 'tajweed-ikhfa',
  idgham: 'tajweed-idgham',
  iqlab: 'tajweed-iqlab',
  qalqalah: 'tajweed-qalqalah',
  'madd-wajib': 'tajweed-madd-wajib',
  'madd-lazim': 'tajweed-madd-lazim',
  'madd-badal': 'tajweed-madd-badal',
  'madd-arid': 'tajweed-madd-arid',
  'madd-tabeei': 'tajweed-madd-tabeei',
  tafkheem: 'tajweed-tafkheem',
};

export const TajweedEncyclopedia: React.FC<TajweedEncyclopediaProps> = ({
  selectedReciter,
  onNavigateToAyah,
}) => {
  const [activeTab, setActiveTab] = useState<EncyclopediaTab>('rules');
  const [selectedChapter, setSelectedChapter] = useState<TajweedChapterId | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(TAJWEED_RULES[0].id);

  // Mastery tracking per rule
  const [masteredIds, setMasteredIds] = useState<string[]>(() =>
    safeLocalStorage.getJSON<string[]>(MASTERED_STORAGE_KEY, [])
  );

  // Interactive example controls
  const [isolateRuleColors, setIsolateRuleColors] = useState<boolean>(false);
  const [inspectedWord, setInspectedWord] = useState<{
    exampleIndex: number;
    wordIndex: number;
  } | null>(null);

  // Visual Harakat Beat Simulator
  const [selectedBeatCount, setSelectedBeatCount] = useState<number>(2);
  const [activeBeatStep, setActiveBeatStep] = useState<number>(0); // 0 = stopped, 1..N = active beat
  const [isBeatRunning, setIsBeatRunning] = useState<boolean>(false);
  const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Local audio player for rule examples
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingExampleKey, setPlayingExampleKey] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<0.75 | 1>(1);
  const playbackRateRef = useRef<0.75 | 1>(playbackRate);
  playbackRateRef.current = playbackRate;
  const [audioError, setAudioError] = useState<string | null>(null);

  const activeReciter = selectedReciter || RECITERS_LIST[0];

  const selectedRule: TajweedRule = useMemo(
    () => TAJWEED_RULES.find((r) => r.id === selectedRuleId) || TAJWEED_RULES[0],
    [selectedRuleId]
  );

  const filteredRules = useMemo(() => {
    const q = normalizeArabicText(searchTerm);
    return TAJWEED_RULES.filter((rule) => {
      if (selectedChapter !== 'all' && rule.chapter !== selectedChapter) return false;
      if (!q) return true;
      const haystack = normalizeArabicText(
        `${rule.name} ${rule.nameEn} ${rule.definition} ${rule.letters.join(' ')} ${rule.mizan}`
      );
      return haystack.includes(q);
    });
  }, [selectedChapter, searchTerm]);

  // Keep beat simulator & inspection synchronized when rule switches
  useEffect(() => {
    setInspectedWord(null);
    setAudioError(null);
    stopBeatSimulator();
    if (selectedRule.beats.options.length > 0) {
      setSelectedBeatCount(selectedRule.beats.options[0]);
    }
  }, [selectedRule.id]);

  // Auto-switch selected rule if filtered list no longer includes it
  useEffect(() => {
    if (
      filteredRules.length > 0 &&
      !filteredRules.some((r) => r.id === selectedRuleId)
    ) {
      setSelectedRuleId(filteredRules[0].id);
    }
  }, [filteredRules, selectedRuleId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopBeatSimulator = () => {
    if (beatTimerRef.current) {
      clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    setIsBeatRunning(false);
    setActiveBeatStep(0);
  };

  const handleToggleBeatSimulator = () => {
    if (isBeatRunning) {
      stopBeatSimulator();
      return;
    }

    const total = Math.max(1, selectedBeatCount);
    setIsBeatRunning(true);
    setActiveBeatStep(1);
    let step = 1;

    beatTimerRef.current = setInterval(() => {
      step += 1;
      if (step > total) {
        stopBeatSimulator();
      } else {
        setActiveBeatStep(step);
      }
    }, 460);
  };

  const handleToggleMastered = (ruleId: string) => {
    setMasteredIds((prev) => {
      const next = prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId];
      safeLocalStorage.setJSON(MASTERED_STORAGE_KEY, next);
      return next;
    });
  };

  const handleToggleExampleAudio = (
    key: string,
    surahNumber: number,
    ayahNumber: number
  ) => {
    setAudioError(null);
    const url = getAyahAudioUrl(activeReciter.serverKey, surahNumber, ayahNumber);

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingExampleKey(null);
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackRateRef.current;
        }
      };
      audioRef.current.onerror = () => {
        setPlayingExampleKey(null);
        setAudioError('تعذر تشغيل التلاوة الصوتية حالياً.');
      };
    }

    const audio = audioRef.current;
    if (playingExampleKey === key) {
      audio.pause();
      setPlayingExampleKey(null);
      return;
    }

    if (audio.src !== url) {
      audio.src = url;
    }
    audio.playbackRate = playbackRate;
    audio
      .play()
      .then(() => setPlayingExampleKey(key))
      .catch(() => {
        setPlayingExampleKey(null);
        setAudioError('تعذر بدء الصوت في المتصفح.');
      });
  };

  const parsedExamples = useMemo(() => {
    return selectedRule.examples.map((ex) => ({
      ...ex,
      words: alignUthmaniWithTajweed(ex.uthmani, ex.tajweedText),
    }));
  }, [selectedRule]);

  const masteredPercent = Math.round(
    (masteredIds.length / Math.max(1, TAJWEED_RULES.length)) * 100
  );

  const chapterMeta = useMemo(
    () => TAJWEED_CHAPTERS.find((c) => c.id === selectedRule.chapter) || TAJWEED_CHAPTERS[0],
    [selectedRule.chapter]
  );

  return (
    <div className="space-y-6">
      {/* Unified Header & Section Navigation */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-l from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/20 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              موسوعة التجويد التفاعلية الشاملة
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              منهج عملي متكامل يجمع أحكام التلاوة المصنّفة، وأطلس مخارج الحروف، ومختبر تشريح الآيات بالصوت، واختبارات متدرجة.
            </p>
          </div>

          {/* Mastery Progress Summary */}
          <div className="min-w-[210px] p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>تقدّم الإتقان</span>
              </span>
              <span className="font-bold text-emerald-300">
                {masteredIds.length} / {TAJWEED_RULES.length} ({masteredPercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${masteredPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4-Pillar Segmented Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {[
            { id: 'rules', label: 'مكتبة الأحكام', icon: BookOpen },
            { id: 'makharij', label: 'أطلس المخارج والصفات', icon: Compass },
            { id: 'lab', label: 'مختبر حلّل الآية', icon: FlaskConical },
            { id: 'quiz', label: 'منظومة الاختبارات', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as EncyclopediaTab)}
                className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: PHASE 1 — ORDERED INTERACTIVE RULES LIBRARY */}
      {activeTab === 'rules' && (
        <div className="space-y-5">
          {/* Search & Chapter Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الحكم أو الحرف (مثل: ق، ب، مد، إقلاب)..."
                className="w-full py-2 pr-9 pl-8 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="مسح البحث"
                  className="p-1 text-slate-400 hover:text-white absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedChapter('all')}
                className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedChapter === 'all'
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                جميع الأبواب ({TAJWEED_RULES.length})
              </button>
              {TAJWEED_CHAPTERS.map((chap) => {
                const isSelected = selectedChapter === chap.id;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => setSelectedChapter(chap.id)}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {chap.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Two-Zone Library Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Categorized Rules Sidebar (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {filteredRules.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-300">لا توجد أحكام مطابقة لبحثك «{searchTerm}».</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedChapter('all');
                    }}
                    className="py-1.5 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    عرض كل الأحكام
                  </button>
                </div>
              ) : (
                TAJWEED_CHAPTERS.filter(
                  (chap) =>
                    (selectedChapter === 'all' || selectedChapter === chap.id) &&
                    filteredRules.some((r) => r.chapter === chap.id)
                ).map((chap) => {
                  const chapRules = filteredRules.filter((r) => r.chapter === chap.id);
                  return (
                    <div key={chap.id} className="space-y-2">
                      <div className="px-1 flex items-center justify-between text-xs">
                        <h3 className="font-bold text-slate-300">{chap.title}</h3>
                        <span className="text-slate-500 tabular-nums">{chapRules.length}</span>
                      </div>

                      <div className="space-y-1.5">
                        {chapRules.map((rule) => {
                          const isSelected = selectedRule.id === rule.id;
                          const isMastered = masteredIds.includes(rule.id);
                          return (
                            <button
                              key={rule.id}
                              type="button"
                              onClick={() => setSelectedRuleId(rule.id)}
                              className={`w-full text-right p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/40'
                                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/15"
                                  style={{ backgroundColor: rule.colorHex }}
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-white truncate">
                                    {rule.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {rule.level} · {rule.mizan}
                                  </div>
                                </div>
                              </div>

                              {isMastered && (
                                <span
                                  title="تم إتقان الحكم"
                                  className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"
                                >
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Interactive Rule Details Stage (8 cols) */}
            <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              {/* Rule Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <span
                    className="w-7 h-7 rounded-xl shrink-0 border border-white/20"
                    style={{ backgroundColor: selectedRule.colorHex }}
                  />
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">{selectedRule.name}</h3>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span>{chapterMeta.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>المستوى: {selectedRule.level}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-300 font-semibold">{selectedRule.mizan}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleMastered(selectedRule.id)}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    masteredIds.includes(selectedRule.id)
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {masteredIds.includes(selectedRule.id) ? 'تمّ إتقانه' : 'تحديد كمتقَن'}
                  </span>
                </button>
              </div>

              {/* Definition & Letters */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-1.5">
                    التعريف العلمي والتطبيقي:
                  </span>
                  <p className="text-slate-200 text-sm leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {selectedRule.definition}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-2">حروف الحكم:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.letters.map((l, i) => (
                      <span
                        key={i}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-950 text-white font-bold text-sm border border-slate-800"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual Harakat Beat Metronome */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Timer className="w-4 h-4 text-emerald-400" />
                    <span>ميزان الزمن والحركات التفاعلي</span>
                    <span className="text-slate-400 font-normal">({selectedRule.beats.unit})</span>
                  </div>

                  {selectedRule.beats.options.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedRule.beats.options.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                          {selectedRule.beats.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                stopBeatSimulator();
                                setSelectedBeatCount(opt);
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-bold tabular-nums cursor-pointer ${
                                selectedBeatCount === opt
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleBeatSimulator}
                        className={`py-1.5 px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isBeatRunning
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isBeatRunning ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>إيقاف</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>ابدأ قياس الزمن</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {selectedRule.beats.options.length > 0 && (
                  <div className="grid grid-cols-6 gap-2 pt-1">
                    {Array.from({ length: selectedBeatCount }, (_, idx) => {
                      const stepNum = idx + 1;
                      const isLit = activeBeatStep >= stepNum;
                      const isCurrent = activeBeatStep === stepNum;
                      return (
                        <div
                          key={stepNum}
                          className={`py-2 rounded-lg border text-center text-xs font-bold tabular-nums transition-colors ${
                            isCurrent
                              ? 'bg-emerald-500 border-emerald-300 text-slate-950 scale-[1.03]'
                              : isLit
                              ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {stepNum}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed">{selectedRule.beats.note}</p>
              </div>

              {/* Authentic Interactive Colored Quranic Examples */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    أمثلة قرآنية تفاعلية (اضغط على أي كلمة لتحليلها):
                  </span>

                  <div className="flex items-center gap-2">
                    {selectedRule.ruleTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsolateRuleColors((prev) => !prev)}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isolateRuleColors
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {isolateRuleColors ? 'عرض كل ألوان الآية' : 'عزل لون هذا الحكم فقط'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                      className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold tabular-nums cursor-pointer whitespace-nowrap ${
                        playbackRate === 0.75
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                      title="تبطيء سرعة الصوت لسماع الغنة والمد بوضوح"
                    >
                      {playbackRate}x
                    </button>
                  </div>
                </div>

                {audioError && <p className="text-xs text-rose-400">{audioError}</p>}

                <div className="space-y-3">
                  {parsedExamples.map((ex, exIdx) => {
                    const exAudioKey = `${selectedRule.id}-${ex.surahNumber}-${ex.ayahNumber}`;
                    const isPlayingThis = playingExampleKey === exAudioKey;
                    const selectedWordInThisEx =
                      inspectedWord && inspectedWord.exampleIndex === exIdx
                        ? ex.words[inspectedWord.wordIndex]
                        : null;

                    return (
                      <div
                        key={exAudioKey}
                        className="p-4 sm:p-5 rounded-xl bg-[#0b1117] border border-slate-800 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-300 tabular-nums">
                            سورة {ex.surahName} · آية {ex.ayahNumber}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleExampleAudio(
                                  exAudioKey,
                                  ex.surahNumber,
                                  ex.ayahNumber
                                )
                              }
                              className={`py-1 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                isPlayingThis
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              {isPlayingThis ? (
                                <>
                                  <Pause className="w-3 h-3 fill-current" />
                                  <span>إيقاف</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>استمع</span>
                                </>
                              )}
                            </button>

                            {onNavigateToAyah && (
                              <button
                                type="button"
                                onClick={() => onNavigateToAyah(ex.surahNumber, ex.ayahNumber)}
                                className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <span>في المصحف</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive Colored Uthmani Ayah */}
                        <p className="font-quran text-2xl sm:text-3xl leading-[2.5] text-center text-slate-100">
                          {ex.words.map((wordTokens, wIdx) => {
                            const isWordSelected =
                              inspectedWord?.exampleIndex === exIdx &&
                              inspectedWord?.wordIndex === wIdx;
                            return (
                              <React.Fragment key={wIdx}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInspectedWord((prev) =>
                                      prev &&
                                      prev.exampleIndex === exIdx &&
                                      prev.wordIndex === wIdx
                                        ? null
                                        : { exampleIndex: exIdx, wordIndex: wIdx }
                                    )
                                  }
                                  className={`inline cursor-pointer rounded px-0.5 transition-colors ${
                                    isWordSelected
                                      ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                                      : 'hover:bg-slate-800/70'
                                  }`}
                                >
                                  {wordTokens.map((tok, tIdx) => {
                                    const matchesCurrentRule =
                                      tok.rule && selectedRule.ruleTypes.includes(tok.rule);

                                    if (!tok.rule) {
                                      return (
                                        <span
                                          key={tIdx}
                                          className={
                                            isolateRuleColors ? 'text-slate-500' : undefined
                                          }
                                        >
                                          {tok.text}
                                        </span>
                                      );
                                    }

                                    if (isolateRuleColors && !matchesCurrentRule) {
                                      return (
                                        <span key={tIdx} className="text-slate-500">
                                          {tok.text}
                                        </span>
                                      );
                                    }

                                    return (
                                      <span
                                        key={tIdx}
                                        className={RULE_CLASS_MAP[tok.rule] || ''}
                                        title={tok.tooltip}
                                      >
                                        {tok.text}
                                      </span>
                                    );
                                  })}
                                </button>
                                {wIdx < ex.words.length - 1 && ' '}
                              </React.Fragment>
                            );
                          })}
                        </p>

                        <p className="text-xs text-slate-300 text-center leading-relaxed">
                          {ex.focusNote}
                        </p>

                        {/* Inline Clicked Word Breakdown */}
                        {selectedWordInThisEx && (
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-300">
                                تفصيل الكلمة:{' '}
                                <span className="font-quran text-lg text-white">
                                  {selectedWordInThisEx.map((t) => t.text).join('')}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectedWord(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                إغلاق
                              </button>
                            </div>
                            {selectedWordInThisEx.some((t) => t.rule) ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedWordInThisEx
                                  .filter((t) => Boolean(t.rule))
                                  .map((tok, i) => (
                                    <span
                                      key={i}
                                      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200"
                                    >
                                      <strong
                                        className={`font-quran text-base ml-1 ${
                                          tok.rule ? RULE_CLASS_MAP[tok.rule] : ''
                                        }`}
                                      >
                                        {tok.text}
                                      </strong>
                                      {tok.tooltip}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 block">
                                حروف هذه الكلمة تُنطق بالإظهار الأصلي دون حكم تلوين خاص.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Common Mistakes vs Correct Articulation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <X className="w-4 h-4 shrink-0" />
                    <span>خطأ شائع يُحذَر منه</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedRule.commonMistake.mistake}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>الأداء الصحيح</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedRule.commonMistake.correction}
                  </p>
                </div>
              </div>

              {/* Practical Acoustic Benefit */}
              <div className="text-xs text-slate-300 leading-relaxed pt-1">
                <strong className="text-emerald-400">الأثر الصوتي والجمالي: </strong>
                {selectedRule.benefit}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: PHASE 2A — INTERACTIVE MAKHARIJ & QUALITIES ATLAS */}
      {activeTab === 'makharij' && <MakharijAtlas />}

      {/* SECTION 3: PHASE 2B — LIVE AYAH TAJWEED DISSECTION LAB */}
      {activeTab === 'lab' && (
        <AyahTajweedLab
          selectedReciter={selectedReciter}
          onNavigateToAyah={onNavigateToAyah}
        />
      )}

      {/* SECTION 4: PHASE 3 — MULTI-MODE GRADED QUIZ HUB */}
      {activeTab === 'quiz' && <TajweedQuizHub selectedReciter={selectedReciter} />}
    </div>
  );
};
