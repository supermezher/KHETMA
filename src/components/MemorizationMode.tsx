import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Ayah, getMushafPageData, sanitizeAyahText } from '../data/quranService';
import { SURAHS_LIST } from '../data/quranMetadata';
import { safeLocalStorage } from '../utils/safeStorage';
import { formatLocalDate, recordAyahReadActivity } from '../data/faithAnalyticsService';
import { recordMushafPageReadInWird } from '../utils/personalKhatma';
import {
  evaluateRecitationAgainstAyah,
  getSpeechRecognitionConstructor,
  RecitationEvaluationResult,
  SpeechRecognitionLike,
} from '../utils/recitationMatcher';
import { toArabicIndic } from './khatma/KhatmaRing';
import { AudioLevelMeter } from './AudioLevelMeter';
import {
  MemorizationRepeatTarget,
  HidePattern,
  StudyTab,
  QuizMode,
  SrsRating,
  SrsRecord,
  HifzScopeMode,
  ReciteViewMode,
  SRS_STORAGE_KEY,
  computeNextSrsState,
  extractWordFirstLetterHint,
  isMemorizationWordHidden,
  getNextHiddenWordIndex,
  filterAyahsInRange,
  computeMasterySummary,
  buildLinkingQuizPrompts,
  buildFillBlankQuizPrompts,
  buildSurahPageSpans,
  computePageMasteryStats,
  findSurahForMushafPageFallback,
  findSurahsStartingOnMushafPage,
  setPendingMushafPageTarget,
  consumePendingMushafPageState,
} from '../utils/memorizationHelpers';
import {
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  Award,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Pause,
  BrainCircuit,
  CalendarClock,
  Lightbulb,
  BookOpenText,
  BookOpen,
  Layers,
  Mic,
  Square,
  Play,
  Repeat,
  Timer,
  Sparkles,
  Trophy,
} from 'lucide-react';

export type { MemorizationRepeatTarget, SrsRecord };
export { computeNextSrsState };

export interface PlaybackCycleEvent {
  ayahNumber: number;
  nonce: number;
}

interface MemorizationModeProps {
  ayahs: Ayah[];
  surahNumber: number;
  surahName: string;
  onClose: () => void;
  onPlayAyah: (ayahNum: number) => void;
  onPauseAudio?: () => void;
  onFocusAyah?: (ayahNum: number) => void;
  onChangeSurah?: (surahNum: number) => void;
  activeAudioAyahNumber?: number;
  isPlayingAudio?: boolean;
  repeatTarget?: MemorizationRepeatTarget;
  onChangeRepeatTarget?: (target: MemorizationRepeatTarget) => void;
  currentRepeat?: number;
  playbackCycleEvent?: PlaybackCycleEvent | null;
  reciterName?: string;
}

type RangePlaybackMode = 'single' | 'range' | 'range-loop';

function getInitialRangeForSurah(ayahs: Ayah[], anchorAyah?: number): { start: number; end: number } {
  if (ayahs.length === 0) return { start: 1, end: 1 };
  const firstNum = ayahs[0].numberInSurah;
  const lastNum = ayahs[ayahs.length - 1].numberInSurah;
  if (ayahs.length <= 15) {
    return { start: firstNum, end: lastNum };
  }
  const clampedAnchor =
    anchorAyah && anchorAyah >= firstNum && anchorAyah <= lastNum ? anchorAyah : firstNum;
  const start = clampedAnchor;
  const end = Math.min(lastNum, start + 6);
  return { start, end };
}

export const MemorizationMode: React.FC<MemorizationModeProps> = ({
  ayahs,
  surahNumber,
  surahName,
  onClose,
  onPlayAyah,
  onPauseAudio,
  onFocusAyah,
  onChangeSurah,
  activeAudioAyahNumber,
  isPlayingAudio = false,
  repeatTarget: propRepeatTarget,
  onChangeRepeatTarget: propOnChangeRepeatTarget,
  currentRepeat: propCurrentRepeat,
  playbackCycleEvent,
  reciterName,
}) => {
  const [studyTab, setStudyTab] = useState<StudyTab>('recite');
  const [quizMode, setQuizMode] = useState<QuizMode>('next-ayah');
  const [onlyDueFilter, setOnlyDueFilter] = useState<boolean>(false);

  const surahPageSpans = useMemo(() => buildSurahPageSpans(ayahs), [ayahs]);

  const initialBounds = useMemo(
    () => getInitialRangeForSurah(ayahs, activeAudioAyahNumber),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surahNumber, ayahs.length]
  );

  const [scopeMode, setScopeMode] = useState<HifzScopeMode>('ayah-range');
  const scopeModeRef = useRef<HifzScopeMode>('ayah-range');
  const [reciteViewMode, setReciteViewMode] = useState<ReciteViewMode>('single-ayah');
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>(
    () => surahPageSpans[0]?.pageNumber ?? 1
  );
  const [pageJumpInput, setPageJumpInput] = useState<string>(
    () => String(surahPageSpans[0]?.pageNumber ?? 1)
  );
  const [isJumpingPage, setIsJumpingPage] = useState<boolean>(false);
  const [coSurahsOnPage, setCoSurahsOnPage] = useState<
    Array<{ surahNumber: number; surahName: string; startAyah: number; endAyah: number }>
  >([]);

  const [rangeStart, setRangeStart] = useState<number>(initialBounds.start);
  const [rangeEnd, setRangeEnd] = useState<number>(initialBounds.end);

  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [hidePattern, setHidePattern] = useState<HidePattern>('first-word-only');
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());
  const [pageRevealedMap, setPageRevealedMap] = useState<Record<number, Set<number>>>({});
  const [showTafsirAnchor, setShowTafsirAnchor] = useState<boolean>(false);

  const [internalRepeatTarget, setInternalRepeatTarget] = useState<MemorizationRepeatTarget>(1);
  const repeatTarget = propRepeatTarget ?? internalRepeatTarget;
  const setRepeatTarget = propOnChangeRepeatTarget ?? setInternalRepeatTarget;
  const currentRepeat = propCurrentRepeat ?? 1;

  const [rangePlaybackMode, setRangePlaybackMode] = useState<RangePlaybackMode>('single');
  const [pauseForRepeatSec, setPauseForRepeatSec] = useState<0 | 3>(0);
  const [waitingCountdown, setWaitingCountdown] = useState<number | null>(null);
  const pendingAdvanceTimerRef = useRef<number | null>(null);
  const pendingCountdownIntervalRef = useRef<number | null>(null);
  const lastHandledCycleNonceRef = useRef<number>(playbackCycleEvent?.nonce ?? 0);

  const [srsMap, setSrsMap] = useState<Record<string, SrsRecord>>(() => {
    return safeLocalStorage.getJSON<Record<string, SrsRecord>>(SRS_STORAGE_KEY, {});
  });

  // Self-Recitation Local Mic Recording state
  const [isMicSupported] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined'
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingSelfRec, setIsPlayingSelfRec] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const selfAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  // Live Smart Voice Tasmie (Arabic Speech Recognition -> automatic word reveal & miss detection)
  const [isSpeechSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionConstructor()));
  const [isVoiceChecking, setIsVoiceChecking] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceEval, setVoiceEval] = useState<RecitationEvaluationResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceIntentStopRef = useRef<boolean>(false);
  const speechContextRef = useRef<{
    ayahNumber: number;
    words: string[];
    isFullPage: boolean;
  }>({ ayahNumber: 1, words: [], isFullPage: false });

  // Quiz state
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | number | null>(null);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  const [missedQuizIds, setMissedQuizIds] = useState<string[]>([]);
  const [reviewMissedOnlyIds, setReviewMissedOnlyIds] = useState<Set<string> | null>(null);

  const clearPendingAdvanceTimers = useCallback(() => {
    if (pendingAdvanceTimerRef.current !== null) {
      window.clearTimeout(pendingAdvanceTimerRef.current);
      pendingAdvanceTimerRef.current = null;
    }
    if (pendingCountdownIntervalRef.current !== null) {
      window.clearInterval(pendingCountdownIntervalRef.current);
      pendingCountdownIntervalRef.current = null;
    }
    setWaitingCountdown(null);
  }, []);

  const stopVoiceCheck = useCallback((clearResults = false) => {
    voiceIntentStopRef.current = true;
    if (speechRecRef.current) {
      try {
        speechRecRef.current.onresult = null;
        speechRecRef.current.onerror = null;
        speechRecRef.current.onend = null;
        speechRecRef.current.stop();
      } catch {
        // Ignore already-stopped SpeechRecognition
      }
      speechRecRef.current = null;
    }
    setIsVoiceChecking(false);
    if (clearResults) {
      setVoiceTranscript('');
      setVoiceEval(null);
      setVoiceError(null);
    }
  }, []);

  const cleanupRecordingResources = useCallback((clearAudioUrl = true) => {
    stopVoiceCheck(clearAudioUrl);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore already-stopped recorder
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setActiveMediaStream(null);
    setIsRecording(false);
    if (clearAudioUrl) {
      if (selfAudioRef.current) {
        selfAudioRef.current.pause();
      }
      setIsPlayingSelfRec(false);
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
      setRecordedAudioUrl(null);
    }
  }, [stopVoiceCheck]);

  useEffect(() => {
    scopeModeRef.current = scopeMode;
  }, [scopeMode]);

  // Reset state cleanly when surah changes (honoring cross-surah Mushaf page navigation targets)
  useEffect(() => {
    clearPendingAdvanceTimers();
    cleanupRecordingResources(true);
    const pendingTarget = consumePendingMushafPageState(surahNumber);
    if (pendingTarget !== null && surahPageSpans.length > 0) {
      const matchedSpan =
        surahPageSpans.find((sp) => sp.pageNumber === pendingTarget.pageNumber) ?? surahPageSpans[0];
      setScopeMode('mushaf-page');
      scopeModeRef.current = 'mushaf-page';
      setReciteViewMode(pendingTarget.reciteViewMode);
      setSelectedPageNumber(matchedSpan.pageNumber);
      setPageJumpInput(String(matchedSpan.pageNumber));
      setRangeStart(matchedSpan.startAyah);
      setRangeEnd(matchedSpan.endAyah);
      onFocusAyah?.(matchedSpan.startAyah);
    } else if (scopeModeRef.current === 'mushaf-page' && surahPageSpans.length > 0) {
      const firstSpan = surahPageSpans[0];
      setSelectedPageNumber(firstSpan.pageNumber);
      setPageJumpInput(String(firstSpan.pageNumber));
      setRangeStart(firstSpan.startAyah);
      setRangeEnd(firstSpan.endAyah);
      onFocusAyah?.(firstSpan.startAyah);
    } else {
      setRangeStart(initialBounds.start);
      setRangeEnd(initialBounds.end);
      if (surahPageSpans[0]) {
        setSelectedPageNumber(surahPageSpans[0].pageNumber);
        setPageJumpInput(String(surahPageSpans[0].pageNumber));
      }
    }
    setCurrentIdx(0);
    setRevealedWordIndices(new Set());
    setPageRevealedMap({});
    setOnlyDueFilter(false);
    setQuizIndex(0);
    setSelectedQuizAnswer(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizFinished(false);
    setMissedQuizIds([]);
    setReviewMissedOnlyIds(null);
    setMicError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber, surahPageSpans, initialBounds.start, initialBounds.end, clearPendingAdvanceTimers, cleanupRecordingResources]);

  // Load shared-page Surah breakdown whenever browsing in Mus'haf page mode
  useEffect(() => {
    if (scopeMode !== 'mushaf-page') {
      setCoSurahsOnPage([]);
      return;
    }

    let cancelled = false;
    const fallbackSurahs = findSurahsStartingOnMushafPage(selectedPageNumber).map((s) => ({
      surahNumber: s.number,
      surahName: s.name,
      startAyah: 1,
      endAyah: s.numberOfAyahs,
    }));
    setCoSurahsOnPage(fallbackSurahs);

    getMushafPageData(selectedPageNumber)
      .then((pageData) => {
        if (cancelled || !pageData?.ayahs?.length) return;
        const grouped: Array<{
          surahNumber: number;
          surahName: string;
          startAyah: number;
          endAyah: number;
        }> = [];
        for (const a of pageData.ayahs) {
          const last = grouped[grouped.length - 1];
          if (!last || last.surahNumber !== a.surahNumber) {
            grouped.push({
              surahNumber: a.surahNumber,
              surahName: a.surahName,
              startAyah: a.numberInSurah,
              endAyah: a.numberInSurah,
            });
          } else {
            last.endAyah = a.numberInSurah;
          }
        }
        setCoSurahsOnPage(grouped);
      })
      .catch(() => {
        // Retain deterministic metadata fallback offline
      });

    return () => {
      cancelled = true;
    };
  }, [scopeMode, selectedPageNumber]);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      clearPendingAdvanceTimers();
      cleanupRecordingResources(true);
    };
  }, [clearPendingAdvanceTimers, cleanupRecordingResources]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearPendingAdvanceTimers();
        cleanupRecordingResources(true);
        onPauseAudio?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPauseAudio, clearPendingAdvanceTimers, cleanupRecordingResources]);

  const todayStr = formatLocalDate(new Date());

  const rangeAyahs = useMemo(
    () => filterAyahsInRange(ayahs, rangeStart, rangeEnd),
    [ayahs, rangeStart, rangeEnd]
  );

  const dueAyahsInRange = useMemo(() => {
    return rangeAyahs.filter((a) => {
      const rec = srsMap[`${surahNumber}:${a.numberInSurah}`];
      return !rec || rec.nextReviewDate <= todayStr;
    });
  }, [rangeAyahs, srsMap, surahNumber, todayStr]);

  const rangeSummary = useMemo(
    () => computeMasterySummary(rangeAyahs, srsMap, surahNumber, todayStr),
    [rangeAyahs, srsMap, surahNumber, todayStr]
  );

  const surahSummary = useMemo(
    () => computeMasterySummary(ayahs, srsMap, surahNumber, todayStr),
    [ayahs, srsMap, surahNumber, todayStr]
  );

  const isDueListEmpty = onlyDueFilter && dueAyahsInRange.length === 0;
  const activeAyahList = onlyDueFilter ? dueAyahsInRange : rangeAyahs;
  const safeIdx =
    activeAyahList.length > 0 ? Math.min(currentIdx, activeAyahList.length - 1) : 0;
  const currentAyah = activeAyahList[safeIdx] ?? null;

  // Build prompts for both Quiz modes
  const baseLinkingPrompts = useMemo(
    () => buildLinkingQuizPrompts(rangeAyahs, ayahs, surahNumber),
    [rangeAyahs, ayahs, surahNumber]
  );

  const baseFillBlankPrompts = useMemo(
    () => buildFillBlankQuizPrompts(rangeAyahs, ayahs, surahNumber),
    [rangeAyahs, ayahs, surahNumber]
  );

  const activeQuizPrompts = useMemo(() => {
    const source = quizMode === 'next-ayah' ? baseLinkingPrompts : baseFillBlankPrompts;
    if (reviewMissedOnlyIds && reviewMissedOnlyIds.size > 0) {
      const filtered = source.filter((item) => reviewMissedOnlyIds.has(item.id));
      return filtered.length > 0 ? filtered : source;
    }
    return source;
  }, [quizMode, baseLinkingPrompts, baseFillBlankPrompts, reviewMissedOnlyIds]);

  const activeQuizItem = activeQuizPrompts[quizIndex] ?? null;

  const selectAyahIndex = useCallback(
    (nextIdx: number, shouldPlay = false) => {
      if (nextIdx < 0 || nextIdx >= activeAyahList.length) return;
      clearPendingAdvanceTimers();
      cleanupRecordingResources(true);
      if (!shouldPlay && isPlayingAudio) {
        onPauseAudio?.();
      }
      setCurrentIdx(nextIdx);
      setRevealedWordIndices(new Set());
      setMicError(null);
      const nextAyah = activeAyahList[nextIdx];
      if (nextAyah) {
        onFocusAyah?.(nextAyah.numberInSurah);
        if (shouldPlay) {
          onPlayAyah(nextAyah.numberInSurah);
        }
      }
    },
    [
      activeAyahList,
      clearPendingAdvanceTimers,
      cleanupRecordingResources,
      isPlayingAudio,
      onPauseAudio,
      onFocusAyah,
      onPlayAyah,
    ]
  );

  // Sync range auto-advance whenever AudioPlayerBar finishes natural repeats
  useEffect(() => {
    if (!playbackCycleEvent) return;
    if (playbackCycleEvent.nonce === lastHandledCycleNonceRef.current) return;
    lastHandledCycleNonceRef.current = playbackCycleEvent.nonce;

    if (studyTab !== 'recite' || rangePlaybackMode === 'single' || !currentAyah) return;
    if (playbackCycleEvent.ayahNumber !== currentAyah.numberInSurah) return;

    const currentPosition = activeAyahList.findIndex(
      (a) => a.numberInSurah === currentAyah.numberInSurah
    );
    if (currentPosition === -1) return;

    let nextIdx: number | null = null;
    if (currentPosition + 1 < activeAyahList.length) {
      nextIdx = currentPosition + 1;
    } else if (rangePlaybackMode === 'range-loop' && activeAyahList.length > 0) {
      nextIdx = 0;
    }

    if (nextIdx === null) return;

    const targetIdx = nextIdx;
    if (pauseForRepeatSec === 0) {
      selectAyahIndex(targetIdx, true);
      return;
    }

    let remaining = pauseForRepeatSec;
    setWaitingCountdown(remaining);
    pendingCountdownIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (pendingCountdownIntervalRef.current !== null) {
          window.clearInterval(pendingCountdownIntervalRef.current);
          pendingCountdownIntervalRef.current = null;
        }
        setWaitingCountdown(null);
      } else {
        setWaitingCountdown(remaining);
      }
    }, 1000);

    pendingAdvanceTimerRef.current = window.setTimeout(() => {
      pendingAdvanceTimerRef.current = null;
      setWaitingCountdown(null);
      selectAyahIndex(targetIdx, true);
    }, pauseForRepeatSec * 1000);
  }, [
    playbackCycleEvent,
    studyTab,
    rangePlaybackMode,
    currentAyah,
    activeAyahList,
    pauseForRepeatSec,
    selectAyahIndex,
  ]);

  const cleanText = currentAyah
    ? sanitizeAyahText(currentAyah.text, surahNumber, currentAyah.numberInSurah)
    : '';
  const words = useMemo(
    () => (cleanText.trim() ? cleanText.trim().split(/\s+/) : []),
    [cleanText]
  );

  useEffect(() => {
    speechContextRef.current = {
      ayahNumber: currentAyah?.numberInSurah ?? 1,
      words,
      isFullPage: scopeMode === 'mushaf-page' && reciteViewMode === 'full-page',
    };
  }, [currentAyah?.numberInSurah, words, scopeMode, reciteViewMode]);

  const revealNextWordHint = useCallback(() => {
    if (scopeMode === 'mushaf-page' && reciteViewMode === 'full-page') {
      if (activeAyahList.length === 0) return;
      for (let offset = 0; offset < activeAyahList.length; offset++) {
        const idx = (safeIdx + offset) % activeAyahList.length;
        const candidateAyah = activeAyahList[idx];
        const candidateText = sanitizeAyahText(
          candidateAyah.text,
          surahNumber,
          candidateAyah.numberInSurah
        );
        const candidateWords = candidateText.trim() ? candidateText.trim().split(/\s+/) : [];
        const revealedForAyah = pageRevealedMap[candidateAyah.numberInSurah] ?? new Set<number>();
        const nextWordIdx = getNextHiddenWordIndex(
          candidateWords.length,
          hidePattern,
          revealedForAyah
        );
        if (nextWordIdx !== null) {
          setPageRevealedMap((prev) => {
            const currentSet = new Set(prev[candidateAyah.numberInSurah] ?? []);
            currentSet.add(nextWordIdx);
            return { ...prev, [candidateAyah.numberInSurah]: currentSet };
          });
          if (idx !== safeIdx) {
            setCurrentIdx(idx);
            onFocusAyah?.(candidateAyah.numberInSurah);
          }
          return;
        }
      }
      return;
    }

    const nextWordIdx = getNextHiddenWordIndex(words.length, hidePattern, revealedWordIndices);
    if (nextWordIdx === null) return;
    setRevealedWordIndices((prev) => {
      const updated = new Set(prev);
      updated.add(nextWordIdx);
      return updated;
    });
  }, [
    scopeMode,
    reciteViewMode,
    activeAyahList,
    safeIdx,
    surahNumber,
    pageRevealedMap,
    words.length,
    hidePattern,
    revealedWordIndices,
    onFocusAyah,
  ]);

  // Scoped keyboard navigation for desktop efficiency
  useEffect(() => {
    if (studyTab !== 'recite' || !currentAyah) return;
    const handleNavKeys = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (safeIdx < activeAyahList.length - 1) {
          e.preventDefault();
          selectAyahIndex(safeIdx + 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (safeIdx > 0) {
          e.preventDefault();
          selectAyahIndex(safeIdx - 1);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        revealNextWordHint();
      }
    };
    window.addEventListener('keydown', handleNavKeys);
    return () => window.removeEventListener('keydown', handleNavKeys);
  }, [studyTab, currentAyah, safeIdx, activeAyahList.length, selectAyahIndex, revealNextWordHint]);

  const currentRecord = currentAyah
    ? srsMap[`${surahNumber}:${currentAyah.numberInSurah}`]
    : undefined;

  const isCurrentAyahPlaying = Boolean(
    currentAyah && isPlayingAudio && activeAudioAyahNumber === currentAyah.numberInSurah
  );

  const nextHiddenIndex = getNextHiddenWordIndex(words.length, hidePattern, revealedWordIndices);

  const activePageSpan = useMemo(
    () =>
      surahPageSpans.find((sp) => sp.pageNumber === selectedPageNumber) ??
      surahPageSpans[0] ??
      null,
    [surahPageSpans, selectedPageNumber]
  );

  const activePageStats = useMemo(
    () =>
      activePageSpan
        ? computePageMasteryStats(activePageSpan, ayahs, srsMap, surahNumber, todayStr)
        : null,
    [activePageSpan, ayahs, srsMap, surahNumber, todayStr]
  );

  if (ayahs.length === 0) return null;

  const handleRangeChange = (nextStart: number, nextEnd: number) => {
    clearPendingAdvanceTimers();
    cleanupRecordingResources(true);
    if (isPlayingAudio) onPauseAudio?.();
    const clampedStart = Math.max(1, Math.min(ayahs.length, nextStart));
    const clampedEnd = Math.max(clampedStart, Math.min(ayahs.length, nextEnd));
    setRangeStart(clampedStart);
    setRangeEnd(clampedEnd);

    const nextRange = filterAyahsInRange(ayahs, clampedStart, clampedEnd);
    const preservedIdx = currentAyah
      ? nextRange.findIndex((a) => a.numberInSurah === currentAyah.numberInSurah)
      : -1;
    const nextIdx = preservedIdx >= 0 ? preservedIdx : 0;
    setCurrentIdx(nextIdx);
    setRevealedWordIndices(new Set());
    setPageRevealedMap({});
    setQuizIndex(0);
    setSelectedQuizAnswer(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizFinished(false);
    setMissedQuizIds([]);
    setReviewMissedOnlyIds(null);
    const nextFocusAyah = nextRange[nextIdx]?.numberInSurah ?? clampedStart;
    onFocusAyah?.(nextFocusAyah);
  };

  const applyPresetRange = (size: number | 'all') => {
    if (size === 'all') {
      handleRangeChange(1, ayahs.length);
      return;
    }
    const anchor = currentAyah?.numberInSurah ?? rangeStart;
    const start = Math.min(anchor, Math.max(1, ayahs.length - size + 1));
    const end = Math.min(ayahs.length, start + size - 1);
    handleRangeChange(start, end);
  };

  const handleSelectMushafPage = async (rawPage: number, overrideSurahNum?: number) => {
    const safePage = Math.max(1, Math.min(604, Math.round(rawPage)));
    if (overrideSurahNum && overrideSurahNum !== surahNumber && onChangeSurah) {
      clearPendingAdvanceTimers();
      cleanupRecordingResources(true);
      if (isPlayingAudio) onPauseAudio?.();
      setPendingMushafPageTarget({
        surahNumber: overrideSurahNum,
        pageNumber: safePage,
        reciteViewMode,
      });
      onChangeSurah(overrideSurahNum);
      return;
    }

    const localSpan = surahPageSpans.find((sp) => sp.pageNumber === safePage);
    if (localSpan && (!overrideSurahNum || overrideSurahNum === surahNumber)) {
      setSelectedPageNumber(localSpan.pageNumber);
      setPageJumpInput(String(localSpan.pageNumber));
      handleRangeChange(localSpan.startAyah, localSpan.endAyah);
      setCurrentIdx(0);
      onFocusAyah?.(localSpan.startAyah);
      return;
    }

    if (!onChangeSurah) return;

    setIsJumpingPage(true);
    clearPendingAdvanceTimers();
    cleanupRecordingResources(true);
    if (isPlayingAudio) onPauseAudio?.();
    try {
      let targetSurah = findSurahForMushafPageFallback(safePage).number;
      try {
        const pageData = await getMushafPageData(safePage);
        if (pageData?.ayahs?.length) {
          targetSurah = pageData.ayahs[0].surahNumber;
        }
      } catch {
        // Fallback metadata surah already set
      }
      if (targetSurah === surahNumber) {
        const fallbackLocal = surahPageSpans.find((sp) => sp.pageNumber === safePage);
        if (fallbackLocal) {
          setSelectedPageNumber(fallbackLocal.pageNumber);
          setPageJumpInput(String(fallbackLocal.pageNumber));
          handleRangeChange(fallbackLocal.startAyah, fallbackLocal.endAyah);
          setCurrentIdx(0);
          onFocusAyah?.(fallbackLocal.startAyah);
        }
      } else {
        setPendingMushafPageTarget({
          surahNumber: targetSurah,
          pageNumber: safePage,
          reciteViewMode,
        });
        onChangeSurah(targetSurah);
      }
    } finally {
      setIsJumpingPage(false);
    }
  };

  const handleSwitchScopeMode = (nextScope: HifzScopeMode) => {
    if (nextScope === scopeMode) return;
    clearPendingAdvanceTimers();
    cleanupRecordingResources(true);
    if (isPlayingAudio) onPauseAudio?.();
    setScopeMode(nextScope);
    if (nextScope === 'mushaf-page') {
      setReciteViewMode('full-page');
      const anchorPage = currentAyah?.page ?? surahPageSpans[0]?.pageNumber ?? 1;
      const targetSpan =
        surahPageSpans.find((sp) => sp.pageNumber === anchorPage) ?? surahPageSpans[0];
      if (targetSpan) {
        setSelectedPageNumber(targetSpan.pageNumber);
        setPageJumpInput(String(targetSpan.pageNumber));
        handleRangeChange(targetSpan.startAyah, targetSpan.endAyah);
        setCurrentIdx(0);
        onFocusAyah?.(targetSpan.startAyah);
      }
    } else {
      setReciteViewMode('single-ayah');
    }
  };

  const toggleRevealWord = (index: number) => {
    setRevealedWordIndices((prev) => {
      const updated = new Set(prev);
      if (updated.has(index)) updated.delete(index);
      else updated.add(index);
      return updated;
    });
  };

  const toggleRevealPageWord = (ayahNum: number, wordIdx: number) => {
    setPageRevealedMap((prev) => {
      const nextSet = new Set(prev[ayahNum] ?? []);
      if (nextSet.has(wordIdx)) nextSet.delete(wordIdx);
      else nextSet.add(wordIdx);
      return { ...prev, [ayahNum]: nextSet };
    });
  };

  const revealAll = () => {
    if (scopeMode === 'mushaf-page' && reciteViewMode === 'full-page') {
      const nextMap: Record<number, Set<number>> = {};
      for (const a of activeAyahList) {
        const t = sanitizeAyahText(a.text, surahNumber, a.numberInSurah);
        const w = t.trim() ? t.trim().split(/\s+/) : [];
        nextMap[a.numberInSurah] = new Set(w.map((_, i) => i));
      }
      setPageRevealedMap(nextMap);
      return;
    }
    setRevealedWordIndices(new Set(words.map((_, i) => i)));
  };

  const hideAll = () => {
    if (scopeMode === 'mushaf-page' && reciteViewMode === 'full-page') {
      setPageRevealedMap({});
      return;
    }
    setRevealedWordIndices(new Set());
  };

  const setAyahMastery = (status: SrsRating) => {
    if (!currentAyah) return;
    const key = `${surahNumber}:${currentAyah.numberInSurah}`;
    setSrsMap((prev) => {
      const nextRecord = computeNextSrsState(prev[key], status);
      const updated = { ...prev, [key]: nextRecord };
      safeLocalStorage.setJSON(SRS_STORAGE_KEY, updated);
      return updated;
    });
    if (safeIdx < activeAyahList.length - 1) {
      selectAyahIndex(safeIdx + 1);
    }
  };

  const setPageMastery = (status: SrsRating) => {
    if (rangeAyahs.length === 0) return;
    setSrsMap((prev) => {
      const updated = { ...prev };
      for (const a of rangeAyahs) {
        const key = `${surahNumber}:${a.numberInSurah}`;
        updated[key] = computeNextSrsState(prev[key], status);
      }
      safeLocalStorage.setJSON(SRS_STORAGE_KEY, updated);
      return updated;
    });
    if (status === 'mastered') {
      recordAyahReadActivity(rangeAyahs.length, 0);
      if (activePageSpan?.pageNumber) {
        recordMushafPageReadInWird(activePageSpan.pageNumber);
      }
    }
  };

  const handleToggleVoiceCheck = () => {
    if (isVoiceChecking) {
      stopVoiceCheck(false);
      return;
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor || !currentAyah) {
      setVoiceError('المتصفح الحالي لا يدعم التسميع الصوتي المباشر؛ يمكنك استخدام زر «سجّل تسميعك وقارن».');
      return;
    }

    try {
      clearPendingAdvanceTimers();
      if (isPlayingAudio) onPauseAudio?.();
      cleanupRecordingResources(true);
      voiceIntentStopRef.current = false;
      setVoiceError(null);
      setVoiceTranscript('');
      setVoiceEval(null);

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
        const combinedTranscript = parts.join(' ').trim();
        setVoiceTranscript(combinedTranscript);

        const ctx = speechContextRef.current;
        const result = evaluateRecitationAgainstAyah(ctx.words, combinedTranscript);
        setVoiceEval(result);

        if (result.matchedRawIndices.length > 0) {
          if (ctx.isFullPage) {
            setPageRevealedMap((prev) => {
              const nextSet = new Set(prev[ctx.ayahNumber] ?? []);
              result.matchedRawIndices.forEach((idx) => nextSet.add(idx));
              return { ...prev, [ctx.ayahNumber]: nextSet };
            });
          } else {
            setRevealedWordIndices((prev) => {
              const nextSet = new Set(prev);
              result.matchedRawIndices.forEach((idx) => nextSet.add(idx));
              return nextSet;
            });
          }
        }

        if (result.isComplete) {
          voiceIntentStopRef.current = true;
          try {
            recognition.stop();
          } catch {
            // Ignore stop race
          }
          speechRecRef.current = null;
          setIsVoiceChecking(false);
        }
      };

      recognition.onerror = (event) => {
        if (voiceIntentStopRef.current || event?.error === 'aborted') {
          setIsVoiceChecking(false);
          return;
        }
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setVoiceError('يرجى السماح بصلاحية الميكروفون للتسميع الصوتي الذكي.');
        } else if (event?.error === 'no-speech') {
          setVoiceError('لم يُلتقط صوت واضح؛ اقترب من الميكروفون وابدأ القراءة.');
        } else if (event?.error === 'network') {
          setVoiceError('تتعذر خدمة التعرف الصوتي دون إنترنت؛ استخدم «سجّل تسميعك وقارن».');
        } else {
          setVoiceError('تعذر متابعة التسميع الصوتي؛ حاول مرة أخرى.');
        }
        speechRecRef.current = null;
        setIsVoiceChecking(false);
      };

      recognition.onend = () => {
        if (!voiceIntentStopRef.current) {
          speechRecRef.current = null;
          setIsVoiceChecking(false);
        }
      };

      speechRecRef.current = recognition;
      recognition.start();
      setIsVoiceChecking(true);
    } catch {
      speechRecRef.current = null;
      setIsVoiceChecking(false);
      setVoiceError('تعذر تشغيل التسميع الصوتي المباشر في هذا المتصفح.');
    }
  };

  const handleToggleSelfRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!isMicSupported) {
      setMicError('المتصفح الحالي لا يدعم التسجيل الصوتي المحلي.');
      return;
    }

    try {
      clearPendingAdvanceTimers();
      if (isPlayingAudio) onPauseAudio?.();
      cleanupRecordingResources(true);
      setMicError(null);

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
        setIsRecording(false);
        const chunks = recordingChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const nextUrl = URL.createObjectURL(blob);
          if (recordedUrlRef.current) {
            URL.revokeObjectURL(recordedUrlRef.current);
          }
          recordedUrlRef.current = nextUrl;
          setRecordedAudioUrl(nextUrl);
        }
        recordingChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      cleanupRecordingResources(false);
      setMicError('تعذر الوصول للميكروفون؛ يرجى السماح بصلاحية الصوت في المتصفح.');
    }
  };

  const handleTogglePlaySelfRecording = () => {
    if (!selfAudioRef.current || !recordedAudioUrl) return;
    if (isPlayingAudio) onPauseAudio?.();
    if (isPlayingSelfRec) {
      selfAudioRef.current.pause();
      setIsPlayingSelfRec(false);
    } else {
      selfAudioRef.current.currentTime = 0;
      selfAudioRef.current
        .play()
        .then(() => setIsPlayingSelfRec(true))
        .catch(() => setIsPlayingSelfRec(false));
    }
  };

  const handleSwitchTab = (nextTab: StudyTab) => {
    clearPendingAdvanceTimers();
    cleanupRecordingResources(true);
    if (isPlayingAudio) onPauseAudio?.();
    setStudyTab(nextTab);
    if (nextTab === 'linking-quiz') {
      setQuizIndex(0);
      setSelectedQuizAnswer(null);
      setQuizScore({ correct: 0, total: 0 });
      setQuizFinished(false);
      setMissedQuizIds([]);
      setReviewMissedOnlyIds(null);
    }
  };

  const handleSwitchQuizMode = (nextMode: QuizMode) => {
    setQuizMode(nextMode);
    setQuizIndex(0);
    setSelectedQuizAnswer(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizFinished(false);
    setMissedQuizIds([]);
    setReviewMissedOnlyIds(null);
  };

  const handlePickQuizOption = (chosenValue: string | number, promptId: string, correctVal: string | number, targetAyahNum: number) => {
    if (selectedQuizAnswer !== null) return;
    setSelectedQuizAnswer(chosenValue);
    const isCorrect = chosenValue === correctVal;
    setQuizScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    if (!isCorrect) {
      setMissedQuizIds((prev) => (prev.includes(promptId) ? prev : [...prev, promptId]));
      const key = `${surahNumber}:${targetAyahNum}`;
      setSrsMap((prev) => {
        const updated = { ...prev, [key]: computeNextSrsState(prev[key], 'needs-review') };
        safeLocalStorage.setJSON(SRS_STORAGE_KEY, updated);
        return updated;
      });
    }
  };

  const handleAdvanceQuiz = () => {
    setSelectedQuizAnswer(null);
    if (quizIndex + 1 < activeQuizPrompts.length) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleRestartQuiz = (missedOnly = false) => {
    if (missedOnly && missedQuizIds.length > 0) {
      setReviewMissedOnlyIds(new Set(missedQuizIds));
    } else {
      setReviewMissedOnlyIds(null);
    }
    setQuizIndex(0);
    setSelectedQuizAnswer(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizFinished(false);
    setMissedQuizIds([]);
  };

  const masteredPct =
    rangeSummary.total > 0 ? Math.round((rangeSummary.mastered / rangeSummary.total) * 100) : 0;

  const canQuiz = baseLinkingPrompts.length > 0 || baseFillBlankPrompts.length > 0;

  return (
    <section
      aria-label="حلقة الحفظ والتسميع المتقن"
      className="max-w-4xl mx-auto animate-in fade-in duration-200 pb-6"
    >
      <div className="w-full bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 dark:border-[#D9B45A]/25 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#D9B45A]/25 dark:border-slate-800/90 bg-[#F3E9D2]/80 dark:bg-[#0d121a] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border border-[#D9B45A]/45 flex items-center justify-center text-[#D9B45A] shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
                  حلقة الحفظ
                </h2>
                {onChangeSurah ? (
                  <select
                    aria-label="اختيار السورة للحفظ"
                    value={surahNumber}
                    onChange={(e) => {
                      clearPendingAdvanceTimers();
                      cleanupRecordingResources(true);
                      if (isPlayingAudio) onPauseAudio?.();
                      onChangeSurah(Number(e.target.value));
                    }}
                    className="bg-white dark:bg-slate-900 border border-[#D9B45A]/45 dark:border-[#D9B45A]/35 rounded-lg px-2.5 py-1 text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] outline-none cursor-pointer hover:border-[#D9B45A]"
                  >
                    {SURAHS_LIST.map((s) => (
                      <option key={s.number} value={s.number} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                        {toArabicIndic(s.number)}. سورة {s.name} ({toArabicIndic(s.numberOfAyahs)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">· سورة {surahName}</span>
                )}
              </div>
              <p className="text-xs text-[#6B6251] dark:text-slate-400 tabular-nums mt-0.5">
                إتقان السورة: {toArabicIndic(surahSummary.mastered)} من{' '}
                {toArabicIndic(surahSummary.total)} آية · مستحق اليوم:{' '}
                <strong className="text-[#8A6418] dark:text-amber-300">{toArabicIndic(surahSummary.dueCount)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Study Mode Switch */}
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-[#D9B45A]/30 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchTab('recite')}
                className={`min-h-[36px] py-1.5 px-3 rounded-lg font-bold transition-colors cursor-pointer ${
                  studyTab === 'recite'
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                    : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                التسميع المتدرج
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('linking-quiz')}
                disabled={!canQuiz}
                className={`min-h-[36px] py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer ${
                  studyTab === 'linking-quiz'
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                    : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5 text-[#D9B45A]" />
                <span>اختبار التثبيت</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                clearPendingAdvanceTimers();
                cleanupRecordingResources(true);
                onPauseAudio?.();
                onClose();
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-700 text-[#4B4539] dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              خروج
            </button>
          </div>
        </div>

        {/* Guided 3-Step Progressive Flow */}
        <div
          aria-label="خطوات التسميع المتدرج"
          className="px-4 sm:px-5 py-2 border-b border-[#D9B45A]/20 dark:border-slate-800/75 bg-white/60 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-[11px]"
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleSwitchTab('recite')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                studyTab === 'recite'
                  ? 'bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/55 text-[#1F3A6E] dark:text-[#F6EFDD] border border-[#1F3A6E]/25 dark:border-[#648CD4]/45'
                  : 'text-[#6B6251] dark:text-slate-400'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-[#D9B45A] text-[#1B1A17] inline-flex items-center justify-center text-[10px] font-extrabold">١</span>
              <span>حدّد المقطع والوجه</span>
            </button>
            <span className="text-[#8A6418]/50 dark:text-slate-600" aria-hidden="true">←</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold ${
                isVoiceChecking || isRecording || isCurrentAyahPlaying
                  ? 'bg-[#D9B45A]/25 text-[#8A6418] dark:text-[#D9B45A] border border-[#D9B45A]/50'
                  : 'text-[#6B6251] dark:text-slate-300'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-[#1F3A6E] text-[#F6EFDD] inline-flex items-center justify-center text-[10px] font-extrabold">٢</span>
              <span>استمع وردد بصوتك</span>
            </span>
            <span className="text-[#8A6418]/50 dark:text-slate-600" aria-hidden="true">←</span>
            <button
              type="button"
              disabled={!canQuiz}
              onClick={() => canQuiz && handleSwitchTab('linking-quiz')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                studyTab === 'linking-quiz'
                  ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                  : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1F3A6E] dark:hover:text-[#D9B45A]'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] font-extrabold">٣</span>
              <span>اختبر الإتقان (SRS)</span>
            </button>
          </div>
          <span className="text-[#6B6251] dark:text-slate-400 hidden sm:inline">
            {scopeMode === 'mushaf-page' ? 'نظام المصحف بالوجه' : 'نظام حفظ المقاطع'}
          </span>
        </div>

        {/* Hifz Span & Visual Mastery Map */}
        <div className="px-4 sm:px-5 py-3 bg-[#F6EFDD]/75 dark:bg-[#0d121a]/75 border-b border-[#D9B45A]/20 dark:border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope Mode Switch: By Ayah Span vs By Mushaf Page / Face */}
              <div className="flex bg-white dark:bg-slate-950 p-0.5 rounded-xl border border-[#D9B45A]/30 dark:border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSwitchScopeMode('ayah-range')}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    scopeMode === 'ayah-range'
                      ? 'bg-[#D9B45A] text-[#10161f]'
                      : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  بنطاق الآيات
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchScopeMode('mushaf-page')}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    scopeMode === 'mushaf-page'
                      ? 'bg-[#D9B45A] text-[#10161f]'
                      : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>بالصفحة / الوجه</span>
                </button>
              </div>

              {scopeMode === 'ayah-range' ? (
                <>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <label className="text-[#6B6251] dark:text-slate-400" htmlFor="hifz-range-start">
                      من
                    </label>
                    <select
                      id="hifz-range-start"
                      value={rangeStart}
                      onChange={(e) => handleRangeChange(Number(e.target.value), rangeEnd)}
                      className="min-h-[34px] bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700/80 rounded-lg px-2 py-1 text-[#1B1A17] dark:text-[#F6EFDD] font-semibold outline-none cursor-pointer"
                    >
                      {ayahs.map((a) => (
                        <option key={a.numberInSurah} value={a.numberInSurah} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                          آية {toArabicIndic(a.numberInSurah)}
                        </option>
                      ))}
                    </select>
                    <label className="text-[#6B6251] dark:text-slate-400" htmlFor="hifz-range-end">
                      إلى
                    </label>
                    <select
                      id="hifz-range-end"
                      value={rangeEnd}
                      onChange={(e) => handleRangeChange(rangeStart, Number(e.target.value))}
                      className="min-h-[34px] bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700/80 rounded-lg px-2 py-1 text-[#1B1A17] dark:text-[#F6EFDD] font-semibold outline-none cursor-pointer"
                    >
                      {ayahs
                        .filter((a) => a.numberInSurah >= rangeStart)
                        .map((a) => (
                          <option key={a.numberInSurah} value={a.numberInSurah} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                            آية {toArabicIndic(a.numberInSurah)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Quick Span Presets */}
                  <div className="flex items-center gap-1">
                    {ayahs.length > 5 && (
                      <button
                        type="button"
                        onClick={() => applyPresetRange(5)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-[11px] text-[#4B4539] dark:text-slate-300 cursor-pointer"
                      >
                        ٥ آيات
                      </button>
                    )}
                    {ayahs.length > 10 && (
                      <button
                        type="button"
                        onClick={() => applyPresetRange(10)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-[11px] text-[#4B4539] dark:text-slate-300 cursor-pointer"
                      >
                        ١٠ آيات
                      </button>
                    )}
                    {(rangeStart !== 1 || rangeEnd !== ayahs.length) && (
                      <button
                        type="button"
                        onClick={() => applyPresetRange('all')}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-800 text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-semibold cursor-pointer"
                      >
                        كامل السورة
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Mushaf Page / Face Selector linked to the Medina Mus'haf matrix */
                <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                  <button
                    type="button"
                    disabled={selectedPageNumber <= 1 || isJumpingPage || (!onChangeSurah && selectedPageNumber <= (surahPageSpans[0]?.pageNumber ?? 1))}
                    onClick={() => handleSelectMushafPage(selectedPageNumber - 1)}
                    title="الوجه السابق في المصحف"
                    aria-label="الوجه السابق"
                    className="min-h-[34px] px-2 rounded-lg bg-white dark:bg-slate-950 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-700/80 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                    <span className="hidden sm:inline text-[11px]">السابق</span>
                  </button>

                  <select
                    aria-label="اختيار صفحة المصحف من السورة"
                    value={activePageSpan?.pageNumber ?? selectedPageNumber}
                    onChange={(e) => handleSelectMushafPage(Number(e.target.value))}
                    className="min-h-[34px] bg-white dark:bg-slate-950 border border-[#D9B45A]/45 dark:border-[#D9B45A]/40 rounded-lg px-2.5 py-1 text-[#1B1A17] dark:text-[#F6EFDD] font-semibold outline-none cursor-pointer"
                  >
                    {surahPageSpans.map((sp) => {
                      const stats = computePageMasteryStats(sp, ayahs, srsMap, surahNumber, todayStr);
                      return (
                        <option key={sp.pageNumber} value={sp.pageNumber} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                          وجه {toArabicIndic(sp.pageNumber)} · آيات {toArabicIndic(sp.startAyah)}–
                          {toArabicIndic(sp.endAyah)} ({toArabicIndic(stats.masteredCount)}/
                          {toArabicIndic(stats.totalAyahs)})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    disabled={selectedPageNumber >= 604 || isJumpingPage || (!onChangeSurah && selectedPageNumber >= (surahPageSpans[surahPageSpans.length - 1]?.pageNumber ?? 604))}
                    onClick={() => handleSelectMushafPage(selectedPageNumber + 1)}
                    title="الوجه التالي في المصحف"
                    aria-label="الوجه التالي"
                    className="min-h-[34px] px-2 rounded-lg bg-white dark:bg-slate-950 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-700/80 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="hidden sm:inline text-[11px]">التالي</span>
                    <ChevronLeft className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                  </button>

                  {onChangeSurah && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsed = Number(pageJumpInput);
                        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 604) {
                          handleSelectMushafPage(parsed);
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="number"
                        min={1}
                        max={604}
                        aria-label="رقم الصفحة في المصحف (١ إلى ٦٠٤)"
                        value={pageJumpInput}
                        onChange={(e) => setPageJumpInput(e.target.value)}
                        className="w-16 min-h-[34px] bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700/80 rounded-lg px-2 py-1 text-center text-[#8A6418] dark:text-[#D9B45A] font-bold outline-none focus:border-[#D9B45A]"
                      />
                      <button
                        type="submit"
                        disabled={isJumpingPage}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/45 text-[#F6EFDD] text-[11px] font-bold cursor-pointer disabled:opacity-45"
                      >
                        {isJumpingPage ? '…' : 'انتقال'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Range Mastery Bar */}
            <div className="flex items-center gap-2.5 tabular-nums">
              <span className="text-[11px] text-[#4B4539] dark:text-slate-300">
                {scopeMode === 'mushaf-page' ? 'إتقان الوجه:' : 'إتقان المقطع:'}{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">{toArabicIndic(masteredPct)}٪</strong>
              </span>
              <div className="w-24 h-2 rounded-full bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-emerald-500 to-[#D9B45A] transition-all duration-300"
                  style={{ width: `${masteredPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Mushaf Matrix Strip when in Page / Face mode */}
          {scopeMode === 'mushaf-page' && activePageSpan && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-950/75 border border-[#D9B45A]/25 dark:border-[#D9B45A]/20 text-[11px] tabular-nums">
              <div className="flex flex-wrap items-center gap-2 text-[#4B4539] dark:text-slate-300">
                <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">
                  مصفوفة المصحف · صفحة {toArabicIndic(activePageSpan.pageNumber)} من ٦٠٤
                </span>
                <span className="text-[#8A6418]/45 dark:text-slate-500">•</span>
                <span>الجزء {toArabicIndic(activePageSpan.juz)}</span>
                <span className="text-[#8A6418]/45 dark:text-slate-500">•</span>
                <span>
                  الآيات {toArabicIndic(activePageSpan.startAyah)}–{toArabicIndic(activePageSpan.endAyah)} (
                  {toArabicIndic(activePageSpan.ayahCount)} آيات)
                </span>
                {activePageStats?.isFullyMastered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-400 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    وجه متقن
                  </span>
                )}
              </div>

              {coSurahsOnPage.length > 1 && onChangeSurah && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[#6B6251] dark:text-slate-400">سور نفس الوجه:</span>
                  {coSurahsOnPage.map((cs) => {
                    const isCurrent = cs.surahNumber === surahNumber;
                    return (
                      <button
                        key={cs.surahNumber}
                        type="button"
                        onClick={() => {
                          if (!isCurrent) {
                            handleSelectMushafPage(activePageSpan.pageNumber, cs.surahNumber);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#D9B45A]/20 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A] font-bold'
                            : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-700 text-[#4B4539] dark:text-slate-300 hover:border-[#D9B45A] hover:text-[#1B1A17] dark:hover:text-white'
                        }`}
                      >
                        {cs.surahName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Interactive Ayah Status Strip inside Range */}
          {studyTab === 'recite' && rangeAyahs.length <= 45 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {rangeAyahs.map((a) => {
                const rec = srsMap[`${surahNumber}:${a.numberInSurah}`];
                const isSelected = currentAyah?.numberInSurah === a.numberInSurah;
                const activeIdx = activeAyahList.findIndex(
                  (item) => item.numberInSurah === a.numberInSurah
                );
                const isDisabledInDueMode = onlyDueFilter && activeIdx === -1;

                let pillStyle =
                  'bg-white dark:bg-slate-900/90 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:border-[#D9B45A] dark:hover:border-slate-600';
                if (rec?.status === 'mastered') {
                  pillStyle =
                    'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500';
                } else if (rec?.status === 'good') {
                  pillStyle =
                    'bg-[#1F3A6E]/10 dark:bg-[#172848]/70 border-[#1F3A6E]/35 dark:border-[#648CD4]/45 text-[#1F3A6E] dark:text-sky-200 hover:border-[#1F3A6E]';
                } else if (rec?.status === 'needs-review') {
                  pillStyle =
                    'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/45 text-rose-800 dark:text-rose-200 hover:border-rose-400';
                }

                if (isSelected) {
                  pillStyle =
                    'bg-[#D9B45A] border-[#8A6418] dark:border-[#F6EFDD] text-[#10161f] font-extrabold shadow-sm';
                }

                return (
                  <button
                    key={a.numberInSurah}
                    type="button"
                    disabled={isDisabledInDueMode}
                    onClick={() => {
                      if (activeIdx !== -1) selectAyahIndex(activeIdx);
                    }}
                    title={
                      rec?.status === 'mastered'
                        ? `الآية ${a.numberInSurah}: متقنة`
                        : rec?.status === 'good'
                        ? `الآية ${a.numberInSurah}: جيدة`
                        : rec?.status === 'needs-review'
                        ? `الآية ${a.numberInSurah}: تحتاج تثبيت`
                        : `الآية ${a.numberInSurah}: جديدة`
                    }
                    className={`min-w-[30px] h-7 px-1.5 rounded-lg border text-[11px] tabular-nums transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${pillStyle}`}
                  >
                    {toArabicIndic(a.numberInSurah)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {studyTab === 'recite' ? (
          <>
            {/* Hiding Patterns & Study Helpers Toolbar */}
            <div className="p-3 sm:px-5 bg-white/80 dark:bg-slate-950/60 border-b border-[#D9B45A]/20 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[#6B6251] dark:text-slate-400 ml-1">النمط:</span>
                    {(
                  [
                    { id: 'first-word-only', label: 'مطلع الآية' },
                    { id: 'first-letter', label: 'الحرف الأول' },
                    { id: 'alternate-words', label: 'كلمة بعد كلمة' },
                    { id: 'all-blank', label: 'حجب كامل' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setHidePattern(p.id);
                      setRevealedWordIndices(new Set());
                      setPageRevealedMap({});
                    }}
                    className={`min-h-[34px] py-1 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
                      hidePattern === p.id
                        ? 'bg-[#D9B45A] text-[#10161f] font-bold shadow-sm'
                        : 'bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {scopeMode === 'mushaf-page' && (
                  <div className="flex bg-[#FBF7EE] dark:bg-slate-900 p-0.5 rounded-lg border border-[#D9B45A]/25 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setReciteViewMode('single-ayah')}
                      className={`min-h-[30px] px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        reciteViewMode === 'single-ayah'
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                          : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      آية بآية
                    </button>
                    <button
                      type="button"
                      onClick={() => setReciteViewMode('full-page')}
                      className={`min-h-[30px] px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        reciteViewMode === 'full-page'
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                          : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      <Layers className="w-3 h-3 text-[#D9B45A]" />
                      <span>عرض الوجه كاملاً</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={revealNextWordHint}
                  disabled={!currentAyah || (reciteViewMode === 'single-ayah' && nextHiddenIndex === null)}
                  title="اكشف الكلمة المخفية التالية تدريجياً (اختصار: مسافة)"
                  className="min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/45 text-[#F6EFDD] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-[#D9B45A]" />
                  <span>تلميح كلمة</span>
                </button>

                <button
                  type="button"
                  onClick={revealAll}
                  disabled={!currentAyah}
                  className="min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>كشف الكل</span>
                </button>

                <button
                  type="button"
                  onClick={hideAll}
                  disabled={!currentAyah}
                  className="min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5 text-[#8A6418] dark:text-amber-400" />
                  <span>حجب</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearPendingAdvanceTimers();
                    if (isPlayingAudio) onPauseAudio?.();
                    setOnlyDueFilter((prev) => !prev);
                    setCurrentIdx(0);
                    setRevealedWordIndices(new Set());
                    setPageRevealedMap({});
                  }}
                  className={`min-h-[34px] flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                    onlyDueFilter
                      ? 'bg-[#D9B45A]/25 border-[#D9B45A] text-[#8A6418] dark:text-amber-300 font-bold'
                      : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>
                    المستحق ({toArabicIndic(dueAyahsInRange.length)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTafsirAnchor((v) => !v)}
                  disabled={!currentAyah}
                  className={`min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                    showTafsirAnchor
                      ? 'bg-[#1F3A6E] border-[#648CD4]/50 text-[#F6EFDD] font-bold'
                      : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  <BookOpenText className="w-3.5 h-3.5" />
                  <span>المعنى</span>
                </button>
              </div>
            </div>

            {/* Main Recitation Workspace */}
            <div className="p-5 sm:p-8 flex-1 flex flex-col items-center justify-center min-h-[270px] text-center select-none bg-[#FBF7EE] dark:bg-[radial-gradient(ellipse_at_top,_rgba(31,58,110,0.22),_rgba(13,18,26,0.95))]">
              {isDueListEmpty ? (
                <div className="max-w-md mx-auto py-6 px-4 rounded-2xl bg-white dark:bg-[#0d121a]/90 border border-emerald-400/50 dark:border-emerald-500/35 space-y-3 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                    أتممت مراجعة جميع الآيات المستحقة في هذا النطاق اليوم
                  </h3>
                  <p className="text-xs text-[#6B6251] dark:text-slate-300 leading-relaxed">
                    ثبّت الله حفظك! يمكنك استعراض جميع آيات المقطع للتسميع الحر أو توسيع نطاق الحفظ من الأعلى.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyDueFilter(false);
                      setCurrentIdx(0);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] text-xs font-bold cursor-pointer"
                  >
                    عرض كل آيات المقطع ({toArabicIndic(rangeAyahs.length)})
                  </button>
                </div>
              ) : currentAyah ? (
                <>
                  {/* Active Ayah Metadata Row */}
                  <div className="text-xs mb-4 font-semibold flex flex-wrap items-center justify-center gap-2 tabular-nums">
                    <select
                      aria-label="اختيار رقم الآية"
                      value={safeIdx}
                      onChange={(e) => selectAyahIndex(Number(e.target.value))}
                      className="min-h-[34px] bg-white dark:bg-[#0d121a] border border-[#D9B45A]/45 dark:border-[#D9B45A]/35 rounded-lg px-2.5 py-1 text-[#8A6418] dark:text-[#D9B45A] font-bold outline-none cursor-pointer hover:border-[#D9B45A]"
                    >
                      {activeAyahList.map((a, idx) => (
                        <option key={a.numberInSurah} value={idx} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                          الآية {toArabicIndic(a.numberInSurah)} ({toArabicIndic(idx + 1)} من{' '}
                          {toArabicIndic(activeAyahList.length)})
                        </option>
                      ))}
                    </select>

                    {currentRecord ? (
                      <span className="text-[#4B4539] dark:text-slate-300 bg-white dark:bg-slate-900/90 border border-[#D9B45A]/25 dark:border-slate-800 px-2.5 py-1 rounded-lg font-normal">
                        المراجعة القادمة: <strong className="text-[#8A6418] dark:text-[#D9B45A]">{currentRecord.nextReviewDate}</strong>
                      </span>
                    ) : (
                      <span className="text-[#6B6251] dark:text-slate-400 bg-white/80 dark:bg-slate-900/70 border border-[#D9B45A]/20 dark:border-slate-800 px-2.5 py-1 rounded-lg font-normal">
                        آية جديدة للتقييم
                      </span>
                    )}
                  </div>

                  {/* Interactive Stage: Either Full Mushaf Face Matrix or Centered Single Ayah */}
                  {scopeMode === 'mushaf-page' && reciteViewMode === 'full-page' ? (
                    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 rounded-2xl bg-[#F6EFDD] dark:bg-[#0d121a]/95 border border-[#D9B45A]/45 dark:border-[#D9B45A]/30 shadow-inner text-right space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#D9B45A]/25 dark:border-slate-800/80 text-xs">
                        <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] font-kufi">
                          لوح الوجه {toArabicIndic(activePageSpan?.pageNumber ?? selectedPageNumber)} · سورة {surahName}
                        </span>
                        <span className="text-[11px] text-[#6B6251] dark:text-slate-400">
                          انقر أي كلمة مخفية لكشفها · أو رقم الآية للتركيز والتسميع
                        </span>
                      </div>

                      <div className="font-quran text-xl sm:text-2xl text-[#1B1A17] dark:text-[#F6EFDD] leading-[2.45] flex flex-wrap items-baseline gap-x-1.5 gap-y-2.5">
                        {activeAyahList.map((pageAyah, ayahPos) => {
                          const ayahClean = sanitizeAyahText(
                            pageAyah.text,
                            surahNumber,
                            pageAyah.numberInSurah
                          );
                          const ayahWords = ayahClean.trim() ? ayahClean.trim().split(/\s+/) : [];
                          const revealedForThisAyah =
                            pageRevealedMap[pageAyah.numberInSurah] ?? new Set<number>();
                          const isFocusedAyah =
                            currentAyah?.numberInSurah === pageAyah.numberInSurah;
                          const ayahRec = srsMap[`${surahNumber}:${pageAyah.numberInSurah}`];

                          return (
                            <React.Fragment key={pageAyah.numberInSurah}>
                              {ayahWords.map((word, wIdx) => {
                                const hidden = isMemorizationWordHidden(
                                  wIdx,
                                  hidePattern,
                                  revealedForThisAyah
                                );
                                const firstLetterCue =
                                  hidden && hidePattern === 'first-letter'
                                    ? extractWordFirstLetterHint(word)
                                    : null;

                                return (
                                  <button
                                    key={`${pageAyah.numberInSurah}-${wIdx}`}
                                    type="button"
                                    onClick={() => {
                                      if (ayahPos !== safeIdx) {
                                        setCurrentIdx(ayahPos);
                                        onFocusAyah?.(pageAyah.numberInSurah);
                                      }
                                      toggleRevealPageWord(pageAyah.numberInSurah, wIdx);
                                    }}
                                    className={`transition-all duration-150 rounded-md px-1.5 py-0.5 relative group cursor-pointer ${
                                      hidden
                                        ? 'bg-white/85 dark:bg-slate-950/90 border border-[#D9B45A]/45 dark:border-[#D9B45A]/30 text-transparent hover:border-[#8A6418] dark:hover:border-[#D9B45A] min-w-[2.6rem]'
                                        : isFocusedAyah
                                        ? 'bg-[#1F3A6E]/15 dark:bg-[#1F3A6E]/35 border border-[#1F3A6E]/35 dark:border-[#648CD4]/35'
                                        : 'hover:bg-[#1F3A6E]/10 dark:hover:bg-[#1F3A6E]/25 border border-transparent'
                                    }`}
                                    title={hidden ? 'انقر لكشف الكلمة' : 'انقر لإخفاء الكلمة'}
                                  >
                                    <span className={hidden ? 'opacity-0 select-none' : 'opacity-100'}>
                                      {word}
                                    </span>
                                    {hidden && (
                                      <span
                                        className={`absolute inset-0 flex items-center justify-center ${
                                          firstLetterCue
                                            ? 'font-quran text-lg text-[#8A6418] dark:text-[#D9B45A]/85 group-hover:text-[#1F3A6E] dark:group-hover:text-[#D9B45A]'
                                            : 'text-[11px] font-sans text-[#8A6418] dark:text-[#D9B45A]/65 group-hover:text-[#1F3A6E] dark:group-hover:text-[#D9B45A]'
                                        }`}
                                      >
                                        {firstLetterCue || '؟'}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}

                              <button
                                type="button"
                                onClick={() => selectAyahIndex(ayahPos)}
                                title={`تركيز الآية ${pageAyah.numberInSurah}`}
                                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg font-sans text-sm font-bold tabular-nums transition-colors cursor-pointer ${
                                  isFocusedAyah
                                    ? 'bg-[#D9B45A] text-[#10161f]'
                                    : ayahRec?.status === 'mastered'
                                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                                    : ayahRec?.status === 'needs-review'
                                    ? 'text-rose-700 dark:text-rose-300 hover:bg-rose-500/15'
                                    : 'text-[#8A6418] dark:text-[#D9B45A] hover:bg-[#1F3A6E]/10 dark:hover:bg-slate-800'
                                }`}
                              >
                                ﴿{toArabicIndic(pageAyah.numberInSurah)}﴾
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 font-quran text-2xl sm:text-3xl text-[#1B1A17] dark:text-[#F6EFDD] max-w-2xl leading-relaxed">
                      {words.map((word, idx) => {
                        const hidden = isMemorizationWordHidden(idx, hidePattern, revealedWordIndices);
                        const firstLetterCue =
                          hidden && hidePattern === 'first-letter'
                            ? extractWordFirstLetterHint(word)
                            : null;

                        return (
                          <button
                            key={`${currentAyah.numberInSurah}-${idx}`}
                            type="button"
                            onClick={() => toggleRevealWord(idx)}
                            className={`transition-all duration-150 rounded-lg px-2.5 py-0.5 relative group cursor-pointer ${
                              hidden
                                ? 'bg-white dark:bg-[#0d121a]/90 border border-[#D9B45A]/50 dark:border-[#D9B45A]/35 text-transparent hover:border-[#8A6418] dark:hover:border-[#D9B45A] shadow-inner min-w-[3.4rem]'
                                : 'hover:bg-[#1F3A6E]/10 dark:hover:bg-[#1F3A6E]/35 border border-transparent'
                            }`}
                            title={hidden ? 'انقر لكشف الكلمة' : 'انقر لإخفاء الكلمة'}
                          >
                            <span className={hidden ? 'opacity-0 select-none' : 'opacity-100'}>
                              {word}
                            </span>
                            {hidden && (
                              <span
                                className={`absolute inset-0 flex items-center justify-center ${
                                  firstLetterCue
                                    ? 'font-quran text-xl text-[#8A6418] dark:text-[#D9B45A]/85 group-hover:text-[#1F3A6E] dark:group-hover:text-[#D9B45A]'
                                    : 'text-xs font-sans text-[#8A6418] dark:text-[#D9B45A]/65 group-hover:text-[#1F3A6E] dark:group-hover:text-[#D9B45A]'
                                }`}
                              >
                                {firstLetterCue || '؟'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <span className="text-[#8A6418] dark:text-[#D9B45A] font-sans text-lg font-bold tabular-nums">
                        ﴿{toArabicIndic(currentAyah.numberInSurah)}﴾
                      </span>
                    </div>
                  )}

                  {/* Tafsir Comprehension Anchor */}
                  {showTafsirAnchor && currentAyah.tafsir && (
                    <div className="mt-5 max-w-xl w-full p-3.5 rounded-xl bg-white dark:bg-[#0d121a]/90 border border-[#D9B45A]/35 dark:border-emerald-500/30 text-right space-y-1 animate-in fade-in duration-150">
                      <span className="text-[11px] font-bold text-[#1F3A6E] dark:text-emerald-400">
                        الربط بالمعنى (التفسير الميسر):
                      </span>
                      <p className="text-xs sm:text-sm text-[#4B4539] dark:text-slate-200 leading-relaxed select-text">
                        {currentAyah.tafsir}
                      </p>
                    </div>
                  )}

                  {/* Smart Voice Tasmie + Self-Check Mic Recorder Row */}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
                    {isSpeechSupported && (
                      <button
                        type="button"
                        onClick={handleToggleVoiceCheck}
                        className={`min-h-[36px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
                          isVoiceChecking
                            ? 'bg-emerald-600/20 dark:bg-emerald-600/25 border-emerald-500 dark:border-emerald-400 text-emerald-800 dark:text-emerald-200'
                            : 'bg-[#1F3A6E] hover:bg-[#2E5499] border-[#648CD4]/55 text-[#F6EFDD]'
                        }`}
                      >
                        {isVoiceChecking ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-300 text-emerald-600 dark:text-emerald-300" />
                            <span>إيقاف التسميع الذكي</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#D9B45A]" />
                            <span>التسميع الذكي بالصوت</span>
                          </>
                        )}
                      </button>
                    )}

                    {isMicSupported && (
                      <button
                        type="button"
                        onClick={handleToggleSelfRecording}
                        className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                          isRecording
                            ? 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-200'
                            : 'bg-white dark:bg-[#0d121a] border-[#D9B45A]/30 dark:border-slate-700/80 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-rose-500 dark:fill-rose-400 text-rose-500 dark:text-rose-400" />
                            <span>إيقاف التسجيل</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                            <span>سجّل تسميعك وقارن</span>
                          </>
                        )}
                      </button>
                    )}

                    {recordedAudioUrl && !isRecording && (
                      <>
                        <audio
                          ref={selfAudioRef}
                          src={recordedAudioUrl}
                          onEnded={() => setIsPlayingSelfRec(false)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={handleTogglePlaySelfRecording}
                          className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 font-semibold cursor-pointer"
                        >
                          {isPlayingSelfRec ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>إيقاف تسجيلي</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>سماع تسجيلي</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                    {isRecording && (
                      <div className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/35">
                        <AudioLevelMeter
                          isActive={isRecording}
                          mediaStream={activeMediaStream}
                          tone="rose"
                          label="التسجيل جارٍ..."
                        />
                      </div>
                    )}

                    {micError && (
                      <span className="text-[11px] text-rose-700 dark:text-rose-300">{micError}</span>
                    )}
                  </div>

                  {/* Live Voice Tasmie Results Panel */}
                  {(isVoiceChecking || voiceEval || voiceError) && (
                    <div className="mt-3 max-w-xl w-full p-3.5 rounded-xl bg-white dark:bg-[#0d121a]/95 border border-[#D9B45A]/40 dark:border-[#D9B45A]/35 text-right space-y-2 animate-in fade-in duration-150">
                      {voiceError ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">{voiceError}</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                {isVoiceChecking
                                  ? 'أصغي لتلاوتك… اقرأ الآية غيباً الآن'
                                  : voiceEval?.isComplete
                                  ? 'ما شاء الله! أتممت تسميع الآية بدقة تامة'
                                  : 'نتيجة التسميع الصوتي'}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              {isVoiceChecking && (
                                <AudioLevelMeter
                                  isActive={isVoiceChecking}
                                  activitySeed={voiceTranscript.length}
                                  tone="gold"
                                />
                              )}
                              {voiceEval && (
                                <span
                                  className={`px-2 py-0.5 rounded-md border font-bold ${
                                    voiceEval.isComplete || voiceEval.accuracyPercent >= 85
                                      ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/30 dark:border-slate-700 text-[#8A6418] dark:text-amber-300'
                                  }`}
                                >
                                  {toArabicIndic(voiceEval.matchedCount)}/{toArabicIndic(voiceEval.totalExpectedSpokenWords)} كلمة ({toArabicIndic(voiceEval.accuracyPercent)}٪)
                                </span>
                              )}
                            </div>
                          </div>

                          {voiceTranscript && (
                            <p className="text-xs text-[#4B4539] dark:text-slate-300 leading-relaxed bg-[#FBF7EE] dark:bg-slate-950/70 rounded-lg px-2.5 py-1.5 border border-[#D9B45A]/20 dark:border-slate-800/80">
                              <span className="text-[#6B6251] dark:text-slate-400">ما التقطه الصوت: </span>
                              {voiceTranscript}
                            </p>
                          )}

                          {voiceEval && !voiceEval.isComplete && voiceEval.nextExpectedRawIndex !== null && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-0.5">
                              <span className="text-[#8A6418] dark:text-amber-300">
                                إذا توقفت عند كلمة، يمكنك كشفها للتذكّر:
                              </span>
                              <button
                                type="button"
                                onClick={revealNextWordHint}
                                className="px-2.5 py-1 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/45 text-[#F6EFDD] font-bold cursor-pointer"
                              >
                                افتح لي الكلمة التالية
                              </button>
                            </div>
                          )}

                          {voiceEval?.isComplete && (
                            <div className="flex justify-end pt-0.5">
                              <button
                                type="button"
                                onClick={() => setAyahMastery('mastered')}
                                className="min-h-[32px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>اعتماد «متقن» والانتقال للتالية</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-[#6B6251] dark:text-slate-400 mt-3 hidden sm:block">
                    انقر على أي كلمة مخفية لكشفها · أو استخدم <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-700 text-[#8A6418] dark:text-[#D9B45A]">مسافة</kbd> لكشف الكلمة التالية والأسهم للتنقل
                  </p>
                </>
              ) : null}
            </div>

            {/* Footer: Talaqqin Audio Loop + Navigation + Spaced Repetition */}
            <div className="p-4 sm:p-5 border-t border-[#D9B45A]/25 dark:border-slate-800/90 bg-[#F3E9D2]/75 dark:bg-[#0d121a] flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Audio & Repetition Cluster */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!currentAyah}
                    onClick={() => {
                      clearPendingAdvanceTimers();
                      if (!currentAyah) return;
                      if (isCurrentAyahPlaying) {
                        onPauseAudio?.();
                      } else {
                        onPlayAyah(currentAyah.numberInSurah);
                      }
                    }}
                    className={`min-h-[40px] py-2 px-3.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer border disabled:opacity-40 ${
                      isCurrentAyahPlaying
                        ? 'bg-[#D9B45A] border-[#8A6418] text-[#10161f]'
                        : 'bg-[#1F3A6E] border-[#648CD4]/50 text-[#F6EFDD] hover:bg-[#2E5499]'
                    }`}
                  >
                    {isCurrentAyahPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>إيقاف مؤقت</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-[#D9B45A]" />
                        <span>{reciterName ? `استماع (${reciterName.split(' ')[0]})` : 'استماع للآية'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!currentAyah}
                    onClick={() => {
                      clearPendingAdvanceTimers();
                      if (currentAyah) onPlayAyah(currentAyah.numberInSurah);
                    }}
                    title="إعادة تشغيل الآية من البداية"
                    className="min-h-[40px] py-2 px-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-[#FBF7EE] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                    <span>إعادة</span>
                  </button>

                  {/* Per-Ayah Repeats */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-[#D9B45A]/30 dark:border-slate-800 text-[11px] tabular-nums">
                    <span className="text-[#6B6251] dark:text-slate-400 px-1.5">التكرار:</span>
                    {(
                      [
                        { value: 1, label: 'مرة' },
                        { value: 2, label: 'مرتان' },
                        { value: 3, label: '٣' },
                        { value: 'loop', label: '∞' },
                      ] as const
                    ).map((opt) => {
                      const selected = repeatTarget === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => {
                            setRepeatTarget(opt.value);
                            if (opt.value === 'loop' && rangePlaybackMode !== 'single') {
                              clearPendingAdvanceTimers();
                              setRangePlaybackMode('single');
                            }
                          }}
                          className={`min-h-[30px] px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#D9B45A] text-[#10161f]'
                              : 'text-[#4B4539] dark:text-slate-300 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 hover:text-[#1B1A17] dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Range Continuity Mode (تلاوة المقطع مع الترديد) */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-[#D9B45A]/30 dark:border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        clearPendingAdvanceTimers();
                        const nextMode: RangePlaybackMode =
                          rangePlaybackMode === 'single'
                            ? 'range'
                            : rangePlaybackMode === 'range'
                            ? 'range-loop'
                            : 'single';
                        setRangePlaybackMode(nextMode);
                        if (nextMode !== 'single' && repeatTarget === 'loop') {
                          setRepeatTarget(1);
                        }
                      }}
                      title="التبديل بين آية واحدة أو تلاوة مقطع الحفظ كاملاً تلقائياً"
                      className={`min-h-[30px] flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        rangePlaybackMode !== 'single'
                          ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                          : 'text-[#4B4539] dark:text-slate-300 hover:bg-[#F3E9D2] dark:hover:bg-slate-800'
                      }`}
                    >
                      <Repeat className="w-3 h-3" />
                      <span>
                        {rangePlaybackMode === 'single'
                          ? 'آية واحدة'
                          : rangePlaybackMode === 'range'
                          ? 'تلاوة المقطع'
                          : 'تكرار المقطع ∞'}
                      </span>
                    </button>

                    {rangePlaybackMode !== 'single' && (
                      <button
                        type="button"
                        onClick={() => setPauseForRepeatSec((s) => (s === 0 ? 3 : 0))}
                        title="إضافة وقفة ٣ ثوانٍ بعد كل آية للترديد خلف القارئ"
                        className={`min-h-[30px] flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          pauseForRepeatSec === 3
                            ? 'bg-[#D9B45A]/25 text-[#8A6418] dark:text-amber-300 border border-[#D9B45A]'
                            : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                        }`}
                      >
                        <Timer className="w-3 h-3" />
                        <span>{pauseForRepeatSec === 3 ? 'وقفة ٣ث' : 'بلا وقفة'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Prev / Next Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAyahIndex(safeIdx - 1)}
                    disabled={!currentAyah || safeIdx === 0}
                    title="الآية السابقة"
                    aria-label="الآية السابقة"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 hover:bg-[#FBF7EE] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAyahIndex(safeIdx + 1)}
                    disabled={!currentAyah || safeIdx >= activeAyahList.length - 1}
                    title="الآية التالية"
                    aria-label="الآية التالية"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 hover:bg-[#FBF7EE] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Playback / Repeat Status Banner */}
              {(isCurrentAyahPlaying || waitingCountdown !== null) && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/40 dark:border-[#D9B45A]/30 text-[11px] tabular-nums">
                  {waitingCountdown !== null ? (
                    <>
                      <span className="text-[#8A6418] dark:text-amber-300 font-semibold">
                        وقفة للترديد… الانتقال للآية التالية خلال {toArabicIndic(waitingCountdown)} ث
                      </span>
                      <button
                        type="button"
                        onClick={clearPendingAdvanceTimers}
                        className="text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white underline cursor-pointer"
                      >
                        إلغاء الانتقال
                      </button>
                    </>
                  ) : (
                    <span className="text-[#1F3A6E] dark:text-[#D9B45A] font-medium">
                      {repeatTarget === 'loop'
                        ? 'تكرار مستمر للآية الحالية'
                        : `التلاوة ${toArabicIndic(currentRepeat)} من ${toArabicIndic(repeatTarget)}${
                            rangePlaybackMode !== 'single' ? ' · التلقين التلقائي للمقطع مفعّل' : ''
                          }`}
                    </span>
                  )}
                </div>
              )}

              {/* Spaced Repetition Self-Evaluation */}
              {currentAyah && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#D9B45A]/20 dark:border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[#6B6251] dark:text-slate-400 ml-1">تقييم الآية:</span>
                    <button
                      type="button"
                      onClick={() => setAyahMastery('needs-review')}
                      className="min-h-[36px] py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-500/25 font-semibold transition-colors cursor-pointer"
                    >
                      تثبيت (غداً)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAyahMastery('good')}
                      className="min-h-[36px] py-1.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
                    >
                      جيد (مضاعف)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAyahMastery('mastered')}
                      className="min-h-[36px] py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>متقن (متباعد)</span>
                    </button>

                    {scopeMode === 'mushaf-page' && activePageSpan && (
                      <button
                        type="button"
                        onClick={() => setPageMastery('mastered')}
                        title="اعتماد جميع آيات هذا الوجه كمتقنة وجدولتها في المراجعة المتباعدة"
                        className="min-h-[36px] py-1.5 px-3 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#D9B45A]/45 text-[#F6EFDD] font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5 text-[#D9B45A]" />
                        <span>إتقان الوجه كاملاً</span>
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-[#6B6251] dark:text-slate-400 tabular-nums">
                    متبقي في النطاق: {toArabicIndic(activeAyahList.length - 1 - safeIdx)} آية
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Quiz Mode: Next Ayah Linking OR Fill Missing Word */
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5 bg-[#FBF7EE] dark:bg-[radial-gradient(ellipse_at_top,_rgba(31,58,110,0.18),_rgba(13,18,26,0.96))]">
            {/* Sub-mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-[#D9B45A]/30 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  disabled={baseLinkingPrompts.length === 0}
                  onClick={() => handleSwitchQuizMode('next-ayah')}
                  className={`min-h-[34px] py-1 px-3 rounded-lg font-bold transition-colors disabled:opacity-40 cursor-pointer ${
                    quizMode === 'next-ayah'
                      ? 'bg-[#D9B45A] text-[#10161f]'
                      : 'text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  ربط أوائل الآيات
                </button>
                <button
                  type="button"
                  disabled={baseFillBlankPrompts.length === 0}
                  onClick={() => handleSwitchQuizMode('fill-blank')}
                  className={`min-h-[34px] py-1 px-3 rounded-lg font-bold transition-colors disabled:opacity-40 cursor-pointer ${
                    quizMode === 'fill-blank'
                      ? 'bg-[#D9B45A] text-[#10161f]'
                      : 'text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                  }`}
                >
                  إكمال الكلمة الناقصة
                </button>
              </div>

              <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-bold tabular-nums">
                النتيجة: {toArabicIndic(quizScore.correct)} / {toArabicIndic(quizScore.total)}
              </span>
            </div>

            {quizFinished ? (
              <div className="max-w-lg mx-auto my-6 p-6 rounded-2xl bg-white dark:bg-[#0d121a] border border-[#D9B45A]/45 dark:border-[#D9B45A]/35 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border border-[#D9B45A]/45 text-[#D9B45A] flex items-center justify-center mx-auto">
                  <Trophy className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#1B1A17] dark:text-[#F6EFDD]">اكتملت جولة التثبيت!</h3>
                  <p className="text-xs text-[#4B4539] dark:text-slate-300 tabular-nums">
                    أجبت إجابة صحيحة في{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {toArabicIndic(quizScore.correct)}
                    </strong>{' '}
                    من أصل{' '}
                    <strong className="text-[#1B1A17] dark:text-[#F6EFDD]">{toArabicIndic(quizScore.total)}</strong>{' '}
                    أسئلة (نسبة الدقة:{' '}
                    {toArabicIndic(
                      quizScore.total > 0
                        ? Math.round((quizScore.correct / quizScore.total) * 100)
                        : 100
                    )}
                    ٪)
                  </p>
                </div>

                {missedQuizIds.length > 0 && (
                  <p className="text-xs text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl px-3 py-2">
                    تمت جدولة الآيات التي أخطأت فيها ({toArabicIndic(missedQuizIds.length)}) تلقائياً للمراجعة غداً.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {missedQuizIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRestartQuiz(true)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 border border-amber-400 dark:border-amber-500/45 text-amber-950 dark:text-amber-200 text-xs font-bold cursor-pointer"
                    >
                      مراجعة الأخطاء فقط ({toArabicIndic(missedQuizIds.length)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRestartQuiz(false)}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] text-xs font-bold cursor-pointer"
                  >
                    اختبار جديد في النطاق
                  </button>
                </div>
              </div>
            ) : activeQuizItem ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#6B6251] dark:text-slate-400 tabular-nums">
                  <span>
                    السؤال {toArabicIndic(quizIndex + 1)} من {toArabicIndic(activeQuizPrompts.length)} ·{' '}
                    {quizMode === 'next-ayah'
                      ? 'اختر الآية التي تلي الآية المعروضة'
                      : 'اختر الكلمة الصحيحة لإتمام الآية'}
                  </span>
                </div>

                {/* Prompt Display */}
                {'promptAyah' in activeQuizItem ? (
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121a] border border-[#D9B45A]/30 dark:border-slate-800 text-center space-y-2">
                    <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-semibold">
                      الآية {toArabicIndic(activeQuizItem.promptAyah.numberInSurah)}
                    </span>
                    <p className="font-quran text-2xl text-[#1B1A17] dark:text-[#F6EFDD] leading-loose">
                      ﴿ {sanitizeAyahText(activeQuizItem.promptAyah.text, surahNumber, activeQuizItem.promptAyah.numberInSurah)} ﴾
                    </p>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121a] border border-[#D9B45A]/30 dark:border-slate-800 text-center space-y-2">
                    <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-semibold">
                      الآية {toArabicIndic(activeQuizItem.ayah.numberInSurah)}
                    </span>
                    <p className="font-quran text-2xl text-[#1B1A17] dark:text-[#F6EFDD] leading-loose flex flex-wrap items-center justify-center gap-2">
                      {activeQuizItem.maskedWords.map((w, idx) =>
                        idx === activeQuizItem.blankIndex ? (
                          <span
                            key={idx}
                            className="inline-flex items-center justify-center min-w-[5rem] px-3 py-0.5 rounded-xl bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/55 border border-[#D9B45A] text-[#1F3A6E] dark:text-[#D9B45A] text-lg font-sans font-bold"
                          >
                            {selectedQuizAnswer !== null ? activeQuizItem.correctWord : '؟ .....'}
                          </span>
                        ) : (
                          <span key={idx}>{w}</span>
                        )
                      )}
                    </p>
                  </div>
                )}

                {/* Options */}
                {'promptAyah' in activeQuizItem ? (
                  <div className="space-y-2.5">
                    {activeQuizItem.options.map((opt) => {
                      const isAnswered = selectedQuizAnswer !== null;
                      const isCorrectOpt = opt.numberInSurah === activeQuizItem.answerAyah.numberInSurah;
                      const isChosen = selectedQuizAnswer === opt.numberInSurah;

                      let style =
                        'bg-white dark:bg-[#0d121a]/80 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]';
                      if (isAnswered) {
                        if (isCorrectOpt) style = 'bg-emerald-50 dark:bg-emerald-950/75 border-emerald-500 text-emerald-900 dark:text-emerald-100';
                        else if (isChosen) style = 'bg-rose-50 dark:bg-rose-950/75 border-rose-500 text-rose-900 dark:text-rose-100';
                      }

                      return (
                        <button
                          key={opt.numberInSurah}
                          type="button"
                          onClick={() =>
                            handlePickQuizOption(
                              opt.numberInSurah,
                              activeQuizItem.id,
                              activeQuizItem.answerAyah.numberInSurah,
                              activeQuizItem.answerAyah.numberInSurah
                            )
                          }
                          className={`w-full p-4 rounded-xl border text-right font-quran text-xl leading-relaxed transition-all cursor-pointer flex items-center justify-between gap-3 ${style}`}
                        >
                          <span>{sanitizeAyahText(opt.text, surahNumber, opt.numberInSurah)}</span>
                          {isAnswered && (
                            <span className="text-xs font-sans font-bold text-[#8A6418] dark:text-[#D9B45A] shrink-0 tabular-nums">
                              ﴿{toArabicIndic(opt.numberInSurah)}﴾
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeQuizItem.options.map((wordOpt, idx) => {
                      const isAnswered = selectedQuizAnswer !== null;
                      const isCorrectOpt = wordOpt === activeQuizItem.correctWord;
                      const isChosen = selectedQuizAnswer === wordOpt;

                      let style =
                        'bg-white dark:bg-[#0d121a]/80 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] hover:border-[#D9B45A]';
                      if (isAnswered) {
                        if (isCorrectOpt) style = 'bg-emerald-50 dark:bg-emerald-950/75 border-emerald-500 text-emerald-900 dark:text-emerald-100';
                        else if (isChosen) style = 'bg-rose-50 dark:bg-rose-950/75 border-rose-500 text-rose-900 dark:text-rose-100';
                      }

                      return (
                        <button
                          key={`${wordOpt}-${idx}`}
                          type="button"
                          onClick={() =>
                            handlePickQuizOption(
                              wordOpt,
                              activeQuizItem.id,
                              activeQuizItem.correctWord,
                              activeQuizItem.ayah.numberInSurah
                            )
                          }
                          className={`p-4 rounded-xl border text-center font-quran text-2xl transition-all cursor-pointer ${style}`}
                        >
                          {wordOpt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Answer Feedback & Next Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-[#4B4539] dark:text-slate-300">
                    {selectedQuizAnswer !== null &&
                      ('promptAyah' in activeQuizItem
                        ? selectedQuizAnswer === activeQuizItem.answerAyah.numberInSurah
                          ? 'أحسنت! ربط متقن للآية التالية.'
                          : `الإجابة الصحيحة هي الآية ${toArabicIndic(
                              activeQuizItem.answerAyah.numberInSurah
                            )}، وتمت جدولتها للمراجعة غداً.`
                        : selectedQuizAnswer === activeQuizItem.correctWord
                        ? 'أحسنت! إتمام دقيق للآية.'
                        : `الكلمة الصحيحة هي «${activeQuizItem.correctWord}»، وتمت جدولة الآية للمراجعة غداً.`)}
                  </span>
                  <button
                    type="button"
                    disabled={selectedQuizAnswer === null}
                    onClick={handleAdvanceQuiz}
                    className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    {quizIndex + 1 < activeQuizPrompts.length ? 'السؤال التالي' : 'عرض النتيجة'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#6B6251] dark:text-slate-400">
                اختر نطاقاً يحتوي على آيتين على الأقل لتفعيل الاختبار.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
