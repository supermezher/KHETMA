import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, RotateCcw, Clock, Download, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, EyeOff } from 'lucide-react';
import { Reciter, RECITERS_LIST, getAyahAudioUrl } from '../data/reciters';
import { isSurahCached, cacheSurahAudio, getCachedAudioBlobUrl } from '../utils/audioOfflineCache';

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
  const [cachedBlobSrc, setCachedBlobSrc] = useState<string | null>(null);
  const [isMinimizedInFullScreen, setIsMinimizedInFullScreen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const repeatCounterRef = useRef<number>(1);
  const lastHandledNonceRef = useRef<number>(playTriggerNonce);
  const stopAfterAyahModeRef = useRef<boolean>(stopAfterAyahMode);
  stopAfterAyahModeRef.current = stopAfterAyahMode;
  const memRepeatTargetRef = useRef<1 | 2 | 3 | 'loop'>(memorizationRepeatTarget);
  memRepeatTargetRef.current = memorizationRepeatTarget;
  const [audioProgress, setAudioProgress] = useState(0);

  // Audio source URL
  const audioUrl = getAyahAudioUrl(selectedReciter.serverKey, surahNumber, currentAyahNumber);

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

  // Attempt to load from offline cache first (and cleanly revoke previous ObjectURL)
  useEffect(() => {
    let isMounted = true;
    setCachedBlobSrc(null);
    getCachedAudioBlobUrl(audioUrl).then((blobUrl) => {
      if (!isMounted) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      if (activeBlobUrlRef.current && activeBlobUrlRef.current !== blobUrl) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = blobUrl;
      setCachedBlobSrc(blobUrl);
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
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(err => {
        if (err?.name === 'AbortError') return;
        console.warn('Audio play prevented:', err);
        onPlayPauseToggle(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, cachedBlobSrc, audioUrl, playbackSpeed, playTriggerNonce]);

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
        setCachedBlobSrc(blobUrl);
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

  return (
    <>
      {/* Hidden Persistent Audio Element - Always mounted so recitation never cuts off */}
      <audio
        ref={audioRef}
        src={cachedBlobSrc || audioUrl}
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
              className={`flex items-center gap-2 py-2 px-3.5 rounded-full shadow-2xl backdrop-blur-xl border transition-all ${
                isPlaying
                  ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/50'
                  : 'bg-slate-900/95 border-slate-700/80 text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsMinimizedInFullScreen(false)}
                className="flex items-center gap-2 hover:text-white cursor-pointer"
                title="إظهار مشغل التلاوة الكامل"
              >
                <div className="relative flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  {isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1" />
                  )}
                </div>
                <span className="text-xs font-bold font-kufi">{selectedReciter.name.split(' ')[0]}</span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">({currentAyahNumber})</span>
              </button>
              <button
                type="button"
                onClick={() => onPlayPauseToggle(!isPlaying)}
                className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 flex items-center justify-center cursor-pointer"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
              </button>
              {onHideBar && (
                <button
                  type="button"
                  onClick={onHideBar}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إخفاء الشريط الصوتي للقراءة بالعين"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Floating Audio Capsule in Full-Screen */
          <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-1.5rem)] sm:w-auto sm:min-w-[480px] max-w-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 animate-in fade-in slide-in-from-bottom-3 space-y-2">
            {/* Top Interactive Progress Line (LTR for accurate scrub positioning) */}
            <div
              dir="ltr"
              onClick={handleSeek}
              className="w-full h-1 bg-slate-800 hover:h-1.5 rounded-full cursor-pointer transition-all relative overflow-hidden"
              title="تقديم وتأخير التلاوة"
            >
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all rounded-full"
                style={{ width: `${audioProgress}%` }}
              />
            </div>

            {/* Mobile 2-row layout (<sm) preventing button collision */}
            <div className="flex flex-col gap-2 sm:hidden">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  aria-label="اختيار القارئ"
                  className="bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs font-bold text-slate-200 py-1 px-2 outline-none max-w-[165px] cursor-pointer"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono tabular-nums whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-emerald-400 shrink-0">
                    {currentAyahNumber} / {totalAyahs}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="خيارات إضافية"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {onHideBar && (
                    <button
                      type="button"
                      onClick={onHideBar}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
                  title="الآية السابقة"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50 transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  title="الآية التالية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop single-row layout (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <select
                  value={selectedReciter.id}
                  onChange={(e) => {
                    const found = RECITERS_LIST.find(r => r.id === e.target.value);
                    if (found) setSelectedReciter(found);
                  }}
                  className="bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs font-bold text-slate-200 py-1 px-1.5 outline-none max-w-[155px] cursor-pointer"
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
                  title="الآية السابقة"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onPlayPauseToggle(!isPlaying)}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50 transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                  disabled={currentAyahNumber >= totalAyahs}
                  title="الآية التالية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono tabular-nums whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-emerald-400 shrink-0">
                  {currentAyahNumber} / {totalAyahs}
                </span>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="خيارات إضافية (تكرار، سرعة الصوت)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinimizedInFullScreen(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="تصغير شريط الصوت لأيقونة"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {onHideBar && (
                  <button
                    type="button"
                    onClick={onHideBar}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
                    onClick={() => {
                      if (repeatMode === 'none') setRepeatMode('2-times');
                      else if (repeatMode === '2-times') setRepeatMode('3-times');
                      else if (repeatMode === '3-times') setRepeatMode('loop');
                      else setRepeatMode('none');
                    }}
                    className={`py-0.5 px-2 rounded-md font-medium border text-[11px] flex items-center gap-1 cursor-pointer ${
                      repeatMode !== 'none'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
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
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`py-0.5 px-1.5 rounded font-semibold text-[10px] cursor-pointer ${
                          playbackSpeed === speed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smart scroll toggle */}
                <button
                  onClick={onToggleSmartScroll}
                  className={`py-0.5 px-2 rounded-md font-medium border text-[11px] flex items-center gap-1 cursor-pointer ${
                    isSmartScrollEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
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
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md shadow-2xl transition-all">
          {/* Progress line (LTR for accurate scrub positioning) */}
          <div
            dir="ltr"
            onClick={handleSeek}
            className="w-full h-1 bg-slate-800 hover:h-2 cursor-pointer transition-all relative"
          >
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
              style={{ width: `${audioProgress}%` }}
            />
          </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col gap-2">
        {/* Mobile Layout (< md): Clean 2-row player with visible Surah/Ayah & zero overlap */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-white text-xs truncate">
                سورة {surahName}
              </span>
              <span className="text-[11px] text-emerald-300 font-semibold tabular-nums whitespace-nowrap shrink-0">
                الآية {currentAyahNumber} / {totalAyahs}
              </span>
            </div>

            <select
              value={selectedReciter.id}
              onChange={(e) => {
                const found = RECITERS_LIST.find(r => r.id === e.target.value);
                if (found) setSelectedReciter(found);
              }}
              aria-label="اختيار القارئ"
              className="bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 py-1 px-2 outline-none max-w-[145px] shrink-0"
            >
              {RECITERS_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
                disabled={currentAyahNumber <= 1}
                title="الآية السابقة"
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onPlayPauseToggle(!isPlaying)}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
                disabled={currentAyahNumber >= totalAyahs}
                title="الآية التالية"
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSmartScroll}
                className={`flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  isSmartScrollEnabled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="مزامنة التمرير مع التلاوة"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>التمرير الذكي</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
                title="خيارات الختمة والتكرار والسرعة"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {onHideBar && (
                <button
                  type="button"
                  onClick={onHideBar}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
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
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate flex items-center gap-2">
                <span className="truncate">سورة {surahName}</span>
                <span className="text-[11px] text-emerald-300 font-medium tabular-nums whitespace-nowrap shrink-0">
                  الآية {currentAyahNumber} / {totalAyahs}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                بصوت: <strong className="text-slate-300">{selectedReciter.name}</strong> · {selectedReciter.style}
              </div>
            </div>
          </div>

          {/* Center: Controls (Prev, Play/Pause, Next) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onAyahChange(Math.max(1, currentAyahNumber - 1))}
              disabled={currentAyahNumber <= 1}
              title="الآية السابقة"
              className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlayPauseToggle(!isPlaying)}
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onAyahChange(Math.min(totalAyahs, currentAyahNumber + 1))}
              disabled={currentAyahNumber >= totalAyahs}
              title="الآية التالية"
              className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Smart Scroll, Reciter Selector & Expand Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleSmartScroll}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                isSmartScrollEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
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
              className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 py-1.5 px-2 outline-none max-w-[170px]"
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="خيارات الختمة والتكرار والسرعة"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {onHideBar && (
              <button
                type="button"
                onClick={onHideBar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
                onClick={() => {
                  if (repeatMode === 'none') setRepeatMode('2-times');
                  else if (repeatMode === '2-times') setRepeatMode('3-times');
                  else if (repeatMode === '3-times') setRepeatMode('loop');
                  else setRepeatMode('none');
                }}
                className={`py-1 px-2.5 rounded-lg font-medium border flex items-center gap-1 cursor-pointer ${
                  repeatMode !== 'none'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
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
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`py-0.5 px-2 rounded-md font-semibold ${
                      playbackSpeed === speed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
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
                className="bg-slate-900 border border-slate-800 rounded-md text-slate-200 py-0.5 px-1.5 outline-none"
              >
                <option value={0}>بدون إيقاف</option>
                <option value={15}>15 دقيقة</option>
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
                <option value={60}>ساعة كاملة</option>
              </select>
              {timeRemaining > 0 && (
                <span className="text-emerald-400 font-mono text-[10px]">
                  ({Math.floor(timeRemaining / 60)}د)
                </span>
              )}
            </div>

            {/* Real Offline Audio Cache Download */}
            <div className="flex flex-col items-end justify-center gap-1">
              <button
                onClick={handleDownloadSurah}
                disabled={isDownloaded || isDownloading}
                className={`py-1 px-2.5 rounded-lg font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDownloaded
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : downloadError
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-950/60'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
                title={
                  isDownloaded
                    ? 'السورة محفوظة بالكامل في ذاكرة المتصفح للاستماع دون إنترنت'
                    : downloadError || 'تخزين تلاوات هذه السورة للعمل دون اتصال بالإنترنت'
                }
              >
                {isDownloaded ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>محفوظة للاستماع دون إنترنت</span>
                  </>
                ) : isDownloading ? (
                  <>
                    <Download className="w-3 h-3 animate-bounce text-emerald-400" />
                    <span>
                      {downloadProgress
                        ? `جارِ الحفظ (${downloadProgress.completed}/${downloadProgress.total})...`
                        : 'جارِ التخزين...'}
                    </span>
                  </>
                ) : downloadError ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span>تعذر التحميل • أعد المحاولة</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 text-slate-400" />
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
