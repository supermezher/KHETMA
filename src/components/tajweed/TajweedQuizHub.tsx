import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  QuizCategoryId,
  TAJWEED_QUIZ,
  TajweedQuizQuestion,
  TajweedQuizQuestionType,
} from '../../data/tajweedRules';
import { RECITERS_LIST, Reciter, getAyahAudioUrl } from '../../data/reciters';
import { alignUthmaniWithTajweed } from '../../utils/tajweedParser';
import { safeLocalStorage } from '../../utils/safeStorage';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

export interface ChapterQuizStats {
  answered: number;
  correct: number;
}

export type QuizStatsMap = Record<QuizCategoryId, ChapterQuizStats>;

const QUIZ_STATS_STORAGE_KEY = 'bayan_tajweed_quiz_stats_v1';

const DEFAULT_STATS: QuizStatsMap = {
  'noon-meem': { answered: 0, correct: 0 },
  madd: { answered: 0, correct: 0 },
  articulation: { answered: 0, correct: 0 },
  makharij: { answered: 0, correct: 0 },
};

const CATEGORY_LABELS: Record<QuizCategoryId, string> = {
  'noon-meem': 'النون والميم والغنة',
  madd: 'المدود ومقاديرها',
  articulation: 'القلقلة والتفخيم والصامت',
  makharij: 'مخارج الحروف والصفات',
};

const TYPE_LABELS: Record<TajweedQuizQuestionType, string> = {
  mcq: 'اختيار من متعدد',
  'spot-word': 'تحديد من الآية',
  audio: 'اختبار سماعي',
};

function loadSavedQuizStats(): QuizStatsMap {
  const saved = safeLocalStorage.getJSON<Partial<QuizStatsMap>>(QUIZ_STATS_STORAGE_KEY, {});
  return {
    'noon-meem': saved['noon-meem'] || { answered: 0, correct: 0 },
    madd: saved.madd || { answered: 0, correct: 0 },
    articulation: saved.articulation || { answered: 0, correct: 0 },
    makharij: saved.makharij || { answered: 0, correct: 0 },
  };
}

interface TajweedQuizHubProps {
  selectedReciter?: Reciter;
  onStatsChange?: (stats: QuizStatsMap) => void;
}

export const TajweedQuizHub: React.FC<TajweedQuizHubProps> = ({
  selectedReciter,
  onStatsChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<QuizCategoryId | 'all'>('all');
  const [selectedType, setSelectedType] = useState<TajweedQuizQuestionType | 'all'>('all');
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  // Per-session answers: questionId -> { isCorrect, chosenOption?: number, chosenWordIndex?: number }
  const [sessionAnswers, setSessionAnswers] = useState<
    Record<
      number,
      { isCorrect: boolean; chosenOption?: number; chosenWordIndex?: number }
    >
  >({});

  const [savedStats, setSavedStats] = useState<QuizStatsMap>(() => loadSavedQuizStats());

  // Audio playback for audio-type questions
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<0.75 | 1>(1);
  const [audioError, setAudioError] = useState<string | null>(null);

  const activeReciter = selectedReciter || RECITERS_LIST[0];

  const filteredQuestions = useMemo(() => {
    return TAJWEED_QUIZ.filter((q) => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
      if (selectedType !== 'all' && q.type !== selectedType) return false;
      return true;
    });
  }, [selectedCategory, selectedType]);

  const currentQuestion: TajweedQuizQuestion | undefined =
    filteredQuestions[Math.min(currentIdx, Math.max(0, filteredQuestions.length - 1))];

  useEffect(() => {
    setCurrentIdx(0);
  }, [selectedCategory, selectedType]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);
    setAudioError(null);
  }, [currentQuestion?.id]);

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

  const recordAnswer = (
    question: TajweedQuizQuestion,
    result: { isCorrect: boolean; chosenOption?: number; chosenWordIndex?: number }
  ) => {
    if (sessionAnswers[question.id]) return; // already graded for this attempt

    setSessionAnswers((prev) => ({ ...prev, [question.id]: result }));

    setSavedStats((prev) => {
      const cat = prev[question.category] || { answered: 0, correct: 0 };
      const next: QuizStatsMap = {
        ...prev,
        [question.category]: {
          answered: cat.answered + 1,
          correct: cat.correct + (result.isCorrect ? 1 : 0),
        },
      };
      safeLocalStorage.setJSON(QUIZ_STATS_STORAGE_KEY, next);
      onStatsChange?.(next);
      return next;
    });
  };

  const handleChooseOption = (question: TajweedQuizQuestion, optionIdx: number) => {
    if (sessionAnswers[question.id]) return;
    recordAnswer(question, {
      isCorrect: optionIdx === question.correctIndex,
      chosenOption: optionIdx,
    });
  };

  const handleChooseSpotWord = (question: TajweedQuizQuestion, wordIdx: number) => {
    if (sessionAnswers[question.id] || !question.spotAyah) return;
    const isCorrect = question.spotAyah.targetWordIndices.includes(wordIdx);
    recordAnswer(question, {
      isCorrect,
      chosenWordIndex: wordIdx,
    });
  };

  const handlePlayQuestionAudio = () => {
    if (!currentQuestion?.audioRef) return;
    setAudioError(null);
    const { surahNumber, ayahNumber } = currentQuestion.audioRef;
    const url = getAyahAudioUrl(activeReciter.serverKey, surahNumber, ayahNumber);

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setIsPlayingAudio(false);
      audioRef.current.onerror = () => {
        setIsPlayingAudio(false);
        setAudioError('تعذر تشغيل التلاوة الصوتية حالياً.');
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
        setAudioError('تعذر بدء الصوت في المتصفح.');
      });
  };

  const handleResetSession = () => {
    setSessionAnswers({});
    setCurrentIdx(0);
  };

  const handleResetAllStats = () => {
    setSavedStats(DEFAULT_STATS);
    safeLocalStorage.setJSON(QUIZ_STATS_STORAGE_KEY, DEFAULT_STATS);
    onStatsChange?.(DEFAULT_STATS);
    setSessionAnswers({});
    setCurrentIdx(0);
  };

  const sessionScore = useMemo(() => {
    let answered = 0;
    let correct = 0;
    filteredQuestions.forEach((q) => {
      const ans = sessionAnswers[q.id];
      if (ans) {
        answered++;
        if (ans.isCorrect) correct++;
      }
    });
    return { answered, correct };
  }, [filteredQuestions, sessionAnswers]);

  const weakestCategory = useMemo<{ id: QuizCategoryId; ratio: number } | null>(() => {
    let worst: { id: QuizCategoryId; ratio: number } | null = null;
    for (const catId of Object.keys(CATEGORY_LABELS) as QuizCategoryId[]) {
      const st = savedStats[catId];
      if (st && st.answered > 0) {
        const ratio = st.correct / st.answered;
        if (!worst || ratio < worst.ratio) {
          worst = { id: catId, ratio };
        }
      }
    }
    return worst;
  }, [savedStats]);

  const spotWords = useMemo(() => {
    if (!currentQuestion?.spotAyah) return [];
    return alignUthmaniWithTajweed(
      currentQuestion.spotAyah.uthmani,
      currentQuestion.spotAyah.tajweedText
    );
  }, [currentQuestion]);

  const currentAnswer = currentQuestion ? sessionAnswers[currentQuestion.id] : undefined;

  return (
    <div className="space-y-5">
      {/* Category & Mode Filters + Overall Mastery Strip */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">منظومة التدريب والاختبارات المتدرجة</h3>
            <p className="text-xs text-slate-400">
              تدرب على الاستخراج البصري من الآيات، والتمييز السمعي، وضبط الأحكام بتصحيح فوري
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>
                الجولة: {sessionScore.correct} / {sessionScore.answered} صحيح
              </span>
            </span>
            <button
              type="button"
              onClick={handleResetSession}
              className="py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة الجولة</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              كل الأبواب ({TAJWEED_QUIZ.length})
            </button>
            {(Object.keys(CATEGORY_LABELS) as QuizCategoryId[]).map((catId) => {
              const isSelected = selectedCategory === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategory(catId)}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {CATEGORY_LABELS[catId]}
                </button>
              );
            })}
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-slate-800 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              كل الأنماط
            </button>
            {(Object.keys(TYPE_LABELS) as TajweedQuizQuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedType === t
                    ? 'bg-slate-800 text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Question Card */}
      {filteredQuestions.length === 0 || !currentQuestion ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <p className="text-sm text-slate-300">لا توجد أسئلة مطابقة لهذا التصنيف والنمط معاً.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedType('all');
            }}
            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
          >
            عرض جميع الأسئلة
          </button>
        </div>
      ) : (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          {/* Question Header & Progress */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400 tabular-nums">
                <span className="font-bold text-white">
                  السؤال {currentIdx + 1} من {filteredQuestions.length}
                </span>
                <span aria-hidden="true">·</span>
                <span>{CATEGORY_LABELS[currentQuestion.category]}</span>
                <span aria-hidden="true">·</span>
                <span>{TYPE_LABELS[currentQuestion.type]}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">{currentQuestion.difficulty}</span>
              </div>

              {currentAnswer && (
                <span
                  className={`font-bold flex items-center gap-1 ${
                    currentAnswer.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {currentAnswer.isCorrect ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>إجابة صحيحة</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>إجابة غير صحيحة</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Linear Progress Bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / filteredQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Prompt */}
          <h4 className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {currentQuestion.question}
          </h4>

          {/* MODE A: Spot-Word Interactive Ayah Click */}
          {currentQuestion.type === 'spot-word' && currentQuestion.spotAyah ? (
            <div className="space-y-3">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0b1117] border border-slate-800 text-center space-y-3">
                <p className="font-quran text-2xl sm:text-3xl leading-[2.6] text-slate-100">
                  {spotWords.map((wordTokens, wIdx) => {
                    const isTarget =
                      currentQuestion.spotAyah!.targetWordIndices.includes(wIdx);
                    const isChosen = currentAnswer?.chosenWordIndex === wIdx;

                    let wordClass = 'hover:bg-slate-800/80 text-slate-100';
                    if (currentAnswer) {
                      if (isTarget) {
                        wordClass =
                          'bg-emerald-500/20 ring-1 ring-emerald-400 text-white';
                      } else if (isChosen && !isTarget) {
                        wordClass = 'bg-rose-500/20 ring-1 ring-rose-400 text-rose-200';
                      }
                    }

                    return (
                      <React.Fragment key={wIdx}>
                        <button
                          type="button"
                          disabled={Boolean(currentAnswer)}
                          onClick={() => handleChooseSpotWord(currentQuestion, wIdx)}
                          className={`inline rounded-lg px-1.5 py-0.5 transition-colors cursor-pointer disabled:cursor-default ${wordClass}`}
                        >
                          {wordTokens.map((tok, tIdx) => {
                            // Reveal full Tajweed color classes only after answering
                            if (currentAnswer && tok.rule) {
                              const cls =
                                tok.rule === 'silent'
                                  ? 'tajweed-silent'
                                  : tok.rule === 'ghunnah'
                                  ? 'tajweed-ghunnah'
                                  : tok.rule === 'ikhfa'
                                  ? 'tajweed-ikhfa'
                                  : tok.rule === 'idgham'
                                  ? 'tajweed-idgham'
                                  : tok.rule === 'iqlab'
                                  ? 'tajweed-iqlab'
                                  : tok.rule === 'qalqalah'
                                  ? 'tajweed-qalqalah'
                                  : tok.rule === 'madd-lazim'
                                  ? 'tajweed-madd-lazim'
                                  : tok.rule === 'madd-wajib'
                                  ? 'tajweed-madd-wajib'
                                  : tok.rule === 'madd-arid'
                                  ? 'tajweed-madd-arid'
                                  : tok.rule === 'madd-tabeei'
                                  ? 'tajweed-madd-tabeei'
                                  : tok.rule === 'madd-badal'
                                  ? 'tajweed-madd-badal'
                                  : 'tajweed-tafkheem';
                              return (
                                <span key={tIdx} className={cls}>
                                  {tok.text}
                                </span>
                              );
                            }
                            return <React.Fragment key={tIdx}>{tok.text}</React.Fragment>;
                          })}
                        </button>
                        {wIdx < spotWords.length - 1 && ' '}
                      </React.Fragment>
                    );
                  })}
                </p>

                {!currentAnswer && (
                  <p className="text-xs text-emerald-300 flex items-center justify-center gap-1.5">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>اضغط مباشرة على الكلمة المطلوبة في الآية</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* MODE B & C: Quranic Snippet + Optional Real Audio Player + Options Grid */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#0b1117] border border-slate-800 text-center space-y-3">
                <p className="font-quran text-2xl sm:text-3xl leading-[2.4] text-emerald-200">
                  {currentQuestion.ayahSnippet}
                </p>

                {currentQuestion.type === 'audio' && currentQuestion.audioRef && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handlePlayQuestionAudio}
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
                          <Headphones className="w-3.5 h-3.5" />
                          <span>
                            استمع لتلاوة {activeReciter.name.split(' ')[0]} (
                            {currentQuestion.audioRef.surahName}: {currentQuestion.audioRef.ayahNumber})
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        playbackRate === 0.75
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      السرعة: {playbackRate}x
                    </button>

                    {audioError && <span className="text-xs text-rose-400">{audioError}</span>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentQuestion.options.map((opt, oIdx) => {
                  const isChosen = currentAnswer?.chosenOption === oIdx;
                  const isCorrectOpt = oIdx === currentQuestion.correctIndex;

                  let style =
                    'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-900';

                  if (currentAnswer) {
                    if (isCorrectOpt) {
                      style = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold';
                    } else if (isChosen && !isCorrectOpt) {
                      style = 'bg-rose-950/70 border-rose-500 text-rose-200';
                    } else {
                      style = 'bg-slate-950/60 border-slate-800/70 text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={Boolean(currentAnswer)}
                      onClick={() => handleChooseOption(currentQuestion, oIdx)}
                      className={`min-h-[48px] p-3.5 rounded-xl border text-right text-xs sm:text-sm transition-all flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${style}`}
                    >
                      <span>{opt}</span>
                      {currentAnswer && isCorrectOpt && (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {currentAnswer && isChosen && !isCorrectOpt && (
                        <X className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Immediate Pedagogical Explanation */}
          {currentAnswer && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-emerald-400 block">الشرح والتوجيه العلمي:</span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx <= 0}
              className="py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السؤال السابق</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-md py-1">
              {filteredQuestions.map((q, idx) => {
                const ans = sessionAnswers[q.id];
                const isCur = idx === currentIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    aria-label={`الانتقال للسؤال ${idx + 1}`}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold tabular-nums shrink-0 transition-colors cursor-pointer ${
                      isCur
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300/60'
                        : ans
                        ? ans.isCorrect
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(filteredQuestions.length - 1, i + 1))}
              disabled={currentIdx >= filteredQuestions.length - 1}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span>السؤال التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Saved Chapter Accuracy Summary & Smart Review Suggestion */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-white">سجل إتقان الأبواب التراكمي</h4>
            <p className="text-xs text-slate-400">يُحفظ مستواك محلياً لمساعدتك على مراجعة نقاط الضعف</p>
          </div>

          <div className="flex items-center gap-2">
            {weakestCategory && weakestCategory.ratio < 0.85 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(weakestCategory.id);
                  setSelectedType('all');
                }}
                className="py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                راجع الأضعف: {CATEGORY_LABELS[weakestCategory.id]}
              </button>
            )}
            <button
              type="button"
              onClick={handleResetAllStats}
              className="py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
            >
              تصفير السجل
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(CATEGORY_LABELS) as QuizCategoryId[]).map((catId) => {
            const st = savedStats[catId] || { answered: 0, correct: 0 };
            const pct = st.answered > 0 ? Math.round((st.correct / st.answered) * 100) : 0;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => setSelectedCategory(catId)}
                className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-right space-y-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white truncate">{CATEGORY_LABELS[catId]}</span>
                  <span className="font-bold tabular-nums text-emerald-400 shrink-0">
                    {st.answered > 0 ? `${pct}%` : '—'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {st.answered > 0 ? `${st.correct} صحيح من ${st.answered} محاولة` : 'لم تبدأ بعد'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
