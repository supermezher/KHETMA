import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, RotateCcw, Clock, Download, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, EyeOff } from 'lucide-react';
import { Reciter, RECITERS_LIST, getAyahAudioUrl } from '../data/reciters';
import { isSurahCached, cacheSurahAudio, getCachedAudioBlobUrl } from '../utils/audioOfflineCache';
import { toArabicIndic } from './khatma/KhatmaRing';

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
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
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
}

export interface AudioEndTransitionInput {
  stopAfterAyahMode: boolean;
  memorizationRepeatTarget: 1 | 2 | 3 | 'loop';
  repeatMode: 'none' | '2-times' | '3-times' | 'loop';
  currentRepeatCount: number;
  currentAyahNumber: number;
  totalAyahs: number;
}

export type AudioEndAction =
  | { type: 'replay-same-ayah'; nextRepeatCount: number }
  | { type: 'advance-next-ayah'; nextAyahNumber: number }
  | { type: 'stop' };

export function resolveAudioEndedTransition(input: AudioEndTransitionInput): AudioEndAction {
  const {
    stopAfterAyahMode,
    memorizationRepeatTarget,
    repeatMode,
    currentRepeatCount,
    currentAyahNumber,
    totalAyahs,
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

  return { type: 'stop' };
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
}) => {
  const [internalReciter, setInternalReciter] = useState<Reciter>(RECITERS_LIST[0]);
  const selectedReciter = propSelectedReciter || internalReciter;
  const setSelectedReciter = propOnSelectReciter || setInternalReciter;

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
  const [audioProgress, setAudioProgress] = useState(0);

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
    if (!audioRef.current) return;
    const isExplicitReplay = playTriggerNonce !== lastHandledNonceRef.current;
    if (isExplicitReplay) {
      lastHandledNonceRef.current = playTriggerNonce;
      repeatCounterRef.current = 1;
      setRepeatCounter(1);
      onMemorizationRepeatChange?.(1);
      audioRef.current.currentTime = 0;
    }

    if (isPlaying) {
      if (!activeAudioSrc) return;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(err => {
        if (err?.name === 'AbortError') return;
        console.warn('Audio play prevented:', err);
        onPlayPauseToggle(false);
      });
    } else {
      audioRef.current.pause();
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
          onPlaybackProgressRef.current?.(cur, dur);
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

  // Reset repeat counter whenever ayah or surah changes
  useEffect(() => {
    repeatCounterRef.current = 1;
    setRepeatCounter(1);
    onMemorizationRepeatChange?.(1);
  }, [currentAyahNumber, surahNumber]);

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
          if (err?.name !== 'AbortError') onPlayPauseToggle(false);
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
      onPlaybackProgress?.(cur, dur);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration || !Number.isFinite(audioRef.current.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    audioRef.current.currentTime = percent * audioRef.current.duration;
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
      setDownloadError(err?.message || 'تعذر تحميل التلاوات');
      setIsDownloaded(false);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.warn('Audio playback/stream error occurred:', e);
    onPlayPauseToggle(false);
  };

  const syncPlaybackRate = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    e.currentTarget.playbackRate = playbackSpeedRef.current;
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

      {/* FULL-SCREEN FLOATING MODE */}
      {!isVisible ? null : isFullScreen ? (
        isMinimizedInFullScreen ? (
          /* Minimized Floating Audio Pill in Bottom Corner */
          <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div
              className={`flex items-center gap-2 py-1.5 px-3 rounded-full shadow-2xl backdrop-blur-xl border transition-all ${
                isPlaying
                  ? 'bg-[#142038]/95 border-[#D9B45A]/55 text-[#F6EFDD]'
                  : 'bg-[#10161f]/95 border-slate-700/80 text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsMinimizedInFullScreen(false)}
                className="min-h-[36px] flex items-center gap-2 hover:text-white cursor-pointer"
                title="إظهار مشغل التلاوة الكامل"
              >
                <div className="relative flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-[#D9B45A]" />
                  {isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1" />
                  )}
                </div>
                <span className="text-xs font-bold font-kufi">{selectedReciter.name.split(' ')[0]}</span>
                <span className="text-[11px] text-[#D9B45A] tabular-nums">({toArabicIndic(currentAyahNumber)})</span>
              </button>
              <button
                type="button"
                onClick={() => onPlayPauseToggle(!isPlaying)}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                className="w-9 h-9 rounded-full bg-[#1F3A6E] text-[#F6EFDD] hover:bg-[#2E5499] border border-[#648CD4]/40 flex items-center justify-center cursor-pointer"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              {onHideBar && (
                <button
                  type="button"
                  onClick={onHideBar}
                  aria-label="إخفاء الشريط الصوتي"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إخفاء الشريط الصوتي للقراءة بالعين"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Floating Audio Capsule in Full-Screen */
          <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-1.5rem)] sm:w-auto sm:min-w-[480px] max-w-xl bg-[#10161f]/95 border border-[#D9B45A]/30 shadow-2xl backdrop-blur-xl rounded-2xl p-2 sm:p-3 animate-in fade-in slide-in-from-bottom-3 space-y-2">
            {/* Top Interactive Progress Line (LTR for accurate scrub positioning) */}
            <div
              dir="ltr"
              onClick={handleSeek}
              className="w-full h-1.5 bg-slate-800 hover:h-2 rounded-full cursor-pointer transition-all relative overflow-hidden"
              title="تقديم وتأخير التلاوة"
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
                  aria-label="اختيار القارئ"
                  className="bg-slate-950/90 border border-slate-700/80 rounded-lg text-xs font-bold text-[#F6EFDD] py-1.5 px-2 outline-none max-w-[165px] cursor-pointer"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] tabular-nums whitespace-nowrap px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[#D9B45A] font-semibold shrink-0">
                    {toArabicIndic(currentAyahNumber)} / {toArabicIndic(totalAyahs)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-label="خيارات إضافية"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="خيارات إضافية"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {onHideBar && (
                    <button
                      type="button"
                      onClick={onHideBar}
                      aria-label="إخفاء الشريط الصوتي"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="إخفاء الشريط الصوتي"
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
                  aria-label="الآية السابقة"
                  title="الآية السابقة"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                  className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  aria-label="الآية التالية"
                  title="الآية التالية"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop single-row layout (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1F3A6E]/50 border border-[#648CD4]/40 flex items-center justify-center text-[#D9B45A] shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label="اختيار القارئ"
                  className="bg-slate-950/90 border border-slate-700/80 rounded-lg text-xs font-bold text-[#F6EFDD] py-1.5 px-2 outline-none max-w-[155px] cursor-pointer"
                  title="اختيار القارئ"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                  disabled={currentAyahNumber <= 1}
                  aria-label="الآية السابقة"
                  title="الآية السابقة"
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                  className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  aria-label="الآية التالية"
                  title="الآية التالية"
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] tabular-nums whitespace-nowrap px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[#D9B45A] font-semibold shrink-0">
                  {toArabicIndic(currentAyahNumber)} / {toArabicIndic(totalAyahs)}
                </span>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label="خيارات إضافية"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="خيارات إضافية (تكرار، سرعة الصوت)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinimizedInFullScreen(true)}
                  aria-label="تصغير الشريط الصوتي"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="تصغير شريط الصوت لأيقونة"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {onHideBar && (
                  <button
                    type="button"
                    onClick={onHideBar}
                    aria-label="إخفاء الشريط الصوتي"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="إخفاء الشريط الصوتي للقراءة بالعين"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Options in Full-Screen Mode */}
            {isExpanded && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Repeat Mode */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">التكرار:</span>
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
                        ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#D9B45A]'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>
                      {repeatMode === 'none'
                        ? 'بدون'
                        : repeatMode === '2-times'
                        ? `2x (${repeatCounter})`
                        : repeatMode === '3-times'
                        ? `3x (${repeatCounter})`
                        : 'مستمر'}
                    </span>
                  </button>
                </div>

                {/* Audio Speed */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">السرعة:</span>
                  <div className="flex gap-1">
                    {[0.75, 1.0, 1.25].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`min-h-[30px] py-0.5 px-2 rounded font-semibold text-[11px] cursor-pointer ${
                          playbackSpeed === speed
                            ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                            : 'bg-slate-950 text-slate-300 hover:text-white'
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
                      ? 'bg-[#1F3A6E]/50 border-[#648CD4]/50 text-[#D9B45A]'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                  title="مزامنة نزول الصفحة مع تلاوة الشيخ"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>مزامنة التمرير</span>
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        /* STANDARD DOCKED BOTTOM BAR (Normal View) */
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-[#0d121a]/95 border-t border-slate-800 backdrop-blur-md shadow-2xl transition-all pb-[env(safe-area-inset-bottom)] lg:pb-0">
          {/* Progress line (LTR for accurate scrub positioning) */}
          <div
            dir="ltr"
            onClick={handleSeek}
            className="w-full h-1 bg-slate-800 hover:h-2 cursor-pointer transition-all relative"
          >
            <div
              className="h-full bg-gradient-to-r from-[#2E5499] to-[#D9B45A]"
              style={{ width: `${audioProgress}%` }}
            />
          </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2.5 flex flex-col gap-1.5">
        {/* Mobile Layout (< md): Clean compact bar leaving maximum vertical Mushaf space */}
        <div className="flex flex-col gap-1.5 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-[#F6EFDD] text-xs truncate">
                سورة {surahName}
              </span>
              <span className="text-[11px] text-[#D9B45A] font-semibold tabular-nums whitespace-nowrap shrink-0">
                الآية {toArabicIndic(currentAyahNumber)} / {toArabicIndic(totalAyahs)}
              </span>
            </div>

            <select
              value={selectedReciter.id}
              onChange={(e) => {
                const found = RECITERS_LIST.find(r => r.id === e.target.value);
                if (found) setSelectedReciter(found);
              }}
              aria-label="اختيار القارئ"
              className="bg-slate-900 border border-slate-700/80 rounded-lg text-[11px] text-[#F6EFDD] py-1 px-2 outline-none max-w-[145px] shrink-0"
            >
              {RECITERS_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                disabled={currentAyahNumber <= 1}
                aria-label="الآية السابقة"
                title="الآية السابقة"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onPlayPauseToggle(!isPlaying)}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
              </button>

              <button
                type="button"
                onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                disabled={currentAyahNumber >= totalAyahs}
                aria-label="الآية التالية"
                title="الآية التالية"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSmartScroll}
                className={`min-h-[38px] flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  isSmartScrollEnabled
                    ? 'bg-[#1F3A6E]/55 border-[#648CD4]/50 text-[#D9B45A]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                }`}
                title="مزامنة التمرير مع التلاوة"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>المزامنة</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label="خيارات الختمة والتكرار والسرعة"
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
                title="خيارات الختمة والتكرار والسرعة"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {onHideBar && (
                <button
                  type="button"
                  onClick={onHideBar}
                  aria-label="إخفاء الشريط الصوتي للقراءة بالعين"
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
                  title="إخفاء الشريط الصوتي للقراءة بالعين"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout (md+): Single balanced 3-zone row */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Left: Ayah info & Reciter */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isPlaying
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-[#1F3A6E]/40 border-[#648CD4]/35 text-[#D9B45A]'
            }`}>
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F6EFDD] text-sm truncate flex items-center gap-2">
                <span className="truncate">سورة {surahName}</span>
                <span className="text-[11px] text-[#D9B45A] font-medium tabular-nums whitespace-nowrap shrink-0">
                  الآية {toArabicIndic(currentAyahNumber)} / {toArabicIndic(totalAyahs)}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                بصوت: <strong className="text-slate-200">{selectedReciter.name}</strong> · {selectedReciter.style}
              </div>
            </div>
          </div>

          {/* Center: Controls (Prev, Play/Pause, Next) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
              disabled={currentAyahNumber <= 1}
              aria-label="الآية السابقة"
              title="الآية السابقة"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlayPauseToggle(!isPlaying)}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
              className="w-10 h-10 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5 text-[#D9B45A] fill-[#D9B45A]" />}
            </button>

            <button
              type="button"
              onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
              disabled={currentAyahNumber >= totalAyahs}
              aria-label="الآية التالية"
              title="الآية التالية"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Smart Scroll, Reciter Selector & Expand Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleSmartScroll}
              className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                isSmartScrollEnabled
                  ? 'bg-[#1F3A6E]/55 border-[#648CD4]/50 text-[#D9B45A] shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="تمرير تلقائي يتوقف عند رأس كل آية ﴿﴾ للتدبر"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>التمرير الذكي</span>
            </button>

            <select
              value={selectedReciter.id}
              onChange={(e) => {
                const found = RECITERS_LIST.find(r => r.id === e.target.value);
                if (found) setSelectedReciter(found);
              }}
              aria-label="اختيار القارئ"
              className="min-h-[38px] bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-[#F6EFDD] py-1.5 px-2.5 outline-none max-w-[175px] cursor-pointer"
            >
              {RECITERS_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label="خيارات الختمة والتكرار والسرعة"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="خيارات الختمة والتكرار والسرعة"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {onHideBar && (
              <button
                type="button"
                onClick={onHideBar}
                aria-label="إخفاء الشريط الصوتي للقراءة بالعين"
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="إخفاء الشريط الصوتي للقراءة بالعين"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Options Drawer */}
        {isExpanded && (
          <div className="pt-2.5 pb-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in fade-in duration-150">
            {/* Repeat Mode */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">تكرار الآية:</span>
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
                    ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#D9B45A]'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {repeatMode === 'none'
                    ? 'بدون تكرار'
                    : repeatMode === '2-times'
                    ? `مرتان (${repeatCounter}/2)`
                    : repeatMode === '3-times'
                    ? `3 مرات (${repeatCounter}/3)`
                    : 'تكرار مستمر'}
                </span>
              </button>
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">السرعة:</span>
              <div className="flex gap-1">
                {[0.75, 1.0, 1.25].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`min-h-[32px] py-0.5 px-2.5 rounded-md font-semibold cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Khatma Sleep Timer */}
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">مؤقت الورد:</span>
              <select
                value={khatmaTimerMinutes}
                onChange={(e) => setKhatmaTimerMinutes(Number(e.target.value))}
                aria-label="مؤقت إيقاف الورد"
                className="min-h-[34px] bg-slate-900 border border-slate-800 rounded-md text-[#F6EFDD] py-0.5 px-2 outline-none"
              >
                <option value={0}>بدون إيقاف</option>
                <option value={15}>15 دقيقة</option>
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
                <option value={60}>ساعة كاملة</option>
              </select>
              {timeRemaining > 0 && (
                <span className="text-[#D9B45A] font-mono text-[11px]">
                  ({Math.floor(timeRemaining / 60)}د)
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
                    ? 'bg-[#172848]/70 border-[#648CD4]/40 text-[#D9B45A]'
                    : downloadError
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-950/60'
                    : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                }`}
                title={
                  isDownloaded
                    ? 'السورة محفوظة بالكامل في ذاكرة المتصفح للاستماع دون إنترنت'
                    : downloadError || 'تخزين تلاوات هذه السورة للعمل دون اتصال بالإنترنت'
                }
              >
                {isDownloaded ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                    <span>محفوظة دون إنترنت</span>
                  </>
                ) : isDownloading ? (
                  <>
                    <Download className="w-3.5 h-3.5 animate-bounce text-[#D9B45A]" />
                    <span>
                      {downloadProgress
                        ? `جارٍ الحفظ (${downloadProgress.completed}/${downloadProgress.total})...`
                        : 'جارِ التخزين...'}
                    </span>
                  </>
                ) : downloadError ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>تعذر التحميل · أعد المحاولة</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#648CD4]" />
                    <span>حفظ السورة دون إنترنت</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
</>
);
};
