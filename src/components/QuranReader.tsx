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
import { renderTajweedText } from '../utils/tajweedParser';
import { safeLocalStorage } from '../utils/safeStorage';
import {
  BookOpen, Sparkles, Columns,
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  Bookmark, HelpCircle, Play, Pause, X, Radio, Hand,
  ChevronDown, SlidersHorizontal, Volume2, BookMarked,
  ChevronRight, ChevronLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import { Reciter } from '../data/reciters';

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
  selectedReciter?: Reciter;
  onTogglePlayAudio?: () => void;
}

type ReaderTheme = 'dark' | 'sepia' | 'emerald' | 'high-contrast';
type ReaderMode = 'surah' | 'page';

interface AyahSpanProps {
  ayah: Ayah;
  surahNumber: number;
  surahName: string;
  isActive: boolean;
  isBookmarked: boolean;
  isPlayingAudio?: boolean;
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
        isActive ? 'bg-emerald-500/10' : 'hover:bg-emerald-500/5'
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
      <span
        onClick={handleOpenAyah}
        className="ayah-end-symbol mx-1 inline-flex items-center justify-center cursor-pointer group"
        title={`الآية ${ayah.numberInSurah} - انقر للتدبر والتفسير`}
      >
        <span
          className={`font-bold transition-all text-xl ${
            isActive && isPlayingAudio
              ? 'text-emerald-400 scale-110 drop-shadow-sm'
              : 'text-emerald-500 group-hover:scale-125'
          }`}
        >
          ﴿{ayah.numberInSurah}﴾
        </span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(ayah.numberInSurah, surahNumber);
        }}
        title={isBookmarked ? 'إزالة علامة الوقف' : 'وضع علامة مرجعية على هذه الآية'}
        className={`inline-flex items-center justify-center align-middle mx-0.5 p-0.5 rounded transition-opacity cursor-pointer ${
          isBookmarked
            ? 'text-amber-400 opacity-100'
            : 'text-slate-500 opacity-0 group-hover/ayah:opacity-80 hover:text-amber-300'
        }`}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
      </button>
    </span>
  );
});

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
  selectedReciter,
  onTogglePlayAudio,
}) => {
  const [fontSize, setFontSize] = useState<number>(28);
  const [readerMode, setReaderMode] = useState<ReaderMode>('surah');
  const [mushafPageNumber, setMushafPageNumber] = useState<number>(() => surahData.meta.startPage || 1);
  const [pageInputDraft, setPageInputDraft] = useState<string>(() => String(surahData.meta.startPage || 1));
  const [pageData, setPageData] = useState<MushafPageData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReloadTrigger, setPageReloadTrigger] = useState<number>(0);

  const [isDualPage, setIsDualPage] = useState<boolean>(false);
  const [theme, setTheme] = useState<ReaderTheme>('dark');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);
  const [segmentsBySurahKey, setSegmentsBySurahKey] = useState<Record<string, Record<number, WordSegment[]>>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ayahRefs = useRef<Record<string, HTMLElement | null>>({});

  // Keep latest audio timing in refs so 60fps auto-scroll engine doesn't re-mount 4 times/sec
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  useEffect(() => {
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
  }, [currentTime, duration]);

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
      if (segmentsBySurahKey[cacheKey]) return;
      getSurahAudioSegments(recId, sNum).then((segs) => {
        if (!cancelled && Object.keys(segs).length > 0) {
          setSegmentsBySurahKey((prev) => ({ ...prev, [cacheKey]: segs }));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedReciter?.quranComRecitationId, surahData.meta.number, readerMode, pageData, segmentsBySurahKey]);

  // Unified Auto-Scroll Engine state (Dual-Mode: Reciter-Adaptive Sync OR Manual Self-Reading)
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);
  const [scrollMode, setScrollMode] = useState<'reciter-sync' | 'manual-speed'>('reciter-sync');
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(2); // 1 to 5
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState<boolean>(false);
  const [pauseAtAyahEnds, setPauseAtAyahEnds] = useState<boolean>(false); // Continuous smooth scrolling without stopping at ayah ends
  const [isPausedAtAyah, setIsPausedAtAyah] = useState<boolean>(false);
  const [pausedAyahNumber, setPausedAyahNumber] = useState<number | null>(null);
  const pausedAyahsHistory = useRef<Set<number>>(new Set());

  // Subpixel floating accumulator for smooth scrolling at all speeds (1x to 5x)
  const preciseScrollTop = useRef<number>(0);
  const isTouchActive = useRef<boolean>(false);

  // Touch & Gesture Guard (stops scroller from fighting user's thumb or mouse wheel)
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

  // Synchronize precise scroll accumulator whenever container, surah, or mode changes
  useEffect(() => {
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }
  }, [surahData.meta.number, isAutoScrolling, autoScrollSpeed]);

  // Touch & Gesture Handlers: full manual control up & down without fighting
  const handleTouchStart = () => {
    isTouchActive.current = true;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }
  };

  const handleTouchMove = () => {
    isTouchActive.current = true;
    setIsUserInteracting(true);
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }
  };

  const handleTouchEnd = () => {
    isTouchActive.current = false;
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }
    // Give user 2.2 seconds grace period to read where they manually scrolled
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      if (containerRef.current) {
        preciseScrollTop.current = containerRef.current.scrollTop;
      }
    }, 2200);
  };

  const handleWheel = () => {
    setIsUserInteracting(true);
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      if (containerRef.current) {
        preciseScrollTop.current = containerRef.current.scrollTop;
      }
    }, 2200);
  };

  const handleContainerScroll = () => {
    // When user scrolls manually with touch or scrollbar, sync precise accumulator
    if (isTouchActive.current || isUserInteracting) {
      if (containerRef.current) {
        preciseScrollTop.current = containerRef.current.scrollTop;
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
    const isEngineActive = isAutoScrolling || (isPlayingAudio && isSmartScrollActive);
    if (!isEngineActive || isAutoScrollPaused || isPausedAtAyah) return;

    let animId: number;
    let lastTime = performance.now();
    // Calibrated speed table for Arabic reading: px per second
    // Shifted down by 1 level: 1x: 15px/s, 2x: 24px/s, 3x: 40px/s, 4x: 64px/s, 5x: 95px/s
    const speedTable = [15, 24, 40, 64, 95];
    const pxPerSec = speedTable[autoScrollSpeed - 1] || 24;

    // Ensure accumulator starts from current scroll position
    if (containerRef.current) {
      preciseScrollTop.current = containerRef.current.scrollTop;
    }

    const scrollLoop = (now: number) => {
      const container = containerRef.current;
      if (!container) return;

      const elapsed = (now - lastTime) / 1000;
      lastTime = now;

      // Yield completely while user is touching or manually adjusting
      if (isTouchActive.current || isUserInteracting) {
        preciseScrollTop.current = container.scrollTop;
        animId = requestAnimationFrame(scrollLoop);
        return;
      }

      // MODE 1: VOICE RECITATION TRACKER (المزامنة الذكية مع صوت وتلاوة الشيخ)
      if (isPlayingAudio && scrollMode === 'reciter-sync') {

        const el = ayahRefs.current[`${surahData.meta.number}:${activeAyahNumber}`];
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
            preciseScrollTop.current = container.scrollTop;
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
            setIsAutoScrolling(false);
            return;
          }

          // Apply to DOM scroll position
          container.scrollTop = preciseScrollTop.current;

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
                      preciseScrollTop.current = containerRef.current.scrollTop;
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
    isAutoScrolling,
    isSmartScrollActive,
    isPlayingAudio,
    scrollMode,
    isAutoScrollPaused,
    isPausedAtAyah,
    isUserInteracting,
    activeAyahNumber,
    autoScrollSpeed,
    pauseAtAyahEnds,
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
      if (bookmarkedAyah === ayahNum) {
        setBookmarkedAyah(null);
        safeLocalStorage.removeItem(`bayan_bookmark_${targetSurahNum}`);
      } else {
        setBookmarkedAyah(ayahNum);
        safeLocalStorage.setItem(`bayan_bookmark_${targetSurahNum}`, String(ayahNum));
      }
      return;
    }

    const existing = safeLocalStorage.getItem(`bayan_bookmark_${targetSurahNum}`);
    if (existing === String(ayahNum)) {
      safeLocalStorage.removeItem(`bayan_bookmark_${targetSurahNum}`);
    } else {
      safeLocalStorage.setItem(`bayan_bookmark_${targetSurahNum}`, String(ayahNum));
    }
  };

  // Determine container styling based on theme
  const getThemeClasses = () => {
    switch (theme) {
      case 'sepia':
        return 'mushaf-paper-sepia bg-[#fbf7ee] text-[#1c1917] border-amber-900/20';
      case 'emerald':
        return 'mushaf-paper-emerald bg-[#041a14] text-[#e6f7f2] border-emerald-900/30';
      case 'high-contrast':
        return 'bg-black text-white border-zinc-800';
      default:
        return 'mushaf-paper-dark bg-[#0c1319] text-[#e2e8f0] border-slate-800';
    }
  };

  const getBorderColor = () => {
    switch (theme) {
      case 'sepia':
        return '#d97706';
      case 'emerald':
        return '#059669';
      default:
        return '#10b981';
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

  // Helper to resolve active word index (authentic segment timestamp first, proportional fallback)
  const computeActiveWordIndex = (ayah: Ayah, targetSurahNum: number): number | undefined => {
    const isActive = targetSurahNum === surahData.meta.number && activeAyahNumber === ayah.numberInSurah;
    if (!isActive || !isPlayingAudio || !duration || duration <= 0) return undefined;

    const cleanText = sanitizeAyahText(ayah.text, targetSurahNum, ayah.numberInSurah);
    const words = cleanText.trim().split(/\s+/);
    if (words.length === 0) return undefined;

    const recId = selectedReciter?.quranComRecitationId;
    const segs = recId ? segmentsBySurahKey[`${recId}:${targetSurahNum}`]?.[ayah.numberInSurah] : undefined;

    if (segs && segs.length > 0) {
      const curMs = (currentTime || 0) * 1000;
      const exactMatch = segs.find(([, , startMs, endMs]) => curMs >= startMs && curMs <= endMs);
      if (exactMatch) {
        return Math.max(0, Math.min(words.length - 1, exactMatch[0]));
      }
      // Within brief pauses between words, hold the most recently started word
      let lastIdx = 0;
      for (const [wordStart, , startMs] of segs) {
        if (curMs >= startMs) lastIdx = wordStart;
      }
      return Math.max(0, Math.min(words.length - 1, lastIdx));
    }

    const progress = Math.max(0, Math.min(0.99, (currentTime || 0) / duration));
    return Math.floor(progress * words.length);
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
              ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/50 ring-2 ring-emerald-300'
              : 'bg-amber-500 border-amber-300 text-slate-950 shadow-amber-900/40 ring-2 ring-amber-300'
            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
        }`}>
          {/* Main Action: Click to start or stop auto-reading instantly */}
          <button
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
            className={`${isFloating ? 'py-1 px-2 sm:px-2.5' : 'py-1.5 px-2.5 sm:px-3'} flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer`}
            title={isAutoScrolling ? 'انقر لإيقاف القراءة الآلية' : 'انقر لتشغيل القراءة الآلية'}
          >
            {isPlayingAudio && scrollMode === 'reciter-sync' ? (
              <>
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
                <span className="hidden sm:inline">مزامنة القارئ 🎙️</span>
                <span className="sm:hidden">صوت الشيخ</span>
              </>
            ) : (
              <>
                {isCurrentlyActive ? (
                  <Pause className="w-3.5 h-3.5 fill-current text-slate-950 animate-pulse" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                )}
                <span className="hidden sm:inline">{isCurrentlyActive ? 'قراءة آلية تعمل ⚡' : 'قراءة آلية'}</span>
                <span className="sm:hidden">{isCurrentlyActive ? 'إيقاف ⏸️' : 'آلية'}</span>
              </>
            )}
          </button>

          {/* Vertical divider */}
          <div className={`w-[1px] my-1 ${
            isCurrentlyActive
              ? (isPlayingAudio && scrollMode === 'reciter-sync')
                ? 'bg-emerald-400/50'
                : 'bg-amber-700/60'
              : 'bg-slate-700'
          }`} />

          {/* Speed / Mode indicator & popover dropdown toggle */}
          <button
            onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
            className={`${isFloating ? 'px-1.5 py-1' : 'px-2 py-1.5'} flex items-center gap-0.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer font-bold text-[11px]`}
            title="تحديد سرعة القراءة والخيارات (1x - 5x)"
          >
            <span>{isPlayingAudio && scrollMode === 'reciter-sync' ? '🎙️' : `${autoScrollSpeed}x`}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isSpeedMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown Popover Card */}
        {isSpeedMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={() => setIsSpeedMenuOpen(false)}
            />

            {/* Popover Menu Card: centered on mobile, anchored on desktop */}
            <div className={`fixed sm:absolute ${isFloating ? 'top-14 sm:top-12' : 'top-28 sm:top-full'} inset-x-3 sm:inset-x-auto sm:right-0 sm:mt-2 z-50 w-auto sm:w-80 max-w-[calc(100vw-1.5rem)] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-3`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>إعدادات وسرعة القراءة الآلية</span>
                </div>
                <button
                  onClick={() => setIsSpeedMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mode switcher if audio is active */}
              {isPlayingAudio && (
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block">نمط النزول مع التلاوة:</span>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setScrollMode('reciter-sync');
                        if (!isAutoScrolling) setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        scrollMode === 'reciter-sync'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Radio className="w-3 h-3" />
                      <span>مزامنة الشيخ 🎙️</span>
                    </button>
                    <button
                      onClick={() => {
                        setScrollMode('manual-speed');
                        if (!isAutoScrolling) setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        scrollMode === 'manual-speed'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>سرعة حرة (1x-5x)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Speed selection pills */}
              {(!isPlayingAudio || scrollMode === 'manual-speed') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">سرعة القراءة الذاتية:</span>
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{autoScrollSpeed}x</span>
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
                        onClick={() => {
                          setAutoScrollSpeed(s.level);
                          setScrollMode('manual-speed');
                          if (!isAutoScrolling) setIsAutoScrolling(true);
                          setIsAutoScrollPaused(false);
                        }}
                        className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                          autoScrollSpeed === s.level
                            ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                        }`}
                        title={s.label}
                      >
                        <span>{s.level}x</span>
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    {autoScrollSpeed === 1 && '1x: قراءة بطيئة جداً وهادئة للتدبر والتأمل (~4.7 ثوانٍ للسطر)'}
                    {autoScrollSpeed === 2 && '2x: قراءة متأنية ومريحة (~2.9 ثوانٍ للسطر)'}
                    {autoScrollSpeed === 3 && '3x: السرعة الطبيعية المعتدلة للورد اليومي (~1.75 ثانية للسطر)'}
                    {autoScrollSpeed === 4 && '4x: قراءة مسترسلة سلسة ومريحة (~1.1 ثانية للسطر)'}
                    {autoScrollSpeed === 5 && '5x: حدر ومراجعة سريعة للحفاظ (~0.73 ثانية للسطر)'}
                  </p>
                </div>
              )}

              {/* Continuous flow vs Pause at verse ends */}
              {(!isPlayingAudio || scrollMode === 'manual-speed') && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setPauseAtAyahEnds(!pauseAtAyahEnds)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      !pauseAtAyahEnds
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    <span className="text-[11px] text-slate-400">حركة النزول:</span>
                    <span className="font-bold">{!pauseAtAyahEnds ? 'انسياب مستمر (بدون توقف) ✓' : 'وقفة عند رأس الآية ﴿﴾'}</span>
                  </button>
                </div>
              )}

              {/* Quick Action: Start/Stop & Close in footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  الحالة: {isAutoScrolling ? 'تعمل الآن ⚡' : 'متوقفة ⏸️'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsSpeedMenuOpen(false)}
                    className="py-1 px-2.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <button
                    onClick={() => {
                      const next = !isAutoScrolling;
                      setIsAutoScrolling(next);
                      setIsAutoScrollPaused(false);
                      if (next && scrollMode === 'reciter-sync' && !isPlayingAudio) {
                        setScrollMode('manual-speed');
                      }
                    }}
                    className={`py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isAutoScrolling
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md'
                    }`}
                  >
                    {isAutoScrolling ? 'إيقاف ✕' : 'بدء القراءة ⚡'}
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
    <div className={`relative flex flex-col transition-all duration-300 ${effectiveFullScreen ? 'fixed inset-0 z-50 p-2 sm:p-6 bg-[#070b0e]' : 'w-full'}`}>
      
      {/* Floating Exit & Auto-Reading Pill in Full Screen Mode */}
      {effectiveFullScreen && (
        <div className="sticky top-2 z-50 mb-3 flex items-center justify-between gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md max-w-fit mx-auto text-xs animate-in fade-in slide-in-from-top-2">
          {/* Surah Name */}
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs pl-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">سورة {surahData.meta.name}</span>
            <span className="sm:hidden">{surahData.meta.name}</span>
          </div>

          <div className="w-[1px] h-4 bg-slate-700" />

          {/* Quick Sheikh Audio Button */}
          {onTogglePlayAudio && (
            <>
              <button
                onClick={onTogglePlayAudio}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isPlayingAudio
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
                title={isPlayingAudio ? 'إيقاف تلاوة الشيخ مؤقتاً' : 'الاستماع لتلاوة الشيخ للآية الحالية'}
              >
                {isPlayingAudio ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{selectedReciter ? selectedReciter.name.split(' ')[0] : 'تلاوة'}</span>
                    <Pause className="w-3 h-3 text-emerald-300" />
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">صوت الشيخ</span>
                    <Play className="w-3 h-3 text-emerald-400 ml-0.5" />
                  </>
                )}
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />
            </>
          )}

          {/* Floating Auto-Reading Control */}
          {renderAutoScrollSplitButton(true)}

          <div className="w-[1px] h-4 bg-slate-700" />

          {/* Exit Full Screen */}
          <button
            onClick={() => {
              if (onToggleFullScreen) onToggleFullScreen();
              setIsZenMode(false);
            }}
            className="flex items-center gap-1 py-1 px-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition-all shadow-sm cursor-pointer"
            title="خروج من وضع ملء الشاشة وإظهار جميع القوائم"
          >
            <Minimize2 className="w-3 h-3" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      )}

      {/* Reader Toolbar (Hidden in full-screen reading mode) */}
      {!effectiveFullScreen && (
        <div className="mb-4 relative z-30 flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md backdrop-blur-md">
        
        {/* Left: Tajweed Toggle & Color Guide */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTajweed}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isTajweedActive
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTajweedActive ? 'التجويد الملون: مفعل' : 'الرسم العادي'}</span>
          </button>

          {isTajweedActive && (
            <button
              onClick={onOpenTajweedLegend}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
              title="دليل ألوان أحكام التجويد"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* 604-Page Medina Mushaf vs Full Surah Mode Switcher */}
          <button
            type="button"
            onClick={() => setReaderMode((prev) => (prev === 'surah' ? 'page' : 'surah'))}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              readerMode === 'page'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="التبديل بين عرض السورة كاملة وعرض صفحات المصحف (604 صفحات)"
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>{readerMode === 'page' ? `صفحة ${mushafPageNumber} / 604` : 'صفحات المصحف (604)'}</span>
          </button>

          {/* Dual Page Toggle (on tablets / desktop in Surah mode) */}
          {readerMode === 'surah' && (
            <button
              onClick={() => setIsDualPage(!isDualPage)}
              className={`hidden md:flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                isDualPage
                  ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="عرض المصحف المزدوج (صفحتين متقابلتين)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isDualPage ? 'صفحتين' : 'صفحة واحدة'}</span>
            </button>
          )}

          {/* Unified Split Popover Button for Self-Reading & Speeds */}
          {renderAutoScrollSplitButton(false)}
        </div>

        {/* Center: Font Size adjust */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFontSize(prev => Math.max(20, prev - 2))}
            className="p-1 text-slate-400 hover:text-white"
            title="تصغير الخط"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-300 font-medium px-1 min-w-[2.5rem] text-center">{fontSize}px</span>
          <button
            onClick={() => setFontSize(prev => Math.min(48, prev + 2))}
            className="p-1 text-slate-400 hover:text-white"
            title="تكبير الخط"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Theme picker & Zen Mode */}
        <div className="flex items-center gap-2">
          {/* Themes */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTheme('dark')}
              className={`w-6 h-6 rounded-lg bg-[#0c1319] border ${theme === 'dark' ? 'ring-2 ring-emerald-400 border-white' : 'border-slate-700'}`}
              title="ليلي داكن"
            />
            <button
              onClick={() => setTheme('sepia')}
              className={`w-6 h-6 rounded-lg bg-[#fbf7ee] border ${theme === 'sepia' ? 'ring-2 ring-amber-600 border-slate-900' : 'border-slate-400'}`}
              title="ورق المصحف العاجي"
            />
            <button
              onClick={() => setTheme('emerald')}
              className={`w-6 h-6 rounded-lg bg-[#041a14] border ${theme === 'emerald' ? 'ring-2 ring-emerald-400 border-white' : 'border-emerald-800'}`}
              title="الزمرد الملكي"
            />
          </div>

          {/* Quick Bookmark Toggle for Active Ayah */}
          <button
            onClick={() => handleToggleBookmark(activeAyahNumber)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              bookmarkedAyah === activeAyahNumber
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-amber-300'
            }`}
            title={
              bookmarkedAyah === activeAyahNumber
                ? `إزالة العلامة المرجعية عن الآية ${activeAyahNumber}`
                : `حفظ علامة مرجعية على الآية ${activeAyahNumber}`
            }
          >
            <Bookmark className={`w-4 h-4 ${bookmarkedAyah === activeAyahNumber ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          {/* Full Screen Mode toggle */}
          <button
            onClick={() => {
              if (onToggleFullScreen) onToggleFullScreen();
              else setIsZenMode(!isZenMode);
            }}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            title="وضع ملء الشاشة القرآني (إخفاء كل القوائم والشريط السفلي)"
          >
            <Maximize2 className="w-4 h-4 text-amber-400" />
          </button>
        </div>

      </div>
      )}

      {/* Subtle Gesture Touch Toast Pill (Only appears when user touches/scrolls manually) */}
      {isUserInteracting && (
        <div className="mb-3 py-1.5 px-4 rounded-full bg-slate-900/95 border border-sky-500/40 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150 mx-auto max-w-fit">
          <span className="text-[11px] text-sky-300 flex items-center gap-1.5 font-medium">
            <Hand className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>تحكم يدوي باللمس 👆 (تستأنف القراءة بعد لحظات)</span>
          </span>
          <button
            onClick={() => {
              if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
              isTouchActive.current = false;
              setIsUserInteracting(false);
              if (containerRef.current) {
                preciseScrollTop.current = containerRef.current.scrollTop;
              }
            }}
            className="py-0.5 px-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] transition-all shadow-sm cursor-pointer"
            title="استئناف القراءة فوراً من الموضع الحالي"
          >
            استئناف الآن ⚡
          </button>
        </div>
      )}

      {/* Main Reading Frame (Mus'haf Page Layout) */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleContainerScroll}
        className={`relative transition-all duration-300 overflow-y-auto overscroll-contain ${
          effectiveFullScreen
            ? 'fixed inset-0 z-40 p-4 sm:p-10 rounded-none border-none h-[100dvh] max-h-[100dvh]'
            : 'rounded-3xl p-6 sm:p-10 border-2 shadow-2xl max-h-[75vh]'
        } ${getThemeClasses()}`}
      >
        {/* Decorative Corner Ornaments */}
        <div
          className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 opacity-40 pointer-events-none rounded-tr-lg"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 opacity-40 pointer-events-none rounded-tl-lg"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 opacity-40 pointer-events-none rounded-br-lg"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 opacity-40 pointer-events-none rounded-bl-lg"
          style={{ borderColor: getBorderColor() }}
        />

        {readerMode === 'page' ? (
          /* ===================== 604-PAGE MEDINA MUSHAF VIEW ===================== */
          <div className="space-y-6">
            {/* Page Navigation Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-current/15 font-sans">
              <button
                type="button"
                onClick={() => handleStepMushafPage(-1)}
                disabled={mushafPageNumber <= 1}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-35 border border-emerald-500/30 text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
                <span>الصفحة السابقة</span>
              </button>

              <form onSubmit={handleJumpMushafPage} className="flex items-center gap-2 text-xs">
                <span className="opacity-75">صفحة</span>
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
                  className="w-16 text-center py-1 px-2 rounded-lg bg-slate-900/70 border border-slate-700 text-white font-bold outline-none focus:border-emerald-400"
                />
                <span className="opacity-75">من 604</span>
                {pageData?.ayahs[0] && (
                  <span className="hidden sm:inline px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 font-semibold text-[11px]">
                    الجزء {pageData.ayahs[0].juz}
                  </span>
                )}
              </form>

              <button
                type="button"
                onClick={() => handleStepMushafPage(1)}
                disabled={mushafPageNumber >= 604}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-35 border border-emerald-500/30 text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
              >
                <span>الصفحة التالية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {isLoadingPage ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3 font-sans">
                <div className="w-9 h-9 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-xs opacity-70">جارٍ تحميل صفحة المصحف رقم {mushafPageNumber}...</p>
              </div>
            ) : pageError ? (
              <div className="py-10 text-center space-y-3 font-sans">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-300">{pageError}</p>
                <button
                  type="button"
                  onClick={() => setPageReloadTrigger((c) => c + 1)}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
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
                        <div className="inline-block px-7 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 border border-emerald-500/30 shadow-inner">
                          <h2 className="font-kufi text-xl sm:text-2xl font-bold">سُورَةُ {group.surahName}</h2>
                        </div>
                        {group.bismillahPre && (
                          <p className="mt-4 font-quran text-2xl sm:text-3xl text-emerald-400/90 leading-loose">
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] font-sans opacity-65 pb-1 border-b border-current/10">
                        <span>تتمة سورة {group.surahName}</span>
                        <span>{group.revelationTypeAr}</span>
                      </div>
                    )}

                    <div className="space-y-3 leading-loose text-justify font-quran select-text">
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
            <div className="mt-10 pt-5 border-t border-current opacity-50 flex items-center justify-between text-xs font-sans">
              <span>{pageData?.ayahs[0] ? `الجزء ${pageData.ayahs[0].juz}` : ''}</span>
              <span>مصحف بيان • الصفحة {mushafPageNumber} / 604</span>
              <button
                type="button"
                onClick={() => setReaderMode('surah')}
                className="underline hover:text-emerald-400 cursor-pointer"
              >
                عرض السورة كاملة
              </button>
            </div>
          </div>
        ) : (
          /* ===================== FULL SURAH VIEW (SINGLE OR DUAL PAGE) ===================== */
          <>
            {/* Surah Decorative Frame Header */}
            <div className="relative text-center mb-8 pb-4">
              <div className="inline-block relative px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 border border-emerald-500/30 shadow-inner">
                <h1 className="font-kufi text-2xl sm:text-3xl font-bold tracking-wide">
                  سُورَةُ {surahData.meta.name}
                </h1>
                <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-slate-400 font-sans">
                  <span>{surahData.meta.revelationTypeAr}</span>
                  <span>•</span>
                  <span>{surahData.meta.numberOfAyahs} آيات</span>
                  <span>•</span>
                  <span>الجزء {surahData.meta.juzNumber}</span>
                  <span>•</span>
                  <span>الصفحة {surahData.meta.startPage}</span>
                </div>
              </div>

              {/* Bismillah Banner (unless Tawba) */}
              {surahData.bismillahPre && (
                <div className="mt-6 text-center">
                  <p className="font-quran text-2xl sm:text-3xl text-emerald-400/90 leading-loose">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </p>
                </div>
              )}
            </div>

            {/* Verses Container (Single or Dual Page) */}
            <div className={isDualPage ? 'grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x-2 rtl:md:divide-x-reverse divide-amber-500/20' : 'space-y-4'}>
              
              {/* Right Page (or full list) */}
              <div className={`space-y-3 leading-loose text-justify font-quran select-text ${isDualPage ? 'md:pl-6' : ''}`}>
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
                <div className="space-y-3 leading-loose text-justify font-quran select-text md:pr-6">
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
            <div className="mt-12 pt-6 border-t border-current opacity-30 flex items-center justify-between text-xs font-sans">
              <span>الجزء {surahData.meta.juzNumber}</span>
              <span>مصحف بيان • وقف لوجه الله تعالى</span>
              <span>الصفحة {surahData.meta.startPage}</span>
            </div>
          </>
        )}

      </div>

    </div>
  );
};
