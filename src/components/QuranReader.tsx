import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SurahData,
  Ayah,
  sanitizeAyahText,
  getMushafPageData,
  getSurahAudioSegments,
  MushafPageData,
  MushafPageAyah,
  WordSegment
} from '../data/quranService';
import { recordPageProgress } from '../data/faithAnalyticsService';
import { renderTajweedText, getSpokenWordRawIndices } from '../utils/tajweedParser';
import { resolveActiveWordIndex } from '../utils/kidsHifzStore';
import { safeLocalStorage } from '../utils/safeStorage';
import {
  BookOpen, Sparkles, Columns, Search,
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  Bookmark, HelpCircle, Play, Pause, X, Radio, Hand,
  ChevronDown, ChevronUp, SlidersHorizontal, Volume2,
  ChevronRight, ChevronLeft, RefreshCw, AlertCircle, EyeOff
} from 'lucide-react';
import { Reciter } from '../data/reciters';
import { toArabicIndic } from './khatma/KhatmaRing';
import { READER_PREFS_KEY } from '../utils/userBackup';

export type ReaderTheme = 'parchment' | 'sepia' | 'dark' | 'emerald';
type ReaderMode = 'surah' | 'page';

interface StoredReaderPrefs {
  theme?: ReaderTheme;
  fontSize?: number;
  isTajweedActive?: boolean;
  selectedReciterId?: string;
}

function getDefaultTheme(): ReaderTheme {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (saved?.theme && ['parchment', 'sepia', 'dark', 'emerald'].includes(saved.theme)) {
    return saved.theme;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'parchment';
    }
  }
  return 'dark';
}

function getDefaultFontSize(): number {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.fontSize === 'number' && saved.fontSize >= 20 && saved.fontSize <= 48) {
    return saved.fontSize;
  }
  return 28;
}

interface QuranReaderProps {
  surahData: SurahData;
  activeAyahNumber: number;
  onSelectAyah: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  onAyahAudioSelect?: (ayahNumber: number, surahNumber?: number) => void;
  onOpenShareModal?: (ayah: Ayah) => void;
  onOpenTadabburModal: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  isTajweedActive: boolean;
  onToggleTajweed: () => void;
  isSmartScrollActive: boolean;
  onToggleSmartScroll?: () => void;
  onOpenTajweedLegend: () => void;
  isPlayingAudio?: boolean;
  currentTime?: number;
  duration?: number;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  isAudioBarVisible?: boolean;
  onToggleAudioBar?: () => void;
  selectedReciter?: Reciter;
  onTogglePlayAudio?: () => void;
  onOpenSurahPicker?: () => void;
  onOpenAyahSearch?: () => void;
  prefsReloadNonce?: number;
}

interface AyahSpanProps {
  ayah: Ayah;
  surahNumber: number;
  surahName: string;
  isActive: boolean;
  isBookmarked: boolean;
  isPlayingAudio?: boolean;
  isLightPaper: boolean;
  fontSize: number;
  isTajweedActive: boolean;
  activeWordIndex?: number;
  onSelectAyah: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  onToggleBookmark: (ayahNumber: number, targetSurahNumber?: number) => void;
  onOpenTadabburModal: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  setRef: (el: HTMLSpanElement | null) => void;
}

const AyahSpan = React.memo<AyahSpanProps>(({
  ayah,
  surahNumber,
  surahName,
  isActive,
  isBookmarked,
  isPlayingAudio,
  isLightPaper,
  fontSize,
  isTajweedActive,
  activeWordIndex,
  onSelectAyah,
  onToggleBookmark,
  onOpenTadabburModal,
  setRef
}) => {
  const cleanText = sanitizeAyahText(ayah.text, surahNumber, ayah.numberInSurah);
  const cleanTajweed = ayah.tajweedText ? sanitizeAyahText(ayah.tajweedText, surahNumber, ayah.numberInSurah) : undefined;

  const handleOpenAyah = () => {
    const cleaned = { ...ayah, text: cleanText };
    onSelectAyah(cleaned, surahNumber, surahName);
    onOpenTadabburModal(cleaned, surahNumber, surahName);
  };

  return (
    <span
      ref={setRef}
      className={`relative inline transition-colors duration-200 rounded px-1 group/ayah ${
        isActive
          ? isLightPaper
            ? 'bg-[#1F3A6E]/10'
            : 'bg-[#2E5499]/20'
          : isLightPaper
          ? 'hover:bg-[#8A6418]/10'
          : 'hover:bg-[#D9B45A]/10'
      }`}
      style={{ fontSize: `${fontSize}px` }}
    >
      {renderTajweedText(
        cleanText,
        isTajweedActive,
        handleOpenAyah,
        activeWordIndex,
        cleanTajweed
      )}
      <button
        type="button"
        onClick={handleOpenAyah}
        className="ayah-end-symbol mx-1 inline-flex items-center justify-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] rounded"
        title={`الآية ${toArabicIndic(ayah.numberInSurah)} - انقر للتدبر والتفسير`}
        aria-label={`الآية ${ayah.numberInSurah}، اضغط للتفسير والتدبر`}
      >
        <span
          className={`font-bold transition-transform text-[0.78em] tracking-tight ${
            isActive && isPlayingAudio
              ? isLightPaper
                ? 'text-[#1F3A6E] scale-110'
                : 'text-[#D9B45A] scale-110 drop-shadow-sm'
              : isLightPaper
              ? 'text-[#8A6418] group-hover:scale-110'
              : 'text-[#D9B45A] group-hover:scale-110'
          }`}
        >
          ﴿{toArabicIndic(ayah.numberInSurah)}﴾
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(ayah.numberInSurah, surahNumber);
        }}
        aria-label={isBookmarked ? 'إزالة علامة الوقف' : 'وضع علامة مرجعية على هذه الآية'}
        title={isBookmarked ? 'إزالة علامة الوقف' : 'وضع علامة مرجعية على هذه الآية'}
        className={`inline-flex items-center justify-center align-middle mx-0.5 p-1 rounded transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
          isBookmarked
            ? isLightPaper
              ? 'text-[#8A6418] opacity-100'
              : 'text-[#D9B45A] opacity-100'
            : 'text-slate-400 opacity-0 group-hover/ayah:opacity-90 focus-visible:opacity-100 hover:text-[#D9B45A]'
        }`}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
      </button>
    </span>
  );
}, (prev, next) =>
  prev.ayah.numberInSurah === next.ayah.numberInSurah &&
  prev.ayah.text === next.ayah.text &&
  prev.ayah.tajweedText === next.ayah.tajweedText &&
  prev.surahNumber === next.surahNumber &&
  prev.surahName === next.surahName &&
  prev.isActive === next.isActive &&
  prev.isBookmarked === next.isBookmarked &&
  prev.isPlayingAudio === next.isPlayingAudio &&
  prev.isLightPaper === next.isLightPaper &&
  prev.fontSize === next.fontSize &&
  prev.isTajweedActive === next.isTajweedActive &&
  prev.activeWordIndex === next.activeWordIndex
);

export const QuranReader: React.FC<QuranReaderProps> = ({
  surahData,
  activeAyahNumber,
  onSelectAyah,
  onOpenTadabburModal,
  isTajweedActive,
  onToggleTajweed,
  isSmartScrollActive,
  onToggleSmartScroll,
  onOpenTajweedLegend,
  isPlayingAudio,
  currentTime,
  duration,
  isFullScreen = false,
  onToggleFullScreen,
  isAudioBarVisible = true,
  onToggleAudioBar,
  selectedReciter,
  onTogglePlayAudio,
  onOpenSurahPicker,
  onOpenAyahSearch,
  prefsReloadNonce = 0,
}) => {
  const [fontSize, setFontSize] = useState<number>(() => getDefaultFontSize());
  const [readerMode, setReaderMode] = useState<ReaderMode>('surah');
  const [mushafPageNumber, setMushafPageNumber] = useState<number>(() => surahData.meta.startPage || 1);
  const [pageInputDraft, setPageInputDraft] = useState<string>(() => String(surahData.meta.startPage || 1));
  const [pageData, setPageData] = useState<MushafPageData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReloadTrigger, setPageReloadTrigger] = useState<number>(0);

  const [isDualPage, setIsDualPage] = useState<boolean>(false);
  const [theme, setTheme] = useState<ReaderTheme>(() => getDefaultTheme());
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);
  const [segmentsBySurahKey, setSegmentsBySurahKey] = useState<Record<string, Record<number, WordSegment[]>>>({});

  // Sync reader preferences when restored from backup
  useEffect(() => {
    if (prefsReloadNonce > 0) {
      setTheme(getDefaultTheme());
      setFontSize(getDefaultFontSize());
    }
  }, [prefsReloadNonce]);

  // Persist fontSize & theme cleanly in localStorage
  useEffect(() => {
    const prev = safeLocalStorage.getJSON<StoredReaderPrefs>(READER_PREFS_KEY, {});
    safeLocalStorage.setJSON(READER_PREFS_KEY, {
      ...prev,
      theme,
      fontSize,
    });
  }, [theme, fontSize]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ayahRefs = useRef<Record<string, HTMLElement | null>>({});

  // Keep latest audio timing & active ayah in refs so 60fps engines don't tear down smoothly running loops
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const activeAyahNumberRef = useRef(activeAyahNumber);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  activeAyahNumberRef.current = activeAyahNumber;
  const fetchedSegmentKeysRef = useRef<Set<string>>(new Set());

  // Keep mushafPageNumber aligned with active ayah's page while in Surah mode
  useEffect(() => {
    if (readerMode === 'surah') {
      const matched = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
      const targetPage = matched?.page || surahData.meta.startPage || 1;
      setMushafPageNumber(targetPage);
      setPageInputDraft(String(targetPage));
    }
  }, [readerMode, surahData.meta.number, surahData.meta.startPage, activeAyahNumber, surahData.ayahs]);

  // Fetch genuine 604-page Mushaf data when Page mode is active
  useEffect(() => {
    if (readerMode !== 'page') return;
    let isCancelled = false;
    setIsLoadingPage(true);
    setPageError(null);

    getMushafPageData(mushafPageNumber)
      .then((data) => {
        if (!isCancelled) {
          setPageData(data);
          setIsLoadingPage(false);
          recordPageProgress(mushafPageNumber);
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            preciseScrollTop.current = 0;
            lastProgrammaticScrollTopRef.current = 0;
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setPageError(err instanceof Error ? err.message : 'تعذر تحميل صفحة المصحف');
          setIsLoadingPage(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [readerMode, mushafPageNumber, pageReloadTrigger]);

  // Fetch authentic Quran.com word-timing segments for active surah(s) & reciter
  useEffect(() => {
    const recId = selectedReciter?.quranComRecitationId;
    if (!recId) return;

    const targetSurahs = new Set<number>([surahData.meta.number]);
    if (readerMode === 'page' && pageData) {
      pageData.ayahs.forEach((a) => targetSurahs.add(a.surahNumber));
    }

    let cancelled = false;
    targetSurahs.forEach((sNum) => {
      const cacheKey = `${recId}:${sNum}`;
      if (fetchedSegmentKeysRef.current.has(cacheKey)) return;
      fetchedSegmentKeysRef.current.add(cacheKey);

      getSurahAudioSegments(recId, sNum)
        .then((segs) => {
          if (Object.keys(segs).length === 0) {
            fetchedSegmentKeysRef.current.delete(cacheKey);
            return;
          }
          if (!cancelled) {
            setSegmentsBySurahKey((prev) => ({ ...prev, [cacheKey]: segs }));
          }
        })
        .catch(() => {
          fetchedSegmentKeysRef.current.delete(cacheKey);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedReciter?.quranComRecitationId, surahData.meta.number, readerMode, pageData]);

  // Unified Auto-Scroll Engine state (Dual-Mode: Reciter-Adaptive Sync OR Manual Self-Reading)
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);
  const [scrollMode, setScrollMode] = useState<'reciter-sync' | 'manual-speed'>('reciter-sync');
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(2); // 1 to 5
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState<boolean>(false);
  const [isFloatingSpeedOpen, setIsFloatingSpeedOpen] = useState<boolean>(false);
  const [pauseAtAyahEnds, setPauseAtAyahEnds] = useState<boolean>(false); // Continuous smooth scrolling without stopping at ayah ends
  const [isPausedAtAyah, setIsPausedAtAyah] = useState<boolean>(false);
  const [pausedAyahNumber, setPausedAyahNumber] = useState<number | null>(null);
  const pausedAyahsHistory = useRef<Set<number>>(new Set());

  // Subpixel floating accumulator & touch/momentum synchronization refs
  const preciseScrollTop = useRef<number>(0);
  const lastProgrammaticScrollTopRef = useRef<number>(0);
  const isTouchActive = useRef<boolean>(false);
  const isManualOverrideRef = useRef<boolean>(false);
  const isEngineActive = isAutoScrolling || (isPlayingAudio && isSmartScrollActive);
  const isEngineActiveRef = useRef<boolean>(isEngineActive);
  isEngineActiveRef.current = isEngineActive;

  // Touch & Gesture Guard (stops scroller from fighting user's thumb, momentum, or wheel)
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseAyahTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
    };
  }, []);

  // Reset manual interaction state when auto-reading engine stops
  useEffect(() => {
    if (!isEngineActive) {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      isTouchActive.current = false;
      isManualOverrideRef.current = false;
      setIsUserInteracting(false);
    }
  }, [isEngineActive]);

  // Synchronize precise scroll accumulator whenever container, surah, or mode changes
  useEffect(() => {
    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      preciseScrollTop.current = top;
      lastProgrammaticScrollTopRef.current = top;
    }
  }, [surahData.meta.number, isAutoScrolling, autoScrollSpeed]);

  const scheduleManualResume = (delayMs?: number) => {
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    const waitMs = delayMs ?? (isPlayingAudio && scrollModeRef.current === 'reciter-sync' ? 2400 : 1200);
    interactionTimeoutRef.current = setTimeout(() => {
      if (isTouchActive.current) return;
      isManualOverrideRef.current = false;
      setIsUserInteracting(false);
      if (containerRef.current) {
        const currentTop = containerRef.current.scrollTop;
        preciseScrollTop.current = currentTop;
        lastProgrammaticScrollTopRef.current = currentTop;
      }
    }, waitMs);
  };

  const activateManualOverride = (clearAyahPauseHistory = false) => {
    if (containerRef.current) {
      const currentTop = containerRef.current.scrollTop;
      preciseScrollTop.current = currentTop;
      lastProgrammaticScrollTopRef.current = currentTop;
    }

    if (!isEngineActiveRef.current) return;

    isManualOverrideRef.current = true;
    setIsUserInteracting(true);

    if (pauseAyahTimeoutRef.current) {
      clearTimeout(pauseAyahTimeoutRef.current);
      pauseAyahTimeoutRef.current = null;
    }
    setIsPausedAtAyah(false);
    setPausedAyahNumber(null);

    if (clearAyahPauseHistory) {
      pausedAyahsHistory.current.clear();
    }
  };

  // Touch & Gesture Handlers: full manual rewind & advance without snapping back or fighting inertia
  const handleTouchStart = () => {
    isTouchActive.current = true;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    activateManualOverride(false);
  };

  const handleTouchMove = () => {
    isTouchActive.current = true;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    activateManualOverride(true);
  };

  const handleTouchEnd = () => {
    isTouchActive.current = false;
    if (containerRef.current) {
      const currentTop = containerRef.current.scrollTop;
      preciseScrollTop.current = currentTop;
      lastProgrammaticScrollTopRef.current = currentTop;
    }
    if (isEngineActiveRef.current) {
      isManualOverrideRef.current = true;
      setIsUserInteracting(true);
      scheduleManualResume();
    }
  };

  const handleWheel = () => {
    activateManualOverride(true);
    if (isEngineActiveRef.current) {
      scheduleManualResume();
    }
  };

  const handleContainerScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const currentTop = container.scrollTop;
    const isDeltaManual = Math.abs(currentTop - lastProgrammaticScrollTopRef.current) > 2.5;

    // Catch touch drag, post-touchend inertial fling momentum, scrollbar drag, and wheel/keyboard scroll
    if (isTouchActive.current || isDeltaManual) {
      preciseScrollTop.current = currentTop;
      lastProgrammaticScrollTopRef.current = currentTop;

      if (isEngineActiveRef.current && isDeltaManual) {
        isManualOverrideRef.current = true;
        setIsUserInteracting(true);
        pausedAyahsHistory.current.clear();

        if (!isTouchActive.current) {
          scheduleManualResume();
        }
      }
    }
  };

  // Clear paused history when surah changes or auto-scroll starts
  useEffect(() => {
    pausedAyahsHistory.current.clear();
    if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
    setIsPausedAtAyah(false);
    setPausedAyahNumber(null);
  }, [surahData.meta.number, isAutoScrolling]);

  // Synchronize reciter mode when audio starts or stops (without trapping manual mode changes)
  const prevIsPlayingAudioRef = useRef(isPlayingAudio);
  const scrollModeRef = useRef(scrollMode);
  scrollModeRef.current = scrollMode;

  useEffect(() => {
    const wasPlaying = prevIsPlayingAudioRef.current;
    prevIsPlayingAudioRef.current = isPlayingAudio;

    if (!wasPlaying && isPlayingAudio) {
      if (isSmartScrollActive) {
        setIsAutoScrolling(true);
      }
      setScrollMode('reciter-sync');
      setIsAutoScrollPaused(false);
    } else if (wasPlaying && !isPlayingAudio) {
      if (scrollModeRef.current === 'reciter-sync') {
        setIsAutoScrolling(false);
      }
    }
  }, [isPlayingAudio, isSmartScrollActive]);

  // 60 FPS Unified Auto-Scroll Engine (Voice Sync Gliding + Free Self-Reading)
  useEffect(() => {
    if (!isEngineActive || isAutoScrollPaused || isPausedAtAyah) return;

    let animId: number;
    let lastTime = performance.now();
    // Calibrated speed table for Arabic reading: px per second
    // Shifted down by 1 level: 1x: 15px/s, 2x: 24px/s, 3x: 40px/s, 4x: 64px/s, 5x: 95px/s
    const speedTable = [15, 24, 40, 64, 95];
    const pxPerSec = speedTable[autoScrollSpeed - 1] || 24;

    // Ensure accumulator starts from current scroll position
    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      preciseScrollTop.current = top;
      lastProgrammaticScrollTopRef.current = top;
    }

    const scrollLoop = (now: number) => {
      const container = containerRef.current;
      if (!container) return;

      const elapsed = (now - lastTime) / 1000;
      lastTime = now;

      // Yield completely while user is touching, dragging, or inertial momentum is gliding
      if (isTouchActive.current || isManualOverrideRef.current) {
        preciseScrollTop.current = container.scrollTop;
        animId = requestAnimationFrame(scrollLoop);
        return;
      }

      // MODE 1: VOICE RECITATION TRACKER (المزامنة الذكية مع صوت وتلاوة الشيخ)
      if (isPlayingAudio && scrollMode === 'reciter-sync') {

        const el = ayahRefs.current[`${surahData.meta.number}:${activeAyahNumberRef.current}`];
        if (el) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();

          // Ayah's position relative to container's scroll surface
          const elRelativeTop = elRect.top - containerRect.top + container.scrollTop;

          // Intra-ayah progression through words/lines
          const curDur = durationRef.current;
          const curTime = currentTimeRef.current;
          const progress = (curDur && curDur > 0)
            ? Math.max(0, Math.min(1, (curTime || 0) / curDur))
            : 0;

          // Progressively shift focal line down long multi-line verses
          const intraOffset = progress * Math.max(0, elRect.height - 35);

          // Optimal focal zone: keep active recitation at ~38% from top of container
          const targetScrollTop = Math.max(
            0,
            Math.min(
              container.scrollHeight - container.clientHeight,
              elRelativeTop + intraOffset - (containerRect.height * 0.38)
            )
          );

          // Damping interpolation: 0.08 produces silky 60fps tracking without jumps
          const diff = targetScrollTop - container.scrollTop;
          if (Math.abs(diff) > 0.8) {
            container.scrollTop += diff * 0.08;
            const actualTop = container.scrollTop;
            preciseScrollTop.current = actualTop;
            lastProgrammaticScrollTopRef.current = actualTop;
          }
        }
      }
      // MODE 2: SELF-READING FREE SPEED (قراءة ذاتية حرة بسرعات 1 إلى 5 مع تراكم دقيق للبيكسلات)
      else {
        if (elapsed > 0 && elapsed < 0.2) {
          // Accumulate floating subpixel distance so speeds 1, 2, 3 never get truncated by browser DOM
          preciseScrollTop.current += pxPerSec * elapsed;

          // Check if reached bottom of surah
          const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
          if (preciseScrollTop.current >= maxScroll - 4) {
            container.scrollTop = maxScroll;
            lastProgrammaticScrollTopRef.current = container.scrollTop;
            setIsAutoScrolling(false);
            return;
          }

          // Apply to DOM scroll position
          container.scrollTop = preciseScrollTop.current;
          lastProgrammaticScrollTopRef.current = container.scrollTop;

          // Reflective pause at verse end symbols ﴿۝﴾ (if user toggles it on)
          if (pauseAtAyahEnds) {
            const containerRect = container.getBoundingClientRect();
            const focalLine = containerRect.top + containerRect.height * 0.40;

            for (const ayah of surahData.ayahs) {
              const num = ayah.numberInSurah;
              if (pausedAyahsHistory.current.has(num)) continue;

              const el = ayahRefs.current[`${surahData.meta.number}:${num}`];
              if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.bottom >= focalLine - 16 && rect.bottom <= focalLine + 16) {
                  pausedAyahsHistory.current.add(num);
                  setIsPausedAtAyah(true);
                  setPausedAyahNumber(num);

                  if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
                  pauseAyahTimeoutRef.current = setTimeout(() => {
                    setIsPausedAtAyah(false);
                    setPausedAyahNumber(null);
                    if (containerRef.current) {
                      const top = containerRef.current.scrollTop;
                      preciseScrollTop.current = top;
                      lastProgrammaticScrollTopRef.current = top;
                    }
                  }, 1300);
                  return;
                }
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(scrollLoop);
    };

    animId = requestAnimationFrame(scrollLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    isEngineActive,
    isAutoScrolling,
    isSmartScrollActive,
    isPlayingAudio,
    scrollMode,
    isAutoScrollPaused,
    isPausedAtAyah,
    autoScrollSpeed,
    pauseAtAyahEnds,
    surahData.meta.number,
    surahData.ayahs
  ]);

  // Load saved bookmark (resets state if new surah has no saved bookmark)
  useEffect(() => {
    const saved = safeLocalStorage.getItem(`bayan_bookmark_${surahData.meta.number}`);
    if (saved) {
      setBookmarkedAyah(Number(saved));
    } else {
      setBookmarkedAyah(null);
    }
  }, [surahData.meta.number]);

  const handleToggleBookmark = (ayahNum: number, targetSurahNum = surahData.meta.number) => {
    if (targetSurahNum === surahData.meta.number) {
      setBookmarkedAyah((prev) => {
        if (prev === ayahNum) {
          safeLocalStorage.removeItem(`bayan_bookmark_${targetSurahNum}`);
          return null;
        }
        safeLocalStorage.setItem(`bayan_bookmark_${targetSurahNum}`, String(ayahNum));
        return ayahNum;
      });
      return;
    }

    const existing = safeLocalStorage.getItem(`bayan_bookmark_${targetSurahNum}`);
    if (existing === String(ayahNum)) {
      safeLocalStorage.removeItem(`bayan_bookmark_${targetSurahNum}`);
    } else {
      safeLocalStorage.setItem(`bayan_bookmark_${targetSurahNum}`, String(ayahNum));
    }
  };

  const isLightPaper = theme === 'parchment' || theme === 'sepia';

  // Determine container styling based on theme
  const getThemeClasses = () => {
    switch (theme) {
      case 'parchment':
        return 'mushaf-paper-parchment bg-[#F6EFDD] text-[#1B1A17] border-[#D9B45A]/55';
      case 'sepia':
        return 'mushaf-paper-sepia bg-[#f4eedb] text-[#292524] border-amber-900/25';
      case 'emerald':
        return 'mushaf-paper-emerald bg-[#061914] text-[#e6f7f2] border-[#D9B45A]/30';
      default:
        return 'mushaf-paper-dark bg-[#10161F] text-[#E9E3D3] border-[#D9B45A]/25';
    }
  };

  const getBorderColor = () => {
    switch (theme) {
      case 'parchment':
        return '#8A6418';
      case 'sepia':
        return '#8A6418';
      case 'emerald':
        return '#D9B45A';
      default:
        return '#D9B45A';
    }
  };

  // Divide ayahs into two pages if Dual Page mode is active
  const midPoint = Math.ceil(surahData.ayahs.length / 2);
  const rightPageAyahs = isDualPage ? surahData.ayahs.slice(0, midPoint) : surahData.ayahs;
  const leftPageAyahs = isDualPage ? surahData.ayahs.slice(midPoint) : [];

  // Group 604-page Mushaf ayahs by Surah so multi-surah pages render headers & Bismillahs cleanly
  const pageSurahGroups = useMemo(() => {
    if (!pageData) return [];
    const groups: {
      surahNumber: number;
      surahName: string;
      revelationTypeAr: 'مكية' | 'مدنية';
      bismillahPre: boolean;
      startsAtAyahOne: boolean;
      ayahs: MushafPageAyah[];
    }[] = [];

    for (const ayah of pageData.ayahs) {
      const last = groups[groups.length - 1];
      if (!last || last.surahNumber !== ayah.surahNumber) {
        groups.push({
          surahNumber: ayah.surahNumber,
          surahName: ayah.surahName,
          revelationTypeAr: ayah.revelationTypeAr,
          bismillahPre: ayah.bismillahPre,
          startsAtAyahOne: ayah.numberInSurah === 1,
          ayahs: [ayah],
        });
      } else {
        last.ayahs.push(ayah);
      }
    }
    return groups;
  }, [pageData]);

  // Helper to resolve active word index (authentic 1-based segment timestamps first, waqf-aware proportional fallback)
  const computeActiveWordIndex = (ayah: Ayah, targetSurahNum: number): number | undefined => {
    const isActive = targetSurahNum === surahData.meta.number && activeAyahNumber === ayah.numberInSurah;
    if (!isActive || !isPlayingAudio || !duration || duration <= 0) return undefined;

    const cleanText = sanitizeAyahText(ayah.text, targetSurahNum, ayah.numberInSurah);
    const words = cleanText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return undefined;

    const spokenIndices = getSpokenWordRawIndices(words);
    const recId = selectedReciter?.quranComRecitationId;
    const segs = recId ? segmentsBySurahKey[`${recId}:${targetSurahNum}`]?.[ayah.numberInSurah] : undefined;

    const spokenIdx = resolveActiveWordIndex(
      segs,
      (currentTime || 0) * 1000,
      duration * 1000,
      spokenIndices.length
    );

    if (spokenIdx < 0) return undefined;
    return spokenIndices[spokenIdx];
  };

  const handleStepMushafPage = (delta: number) => {
    setMushafPageNumber((prev) => {
      const next = Math.min(604, Math.max(1, prev + delta));
      setPageInputDraft(String(next));
      return next;
    });
  };

  const handleJumpMushafPage = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInputDraft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(604, Math.max(1, parsed));
      setMushafPageNumber(clamped);
      setPageInputDraft(String(clamped));
    } else {
      setPageInputDraft(String(mushafPageNumber));
    }
  };

  const effectiveFullScreen = isFullScreen || isZenMode;

  // Helper to render Split Auto-Reading Button in both normal toolbar and floating full-screen pill
  const renderAutoScrollSplitButton = (isFloating: boolean = false) => {
    const isCurrentlyActive = isAutoScrolling || (isPlayingAudio && isSmartScrollActive);

    return (
      <div className="relative inline-flex items-center">
        <div className={`inline-flex items-stretch rounded-xl border text-xs font-bold transition-all shadow-md overflow-hidden ${
          isCurrentlyActive
            ? (isPlayingAudio && scrollMode === 'reciter-sync')
              ? 'bg-[#1F3A6E] border-[#648CD4] text-[#F6EFDD] ring-1 ring-[#648CD4]'
              : 'bg-[#D9B45A] border-[#F6EFDD]/60 text-[#1B1A17] ring-1 ring-[#D9B45A]'
            : 'bg-slate-800/90 border-slate-700 text-[#F6EFDD] hover:bg-slate-700'
        }`}>
          {/* Main Action: Click to start or stop auto-reading instantly */}
          <button
            type="button"
            onClick={() => {
              if (isCurrentlyActive) {
                setIsAutoScrolling(false);
                setIsAutoScrollPaused(false);
                if (isPlayingAudio && onToggleSmartScroll) {
                  onToggleSmartScroll();
                }
              } else {
                setIsAutoScrolling(true);
                setIsAutoScrollPaused(false);
                if (isPlayingAudio) {
                  setScrollMode('reciter-sync');
                  if (!isSmartScrollActive && onToggleSmartScroll) {
                    onToggleSmartScroll();
                  }
                }
              }
            }}
            className={`${isFloating ? 'min-h-[34px] py-1 px-2.5' : 'min-h-[38px] py-1.5 px-2.5 sm:px-3'} flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer focus-visible:outline-none`}
            title={isAutoScrolling ? 'انقر لإيقاف القراءة الآلية' : 'انقر لتشغيل القراءة الآلية'}
          >
            {isPlayingAudio && scrollMode === 'reciter-sync' ? (
              <>
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline whitespace-nowrap">مزامنة القارئ</span>
                <span className="sm:hidden whitespace-nowrap">مزامنة</span>
              </>
            ) : (
              <>
                {isCurrentlyActive ? (
                  <Pause className="w-3.5 h-3.5 fill-current text-[#1B1A17]" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-[#D9B45A] text-[#D9B45A]" />
                )}
                <span className="hidden sm:inline whitespace-nowrap">{isCurrentlyActive ? 'إيقاف القراءة' : 'قراءة آلية'}</span>
                <span className="sm:hidden whitespace-nowrap">{isCurrentlyActive ? 'إيقاف' : 'آلية'}</span>
              </>
            )}
          </button>

          {/* Vertical divider */}
          <div className={`w-[1px] my-1 ${
            isCurrentlyActive
              ? (isPlayingAudio && scrollMode === 'reciter-sync')
                ? 'bg-[#648CD4]/50'
                : 'bg-[#8A6418]/50'
              : 'bg-slate-700'
          }`} />

          {/* Speed / Mode indicator & popover dropdown toggle */}
          <button
            type="button"
            onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
            aria-expanded={isSpeedMenuOpen}
            aria-label="ضبط سرعة القراءة الآلية"
            className={`${isFloating ? 'min-h-[34px] px-2 py-1' : 'min-h-[38px] px-2.5 py-1.5'} flex items-center gap-0.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer font-bold text-[11px] tabular-nums`}
            title="تحديد سرعة القراءة والخيارات (1x - 5x)"
          >
            <span>{isPlayingAudio && scrollMode === 'reciter-sync' ? 'تلاوة' : `${autoScrollSpeed}x`}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isSpeedMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown Popover Card */}
        {isSpeedMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={() => setIsSpeedMenuOpen(false)}
            />

            <div className={`fixed sm:absolute ${isFloating ? 'top-14 sm:top-12' : 'top-20 sm:top-full'} inset-x-3 sm:inset-x-auto sm:start-0 sm:mt-2 z-50 w-auto sm:w-80 max-w-[calc(100vw-1.5rem)] p-3.5 rounded-2xl bg-[#10161f] border border-[#D9B45A]/30 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-3`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#F6EFDD]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#D9B45A]" />
                  <span>إعدادات وسرعة القراءة الآلية</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSpeedMenuOpen(false)}
                  aria-label="إغلاق"
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {isPlayingAudio && (
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block">نمط النزول مع التلاوة:</span>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setScrollMode('reciter-sync');
                        if (!isAutoScrolling) setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`min-h-[36px] py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        scrollMode === 'reciter-sync'
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Radio className="w-3 h-3" />
                      <span>مزامنة القارئ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScrollMode('manual-speed');
                        if (!isAutoScrolling) setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`min-h-[36px] py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        scrollMode === 'manual-speed'
                          ? 'bg-[#D9B45A] text-[#1B1A17] shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>سرعة حرة (1x-5x)</span>
                    </button>
                  </div>
                </div>
              )}

              {(!isPlayingAudio || scrollMode === 'manual-speed') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">سرعة القراءة الذاتية:</span>
                    <span className="text-[#D9B45A] font-bold tabular-nums">{autoScrollSpeed}x</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { level: 1, label: '1x (هدوء وتدبر عميق)' },
                      { level: 2, label: '2x (متأنٍ ومريح)' },
                      { level: 3, label: '3x (معتدل وطبيعي)' },
                      { level: 4, label: '4x (متوسط وسلس)' },
                      { level: 5, label: '5x (سريع وحدر)' },
                    ].map((s) => (
                      <button
                        key={s.level}
                        type="button"
                        onClick={() => {
                          setAutoScrollSpeed(s.level);
                          setScrollMode('manual-speed');
                          if (!isAutoScrolling) setIsAutoScrolling(true);
                          setIsAutoScrollPaused(false);
                        }}
                        className={`min-h-[38px] py-2 rounded-xl font-bold text-xs tabular-nums flex items-center justify-center transition-all cursor-pointer ${
                          autoScrollSpeed === s.level
                            ? 'bg-[#1F3A6E] text-[#F6EFDD] shadow-md ring-2 ring-[#D9B45A]'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                        }`}
                        title={s.label}
                      >
                        <span>{s.level}x</span>
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    {autoScrollSpeed === 1 && '1x: قراءة بطيئة جداً وهادئة للتدبر والتأمل'}
                    {autoScrollSpeed === 2 && '2x: قراءة متأنية ومريحة للعين'}
                    {autoScrollSpeed === 3 && '3x: السرعة الطبيعية المعتدلة للورد اليومي'}
                    {autoScrollSpeed === 4 && '4x: قراءة مسترسلة سلسة'}
                    {autoScrollSpeed === 5 && '5x: حدر ومراجعة سريعة للحفاظ'}
                  </p>
                </div>
              )}

              {(!isPlayingAudio || scrollMode === 'manual-speed') && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPauseAtAyahEnds(!pauseAtAyahEnds)}
                    className={`w-full min-h-[38px] py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      !pauseAtAyahEnds
                        ? 'bg-[#1F3A6E]/45 border-[#648CD4]/45 text-[#F6EFDD]'
                        : 'bg-[#D9B45A]/15 border-[#D9B45A]/50 text-[#D9B45A]'
                    }`}
                  >
                    <span className="text-[11px] text-slate-300">حركة النزول:</span>
                    <span className="font-bold">{!pauseAtAyahEnds ? 'انسياب مستمر' : 'وقفة عند رأس الآية'}</span>
                  </button>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  الحالة: {isAutoScrolling ? 'نشطة' : 'متوقفة'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsSpeedMenuOpen(false)}
                    className="min-h-[34px] py-1 px-2.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAutoScrolling;
                      setIsAutoScrolling(next);
                      setIsAutoScrollPaused(false);
                      if (next && scrollMode === 'reciter-sync' && !isPlayingAudio) {
                        setScrollMode('manual-speed');
                      }
                    }}
                    className={`min-h-[34px] py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isAutoScrolling
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50 hover:bg-[#2E5499] shadow-md'
                    }`}
                  >
                    {isAutoScrolling ? 'إيقاف' : 'بدء القراءة'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col transition-all duration-300 ${effectiveFullScreen ? 'fixed inset-0 z-50 p-2 sm:p-5 bg-[#0b1017]' : 'w-full'}`}>

      {/* Floating Exit & Auto-Reading Pill in Full Screen Mode */}
      {effectiveFullScreen && (
        <div className="sticky top-2 z-50 mb-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-[#10161f]/95 border border-[#D9B45A]/30 shadow-2xl backdrop-blur-md max-w-fit mx-auto text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 text-[#D9B45A] font-bold text-xs pl-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">سورة {surahData.meta.name}</span>
            <span className="sm:hidden">{surahData.meta.name}</span>
          </div>

          <div className="w-[1px] h-4 bg-slate-700" />

          {onTogglePlayAudio && (
            <>
              <button
                type="button"
                onClick={onTogglePlayAudio}
                className={`min-h-[34px] flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isPlayingAudio
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-800 text-[#F6EFDD] hover:text-white border border-slate-700'
                }`}
                title={isPlayingAudio ? 'إيقاف تلاوة الشيخ مؤقتاً' : 'الاستماع لتلاوة الشيخ للآية الحالية'}
              >
                {isPlayingAudio ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{selectedReciter ? selectedReciter.name.split(' ')[0] : 'تلاوة'}</span>
                    <Pause className="w-3 h-3 text-emerald-300" />
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                    <span className="hidden sm:inline">تلاوة</span>
                    <Play className="w-3 h-3 text-[#D9B45A] ml-0.5" />
                  </>
                )}
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />
            </>
          )}

          {onToggleAudioBar && (
            <>
              <button
                type="button"
                onClick={onToggleAudioBar}
                aria-label={isAudioBarVisible ? 'إخفاء الشريط الصوتي' : 'إظهار مشغل التلاوة'}
                className={`min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  isAudioBarVisible
                    ? 'bg-[#1F3A6E]/55 text-[#D9B45A] border border-[#648CD4]/40'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
                title={isAudioBarVisible ? 'إخفاء الشريط الصوتي للقراءة بالعين' : 'إظهار مشغّل التلاوة'}
              >
                {isAudioBarVisible ? <EyeOff className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isAudioBarVisible ? 'إخفاء الصوت' : 'المشغّل'}</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />
            </>
          )}

          {isAudioBarVisible && (
            <>
              {renderAutoScrollSplitButton(true)}
              <div className="w-[1px] h-4 bg-slate-700" />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (onToggleFullScreen) onToggleFullScreen();
              setIsZenMode(false);
            }}
            className="min-h-[34px] flex items-center gap-1 py-1 px-2.5 rounded-full bg-[#D9B45A]/15 hover:bg-[#D9B45A]/25 border border-[#D9B45A]/40 text-[#D9B45A] font-bold text-xs transition-all shadow-sm cursor-pointer"
            title="خروج من وضع ملء الشاشة"
          >
            <Minimize2 className="w-3 h-3" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      )}

      {/* Compact Single-Row Reader Command Bar (Maximizes Mus'haf Viewport Space) */}
      {!effectiveFullScreen && (
        <div className="mb-3 relative z-30">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[#10161f]/90 border border-slate-800/90 shadow-md backdrop-blur-md">
            {/* Start: Surah Picker + Metadata */}
            <div className="flex items-center gap-2.5 min-w-0">
              {onOpenSurahPicker && (
                <button
                  type="button"
                  onClick={onOpenSurahPicker}
                  className="min-h-[40px] py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-[#D9B45A]/35 text-xs text-[#F6EFDD] font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#D9B45A]" />
                  <span>سورة {surahData.meta.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                <span>{surahData.meta.revelationTypeAr}</span>
                <span aria-hidden="true">·</span>
                <span>{toArabicIndic(surahData.meta.numberOfAyahs)} آية</span>
                <span aria-hidden="true">·</span>
                <span>الجزء {toArabicIndic(surahData.meta.juzNumber)}</span>
                <span aria-hidden="true">·</span>
                <span>ص {toArabicIndic(mushafPageNumber)}</span>
              </div>
            </div>

            {/* End: Essential Controls + Collapsible Display Settings Sheet */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isAudioBarVisible && renderAutoScrollSplitButton(false)}

              {onOpenAyahSearch && (
                <button
                  type="button"
                  onClick={onOpenAyahSearch}
                  aria-label="بحث في آيات القرآن"
                  title="بحث في آيات القرآن"
                  className="min-w-[40px] min-h-[40px] py-1.5 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]"
                >
                  <Search className="w-3.5 h-3.5 text-[#D9B45A]" />
                  <span className="hidden sm:inline">بحث</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleToggleBookmark(activeAyahNumber)}
                aria-label={
                  bookmarkedAyah === activeAyahNumber
                    ? `إزالة العلامة المرجعية عن الآية ${activeAyahNumber}`
                    : `حفظ علامة مرجعية على الآية ${activeAyahNumber}`
                }
                title={
                  bookmarkedAyah === activeAyahNumber
                    ? `إزالة العلامة المرجعية عن الآية ${activeAyahNumber}`
                    : `حفظ علامة مرجعية على الآية ${activeAyahNumber}`
                }
                className={`min-w-[40px] min-h-[40px] p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                  bookmarkedAyah === activeAyahNumber
                    ? 'border-[#D9B45A]/60 bg-[#D9B45A]/15 text-[#D9B45A]'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-[#D9B45A]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${bookmarkedAyah === activeAyahNumber ? 'fill-current' : ''}`} />
              </button>

              {/* Unified Collapsible Reader Display & Settings Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDisplaySettingsOpen((prev) => !prev)}
                  aria-expanded={isDisplaySettingsOpen}
                  aria-label="إعدادات المصحف والعرض"
                  title="إعدادات الخط والورق والتجويد والعرض"
                  className={`min-w-[40px] min-h-[40px] py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                    isDisplaySettingsOpen
                      ? 'bg-[#1F3A6E] border-[#648CD4] text-[#F6EFDD]'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#D9B45A]" />
                  <span className="hidden sm:inline">العرض</span>
                </button>

                {isDisplaySettingsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
                      onClick={() => setIsDisplaySettingsOpen(false)}
                    />
                    <div className="fixed sm:absolute top-20 sm:top-full inset-x-3 sm:inset-x-auto sm:end-0 sm:mt-2 z-50 w-auto sm:w-80 max-w-[calc(100vw-1.5rem)] p-4 rounded-2xl bg-[#10161f] border border-[#D9B45A]/30 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="font-bold text-xs text-[#F6EFDD]">مظهر المصحف والقراءة</span>
                        <button
                          type="button"
                          onClick={() => setIsDisplaySettingsOpen(false)}
                          aria-label="إغلاق إعدادات العرض"
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Reader Mode */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-slate-400 font-semibold block">نمط التصفح:</span>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                          <button
                            type="button"
                            onClick={() => setReaderMode('surah')}
                            className={`min-h-[36px] py-1.5 px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                              readerMode === 'surah'
                                ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            السورة كاملة
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaderMode('page')}
                            className={`min-h-[36px] py-1.5 px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                              readerMode === 'page'
                                ? 'bg-[#D9B45A] text-[#1B1A17]'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            المصحف (٦٠٤)
                          </button>
                        </div>
                      </div>

                      {/* Font Size */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300 font-semibold">حجم الخط القرآني:</span>
                        <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-xs tabular-nums">
                          <button
                            type="button"
                            onClick={() => setFontSize(prev => Math.max(20, prev - 2))}
                            aria-label="تصغير الخط"
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                            title="تصغير الخط"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[#D9B45A] font-bold px-1.5 min-w-[2.5rem] text-center">{toArabicIndic(fontSize)}</span>
                          <button
                            type="button"
                            onClick={() => setFontSize(prev => Math.min(48, prev + 2))}
                            aria-label="تكبير الخط"
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                            title="تكبير الخط"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mushaf Paper Swatches */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-300 font-semibold">لون ورق المصحف:</span>
                        <div className="flex items-center gap-1.5" role="group" aria-label="لون ورق المصحف">
                          <button
                            type="button"
                            onClick={() => setTheme('parchment')}
                            aria-label="بردية نهارية دافئة"
                            className={`w-7 h-7 rounded-lg bg-[#F6EFDD] border cursor-pointer ${theme === 'parchment' ? 'ring-2 ring-[#D9B45A] border-[#1B1A17]' : 'border-slate-500'}`}
                            title="ورق المصحف النهاري (Parchment)"
                          />
                          <button
                            type="button"
                            onClick={() => setTheme('sepia')}
                            aria-label="ورق عاجي"
                            className={`w-7 h-7 rounded-lg bg-[#f4eedb] border cursor-pointer ${theme === 'sepia' ? 'ring-2 ring-[#D9B45A] border-amber-900' : 'border-amber-700/60'}`}
                            title="ورق المصحف العاجي"
                          />
                          <button
                            type="button"
                            onClick={() => setTheme('dark')}
                            aria-label="حبر ليلي"
                            className={`w-7 h-7 rounded-lg bg-[#10161F] border cursor-pointer ${theme === 'dark' ? 'ring-2 ring-[#D9B45A] border-white' : 'border-slate-600'}`}
                            title="حبر ليلي داكن"
                          />
                          <button
                            type="button"
                            onClick={() => setTheme('emerald')}
                            aria-label="الزمرد الليلي"
                            className={`w-7 h-7 rounded-lg bg-[#061914] border cursor-pointer ${theme === 'emerald' ? 'ring-2 ring-[#D9B45A] border-white' : 'border-emerald-800'}`}
                            title="الزمرد الليلي"
                          />
                        </div>
                      </div>

                      {/* Tajweed & Dual Page toggles */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={onToggleTajweed}
                          className={`min-h-[38px] py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                            isTajweedActive
                              ? 'bg-[#1F3A6E]/60 border-[#648CD4]/60 text-[#D9B45A]'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>ألوان التجويد</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsDisplaySettingsOpen(false);
                            onOpenTajweedLegend();
                          }}
                          className="min-h-[38px] py-1.5 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-[#648CD4]" />
                          <span>دليل التجويد</span>
                        </button>
                      </div>

                      {/* Dual Page + Audio Bar Toggle + Fullscreen */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                        {onToggleAudioBar && (
                          <button
                            type="button"
                            onClick={onToggleAudioBar}
                            className={`min-h-[38px] py-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                              !isAudioBarVisible
                                ? 'bg-[#1F3A6E]/55 border-[#648CD4]/50 text-[#D9B45A]'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isAudioBarVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            <span>{isAudioBarVisible ? 'إخفاء الصوت' : 'إظهار المشغّل'}</span>
                          </button>
                        )}

                        {readerMode === 'surah' && (
                          <button
                            type="button"
                            onClick={() => setIsDualPage(!isDualPage)}
                            className={`hidden md:flex min-h-[38px] items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                              isDualPage
                                ? 'bg-[#1F3A6E]/55 border-[#648CD4]/50 text-[#D9B45A]'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Columns className="w-3.5 h-3.5" />
                            <span>{isDualPage ? 'صفحتان' : 'صفحة واحدة'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onToggleFullScreen) onToggleFullScreen();
                  else setIsZenMode(!isZenMode);
                }}
                aria-label="وضع ملء الشاشة القرآني"
                title="وضع ملء الشاشة القرآني"
                className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]"
              >
                <Maximize2 className="w-4 h-4 text-[#D9B45A]" />
                <span className="hidden lg:inline">ملء الشاشة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Gesture Touch Pill (Only appears during active auto-reading without shifting layout) */}
      {isUserInteracting && isEngineActive && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-1.5rem)] py-1.5 px-3.5 rounded-full bg-[#10161f]/95 border border-[#648CD4]/55 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150 ${
            effectiveFullScreen ? 'top-14 sm:top-16' : 'top-16 sm:top-20'
          }`}
        >
          <span className="text-[11px] text-[#F6EFDD] flex items-center gap-1.5 font-medium whitespace-nowrap">
            <Hand className="w-3.5 h-3.5 text-[#D9B45A] shrink-0" />
            <span>تحكم يدوي باللمس · ستستأنف القراءة تلقائياً</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
              isTouchActive.current = false;
              isManualOverrideRef.current = false;
              setIsUserInteracting(false);
              if (containerRef.current) {
                const top = containerRef.current.scrollTop;
                preciseScrollTop.current = top;
                lastProgrammaticScrollTopRef.current = top;
              }
            }}
            className="min-h-[30px] py-0.5 px-2.5 rounded-full bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/50 text-[#F6EFDD] font-bold text-[10px] transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            title="استئناف القراءة فوراً من الموضع الحالي"
          >
            استئناف
          </button>
        </div>
      )}

      {/* Main Reading Frame (Mus'haf Page Layout) */}
      <div
        className={`relative transition-all duration-300 ${
          effectiveFullScreen
            ? 'fixed inset-0 z-40 p-2 sm:p-4 rounded-none border-none h-[100dvh] max-h-[100dvh]'
            : 'rounded-3xl p-2 sm:p-3 border-2 shadow-2xl'
        } ${getThemeClasses()}`}
      >
        {/* Decorative Corner Ornaments anchored to non-scrolling outer frame */}
        <div
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-5 h-5 sm:w-7 sm:h-7 border-t-2 border-r-2 opacity-45 pointer-events-none rounded-tr-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 w-5 h-5 sm:w-7 sm:h-7 border-t-2 border-l-2 opacity-45 pointer-events-none rounded-tl-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 w-5 h-5 sm:w-7 sm:h-7 border-b-2 border-r-2 opacity-45 pointer-events-none rounded-br-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 w-5 h-5 sm:w-7 sm:h-7 border-b-2 border-l-2 opacity-45 pointer-events-none rounded-bl-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />

        {/* Inner Scrollable Reading Surface (Expanded vertical viewport space) */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onScroll={handleContainerScroll}
          className={`relative overflow-y-auto overscroll-contain touch-pan-y ${
            effectiveFullScreen
              ? 'h-full px-3 pt-16 pb-24 sm:px-8 sm:pt-16 sm:pb-24'
              : 'max-h-[76vh] sm:max-h-[80vh] px-3 py-5 sm:px-7 sm:py-7'
          }`}
        >

        {readerMode === 'page' ? (
          /* ===================== 604-PAGE MEDINA MUSHAF VIEW ===================== */
          <div className="space-y-6">
            {/* Page Navigation Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-current/15 font-sans">
              <button
                type="button"
                onClick={() => handleStepMushafPage(-1)}
                disabled={mushafPageNumber <= 1}
                className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl disabled:opacity-35 border text-xs font-bold cursor-pointer disabled:cursor-not-allowed ${
                  isLightPaper
                    ? 'bg-[#1F3A6E]/10 hover:bg-[#1F3A6E]/20 border-[#1F3A6E]/30 text-[#1F3A6E]'
                    : 'bg-[#1F3A6E]/55 hover:bg-[#2E5499]/65 border-[#648CD4]/40 text-[#F6EFDD]'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
                <span>الصفحة السابقة</span>
              </button>

              <form onSubmit={handleJumpMushafPage} className="flex items-center gap-2 text-xs">
                <span className="opacity-80">صفحة</span>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={pageInputDraft}
                  onChange={(e) => setPageInputDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(pageInputDraft, 10);
                    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 604 && parsed !== mushafPageNumber) {
                      setMushafPageNumber(parsed);
                    }
                  }}
                  aria-label="رقم صفحة المصحف"
                  className="w-16 text-center py-1 px-2 rounded-lg bg-current/5 border border-current/25 text-inherit font-bold tabular-nums outline-none focus:border-[#D9B45A]"
                />
                <span className="opacity-80">من ٦٠٤</span>
                {pageData?.ayahs[0] && (
                  <span className={`hidden sm:inline px-2.5 py-0.5 rounded-lg border font-semibold text-[11px] ${
                    isLightPaper
                      ? 'bg-[#8A6418]/10 border-[#8A6418]/30 text-[#8A6418]'
                      : 'bg-[#D9B45A]/15 border-[#D9B45A]/30 text-[#D9B45A]'
                  }`}>
                    الجزء {toArabicIndic(pageData.ayahs[0].juz)}
                  </span>
                )}
              </form>

              <button
                type="button"
                onClick={() => handleStepMushafPage(1)}
                disabled={mushafPageNumber >= 604}
                className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl disabled:opacity-35 border text-xs font-bold cursor-pointer disabled:cursor-not-allowed ${
                  isLightPaper
                    ? 'bg-[#1F3A6E]/10 hover:bg-[#1F3A6E]/20 border-[#1F3A6E]/30 text-[#1F3A6E]'
                    : 'bg-[#1F3A6E]/55 hover:bg-[#2E5499]/65 border-[#648CD4]/40 text-[#F6EFDD]'
                }`}
              >
                <span>الصفحة التالية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {isLoadingPage ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3 font-sans">
                <div className="w-9 h-9 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                <p className="text-xs opacity-80">جارٍ تحميل صفحة المصحف رقم {toArabicIndic(mushafPageNumber)}…</p>
              </div>
            ) : pageError ? (
              <div className="py-10 text-center space-y-3 font-sans">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-400">{pageError}</p>
                <button
                  type="button"
                  onClick={() => setPageReloadTrigger((c) => c + 1)}
                  className="py-2 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {pageSurahGroups.map((group) => (
                  <div key={`${mushafPageNumber}-${group.surahNumber}`} className="space-y-4">
                    {group.startsAtAyahOne ? (
                      <div className="text-center py-3">
                        <div className={`inline-block px-7 py-2.5 rounded-2xl border shadow-inner ${
                          isLightPaper
                            ? 'bg-[#D9B45A]/15 border-[#8A6418]/45 text-[#1B1A17]'
                            : 'bg-gradient-to-r from-[#1F3A6E]/35 via-[#D9B45A]/15 to-[#1F3A6E]/35 border-[#D9B45A]/45 text-[#F6EFDD]'
                        }`}>
                          <h2 className="font-kufi text-xl sm:text-2xl font-bold">سُورَةُ {group.surahName}</h2>
                        </div>
                        {group.bismillahPre && (
                          <p className={`mt-4 font-quran text-2xl sm:text-3xl leading-loose ${
                            isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'
                          }`}>
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] font-sans opacity-75 pb-1 border-b border-current/15">
                        <span>تتمة سورة {group.surahName}</span>
                        <span>{group.revelationTypeAr}</span>
                      </div>
                    )}

                    <div className="space-y-3 leading-loose text-right sm:text-justify font-quran select-text">
                      {group.ayahs.map((ayah) => {
                        const isActive =
                          group.surahNumber === surahData.meta.number &&
                          activeAyahNumber === ayah.numberInSurah;
                        const savedBookmark =
                          group.surahNumber === surahData.meta.number
                            ? bookmarkedAyah
                            : Number(safeLocalStorage.getItem(`bayan_bookmark_${group.surahNumber}`) || 0) || null;
                        const isBookmarked = savedBookmark === ayah.numberInSurah;

                        return (
                          <AyahSpan
                            key={`${group.surahNumber}:${ayah.numberInSurah}`}
                            ayah={ayah}
                            surahNumber={group.surahNumber}
                            surahName={group.surahName}
                            isActive={isActive}
                            isBookmarked={isBookmarked}
                            isPlayingAudio={isPlayingAudio}
                            isLightPaper={isLightPaper}
                            fontSize={fontSize}
                            isTajweedActive={isTajweedActive}
                            activeWordIndex={computeActiveWordIndex(ayah, group.surahNumber)}
                            onSelectAyah={onSelectAyah}
                            onToggleBookmark={handleToggleBookmark}
                            onOpenTadabburModal={onOpenTadabburModal}
                            setRef={(el) => {
                              ayahRefs.current[`${group.surahNumber}:${ayah.numberInSurah}`] = el;
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Page Footer */}
            <div className="mt-10 pt-5 border-t border-current/20 opacity-75 flex items-center justify-between text-xs font-sans">
              <span>{pageData?.ayahs[0] ? `الجزء ${toArabicIndic(pageData.ayahs[0].juz)}` : ''}</span>
              <span>مصحف بيان · الصفحة {toArabicIndic(mushafPageNumber)} / ٦٠٤</span>
              <button
                type="button"
                onClick={() => setReaderMode('surah')}
                className="underline hover:text-[#D9B45A] cursor-pointer"
              >
                عرض السورة كاملة
              </button>
            </div>
          </div>
        ) : (
          /* ===================== FULL SURAH VIEW (SINGLE OR DUAL PAGE) ===================== */
          <>
            {/* Surah Decorative Frame Header */}
            <div className="relative text-center mb-6 sm:mb-8 pb-2">
              <div className={`inline-block relative px-6 sm:px-9 py-3 max-w-full rounded-2xl border shadow-inner ${
                isLightPaper
                  ? 'bg-[#D9B45A]/15 border-[#8A6418]/45 text-[#1B1A17]'
                  : 'bg-gradient-to-r from-[#1F3A6E]/35 via-[#D9B45A]/15 to-[#1F3A6E]/35 border-[#D9B45A]/45 text-[#F6EFDD]'
              }`}>
                <h1 className="font-kufi text-2xl sm:text-3xl font-bold tracking-wide">
                  سُورَةُ {surahData.meta.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-1.5 text-xs opacity-80 font-sans tabular-nums">
                  <span className="whitespace-nowrap">{surahData.meta.revelationTypeAr}</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{toArabicIndic(surahData.meta.numberOfAyahs)} آية</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">الجزء {toArabicIndic(surahData.meta.juzNumber)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">ص {toArabicIndic(surahData.meta.startPage)}</span>
                </div>
              </div>

              {/* Bismillah Banner (unless Tawba) */}
              {surahData.bismillahPre && (
                <div className="mt-5 text-center">
                  <p className={`font-quran text-2xl sm:text-3xl leading-loose ${
                    isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'
                  }`}>
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </p>
                </div>
              )}
            </div>

            {/* Verses Container (Single or Dual Page) */}
            <div className={isDualPage ? 'grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x-2 rtl:md:divide-x-reverse divide-[#D9B45A]/25' : 'space-y-4'}>

              {/* Right Page (or full list) */}
              <div className={`space-y-3 leading-loose text-right sm:text-justify font-quran select-text ${isDualPage ? 'md:pl-6' : ''}`}>
                {rightPageAyahs.map((ayah) => {
                  const isActive = activeAyahNumber === ayah.numberInSurah;
                  const isBookmarked = bookmarkedAyah === ayah.numberInSurah;

                  return (
                    <AyahSpan
                      key={ayah.numberInSurah}
                      ayah={ayah}
                      surahNumber={surahData.meta.number}
                      surahName={surahData.meta.name}
                      isActive={isActive}
                      isBookmarked={isBookmarked}
                      isPlayingAudio={isPlayingAudio}
                      isLightPaper={isLightPaper}
                      fontSize={fontSize}
                      isTajweedActive={isTajweedActive}
                      activeWordIndex={computeActiveWordIndex(ayah, surahData.meta.number)}
                      onSelectAyah={onSelectAyah}
                      onToggleBookmark={handleToggleBookmark}
                      onOpenTadabburModal={onOpenTadabburModal}
                      setRef={(el) => {
                        ayahRefs.current[`${surahData.meta.number}:${ayah.numberInSurah}`] = el;
                      }}
                    />
                  );
                })}
              </div>

              {/* Left Page (Dual Page Mode) */}
              {isDualPage && (
                <div className="space-y-3 leading-loose text-right sm:text-justify font-quran select-text md:pr-6">
                  {leftPageAyahs.map((ayah) => {
                    const isActive = activeAyahNumber === ayah.numberInSurah;
                    const isBookmarked = bookmarkedAyah === ayah.numberInSurah;

                    return (
                      <AyahSpan
                        key={ayah.numberInSurah}
                        ayah={ayah}
                        surahNumber={surahData.meta.number}
                        surahName={surahData.meta.name}
                        isActive={isActive}
                        isBookmarked={isBookmarked}
                        isPlayingAudio={isPlayingAudio}
                        isLightPaper={isLightPaper}
                        fontSize={fontSize}
                        isTajweedActive={isTajweedActive}
                        activeWordIndex={computeActiveWordIndex(ayah, surahData.meta.number)}
                        onSelectAyah={onSelectAyah}
                        onToggleBookmark={handleToggleBookmark}
                        onOpenTadabburModal={onOpenTadabburModal}
                        setRef={(el) => {
                          ayahRefs.current[`${surahData.meta.number}:${ayah.numberInSurah}`] = el;
                        }}
                      />
                    );
                  })}
                </div>
              )}

            </div>

            {/* Page Footer metadata */}
            <div className="mt-12 pt-6 border-t border-current/15 opacity-75 flex flex-wrap items-center justify-between gap-2 text-xs font-sans tabular-nums">
              <span className="whitespace-nowrap">الجزء {toArabicIndic(surahData.meta.juzNumber)}</span>
              <span className="whitespace-nowrap">بيان · مصحف وقف لوجه الله تعالى</span>
              <span className="whitespace-nowrap">الصفحة {toArabicIndic(surahData.meta.startPage)}</span>
            </div>
          </>
        )}

        </div>
      </div>

      {/* Small Professional Floating Auto-Scroll Button (Silent Eye-Reading Mode when Audio Bar is Hidden) */}
      {!isAudioBarVisible && (
        <div
          className={`fixed end-4 z-50 ${
            effectiveFullScreen ? 'bottom-4' : 'bottom-20 lg:bottom-5'
          }`}
        >
          {isFloatingSpeedOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFloatingSpeedOpen(false)}
              />
              <div className="absolute bottom-full end-0 mb-2.5 w-64 p-3 rounded-2xl bg-[#10161f]/95 border border-[#D9B45A]/30 shadow-2xl backdrop-blur-xl z-50 space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-[#F6EFDD]">سرعة القراءة الآلية</span>
                  <span className="text-[#D9B45A] font-bold tabular-nums">{autoScrollSpeed}x</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setAutoScrollSpeed(level);
                        setScrollMode('manual-speed');
                        setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`min-h-[34px] py-1.5 rounded-xl font-bold text-xs tabular-nums transition-colors cursor-pointer ${
                        autoScrollSpeed === level
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {level}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPauseAtAyahEnds((prev) => !prev)}
                  className={`w-full min-h-[36px] py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    !pauseAtAyahEnds
                      ? 'bg-[#1F3A6E]/55 border-[#648CD4]/45 text-[#F6EFDD]'
                      : 'bg-[#D9B45A]/15 border-[#D9B45A]/45 text-[#D9B45A]'
                  }`}
                >
                  <span className="text-slate-300">نمط النزول:</span>
                  <span>{!pauseAtAyahEnds ? 'انسياب مستمر' : 'وقفة عند رأس الآية'}</span>
                </button>
              </div>
            </>
          )}

          {/* Compact Glass Capsule */}
          <div
            className={`inline-flex items-center rounded-full border shadow-2xl backdrop-blur-xl transition-all p-1 ${
              isAutoScrolling
                ? 'bg-[#10161f]/95 border-[#D9B45A]/60 ring-1 ring-[#D9B45A]/30'
                : 'bg-[#10161f]/90 border-slate-700/80 hover:border-slate-600'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (isAutoScrolling) {
                  setIsAutoScrolling(false);
                  setIsAutoScrollPaused(false);
                } else {
                  setScrollMode(isPlayingAudio ? 'reciter-sync' : 'manual-speed');
                  setIsAutoScrolling(true);
                  setIsAutoScrollPaused(false);
                }
              }}
              aria-pressed={isAutoScrolling}
              className={`min-h-[36px] flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isAutoScrolling
                  ? 'bg-[#D9B45A] text-[#1B1A17]'
                  : 'text-[#F6EFDD] hover:bg-slate-800'
              }`}
              title={isAutoScrolling ? 'إيقاف القراءة الآلية' : 'تشغيل القراءة الآلية'}
            >
              {isAutoScrolling ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-[#D9B45A] text-[#D9B45A]" />
              )}
              <span>{isAutoScrolling ? 'إيقاف' : 'قراءة آلية'}</span>
            </button>

            <span className="w-px h-4 bg-slate-700/80 mx-1" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setIsFloatingSpeedOpen((prev) => !prev)}
              aria-expanded={isFloatingSpeedOpen}
              aria-label="ضبط سرعة التمرير الآلي"
              className="min-h-[36px] flex items-center gap-0.5 py-1.5 px-2.5 rounded-full text-[11px] font-bold text-slate-200 hover:text-white hover:bg-slate-800 tabular-nums transition-colors cursor-pointer"
              title="ضبط سرعة التمرير الآلي"
            >
              <span>{autoScrollSpeed}x</span>
              <ChevronUp
                className={`w-3 h-3 transition-transform ${
                  isFloatingSpeedOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
