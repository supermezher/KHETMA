import React, { useState, useEffect, useMemo } from 'react';
import { Ayah, sanitizeAyahText } from '../data/quranService';
import { safeLocalStorage } from '../utils/safeStorage';
import { formatLocalDate, addDaysLocal } from '../data/faithAnalyticsService';
import { Eye, EyeOff, RotateCcw, CheckCircle2, Award, ChevronLeft, ChevronRight, Volume2, BrainCircuit, CalendarClock } from 'lucide-react';

interface MemorizationModeProps {
  ayahs: Ayah[];
  surahNumber: number;
  surahName: string;
  onClose: () => void;
  onPlayAyah: (ayahNum: number) => void;
}

type HidePattern = 'first-word-only' | 'alternate-words' | 'all-blank';
type StudyTab = 'recite' | 'linking-quiz';
type SrsRating = 'needs-review' | 'good' | 'mastered';

export interface SrsRecord {
  status: SrsRating;
  intervalDays: number;
  nextReviewDate: string; // YYYY-MM-DD local
  repetitions: number;
  lastReviewedAt: string;
}

const SRS_STORAGE_KEY = 'bayan_memorization_srs_v2';

export function computeNextSrsState(prev: SrsRecord | undefined, rating: SrsRating, today = new Date()): SrsRecord {
  const prevReps = prev?.repetitions || 0;
  let intervalDays = 1;
  let repetitions = prevReps + 1;

  if (rating === 'needs-review') {
    intervalDays = 1;
    repetitions = 0;
  } else if (rating === 'good') {
    intervalDays = prev?.intervalDays ? Math.min(14, Math.max(3, Math.round(prev.intervalDays * 2))) : 3;
  } else {
    intervalDays = prev?.intervalDays ? Math.min(30, Math.max(7, Math.round(prev.intervalDays * 2.5))) : 7;
  }

  return {
    status: rating,
    intervalDays,
    nextReviewDate: formatLocalDate(addDaysLocal(today, intervalDays)),
    repetitions,
    lastReviewedAt: today.toISOString(),
  };
}

export const MemorizationMode: React.FC<MemorizationModeProps> = ({
  ayahs,
  surahNumber,
  surahName,
  onClose,
  onPlayAyah,
}) => {
  const [studyTab, setStudyTab] = useState<StudyTab>('recite');
  const [onlyDueFilter, setOnlyDueFilter] = useState<boolean>(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hidePattern, setHidePattern] = useState<HidePattern>('first-word-only');
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());
  const [repeatCount] = useState(3);
  const [currentRepeat, setCurrentRepeat] = useState(1);

  const [srsMap, setSrsMap] = useState<Record<string, SrsRecord>>(() => {
    return safeLocalStorage.getJSON<Record<string, SrsRecord>>(SRS_STORAGE_KEY, {});
  });

  // Linking Quiz state (اختبار ربط أوائل الآيات)
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOptionAyah, setSelectedOptionAyah] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const todayStr = formatLocalDate(new Date());

  const dueAyahs = useMemo(() => {
    return ayahs.filter((a) => {
      const rec = srsMap[`${surahNumber}:${a.numberInSurah}`];
      return !rec || rec.nextReviewDate <= todayStr;
    });
  }, [ayahs, srsMap, surahNumber, todayStr]);

  const activeAyahList = onlyDueFilter && dueAyahs.length > 0 ? dueAyahs : ayahs;
  const safeIdx = Math.min(currentIdx, Math.max(0, activeAyahList.length - 1));
  const currentAyah = activeAyahList[safeIdx] || ayahs[0];

  // Linking quiz options for ayahs[quizIndex] -> guess ayahs[quizIndex + 1]
  const quizPrompts = useMemo(() => {
    if (ayahs.length < 2) return [];
    return ayahs.slice(0, ayahs.length - 1).map((promptAyah, i) => {
      const nextAyah = ayahs[i + 1];
      const distractors = ayahs
        .filter((candidate) => candidate.numberInSurah !== nextAyah.numberInSurah && candidate.numberInSurah !== promptAyah.numberInSurah)
        .sort((a, b) => ((a.numberInSurah * 31 + i) % 17) - ((b.numberInSurah * 31 + i) % 17))
        .slice(0, 3);
      const options = [nextAyah, ...distractors].sort((a, b) => ((a.numberInSurah * 13 + i) % 19) - ((b.numberInSurah * 13 + i) % 19));
      return { promptAyah, answerAyah: nextAyah, options };
    });
  }, [ayahs]);

  if (!currentAyah) return null;

  const cleanText = sanitizeAyahText(currentAyah.text, surahNumber, currentAyah.numberInSurah);
  const words = cleanText.trim() ? cleanText.trim().split(/\s+/) : [];
  const currentRecord = srsMap[`${surahNumber}:${currentAyah.numberInSurah}`];

  const handleNextAyah = () => {
    if (safeIdx < activeAyahList.length - 1) {
      setCurrentIdx(safeIdx + 1);
      setRevealedWordIndices(new Set());
      setCurrentRepeat(1);
    }
  };

  const handlePrevAyah = () => {
    if (safeIdx > 0) {
      setCurrentIdx(safeIdx - 1);
      setRevealedWordIndices(new Set());
      setCurrentRepeat(1);
    }
  };

  const toggleRevealWord = (index: number) => {
    const updated = new Set(revealedWordIndices);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setRevealedWordIndices(updated);
  };

  const revealAll = () => {
    setRevealedWordIndices(new Set(words.map((_, i) => i)));
  };

  const hideAll = () => {
    setRevealedWordIndices(new Set());
  };

  const setAyahMastery = (status: SrsRating) => {
    const key = `${surahNumber}:${currentAyah.numberInSurah}`;
    setSrsMap((prev) => {
      const nextRecord = computeNextSrsState(prev[key], status);
      const updated = { ...prev, [key]: nextRecord };
      safeLocalStorage.setJSON(SRS_STORAGE_KEY, updated);
      return updated;
    });
    if (safeIdx < activeAyahList.length - 1) {
      handleNextAyah();
    }
  };

  const isWordHidden = (index: number) => {
    if (revealedWordIndices.has(index)) return false;
    if (hidePattern === 'all-blank') return true;
    if (hidePattern === 'first-word-only') return index > 0;
    if (hidePattern === 'alternate-words') return index % 2 === 1;
    return false;
  };

  const activeQuizItem = quizPrompts[quizIndex];

  const handlePickQuizOption = (chosenNumber: number) => {
    if (!activeQuizItem || selectedOptionAyah !== null) return;
    setSelectedOptionAyah(chosenNumber);
    const isCorrect = chosenNumber === activeQuizItem.answerAyah.numberInSurah;
    setQuizScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    if (!isCorrect) {
      // Automatically mark the target verse for review tomorrow
      const key = `${surahNumber}:${activeQuizItem.answerAyah.numberInSurah}`;
      setSrsMap((prev) => {
        const updated = { ...prev, [key]: computeNextSrsState(prev[key], 'needs-review') };
        safeLocalStorage.setJSON(SRS_STORAGE_KEY, updated);
        return updated;
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="حلقة التسميع وتثبيت الحفظ"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-emerald-800/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-emerald-950/60 to-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>حلقة التسميع وتثبيت الحفظ</span>
                <span className="text-xs text-emerald-300 font-normal">· سورة {surahName}</span>
              </h2>
              <p className="text-xs text-slate-400 tabular-nums">
                مستحق للمراجعة اليوم: {dueAyahs.length} من {ayahs.length} آية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switch */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStudyTab('recite')}
                className={`py-1.5 px-3 rounded-lg font-bold transition-colors cursor-pointer ${
                  studyTab === 'recite' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                التسميع المتدرج
              </button>
              <button
                onClick={() => setStudyTab('linking-quiz')}
                disabled={quizPrompts.length === 0}
                className={`py-1.5 px-3 rounded-lg font-bold flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer ${
                  studyTab === 'linking-quiz' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>اختبار ربط الآيات</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              خروج
            </button>
          </div>
        </div>

        {studyTab === 'recite' ? (
          <>
            {/* Toolbar & Pattern Selector */}
            <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 ml-1">نمط الإخفاء:</span>
                {[
                  { id: 'first-word-only', label: 'مطلع الآية فقط' },
                  { id: 'alternate-words', label: 'كلمة بعد كلمة' },
                  { id: 'all-blank', label: 'حجب كامل الآية' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setHidePattern(p.id as HidePattern);
                      setRevealedWordIndices(new Set());
                    }}
                    className={`py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
                      hidePattern === p.id
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setOnlyDueFilter(!onlyDueFilter);
                    setCurrentIdx(0);
                    setRevealedWordIndices(new Set());
                  }}
                  className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                    onlyDueFilter
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>{onlyDueFilter ? 'المستحقات اليوم فقط' : 'كل الآيات'}</span>
                </button>
                <button
                  onClick={revealAll}
                  className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>كشف الكل</span>
                </button>
                <button
                  onClick={hideAll}
                  className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>حجب مجدداً</span>
                </button>
              </div>
            </div>

            {/* Main Testing Canvas */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[250px] text-center select-none bg-radial from-slate-900 to-slate-950">
              <div className="text-xs text-emerald-400/90 mb-3 font-semibold flex items-center gap-2 tabular-nums">
                <span>الآية {currentAyah.numberInSurah} ({safeIdx + 1} من {activeAyahList.length})</span>
                {currentRecord && (
                  <span className="text-slate-400 font-normal">
                    · المراجعة القادمة: {currentRecord.nextReviewDate}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 font-quran text-2xl sm:text-3xl text-slate-100 max-w-2xl leading-relaxed">
                {words.map((word, idx) => {
                  const hidden = isWordHidden(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleRevealWord(idx)}
                      className={`transition-all duration-200 rounded px-2 py-0.5 relative group ${
                        hidden
                          ? 'bg-emerald-950/80 border border-emerald-500/40 text-transparent hover:border-emerald-400 shadow-inner min-w-[3.5rem] cursor-pointer'
                          : 'hover:bg-emerald-500/10 cursor-pointer'
                      }`}
                      title={hidden ? 'انقر لكشف الكلمة' : 'انقر لإخفاء الكلمة'}
                    >
                      <span className={hidden ? 'opacity-0 select-none' : 'opacity-100'}>
                        {word}
                      </span>
                      {hidden && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-sans text-emerald-400/60 group-hover:text-emerald-300">
                          ؟
                        </span>
                      )}
                    </button>
                  );
                })}
                <span className="text-emerald-400 font-sans text-lg font-bold">
                  ﴿{currentAyah.numberInSurah}﴾
                </span>
              </div>

              <p className="text-xs text-slate-500 mt-6">
                انقر على أي كلمة مخفية لكشفها عند التعثر للتأكد من حفظك
              </p>
            </div>

            {/* Spaced Repetition Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onPlayAyah(currentAyah.numberInSurah)}
                  className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>استماع</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 tabular-nums">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>التكرار:</span>
                  <button
                    onClick={() => setCurrentRepeat((prev) => (prev >= repeatCount ? 1 : prev + 1))}
                    className="font-bold text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {currentRepeat} / {repeatCount}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span className="text-slate-400 ml-1">تقييم الحفظ:</span>
                <button
                  onClick={() => setAyahMastery('needs-review')}
                  className="py-1.5 px-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 font-medium transition-colors cursor-pointer"
                >
                  تثبيت (غداً)
                </button>
                <button
                  onClick={() => setAyahMastery('good')}
                  className="py-1.5 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 font-medium transition-colors cursor-pointer"
                >
                  جيد (مضاعف)
                </button>
                <button
                  onClick={() => setAyahMastery('mastered')}
                  className="py-1.5 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>متقن (متباعد)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevAyah}
                  disabled={safeIdx === 0}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextAyah}
                  disabled={safeIdx === activeAyahList.length - 1}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Linking Quiz Mode */
          activeQuizItem && (
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-400 tabular-nums">
                <span>السؤال {quizIndex + 1} من {quizPrompts.length} · اختر الآية التي تلي الآية المعروضة</span>
                <span className="text-emerald-400 font-bold">
                  النتيجة: {quizScore.correct} / {quizScore.total}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-500">الآية {activeQuizItem.promptAyah.numberInSurah}</span>
                <p className="font-quran text-2xl text-emerald-100 leading-loose">
                  ﴿ {sanitizeAyahText(activeQuizItem.promptAyah.text, surahNumber, activeQuizItem.promptAyah.numberInSurah)} ﴾
                </p>
              </div>

              <div className="space-y-2.5">
                {activeQuizItem.options.map((opt) => {
                  const isAnswered = selectedOptionAyah !== null;
                  const isCorrectOpt = opt.numberInSurah === activeQuizItem.answerAyah.numberInSurah;
                  const isChosen = selectedOptionAyah === opt.numberInSurah;

                  let style = 'bg-slate-950/70 border-slate-800 text-slate-200 hover:border-emerald-500/50';
                  if (isAnswered) {
                    if (isCorrectOpt) style = 'bg-emerald-950/70 border-emerald-500 text-emerald-200';
                    else if (isChosen) style = 'bg-rose-950/70 border-rose-500 text-rose-200';
                  }

                  return (
                    <button
                      key={opt.numberInSurah}
                      onClick={() => handlePickQuizOption(opt.numberInSurah)}
                      className={`w-full p-4 rounded-xl border text-right font-quran text-xl leading-relaxed transition-all cursor-pointer ${style}`}
                    >
                      {sanitizeAyahText(opt.text, surahNumber, opt.numberInSurah)}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {selectedOptionAyah !== null &&
                    (selectedOptionAyah === activeQuizItem.answerAyah.numberInSurah
                      ? 'أحسنت! ربط متقن للآية التالية.'
                      : `الإجابة الصحيحة هي الآية ${activeQuizItem.answerAyah.numberInSurah}، وتمت جدولتها للمراجعة غداً.`)}
                </span>
                <button
                  onClick={() => {
                    setSelectedOptionAyah(null);
                    setQuizIndex((prev) => (prev + 1 < quizPrompts.length ? prev + 1 : 0));
                  }}
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  {quizIndex + 1 < quizPrompts.length ? 'السؤال التالي' : 'إعادة الاختبار'}
                </button>
              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
};
