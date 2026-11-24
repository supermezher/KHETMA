import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, RotateCcw, Clock, Download, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, EyeOff, X } from 'lucide-react';
import { Reciter, RECITERS_LIST, getAyahAudioUrl, getReciterDisplayName, getReciterDisplayStyle } from '../data/reciters';
import { SURAHS_LIST, getSurahDisplayName } from '../data/quranMetadata';
import { isSurahCached, cacheSurahAudio, getCachedAudioBlobUrl } from '../utils/audioOfflineCache';
import { toArabicIndic } from './khatma/KhatmaRing';
import { AppLanguage, formatLocalizedDigits, useLanguage } from '../utils/i18n';

interface AudioPlayerBarProps {
  surahNumber: number;
  surahName: string;
  totalAyahs: number;
  currentAyahNumber: number;
  onAyahChange: (ayahNum: number) => void;
  isPlaying: boolean;
  onPlayPauseToggle: (playing: boolean) => void;
  isSmartScrollEnabled: boolean;
  onToggleSmartScroll: () => void;
  onPlaybackProgress?: (currentTime: number, duration: number, playbackSpeed?: number) => void;
  onAyahComplete?: (ayahNumber: number, durationSeconds: number) => void;
  isFullScreen?: boolean;
  isVisible?: boolean;
  onHideBar?: () => void;
  selectedReciter?: Reciter;
  onSelectReciter?: (reciter: Reciter) => void;
  playTriggerNonce?: number;
  stopAfterAyahMode?: boolean;
  memorizationRepeatTarget?: 1 | 2 | 3 | 'loop';
  onMemorizationRepeatChange?: (currentCount: number) => void;
  onPlaybackCycleComplete?: (ayahNumber: number) => void;
  mushafSheetMode?: boolean;
  isMushafSheetOpen?: boolean;
  onCloseMushafSheet?: () => void;
  isChromeHidden?: boolean;
  onAdvanceNextSurah?: (nextSurahNumber: number) => void;
}

export interface AudioEndTransitionInput {
  stopAfterAyahMode: boolean;
  memorizationRepeatTarget: 1 | 2 | 3 | 'loop';
  repeatMode: 'none' | '2-times' | '3-times' | 'loop';
  currentRepeatCount: number;
  currentAyahNumber: number;
  totalAyahs: number;
  surahNumber?: number;
  canAdvanceNextSurah?: boolean;
}

export type AudioEndAction =
  | { type: 'replay-same-ayah'; nextRepeatCount: number }
  | { type: 'advance-next-ayah'; nextAyahNumber: number }
  | { type: 'advance-next-surah'; nextSurahNumber: number }
  | { type: 'stop' };

export function resolveAudioEndedTransition(input: AudioEndTransitionInput): AudioEndAction {
  const {
    stopAfterAyahMode,
    memorizationRepeatTarget,
    repeatMode,
    currentRepeatCount,
    currentAyahNumber,
    totalAyahs,
    surahNumber,
    canAdvanceNextSurah = false,
  } = input;

  if (stopAfterAyahMode) {
    if (memorizationRepeatTarget === 'loop') {
      return { type: 'replay-same-ayah', nextRepeatCount: currentRepeatCount };
    }
    if (currentRepeatCount < memorizationRepeatTarget) {
      return { type: 'replay-same-ayah', nextRepeatCount: currentRepeatCount + 1 };
    }
    return { type: 'stop' };
  }

  if (repeatMode === 'loop') {
    return { type: 'replay-same-ayah', nextRepeatCount: currentRepeatCount };
  }

  if (repeatMode === '2-times' || repeatMode === '3-times') {
    const target = repeatMode === '2-times' ? 2 : 3;
    if (currentRepeatCount < target) {
      return { type: 'replay-same-ayah', nextRepeatCount: currentRepeatCount + 1 };
    }
  }

  if (currentAyahNumber < totalAyahs) {
    return { type: 'advance-next-ayah', nextAyahNumber: currentAyahNumber + 1 };
  }

  if (
    canAdvanceNextSurah &&
    typeof surahNumber === 'number' &&
    surahNumber >= 1 &&
    surahNumber < 114
  ) {
    return { type: 'advance-next-surah', nextSurahNumber: surahNumber + 1 };
  }

  return { type: 'stop' };
}

export interface MediaSessionMetadataPayload {
  title: string;
  artist: string;
  album: string;
  artwork: Array<{ src: string; sizes: string; type: string }>;
}

export function buildMediaSessionMetadataPayload(
  surahName: string,
  ayahNumber: number,
  reciterName: string,
  lang: AppLanguage = 'ar'
): MediaSessionMetadataPayload {
  const safeAyah = Math.max(1, Math.floor(Number.isFinite(ayahNumber) ? ayahNumber : 1));
  if (lang === 'en') {
    const safeSurah = (surahName || '').trim() || 'Noble Quran';
    const safeReciter = (reciterName || '').trim() || 'Reciter';
    return {
      title: `Surah ${safeSurah} · Ayah ${safeAyah}`,
      artist: safeReciter,
      album: "Bayan — The Noble Mus'haf",
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    };
  }
  const safeSurah = (surahName || '').trim() || 'القرآن الكريم';
  const safeReciter = (reciterName || '').trim() || 'الشيخ';
  return {
    title: `سورة ${safeSurah} · الآية ${toArabicIndic(safeAyah)}`,
    artist: safeReciter,
    album: 'بيان — المصحف الشريف',
    artwork: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  surahNumber,
  surahName,
  totalAyahs,
  currentAyahNumber,
  onAyahChange,
  isPlaying,
  onPlayPauseToggle,
  isSmartScrollEnabled,
  onToggleSmartScroll,
  onPlaybackProgress,
  onAyahComplete,
  isFullScreen = false,
  isVisible = true,
  onHideBar,
  selectedReciter: propSelectedReciter,
  onSelectReciter: propOnSelectReciter,
  playTriggerNonce = 0,
  stopAfterAyahMode = false,
  memorizationRepeatTarget = 1,
  onMemorizationRepeatChange,
  onPlaybackCycleComplete,
  mushafSheetMode = false,
  isMushafSheetOpen = false,
  onCloseMushafSheet,
  isChromeHidden = false,
  onAdvanceNextSurah,
}) => {
  const { lang, dir, t } = useLanguage();
  const [internalReciter, setInternalReciter] = useState<Reciter>(RECITERS_LIST[0]);
  const selectedReciter = propSelectedReciter || internalReciter;
  const setSelectedReciter = propOnSelectReciter || setInternalReciter;
  const surahMeta = SURAHS_LIST[surahNumber - 1];
  const displaySurahName = surahMeta ? getSurahDisplayName(surahMeta, lang) : surahName;
  const displayReciterName = getReciterDisplayName(selectedReciter, lang);
  const displayReciterStyle = getReciterDisplayStyle(selectedReciter, lang);
  const fmt = (n: number | string) => formatLocalizedDigits(n, lang);
  const PrevIcon = dir === 'rtl' ? SkipForward : SkipBack;
  const NextIcon = dir === 'rtl' ? SkipBack : SkipForward;

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [repeatMode, setRepeatMode] = useState<'none' | '2-times' | '3-times' | 'loop'>('none');
  const [repeatCounter, setRepeatCounter] = useState<number>(1);
  const [khatmaTimerMinutes, setKhatmaTimerMinutes] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [resolvedAudioSource, setResolvedAudioSource] = useState<{ forUrl: string; src: string } | null>(null);
  const [isMinimizedInFullScreen, setIsMinimizedInFullScreen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const repeatCounterRef = useRef<number>(1);
  const lastHandledNonceRef = useRef<number>(playTriggerNonce);
  const stopAfterAyahModeRef = useRef<boolean>(stopAfterAyahMode);
  stopAfterAyahModeRef.current = stopAfterAyahMode;
  const memRepeatTargetRef = useRef<1 | 2 | 3 | 'loop'>(memorizationRepeatTarget);
  memRepeatTargetRef.current = memorizationRepeatTarget;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const onPlaybackProgressRef = useRef(onPlaybackProgress);
  onPlaybackProgressRef.current = onPlaybackProgress;
  const currentAyahRef = useRef<number>(currentAyahNumber);
  currentAyahRef.current = currentAyahNumber;
  const totalAyahsRef = useRef<number>(totalAyahs);
  totalAyahsRef.current = totalAyahs;
  const onAyahChangeRef = useRef(onAyahChange);
  onAyahChangeRef.current = onAyahChange;
  const onPlayPauseToggleRef = useRef(onPlayPauseToggle);
  onPlayPauseToggleRef.current = onPlayPauseToggle;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const [audioProgress, setAudioProgress] = useState(0);

  const syncMediaSessionPositionState = () => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== 'function') return;
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rate = playbackSpeedRef.current > 0 ? playbackSpeedRef.current : 1;
    const pos = Math.max(0, Math.min(audio.duration, Number.isFinite(audio.currentTime) ? audio.currentTime : 0));
    try {
      ms.setPositionState({
        duration: audio.duration,
        playbackRate: rate,
        position: pos,
      });
    } catch {
      // Some browsers reject setPositionState on unsupported edge states
    }
  };

  // Audio source URL
  const audioUrl = getAyahAudioUrl(selectedReciter.serverKey, surahNumber, currentAyahNumber);
  const activeAudioSrc = resolvedAudioSource?.forUrl === audioUrl ? resolvedAudioSource.src : undefined;

  // Check if current surah is already cached offline
  useEffect(() => {
    let isMounted = true;
    setDownloadError(null);
    isSurahCached(selectedReciter.serverKey, surahNumber, totalAyahs).then((cached) => {
      if (isMounted) setIsDownloaded(cached);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedReciter.serverKey, surahNumber, totalAyahs]);

  // Attempt to load from offline cache first before setting <audio src> (avoids online network error before cache resolves)
  useEffect(() => {
    let isMounted = true;
    getCachedAudioBlobUrl(audioUrl)
      .then((blobUrl) => {
        if (!isMounted) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }
        if (activeBlobUrlRef.current && activeBlobUrlRef.current !== blobUrl) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        activeBlobUrlRef.current = blobUrl;
        setResolvedAudioSource({ forUrl: audioUrl, src: blobUrl || audioUrl });
      })
      .catch(() => {
        if (isMounted) {
          setResolvedAudioSource({ forUrl: audioUrl, src: audioUrl });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Handle Play/Pause and explicit replay requests on the same ayah
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const isExplicitReplay = playTriggerNonce !== lastHandledNonceRef.current;
    if (isExplicitReplay) {
      lastHandledNonceRef.current = playTriggerNonce;
      repeatCounterRef.current = 1;
      setRepeatCounter(1);
      onMemorizationRepeatChange?.(1);
      audio.currentTime = 0;
    }

    if (isPlaying) {
      setAudioError(null);
      if (!activeAudioSrc) return;
      audio.playbackRate = playbackSpeed;
      if (audio.paused || isExplicitReplay) {
        audio.play().catch((err) => {
          if (err?.name === 'AbortError') return;
          console.warn('Audio play prevented:', err);
          setAudioError(
            err?.name === 'NotAllowedError'
              ? t(
                  'اضغط إعادة المحاولة لتفعيل الصوت في المتصفح',
                  'Tap retry to allow audio playback in your browser'
                )
              : t(
                  'تعذر تشغيل التلاوة الصوتية، يرجى التحقق من الاتصال',
                  'Could not play recitation, please check your connection'
                )
          );
          onPlayPauseToggle(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, activeAudioSrc, playbackSpeed, playTriggerNonce]);

  // 60fps playback progress updates while playing so word highlighting glides smoothly
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastReportedTime = -1;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        const cur = audio.currentTime;
        const dur = audio.duration;
        if (Math.abs(cur - lastReportedTime) >= 0.012) {
          lastReportedTime = cur;
          setAudioProgress((cur / dur) * 100);
          onPlaybackProgressRef.current?.(cur, dur, playbackSpeedRef.current);
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, activeAudioSrc]);

  // Khatma sleep timer countdown
  useEffect(() => {
    if (khatmaTimerMinutes <= 0) {
      setTimeRemaining(0);
      return;
    }
    setTimeRemaining(khatmaTimerMinutes * 60);

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [khatmaTimerMinutes]);

  // When sleep timer expires, pause playback cleanly without setState side-effects
  useEffect(() => {
    if (khatmaTimerMinutes > 0 && timeRemaining === 0) {
      onPlayPauseToggle(false);
      setKhatmaTimerMinutes(0);
    }
  }, [timeRemaining, khatmaTimerMinutes, onPlayPauseToggle]);

  // Reset repeat counter and clear stale errors whenever ayah or surah changes
  useEffect(() => {
    repeatCounterRef.current = 1;
    setRepeatCounter(1);
    setAudioError(null);
    onMemorizationRepeatChange?.(1);
  }, [currentAyahNumber, surahNumber]);

  // System Media Session metadata (lock screen, notification center, Bluetooth displays)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof MediaMetadata === 'undefined') return;
    try {
      const payload = buildMediaSessionMetadataPayload(
        displaySurahName,
        currentAyahNumber,
        displayReciterName,
        lang
      );
      navigator.mediaSession.metadata = new MediaMetadata(payload);
    } catch {
      // Ignore MediaMetadata errors on older environments
    }
  }, [displaySurahName, currentAyahNumber, displayReciterName, lang]);

  // Sync Media Session playbackState & positionState with playing/speed changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // Ignore if read-only
    }
    syncMediaSessionPositionState();
  }, [isPlaying, playbackSpeed, activeAudioSrc]);

  // Register Media Session hardware/lock-screen action handlers once
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setActionHandler !== 'function') return;

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => onPlayPauseToggleRef.current(true)],
      ['pause', () => onPlayPauseToggleRef.current(false)],
      [
        'previoustrack',
        () => {
          const prev = Math.max(1, currentAyahRef.current - 1);
          onAyahChangeRef.current(prev);
        },
      ],
      [
        'nexttrack',
        () => {
          const next = Math.min(totalAyahsRef.current, currentAyahRef.current + 1);
          onAyahChangeRef.current(next);
        },
      ],
      [
        'seekto',
        (details) => {
          const audio = audioRef.current;
          if (!audio || typeof details.seekTime !== 'number' || !Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
          }
          audio.currentTime = Math.max(0, Math.min(audio.duration, details.seekTime));
          syncMediaSessionPositionState();
        },
      ],
      [
        'seekbackward',
        (details) => {
          const audio = audioRef.current;
          if (!audio) return;
          const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
          audio.currentTime = Math.max(0, audio.currentTime - offset);
          syncMediaSessionPositionState();
        },
      ],
      [
        'seekforward',
        (details) => {
          const audio = audioRef.current;
          if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
          audio.currentTime = Math.min(audio.duration, audio.currentTime + offset);
          syncMediaSessionPositionState();
        },
      ],
      [
        'stop',
        () => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          onPlayPauseToggleRef.current(false);
          syncMediaSessionPositionState();
        },
      ],
    ];

    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Skip unsupported actions cleanly
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  const handleAudioEnded = () => {
    const finishedDuration = audioRef.current?.duration || 0;
    onAyahComplete?.(currentAyahNumber, Number.isFinite(finishedDuration) ? finishedDuration : 0);

    const action = resolveAudioEndedTransition({
      stopAfterAyahMode: stopAfterAyahModeRef.current,
      memorizationRepeatTarget: memRepeatTargetRef.current,
      repeatMode,
      currentRepeatCount: repeatCounterRef.current,
      currentAyahNumber,
      totalAyahs,
      surahNumber,
      canAdvanceNextSurah: Boolean(onAdvanceNextSurah),
    });

    if (action.type === 'replay-same-ayah') {
      repeatCounterRef.current = action.nextRepeatCount;
      setRepeatCounter(action.nextRepeatCount);
      if (stopAfterAyahModeRef.current) {
        onMemorizationRepeatChange?.(action.nextRepeatCount);
      }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.play().catch((err) => {
          if (err?.name !== 'AbortError') {
            setAudioError(
              t('تعذر استئناف التلاوة تلقائياً، اضغط إعادة المحاولة', 'Could not continue playback, tap retry')
            );
            onPlayPauseToggle(false);
          }
        });
      }
      return;
    }

    repeatCounterRef.current = 1;
    setRepeatCounter(1);
    if (stopAfterAyahModeRef.current) {
      onMemorizationRepeatChange?.(1);
    }

    if (action.type === 'advance-next-ayah') {
      onAyahChange(action.nextAyahNumber);
    } else if (action.type === 'advance-next-surah') {
      onAdvanceNextSurah?.(action.nextSurahNumber);
    } else {
      onPlayPauseToggle(false);
      onPlaybackCycleComplete?.(currentAyahNumber);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 1;
      setAudioProgress((cur / dur) * 100);
      onPlaybackProgress?.(cur, dur, playbackSpeedRef.current);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration || !Number.isFinite(audioRef.current.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    audioRef.current.currentTime = percent * audioRef.current.duration;
    syncMediaSessionPositionState();
  };

  const handleDownloadSurah = async () => {
    if (isDownloading || isDownloaded) return;
    try {
      setIsDownloading(true);
      setDownloadError(null);
      setDownloadProgress({ completed: 0, total: totalAyahs });
      await cacheSurahAudio(
        selectedReciter.serverKey,
        surahNumber,
        totalAyahs,
        (completed, total) => {
          setDownloadProgress({ completed, total });
        }
      );
      setIsDownloaded(true);
      const blobUrl = await getCachedAudioBlobUrl(audioUrl);
      if (blobUrl) {
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        activeBlobUrlRef.current = blobUrl;
        setResolvedAudioSource({ forUrl: audioUrl, src: blobUrl });
      }
    } catch (err: any) {
      console.error('Audio download caching failed:', err);
      setDownloadError(err?.message || t('تعذر تحميل التلاوات', 'Failed to download audio'));
      setIsDownloaded(false);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleRetryPlayback = () => {
    setAudioError(null);
    if (audioRef.current && activeAudioSrc) {
      audioRef.current.playbackRate = playbackSpeedRef.current;
      audioRef.current.play().catch(() => {});
    }
    onPlayPauseToggle(true);
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const srcAttr = e.currentTarget.getAttribute('src');
    if (!srcAttr) return;
    if (activeAudioSrc?.startsWith('blob:') && audioUrl) {
      setResolvedAudioSource({ forUrl: audioUrl, src: audioUrl });
      return;
    }
    console.warn('Audio playback/stream error occurred:', e);
    if (isPlayingRef.current) {
      setAudioError(
        t('تعذر تحميل ملف التلاوة، يرجى التحقق من اتصال الإنترنت', 'Unable to load recitation audio, check your connection')
      );
    }
    onPlayPauseToggle(false);
  };

  const syncPlaybackRate = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    e.currentTarget.playbackRate = playbackSpeedRef.current;
    setAudioError(null);
    syncMediaSessionPositionState();
  };

  return (
    <>
      {/* Hidden Persistent Audio Element - Always mounted so recitation never cuts off */}
      <audio
        ref={audioRef}
        src={activeAudioSrc}
        onLoadedMetadata={syncPlaybackRate}
        onPlay={syncPlaybackRate}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onError={handleAudioError}
      />

      {/* Visible Recitation Error Toast with Direct User-Gesture Retry */}
      {audioError && !isChromeHidden && (
        <div
          role="alert"
          className={`fixed left-1/2 -translate-x-1/2 z-[55] w-[min(94vw,460px)] px-3.5 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2 text-xs bg-rose-50/95 dark:bg-rose-950/95 border-rose-500/45 text-rose-900 dark:text-rose-100 ${
            mushafSheetMode ? 'bottom-[5.45rem]' : isFullScreen ? 'bottom-20' : 'bottom-[9.2rem] lg:bottom-20'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="truncate font-semibold">{audioError}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRetryPlayback}
              className="min-h-[30px] px-2.5 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold text-[11px] cursor-pointer whitespace-nowrap"
            >
              {t('إعادة المحاولة', 'Retry')}
            </button>
            <button
              type="button"
              onClick={() => setAudioError(null)}
              aria-label={t('إغلاق التنبيه', 'Dismiss error')}
              className="min-w-[28px] min-h-[28px] rounded-lg hover:bg-rose-200/50 dark:hover:bg-rose-900/50 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MUSHAF FLOATING GLASS AUDIO SHEET (Docked cleanly above Mushaf 5-button dock) */}
      {mushafSheetMode ? (
        isMushafSheetOpen && !isChromeHidden ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
              onClick={() => onCloseMushafSheet?.()}
            />
            <div
              role="dialog"
              aria-label={t('أدوات التلاوة والصوت', 'Recitation & Audio Controls')}
              className="fixed bottom-[5.45rem] left-1/2 -translate-x-1/2 z-[45] w-[min(94vw,520px)] rounded-3xl bg-[#FBF7EE]/95 dark:bg-[#10161f]/95 border border-[#D9B45A]/35 shadow-2xl backdrop-blur-xl p-3.5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              {/* Scrubbable Audio Progress Line */}
              <div
                dir="ltr"
                onClick={handleSeek}
                className="w-full h-1.5 bg-[#E5DAC0] dark:bg-slate-800 hover:h-2 rounded-full cursor-pointer transition-all relative overflow-hidden"
                title={t('تقديم وتأخير التلاوة', 'Seek recitation')}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#1F3A6E] via-[#2E5499] to-[#D9B45A] rounded-full"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/55 border border-[#648CD4]/35 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A] shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] truncate">
                      {t(`سورة ${displaySurahName} · الآية ${fmt(currentAyahNumber)} / ${fmt(totalAyahs)}`, `Surah ${displaySurahName} · Ayah ${fmt(currentAyahNumber)} / ${fmt(totalAyahs)}`)}
                    </div>
                    <div className="text-[11px] text-[#5C5549] dark:text-slate-400 truncate">
                      {displayReciterName} · {displayReciterStyle}
                    </div>
                  </div>
                </div>
                {onCloseMushafSheet && (
                  <button
                    type="button"
                    onClick={onCloseMushafSheet}
                    aria-label={t('إغلاق أدوات التلاوة', 'Close audio controls')}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[#5C5549] dark:text-slate-400 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Transport + Reciter */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                    disabled={currentAyahNumber <= 1}
                    aria-label={t('الآية السابقة', 'Previous Ayah')}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 cursor-pointer"
                  >
                    <PrevIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlayPauseToggle(!isPlaying)}
                    aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                    className="w-11 h-11 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ms-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                    disabled={currentAyahNumber >= totalAyahs}
                    aria-label={t('الآية التالية', 'Next Ayah')}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-35 cursor-pointer"
                  >
                    <NextIcon className="w-4 h-4" />
                  </button>
                </div>

                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find((r) => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label={t('اختيار القارئ', 'Select reciter')}
                  className="min-h-[40px] flex-1 min-w-0 bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-700/80 rounded-xl text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] py-1.5 px-2.5 outline-none cursor-pointer"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getReciterDisplayName(r, lang)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repeat, Speed, Sync, Timer & Offline Cache */}
              <div className="pt-2.5 border-t border-[#D9B45A]/20 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (repeatMode === 'none') setRepeatMode('2-times');
                    else if (repeatMode === '2-times') setRepeatMode('3-times');
                    else if (repeatMode === '3-times') setRepeatMode('loop');
                    else setRepeatMode('none');
                  }}
                  className={`min-h-[36px] py-1 px-2.5 rounded-xl font-semibold border flex items-center gap-1 cursor-pointer ${
                    repeatMode !== 'none'
                      ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {repeatMode === 'none'
                      ? t('التكرار: بدون', 'Repeat: Off')
                      : repeatMode === '2-times'
                      ? t(`مرتان (${repeatCounter}/2)`, `2× (${repeatCounter}/2)`)
                      : repeatMode === '3-times'
                      ? t(`3 مرات (${repeatCounter}/3)`, `3× (${repeatCounter}/3)`)
                      : t('مستمر', 'Loop')}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  {[0.75, 1.0, 1.25].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`min-h-[36px] py-1 px-2.5 rounded-xl font-bold cursor-pointer ${
                        playbackSpeed === speed
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                          : 'bg-white dark:bg-slate-900 border border-[#D9B45A]/20 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onToggleSmartScroll}
                  className={`min-h-[36px] py-1 px-2.5 rounded-xl font-semibold border flex items-center gap-1 cursor-pointer ${
                    isSmartScrollEnabled
                      ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 border-[#648CD4]/50 text-[#F6EFDD] dark:text-[#D9B45A]'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('مزامنة التمرير', 'Auto-Sync')}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5C5549] dark:text-slate-400" />
                  <select
                    value={khatmaTimerMinutes}
                    onChange={(e) => setKhatmaTimerMinutes(Number(e.target.value))}
                    aria-label={t('مؤقت إيقاف الورد', 'Sleep timer')}
                    className="min-h-[36px] bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 rounded-xl text-[#1B1A17] dark:text-[#F6EFDD] py-1 px-2.5 outline-none cursor-pointer"
                  >
                    <option value={0}>{t('مؤقت النوم: بدون', 'Sleep Timer: Off')}</option>
                    <option value={15}>{t('١٥ دقيقة', '15 min')}</option>
                    <option value={30}>{t('٣٠ دقيقة', '30 min')}</option>
                    <option value={45}>{t('٤٥ دقيقة', '45 min')}</option>
                    <option value={60}>{t('ساعة كاملة', '1 hour')}</option>
                  </select>
                  {timeRemaining > 0 && (
                    <span className="text-[#8A6418] dark:text-[#D9B45A] font-bold tabular-nums">
                      ({fmt(Math.max(1, Math.ceil(timeRemaining / 60)))}{t('د', 'm')})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSurah}
                  disabled={isDownloaded || isDownloading}
                  className={`min-h-[36px] py-1 px-3 rounded-xl font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDownloaded
                      ? 'bg-[#1F3A6E] border-[#648CD4]/40 text-[#D9B45A]'
                      : downloadError
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-600 dark:text-rose-300'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200'
                  }`}
                >
                  {isDownloaded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                      <span>{t('محفوظة دون إنترنت', 'Saved Offline')}</span>
                    </>
                  ) : isDownloading ? (
                    <>
                      <Download className="w-3.5 h-3.5 animate-bounce text-[#D9B45A]" />
                      <span>
                        {downloadProgress
                          ? `${fmt(downloadProgress.completed)}/${fmt(downloadProgress.total)}`
                          : t('جارٍ الحفظ...', 'Saving...')}
                      </span>
                    </>
                  ) : downloadError ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t('أعد التحميل', 'Retry')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
                      <span>{t('حفظ السورة دون إنترنت', 'Save Surah Offline')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null
      ) : /* FULL-SCREEN FLOATING MODE */
      !isVisible ? null : isFullScreen ? (
        isMinimizedInFullScreen ? (
          /* Minimized Floating Audio Pill in Bottom Corner */
          <div className="fixed bottom-4 end-4 z-[60] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div
              className={`flex items-center gap-2 py-1.5 px-3 rounded-full shadow-2xl backdrop-blur-xl border transition-all ${
                isPlaying
                  ? 'bg-[#FBF7EE]/95 dark:bg-[#142038]/95 border-[#D9B45A]/65 text-[#1B1A17] dark:text-[#F6EFDD]'
                  : 'bg-[#FBF7EE]/95 dark:bg-[#10161f]/95 border-[#D9B45A]/30 dark:border-slate-700/80 text-[#3F3A32] dark:text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsMinimizedInFullScreen(false)}
                className="min-h-[36px] flex items-center gap-2 hover:text-[#8A6418] dark:hover:text-white cursor-pointer"
                title={t('إظهار مشغل التلاوة الكامل', 'Show full audio player')}
              >
                <div className="relative flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                  {isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ms-1" />
                  )}
                </div>
                <span className="text-xs font-bold font-kufi">{displayReciterName.split(' ')[0]}</span>
                <span className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] tabular-nums">({fmt(currentAyahNumber)})</span>
              </button>
              <button
                type="button"
                onClick={() => onPlayPauseToggle(!isPlaying)}
                aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                className="w-9 h-9 rounded-full bg-[#1F3A6E] text-[#F6EFDD] hover:bg-[#2E5499] border border-[#648CD4]/40 flex items-center justify-center cursor-pointer"
                title={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ms-0.5" />}
              </button>
              {onHideBar && (
                <button
                  type="button"
                  onClick={onHideBar}
                  aria-label={t('إخفاء الشريط الصوتي', 'Hide audio bar')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('إخفاء الشريط الصوتي للقراءة بالعين', 'Hide audio bar for reading')}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Floating Audio Capsule in Full-Screen */
          <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-1.5rem)] sm:w-auto sm:min-w-[480px] max-w-xl bg-[#FBF7EE]/95 dark:bg-[#10161f]/95 border border-[#D9B45A]/35 shadow-2xl backdrop-blur-xl rounded-2xl p-2 sm:p-3 animate-in fade-in slide-in-from-bottom-3 space-y-2">
            {/* Top Interactive Progress Line (LTR for accurate scrub positioning) */}
            <div
              dir="ltr"
              onClick={handleSeek}
              className="w-full h-1.5 bg-[#E5DAC0] dark:bg-slate-800 hover:h-2 rounded-full cursor-pointer transition-all relative overflow-hidden"
              title={t('تقديم وتأخير التلاوة', 'Seek recitation')}
            >
              <div
                className="h-full bg-gradient-to-r from-[#2E5499] to-[#D9B45A] rounded-full"
                style={{ width: `${audioProgress}%` }}
              />
            </div>

            {/* Mobile compact 2-row layout (<sm) */}
            <div className="flex flex-col gap-1.5 sm:hidden">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label={t('اختيار القارئ', 'Select reciter')}
                  className="bg-white dark:bg-slate-950/90 border border-[#D9B45A]/30 dark:border-slate-700/80 rounded-lg text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] py-1.5 px-2 outline-none max-w-[165px] cursor-pointer"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getReciterDisplayName(r, lang)}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] tabular-nums whitespace-nowrap px-2 py-1 rounded-md bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 text-[#8A6418] dark:text-[#D9B45A] font-semibold shrink-0">
                    {fmt(currentAyahNumber)} / {fmt(totalAyahs)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-label={t('خيارات إضافية', 'More options')}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={t('خيارات إضافية', 'More options')}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {onHideBar && (
                    <button
                      type="button"
                      onClick={onHideBar}
                      aria-label={t('إخفاء الشريط الصوتي', 'Hide audio bar')}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title={t('إخفاء الشريط الصوتي', 'Hide audio bar')}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                  disabled={currentAyahNumber <= 1}
                  aria-label={t('الآية السابقة', 'Previous Ayah')}
                  title={t('الآية السابقة', 'Previous Ayah')}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-30 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                  className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ms-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  aria-label={t('الآية التالية', 'Next Ayah')}
                  title={t('الآية التالية', 'Next Ayah')}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-30 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <NextIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop single-row layout (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/50 border border-[#648CD4]/35 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A] shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label={t('اختيار القارئ', 'Select reciter')}
                  className="bg-white dark:bg-slate-950/90 border border-[#D9B45A]/30 dark:border-slate-700/80 rounded-lg text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] py-1.5 px-2 outline-none max-w-[155px] cursor-pointer"
                  title={t('اختيار القارئ', 'Select reciter')}
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getReciterDisplayName(r, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                  disabled={currentAyahNumber <= 1}
                  aria-label={t('الآية السابقة', 'Previous Ayah')}
                  title={t('الآية السابقة', 'Previous Ayah')}
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-30 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                  className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ms-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  aria-label={t('الآية التالية', 'Next Ayah')}
                  title={t('الآية التالية', 'Next Ayah')}
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-30 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <NextIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] tabular-nums whitespace-nowrap px-2 py-1 rounded-md bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 text-[#8A6418] dark:text-[#D9B45A] font-semibold shrink-0">
                  {fmt(currentAyahNumber)} / {fmt(totalAyahs)}
                </span>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={t('خيارات إضافية', 'More options')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('خيارات إضافية (تكرار، سرعة الصوت)', 'More options (repeat, speed)')}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinimizedInFullScreen(true)}
                  aria-label={t('تصغير الشريط الصوتي', 'Minimize player')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('تصغير شريط الصوت لأيقونة', 'Minimize to floating pill')}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {onHideBar && (
                  <button
                    type="button"
                    onClick={onHideBar}
                    aria-label={t('إخفاء الشريط الصوتي', 'Hide audio bar')}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={t('إخفاء الشريط الصوتي للقراءة بالعين', 'Hide audio bar for reading')}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Options in Full-Screen Mode */}
            {isExpanded && (
              <div className="pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Repeat Mode */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#5C5549] dark:text-slate-400 text-[11px]">{t('التكرار:', 'Repeat:')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (repeatMode === 'none') setRepeatMode('2-times');
                      else if (repeatMode === '2-times') setRepeatMode('3-times');
                      else if (repeatMode === '3-times') setRepeatMode('loop');
                      else setRepeatMode('none');
                    }}
                    className={`min-h-[32px] py-1 px-2.5 rounded-md font-medium border text-[11px] flex items-center gap-1 cursor-pointer ${
                      repeatMode !== 'none'
                        ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                        : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>
                      {repeatMode === 'none'
                        ? t('بدون', 'Off')
                        : repeatMode === '2-times'
                        ? `2x (${repeatCounter})`
                        : repeatMode === '3-times'
                        ? `3x (${repeatCounter})`
                        : t('مستمر', 'Loop')}
                    </span>
                  </button>
                </div>

                {/* Audio Speed */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#5C5549] dark:text-slate-400 text-[11px]">{t('السرعة:', 'Speed:')}</span>
                  <div className="flex gap-1">
                    {[0.75, 1.0, 1.25].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`min-h-[30px] py-0.5 px-2 rounded font-semibold text-[11px] cursor-pointer ${
                          playbackSpeed === speed
                            ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                            : 'bg-white dark:bg-slate-950 border border-[#D9B45A]/20 dark:border-transparent text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smart scroll toggle */}
                <button
                  type="button"
                  onClick={onToggleSmartScroll}
                  className={`min-h-[32px] py-1 px-2.5 rounded-md font-medium border text-[11px] flex items-center gap-1 cursor-pointer ${
                    isSmartScrollEnabled
                      ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/50 border-[#648CD4]/50 text-[#F6EFDD] dark:text-[#D9B45A]'
                      : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                  }`}
                  title={t('مزامنة نزول الصفحة مع تلاوة الشيخ', 'Sync page scrolling with recitation')}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('مزامنة التمرير', 'Auto-Sync')}</span>
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        /* STANDARD DOCKED BOTTOM BAR (Normal View) */
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-[#FBF7EE]/95 dark:bg-[#0d121a]/95 border-t border-[#D9B45A]/25 dark:border-slate-800 backdrop-blur-md shadow-2xl transition-all pb-[env(safe-area-inset-bottom)] lg:pb-0">
          {/* Progress line (LTR for accurate scrub positioning) */}
          <div
            dir="ltr"
            onClick={handleSeek}
            className="w-full h-1 bg-[#E5DAC0] dark:bg-slate-800 hover:h-2 cursor-pointer transition-all relative"
          >
            <div
              className="h-full bg-gradient-to-r from-[#2E5499] to-[#D9B45A]"
              style={{ width: `${audioProgress}%` }}
            />
          </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2 flex flex-col gap-1.5">
        {/* Mobile Layout (< md): 1-row collapsible Mini-Player respecting 15% mobile sticky cap */}
        <div className="flex items-center justify-between gap-2 md:hidden min-h-[44px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onPlayPauseToggle(!isPlaying)}
              aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
              title={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
              className="w-9 h-9 shrink-0 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ms-0.5 text-[#D9B45A] fill-[#D9B45A]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="min-w-0 flex-1 text-start cursor-pointer"
              title={t('توسيع أدوات التلاوة', 'Expand audio controls')}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] truncate">
                <span className="truncate">{t(`سورة ${displaySurahName}`, `Surah ${displaySurahName}`)}</span>
                <span className="text-[#8A6418] dark:text-[#D9B45A] tabular-nums shrink-0">
                  · {fmt(currentAyahNumber)}/{fmt(totalAyahs)}
                </span>
              </div>
              <div className="text-[11px] text-[#5C5549] dark:text-slate-400 truncate">
                {displayReciterName}
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t('طي خيارات المشغّل', 'Collapse player options') : t('توسيع خيارات المشغّل', 'Expand player options')}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {onHideBar && (
              <button
                type="button"
                onClick={onHideBar}
                aria-label={t('إخفاء الشريط الصوتي للقراءة بالعين', 'Hide audio bar for visual reading')}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/25 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors cursor-pointer"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Layout (md+): Single balanced 3-zone row */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Start: Ayah info & Reciter */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isPlaying
                ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#D9B45A]'
                : 'bg-[#EFE6D1] dark:bg-[#1F3A6E]/40 border-[#D9B45A]/30 dark:border-[#648CD4]/35 text-[#8A6418] dark:text-[#D9B45A]'
            }`}>
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-sm truncate flex items-center gap-2">
                <span className="truncate">{t(`سورة ${displaySurahName}`, `Surah ${displaySurahName}`)}</span>
                <span className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-medium tabular-nums whitespace-nowrap shrink-0">
                  {t(`الآية ${fmt(currentAyahNumber)} / ${fmt(totalAyahs)}`, `Ayah ${fmt(currentAyahNumber)} / ${fmt(totalAyahs)}`)}
                </span>
              </div>
              <div className="text-[11px] text-[#5C5549] dark:text-slate-400 truncate">
                {t('بصوت:', 'Reciter:')} <strong className="text-[#1B1A17] dark:text-slate-200">{displayReciterName}</strong> · {displayReciterStyle}
              </div>
            </div>
          </div>

          {/* Center: Controls (Prev, Play/Pause, Next) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
              disabled={currentAyahNumber <= 1}
              aria-label={t('الآية السابقة', 'Previous Ayah')}
              title={t('الآية السابقة', 'Previous Ayah')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-40 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PrevIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlayPauseToggle(!isPlaying)}
              aria-label={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
              title={isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل التلاوة', 'Play recitation')}
              className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ms-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
            </button>

            <button
              type="button"
              onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
              disabled={currentAyahNumber >= totalAyahs}
              aria-label={t('الآية التالية', 'Next Ayah')}
              title={t('الآية التالية', 'Next Ayah')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white disabled:opacity-40 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <NextIcon className="w-4 h-4" />
            </button>
          </div>

          {/* End: Smart Scroll, Reciter Selector & Expand Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleSmartScroll}
              className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                isSmartScrollEnabled
                  ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#D9B45A] shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
              title={t('تمرير تلقائي يتوقف عند رأس كل آية ﴿﴾ للتدبر', 'Auto-scroll synced with recitation')}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('التمرير الذكي', 'Smart Scroll')}</span>
            </button>

            <select
              value={selectedReciter.id}
              onChange={(e) => {
                const found = RECITERS_LIST.find(r => r.id === e.target.value);
                if (found) setSelectedReciter(found);
              }}
              aria-label={t('اختيار القارئ', 'Select reciter')}
              className="min-h-[38px] bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-700/80 rounded-xl text-xs text-[#1B1A17] dark:text-[#F6EFDD] py-1.5 px-2.5 outline-none max-w-[175px] cursor-pointer"
            >
              {RECITERS_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {getReciterDisplayName(r, lang)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={t('خيارات الختمة والتكرار والسرعة', 'Timer, repeat & speed options')}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={t('خيارات الختمة والتكرار والسرعة', 'Timer, repeat & speed options')}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {onHideBar && (
              <button
                type="button"
                onClick={onHideBar}
                aria-label={t('إخفاء الشريط الصوتي للقراءة بالعين', 'Hide audio bar for visual reading')}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={t('إخفاء الشريط الصوتي للقراءة بالعين', 'Hide audio bar for visual reading')}
              >
                <EyeOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Options Drawer (Mobile includes Prev/Next + Reciter + Smart Scroll) */}
        {isExpanded && (
          <div className="pt-2.5 pb-1.5 border-t border-[#D9B45A]/20 dark:border-slate-800/80 flex flex-col gap-2.5 text-xs animate-in fade-in duration-150">
            {/* Mobile-only Prev/Next + Reciter + Smart Scroll */}
            <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                  disabled={currentAyahNumber <= 1}
                  className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <PrevIcon className="w-3.5 h-3.5" />
                  <span>{t('السابقة', 'Prev')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('التالية', 'Next')}</span>
                  <NextIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label={t('اختيار القارئ', 'Select reciter')}
                  className="min-h-[36px] bg-white dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-700/80 rounded-lg text-[11px] text-[#1B1A17] dark:text-[#F6EFDD] py-1 px-2 outline-none max-w-[140px]"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getReciterDisplayName(r, lang)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onToggleSmartScroll}
                  className={`min-h-[36px] px-2.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                    isSmartScrollEnabled
                      ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#D9B45A]'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('المزامنة', 'Sync')}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Repeat Mode */}
              <div className="flex items-center gap-2">
                <span className="text-[#5C5549] dark:text-slate-400">{t('تكرار الآية:', 'Repeat:')}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (repeatMode === 'none') setRepeatMode('2-times');
                    else if (repeatMode === '2-times') setRepeatMode('3-times');
                    else if (repeatMode === '3-times') setRepeatMode('loop');
                    else setRepeatMode('none');
                  }}
                  className={`min-h-[34px] py-1 px-2.5 rounded-lg font-medium border flex items-center gap-1 cursor-pointer ${
                    repeatMode !== 'none'
                      ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#3F3A32] dark:text-slate-300'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {repeatMode === 'none'
                      ? t('بدون تكرار', 'No Repeat')
                      : repeatMode === '2-times'
                      ? t(`مرتان (${repeatCounter}/2)`, `2× (${repeatCounter}/2)`)
                      : repeatMode === '3-times'
                      ? t(`3 مرات (${repeatCounter}/3)`, `3× (${repeatCounter}/3)`)
                      : t('تكرار مستمر', 'Loop')}
                  </span>
                </button>
              </div>

              {/* Playback Speed */}
              <div className="flex items-center gap-2">
                <span className="text-[#5C5549] dark:text-slate-400">{t('السرعة:', 'Speed:')}</span>
                <div className="flex gap-1">
                  {[0.75, 1.0, 1.25].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`min-h-[32px] py-0.5 px-2.5 rounded-md font-semibold cursor-pointer ${
                        playbackSpeed === speed
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                          : 'bg-white dark:bg-slate-800 border border-[#D9B45A]/20 dark:border-transparent text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Khatma Sleep Timer */}
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#5C5549] dark:text-slate-400" />
                <span className="text-[#5C5549] dark:text-slate-400">{t('مؤقت الورد:', 'Sleep Timer:')}</span>
                <select
                  value={khatmaTimerMinutes}
                  onChange={(e) => setKhatmaTimerMinutes(Number(e.target.value))}
                  aria-label={t('مؤقت إيقاف الورد', 'Sleep timer')}
                  className="min-h-[34px] bg-white dark:bg-slate-900 border border-[#D9B45A]/25 dark:border-slate-800 rounded-md text-[#1B1A17] dark:text-[#F6EFDD] py-0.5 px-2 outline-none"
                >
                  <option value={0}>{t('بدون إيقاف', 'Off')}</option>
                  <option value={15}>{t('15 دقيقة', '15 min')}</option>
                  <option value={30}>{t('30 دقيقة', '30 min')}</option>
                  <option value={45}>{t('45 دقيقة', '45 min')}</option>
                  <option value={60}>{t('ساعة كاملة', '1 hour')}</option>
                </select>
                {timeRemaining > 0 && (
                  <span className="text-[#8A6418] dark:text-[#D9B45A] font-mono text-[11px]">
                    ({Math.floor(timeRemaining / 60)}{t('د', 'm')})
                  </span>
                )}
              </div>

              {/* Real Offline Audio Cache Download */}
              <div className="flex flex-col items-end justify-center gap-1">
                <button
                  type="button"
                  onClick={handleDownloadSurah}
                  disabled={isDownloaded || isDownloading}
                  className={`min-h-[34px] py-1 px-2.5 rounded-lg font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDownloaded
                      ? 'bg-[#1F3A6E] border-[#648CD4]/40 text-[#D9B45A]'
                      : downloadError
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-600 dark:text-rose-300'
                      : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#8A6418]/45 dark:hover:border-slate-700'
                  }`}
                  title={
                    isDownloaded
                      ? t('السورة محفوظة بالكامل في ذاكرة المتصفح للاستماع دون إنترنت', 'Surah fully cached in browser storage for offline listening')
                      : downloadError || t('تخزين تلاوات هذه السورة للعمل دون اتصال بالإنترنت', 'Download Surah audio for offline playback')
                  }
                >
                  {isDownloaded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                      <span>{t('محفوظة دون إنترنت', 'Saved Offline')}</span>
                    </>
                  ) : isDownloading ? (
                    <>
                      <Download className="w-3.5 h-3.5 animate-bounce text-[#D9B45A]" />
                      <span>
                        {downloadProgress
                          ? t(`جارٍ الحفظ (${downloadProgress.completed}/${downloadProgress.total})...`, `Saving (${downloadProgress.completed}/${downloadProgress.total})...`)
                          : t('جارِ التخزين...', 'Saving...')}
                      </span>
                    </>
                  ) : downloadError ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                      <span>{t('تعذر التحميل · أعد المحاولة', 'Download Failed · Retry')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
                      <span>{t('حفظ السورة دون إنترنت', 'Save Surah Offline')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
</>
);
};
