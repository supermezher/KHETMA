import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Star,
  Sprout,
  Moon,
  Crown,
  BookOpen,
  Sun,
  Play,
  Square,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Mic,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Headphones,
  CheckCircle2,
  Sparkles,
  Award,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
  Users,
  X,
  Send,
  Link2,
  Copy,
  Check,
  Inbox,
  Radio,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { SURAHS_LIST } from '../data/quranMetadata';
import {
  Ayah,
  getSurahData,
  getSurahAudioSegments,
  sanitizeAyahText,
  WordSegment,
} from '../data/quranService';
import { RECITERS_LIST, getAyahAudioUrl } from '../data/reciters';
import { getCachedAudioBlobUrl } from '../utils/audioOfflineCache';
import { getSpokenWordRawIndices } from '../utils/tajweedParser';
import {
  evaluateRecitationAgainstAyah,
  getSpeechRecognitionConstructor,
  SpeechRecognitionLike,
} from '../utils/recitationMatcher';
import { toArabicIndic } from './khatma/KhatmaRing';
import { AudioLevelMeter } from './AudioLevelMeter';
import {
  KidsAvatarId,
  KidsDailyWird,
  KidsDelayMode,
  KidsHifzState,
  KidsProfile,
  KidsRepeatCount,
  KIDS_AVATARS,
  ParentGateChallenge,
  RECOMMENDED_KIDS_SURAH_NUMBERS,
  applyRemoteMemberToProfile,
  approveSurahWirdForKid,
  clampWirdRange,
  computeChildRepeatPauseMs,
  computeGardenStage,
  createDefaultWird,
  createKidProfile,
  generateParentGateChallenge,
  loadKidsHifzState,
  makeAyahKey,
  playKidEncouragementSound,
  recordKidAyahCycle,
  resolveActiveWordIndex,
  saveKidsHifzState,
} from '../utils/kidsHifzStore';
import {
  RemoteCircleSupervisorSession,
  RemoteKidsMember,
  RemoteVoiceSubmission,
  blobToDataUrl,
  createRemoteKidsCircleApi,
  fetchRemoteCircleAsAdminApi,
  fetchRemoteCircleAsKidApi,
  joinRemoteKidsCircleApi,
  loadSupervisorCircleSession,
  reviewKidVoiceSubmissionApi,
  saveSupervisorCircleSession,
  submitKidVoiceRecitationApi,
  syncRemoteKidProgressApi,
  updateRemoteKidWirdApi,
  verifyRemoteCircleAdminApi,
} from '../data/kidsCircleApiService';

type PromptPhase = 'idle' | 'listening' | 'repeating' | 'celebrating';

function renderAvatarIcon(avatarId: KidsAvatarId, className = 'w-5 h-5') {
  switch (avatarId) {
    case 'sprout':
      return <Sprout className={className} />;
    case 'moon':
      return <Moon className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'sun':
      return <Sun className={className} />;
    case 'star':
    default:
      return <Star className={className} />;
  }
}

export const KidsHifzSection: React.FC = () => {
  const [state, setState] = useState<KidsHifzState>(() => loadKidsHifzState());
  const activeProfile: KidsProfile = useMemo(
    () => state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0],
    [state]
  );

  // Child vs Supervisor view
  const [viewMode, setViewMode] = useState<'child' | 'supervisor'>('child');
  const [isGateModalOpen, setIsGateModalOpen] = useState<boolean>(false);
  const [gateChallenge, setGateChallenge] = useState<ParentGateChallenge>(() =>
    generateParentGateChallenge()
  );
  const [gateInput, setGateInput] = useState<string>('');
  const [gateError, setGateError] = useState<string | null>(null);

  // Active Surah & Ayahs
  const [surahAyahs, setSurahAyahs] = useState<Ayah[]>([]);
  const [isLoadingSurah, setIsLoadingSurah] = useState<boolean>(true);
  const [surahLoadError, setSurahLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Child active Ayah index within dailyWird [startAyah..endAyah]
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number>(
    activeProfile.dailyWird.startAyah
  );

  // Word-level highlighting segments
  const [wordSegmentsMap, setWordSegmentsMap] = useState<Record<number, WordSegment[]>>({});
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);

  // Automated Listen -> Repeat Loop State
  const [promptPhase, setPromptPhase] = useState<PromptPhase>('idle');
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [listenProgressRatio, setListenProgressRatio] = useState<number>(0);
  const [repeatCountdownSec, setRepeatCountdownSec] = useState<number>(0);
  const [repeatProgressRatio, setRepeatProgressRatio] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Child voice practice recording (local MediaRecorder + remote upload)
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [activeChildStream, setActiveChildStream] = useState<MediaStream | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioMime, setRecordedAudioMime] = useState<string>('audio/webm');
  const [recordedDurationSec, setRecordedDurationSec] = useState<number>(5);
  const [recordedAyahRange, setRecordedAyahRange] = useState<{ surah: number; ayah: number }>({
    surah: 112,
    ayah: 1,
  });
  const [recordedAyahLabel, setRecordedAyahLabel] = useState<string | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isSendingSubmission, setIsSendingSubmission] = useState<boolean>(false);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  // Kid Smart Voice Check (Arabic SpeechRecognition)
  const [isVoiceCheckSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionConstructor()));
  const [isKidVoiceChecking, setIsKidVoiceChecking] = useState<boolean>(false);
  const [kidVoiceMatchedSet, setKidVoiceMatchedSet] = useState<Set<number>>(() => new Set());
  const [kidVoiceAccuracy, setKidVoiceAccuracy] = useState<number | null>(null);
  const [kidVoiceTranscript, setKidVoiceTranscript] = useState<string>('');
  const kidSpeechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const kidSpeechIntentStopRef = useRef<boolean>(false);
  const kidSpeechContextRef = useRef<{
    surahNumber: number;
    ayahNumber: number;
    words: string[];
  }>({ surahNumber: 112, ayahNumber: 1, words: [] });

  // Supervisor Add Kid Form state
  const [newKidName, setNewKidName] = useState<string>('');
  const [newKidAvatar, setNewKidAvatar] = useState<KidsAvatarId>('sprout');

  // Phase 2: Child Remote Circle Join Modal & Live Sync state
  const [isJoinCircleModalOpen, setIsJoinCircleModalOpen] = useState<boolean>(false);
  const [joinCircleCodeInput, setJoinCircleCodeInput] = useState<string>('');
  const [joinChildNameInput, setJoinChildNameInput] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoiningCircle, setIsJoiningCircle] = useState<boolean>(false);
  const [isSyncingKidRemote, setIsSyncingKidRemote] = useState<boolean>(false);
  const [kidRemoteSubmissions, setKidRemoteSubmissions] = useState<RemoteVoiceSubmission[]>([]);

  // Phase 2: Supervisor Remote Circle Tab & Inbox state
  const [supervisorTab, setSupervisorTab] = useState<'local' | 'remote'>('local');
  const [supervisorSession, setSupervisorSession] = useState<RemoteCircleSupervisorSession | null>(() =>
    loadSupervisorCircleSession()
  );
  const [createCircleTitle, setCreateCircleTitle] = useState<string>('حلقة تحفيظ الصغار');
  const [createSupervisorName, setCreateSupervisorName] = useState<string>('');
  const [connectCircleCode, setConnectCircleCode] = useState<string>('');
  const [connectAdminKey, setConnectAdminKey] = useState<string>('');
  const [remoteCircleKids, setRemoteCircleKids] = useState<RemoteKidsMember[]>([]);
  const [remoteSubmissions, setRemoteSubmissions] = useState<RemoteVoiceSubmission[]>([]);
  const [selectedRemoteKidId, setSelectedRemoteKidId] = useState<string | null>(null);
  const [remoteWirdDraft, setRemoteWirdDraft] = useState<KidsDailyWird>(() => createDefaultWird());
  const [inboxFilter, setInboxFilter] = useState<'pending' | 'all'>('pending');
  const [remoteLoading, setRemoteLoading] = useState<boolean>(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteSuccessMsg, setRemoteSuccessMsg] = useState<string | null>(null);
  const [copiedCodeLabel, setCopiedCodeLabel] = useState<string | null>(null);

  // Supervisor audio playback & voice feedback recording for submissions
  const [playingRemoteAudioId, setPlayingRemoteAudioId] = useState<string | null>(null);
  const [reviewTextMap, setReviewTextMap] = useState<Record<string, string>>({});
  const [recordingForSubId, setRecordingForSubId] = useState<string | null>(null);
  const [activeSupStream, setActiveSupStream] = useState<MediaStream | null>(null);
  const [supervisorAudioDraftMap, setSupervisorAudioDraftMap] = useState<Record<string, string>>({});
  const [reviewingSubId, setReviewingSubId] = useState<string | null>(null);

  // Refs for clean timers and audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const repeatTimerRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordingStartTsRef = useRef<number>(0);
  const supRecorderRef = useRef<MediaRecorder | null>(null);
  const supStreamRef = useRef<MediaStream | null>(null);
  const supChunksRef = useRef<Blob[]>([]);
  const sessionTokenRef = useRef<number>(0);
  const lastAudioDurationRef = useRef<number>(3.5);
  const playbackBlobUrlRef = useRef<string | null>(null);
  const listenRafRef = useRef<number | null>(null);
  const surahAyahsRef = useRef<Ayah[]>(surahAyahs);
  surahAyahsRef.current = surahAyahs;
  const wordSegmentsMapRef = useRef<Record<number, WordSegment[]>>(wordSegmentsMap);
  wordSegmentsMapRef.current = wordSegmentsMap;
  const stateRef = useRef<KidsHifzState>(state);
  stateRef.current = state;

  const currentWird = activeProfile.dailyWird;
  const surahMeta = useMemo(
    () => SURAHS_LIST.find((s) => s.number === currentWird.surahNumber) || SURAHS_LIST[0],
    [currentWird.surahNumber]
  );
  const selectedReciter = useMemo(
    () => RECITERS_LIST.find((r) => r.id === currentWird.reciterId) || RECITERS_LIST[1] || RECITERS_LIST[0],
    [currentWird.reciterId]
  );

  // Helper to update and persist KidsHifzState
  const commitState = (updater: (prev: KidsHifzState) => KidsHifzState) => {
    setState((prev) => {
      const next = saveKidsHifzState(updater(prev));
      return next;
    });
  };

  const updateActiveProfile = (updater: (profile: KidsProfile) => KidsProfile) => {
    commitState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === prev.activeProfileId ? updater(p) : p)),
    }));
  };

  const syncActiveProfileProgressToRemote = async (profileSnapshot: KidsProfile) => {
    if (!profileSnapshot.remoteLink) return;
    try {
      await syncRemoteKidProgressApi(
        profileSnapshot.remoteLink.circleCode,
        profileSnapshot.remoteLink.kidId,
        profileSnapshot.remoteLink.kidToken,
        {
          stars: profileSnapshot.stars,
          masteredAyahKeys: profileSnapshot.masteredAyahKeys,
          completedSurahs: profileSnapshot.completedSurahs,
          ayahRepeatCounts: profileSnapshot.ayahRepeatCounts,
        }
      );
    } catch {
      // Offline or transient failure: local progress remains saved
    }
  };

  const stopKidVoiceCheck = (clearProgress = false) => {
    kidSpeechIntentStopRef.current = true;
    if (kidSpeechRecRef.current) {
      try {
        kidSpeechRecRef.current.onresult = null;
        kidSpeechRecRef.current.onerror = null;
        kidSpeechRecRef.current.onend = null;
        kidSpeechRecRef.current.stop();
      } catch {
        // Ignore stopped SpeechRecognition
      }
      kidSpeechRecRef.current = null;
    }
    setIsKidVoiceChecking(false);
    if (clearProgress) {
      setKidVoiceMatchedSet(new Set());
      setKidVoiceAccuracy(null);
      setKidVoiceTranscript('');
    }
  };

  // Clear all timers, rAF loops, blob URLs, and stop recitation audio cleanly
  const stopRecitationSession = (resetPhase = true) => {
    stopKidVoiceCheck(false);
    sessionTokenRef.current += 1;
    if (listenRafRef.current !== null) {
      window.cancelAnimationFrame(listenRafRef.current);
      listenRafRef.current = null;
    }
    if (repeatTimerRef.current !== null) {
      window.clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onerror = null;
    }
    if (playbackBlobUrlRef.current) {
      URL.revokeObjectURL(playbackBlobUrlRef.current);
      playbackBlobUrlRef.current = null;
    }
    setActiveWordIndex(-1);
    setListenProgressRatio(0);
    setRepeatProgressRatio(0);
    setRepeatCountdownSec(0);
    if (resetPhase) {
      setPromptPhase('idle');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopKidVoiceCheck(false);
      stopRecitationSession(false);
      if (recordedAudioRef.current) {
        recordedAudioRef.current.pause();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (supStreamRef.current) {
        supStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setActiveChildStream(null);
      setActiveSupStream(null);
    };
  }, []);

  // Inspect ?circle=XXXXXX&adminKey=... URL params once on mount and strip adminKey from URL bar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const circleParam = params.get('circle')?.replace(/[^0-9]/g, '') || '';
    const adminKeyParam = params.get('adminKey') || '';

    if (circleParam.length === 6 && adminKeyParam) {
      params.delete('adminKey');
      const cleanedQuery = params.toString();
      const nextUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);

      verifyRemoteCircleAdminApi(circleParam, adminKeyParam)
        .then((res) => {
          const sess: RemoteCircleSupervisorSession = {
            circleCode: res.circleCode,
            adminKey: adminKeyParam,
            title: res.title,
            supervisorName: res.supervisorName,
          };
          saveSupervisorCircleSession(sess);
          setSupervisorSession(sess);
          setViewMode('supervisor');
          setSupervisorTab('remote');
        })
        .catch(() => {
          // Ignore invalid key in URL
        });
    } else if (circleParam.length === 6 && !stateRef.current.profiles.some((p) => p.id === stateRef.current.activeProfileId && p.remoteLink?.circleCode === circleParam)) {
      setJoinCircleCodeInput(circleParam);
      setJoinChildNameInput(activeProfile.name);
      setIsJoinCircleModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull child's own remote circle updates (assigned wird, stars, submission reviews)
  const refreshChildFromRemote = async (silent = true) => {
    const prof =
      stateRef.current.profiles.find((p) => p.id === stateRef.current.activeProfileId) ||
      stateRef.current.profiles[0];
    if (!prof.remoteLink) return;
    if (!silent) setIsSyncingKidRemote(true);
    try {
      const res = await fetchRemoteCircleAsKidApi(
        prof.remoteLink.circleCode,
        prof.remoteLink.kidId,
        prof.remoteLink.kidToken
      );
      setKidRemoteSubmissions(res.submissions || []);
      commitState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prof.id
            ? applyRemoteMemberToProfile(p, res.member, {
                circleTitle: res.title,
                supervisorName: res.supervisorName,
              })
            : p
        ),
      }));
    } catch {
      // Quietly tolerate transient network blips during background polling
    } finally {
      if (!silent) setIsSyncingKidRemote(false);
    }
  };

  // Child background polling every 5s when linked and page is visible
  useEffect(() => {
    if (viewMode !== 'child' || !activeProfile.remoteLink) {
      setKidRemoteSubmissions([]);
      return;
    }
    refreshChildFromRemote(true);

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshChildFromRemote(true);
      }
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeProfile.id, activeProfile.remoteLink?.circleCode, activeProfile.remoteLink?.kidId]);

  // Pull supervisor remote circle state (members + voice inbox)
  const refreshSupervisorCircle = async (session: RemoteCircleSupervisorSession, silent = true) => {
    if (!silent) {
      setRemoteLoading(true);
      setRemoteError(null);
    }
    try {
      const res = await fetchRemoteCircleAsAdminApi(session.circleCode, session.adminKey);
      setRemoteCircleKids(res.kids || []);
      setRemoteSubmissions(res.submissions || []);
      setSelectedRemoteKidId((prev) => {
        if (prev && res.kids.some((k) => k.kidId === prev)) return prev;
        return res.kids[0]?.kidId || null;
      });
    } catch (err) {
      if (!silent) {
        setRemoteError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الحلقة');
      }
    } finally {
      if (!silent) setRemoteLoading(false);
    }
  };

  // Sync draft form whenever supervisor selects a different remote child
  useEffect(() => {
    if (!selectedRemoteKidId) return;
    const member = remoteCircleKids.find((k) => k.kidId === selectedRemoteKidId);
    if (member) {
      setRemoteWirdDraft(member.dailyWird);
    }
  }, [selectedRemoteKidId, remoteCircleKids]);

  // Supervisor background polling every 5s when viewing remote tab
  useEffect(() => {
    if (viewMode !== 'supervisor' || supervisorTab !== 'remote' || !supervisorSession) {
      return;
    }
    refreshSupervisorCircle(supervisorSession, false);
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshSupervisorCircle(supervisorSession, true);
      }
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, supervisorTab, supervisorSession?.circleCode]);

  // Revoke object URL when replaced/unmounted
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Keep currentAyahNumber inside dailyWird bounds when profile or wird changes
  useEffect(() => {
    setCurrentAyahNumber((prev) => {
      if (prev < currentWird.startAyah || prev > currentWird.endAyah) {
        return currentWird.startAyah;
      }
      return prev;
    });
  }, [activeProfile.id, currentWird.surahNumber, currentWird.startAyah, currentWird.endAyah]);

  // Load Surah Ayahs
  useEffect(() => {
    let cancelled = false;
    setIsLoadingSurah(true);
    setSurahLoadError(null);
    stopRecitationSession(true);

    getSurahData(currentWird.surahNumber)
      .then((data) => {
        if (!cancelled) {
          setSurahAyahs(data.ayahs);
          setIsLoadingSurah(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSurahLoadError(err?.message || 'تعذر تحميل آيات السورة');
          setIsLoadingSurah(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentWird.surahNumber, reloadNonce]);

  // Load word-level segments if available for selected reciter
  useEffect(() => {
    let cancelled = false;
    if (!selectedReciter.quranComRecitationId) {
      setWordSegmentsMap({});
      return;
    }
    getSurahAudioSegments(selectedReciter.quranComRecitationId, currentWird.surahNumber)
      .then((map) => {
        if (!cancelled) setWordSegmentsMap(map || {});
      })
      .catch(() => {
        if (!cancelled) setWordSegmentsMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [selectedReciter.id, selectedReciter.quranComRecitationId, currentWird.surahNumber]);

  const wirdAyahs = useMemo(() => {
    return surahAyahs.filter(
      (a) => a.numberInSurah >= currentWird.startAyah && a.numberInSurah <= currentWird.endAyah
    );
  }, [surahAyahs, currentWird.startAyah, currentWird.endAyah]);

  const activeAyah: Ayah | null = useMemo(() => {
    return (
      wirdAyahs.find((a) => a.numberInSurah === currentAyahNumber) ||
      wirdAyahs[0] ||
      null
    );
  }, [wirdAyahs, currentAyahNumber]);

  const activeAyahWords = useMemo(() => {
    if (!activeAyah) return [];
    const cleanText = sanitizeAyahText(
      activeAyah.text,
      currentWird.surahNumber,
      activeAyah.numberInSurah
    );
    return cleanText.trim().split(/\s+/).filter(Boolean);
  }, [activeAyah, currentWird.surahNumber]);

  useEffect(() => {
    kidSpeechContextRef.current = {
      surahNumber: currentWird.surahNumber,
      ayahNumber: activeAyah?.numberInSurah ?? currentWird.startAyah,
      words: activeAyahWords,
    };
  }, [currentWird.surahNumber, currentWird.startAyah, activeAyah?.numberInSurah, activeAyahWords]);

  // Compute today's Wird progress for active child
  const wirdMasteredCount = useMemo(() => {
    let count = 0;
    for (let a = currentWird.startAyah; a <= currentWird.endAyah; a++) {
      if (activeProfile.masteredAyahKeys.includes(makeAyahKey(currentWird.surahNumber, a))) {
        count += 1;
      }
    }
    return count;
  }, [activeProfile.masteredAyahKeys, currentWird.surahNumber, currentWird.startAyah, currentWird.endAyah]);

  const wirdTotalCount = Math.max(1, currentWird.endAyah - currentWird.startAyah + 1);
  const gardenStage = useMemo(() => computeGardenStage(activeProfile.stars), [activeProfile.stars]);

  // Begin one listen -> pause for repeat cycle for target ayah
  const runTadreebCycle = async (ayahNum: number, cycleIndex: number) => {
    const token = ++sessionTokenRef.current;
    if (listenRafRef.current !== null) {
      window.cancelAnimationFrame(listenRafRef.current);
      listenRafRef.current = null;
    }

    const latestProfile =
      stateRef.current.profiles.find((p) => p.id === stateRef.current.activeProfileId) ||
      stateRef.current.profiles[0];
    const targetCycles = latestProfile.dailyWird.repeatCount;
    const delayMode = latestProfile.dailyWird.repeatDelayMode;
    const reciterId = latestProfile.dailyWird.reciterId;
    const targetSurahNum = latestProfile.dailyWird.surahNumber;
    const reciter = RECITERS_LIST.find((r) => r.id === reciterId) || RECITERS_LIST[1] || RECITERS_LIST[0];

    setAudioError(null);
    setStatusBanner(null);
    setPromptPhase('listening');
    setCurrentCycle(cycleIndex);
    setListenProgressRatio(0);
    setRepeatProgressRatio(0);
    setActiveWordIndex(-1);

    let audioSrc = getAyahAudioUrl(reciter.serverKey, targetSurahNum, ayahNum);
    let nextBlobUrl: string | null = null;
    try {
      const cachedUrl = await getCachedAudioBlobUrl(audioSrc);
      if (cachedUrl) {
        if (sessionTokenRef.current !== token) {
          URL.revokeObjectURL(cachedUrl);
          return;
        }
        nextBlobUrl = cachedUrl;
        audioSrc = cachedUrl;
      }
    } catch {
      // Fallback to remote URL
    }

    if (sessionTokenRef.current !== token) {
      if (nextBlobUrl) URL.revokeObjectURL(nextBlobUrl);
      return;
    }

    if (playbackBlobUrlRef.current && playbackBlobUrlRef.current !== nextBlobUrl) {
      URL.revokeObjectURL(playbackBlobUrlRef.current);
    }
    playbackBlobUrlRef.current = nextBlobUrl;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();
    audio.src = audioSrc;
    audio.playbackRate = 0.92; // تلاوة متأنية مناسبة لتلقين الأطفال

    const syncWordHighlighting = () => {
      if (sessionTokenRef.current !== token) return;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      if (dur <= 0) return;

      lastAudioDurationRef.current = dur;
      setListenProgressRatio(Math.min(1, audio.currentTime / dur));

      const ayahObj = surahAyahsRef.current.find((a) => a.numberInSurah === ayahNum);
      if (!ayahObj) return;
      const cleanText = sanitizeAyahText(ayahObj.text, targetSurahNum, ayahNum);
      const words = cleanText.trim().split(/\s+/).filter(Boolean);
      const spokenIndices = getSpokenWordRawIndices(words);
      const segments = wordSegmentsMapRef.current[ayahNum];

      const spokenIdx = resolveActiveWordIndex(
        segments,
        audio.currentTime * 1000,
        dur * 1000,
        spokenIndices.length
      );
      setActiveWordIndex(spokenIdx >= 0 ? spokenIndices[spokenIdx] : -1);
    };

    const tickRaf = () => {
      if (sessionTokenRef.current !== token) return;
      syncWordHighlighting();
      listenRafRef.current = window.requestAnimationFrame(tickRaf);
    };

    audio.onloadedmetadata = () => {
      audio.playbackRate = 0.92;
    };
    audio.ontimeupdate = syncWordHighlighting;

    audio.onerror = () => {
      if (sessionTokenRef.current !== token) return;
      if (listenRafRef.current !== null) {
        window.cancelAnimationFrame(listenRafRef.current);
        listenRafRef.current = null;
      }
      setAudioError('تعذر تشغيل التلاوة الصوتية حالياً؛ تأكد من اتصال الإنترنت.');
      setPromptPhase('idle');
    };

    audio.onended = () => {
      if (sessionTokenRef.current !== token) return;
      if (listenRafRef.current !== null) {
        window.cancelAnimationFrame(listenRafRef.current);
        listenRafRef.current = null;
      }
      setListenProgressRatio(1);
      setActiveWordIndex(-1);

      // Enter Child Repeat Pause Phase
      const pauseMs = computeChildRepeatPauseMs(lastAudioDurationRef.current, delayMode);
      setPromptPhase('repeating');
      if (latestProfile.soundEffectsEnabled) {
        playKidEncouragementSound('prompt');
      }

      const startAt = Date.now();
      setRepeatCountdownSec(Math.ceil(pauseMs / 1000));
      setRepeatProgressRatio(0);

      repeatIntervalRef.current = window.setInterval(() => {
        if (sessionTokenRef.current !== token) return;
        const elapsed = Date.now() - startAt;
        const remainingMs = Math.max(0, pauseMs - elapsed);
        setRepeatCountdownSec(Math.ceil(remainingMs / 1000));
        setRepeatProgressRatio(Math.min(1, elapsed / pauseMs));
      }, 100);

      repeatTimerRef.current = window.setTimeout(() => {
        if (sessionTokenRef.current !== token) return;
        if (repeatIntervalRef.current !== null) {
          window.clearInterval(repeatIntervalRef.current);
          repeatIntervalRef.current = null;
        }
        setRepeatProgressRatio(1);
        setRepeatCountdownSec(0);

        if (cycleIndex < targetCycles) {
          runTadreebCycle(ayahNum, cycleIndex + 1);
        } else {
          // Completed all target cycles for this Ayah
          const hadCompletedSurahBefore = latestProfile.completedSurahs.includes(
            latestProfile.dailyWird.surahNumber
          );
          const alreadyMastered = latestProfile.masteredAyahKeys.includes(
            makeAyahKey(latestProfile.dailyWird.surahNumber, ayahNum)
          );

          const nextProfile = recordKidAyahCycle(
            latestProfile,
            latestProfile.dailyWird.surahNumber,
            ayahNum,
            true
          );
          updateActiveProfile((p) =>
            recordKidAyahCycle(p, latestProfile.dailyWird.surahNumber, ayahNum, true)
          );
          void syncActiveProfileProgressToRemote(nextProfile);

          setPromptPhase('celebrating');
          const willCompleteSurahNow =
            !hadCompletedSurahBefore &&
            surahMeta.numberOfAyahs > 0 &&
            (() => {
              const keyNow = makeAyahKey(latestProfile.dailyWird.surahNumber, ayahNum);
              for (let i = 1; i <= surahMeta.numberOfAyahs; i++) {
                const k = makeAyahKey(latestProfile.dailyWird.surahNumber, i);
                if (k !== keyNow && !latestProfile.masteredAyahKeys.includes(k)) {
                  return false;
                }
              }
              return true;
            })();

          if (latestProfile.soundEffectsEnabled) {
            playKidEncouragementSound(willCompleteSurahNow ? 'surah' : 'star');
          }

          setStatusBanner(
            willCompleteSurahNow
              ? `ما شاء الله! أتممت سورة ${surahMeta.name} وحصلت على وسام السورة (+٥ نجوم)`
              : alreadyMastered
              ? 'أحسنت يا بطل! مراجعة ممتازة للآية'
              : 'ممتاز يا بطل! أضأت نجمة جديدة لهذه الآية'
          );

          if (
            latestProfile.dailyWird.autoAdvanceAyah &&
            ayahNum < latestProfile.dailyWird.endAyah
          ) {
            autoAdvanceTimerRef.current = window.setTimeout(() => {
              if (sessionTokenRef.current !== token) return;
              const nextAyah = ayahNum + 1;
              setCurrentAyahNumber(nextAyah);
              runTadreebCycle(nextAyah, 1);
            }, 2200);
          }
        }
      }, pauseMs);
    };

    try {
      await audio.play();
      if (sessionTokenRef.current === token) {
        listenRafRef.current = window.requestAnimationFrame(tickRaf);
      }
    } catch {
      if (sessionTokenRef.current === token) {
        setAudioError('اضغط على الزر مرة أخرى للسماح بتشغيل الصوت.');
        setPromptPhase('idle');
      }
    }
  };

  const handleTogglePrimaryPrompt = () => {
    if (promptPhase === 'listening' || promptPhase === 'repeating') {
      stopRecitationSession(true);
    } else if (activeAyah) {
      runTadreebCycle(activeAyah.numberInSurah, 1);
    }
  };

  const handleRestartAyah = () => {
    if (!activeAyah) return;
    stopRecitationSession(false);
    runTadreebCycle(activeAyah.numberInSurah, 1);
  };

  const handleSelectAyah = (ayahNum: number) => {
    stopRecitationSession(true);
    stopKidVoiceCheck(true);
    setStatusBanner(null);
    setAudioError(null);
    setCurrentAyahNumber(ayahNum);
  };

  const handleToggleKidVoiceTest = () => {
    if (isKidVoiceChecking) {
      stopKidVoiceCheck(false);
      return;
    }
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor || !activeAyah) {
      setMicError('التسميع الذكي المباشر غير مدعوم في هذا المتصفح؛ يمكنك استخدام «سجِّل صوتك».');
      return;
    }

    stopRecitationSession(true);
    setMicError(null);
    setAudioError(null);
    setStatusBanner(null);
    setKidVoiceMatchedSet(new Set());
    setKidVoiceAccuracy(null);
    setKidVoiceTranscript('');

    try {
      kidSpeechIntentStopRef.current = false;
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
        const spoken = parts.join(' ').trim();
        setKidVoiceTranscript(spoken);

        const ctx = kidSpeechContextRef.current;
        const evalRes = evaluateRecitationAgainstAyah(ctx.words, spoken);
        setKidVoiceMatchedSet(new Set(evalRes.matchedRawIndices));
        setKidVoiceAccuracy(evalRes.accuracyPercent);

        const isSuccessThreshold =
          evalRes.isComplete ||
          (evalRes.totalExpectedSpokenWords >= 4 && evalRes.accuracyPercent >= 85);

        if (isSuccessThreshold) {
          kidSpeechIntentStopRef.current = true;
          try {
            recognition.stop();
          } catch {
            // Ignore race
          }
          kidSpeechRecRef.current = null;
          setIsKidVoiceChecking(false);

          const latestProf =
            stateRef.current.profiles.find((p) => p.id === stateRef.current.activeProfileId) ||
            stateRef.current.profiles[0];
          const updatedProf = recordKidAyahCycle(latestProf, ctx.surahNumber, ctx.ayahNumber, true);
          updateActiveProfile((p) => recordKidAyahCycle(p, ctx.surahNumber, ctx.ayahNumber, true));
          void syncActiveProfileProgressToRemote(updatedProf);

          if (latestProf.soundEffectsEnabled) {
            playKidEncouragementSound('star');
          }
          setStatusBanner(
            `ما شاء الله يا بطل! سمّعت الآية بدقة ${toArabicIndic(evalRes.accuracyPercent)}٪ وحصلت على نجمة!`
          );
        }
      };

      recognition.onerror = (event) => {
        if (kidSpeechIntentStopRef.current || event?.error === 'aborted') {
          setIsKidVoiceChecking(false);
          return;
        }
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setMicError('يرجى السماح بصلاحية الميكروفون ليسمعك التطبيق يا بطل.');
        } else if (event?.error === 'no-speech') {
          setMicError('لم أسمع صوتك بعد يا بطل، اقرأ بصوت واضح!');
        } else {
          setMicError('تأكد من اتصال الإنترنت للتسميع الذكي أو استخدم «سجِّل صوتك».');
        }
        kidSpeechRecRef.current = null;
        setIsKidVoiceChecking(false);
      };

      recognition.onend = () => {
        if (!kidSpeechIntentStopRef.current) {
          kidSpeechRecRef.current = null;
          setIsKidVoiceChecking(false);
        }
      };

      kidSpeechRecRef.current = recognition;
      recognition.start();
      setIsKidVoiceChecking(true);
    } catch {
      kidSpeechRecRef.current = null;
      setIsKidVoiceChecking(false);
      setMicError('تعذر بدء التسميع الصوتي الآن.');
    }
  };

  // Skip waiting pause early if child already finished repeating
  const handleFinishRepeatTurnNow = () => {
    if (promptPhase !== 'repeating' || !activeAyah) return;
    const token = sessionTokenRef.current;
    if (repeatTimerRef.current !== null) {
      window.clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }

    if (currentCycle < currentWird.repeatCount) {
      runTadreebCycle(activeAyah.numberInSurah, currentCycle + 1);
    } else {
      const nextProfile = recordKidAyahCycle(
        activeProfile,
        currentWird.surahNumber,
        activeAyah.numberInSurah,
        true
      );
      updateActiveProfile((p) =>
        recordKidAyahCycle(p, currentWird.surahNumber, activeAyah.numberInSurah, true)
      );
      void syncActiveProfileProgressToRemote(nextProfile);
      if (activeProfile.soundEffectsEnabled) {
        playKidEncouragementSound('star');
      }
      setPromptPhase('celebrating');
      setStatusBanner('ممتاز يا بطل! أتممت ترديد هذه الآية');
      if (currentWird.autoAdvanceAyah && activeAyah.numberInSurah < currentWird.endAyah) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          if (sessionTokenRef.current !== token) return;
          const nextAyah = activeAyah.numberInSurah + 1;
          setCurrentAyahNumber(nextAyah);
          runTadreebCycle(nextAyah, 1);
        }, 1800);
      }
    }
  };

  // Child Voice Recorder handlers
  const handleToggleVoiceRecord = async () => {
    setMicError(null);
    setSubmissionNotice(null);
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('التسجيل الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }

    stopRecitationSession(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setActiveChildStream(stream);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      recordedChunksRef.current = [];
      recordedBlobRef.current = null;
      recordingStartTsRef.current = Date.now();
      mediaRecorderRef.current = recorder;

      const targetSurah = currentWird.surahNumber;
      const targetAyah = activeAyah ? activeAyah.numberInSurah : currentWird.startAyah;
      const targetLabel = activeAyah
        ? `سورة ${surahMeta.name} · الآية ${toArabicIndic(activeAyah.numberInSurah)}`
        : `سورة ${surahMeta.name}`;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        recordedBlobRef.current = blob;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordingStartTsRef.current) / 1000)
        );
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        setRecordedAudioMime(mime.split(';')[0] || 'audio/webm');
        setRecordedDurationSec(durationSec);
        setRecordedAyahRange({ surah: targetSurah, ayah: targetAyah });
        setRecordedAyahLabel(targetLabel);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setActiveChildStream(null);
      };

      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setActiveChildStream(null);
      setMicError('يرجى السماح بصلاحية الميكروفون ليتمكن الطفل من تسجيل صوته وسماعه.');
      setIsRecordingVoice(false);
    }
  };

  const handlePlayRecordedVoice = () => {
    if (!recordedAudioUrl) return;
    if (isPlayingRecorded && recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      setIsPlayingRecorded(false);
      return;
    }
    if (!recordedAudioRef.current) {
      recordedAudioRef.current = new Audio();
    }
    const recAudio = recordedAudioRef.current;
    recAudio.src = recordedAudioUrl;
    recAudio.onended = () => setIsPlayingRecorded(false);
    recAudio.onerror = () => setIsPlayingRecorded(false);
    setIsPlayingRecorded(true);
    recAudio.play().catch(() => setIsPlayingRecorded(false));
  };

  const handlePlayRemoteAudioUrl = (audioId: string, srcUrl: string) => {
    if (playingRemoteAudioId === audioId && remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      setPlayingRemoteAudioId(null);
      return;
    }
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
    }
    const audioEl = remoteAudioRef.current;
    audioEl.pause();
    audioEl.src = srcUrl;
    audioEl.onended = () => setPlayingRemoteAudioId(null);
    audioEl.onerror = () => setPlayingRemoteAudioId(null);
    setPlayingRemoteAudioId(audioId);
    audioEl.play().catch(() => setPlayingRemoteAudioId(null));
  };

  const handleSendRecordedSubmission = async () => {
    if (!activeProfile.remoteLink || !recordedBlobRef.current) return;
    setMicError(null);
    setSubmissionNotice(null);
    setIsSendingSubmission(true);
    try {
      const dataUrl = await blobToDataUrl(recordedBlobRef.current);
      const res = await submitKidVoiceRecitationApi(
        activeProfile.remoteLink.circleCode,
        activeProfile.remoteLink.kidId,
        activeProfile.remoteLink.kidToken,
        {
          surahNumber: recordedAyahRange.surah,
          ayahNumber: recordedAyahRange.ayah,
          endAyahNumber: recordedAyahRange.ayah,
          audioDataUrl: dataUrl,
          mimeType: recordedAudioMime,
          durationSec: recordedDurationSec,
        }
      );
      setKidRemoteSubmissions((prev) => [res.submission, ...prev]);
      setSubmissionNotice('أحسنت! تم إرسال تسجيلك للمشرف بنجاح ليسمعه ويشجعك.');
      if (activeProfile.soundEffectsEnabled) {
        playKidEncouragementSound('star');
      }
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'تعذر إرسال التسميع للمشرف');
    } finally {
      setIsSendingSubmission(false);
    }
  };

  const handleJoinCircleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = joinCircleCodeInput.replace(/[^0-9]/g, '');
    if (digits.length !== 6) {
      setJoinError('يرجى إدخال كود الحلقة المكون من ٦ أرقام.');
      return;
    }
    setJoinError(null);
    setIsJoiningCircle(true);
    try {
      const res = await joinRemoteKidsCircleApi(digits, {
        name: joinChildNameInput.trim() || activeProfile.name,
        avatarId: activeProfile.avatarId,
        initialWird: activeProfile.dailyWird,
      });
      updateActiveProfile((p) => ({
        ...p,
        name: res.member.name,
        dailyWird: res.member.dailyWird,
        remoteLink: {
          circleCode: res.circleCode,
          kidId: res.member.kidId,
          kidToken: res.kidToken,
          circleTitle: res.title,
          supervisorName: res.supervisorName,
        },
      }));
      setIsJoinCircleModalOpen(false);
      setStatusBanner(`تم الانضمام بنجاح إلى ${res.title} بإشراف ${res.supervisorName}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'تعذر الانضمام إلى الحلقة');
    } finally {
      setIsJoiningCircle(false);
    }
  };

  const handleCopyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCodeLabel(label);
      window.setTimeout(() => setCopiedCodeLabel(null), 2200);
    } catch {
      // Clipboard blocked
    }
  };

  const handleCreateRemoteCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    setRemoteError(null);
    setRemoteSuccessMsg(null);
    setRemoteLoading(true);
    try {
      const res = await createRemoteKidsCircleApi({
        title: createCircleTitle.trim() || 'حلقة تحفيظ الصغار',
        supervisorName: createSupervisorName.trim() || 'المشرف',
      });
      const sess: RemoteCircleSupervisorSession = {
        circleCode: res.circleCode,
        adminKey: res.adminKey,
        title: res.title,
        supervisorName: res.supervisorName,
      };
      saveSupervisorCircleSession(sess);
      setSupervisorSession(sess);
      setRemoteCircleKids([]);
      setRemoteSubmissions([]);
      setRemoteSuccessMsg(`تم إنشاء الحلقة بنجاح! شارك الكود (${res.circleCode}) مع الأطفال.`);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'تعذر إنشاء الحلقة');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleConnectExistingCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = connectCircleCode.replace(/[^0-9]/g, '');
    if (digits.length !== 6 || !connectAdminKey.trim()) {
      setRemoteError('أدخل كود الحلقة (٦ أرقام) ومفتاح المشرف السري.');
      return;
    }
    setRemoteError(null);
    setRemoteSuccessMsg(null);
    setRemoteLoading(true);
    try {
      const res = await verifyRemoteCircleAdminApi(digits, connectAdminKey.trim());
      const sess: RemoteCircleSupervisorSession = {
        circleCode: res.circleCode,
        adminKey: connectAdminKey.trim(),
        title: res.title,
        supervisorName: res.supervisorName,
      };
      saveSupervisorCircleSession(sess);
      setSupervisorSession(sess);
      setConnectCircleCode('');
      setConnectAdminKey('');
      await refreshSupervisorCircle(sess, false);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'مفتاح المشرف غير صحيح');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handlePushRemoteWird = async () => {
    if (!supervisorSession || !selectedRemoteKidId) return;
    setRemoteError(null);
    setRemoteSuccessMsg(null);
    setRemoteLoading(true);
    try {
      const res = await updateRemoteKidWirdApi(
        supervisorSession.circleCode,
        supervisorSession.adminKey,
        selectedRemoteKidId,
        remoteWirdDraft
      );
      setRemoteCircleKids((prev) =>
        prev.map((k) => (k.kidId === res.member.kidId ? res.member : k))
      );
      setRemoteSuccessMsg(`تم إرسال الورد الجديد إلى جهاز ${res.member.name} بنجاح!`);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'تعذر تحديث ورد الطفل');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleToggleSupervisorVoiceDraft = async (subId: string) => {
    if (recordingForSubId === subId) {
      supRecorderRef.current?.stop();
      setRecordingForSubId(null);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRemoteError('التسجيل الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      supStreamRef.current = stream;
      setActiveSupStream(stream);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      supChunksRef.current = [];
      supRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) supChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(supChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        supStreamRef.current = null;
        setActiveSupStream(null);
        try {
          const dataUrl = await blobToDataUrl(blob);
          setSupervisorAudioDraftMap((prev) => ({ ...prev, [subId]: dataUrl }));
        } catch {
          setRemoteError('تعذر تجهيز الرسالة الصوتية للمشرف');
        }
      };

      recorder.start();
      setRecordingForSubId(subId);
    } catch {
      setActiveSupStream(null);
      setRemoteError('يرجى السماح بصلاحية الميكروفون لتسجيل توجيه صوتي للطفل.');
    }
  };

  const handleReviewRemoteSubmission = async (
    subId: string,
    decision: 'approved' | 'retry'
  ) => {
    if (!supervisorSession) return;
    setReviewingSubId(subId);
    setRemoteError(null);
    try {
      const res = await reviewKidVoiceSubmissionApi(
        supervisorSession.circleCode,
        supervisorSession.adminKey,
        subId,
        {
          decision,
          feedbackText: reviewTextMap[subId]?.trim() || undefined,
          supervisorAudioDataUrl: supervisorAudioDraftMap[subId] || undefined,
        }
      );
      setRemoteSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? res.submission : s))
      );
      if (res.member) {
        setRemoteCircleKids((prev) =>
          prev.map((k) => (k.kidId === res.member!.kidId ? res.member! : k))
        );
      }
      setRemoteSuccessMsg(
        decision === 'approved'
          ? 'تم اعتماد التلاوة وإضافة النجوم للطفل!'
          : 'تم إرسال توصية الإعادة اللطيفة للطفل.'
      );
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'تعذر حفظ تقييم التلاوة');
    } finally {
      setReviewingSubId(null);
    }
  };

  // Parent Gate handlers
  const openParentGate = () => {
    stopRecitationSession(true);
    setGateChallenge(generateParentGateChallenge());
    setGateInput('');
    setGateError(null);
    setIsGateModalOpen(true);
  };

  const handleSubmitGate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(gateInput.trim());
    if (parsed === gateChallenge.answer) {
      setIsGateModalOpen(false);
      setGateError(null);
      setViewMode('supervisor');
    } else {
      setGateError('الإجابة غير صحيحة؛ هذه البوابة مخصصة للمشرف أو ولي الأمر.');
    }
  };

  // Supervisor handlers
  const handleAddKidProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKidName.trim()) return;
    const created = createKidProfile(newKidName, newKidAvatar);
    commitState((prev) => ({
      activeProfileId: created.id,
      profiles: [...prev.profiles, created],
    }));
    setNewKidName('');
  };

  const handleUpdateWird = (patch: Partial<typeof currentWird>) => {
    updateActiveProfile((p) => {
      const merged = { ...p.dailyWird, ...patch };
      const clamped = clampWirdRange(merged.surahNumber, merged.startAyah, merged.endAyah);
      return {
        ...p,
        dailyWird: {
          ...merged,
          ...clamped,
        },
      };
    });
  };

  const handleSelectSurahForWird = (surahNum: number) => {
    const meta = SURAHS_LIST.find((s) => s.number === surahNum) || SURAHS_LIST[0];
    const defaultEnd = Math.min(meta.numberOfAyahs, meta.numberOfAyahs <= 10 ? meta.numberOfAyahs : 5);
    handleUpdateWird({
      surahNumber: meta.number,
      startAyah: 1,
      endAyah: defaultEnd,
    });
  };

  const handleToggleMasteredBySupervisor = (ayahNum: number) => {
    const key = makeAyahKey(currentWird.surahNumber, ayahNum);
    updateActiveProfile((p) => {
      const isAlready = p.masteredAyahKeys.includes(key);
      if (isAlready) {
        return {
          ...p,
          stars: Math.max(0, p.stars - 1),
          masteredAyahKeys: p.masteredAyahKeys.filter((k) => k !== key),
          completedSurahs: p.completedSurahs.filter((s) => s !== currentWird.surahNumber),
        };
      }
      return recordKidAyahCycle(p, currentWird.surahNumber, ayahNum, true);
    });
  };

  const handleRequestRetryAyah = (ayahNum: number) => {
    const key = makeAyahKey(currentWird.surahNumber, ayahNum);
    updateActiveProfile((p) => {
      const exists = p.retryRequestedKeys.includes(key);
      return {
        ...p,
        retryRequestedKeys: exists
          ? p.retryRequestedKeys.filter((k) => k !== key)
          : [...p.retryRequestedKeys, key],
      };
    });
  };

  const handleApproveEntireWird = () => {
    updateActiveProfile((p) =>
      approveSurahWirdForKid(p, currentWird.surahNumber, currentWird.startAyah, currentWird.endAyah)
    );
    if (activeProfile.soundEffectsEnabled) {
      playKidEncouragementSound('surah');
    }
  };

  // =========================================================================
  // SUPERVISOR VIEW (Protected by Parent Math Gate)
  // =========================================================================
  if (viewMode === 'supervisor') {
    const pendingInboxCount = remoteSubmissions.filter((s) => s.status === 'pending').length;
    const filteredSubmissions =
      inboxFilter === 'pending'
        ? remoteSubmissions.filter((s) => s.status === 'pending')
        : remoteSubmissions;
    const selectedRemoteKid =
      remoteCircleKids.find((k) => k.kidId === selectedRemoteKidId) || null;
    const remoteDraftSurahMeta =
      SURAHS_LIST.find((s) => s.number === remoteWirdDraft.surahNumber) || SURAHS_LIST[0];

    const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const childInviteUrl = supervisorSession
      ? `${originUrl}/?tab=kids&circle=${supervisorSession.circleCode}`
      : '';
    const secretSupervisorUrl = supervisorSession
      ? `${originUrl}/?tab=kids&circle=${supervisorSession.circleCode}&adminKey=${encodeURIComponent(supervisorSession.adminKey)}`
      : '';

    return (
      <section className="max-w-5xl mx-auto space-y-6 pb-8 animate-in fade-in duration-200">
        {/* Supervisor Header */}
        <div className="rounded-2xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#D9B45A]/45 dark:border-[#D9B45A]/35 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#D9B45A] font-semibold">
              <Unlock className="w-4 h-4" />
              <span>لوحة المشرف وولي الأمر</span>
              <span aria-hidden="true">·</span>
              <span>تحفيظ الصغار</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#F6EFDD] font-kufi">
              إدارة ورد {activeProfile.name} ومتابعة التسميع
            </h1>
            <p className="text-xs text-[#E5DCC5] dark:text-slate-300">
              اضبط الورد على هذا الجهاز، أو أنشئ حلقة عن بُعد لإرسال الأوراد واستقبال التسميع الصوتي من أجهزة الأطفال.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('child')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D9B45A] hover:bg-[#c9a349] text-[#1B1A17] font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>العودة وقفل شاشة الطفل</span>
          </button>
        </div>

        {/* Supervisor Sub-Navigation: Local Device vs Remote Circle & Voice Inbox */}
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSupervisorTab('local')}
            className={`flex-1 min-w-[200px] min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              supervisorTab === 'local'
                ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-[#D9B45A]" />
            <span>ملفات هذا الجهاز والورد المحلي</span>
          </button>

          <button
            type="button"
            onClick={() => setSupervisorTab('remote')}
            className={`flex-1 min-w-[200px] min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              supervisorTab === 'remote'
                ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/45'
                : 'text-[#6B6251] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>الحلقة عن بُعد وصندوق التسميع</span>
            {pendingInboxCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-[#D9B45A] text-[#1B1A17] text-[11px] font-bold tabular-nums">
                {toArabicIndic(pendingInboxCount)}
              </span>
            )}
          </button>
        </div>

        {supervisorTab === 'remote' ? (
          <div className="space-y-6">
            {remoteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span>{remoteError}</span>
              </div>
            )}
            {remoteSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-100 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{remoteSuccessMsg}</span>
              </div>
            )}

            {!supervisorSession ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create New Remote Circle */}
                <form
                  onSubmit={handleCreateRemoteCircle}
                  className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 dark:border-[#D9B45A]/30 p-5 space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                      <span>إنشاء حلقة مشرف جديدة (كود ٦ أرقام)</span>
                    </h2>
                    <p className="text-xs text-[#6B6251] dark:text-slate-400">
                      أنشئ حلقة واحدة وشارك كودها المكون من ٦ أرقام مع أطفالك دون حاجة لحسابات بريد إلكتروني.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="create-circle-title" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                      اسم الحلقة
                    </label>
                    <input
                      id="create-circle-title"
                      type="text"
                      value={createCircleTitle}
                      onChange={(e) => setCreateCircleTitle(e.target.value)}
                      placeholder="مثلاً: حلقة براعم الفجر"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="create-supervisor-name" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                      اسم المشرف / ولي الأمر
                    </label>
                    <input
                      id="create-supervisor-name"
                      type="text"
                      value={createSupervisorName}
                      onChange={(e) => setCreateSupervisorName(e.target.value)}
                      placeholder="مثلاً: الأستاذ أحمد أو أم عمر"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={remoteLoading}
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D9B45A] hover:bg-[#c9a349] disabled:opacity-50 text-[#1B1A17] font-bold text-sm cursor-pointer transition-colors"
                  >
                    {remoteLoading ? 'جارٍ الإنشاء...' : 'إنشاء الحلقة وإصدار الكود'}
                  </button>
                </form>

                {/* Connect to Existing Circle */}
                <form
                  onSubmit={handleConnectExistingCircle}
                  className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-5 space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                      <span>فتح حلقة قائمة من جهاز آخر</span>
                    </h2>
                    <p className="text-xs text-[#6B6251] dark:text-slate-400">
                      أدخل كود الحلقة (٦ أرقام) ومفتاح المشرف السري الذي حفظته عند الإنشاء.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="connect-circle-code" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                      كود الحلقة (٦ أرقام)
                    </label>
                    <input
                      id="connect-circle-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={connectCircleCode}
                      onChange={(e) => setConnectCircleCode(e.target.value)}
                      placeholder="مثال: 482910"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums outline-none focus:border-[#D9B45A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="connect-admin-key" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                      مفتاح المشرف السري
                    </label>
                    <input
                      id="connect-admin-key"
                      type="password"
                      value={connectAdminKey}
                      onChange={(e) => setConnectAdminKey(e.target.value)}
                      placeholder="أدخل مفتاح المشرف السري..."
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={remoteLoading}
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] disabled:opacity-50 border border-[#648CD4]/45 text-[#F6EFDD] font-bold text-sm cursor-pointer transition-colors"
                  >
                    {remoteLoading ? 'جارٍ التحقق...' : 'فتح لوحة الحلقة'}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Active Remote Circle Summary & Share Card */}
                <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/40 dark:border-[#D9B45A]/35 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                        <Radio className="w-3.5 h-3.5" />
                        <span>حلقة متصلة ومباشرة</span>
                        <span aria-hidden="true">·</span>
                        <span>إشراف: {supervisorSession.supervisorName}</span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
                        {supervisorSession.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-4 py-2 rounded-xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#D9B45A]/50 text-center">
                        <div className="text-[10px] text-[#E5DCC5] dark:text-slate-300">كود انضمام الأطفال</div>
                        <div className="text-xl font-bold text-[#D9B45A] tracking-widest tabular-nums" dir="ltr">
                          {supervisorSession.circleCode}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => refreshSupervisorCircle(supervisorSession, false)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-[#F3E9D2] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-700 text-xs font-bold text-[#1B1A17] dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${remoteLoading ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          saveSupervisorCircleSession(null);
                          setSupervisorSession(null);
                          setRemoteCircleKids([]);
                          setRemoteSubmissions([]);
                        }}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-300 dark:border-rose-500/35 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>إغلاق الجلسة</span>
                      </button>
                    </div>
                  </div>

                  {/* Copyable Invite Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleCopyText('childLink', childInviteUrl)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2]/60 dark:hover:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-xs font-semibold text-[#1B1A17] dark:text-slate-200 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                        <span>نسخ رابط انضمام الأطفال المباشر</span>
                      </span>
                      {copiedCodeLabel === 'childLink' ? (
                        <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> تم النسخ
                        </span>
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#6B6251] dark:text-slate-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText('adminLink', secretSupervisorUrl)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2]/60 dark:hover:bg-slate-900 border border-amber-400/50 dark:border-amber-500/30 text-xs font-semibold text-amber-950 dark:text-amber-100 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-[#8A6418] dark:text-amber-400" />
                        <span>نسخ رابط المشرف السري (لجهازك فقط)</span>
                      </span>
                      {copiedCodeLabel === 'adminLink' ? (
                        <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> تم النسخ
                        </span>
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#6B6251] dark:text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remote Kids List + Remote Wird Push */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Joined Kids + Assign Wird */}
                  <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                        <span>الأطفال المنضمون ({toArabicIndic(remoteCircleKids.length)})</span>
                      </h3>
                    </div>

                    {remoteCircleKids.length === 0 ? (
                      <div className="p-6 rounded-xl bg-white dark:bg-slate-950/70 border border-[#D9B45A]/20 dark:border-slate-800 text-center space-y-2">
                        <p className="text-xs text-[#4B4539] dark:text-slate-300">
                          لم ينضم أي طفل للحلقة بعد. اعطِ الطفل الكود{' '}
                          <span className="text-[#8A6418] dark:text-[#D9B45A] font-bold tabular-nums" dir="ltr">
                            {supervisorSession.circleCode}
                          </span>{' '}
                          ليدخل من جهازه.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                        {remoteCircleKids.map((kid) => {
                          const isSel = kid.kidId === selectedRemoteKidId;
                          const kSurah = SURAHS_LIST.find((s) => s.number === kid.dailyWird.surahNumber);
                          return (
                            <button
                              key={kid.kidId}
                              type="button"
                              onClick={() => setSelectedRemoteKidId(kid.kidId)}
                              className={`w-full text-right p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isSel
                                  ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border-[#D9B45A] text-[#F6EFDD]'
                                  : 'bg-white dark:bg-slate-950/80 border-[#D9B45A]/20 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSel
                                      ? 'bg-[#D9B45A] text-[#1B1A17]'
                                      : 'bg-[#F3E9D2] dark:bg-slate-900 text-[#8A6418] dark:text-[#D9B45A]'
                                  }`}
                                >
                                  {renderAvatarIcon(kid.avatarId, 'w-5 h-5')}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm truncate">{kid.name}</div>
                                  <div className={`text-[11px] tabular-nums truncate ${isSel ? 'text-[#E5DCC5]' : 'text-[#6B6251] dark:text-slate-300'}`}>
                                    {toArabicIndic(kid.stars)} نجمة · ورد سورة {kSurah?.name || ''} ({toArabicIndic(kid.dailyWird.startAyah)}–{toArabicIndic(kid.dailyWird.endAyah)})
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedRemoteKid && (
                      <div className="pt-4 border-t border-[#D9B45A]/20 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
                          إرسال ورد جديد لجهاز: {selectedRemoteKid.name}
                        </div>

                        <select
                          aria-label="سورة الورد عن بعد"
                          value={remoteWirdDraft.surahNumber}
                          onChange={(e) => {
                            const sNum = Number(e.target.value);
                            const meta = SURAHS_LIST.find((x) => x.number === sNum) || SURAHS_LIST[0];
                            setRemoteWirdDraft((prev) => ({
                              ...prev,
                              surahNumber: meta.number,
                              startAyah: 1,
                              endAyah: Math.min(meta.numberOfAyahs, meta.numberOfAyahs <= 10 ? meta.numberOfAyahs : 5),
                            }));
                          }}
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                        >
                          {SURAHS_LIST.map((s) => (
                            <option key={s.number} value={s.number} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                              {toArabicIndic(s.number)}. سورة {s.name} ({toArabicIndic(s.numberOfAyahs)} آية)
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-[#6B6251] dark:text-slate-400 mb-1">من آية</label>
                            <input
                              type="number"
                              min={1}
                              max={remoteDraftSurahMeta.numberOfAyahs}
                              value={remoteWirdDraft.startAyah}
                              onChange={(e) => {
                                const c = clampWirdRange(
                                  remoteWirdDraft.surahNumber,
                                  Number(e.target.value),
                                  remoteWirdDraft.endAyah
                                );
                                setRemoteWirdDraft((prev) => ({ ...prev, ...c }));
                              }}
                              className="w-full min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#6B6251] dark:text-slate-400 mb-1">إلى آية</label>
                            <input
                              type="number"
                              min={remoteWirdDraft.startAyah}
                              max={remoteDraftSurahMeta.numberOfAyahs}
                              value={remoteWirdDraft.endAyah}
                              onChange={(e) => {
                                const c = clampWirdRange(
                                  remoteWirdDraft.surahNumber,
                                  remoteWirdDraft.startAyah,
                                  Number(e.target.value)
                                );
                                setRemoteWirdDraft((prev) => ({ ...prev, ...c }));
                              }}
                              className="w-full min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#6B6251] dark:text-slate-400 mb-1">التكرار</label>
                            <select
                              value={remoteWirdDraft.repeatCount}
                              onChange={(e) =>
                                setRemoteWirdDraft((prev) => ({
                                  ...prev,
                                  repeatCount: Number(e.target.value) as KidsRepeatCount,
                                }))
                              }
                              className="w-full min-h-[40px] px-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD]"
                            >
                              <option value={3}>٣ مرات</option>
                              <option value={5}>٥ مرات</option>
                              <option value={7}>٧ مرات</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handlePushRemoteWird}
                          disabled={remoteLoading}
                          className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#D9B45A] hover:bg-[#c9a349] disabled:opacity-50 text-[#1B1A17] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>اعتماد وإرسال الورد لجهاز الطفل</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Async Voice Recitation Inbox */}
                  <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                        <span>صندوق التسميع الصوتي</span>
                      </h3>
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setInboxFilter('pending')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            inboxFilter === 'pending'
                              ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                              : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                          }`}
                        >
                          قيد الانتظار ({toArabicIndic(pendingInboxCount)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInboxFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            inboxFilter === 'all'
                              ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                              : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                          }`}
                        >
                          الكل ({toArabicIndic(remoteSubmissions.length)})
                        </button>
                      </div>
                    </div>

                    {filteredSubmissions.length === 0 ? (
                      <div className="p-8 rounded-xl bg-white dark:bg-slate-950/70 border border-[#D9B45A]/20 dark:border-slate-800 text-center text-xs text-[#6B6251] dark:text-slate-400">
                        {inboxFilter === 'pending'
                          ? 'لا توجد تسجيلات صوتية جديدة بانتظار المراجعة حالياً.'
                          : 'لم يُرسل الأطفال أي تسجيلات تسميع صوتية بعد.'}
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                        {filteredSubmissions.map((sub) => {
                          const sMeta = SURAHS_LIST.find((x) => x.number === sub.surahNumber);
                          const isPlayingClip = playingRemoteAudioId === sub.id;
                          const isSupRecording = recordingForSubId === sub.id;
                          const hasSupAudio = Boolean(supervisorAudioDraftMap[sub.id]);

                          return (
                            <div
                              key={sub.id}
                              className="p-3.5 rounded-xl bg-white dark:bg-slate-950/85 border border-[#D9B45A]/25 dark:border-slate-800 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
                                    <span>{sub.kidName}</span>
                                    <span
                                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                                        sub.status === 'approved'
                                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-500/35'
                                          : sub.status === 'retry'
                                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/35'
                                          : 'bg-sky-50 dark:bg-sky-950 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-500/35'
                                      }`}
                                    >
                                      {sub.status === 'approved'
                                        ? 'مُتقن'
                                        : sub.status === 'retry'
                                        ? 'توصية إعادة'
                                        : 'بانتظار المراجعة'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#6B6251] dark:text-slate-400 tabular-nums mt-0.5">
                                    سورة {sMeta?.name || sub.surahNumber} · الآية {toArabicIndic(sub.ayahNumber)} · المدة {toArabicIndic(sub.durationSec)} ث
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handlePlayRemoteAudioUrl(sub.id, sub.audioDataUrl)}
                                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#D9B45A] text-[#1B1A17] text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  {isPlayingClip ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                  <span>{isPlayingClip ? 'إيقاف' : 'استماع'}</span>
                                </button>
                              </div>

                              {/* Supervisor Feedback Controls */}
                              <div className="space-y-2 pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800/80">
                                <div className="flex flex-wrap gap-2 items-center">
                                  <input
                                    type="text"
                                    value={reviewTextMap[sub.id] ?? sub.supervisorFeedbackText ?? ''}
                                    onChange={(e) =>
                                      setReviewTextMap((prev) => ({
                                        ...prev,
                                        [sub.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="رسالة تشجيعية أو ملاحظة قصيرة للطفل..."
                                    className="flex-1 min-w-[160px] min-h-[38px] px-3 rounded-lg bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSupervisorVoiceDraft(sub.id)}
                                    title="تسجيل توجيه صوتي قصير للطفل"
                                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                      isSupRecording
                                        ? 'bg-rose-600 border-rose-400 text-white'
                                        : hasSupAudio
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-200'
                                        : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/30 dark:border-slate-700 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]'
                                    }`}
                                  >
                                    {isSupRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                    <span>
                                      {isSupRecording
                                        ? 'إيقاف'
                                        : hasSupAudio
                                        ? 'تم تسجيل التوجيه'
                                        : 'رد صوتي'}
                                    </span>
                                  </button>
                                  {isSupRecording && (
                                    <AudioLevelMeter isActive={true} mediaStream={activeSupStream} tone="rose" />
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={reviewingSubId === sub.id}
                                    onClick={() => handleReviewRemoteSubmission(sub.id, 'approved')}
                                    className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Star className="w-3.5 h-3.5 fill-white" />
                                    <span>اعتماد الإتقان (+نجوم)</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={reviewingSubId === sub.id}
                                    onClick={() => handleReviewRemoteSubmission(sub.id, 'retry')}
                                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 border border-amber-400/50 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>طلب إعادة لطيفة</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
        {/* Kid Profiles Switcher & Creator */}
        <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>ملفات الأطفال على هذا الجهاز</span>
            </h2>
            <span className="text-xs text-[#6B6251] dark:text-slate-400 tabular-nums">
              {toArabicIndic(state.profiles.length)} ملفات
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.profiles.map((prof) => {
              const isSelected = prof.id === activeProfile.id;
              const pSurah = SURAHS_LIST.find((s) => s.number === prof.dailyWird.surahNumber);
              return (
                <div
                  key={prof.id}
                  className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/50 border-[#D9B45A] text-[#F6EFDD]'
                      : 'bg-white dark:bg-slate-950/70 border-[#D9B45A]/20 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => commitState((prev) => ({ ...prev, activeProfileId: prof.id }))}
                    className="flex-1 text-right flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#D9B45A] text-[#1B1A17]'
                          : 'bg-[#F3E9D2] dark:bg-slate-900 text-[#8A6418] dark:text-[#D9B45A] border border-[#D9B45A]/25 dark:border-slate-800'
                      }`}
                    >
                      {renderAvatarIcon(prof.avatarId, 'w-5 h-5')}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-sm truncate">{prof.name}</span>
                      <span className={`block text-[11px] tabular-nums truncate ${isSelected ? 'text-[#E5DCC5]' : 'text-[#6B6251] dark:text-slate-400'}`}>
                        {toArabicIndic(prof.stars)} نجمة · سورة {pSurah?.name || ''}
                        {prof.remoteLink ? ` · حلقة #${prof.remoteLink.circleCode}` : ''}
                      </span>
                    </span>
                  </button>

                  {prof.remoteLink && (
                    <button
                      type="button"
                      onClick={() => {
                        commitState((prev) => ({
                          ...prev,
                          profiles: prev.profiles.map((x) =>
                            x.id === prof.id ? { ...x, remoteLink: undefined } : x
                          ),
                        }));
                      }}
                      title="فك ارتباط هذا الملف بالحلقة عن بُعد"
                      aria-label={`فك ارتباط ${prof.name} بالحلقة`}
                      className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-amber-500 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-200 hover:bg-amber-500/15 cursor-pointer shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}

                  {state.profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        commitState((prev) => {
                          const remaining = prev.profiles.filter((x) => x.id !== prof.id);
                          return {
                            activeProfileId:
                              prev.activeProfileId === prof.id
                                ? remaining[0].id
                                : prev.activeProfileId,
                            profiles: remaining,
                          };
                        });
                      }}
                      aria-label={`حذف ملف ${prof.name}`}
                      className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add new child form */}
          <form onSubmit={handleAddKidProfile} className="pt-3 border-t border-[#D9B45A]/20 dark:border-slate-800/80 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newKidName}
              onChange={(e) => setNewKidName(e.target.value)}
              placeholder="اسم الطفل الجديد (مثلاً: مريم أو يوسف)..."
              aria-label="اسم الطفل الجديد"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
            />
            <div className="flex items-center gap-1.5">
              {KIDS_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setNewKidAvatar(av.id)}
                  title={av.label}
                  aria-label={av.label}
                  className={`min-w-[42px] min-h-[42px] rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                    newKidAvatar === av.id
                      ? 'bg-[#D9B45A] text-[#1B1A17] border-[#D9B45A]'
                      : 'bg-white dark:bg-slate-950 text-[#6B6251] dark:text-slate-300 border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#D9B45A]'
                  }`}
                >
                  {renderAvatarIcon(av.id, 'w-4 h-4')}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!newKidName.trim()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] disabled:opacity-45 border border-[#648CD4]/45 text-[#F6EFDD] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة طفل</span>
            </button>
          </form>
        </div>

        {/* Daily Wird Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">إعداد ورد اليوم والتلقين</h2>

            {/* Quick Short Surahs */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#4B4539] dark:text-slate-300">اختيار سريع لقصار السور</div>
              <div className="flex flex-wrap gap-1.5">
                {RECOMMENDED_KIDS_SURAH_NUMBERS.map((num) => {
                  const s = SURAHS_LIST.find((item) => item.number === num);
                  if (!s) return null;
                  const active = currentWird.surahNumber === s.number;
                  return (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => handleSelectSurahForWird(s.number)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#D9B45A] text-[#1B1A17] border-[#D9B45A] font-bold'
                          : 'bg-white dark:bg-slate-950 text-[#1B1A17] dark:text-slate-200 border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#D9B45A]'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Surah Selector & Range */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <label htmlFor="kids-surah-select" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                  أو اختر من جميع السور (١١٤)
                </label>
                <select
                  id="kids-surah-select"
                  value={currentWird.surahNumber}
                  onChange={(e) => handleSelectSurahForWird(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                >
                  {SURAHS_LIST.map((s) => (
                    <option key={s.number} value={s.number} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                      {toArabicIndic(s.number)}. سورة {s.name} ({toArabicIndic(s.numberOfAyahs)} آية)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="kids-start-ayah" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                  من الآية
                </label>
                <input
                  id="kids-start-ayah"
                  type="number"
                  min={1}
                  max={surahMeta.numberOfAyahs}
                  value={currentWird.startAyah}
                  onChange={(e) => handleUpdateWird({ startAyah: Number(e.target.value) })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums outline-none focus:border-[#D9B45A]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="kids-end-ayah" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                  إلى الآية
                </label>
                <input
                  id="kids-end-ayah"
                  type="number"
                  min={currentWird.startAyah}
                  max={surahMeta.numberOfAyahs}
                  value={currentWird.endAyah}
                  onChange={(e) => handleUpdateWird({ endAyah: Number(e.target.value) })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums outline-none focus:border-[#D9B45A]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="kids-reciter-select" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                  القارئ المعلم
                </label>
                <select
                  id="kids-reciter-select"
                  value={currentWird.reciterId}
                  onChange={(e) => handleUpdateWird({ reciterId: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Repeat Count & Pause Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[#4B4539] dark:text-slate-300">تكرار كل آية</div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800">
                  {([3, 5, 7] as KidsRepeatCount[]).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleUpdateWird({ repeatCount: cnt })}
                      className={`min-h-[38px] rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        currentWird.repeatCount === cnt
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                          : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      {toArabicIndic(cnt)} مرات
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[#4B4539] dark:text-slate-300">مهلة الصمت للترديد</div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800">
                  {(
                    [
                      { id: 'short', label: 'قصيرة' },
                      { id: 'medium', label: 'متوسطة' },
                      { id: 'long', label: 'طويلة' },
                    ] as { id: KidsDelayMode; label: string }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleUpdateWird({ repeatDelayMode: mode.id })}
                      className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentWird.repeatDelayMode === mode.id
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                          : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleUpdateWird({ autoAdvanceAyah: !currentWird.autoAdvanceAyah })}
                className={`flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  currentWird.autoAdvanceAyah
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                    : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300'
                }`}
              >
                <span>الانتقال التلقائي للآية التالية</span>
                <span>{currentWird.autoAdvanceAyah ? 'مفعل' : 'يدوي'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateActiveProfile((p) => ({ ...p, soundEffectsEnabled: !p.soundEffectsEnabled }))
                }
                className={`flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  activeProfile.soundEffectsEnabled
                    ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/40 border-[#648CD4]/45 text-[#F6EFDD]'
                    : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300'
                }`}
              >
                <span>أصوات التشجيع اللطيفة</span>
                <span>{activeProfile.soundEffectsEnabled ? 'مفعلة' : 'مكتومة'}</span>
              </button>
            </div>
          </div>

          {/* Supervisor Ayah Review & Approval */}
          <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-6 space-y-4 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                اعتماد آيات الورد · سورة {surahMeta.name}
              </h2>
              <button
                type="button"
                onClick={handleApproveEntireWird}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>اعتماد الورد كاملاً</span>
              </button>
            </div>

            {recordedAudioUrl && (
              <div className="p-3 rounded-xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#D9B45A]/35 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#F6EFDD]">آخر تسجيل للطفل للمراجعة</div>
                  <div className="text-[11px] text-[#E5DCC5] dark:text-slate-300 truncate">{recordedAyahLabel}</div>
                </div>
                <button
                  type="button"
                  onClick={handlePlayRecordedVoice}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#D9B45A] text-[#1B1A17] text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isPlayingRecorded ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingRecorded ? 'إيقاف' : 'استماع'}</span>
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {wirdAyahs.map((ayah) => {
                const key = makeAyahKey(currentWird.surahNumber, ayah.numberInSurah);
                const mastered = activeProfile.masteredAyahKeys.includes(key);
                const retryFlagged = activeProfile.retryRequestedKeys.includes(key);
                const cyclesDone = activeProfile.ayahRepeatCounts[key] || 0;

                return (
                  <div
                    key={ayah.numberInSurah}
                    className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-[#D9B45A]/20 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-[#6B6251] dark:text-slate-400 tabular-nums">
                        <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">
                          الآية {toArabicIndic(ayah.numberInSurah)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>كررها {toArabicIndic(cyclesDone)} مرة</span>
                        {retryFlagged && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 dark:text-amber-300 font-semibold">يحتاج إعادة</span>
                          </>
                        )}
                      </div>
                      <p className="font-quran text-lg text-[#1B1A17] dark:text-[#F6EFDD] truncate">{ayah.text}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRequestRetryAyah(ayah.numberInSurah)}
                        title="طلب إعادة لطيفة لهذه الآية"
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                          retryFlagged
                            ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400/50 text-amber-900 dark:text-amber-200'
                            : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                        }`}
                      >
                        إعادة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMasteredBySupervisor(ayah.numberInSurah)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                          mastered
                            ? 'bg-emerald-50 dark:bg-emerald-600/25 border-emerald-400/60 text-emerald-800 dark:text-emerald-200'
                            : 'bg-[#1F3A6E] border-[#648CD4]/45 text-[#F6EFDD]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${mastered ? 'fill-emerald-500 dark:fill-emerald-300' : ''}`} />
                        <span>{mastered ? 'متقنة' : 'اعتماد'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </>
        )}
      </section>
    );
  }

  // =========================================================================
  // CHILD VIEW (Simple, Visual, Audio-Guided)
  // =========================================================================
  const isCurrentAyahMastered = activeAyah
    ? activeProfile.masteredAyahKeys.includes(
        makeAyahKey(currentWird.surahNumber, activeAyah.numberInSurah)
      )
    : false;
  const isCurrentAyahRetryRequested = activeAyah
    ? activeProfile.retryRequestedKeys.includes(
        makeAyahKey(currentWird.surahNumber, activeAyah.numberInSurah)
      )
    : false;

  const canGoPrev = activeAyah ? activeAyah.numberInSurah > currentWird.startAyah : false;
  const canGoNext = activeAyah ? activeAyah.numberInSurah < currentWird.endAyah : false;

  return (
    <section className="max-w-4xl mx-auto space-y-5 pb-10 animate-in fade-in duration-200">
      {/* Top Kid Motivation Bar */}
      <div className="rounded-2xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#D9B45A]/45 dark:border-[#D9B45A]/30 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#D9B45A] text-[#1B1A17] flex items-center justify-center shadow-md shrink-0">
            {renderAvatarIcon(activeProfile.avatarId, 'w-6 h-6')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#F6EFDD] font-kufi truncate">
                {activeProfile.name}
              </h1>
              <span className="text-xs text-[#D9B45A] font-bold tabular-nums flex items-center gap-1 shrink-0">
                <Star className="w-4 h-4 fill-[#D9B45A]" />
                {toArabicIndic(activeProfile.stars)}
              </span>
            </div>
            <div className="text-xs text-[#E5DCC5] dark:text-slate-300 tabular-nums">
              سورة {surahMeta.name} · أتممت {toArabicIndic(wirdMasteredCount)} من {toArabicIndic(wirdTotalCount)} آيات اليوم
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeProfile.remoteLink ? (
            <button
              type="button"
              onClick={() => refreshChildFromRemote(false)}
              disabled={isSyncingKidRemote}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-400/50 text-emerald-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingKidRemote ? 'animate-spin' : ''}`} />
              <span>مزامنة الحلقة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setJoinChildNameInput(activeProfile.name);
                setJoinError(null);
                setIsJoinCircleModalOpen(true);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-[#1F3A6E]/80 dark:hover:bg-[#1F3A6E] border border-[#648CD4]/45 text-[#F6EFDD] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Link2 className="w-4 h-4 text-[#D9B45A]" />
              <span>انضمام لحلقة بكود</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              updateActiveProfile((p) => ({ ...p, soundEffectsEnabled: !p.soundEffectsEnabled }))
            }
            aria-label={activeProfile.soundEffectsEnabled ? 'كتم أصوات التشجيع' : 'تفعيل أصوات التشجيع'}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700 text-[#F6EFDD] hover:text-[#D9B45A] flex items-center justify-center cursor-pointer transition-colors"
          >
            {activeProfile.soundEffectsEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-300 dark:text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={openParentGate}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 dark:bg-slate-900/90 hover:bg-white/20 dark:hover:bg-slate-800 border border-[#D9B45A]/45 text-[#F6EFDD] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Lock className="w-4 h-4 text-[#D9B45A]" />
            <span>بوابة المشرف</span>
          </button>
        </div>
      </div>

      {/* Connected Remote Circle Strip for Child */}
      {activeProfile.remoteLink && (
        <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-emerald-400/50 dark:border-emerald-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-semibold">
            <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              مرتبط بحلقة: <strong className="text-[#1B1A17] dark:text-[#F6EFDD]">{activeProfile.remoteLink.circleTitle || 'حلقة التحفيظ'}</strong>
            </span>
            {activeProfile.remoteLink.supervisorName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#6B6251] dark:text-slate-300">بإشراف {activeProfile.remoteLink.supervisorName}</span>
              </>
            )}
          </div>
          <span className="text-[#6B6251] dark:text-slate-400 tabular-nums" dir="ltr">
            #{activeProfile.remoteLink.circleCode}
          </span>
        </div>
      )}

      {/* Visual Stars Progress Strip for Today's Wird */}
      <div className="flex items-center justify-center flex-wrap gap-2 px-2">
        {Array.from({ length: wirdTotalCount }, (_, idx) => {
          const ayahNum = currentWird.startAyah + idx;
          const mastered = activeProfile.masteredAyahKeys.includes(
            makeAyahKey(currentWird.surahNumber, ayahNum)
          );
          const isCurrent = activeAyah?.numberInSurah === ayahNum;
          return (
            <button
              key={ayahNum}
              type="button"
              onClick={() => handleSelectAyah(ayahNum)}
              aria-label={`الانتقال إلى الآية ${ayahNum}`}
              className={`min-w-[46px] min-h-[46px] px-3 rounded-2xl border font-bold text-sm tabular-nums flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-[#D9B45A] text-[#1B1A17] border-[#8A6418] dark:border-[#F6EFDD] scale-105 shadow-lg'
                  : mastered
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/45'
                  : 'bg-[#FBF7EE] dark:bg-[#10161f] text-[#4B4539] dark:text-slate-300 border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#D9B45A]'
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  mastered
                    ? isCurrent
                      ? 'fill-[#1B1A17]'
                      : 'fill-emerald-500 dark:fill-emerald-400 text-emerald-500 dark:text-emerald-400'
                    : ''
                }`}
              />
              <span>{toArabicIndic(ayahNum)}</span>
            </button>
          );
        })}
      </div>

      {/* Main Focal Ayah & Listen/Repeat Circle */}
      {isLoadingSurah ? (
        <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full border-3 border-[#D9B45A] border-t-transparent animate-spin" />
          <p className="text-sm text-[#4B4539] dark:text-slate-300 font-semibold">جارٍ تجهيز درس الحفظ…</p>
        </div>
      ) : surahLoadError || !activeAyah ? (
        <div className="rounded-3xl bg-rose-50 dark:bg-rose-950/25 border border-rose-300 dark:border-rose-500/35 p-10 text-center flex flex-col items-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 dark:text-rose-400" />
          <p className="text-sm text-rose-900 dark:text-rose-100">{surahLoadError || 'تعذر العثور على الآيات'}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#1F3A6E] text-[#F6EFDD] font-bold text-sm flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      ) : (
        <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 dark:border-[#D9B45A]/30 p-5 sm:p-8 shadow-2xl space-y-7">
          {/* Quiet Ayah Header Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#4B4539] dark:text-slate-300 border-b border-[#D9B45A]/20 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-[#8A6418] dark:text-[#D9B45A] font-bold">سورة {surahMeta.name}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                الآية {toArabicIndic(activeAyah.numberInSurah)} من {toArabicIndic(currentWird.endAyah)}
              </span>
              <span aria-hidden="true">·</span>
              <span>القارئ: {selectedReciter.name}</span>
            </div>

            <div className="flex items-center gap-2 font-bold">
              {isCurrentAyahMastered && (
                <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-emerald-500 dark:fill-emerald-400 text-emerald-500 dark:text-emerald-400" />
                  <span>نجمة مضيئة</span>
                </span>
              )}
              {isCurrentAyahRetryRequested && (
                <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <RotateCcw className="w-4 h-4" />
                  <span>لنكررها معاً يا بطل</span>
                </span>
              )}
            </div>
          </div>

          {/* Large Focused Ayah Display with Word-by-Word Highlight */}
          <div className="py-4 sm:py-6 px-3 sm:px-6 rounded-2xl bg-[#F6EFDD] text-[#1B1A17] text-center shadow-inner border border-[#D9B45A]/35">
            <p
              dir="rtl"
              className="font-quran text-3xl sm:text-5xl leading-[2.2] sm:leading-[2.3] select-none"
            >
              {activeAyahWords.map((word, idx) => {
                const isHighlighted = promptPhase === 'listening' && idx === activeWordIndex;
                const isVoiceMatched = kidVoiceMatchedSet.has(idx);
                return (
                  <React.Fragment key={`${activeAyah.numberInSurah}-w-${idx}`}>
                    <span
                      className={`inline-block px-1 rounded-lg transition-colors duration-150 ${
                        isVoiceMatched
                          ? 'bg-emerald-300/75 text-[#0b291d]'
                          : isHighlighted
                          ? 'bg-[#D9B45A]/45 text-[#1B1A17]'
                          : ''
                      }`}
                    >
                      {word}
                    </span>{' '}
                  </React.Fragment>
                );
              })}
              <span className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-[#D9B45A] text-base sm:text-xl font-bold text-[#1F3A6E] align-middle mx-1 tabular-nums">
                {toArabicIndic(activeAyah.numberInSurah)}
              </span>
            </p>
          </div>

          {/* Interactive Central Listen -> Repeat Stage */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-xs sm:text-sm font-bold text-[#4B4539] dark:text-slate-300 tabular-nums">
              الدورة {toArabicIndic(currentCycle)} من {toArabicIndic(currentWird.repeatCount)}
            </div>

            <button
              type="button"
              onClick={handleTogglePrimaryPrompt}
              className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full border-4 flex flex-col items-center justify-center gap-2 text-center p-4 shadow-2xl transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9B45A] ${
                promptPhase === 'listening'
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
                  : promptPhase === 'repeating'
                  ? 'bg-sky-950/90 border-sky-400 text-sky-100'
                  : promptPhase === 'celebrating'
                  ? 'bg-[#D9B45A] border-[#F6EFDD] text-[#1B1A17]'
                  : 'bg-[#1F3A6E] hover:bg-[#2E5499] border-[#D9B45A] text-[#F6EFDD]'
              }`}
            >
              {promptPhase === 'listening' && (
                <>
                  <Headphones className="w-12 h-12 text-emerald-300" />
                  <span className="text-base sm:text-lg font-bold">استمع جيداً</span>
                  <span className="text-xs text-emerald-200 tabular-nums">
                    {toArabicIndic(Math.round(listenProgressRatio * 100))}٪ · اضغط للإيقاف
                  </span>
                </>
              )}

              {promptPhase === 'repeating' && (
                <>
                  <Mic className="w-12 h-12 text-sky-300" />
                  <span className="text-base sm:text-lg font-bold">دورك الآن… ردِّد</span>
                  <span className="text-sm font-bold text-sky-200 tabular-nums">
                    {toArabicIndic(repeatCountdownSec)} ثانية ({toArabicIndic(Math.round(repeatProgressRatio * 100))}٪)
                  </span>
                </>
              )}

              {promptPhase === 'celebrating' && (
                <>
                  <Sparkles className="w-12 h-12 text-[#1B1A17]" />
                  <span className="text-lg font-bold">أحسنت يا بطل!</span>
                  <span className="text-xs font-semibold">اضغط لإعادة التدريب</span>
                </>
              )}

              {promptPhase === 'idle' && (
                <>
                  <Play className="w-12 h-12 text-[#D9B45A] fill-[#D9B45A]" />
                  <span className="text-base sm:text-lg font-bold">ابدأ التلقين</span>
                  <span className="text-xs text-slate-200">استماع وترديد آلي</span>
                </>
              )}
            </button>

            {promptPhase === 'repeating' && (
              <button
                type="button"
                onClick={handleFinishRepeatTurnNow}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-100 dark:bg-sky-500/20 hover:bg-sky-200 dark:hover:bg-sky-500/30 border border-sky-400/50 text-sky-900 dark:text-sky-100 text-xs font-bold cursor-pointer transition-colors"
              >
                انتهيت من الترديد الآن ← التالي
              </button>
            )}

            {statusBanner && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-100 text-xs sm:text-sm font-bold flex items-center gap-2 text-center">
                <Star className="w-4 h-4 text-[#D9B45A] fill-[#D9B45A] shrink-0" />
                <span>{statusBanner}</span>
              </div>
            )}

            {audioError && (
              <div className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span>{audioError}</span>
              </div>
            )}
          </div>

          {/* Live Microphone Recording Meter Banner */}
          {isRecordingVoice && (
            <div className="flex items-center justify-center">
              <div className="px-4 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40">
                <AudioLevelMeter
                  isActive={isRecordingVoice}
                  mediaStream={activeChildStream}
                  tone="rose"
                  label="أسجّل صوتك يا بطل... اقرأ الآن"
                />
              </div>
            </div>
          )}

          {/* Smart Voice Check Feedback Strip for Child */}
          {(isKidVoiceChecking || kidVoiceAccuracy !== null) && (
            <div className="rounded-2xl bg-white dark:bg-slate-950/85 border border-emerald-400 dark:border-emerald-500/35 px-4 py-3 text-xs sm:text-sm space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                  <span>
                    {isKidVoiceChecking
                      ? 'أنا أسمعك الآن يا بطل… اقرأ الآية بصوت جميل!'
                      : 'نتيجة تسميعك الآن:'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {isKidVoiceChecking && (
                    <AudioLevelMeter
                      isActive={isKidVoiceChecking}
                      activitySeed={kidVoiceTranscript.length}
                      tone="gold"
                    />
                  )}
                  {kidVoiceAccuracy !== null && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-400 dark:border-emerald-500/45 text-emerald-800 dark:text-emerald-200 font-bold">
                      الدقة: {toArabicIndic(kidVoiceAccuracy)}٪
                    </span>
                  )}
                </div>
              </div>
              {kidVoiceTranscript && (
                <p className="text-xs text-[#4B4539] dark:text-slate-300 leading-relaxed">
                  سمعت منك: <strong className="text-[#1B1A17] dark:text-[#F6EFDD]">{kidVoiceTranscript}</strong>
                </p>
              )}
            </div>
          )}

          {/* Large Child-Friendly Bottom Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800/80">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => activeAyah && handleSelectAyah(activeAyah.numberInSurah - 1)}
              className="min-h-[54px] px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2] dark:hover:bg-slate-900 disabled:opacity-35 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>السابقة</span>
            </button>

            <button
              type="button"
              onClick={handleRestartAyah}
              className="min-h-[54px] px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2] dark:hover:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>إعادة الآية</span>
            </button>

            {isVoiceCheckSupported && (
              <button
                type="button"
                onClick={handleToggleKidVoiceTest}
                className={`min-h-[54px] px-4 py-3 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isKidVoiceChecking
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 border-emerald-400 dark:border-emerald-500/45 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                {isKidVoiceChecking ? <Square className="w-5 h-5" /> : <Sparkles className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A]" />}
                <span>{isKidVoiceChecking ? 'إيقاف السماع' : 'سمِّع لي الآن'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleVoiceRecord}
              className={`min-h-[54px] px-4 py-3 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                isRecordingVoice
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-[#1F3A6E] hover:bg-[#2E5499] border-[#648CD4]/45 text-[#F6EFDD]'
              }`}
            >
              {isRecordingVoice ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#D9B45A]" />}
              <span>{isRecordingVoice ? 'إيقاف التسجيل' : 'سجِّل صوتك'}</span>
            </button>

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => activeAyah && handleSelectAyah(activeAyah.numberInSurah + 1)}
              className="min-h-[54px] px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 hover:bg-[#F3E9D2] dark:hover:bg-slate-900 disabled:opacity-35 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>التالية</span>
              <ChevronLeft className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A]" />
            </button>
          </div>

          {/* Recorded Practice Clip Playback & Remote Submission */}
          {(recordedAudioUrl || micError || submissionNotice) && (
            <div className="pt-1 space-y-2.5">
              {micError && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{micError}</span>
                </div>
              )}

              {recordedAudioUrl && (
                <div className="p-3.5 rounded-2xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#648CD4]/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-[#F6EFDD] font-semibold">
                    تسجيلك الصوتي: <span className="text-[#D9B45A]">{recordedAyahLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlayRecordedVoice}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#D9B45A] text-[#1B1A17] font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      {isPlayingRecorded ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{isPlayingRecorded ? 'إيقاف الصوت' : 'اسمع صوتك'}</span>
                    </button>

                    {activeProfile.remoteLink ? (
                      <button
                        type="button"
                        onClick={handleSendRecordedSubmission}
                        disabled={isSendingSubmission}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSendingSubmission ? 'جارٍ الإرسال…' : 'إرسال التسميع للمشرف'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setJoinChildNameInput(activeProfile.name);
                          setIsJoinCircleModalOpen(true);
                        }}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 dark:bg-slate-900 hover:bg-white/20 dark:hover:bg-slate-800 border border-[#648CD4]/45 text-[#F6EFDD] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                        <span>ربط بحلقة لإرسال التسميع</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {submissionNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-100 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{submissionNotice}</span>
                </div>
              )}
            </div>
          )}

          {/* Latest Supervisor Review & Voice Feedback Card for Child */}
          {activeProfile.remoteLink && kidRemoteSubmissions.length > 0 && (() => {
            const latestSub = kidRemoteSubmissions[0];
            const subSurah = SURAHS_LIST.find((s) => s.number === latestSub.surahNumber);
            const isPlayingSupAudio = playingRemoteAudioId === `sup-${latestSub.id}`;
            return (
              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  latestSub.status === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-500/40'
                    : latestSub.status === 'retry'
                    ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-400 dark:border-amber-500/40'
                    : 'bg-white dark:bg-slate-950/80 border-[#D9B45A]/25 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                    {latestSub.status === 'approved' ? (
                      <Star className="w-4 h-4 text-[#D9B45A] fill-[#D9B45A]" />
                    ) : latestSub.status === 'retry' ? (
                      <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                    ) : (
                      <Inbox className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                    )}
                    <span>
                      {latestSub.status === 'approved'
                        ? `ما شاء الله! اعتمد المشرف تسميعك (سورة ${subSurah?.name || ''} · الآية ${toArabicIndic(latestSub.ayahNumber)})`
                        : latestSub.status === 'retry'
                        ? `توجيه لطيف من المشرف (سورة ${subSurah?.name || ''} · الآية ${toArabicIndic(latestSub.ayahNumber)})`
                        : `تم إرسال تسميع سورة ${subSurah?.name || ''} (الآية ${toArabicIndic(latestSub.ayahNumber)}) وبانتظار المشرف`}
                    </span>
                  </div>

                  {latestSub.supervisorAudioDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePlayRemoteAudioUrl(
                          `sup-${latestSub.id}`,
                          latestSub.supervisorAudioDataUrl!
                        )
                      }
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#D9B45A] text-[#1B1A17] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {isPlayingSupAudio ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlayingSupAudio ? 'إيقاف رسالة المشرف' : 'اسمع تشجيع المشرف'}</span>
                    </button>
                  )}
                </div>

                {latestSub.supervisorFeedbackText && (
                  <p className="text-xs sm:text-sm text-[#4B4539] dark:text-slate-200 leading-relaxed">
                    «{latestSub.supervisorFeedbackText}»
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Kid Garden & Surah Badges Showcase */}
      <div className="rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/30 dark:border-slate-800 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400/50 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
            <Sprout className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-[#1B1A17] dark:text-[#F6EFDD]">حديقة الحفظ: {gardenStage.stageName}</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold tabular-nums">
                المستوى {toArabicIndic(gardenStage.level)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#EFE7D4] dark:bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
                style={{ width: `${gardenStage.progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-[#6B6251] dark:text-slate-400 tabular-nums">
              {toArabicIndic(activeProfile.stars)} نجمة مكتسبة · الهدف التالي {toArabicIndic(gardenStage.nextMilestone)} نجمة
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:border-r sm:border-[#D9B45A]/20 dark:sm:border-slate-800 sm:pr-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#D9B45A]/35 flex items-center justify-center text-[#D9B45A] shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs sm:text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums">
              أوسمة السور المكتملة ({toArabicIndic(activeProfile.completedSurahs.length)})
            </div>
            {activeProfile.completedSurahs.length === 0 ? (
              <p className="text-[11px] text-[#6B6251] dark:text-slate-400">
                أكمل جميع آيات السورة لتضيء هنا بوسام ذهبي خاص بك
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 text-xs text-[#8A6418] dark:text-[#D9B45A] font-semibold">
                {activeProfile.completedSurahs.map((sNum) => {
                  const s = SURAHS_LIST.find((x) => x.number === sNum);
                  return (
                    <span key={sNum}>
                      وسام {s?.name || sNum}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Parent Gate Math Modal */}
      {isGateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="بوابة المشرف"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <form
            onSubmit={handleSubmitGate}
            className="w-full max-w-sm rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/45 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>بوابة المشرف وولي الأمر</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGateModalOpen(false)}
                aria-label="إغلاق"
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#F3E9D2] dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4B4539] dark:text-slate-300 leading-relaxed">
              للدخول إلى إعدادات الورد واعتماد حفظ الطفل، يرجى الإجابة عن السؤال التالي:
            </p>

            <div className="p-4 rounded-xl bg-[#1F3A6E] dark:bg-[#142038] border border-[#648CD4]/45 dark:border-slate-700 text-center text-lg font-bold text-[#F6EFDD]">
              {gateChallenge.questionText}
            </div>

            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={gateInput}
              onChange={(e) => {
                setGateInput(e.target.value);
                setGateError(null);
              }}
              placeholder="اكتب الناتج بالأرقام..."
              aria-label="إجابة سؤال المشرف"
              className="w-full min-h-[46px] px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700 text-center text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums outline-none focus:border-[#D9B45A]"
            />

            {gateError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center font-medium">{gateError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGateModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] rounded-xl bg-[#D9B45A] hover:bg-[#c9a349] text-[#1B1A17] text-xs font-bold cursor-pointer"
              >
                دخول اللوحة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Join Remote Circle Modal (6-Digit Code, Zero Email Friction) */}
      {isJoinCircleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="انضمام لحلقة مشرف بكود"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <form
            onSubmit={handleJoinCircleSubmit}
            className="w-full max-w-sm rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/45 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] font-bold text-sm">
                <Link2 className="w-4 h-4" />
                <span>انضمام لحلقة المشرف</span>
              </div>
              <button
                type="button"
                onClick={() => setIsJoinCircleModalOpen(false)}
                aria-label="إغلاق"
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#F3E9D2] dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4B4539] dark:text-slate-300 leading-relaxed">
              أدخل كود الحلقة المكون من ٦ أرقام الذي أرسله لك المعلم أو ولي الأمر ليصلك الورد اليومي وتستطيع إرسال تسميعك الصوتي.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="kid-join-code" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                كود الحلقة (٦ أرقام)
              </label>
              <input
                id="kid-join-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={joinCircleCodeInput}
                onChange={(e) => {
                  setJoinCircleCodeInput(e.target.value);
                  setJoinError(null);
                }}
                placeholder="مثال: 482910"
                className="w-full min-h-[46px] px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700 text-center text-lg font-bold tracking-widest text-[#8A6418] dark:text-[#D9B45A] tabular-nums outline-none focus:border-[#D9B45A]"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="kid-join-name" className="block text-xs font-semibold text-[#4B4539] dark:text-slate-300">
                اسم البطل في الحلقة
              </label>
              <input
                id="kid-join-name"
                type="text"
                value={joinChildNameInput}
                onChange={(e) => setJoinChildNameInput(e.target.value)}
                placeholder="اسم الطفل..."
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/35 dark:border-slate-700 text-sm text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
              />
            </div>

            {joinError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center font-medium">{joinError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsJoinCircleModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isJoiningCircle}
                className="flex-1 min-h-[44px] rounded-xl bg-[#D9B45A] hover:bg-[#c9a349] disabled:opacity-50 text-[#1B1A17] text-xs font-bold cursor-pointer"
              >
                {isJoiningCircle ? 'جارٍ الربط…' : 'انضمام الآن'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
