import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TAJWEED_CHAPTERS,
  TAJWEED_RULES,
  TajweedChapterId,
  TajweedRule,
  getTajweedChapterTitle,
  getTajweedRuleBenefit,
  getTajweedRuleDefinition,
  getTajweedRuleDisplayName,
  getTajweedRuleLevel,
  getTajweedRuleMizan,
} from '../data/tajweedRules';
import { RECITERS_LIST, Reciter, getAyahAudioUrl } from '../data/reciters';
import { SURAHS_LIST, getSurahDisplayName } from '../data/quranMetadata';
import { normalizeArabicText } from '../utils/arabicNormalize';
import { safeLocalStorage } from '../utils/safeStorage';
import { alignUthmaniWithTajweed, getTajweedTokenTooltip, TajweedRuleType } from '../utils/tajweedParser';
import { formatLocalizedDigits, useLanguage } from '../utils/i18n';
import {
  evaluateRecitationAgainstAyah,
  getSpeechRecognitionConstructor,
  RecitationEvaluationResult,
  SpeechRecognitionLike,
} from '../utils/recitationMatcher';
import { MakharijAtlas } from './tajweed/MakharijAtlas';
import { AyahTajweedLab } from './tajweed/AyahTajweedLab';
import { TajweedQuizHub } from './tajweed/TajweedQuizHub';
import { AudioLevelMeter } from './AudioLevelMeter';
import {
  Award,
  BookOpen,
  Check,
  Compass,
  ExternalLink,
  Eye,
  FlaskConical,
  HelpCircle,
  Mic,
  Pause,
  Play,
  Search,
  Sparkles,
  Square,
  Timer,
  X,
} from 'lucide-react';

interface TajweedEncyclopediaProps {
  selectedReciter?: Reciter;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onPauseAudio?: () => void;
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
  onPauseAudio,
}) => {
  const { lang, isEnglish } = useLanguage();
  const isEnglishRef = useRef<boolean>(isEnglish);
  isEnglishRef.current = isEnglish;
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

  // Live Voice Pronunciation Practice & Self-Recording for rule examples
  const [isSpeechSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionConstructor()));
  const [isMicSupported] = useState<boolean>(() =>
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceIntentStopRef = useRef<boolean>(false);
  const [practicingExampleKey, setPracticingExampleKey] = useState<string | null>(null);
  const [practiceEvalByKey, setPracticeEvalByKey] = useState<Record<string, RecitationEvaluationResult>>({});
  const [transcriptByKey, setTranscriptByKey] = useState<Record<string, string>>({});
  const [voiceErrorByKey, setVoiceErrorByKey] = useState<Record<string, string | null>>({});

  // MediaRecorder self-recording comparison (same API as MemorizationMode)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const selfAudioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingExampleKey, setRecordingExampleKey] = useState<string | null>(null);
  const [recordedAudioByKey, setRecordedAudioByKey] = useState<Record<string, string>>({});
  const recordedAudioByKeyRef = useRef<Record<string, string>>({});
  recordedAudioByKeyRef.current = recordedAudioByKey;
  const [playingSelfRecKey, setPlayingSelfRecKey] = useState<string | null>(null);

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
        `${rule.name} ${rule.nameEn} ${rule.definition} ${rule.definitionEn || ''} ${rule.letters.join(' ')} ${rule.mizan} ${rule.mizanEn || ''} ${rule.level} ${rule.levelEn || ''}`
      );
      return haystack.includes(q);
    });
  }, [selectedChapter, searchTerm]);

  const stopVoicePractice = () => {
    voiceIntentStopRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current.stop();
        }
      } catch {
        // Ignore stop/abort errors
      }
      recognitionRef.current = null;
    }
    setPracticingExampleKey(null);
  };

  const stopSelfRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setActiveMediaStream(null);
    if (selfAudioRef.current) {
      selfAudioRef.current.pause();
    }
    setRecordingExampleKey(null);
    setPlayingSelfRecKey(null);
  };

  // Keep beat simulator & inspection synchronized when rule switches
  useEffect(() => {
    setInspectedWord(null);
    setAudioError(null);
    setVoiceErrorByKey({});
    stopVoicePractice();
    stopSelfRecording();
    stopBeatSimulator();
    if (selectedRule.beats.options.length > 0) {
      setSelectedBeatCount(selectedRule.beats.options[0]);
    }
  }, [selectedRule.id]);

  useEffect(() => {
    if (activeTab !== 'rules') {
      stopVoicePractice();
      stopSelfRecording();
    }
  }, [activeTab]);

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
      stopVoicePractice();
      stopSelfRecording();
      Object.values(recordedAudioByKeyRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
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
    stopVoicePractice();
    stopSelfRecording();
    onPauseAudio?.();
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
        setAudioError(
          isEnglishRef.current
            ? 'Unable to play audio recitation right now.'
            : 'تعذر تشغيل التلاوة الصوتية حالياً.'
        );
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
        setAudioError(
          isEnglishRef.current
            ? 'Unable to start audio in this browser.'
            : 'تعذر بدء الصوت في المتصفح.'
        );
      });
  };

  const handleToggleVoicePractice = (key: string, uthmaniText: string) => {
    if (practicingExampleKey === key) {
      stopVoicePractice();
      return;
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setVoiceErrorByKey((prev) => ({
        ...prev,
        [key]: isEnglishRef.current
          ? 'Live voice evaluation is not supported in this browser; try “Record & Compare” beside it.'
          : 'المتصفح الحالي لا يدعم التسميع الذكي المباشر؛ يمكنك استخدام زر «سجّل وقارن» بجانبه.',
      }));
      return;
    }

    try {
      onPauseAudio?.();
      stopVoicePractice();
      stopSelfRecording();
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingExampleKey(null);
      }

      voiceIntentStopRef.current = false;
      setVoiceErrorByKey((prev) => ({ ...prev, [key]: null }));
      setTranscriptByKey((prev) => ({ ...prev, [key]: '' }));

      const expectedWords = uthmaniText.trim().split(/\s+/).filter(Boolean);
      const recognition = new RecognitionCtor();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]?.transcript) {
            parts.push(item[0].transcript);
          }
        }
        const combined = parts.join(' ').trim();
        setTranscriptByKey((prev) => ({ ...prev, [key]: combined }));

        const evaluation = evaluateRecitationAgainstAyah(expectedWords, combined);
        setPracticeEvalByKey((prev) => ({ ...prev, [key]: evaluation }));

        if (evaluation.isComplete) {
          voiceIntentStopRef.current = true;
          try {
            recognition.stop();
          } catch {
            // Ignore race
          }
          recognitionRef.current = null;
          setPracticingExampleKey(null);
        }
      };

      recognition.onerror = (ev) => {
        if (voiceIntentStopRef.current) {
          setPracticingExampleKey((cur) => (cur === key ? null : cur));
          return;
        }
        const code = ev?.error || '';
        const en = isEnglishRef.current;
        let msg = en
          ? 'Could not continue voice check; try again or use “Record & Compare”.'
          : 'تعذر متابعة التسميع الصوتي؛ حاول مرة أخرى أو استخدم «سجّل وقارن».';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          msg = en
            ? 'Please allow microphone permission to practice aloud.'
            : 'يرجى السماح بصلاحية الميكروفون للتطبيق الصوتي.';
        } else if (code === 'no-speech') {
          msg = en
            ? 'No clear speech detected; move closer to the mic and begin reciting.'
            : 'لم يُلتقط صوت واضح؛ اقترب من الميكروفون وابدأ القراءة.';
        } else if (code === 'network') {
          msg = en
            ? 'Speech recognition requires internet; use “Record & Compare” to hear yourself.'
            : 'تتعذر خدمة التعرف الصوتي دون إنترنت؛ استخدم «سجّل وقارن» لسماع نطقك.';
        } else if (code === 'audio-capture') {
          msg = en
            ? 'No available microphone was found on this device.'
            : 'تعذر العثور على ميكروفون متاح في هذا الجهاز.';
        } else if (code === 'aborted') {
          msg = en
            ? 'Microphone session stopped; click “Practice Aloud” to try again.'
            : 'توقفت جلسة الميكروفون؛ اضغط «طبّق بصوتك» لإعادة المحاولة.';
        }
        setVoiceErrorByKey((prev) => ({ ...prev, [key]: msg }));
        recognitionRef.current = null;
        setPracticingExampleKey(null);
      };

      recognition.onend = () => {
        if (!voiceIntentStopRef.current) {
          recognitionRef.current = null;
          setPracticingExampleKey((cur) => (cur === key ? null : cur));
        }
      };

      recognitionRef.current = recognition;
      setPracticeEvalByKey((prev) => ({
        ...prev,
        [key]: evaluateRecitationAgainstAyah(expectedWords, ''),
      }));
      recognition.start();
      setPracticingExampleKey(key);
    } catch {
      recognitionRef.current = null;
      setPracticingExampleKey(null);
      setVoiceErrorByKey((prev) => ({
        ...prev,
        [key]: isEnglishRef.current
          ? 'Could not start live microphone in this browser; use “Record & Compare”.'
          : 'تعذر تشغيل الميكروفون المباشر في هذا المتصفح؛ استخدم زر «سجّل وقارن».',
      }));
    }
  };

  const handleToggleSelfRecording = async (key: string) => {
    if (recordingExampleKey === key) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!isMicSupported) {
      setVoiceErrorByKey((prev) => ({
        ...prev,
        [key]: isEnglishRef.current
          ? 'Local audio recording is not supported in this browser.'
          : 'المتصفح الحالي لا يدعم التسجيل الصوتي المحلي.',
      }));
      return;
    }

    try {
      onPauseAudio?.();
      stopVoicePractice();
      stopSelfRecording();
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingExampleKey(null);
      }
      setVoiceErrorByKey((prev) => ({ ...prev, [key]: null }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setActiveMediaStream(stream);
      recordingChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setActiveMediaStream(null);
        setRecordingExampleKey((cur) => (cur === key ? null : cur));
        const chunks = recordingChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const nextUrl = URL.createObjectURL(blob);
          setRecordedAudioByKey((prev) => {
            if (prev[key]) URL.revokeObjectURL(prev[key]);
            return { ...prev, [key]: nextUrl };
          });
        }
        recordingChunksRef.current = [];
      };

      recorder.start();
      setRecordingExampleKey(key);
    } catch {
      stopSelfRecording();
      setVoiceErrorByKey((prev) => ({
        ...prev,
        [key]: isEnglishRef.current
          ? 'Could not access microphone; please allow audio permission in your browser.'
          : 'تعذر الوصول للميكروفون؛ يرجى السماح بصلاحية الصوت في المتصفح.',
      }));
    }
  };

  const handleTogglePlaySelfRecording = (key: string) => {
    const recUrl = recordedAudioByKey[key];
    if (!recUrl) return;
    onPauseAudio?.();
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingExampleKey(null);
    }

    if (!selfAudioRef.current) {
      selfAudioRef.current = new Audio();
      selfAudioRef.current.onended = () => setPlayingSelfRecKey(null);
    }

    const player = selfAudioRef.current;
    if (playingSelfRecKey === key) {
      player.pause();
      setPlayingSelfRecKey(null);
      return;
    }

    if (player.src !== recUrl) {
      player.src = recUrl;
    }
    player.currentTime = 0;
    player
      .play()
      .then(() => setPlayingSelfRecKey(key))
      .catch(() => setPlayingSelfRecKey(null));
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

  const currentGuideStep: 1 | 2 | 3 =
    activeTab === 'quiz' || masteredIds.includes(selectedRule.id)
      ? 3
      : practicingExampleKey || recordingExampleKey || playingExampleKey || activeTab === 'lab'
      ? 2
      : 1;

  return (
    <div className="space-y-6">
      {/* Unified Header & Section Navigation */}
      <div
        className={`p-5 sm:p-6 rounded-2xl ${
          isEnglish ? 'bg-gradient-to-r' : 'bg-gradient-to-l'
        } from-[#1F3A6E]/10 via-[#FBF7EE] to-[#F6EFDD] dark:from-[#1F3A6E]/45 dark:via-[#10161f] dark:to-[#0b1018] border border-[#D9B45A]/30 shadow-xl space-y-5`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
              {isEnglish ? 'Interactive Tajweed Encyclopedia' : 'موسوعة التجويد التفاعلية الشاملة'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5549] dark:text-slate-300 max-w-2xl leading-relaxed">
              {isEnglish
                ? 'A complete practical curriculum combining classified recitation rules, an articulation points atlas, a live ayah dissection lab, and graded quizzes.'
                : 'منهج عملي متكامل يجمع أحكام التلاوة المصنّفة، وأطلس مخارج الحروف، ومختبر تشريح الآيات بالصوت، واختبارات متدرجة.'}
            </p>
          </div>

          {/* Mastery Progress Summary (Emerald kept strictly for completion) */}
          <div className="min-w-[210px] p-3.5 rounded-xl bg-white dark:bg-slate-950/90 border border-[#D9B45A]/25 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="text-[#3F3A32] dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{isEnglish ? 'Mastery Progress' : 'تقدّم الإتقان'}</span>
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {formatLocalizedDigits(masteredIds.length, lang)} / {formatLocalizedDigits(TAJWEED_RULES.length, lang)} ({formatLocalizedDigits(masteredPercent, lang)}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#EFE6D1] dark:bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${masteredPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4-Pillar Segmented Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#EFE6D1]/80 dark:bg-slate-950 p-1.5 rounded-xl border border-[#D9B45A]/25 dark:border-slate-800">
          {[
            { id: 'rules', label: isEnglish ? 'Rules Library' : 'مكتبة الأحكام', icon: BookOpen },
            { id: 'makharij', label: isEnglish ? 'Makharij & Sifat Atlas' : 'أطلس المخارج والصفات', icon: Compass },
            { id: 'lab', label: isEnglish ? 'Ayah Dissection Lab' : 'مختبر حلّل الآية', icon: FlaskConical },
            { id: 'quiz', label: isEnglish ? 'Quizzes & Practice' : 'منظومة الاختبارات', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as EncyclopediaTab)}
                className={`min-h-[40px] flex-1 sm:flex-initial py-2 px-3.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45 shadow-sm'
                    : 'text-[#4A4338] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D9B45A]' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Guided 3-Step Progressive Learning Path Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {[
            {
              step: 1 as const,
              title: isEnglish ? '1. Pick Rule & Makhraj' : '١. اختر الحكم والمخرج',
              desc: isEnglish
                ? 'Explore its definition, timing scale, and letters'
                : 'تعرّف على التعريف والميزان وحروف الحكم',
              onClick: () => setActiveTab('rules'),
            },
            {
              step: 2 as const,
              title: isEnglish ? '2. Listen & Recite Aloud' : '٢. استمع وطبّق بصوتك',
              desc: isEnglish
                ? 'Compare your recitation or inspect ayah words'
                : 'قارن تلاوتك أو حلّل الكلمات داخل الآية',
              onClick: () => setActiveTab('rules'),
            },
            {
              step: 3 as const,
              title: isEnglish ? '3. Test & Master' : '٣. اختبر وأتقِن',
              desc: isEnglish
                ? 'Reinforce mastery with the graded quiz'
                : 'ثبّت إتقانك عبر الاختبار المتدرج',
              onClick: () => setActiveTab('quiz'),
            },
          ].map((item) => {
            const isCurrent = currentGuideStep === item.step;
            const isPassed = currentGuideStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={item.onClick}
                className={`p-2.5 rounded-xl border text-start transition-all flex items-start gap-2.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A]/60 shadow-sm'
                    : isPassed
                    ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/40 text-[#1B1A17] dark:text-emerald-200'
                    : 'bg-white/80 dark:bg-slate-950/70 border-[#D9B45A]/20 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:border-[#D9B45A]/45'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 tabular-nums ${
                    isCurrent
                      ? 'bg-[#D9B45A] text-[#1B1A17]'
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#EFE6D1] dark:bg-slate-900 text-[#8A6418] dark:text-[#D9B45A]'
                  }`}
                >
                  {isPassed ? <Check className="w-3.5 h-3.5" /> : formatLocalizedDigits(item.step, lang)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{item.title}</span>
                  <span className={`block text-[11px] leading-snug ${isCurrent ? 'text-[#E9E3D3]/85' : 'text-[#5C5549] dark:text-slate-400'}`}>
                    {item.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: PHASE 1 — ORDERED INTERACTIVE RULES LIBRARY */}
      {activeTab === 'rules' && (
        <div className="space-y-5">
          {/* Search & Chapter Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#5C5549] dark:text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  isEnglish
                    ? 'Search by rule name or letter (e.g. ق, ب, Madd, Iqlab)...'
                    : 'ابحث باسم الحكم أو الحرف (مثل: ق، ب، مد، إقلاب)...'
                }
                className="w-full min-h-[42px] py-2 ps-9 pe-8 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs sm:text-sm text-[#1B1A17] dark:text-white placeholder:text-[#7D7466] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#D9B45A]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label={isEnglish ? 'Clear search' : 'مسح البحث'}
                  className="p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedChapter('all')}
                className={`min-h-[36px] py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedChapter === 'all'
                    ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#F6EFDD]'
                    : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                {isEnglish
                  ? `All Chapters (${formatLocalizedDigits(TAJWEED_RULES.length, lang)})`
                  : `جميع الأبواب (${TAJWEED_RULES.length})`}
              </button>
              {TAJWEED_CHAPTERS.map((chap) => {
                const isSelected = selectedChapter === chap.id;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => setSelectedChapter(chap.id)}
                    className={`min-h-[36px] py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#D9B45A]/20 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A] font-bold'
                        : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                    }`}
                  >
                    {getTajweedChapterTitle(chap, lang)}
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
                <div className="p-6 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-center space-y-3">
                  <p className="text-xs text-[#5C5549] dark:text-slate-300">
                    {isEnglish
                      ? `No rules match “${searchTerm}”.`
                      : `لا توجد أحكام مطابقة لبحثك «${searchTerm}».`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedChapter('all');
                    }}
                    className="py-1.5 px-3.5 rounded-lg bg-[#1F3A6E] text-[#F6EFDD] text-xs font-bold cursor-pointer"
                  >
                    {isEnglish ? 'Show All Rules' : 'عرض كل الأحكام'}
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
                        <h3 className="font-bold text-[#3F3A32] dark:text-slate-300">
                          {getTajweedChapterTitle(chap, lang)}
                        </h3>
                        <span className="text-[#5C5549] dark:text-slate-500 tabular-nums">
                          {formatLocalizedDigits(chapRules.length, lang)}
                        </span>
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
                              className={`w-full text-start p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border-[#D9B45A] ring-1 ring-[#D9B45A]/45 text-[#F6EFDD]'
                                  : 'bg-[#FBF7EE] dark:bg-slate-900/60 border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#D9B45A]/55 dark:hover:border-slate-700 text-[#1B1A17] dark:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 dark:border-white/15"
                                  style={{ backgroundColor: rule.colorHex }}
                                />
                                <div className="min-w-0">
                                  <div className={`font-bold text-sm truncate ${isSelected ? 'text-[#F6EFDD]' : 'text-[#1B1A17] dark:text-white'}`}>
                                    {getTajweedRuleDisplayName(rule, lang)}
                                  </div>
                                  <div className={`text-[11px] truncate ${isSelected ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>
                                    {getTajweedRuleLevel(rule, lang)} · {getTajweedRuleMizan(rule, lang)}
                                  </div>
                                </div>
                              </div>

                              {isMastered && (
                                <span
                                  title={isEnglish ? 'Rule mastered' : 'تم إتقان الحكم'}
                                  className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0"
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
            <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 space-y-6">
              {/* Rule Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9B45A]/20 dark:border-slate-800">
                <div className="flex items-center gap-3.5">
                  <span
                    className="w-7 h-7 rounded-xl shrink-0 border border-black/15 dark:border-white/20"
                    style={{ backgroundColor: selectedRule.colorHex }}
                  />
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#1B1A17] dark:text-white">
                      {getTajweedRuleDisplayName(selectedRule, lang)}
                    </h3>
                    <div className="text-xs text-[#5C5549] dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span>{getTajweedChapterTitle(chapterMeta, lang)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {isEnglish
                          ? `Level: ${getTajweedRuleLevel(selectedRule, lang)}`
                          : `المستوى: ${selectedRule.level}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#8A6418] dark:text-[#D9B45A] font-semibold">
                        {getTajweedRuleMizan(selectedRule, lang)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleMastered(selectedRule.id)}
                  className={`min-h-[40px] py-2 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    masteredIds.includes(selectedRule.id)
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-950 border-[#D9B45A]/30 dark:border-slate-700 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {masteredIds.includes(selectedRule.id)
                      ? (isEnglish ? 'Mastered' : 'تمّ إتقانه')
                      : (isEnglish ? 'Mark as Mastered' : 'تحديد كمتقَن')}
                  </span>
                </button>
              </div>

              {/* Definition & Letters */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-[#5C5549] dark:text-slate-400 block mb-1.5">
                    {isEnglish ? 'Scientific & Practical Definition:' : 'التعريف العلمي والتطبيقي:'}
                  </span>
                  <p className="text-[#1B1A17] dark:text-slate-200 text-sm leading-relaxed bg-white dark:bg-slate-950 p-4 rounded-xl border border-[#D9B45A]/20 dark:border-slate-800">
                    {getTajweedRuleDefinition(selectedRule, lang)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-[#5C5549] dark:text-slate-400 block mb-2">
                    {isEnglish ? 'Rule Letters:' : 'حروف الحكم:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.letters.map((l, i) => (
                      <span
                        key={i}
                        dir="rtl"
                        lang="ar"
                        className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 text-[#1B1A17] dark:text-white font-bold text-sm border border-[#D9B45A]/25 dark:border-slate-800"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual Harakat Beat Metronome */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1B1A17] dark:text-white">
                    <Timer className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                    <span>{isEnglish ? 'Interactive Count & Timing Scale' : 'ميزان الزمن والحركات التفاعلي'}</span>
                    <span className="text-[#5C5549] dark:text-slate-400 font-normal">
                      ({isEnglish ? selectedRule.beats.unitEn || selectedRule.beats.unit : selectedRule.beats.unit})
                    </span>
                  </div>

                  {selectedRule.beats.options.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedRule.beats.options.length > 1 && (
                        <div className="flex items-center gap-1 bg-[#EFE6D1] dark:bg-slate-900 p-1 rounded-lg border border-[#D9B45A]/20 dark:border-slate-800">
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
                                  ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                                  : 'text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                              }`}
                            >
                              {formatLocalizedDigits(opt, lang)}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleBeatSimulator}
                        className={`min-h-[36px] py-1.5 px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isBeatRunning
                            ? 'bg-[#D9B45A] text-[#1B1A17]'
                            : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
                        }`}
                      >
                        {isBeatRunning ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>{isEnglish ? 'Stop' : 'إيقاف'}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current text-[#D9B45A]" />
                            <span>{isEnglish ? 'Start Beat Guide' : 'ابدأ قياس الزمن'}</span>
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
                              ? 'bg-[#D9B45A] border-[#8A6418] text-[#1B1A17] scale-[1.03]'
                              : isLit
                              ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#F6EFDD]'
                              : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D9B45A]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-500'
                          }`}
                        >
                          {formatLocalizedDigits(stepNum, lang)}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-[#5C5549] dark:text-slate-400 leading-relaxed">
                  {isEnglish ? selectedRule.beats.noteEn || selectedRule.beats.note : selectedRule.beats.note}
                </p>
              </div>

              {/* Authentic Interactive Colored Quranic Examples */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#3F3A32] dark:text-slate-300">
                    {isEnglish
                      ? 'Interactive Quranic Examples (Click any word to inspect):'
                      : 'أمثلة قرآنية تفاعلية (اضغط على أي كلمة لتحليلها):'}
                  </span>

                  <div className="flex items-center gap-2">
                    {selectedRule.ruleTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsolateRuleColors((prev) => !prev)}
                        className={`min-h-[36px] py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isolateRuleColors
                            ? 'bg-[#1F3A6E] border-[#648CD4] text-[#F6EFDD]'
                            : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {isolateRuleColors
                            ? (isEnglish ? 'Show All Colors' : 'عرض كل ألوان الآية')
                            : (isEnglish ? 'Isolate This Rule' : 'عزل لون هذا الحكم فقط')}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPlaybackRate((r) => (r === 1 ? 0.75 : 1))}
                      className={`min-h-[36px] py-1.5 px-2.5 rounded-lg border text-xs font-bold tabular-nums cursor-pointer whitespace-nowrap ${
                        playbackRate === 0.75
                          ? 'bg-[#1F3A6E] border-[#648CD4] text-[#D9B45A]'
                          : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                      title={
                        isEnglish
                          ? 'Slow down audio to hear ghunnah and madd clearly'
                          : 'تبطيء سرعة الصوت لسماع الغنة والمد بوضوح'
                      }
                    >
                      {formatLocalizedDigits(playbackRate, lang)}x
                    </button>
                  </div>
                </div>

                {audioError && <p className="text-xs text-rose-600 dark:text-rose-400">{audioError}</p>}

                <div className="space-y-3">
                  {parsedExamples.map((ex, exIdx) => {
                    const exAudioKey = `${selectedRule.id}-${ex.surahNumber}-${ex.ayahNumber}`;
                    const isPlayingThis = playingExampleKey === exAudioKey;
                    const isPracticingThis = practicingExampleKey === exAudioKey;
                    const isRecordingThis = recordingExampleKey === exAudioKey;
                    const recordedUrl = recordedAudioByKey[exAudioKey];
                    const isPlayingSelf = playingSelfRecKey === exAudioKey;
                    const practiceEval = practiceEvalByKey[exAudioKey];
                    const cardTranscript = transcriptByKey[exAudioKey] || '';
                    const cardVoiceError = voiceErrorByKey[exAudioKey] || null;
                    const selectedWordInThisEx =
                      inspectedWord && inspectedWord.exampleIndex === exIdx
                        ? ex.words[inspectedWord.wordIndex]
                        : null;
                    const exampleSurah = SURAHS_LIST.find((s) => s.number === ex.surahNumber);
                    const exampleSurahLabel = exampleSurah
                      ? getSurahDisplayName(exampleSurah, lang)
                      : ex.surahName;

                    return (
                      <div
                        key={exAudioKey}
                        className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#0b1117] border border-[#D9B45A]/25 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C5549] dark:text-slate-400">
                          <span className="font-semibold text-[#3F3A32] dark:text-slate-300 tabular-nums">
                            {isEnglish
                              ? `Surah ${exampleSurahLabel} · Ayah ${formatLocalizedDigits(ex.ayahNumber, lang)}`
                              : `سورة ${exampleSurahLabel} · آية ${ex.ayahNumber}`}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {isSpeechSupported && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleVoicePractice(exAudioKey, ex.uthmani)
                                }
                                className={`min-h-[36px] py-1 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                  isPracticingThis
                                    ? 'bg-[#D9B45A] border-[#8A6418] text-[#1B1A17]'
                                    : 'bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border-[#D9B45A]/45 text-[#8A6418] dark:text-[#D9B45A]'
                                }`}
                              >
                                {isPracticingThis ? (
                                  <>
                                    <Square className="w-3 h-3 fill-current" />
                                    <span>{isEnglish ? 'Stop Recitation' : 'إيقاف التلاوة'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{isEnglish ? 'Practice Aloud' : 'طبّق بصوتك'}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {isMicSupported && (
                              <button
                                type="button"
                                onClick={() => handleToggleSelfRecording(exAudioKey)}
                                className={`min-h-[36px] py-1 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                  isRecordingThis
                                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-700 dark:text-rose-200'
                                    : 'bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border-[#D9B45A]/25 dark:border-slate-700 text-[#1B1A17] dark:text-slate-200'
                                }`}
                              >
                                {isRecordingThis ? (
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

                            {recordedUrl && !isRecordingThis && (
                              <button
                                type="button"
                                onClick={() => handleTogglePlaySelfRecording(exAudioKey)}
                                className="min-h-[36px] py-1 px-2.5 rounded-lg bg-emerald-600/15 dark:bg-emerald-600/20 border border-emerald-500/45 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/25 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                {isPlayingSelf ? (
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

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleExampleAudio(
                                  exAudioKey,
                                  ex.surahNumber,
                                  ex.ayahNumber
                                )
                              }
                              className={`min-h-[36px] py-1 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                isPlayingThis
                                  ? 'bg-[#D9B45A] text-[#1B1A17]'
                                  : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
                              }`}
                            >
                              {isPlayingThis ? (
                                <>
                                  <Pause className="w-3 h-3 fill-current" />
                                  <span>{isEnglish ? 'Pause' : 'إيقاف'}</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current text-[#D9B45A]" />
                                  <span>{isEnglish ? 'Listen' : 'استمع'}</span>
                                </>
                              )}
                            </button>

                            {onNavigateToAyah && (
                              <button
                                type="button"
                                onClick={() => onNavigateToAyah(ex.surahNumber, ex.ayahNumber)}
                                className="min-h-[36px] py-1 px-2.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-700 text-xs text-[#1B1A17] dark:text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <span>{isEnglish ? 'In Mus’haf' : 'في المصحف'}</span>
                                <ExternalLink className="w-3 h-3 text-[#5C5549] dark:text-slate-400" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive Colored Uthmani Ayah */}
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-quran text-2xl sm:text-3xl leading-[2.5] text-center text-[#1B1A17] dark:text-slate-100"
                        >
                          {ex.words.map((wordTokens, wIdx) => {
                            const isWordSelected =
                              inspectedWord?.exampleIndex === exIdx &&
                              inspectedWord?.wordIndex === wIdx;
                            const isWordMatchedByVoice =
                              practiceEval?.matchedRawIndices.includes(wIdx) ?? false;
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
                                      ? 'bg-[#D9B45A]/25 ring-1 ring-[#D9B45A]'
                                      : isWordMatchedByVoice
                                      ? 'bg-emerald-500/20 ring-1 ring-emerald-500/70'
                                      : 'hover:bg-[#EFE6D1] dark:hover:bg-slate-800/70'
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
                                            isolateRuleColors ? 'text-[#9A8F7D] dark:text-slate-500' : undefined
                                          }
                                        >
                                          {tok.text}
                                        </span>
                                      );
                                    }

                                    if (isolateRuleColors && !matchesCurrentRule) {
                                      return (
                                        <span key={tIdx} className="text-[#9A8F7D] dark:text-slate-500">
                                          {tok.text}
                                        </span>
                                      );
                                    }

                                    return (
                                      <span
                                        key={tIdx}
                                        className={RULE_CLASS_MAP[tok.rule] || ''}
                                        title={getTajweedTokenTooltip(tok, lang)}
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

                        {(isPracticingThis || isRecordingThis || practiceEval || cardVoiceError) && (
                          <div className="p-2.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-950/90 border border-[#D9B45A]/25 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AudioLevelMeter
                                isActive={isPracticingThis || isRecordingThis}
                                mediaStream={isRecordingThis ? activeMediaStream : null}
                                activitySeed={cardTranscript.length}
                                tone={isRecordingThis ? 'rose' : 'gold'}
                              />
                              {cardVoiceError ? (
                                <span className="text-amber-700 dark:text-amber-200">{cardVoiceError}</span>
                              ) : isRecordingThis ? (
                                <span className="text-rose-700 dark:text-rose-300 font-semibold">
                                  {isEnglish
                                    ? 'Recording your voice for comparison…'
                                    : 'جارٍ تسجيل صوتك للمقارنة…'}
                                </span>
                              ) : (
                                <span className="text-[#3F3A32] dark:text-slate-300 truncate max-w-full sm:max-w-md">
                                  {practiceEval?.isComplete
                                    ? (isEnglish
                                        ? 'Masha’Allah! You completed the example recitation accurately'
                                        : 'ما شاء الله! أتممت تلاوة المثال وتطبيق الحكم بنجاح')
                                    : cardTranscript
                                    ? (isEnglish ? `Heard: “${cardTranscript}”` : `ما سُمع: «${cardTranscript}»`)
                                    : isPracticingThis
                                    ? (isEnglish
                                        ? 'Listening… please recite the example now'
                                        : 'أصغي لتلاوتك… تفضل بقراءة المثال الآن')
                                    : (isEnglish ? 'Ready to practice again' : 'جاهز لإعادة التدريب')}
                                </span>
                              )}
                            </div>
                            {practiceEval && !cardVoiceError && !isRecordingThis && (
                              <span
                                className={`font-bold ${
                                  practiceEval.isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#8A6418] dark:text-[#D9B45A]'
                                }`}
                              >
                                {isEnglish
                                  ? `Word Match: ${formatLocalizedDigits(practiceEval.accuracyPercent, lang)}%`
                                  : `مطابقة الكلمات: ${practiceEval.accuracyPercent}%`}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-[#5C5549] dark:text-slate-300 text-center leading-relaxed">
                          {isEnglish ? ex.focusNoteEn || ex.focusNote : ex.focusNote}
                        </p>

                        {/* Inline Clicked Word Breakdown */}
                        {selectedWordInThisEx && (
                          <div className="p-3 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-700 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">
                                {isEnglish ? 'Word Breakdown:' : 'تفصيل الكلمة:'}{' '}
                                <span dir="rtl" lang="ar" className="font-quran text-lg text-[#1B1A17] dark:text-white">
                                  {selectedWordInThisEx.map((t) => t.text).join('')}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectedWord(null)}
                                className="text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
                              >
                                {isEnglish ? 'Close' : 'إغلاق'}
                              </button>
                            </div>
                            {selectedWordInThisEx.some((t) => t.rule) ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedWordInThisEx
                                  .filter((t) => Boolean(t.rule))
                                  .map((tok, i) => (
                                    <span
                                      key={i}
                                      className="px-2.5 py-1 rounded bg-white dark:bg-slate-950 border border-[#D9B45A]/20 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200"
                                    >
                                      <strong
                                        dir="rtl"
                                        lang="ar"
                                        className={`font-quran text-base me-1 ${
                                          tok.rule ? RULE_CLASS_MAP[tok.rule] : ''
                                        }`}
                                      >
                                        {tok.text}
                                      </strong>
                                      {getTajweedTokenTooltip(tok, lang)}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-[#5C5549] dark:text-slate-400 block">
                                {isEnglish
                                  ? 'Letters in this word are pronounced normally with no special Tajweed color rule.'
                                  : 'حروف هذه الكلمة تُنطق بالإظهار الأصلي دون حكم تلوين خاص.'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800">
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{isEnglish ? 'Common Mistake to Avoid' : 'خطأ شائع يُحذَر منه'}</span>
                  </div>
                  <p className="text-xs text-[#3F3A32] dark:text-slate-200 leading-relaxed">
                    {isEnglish
                      ? selectedRule.commonMistake.mistakeEn || selectedRule.commonMistake.mistake
                      : selectedRule.commonMistake.mistake}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{isEnglish ? 'Correct Articulation' : 'الأداء الصحيح'}</span>
                  </div>
                  <p className="text-xs text-[#3F3A32] dark:text-slate-200 leading-relaxed">
                    {isEnglish
                      ? selectedRule.commonMistake.correctionEn || selectedRule.commonMistake.correction
                      : selectedRule.commonMistake.correction}
                  </p>
                </div>
              </div>

              {/* Practical Acoustic Benefit */}
              <div className="text-xs text-[#3F3A32] dark:text-slate-300 leading-relaxed pt-1">
                <strong className="text-[#8A6418] dark:text-[#D9B45A]">
                  {isEnglish ? 'Acoustic & Aesthetic Impact: ' : 'الأثر الصوتي والجمالي: '}
                </strong>
                {getTajweedRuleBenefit(selectedRule, lang)}
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
      {activeTab === 'quiz' && (
        <TajweedQuizHub selectedReciter={selectedReciter} onPauseAudio={onPauseAudio} />
      )}
    </div>
  );
};
