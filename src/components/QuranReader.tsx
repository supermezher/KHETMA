import React, { useState, useEffect, useRef } from 'react';
import { SurahData, Ayah, sanitizeAyahText } from '../data/quranService';
import { renderTajweedText } from '../utils/tajweedParser';
import {
  BookOpen, Sparkles, Eye, Share2, Columns, Smartphone,
  ZoomIn, ZoomOut, Palette, Maximize2, Minimize2,
  Bookmark, ChevronLeft, ChevronRight, HelpCircle,
  ChevronsDown, Play, Pause, X, ArrowDown, Radio, Hand,
  ChevronDown, SlidersHorizontal, Volume2
} from 'lucide-react';
import { Reciter } from '../data/reciters';

interface QuranReaderProps {
  surahData: SurahData;
  activeAyahNumber: number;
  onSelectAyah: (ayah: Ayah) => void;
  onAyahAudioSelect?: (ayahNumber: number) => void;
  onOpenShareModal: (ayah: Ayah) => void;
  onOpenTadabburModal: (ayah: Ayah) => void;
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

export const QuranReader: React.FC<QuranReaderProps> = ({
  surahData,
  activeAyahNumber,
  onSelectAyah,
  onAyahAudioSelect,
  onOpenShareModal,
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
  const [isDualPage, setIsDualPage] = useState<boolean>(false);
  const [theme, setTheme] = useState<ReaderTheme>('dark');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ayahRefs = useRef<Record<number, HTMLElement | null>>({});

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
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseAyahTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Synchronize reciter mode when audio starts or stops
  useEffect(() => {
    if (isPlayingAudio) {
      if (isSmartScrollActive) {
        setIsAutoScrolling(true);
      }
      setScrollMode('reciter-sync');
      setIsAutoScrollPaused(false);
    } else {
      // When audio is stopped or paused, turn off auto-scroll if it was following the reciter
      if (scrollMode === 'reciter-sync') {
        setIsAutoScrolling(false);
      }
    }
  }, [isPlayingAudio, isSmartScrollActive, scrollMode]);

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
        const el = ayahRefs.current[activeAyahNumber];
        if (el) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();

          // Ayah's position relative to container's scroll surface
          const elRelativeTop = elRect.top - containerRect.top + container.scrollTop;

          // Intra-ayah progression through words/lines
          const progress = (duration && duration > 0)
            ? Math.max(0, Math.min(1, (currentTime || 0) / duration))
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

              const el = ayahRefs.current[num];
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
    currentTime,
    duration,
    autoScrollSpeed,
    pauseAtAyahEnds,
    surahData.ayahs
  ]);

  // Load saved bookmark
  useEffect(() => {
    const saved = localStorage.getItem(`bayan_bookmark_${surahData.meta.number}`);
    if (saved) {
      setBookmarkedAyah(Number(saved));
    }
  }, [surahData.meta.number]);

  const handleToggleBookmark = (ayahNum: number) => {
    if (bookmarkedAyah === ayahNum) {
      setBookmarkedAyah(null);
      localStorage.removeItem(`bayan_bookmark_${surahData.meta.number}`);
    } else {
      setBookmarkedAyah(ayahNum);
      localStorage.setItem(`bayan_bookmark_${surahData.meta.number}`, String(ayahNum));
    }
  };

  // Determine container styling based on theme
  const getThemeClasses = () => {
    switch (theme) {
      case 'sepia':
        return 'bg-[#fbf7ee] text-[#1c1917] border-amber-900/20';
      case 'emerald':
        return 'bg-[#041a14] text-[#e6f7f2] border-emerald-900/30';
      case 'high-contrast':
        return 'bg-black text-white border-zinc-800';
      default:
        return 'bg-[#0c1319] text-[#e2e8f0] border-slate-800';
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

          {/* Dual Page Toggle (on tablets / desktop) */}
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
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </p>
            </div>
          )}
        </div>

        {/* Verses Container (Single or Dual Page) */}
        <div className={isDualPage ? 'grid grid-cols-1 md:grid-cols-2 gap-8 divide-x-2 divide-amber-500/20' : 'space-y-4'}>
          
          {/* Right Page (or full list) */}
          <div className="space-y-3 leading-loose text-justify font-quran select-text">
            {rightPageAyahs.map((ayah) => {
              const isActive = activeAyahNumber === ayah.numberInSurah;
              const isBookmarked = bookmarkedAyah === ayah.numberInSurah;

              const cleanText = sanitizeAyahText(ayah.text, surahData.meta.number, ayah.numberInSurah);
              const words = cleanText.trim().split(/\s+/);
              let activeWordIndex: number | undefined = undefined;
              if (isActive && isPlayingAudio && duration && duration > 0) {
                const progress = Math.max(0, Math.min(0.99, (currentTime || 0) / duration));
                activeWordIndex = Math.floor(progress * words.length);
              }

              return (
                <span
                  key={ayah.numberInSurah}
                  ref={(el) => {
                    ayahRefs.current[ayah.numberInSurah] = el;
                  }}
                  className={`relative inline transition-colors duration-200 rounded px-1 ${
                    isActive
                      ? 'bg-emerald-500/10'
                      : 'hover:bg-emerald-500/5'
                  }`}
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {/* Ayah Text with Tajweed and synchronized Word-by-Word highlighting */}
                  {renderTajweedText(cleanText, isTajweedActive, () => onOpenTadabburModal({ ...ayah, text: cleanText }), activeWordIndex)}

                  {/* Ayah End Ornament & Number ﴿١﴾ */}
                  <span
                    onClick={() => onOpenTadabburModal({ ...ayah, text: cleanText })}
                    className="ayah-end-symbol mx-1.5 inline-flex items-center justify-center cursor-pointer group"
                    title={`الآية ${ayah.numberInSurah} - انقر للتدبر والتفسير`}
                  >
                    <span className={`font-bold transition-all text-xl ${
                      isActive && isPlayingAudio
                        ? 'text-emerald-400 scale-110 drop-shadow-sm'
                        : 'text-emerald-500 group-hover:scale-125'
                    }`}>
                      ﴿{ayah.numberInSurah}﴾
                    </span>
                  </span>

                  {/* Bookmark badge if set */}
                  {isBookmarked && (
                    <Bookmark className="inline w-4 h-4 text-amber-400 fill-amber-400 align-middle ml-1" />
                  )}
                </span>
              );
            })}
          </div>

          {/* Left Page (Dual Page Mode) */}
          {isDualPage && (
            <div className="space-y-3 leading-loose text-justify font-quran select-text pr-6">
              {leftPageAyahs.map((ayah) => {
                const isActive = activeAyahNumber === ayah.numberInSurah;
                const isBookmarked = bookmarkedAyah === ayah.numberInSurah;

                const cleanText = sanitizeAyahText(ayah.text, surahData.meta.number, ayah.numberInSurah);
                const words = cleanText.trim().split(/\s+/);
                let activeWordIndex: number | undefined = undefined;
                if (isActive && isPlayingAudio && duration && duration > 0) {
                  const progress = Math.max(0, Math.min(0.99, (currentTime || 0) / duration));
                  activeWordIndex = Math.floor(progress * words.length);
                }

                return (
                  <span
                    key={ayah.numberInSurah}
                    ref={(el) => {
                      ayahRefs.current[ayah.numberInSurah] = el;
                    }}
                    className={`relative inline transition-colors duration-200 rounded px-1 ${
                      isActive
                        ? 'bg-emerald-500/10'
                        : 'hover:bg-emerald-500/5'
                    }`}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {renderTajweedText(cleanText, isTajweedActive, () => onOpenTadabburModal({ ...ayah, text: cleanText }), activeWordIndex)}

                    <span
                      onClick={() => onOpenTadabburModal({ ...ayah, text: cleanText })}
                      className="ayah-end-symbol mx-1.5 inline-flex items-center justify-center cursor-pointer group"
                      title={`الآية ${ayah.numberInSurah} - انقر للتدبر والتفسير`}
                    >
                      <span className={`font-bold transition-all text-xl ${
                        isActive && isPlayingAudio
                          ? 'text-emerald-400 scale-110 drop-shadow-sm'
                          : 'text-emerald-500 group-hover:scale-125'
                      }`}>
                        ﴿{ayah.numberInSurah}﴾
                      </span>
                    </span>

                    {isBookmarked && (
                      <Bookmark className="inline w-4 h-4 text-amber-400 fill-amber-400 align-middle ml-1" />
                    )}
                  </span>
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

      </div>

    </div>
  );
};
