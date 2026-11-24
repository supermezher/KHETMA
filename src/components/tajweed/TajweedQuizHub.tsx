import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  QuizCategoryId,
  TAJWEED_QUIZ,
  TajweedQuizQuestion,
  TajweedQuizQuestionType,
  getQuizQuestionDifficulty,
  getQuizQuestionExplanation,
  getQuizQuestionOptions,
  getQuizQuestionText,
} from '../../data/tajweedRules';
import { RECITERS_LIST, Reciter, getAyahAudioUrl, getReciterDisplayName } from '../../data/reciters';
import { SURAHS_LIST, getSurahDisplayName } from '../../data/quranMetadata';
import { alignUthmaniWithTajweed, getTajweedTokenTooltip } from '../../utils/tajweedParser';
import { safeLocalStorage } from '../../utils/safeStorage';
import { formatLocalizedDigits, useLanguage } from '../../utils/i18n';
import {
  evaluateRecitationAgainstAyah,
  getSpeechRecognitionConstructor,
  RecitationEvaluationResult,
  SpeechRecognitionLike,
} from '../../utils/recitationMatcher';
import { AudioLevelMeter } from '../AudioLevelMeter';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Mic,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Square,
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

const CATEGORY_LABELS: Record<QuizCategoryId, { ar: string; en: string }> = {
  'noon-meem': { ar: 'النون والميم والغنة', en: 'Noon, Meem & Ghunnah' },
  madd: { ar: 'المدود ومقاديرها', en: 'Madd & Counts' },
  articulation: { ar: 'القلقلة والتفخيم والصامت', en: 'Qalqalah, Tafkheem & Silent' },
  makharij: { ar: 'مخارج الحروف والصفات', en: 'Makharij & Sifat' },
};

const TYPE_LABELS: Record<TajweedQuizQuestionType, { ar: string; en: string }> = {
  mcq: { ar: 'اختيار من متعدد', en: 'Multiple Choice' },
  'spot-word': { ar: 'تحديد من الآية', en: 'Spot in Ayah' },
  audio: { ar: 'اختبار سماعي', en: 'Audio Recognition' },
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
  onPauseAudio?: () => void;
}

export const TajweedQuizHub: React.FC<TajweedQuizHubProps> = ({
  selectedReciter,
  onStatsChange,
  onPauseAudio,
}) => {
  const { lang, isEnglish } = useLanguage();
  const isEnglishRef = useRef<boolean>(isEnglish);
  isEnglishRef.current = isEnglish;
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
  const playbackRateRef = useRef<0.75 | 1>(playbackRate);
  playbackRateRef.current = playbackRate;
  const [audioError, setAudioError] = useState<string | null>(null);

  // Live vocal recitation check + local MediaRecorder on spot-word questions (aligned with MemorizationMode)
  const [isSpeechSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionConstructor()));
  const [isMicSupported] = useState<boolean>(() =>
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
  const voiceRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceIntentStopRef = useRef<boolean>(false);
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [voiceEval, setVoiceEval] = useState<RecitationEvaluationResult | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const selfAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const [isRecordingSelf, setIsRecordingSelf] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingSelfRec, setIsPlayingSelfRec] = useState<boolean>(false);

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

  const stopQuizVoice = () => {
    voiceIntentStopRef.current = true;
    if (voiceRef.current) {
      voiceRef.current.onresult = null;
      voiceRef.current.onerror = null;
      voiceRef.current.onend = null;
      try {
        if (typeof voiceRef.current.abort === 'function') {
          voiceRef.current.abort();
        } else {
          voiceRef.current.stop();
        }
      } catch {
        // Ignore stop/abort error
      }
      voiceRef.current = null;
    }
    setIsVoiceActive(false);
  };

  const cleanupSelfRecording = (clearUrl = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop error
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setActiveMediaStream(null);
    if (selfAudioRef.current) {
      selfAudioRef.current.pause();
    }
    setIsRecordingSelf(false);
    setIsPlayingSelfRec(false);
    if (clearUrl) {
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
      setRecordedAudioUrl(null);
    }
  };

  useEffect(() => {
    setCurrentIdx(0);
  }, [selectedCategory, selectedType]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);
    setAudioError(null);
    stopQuizVoice();
    cleanupSelfRecording(true);
    setVoiceEval(null);
    setVoiceTranscript('');
    setVoiceFeedback(null);
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
      stopQuizVoice();
      cleanupSelfRecording(true);
      selfAudioRef.current = null;
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

  const handleToggleSpotVoice = (question: TajweedQuizQuestion) => {
    if (!question.spotAyah) return;
    if (isVoiceActive) {
      stopQuizVoice();
      return;
    }

    const SpeechCtor = getSpeechRecognitionConstructor();
    if (!SpeechCtor) {
      setVoiceFeedback(
        isEnglish
          ? 'Your browser does not support live recitation check; use "Record & Compare" instead.'
          : 'المتصفح الحالي لا يدعم التسميع المباشر؛ يمكنك استخدام زر «سجّل وقارن».'
      );
      return;
    }

    try {
      onPauseAudio?.();
      stopQuizVoice();
      cleanupSelfRecording(false);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      }

      voiceIntentStopRef.current = false;
      setVoiceFeedback(null);
      setVoiceTranscript('');

      const expectedWords = question.spotAyah.uthmani.trim().split(/\s+/).filter(Boolean);
      const recognition = new SpeechCtor();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          const item = ev.results[i];
          if (item && item[0]?.transcript) {
            parts.push(item[0].transcript);
          }
        }
        const combined = parts.join(' ').trim();
        setVoiceTranscript(combined);

        const res = evaluateRecitationAgainstAyah(expectedWords, combined);
        setVoiceEval(res);

        const targetIndices = question.spotAyah?.targetWordIndices || [];
        const hitTarget = targetIndices.some((idx) => res.matchedRawIndices.includes(idx));
        if (res.isComplete || (hitTarget && res.accuracyPercent >= 75)) {
          setVoiceFeedback(
            isEnglishRef.current
              ? 'Excellent! Both the Ayah and target Tajweed word were articulated clearly.'
              : 'ممتاز! نُطقت الآية والكلمة موضع الحكم بوضوح.'
          );
          voiceIntentStopRef.current = true;
          try {
            recognition.stop();
          } catch {
            // Ignore stop race
          }
          voiceRef.current = null;
          setIsVoiceActive(false);
        }
      };

      recognition.onerror = (ev) => {
        if (voiceIntentStopRef.current) {
          setIsVoiceActive(false);
          return;
        }
        const en = isEnglishRef.current;
        const code = ev?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoiceFeedback(
            en
              ? 'Please allow microphone access in your browser settings.'
              : 'يرجى السماح بصلاحية الميكروفون من إعدادات المتصفح.'
          );
        } else if (code === 'no-speech') {
          setVoiceFeedback(
            en
              ? 'No clear voice detected; move closer to the microphone and recite.'
              : 'لم يُلتقط صوت واضح؛ اقترب من الميكروفون وابدأ القراءة.'
          );
        } else if (code === 'network') {
          setVoiceFeedback(
            en
              ? 'Voice recognition requires internet access; use "Record & Compare" locally.'
              : 'تتعذر خدمة التعرف الصوتي دون إنترنت؛ استخدم «سجّل وقارن» لسماع نطقك.'
          );
        } else if (code === 'audio-capture') {
          setVoiceFeedback(
            en
              ? 'No active microphone was detected on this device.'
              : 'تعذر العثور على ميكروفون متاح في هذا الجهاز.'
          );
        } else if (code === 'aborted') {
          setVoiceFeedback(
            en
              ? 'Microphone session stopped; tap "Read Ayah Aloud" to try again.'
              : 'توقفت جلسة الميكروفون؛ اضغط «اقرأ الآية بصوتك» لإعادة المحاولة.'
          );
        } else {
          setVoiceFeedback(
            en
              ? 'Unable to continue voice recognition; try again or use "Record & Compare".'
              : 'تعذر متابعة التقاط الصوت؛ حاول مرة أخرى أو استخدم «سجّل وقارن».'
          );
        }
        voiceRef.current = null;
        setIsVoiceActive(false);
      };

      recognition.onend = () => {
        if (!voiceIntentStopRef.current) {
          voiceRef.current = null;
          setIsVoiceActive(false);
        }
      };

      voiceRef.current = recognition;
      setVoiceEval(evaluateRecitationAgainstAyah(expectedWords, ''));
      recognition.start();
      setIsVoiceActive(true);
    } catch {
      voiceRef.current = null;
      setIsVoiceActive(false);
      setVoiceFeedback(
        isEnglish
          ? 'Could not start live microphone check; use "Record & Compare" instead.'
          : 'تعذر بدء الميكروفون المباشر حالياً؛ يمكنك استخدام زر «سجّل وقارن».'
      );
    }
  };

  const handleToggleSelfRecording = async () => {
    if (isRecordingSelf) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!isMicSupported) {
      setVoiceFeedback(
        isEnglish
          ? 'This browser does not support local voice recording.'
          : 'المتصفح الحالي لا يدعم التسجيل الصوتي المحلي.'
      );
      return;
    }

    try {
      onPauseAudio?.();
      stopQuizVoice();
      cleanupSelfRecording(true);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      }
      setVoiceFeedback(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setActiveMediaStream(stream);
      recordingChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordingChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setActiveMediaStream(null);
        setIsRecordingSelf(false);
        const chunks = recordingChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const nextUrl = URL.createObjectURL(blob);
          if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
          recordedUrlRef.current = nextUrl;
          setRecordedAudioUrl(nextUrl);
        }
        recordingChunksRef.current = [];
      };

      recorder.start();
      setIsRecordingSelf(true);
    } catch {
      cleanupSelfRecording(false);
      setVoiceFeedback(
        isEnglish
          ? 'Microphone access denied; please enable audio permissions in browser settings.'
          : 'تعذر الوصول للميكروفون؛ يرجى السماح بصلاحية الصوت في المتصفح.'
      );
    }
  };

  const handleTogglePlaySelfRecording = () => {
    if (!recordedAudioUrl) return;
    onPauseAudio?.();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }

    if (!selfAudioRef.current) {
      selfAudioRef.current = new Audio();
      selfAudioRef.current.onended = () => setIsPlayingSelfRec(false);
    }

    const player = selfAudioRef.current;
    if (isPlayingSelfRec) {
      player.pause();
      setIsPlayingSelfRec(false);
      return;
    }

    if (player.src !== recordedAudioUrl) {
      player.src = recordedAudioUrl;
    }
    player.currentTime = 0;
    player
      .play()
      .then(() => setIsPlayingSelfRec(true))
      .catch(() => setIsPlayingSelfRec(false));
  };

  const handlePlayQuestionAudio = () => {
    if (!currentQuestion?.audioRef) return;
    setAudioError(null);
    const { surahNumber, ayahNumber } = currentQuestion.audioRef;
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
        setAudioError(isEnglishRef.current ? 'Unable to play recitation right now.' : 'تعذر تشغيل التلاوة الصوتية حالياً.');
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
        setAudioError(isEnglish ? 'Unable to start audio in this browser.' : 'تعذر بدء الصوت في المتصفح.');
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
      <div className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#D9B45A]/20 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-white">
              {isEnglish ? 'Graded Practice & Quiz System' : 'منظومة التدريب والاختبارات المتدرجة'}
            </h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-400">
              {isEnglish
                ? 'Practice visual rule spotting in verses, audio recognition, and rule mastery with instant feedback'
                : 'تدرب على الاستخراج البصري من الآيات، والتمييز السمعي، وضبط الأحكام بتصحيح فوري'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>
                {isEnglish
                  ? `Session: ${formatLocalizedDigits(sessionScore.correct, lang)} / ${formatLocalizedDigits(sessionScore.answered, lang)} correct`
                  : `الجولة: ${sessionScore.correct} / ${sessionScore.answered} صحيح`}
              </span>
            </span>
            <button
              type="button"
              onClick={handleResetSession}
              className="min-h-[36px] py-1.5 px-3 rounded-lg bg-white dark:bg-slate-950 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Reset Session' : 'إعادة الجولة'}</span>
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
              className={`min-h-[36px] py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#F6EFDD]'
                  : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              {isEnglish
                ? `All Chapters (${formatLocalizedDigits(TAJWEED_QUIZ.length, lang)})`
                : `كل الأبواب (${TAJWEED_QUIZ.length})`}
            </button>
            {(Object.keys(CATEGORY_LABELS) as QuizCategoryId[]).map((catId) => {
              const isSelected = selectedCategory === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategory(catId)}
                  className={`min-h-[36px] py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#D9B45A]/20 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A] font-bold'
                      : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  {CATEGORY_LABELS[catId][lang]}
                </button>
              );
            })}
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`min-h-[34px] py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                  : 'text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              {isEnglish ? 'All Modes' : 'كل الأنماط'}
            </button>
            {(Object.keys(TYPE_LABELS) as TajweedQuizQuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`min-h-[34px] py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedType === t
                    ? 'bg-[#1F3A6E] text-[#D9B45A]'
                    : 'text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                {TYPE_LABELS[t][lang]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Question Card */}
      {filteredQuestions.length === 0 || !currentQuestion ? (
        <div className="p-8 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm text-[#5C5549] dark:text-slate-300">
            {isEnglish
              ? 'No questions match both this chapter and mode.'
              : 'لا توجد أسئلة مطابقة لهذا التصنيف والنمط معاً.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedType('all');
            }}
            className="py-2 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold cursor-pointer"
          >
            {isEnglish ? 'Show All Questions' : 'عرض جميع الأسئلة'}
          </button>
        </div>
      ) : (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 space-y-5">
          {/* Question Header & Progress */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[#5C5549] dark:text-slate-400 tabular-nums">
                <span className="font-bold text-[#1B1A17] dark:text-white">
                  {isEnglish
                    ? `Question ${formatLocalizedDigits(currentIdx + 1, lang)} of ${formatLocalizedDigits(filteredQuestions.length, lang)}`
                    : `السؤال ${currentIdx + 1} من ${filteredQuestions.length}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{CATEGORY_LABELS[currentQuestion.category][lang]}</span>
                <span aria-hidden="true">·</span>
                <span>{TYPE_LABELS[currentQuestion.type][lang]}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#8A6418] dark:text-[#D9B45A] font-semibold">
                  {getQuizQuestionDifficulty(currentQuestion, lang)}
                </span>
              </div>

              {currentAnswer && (
                <span
                  className={`font-bold flex items-center gap-1 ${
                    currentAnswer.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {currentAnswer.isCorrect ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isEnglish ? 'Correct Answer' : 'إجابة صحيحة'}</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>{isEnglish ? 'Incorrect Answer' : 'إجابة غير صحيحة'}</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Linear Progress Bar */}
            <div className="h-1.5 w-full rounded-full bg-[#EFE6D1] dark:bg-slate-950 overflow-hidden">
              <div
                className={`h-full ${
                  isEnglish ? 'bg-gradient-to-r' : 'bg-gradient-to-l'
                } from-[#1F3A6E] to-[#D9B45A] transition-all duration-300`}
                style={{ width: `${((currentIdx + 1) / filteredQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Prompt */}
          <h4 className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-white leading-relaxed">
            {getQuizQuestionText(currentQuestion, lang)}
          </h4>

          {/* MODE A: Spot-Word Interactive Ayah Click */}
          {currentQuestion.type === 'spot-word' && currentQuestion.spotAyah ? (
            <div className="space-y-3">
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0b1117] border border-[#D9B45A]/25 dark:border-slate-800 text-center space-y-3">
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-quran text-2xl sm:text-3xl leading-[2.6] text-[#1B1A17] dark:text-slate-100"
                >
                  {spotWords.map((wordTokens, wIdx) => {
                    const isTarget =
                      currentQuestion.spotAyah!.targetWordIndices.includes(wIdx);
                    const isChosen = currentAnswer?.chosenWordIndex === wIdx;
                    const isVoiceMatched = voiceEval?.matchedRawIndices.includes(wIdx) ?? false;

                    let wordClass = isVoiceMatched
                      ? 'bg-[#D9B45A]/25 ring-1 ring-[#D9B45A] text-[#1B1A17] dark:text-white'
                      : 'hover:bg-[#EFE6D1] dark:hover:bg-slate-800/80 text-[#1B1A17] dark:text-slate-100';
                    if (currentAnswer) {
                      if (isTarget) {
                        wordClass =
                          'bg-emerald-500/20 ring-1 ring-emerald-500 text-[#1B1A17] dark:text-white';
                      } else if (isChosen && !isTarget) {
                        wordClass = 'bg-rose-500/20 ring-1 ring-rose-500 text-rose-800 dark:text-rose-200';
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
                                <span
                                  key={tIdx}
                                  className={cls}
                                  title={getTajweedTokenTooltip(tok, lang)}
                                >
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

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  {!currentAnswer && (
                    <p className="text-xs text-[#8A6418] dark:text-[#D9B45A] flex items-center gap-1.5 font-semibold">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      <span>
                        {isEnglish
                          ? 'Click directly on the target word in the Ayah'
                          : 'اضغط مباشرة على الكلمة المطلوبة في الآية'}
                      </span>
                    </p>
                  )}

                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={() => handleToggleSpotVoice(currentQuestion)}
                      className={`min-h-[38px] py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isVoiceActive
                          ? 'bg-[#D9B45A] border-[#8A6418] text-[#1B1A17]'
                          : 'bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border-[#D9B45A]/45 text-[#8A6418] dark:text-[#D9B45A]'
                      }`}
                    >
                      {isVoiceActive ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>{isEnglish ? 'Stop Recitation' : 'إيقاف التلاوة'}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>{isEnglish ? 'Recite Ayah to Practice' : 'اقرأ الآية بصوتك للتطبيق'}</span>
                        </>
                      )}
                    </button>
                  )}

                  {isMicSupported && (
                    <button
                      type="button"
                      onClick={handleToggleSelfRecording}
                      className={`min-h-[38px] py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isRecordingSelf
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-700 dark:text-rose-200'
                          : 'bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border-[#D9B45A]/25 dark:border-slate-700 text-[#1B1A17] dark:text-slate-200'
                      }`}
                    >
                      {isRecordingSelf ? (
                        <>
                          <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
                          <span>{isEnglish ? 'Stop Recording' : 'إيقاف التسجيل'}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                          <span>{isEnglish ? 'Record & Compare' : 'سجّل وقارن'}</span>
                        </>
                      )}
                    </button>
                  )}

                  {recordedAudioUrl && !isRecordingSelf && (
                    <button
                      type="button"
                      onClick={handleTogglePlaySelfRecording}
                      className="min-h-[38px] py-1.5 px-3 rounded-lg bg-emerald-600/15 dark:bg-emerald-600/20 border border-emerald-500/45 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/25 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      {isPlayingSelfRec ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>{isEnglish ? 'Pause Recording' : 'إيقاف تسجيلي'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isEnglish ? 'Play Recording' : 'سماع تسجيلي'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {(isVoiceActive || isRecordingSelf || voiceEval || voiceFeedback) && (
                  <div className="p-2.5 rounded-xl bg-[#FBF7EE] dark:bg-slate-950/90 border border-[#D9B45A]/25 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AudioLevelMeter
                        isActive={isVoiceActive || isRecordingSelf}
                        mediaStream={isRecordingSelf ? activeMediaStream : null}
                        activitySeed={voiceTranscript.length}
                        tone={isRecordingSelf ? 'rose' : 'gold'}
                      />
                      <span className={voiceFeedback && !voiceEval?.isComplete ? 'text-amber-700 dark:text-amber-200' : 'text-[#3F3A32] dark:text-slate-300'}>
                        {voiceFeedback
                          ? voiceFeedback
                          : isRecordingSelf
                          ? (isEnglish ? 'Recording your recitation…' : 'جارٍ تسجيل تلاوتك…')
                          : voiceTranscript
                          ? (isEnglish ? `Heard: “${voiceTranscript}”` : `ما سُمع: «${voiceTranscript}»`)
                          : (isEnglish ? 'Listening… please recite the Ayah now' : 'أصغي لتلاوتك… تفضل بقراءة الآية الآن')}
                      </span>
                    </div>
                    {voiceEval && !isRecordingSelf && (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {isEnglish
                          ? `Match Accuracy: ${formatLocalizedDigits(voiceEval.accuracyPercent, lang)}%`
                          : `دقة المطابقة: ${voiceEval.accuracyPercent}%`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MODE B & C: Quranic Snippet + Optional Real Audio Player + Options Grid */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0b1117] border border-[#D9B45A]/25 dark:border-slate-800 text-center space-y-3">
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-quran text-2xl sm:text-3xl leading-[2.4] text-[#1F3A6E] dark:text-[#D9B45A]"
                >
                  {currentQuestion.ayahSnippet}
                </p>

                {currentQuestion.type === 'audio' && currentQuestion.audioRef && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {(() => {
                      const audioSurah = SURAHS_LIST.find(
                        (s) => s.number === currentQuestion.audioRef!.surahNumber
                      );
                      const surahLabel = audioSurah
                        ? getSurahDisplayName(audioSurah, lang)
                        : currentQuestion.audioRef!.surahName;
                      const reciterLabel = isEnglish
                        ? getReciterDisplayName(activeReciter, lang)
                        : activeReciter.name.split(' ')[0];
                      return (
                        <button
                          type="button"
                          onClick={handlePlayQuestionAudio}
                          className={`min-h-[40px] py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                            isPlayingAudio
                              ? 'bg-[#D9B45A] text-[#1B1A17]'
                              : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
                          }`}
                        >
                          {isPlayingAudio ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>{isEnglish ? 'Stop Audio' : 'إيقاف التلاوة'}</span>
                            </>
                          ) : (
                            <>
                              <Headphones className="w-3.5 h-3.5 text-[#D9B45A]" />
                              <span>
                                {isEnglish
                                  ? `Listen to ${reciterLabel} (${surahLabel}: ${formatLocalizedDigits(currentQuestion.audioRef.ayahNumber, lang)})`
                                  : `استمع لتلاوة ${reciterLabel} (${surahLabel}: ${currentQuestion.audioRef.ayahNumber})`}
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                      className={`min-h-[40px] py-2 px-3 rounded-xl border text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        playbackRate === 0.75
                          ? 'bg-[#1F3A6E] border-[#648CD4] text-[#D9B45A]'
                          : 'bg-[#FBF7EE] dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-700 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      {isEnglish
                        ? `Speed: ${formatLocalizedDigits(playbackRate, lang)}x`
                        : `السرعة: ${playbackRate}x`}
                    </button>

                    {audioError && <span className="text-xs text-rose-600 dark:text-rose-400">{audioError}</span>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {getQuizQuestionOptions(currentQuestion, lang).map((opt, oIdx) => {
                  const isChosen = currentAnswer?.chosenOption === oIdx;
                  const isCorrectOpt = oIdx === currentQuestion.correctIndex;

                  let style =
                    'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]/60 dark:hover:border-slate-600 hover:bg-[#EFE6D1]/70 dark:hover:bg-slate-900';

                  if (currentAnswer) {
                    if (isCorrectOpt) {
                      style = 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold';
                    } else if (isChosen && !isCorrectOpt) {
                      style = 'bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-800 dark:text-rose-200';
                    } else {
                      style = 'bg-[#F6EFDD]/60 dark:bg-slate-950/60 border-[#D9B45A]/15 dark:border-slate-800/70 text-[#7D7466] dark:text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={Boolean(currentAnswer)}
                      onClick={() => handleChooseOption(currentQuestion, oIdx)}
                      className={`min-h-[48px] p-3.5 rounded-xl border text-start text-xs sm:text-sm transition-all flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${style}`}
                    >
                      <span>{opt}</span>
                      {currentAnswer && isCorrectOpt && (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      {currentAnswer && isChosen && !isCorrectOpt && (
                        <X className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Immediate Pedagogical Explanation */}
          {currentAnswer && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 space-y-1 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] block">
                {isEnglish ? 'Explanation & Tajweed Note:' : 'الشرح والتوجيه العلمي:'}
              </span>
              <p className="text-xs sm:text-sm text-[#1B1A17] dark:text-slate-200 leading-relaxed">
                {getQuizQuestionExplanation(currentQuestion, lang)}
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#D9B45A]/20 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx <= 0}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-white dark:bg-slate-950 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 disabled:opacity-40 border border-[#D9B45A]/25 dark:border-slate-800 text-xs font-bold text-[#1B1A17] dark:text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isEnglish ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>{isEnglish ? 'Previous' : 'السؤال السابق'}</span>
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
                    aria-label={
                      isEnglish ? `Go to question ${idx + 1}` : `الانتقال للسؤال ${idx + 1}`
                    }
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold tabular-nums shrink-0 transition-colors cursor-pointer ${
                      isCur
                        ? 'bg-[#1F3A6E] text-[#F6EFDD] ring-2 ring-[#D9B45A]'
                        : ans
                        ? ans.isCorrect
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                        : 'bg-white dark:bg-slate-950 text-[#5C5549] dark:text-slate-400 border border-[#D9B45A]/20 dark:border-slate-800 hover:text-[#1B1A17] dark:hover:text-white'
                    }`}
                  >
                    {formatLocalizedDigits(idx + 1, lang)}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(filteredQuestions.length - 1, i + 1))}
              disabled={currentIdx >= filteredQuestions.length - 1}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] disabled:opacity-40 text-xs font-bold text-[#F6EFDD] flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span>{isEnglish ? 'Next' : 'السؤال التالي'}</span>
              {isEnglish ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Saved Chapter Accuracy Summary & Smart Review Suggestion */}
      <div className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D9B45A]/20 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-[#1B1A17] dark:text-white">
              {isEnglish ? 'Cumulative Chapter Mastery' : 'سجل إتقان الأبواب التراكمي'}
            </h4>
            <p className="text-xs text-[#5C5549] dark:text-slate-400">
              {isEnglish
                ? 'Saved locally to help you focus on weaker chapters'
                : 'يُحفظ مستواك محلياً لمساعدتك على مراجعة نقاط الضعف'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {weakestCategory && weakestCategory.ratio < 0.85 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(weakestCategory.id);
                  setSelectedType('all');
                }}
                className="min-h-[36px] py-1.5 px-3 rounded-lg bg-[#D9B45A]/15 hover:bg-[#D9B45A]/25 border border-[#D9B45A]/40 text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] cursor-pointer whitespace-nowrap"
              >
                {isEnglish
                  ? `Review Weakest: ${CATEGORY_LABELS[weakestCategory.id][lang]}`
                  : `راجع الأضعف: ${CATEGORY_LABELS[weakestCategory.id][lang]}`}
              </button>
            )}
            <button
              type="button"
              onClick={handleResetAllStats}
              className="min-h-[36px] py-1.5 px-3 rounded-lg bg-white dark:bg-slate-950 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-xs text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              {isEnglish ? 'Reset Stats' : 'تصفير السجل'}
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
                className="p-3.5 rounded-xl bg-white dark:bg-slate-950 hover:bg-[#EFE6D1]/70 dark:hover:bg-slate-900 border border-[#D9B45A]/20 dark:border-slate-800 text-start space-y-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#1B1A17] dark:text-white truncate">
                    {CATEGORY_LABELS[catId][lang]}
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                    {st.answered > 0 ? `${formatLocalizedDigits(pct, lang)}%` : '—'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EFE6D1] dark:bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#5C5549] dark:text-slate-400 tabular-nums">
                  {st.answered > 0
                    ? isEnglish
                      ? `${formatLocalizedDigits(st.correct, lang)} / ${formatLocalizedDigits(st.answered, lang)} correct`
                      : `${st.correct} صحيح من ${st.answered} محاولة`
                    : isEnglish
                    ? 'Not started yet'
                    : 'لم تبدأ بعد'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
