import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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
  ChevronDown, SlidersHorizontal, Volume2,
  ChevronRight, ChevronLeft, RefreshCw, AlertCircle, Check, Share2, PenLine,
  Award, ChevronsDown, Sun, Moon, ShieldCheck, Calendar,
  Heart, Sprout, Compass, AlignJustify, LayoutGrid, Plus, Minus, Globe, Languages,
  Highlighter
} from 'lucide-react';
import { APP_THEME_EVENT, AppTheme, LastReadingPosition, loadAppTheme, saveAppTheme } from '../utils/appTheme';
import { Reciter, getReciterDisplayName } from '../data/reciters';
import { SURAHS_LIST, getRevelationTypeLabel, getSurahDisplayName } from '../data/quranMetadata';
import { toArabicIndic } from './khatma/KhatmaRing';
import { READER_PREFS_KEY } from '../utils/userBackup';
import {
  AppLanguage,
  formatLocalizedDigits,
  formatSpeedLabel,
  getAutoScrollPresetLabel,
  getJuzLabel,
  useLanguage,
} from '../utils/i18n';
import {
  getDailyWirdSummary,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  PERSONAL_KHATMA_EVENT,
  recordMushafPageReadInWird,
} from '../utils/personalKhatma';
import {
  BOOKMARKS_UPDATED_EVENT,
  getBookmarkMapBySurah,
  loadAllBookmarks,
  SavedBookmarkEntry,
  toggleSurahBookmark,
} from '../utils/bookmarksStore';
import {
  AUTO_SCROLL_PRESETS,
  DEFAULT_AUTO_SCROLL_SPEED,
  MAX_AUTO_SCROLL_SPEED,
  MIN_AUTO_SCROLL_SPEED,
  appendUniquePageItem,
  clampAutoScrollSpeed,
  clampCircularMomentumSlots,
  clampMushafFontSize,
  computeAutoScrollPxPerSec,
  computeCircularDialSlots,
  computeManualHighlightAnchorScrollTop,
  computePinchFontSize,
  computeReciterSyncStepScrollTop,
  computeReciterSyncTargetScrollTop,
  computeRuledLineMetrics,
  computeShortPageDwellMs,
  computeTrimmedPageStream,
  isInteractiveTapTarget,
  resolveAutoScrollEndAction,
  resolveAutoScrollStateOnAudioChange,
  resolveAyahSelectionTarget,
  resolvePairedPaperTheme,
  resolveReciteStartTarget,
  resolveReciterFollowBehavior,
  resolveRtlPageSwipeDelta,
  resolveVisiblePageFromOffsets,
  shouldJumpMushafPageForAyah,
  shouldToggleImmersiveTap,
  stepAutoScrollSpeed,
  wrapCircularIndex,
} from '../utils/mushafGestures';

export type ReaderTheme = 'parchment' | 'sepia' | 'dark' | 'emerald';
type ReaderMode = 'surah' | 'page';
type ActiveDockSheet = 'none' | 'bookmarks' | 'autoscroll' | 'more' | 'quickjump';

interface StoredReaderPrefs {
  theme?: ReaderTheme;
  fontSize?: number;
  isTajweedActive?: boolean;
  selectedReciterId?: string;
  readerMode?: ReaderMode;
  isRuledLines?: boolean;
  autoAdvancePage?: boolean;
  autoScrollSpeed?: number;
  adaptiveScrollPace?: boolean;
  isManualHighlightMode?: boolean;
}

function getDefaultTheme(): ReaderTheme {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  const currentAppTheme = loadAppTheme();
  if (saved?.theme && ['parchment', 'sepia', 'dark', 'emerald'].includes(saved.theme)) {
    return resolvePairedPaperTheme(saved.theme, currentAppTheme);
  }
  return currentAppTheme === 'light' ? 'parchment' : 'dark';
}

function getDefaultFontSize(): number {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.fontSize === 'number') {
    return clampMushafFontSize(saved.fontSize);
  }
  return 28;
}

function getDefaultReaderMode(): ReaderMode {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (saved?.readerMode === 'surah' || saved?.readerMode === 'page') {
    return saved.readerMode;
  }
  return 'page';
}

function getDefaultRuledLines(): boolean {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.isRuledLines === 'boolean') {
    return saved.isRuledLines;
  }
  return true;
}

function getDefaultAutoAdvancePage(): boolean {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.autoAdvancePage === 'boolean') {
    return saved.autoAdvancePage;
  }
  return true;
}

function getDefaultAutoScrollSpeed(): number {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.autoScrollSpeed === 'number') {
    return clampAutoScrollSpeed(saved.autoScrollSpeed);
  }
  return DEFAULT_AUTO_SCROLL_SPEED;
}

function getDefaultAdaptiveScrollPace(): boolean {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.adaptiveScrollPace === 'boolean') {
    return saved.adaptiveScrollPace;
  }
  return true;
}

function getDefaultManualHighlightMode(): boolean {
  const saved = safeLocalStorage.getJSON<StoredReaderPrefs | null>(READER_PREFS_KEY, null);
  if (typeof saved?.isManualHighlightMode === 'boolean') {
    return saved.isManualHighlightMode;
  }
  return false;
}

interface QuranReaderProps {
  surahData: SurahData;
  activeAyahNumber: number;
  onSelectAyah: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  onAyahAudioSelect?: (ayahNumber: number, surahNumber?: number) => void;
  onOpenShareModal?: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  onOpenTadabburModal: (ayah: Ayah, overrideSurahNumber?: number, overrideSurahName?: string) => void;
  isTajweedActive: boolean;
  onToggleTajweed: () => void;
  isSmartScrollActive: boolean;
  onToggleSmartScroll?: () => void;
  onOpenTajweedLegend: () => void;
  isPlayingAudio?: boolean;
  playTriggerNonce?: number;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  isAudioBarVisible?: boolean;
  onToggleAudioBar?: () => void;
  selectedReciter?: Reciter;
  onTogglePlayAudio?: () => void;
  onOpenSurahPicker?: () => void;
  onOpenAyahSearch?: () => void;
  prefsReloadNonce?: number;
  appTheme?: AppTheme;
  onToggleAppTheme?: () => void;
  onOpenKhatmaPlanner?: () => void;
  onOpenMemorization?: (context: {
    surahNumber: number;
    pageNumber: number;
    ayahNumber: number;
    readerMode: ReaderMode;
  }) => void;
  onNavigateView?: (
    view: 'mushaf' | 'memorization' | 'kids' | 'translations' | 'ruqyah' | 'mood' | 'analytics' | 'khatma' | 'tajweed' | 'journal'
  ) => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onNavigateToJuz?: (juzNumber: number) => void;
  onOpenAudioSheet?: () => void;
  isAudioSheetOpen?: boolean;
  savedResumePos?: LastReadingPosition | null;
}

interface AyahSpanProps {
  ayah: Ayah;
  surahNumber: number;
  surahName: string;
  lang: AppLanguage;
  isActive: boolean;
  isManualSelected?: boolean;
  isManualHighlightMode?: boolean;
  isBookmarked: boolean;
  isPlayingAudio?: boolean;
  isLightPaper: boolean;
  fontSize: number;
  lineHeightPx: number;
  isTajweedActive: boolean;
  activeWordIndex?: number;
  onManualSelectAyah?: (ayah: Ayah, surahNumber: number, surahName: string) => void;
  onTriggerAyahMenu: (ayah: Ayah, surahNumber: number, surahName: string) => void;
  onToggleBookmark: (ayahNumber: number, targetSurahNumber?: number) => void;
  setRef: (el: HTMLSpanElement | null) => void;
}

const isAyahButtonTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean((target as Element).closest('button, a, input, select, textarea, label, [role="button"]'));
};

const AyahSpan = React.memo<AyahSpanProps>(({
  ayah,
  surahNumber,
  surahName,
  lang,
  isActive,
  isManualSelected = false,
  isManualHighlightMode = false,
  isBookmarked,
  isPlayingAudio,
  isLightPaper,
  fontSize,
  lineHeightPx,
  isTajweedActive,
  activeWordIndex,
  onManualSelectAyah,
  onTriggerAyahMenu,
  onToggleBookmark,
  setRef
}) => {
  const cleanText = sanitizeAyahText(ayah.text, surahNumber, ayah.numberInSurah);
  const cleanTajweed = ayah.tajweedText ? sanitizeAyahText(ayah.tajweedText, surahNumber, ayah.numberInSurah) : undefined;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const didLongPressRef = useRef<boolean>(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressOriginRef.current = null;
  };

  useEffect(() => () => clearLongPress(), []);

  const openMenu = () => {
    const cleaned = { ...ayah, text: cleanText };
    onTriggerAyahMenu(cleaned, surahNumber, surahName);
  };

  const highlightClass = isManualSelected
    ? 'bg-[#D9B45A]/24 ring-1 ring-[#8A6418]/50 dark:bg-[#D9B45A]/20 dark:ring-[#D9B45A]/60 shadow-[0_0_0_2px_rgba(217,180,90,0.12)]'
    : isActive
    ? isLightPaper
      ? 'bg-[#1F3A6E]/10'
      : 'bg-[#2E5499]/22'
    : '';

  return (
    <span
      ref={setRef}
      data-no-tap-toggle={isManualHighlightMode ? 'true' : undefined}
      onPointerDown={(e) => {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (isAyahButtonTarget(e.target)) return;
        didLongPressRef.current = false;
        pressOriginRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          didLongPressRef.current = true;
          const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
          if (!sel) {
            openMenu();
          }
        }, 430);
      }}
      onPointerMove={(e) => {
        if (!pressOriginRef.current) return;
        const dist = Math.hypot(e.clientX - pressOriginRef.current.x, e.clientY - pressOriginRef.current.y);
        if (dist > 8) {
          clearLongPress();
        }
      }}
      onPointerUp={(e) => {
        const origin = pressOriginRef.current;
        const wasLongPress = didLongPressRef.current;
        clearLongPress();
        if (!isManualHighlightMode || !origin || wasLongPress || isAyahButtonTarget(e.target)) return;
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        const elapsed = performance.now() - origin.time;
        const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
        if (dist < 8 && elapsed <= 360 && !sel) {
          const cleaned = { ...ayah, text: cleanText };
          onManualSelectAyah?.(cleaned, surahNumber, surahName);
        }
      }}
      onPointerCancel={clearLongPress}
      onDoubleClick={(e) => {
        if (isAyahButtonTarget(e.target)) return;
        e.stopPropagation();
        openMenu();
      }}
      onContextMenu={(e) => {
        const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
        if (sel) return;
        e.preventDefault();
        e.stopPropagation();
        openMenu();
      }}
      className={`relative inline transition-colors duration-200 rounded px-0.5 group/ayah ${
        isManualHighlightMode ? 'cursor-pointer hover:bg-[#D9B45A]/12' : ''
      } ${highlightClass}`}
      style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
    >
      {renderTajweedText(
        cleanText,
        isTajweedActive,
        undefined,
        activeWordIndex,
        cleanTajweed
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openMenu();
        }}
        className="ayah-end-symbol mx-1 inline-flex items-center justify-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] rounded"
        title={
          lang === 'en'
            ? `Ayah ${ayah.numberInSurah} - Tap for Tafsir & options`
            : `الآية ${toArabicIndic(ayah.numberInSurah)} - انقر للخيارات والتفسير`
        }
        aria-label={
          lang === 'en'
            ? `Ayah ${ayah.numberInSurah}, tap for options and Tafsir`
            : `الآية ${ayah.numberInSurah}، اضغط لخيارات الآية والتفسير`
        }
      >
        <span
          className={`font-bold transition-transform text-[0.76em] tracking-tight ${
            isManualSelected
              ? isLightPaper
                ? 'text-[#6F4E0E] scale-110'
                : 'text-[#F6D37A] scale-110 drop-shadow-sm'
              : isActive && isPlayingAudio
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
      {isBookmarked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(ayah.numberInSurah, surahNumber);
          }}
          aria-label={lang === 'en' ? 'Remove bookmark' : 'إزالة علامة الوقف'}
          title={lang === 'en' ? 'Saved bookmark · Tap to remove' : 'علامة وقف محفوظة · انقر للإزالة'}
          className={`inline-flex items-center justify-center align-middle mx-0.5 p-1 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
            isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 fill-current" />
        </button>
      )}
    </span>
  );
}, (prev, next) =>
  prev.ayah.numberInSurah === next.ayah.numberInSurah &&
  prev.ayah.text === next.ayah.text &&
  prev.ayah.tajweedText === next.ayah.tajweedText &&
  prev.surahNumber === next.surahNumber &&
  prev.surahName === next.surahName &&
  prev.lang === next.lang &&
  prev.isActive === next.isActive &&
  prev.isManualSelected === next.isManualSelected &&
  prev.isManualHighlightMode === next.isManualHighlightMode &&
  prev.isBookmarked === next.isBookmarked &&
  prev.isPlayingAudio === next.isPlayingAudio &&
  prev.isLightPaper === next.isLightPaper &&
  prev.fontSize === next.fontSize &&
  prev.lineHeightPx === next.lineHeightPx &&
  prev.isTajweedActive === next.isTajweedActive &&
  prev.activeWordIndex === next.activeWordIndex
);

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
  playTriggerNonce = 0,
  currentTime,
  duration,
  playbackRate = 1,
  isFullScreen = false,
  onToggleFullScreen,
  selectedReciter,
  onTogglePlayAudio,
  onOpenSurahPicker,
  onOpenAyahSearch,
  prefsReloadNonce = 0,
  appTheme,
  onToggleAppTheme,
  onOpenKhatmaPlanner,
  onOpenMemorization,
  onNavigateView,
  onNavigateToAyah,
  onNavigateToJuz,
  onOpenAudioSheet,
  isAudioSheetOpen = false,
  savedResumePos,
}) => {
  const { lang, dir, toggleLang, t } = useLanguage();
  const resolveSurahTitle = useCallback(
    (surahNum: number, fallbackArabic: string) => {
      const meta = SURAHS_LIST[surahNum - 1];
      return meta ? getSurahDisplayName(meta, lang) : fallbackArabic;
    },
    [lang]
  );

  const [fontSize, setFontSize] = useState<number>(() => getDefaultFontSize());
  const [readerMode, setReaderMode] = useState<ReaderMode>(() => getDefaultReaderMode());
  const [isRuledLines, setIsRuledLines] = useState<boolean>(() => getDefaultRuledLines());
  const [autoAdvancePage, setAutoAdvancePage] = useState<boolean>(() => getDefaultAutoAdvancePage());
  const [mushafPageNumber, setMushafPageNumber] = useState<number>(() => {
    const matched = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
    return matched?.page || surahData.meta.startPage || 1;
  });
  const [pageStreamAnchor, setPageStreamAnchor] = useState<number>(() => mushafPageNumber);
  const [pageJumpNonce, setPageJumpNonce] = useState<number>(0);
  const [pageInputDraft, setPageInputDraft] = useState<string>(() => String(mushafPageNumber));
  const [pageStream, setPageStream] = useState<MushafPageData[]>([]);
  const [isPreloadingNextPage, setIsPreloadingNextPage] = useState<boolean>(false);
  const [preloadRetryNonce, setPreloadRetryNonce] = useState<number>(0);
  const [failedPreloadPage, setFailedPreloadPage] = useState<number | null>(null);
  const pageData = useMemo(
    () => pageStream.find((p) => p.pageNumber === mushafPageNumber) ?? pageStream[0] ?? null,
    [pageStream, mushafPageNumber]
  );
  const [personalWirdPlan, setPersonalWirdPlan] = useState<KhatmaPlan | null>(() => loadPersonalKhatmaPlan());
  const initialPageInModeRef = useRef<number | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReloadTrigger, setPageReloadTrigger] = useState<number>(0);

  const [isDualPage, setIsDualPage] = useState<boolean>(false);
  const [theme, setTheme] = useState<ReaderTheme>(() => getDefaultTheme());
  const [localChromeHidden, setLocalChromeHidden] = useState<boolean>(false);
  const [activeDockSheet, setActiveDockSheet] = useState<ActiveDockSheet>('none');
  const [quickJumpTab, setQuickJumpTab] = useState<'page' | 'juz'>('page');
  const [pinchSizePreview, setPinchSizePreview] = useState<number | null>(null);
  const [quickActionTarget, setQuickActionTarget] = useState<{
    ayah: Ayah;
    surahNumber: number;
    surahName: string;
  } | null>(null);
  const [isManualHighlightMode, setIsManualHighlightMode] = useState<boolean>(() =>
    getDefaultManualHighlightMode()
  );
  const [manualHighlight, setManualHighlight] = useState<{
    ayah: Ayah;
    surahNumber: number;
    surahName: string;
  } | null>(null);

  const [bookmarksBySurah, setBookmarksBySurah] = useState<Record<number, number>>(() => getBookmarkMapBySurah());
  const [allBookmarksList, setAllBookmarksList] = useState<SavedBookmarkEntry[]>(() => loadAllBookmarks());
  const [segmentsBySurahKey, setSegmentsBySurahKey] = useState<Record<string, Record<number, WordSegment[]>>>({});

  const isChromeHidden = typeof onToggleFullScreen === 'function' ? isFullScreen : localChromeHidden;
  const toggleChromeHidden = useCallback(() => {
    if (onToggleFullScreen) {
      onToggleFullScreen();
    } else {
      setLocalChromeHidden((prev) => !prev);
    }
  }, [onToggleFullScreen]);

  // Close dock sheets automatically when entering immersive mode or when external audio sheet opens
  useEffect(() => {
    if (isChromeHidden) {
      setActiveDockSheet('none');
      setQuickActionTarget(null);
    }
  }, [isChromeHidden]);

  useEffect(() => {
    if (isAudioSheetOpen) {
      setActiveDockSheet('none');
      setQuickActionTarget(null);
    }
  }, [isAudioSheetOpen]);

  // Sync reader preferences when restored from backup
  useEffect(() => {
    if (prefsReloadNonce > 0) {
      setTheme(getDefaultTheme());
      setFontSize(getDefaultFontSize());
      setReaderMode(getDefaultReaderMode());
      setIsRuledLines(getDefaultRuledLines());
      setAutoAdvancePage(getDefaultAutoAdvancePage());
    }
  }, [prefsReloadNonce]);

  // Pair all Mushaf paper themes (including sepia/emerald) cleanly when user switches global Day/Night toggle
  useEffect(() => {
    const handleGlobalTheme = (e: Event) => {
      const nextAppTheme = (e as CustomEvent<AppTheme>).detail;
      setTheme((prev) => resolvePairedPaperTheme(prev, nextAppTheme));
    };
    window.addEventListener(APP_THEME_EVENT, handleGlobalTheme);
    return () => window.removeEventListener(APP_THEME_EVENT, handleGlobalTheme);
  }, []);

  const handleSelectPaperTheme = useCallback((nextPaper: ReaderTheme) => {
    setTheme(nextPaper);
    const nextAppTheme: AppTheme = nextPaper === 'parchment' || nextPaper === 'sepia' ? 'light' : 'dark';
    saveAppTheme(nextAppTheme);
  }, []);

  // Persist fontSize, theme, readerMode, ruled lines, and autoAdvancePage cleanly
  useEffect(() => {
    const prev = safeLocalStorage.getJSON<StoredReaderPrefs>(READER_PREFS_KEY, {});
    safeLocalStorage.setJSON(READER_PREFS_KEY, {
      ...prev,
      theme,
      fontSize,
      readerMode,
      isRuledLines,
      autoAdvancePage,
    });
  }, [theme, fontSize, readerMode, isRuledLines, autoAdvancePage]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ayahRefs = useRef<Record<string, HTMLElement | null>>({});
  const pageSectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const streamSessionIdRef = useRef<number>(0);
  const inFlightPreloadRef = useRef<Set<number>>(new Set());
  const pendingTopTrimCompensationRef = useRef<number>(0);

  // Circular bottom dock dial state & smooth momentum snap refs
  const [dialOffset, setDialOffset] = useState<number>(0);
  const [isDialDragging, setIsDialDragging] = useState<boolean>(false);
  const dialOffsetRef = useRef<number>(0);
  const dialTrackRef = useRef<HTMLDivElement | null>(null);
  const dialAnimFrameRef = useRef<number | null>(null);
  const suppressDialClickUntilRef = useRef<number>(0);
  const lastDialWheelRef = useRef<number>(0);
  const dialDragRef = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    lastTime: number;
    startOffset: number;
    slotWidth: number;
    velocitySlotsPerSec: number;
    didDrag: boolean;
  } | null>(null);

  // Keep latest audio timing & active ayah in refs for 60fps auto-scroll
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const playbackRateRef = useRef(playbackRate);
  const activeAyahNumberRef = useRef(activeAyahNumber);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  playbackRateRef.current = playbackRate;
  activeAyahNumberRef.current = activeAyahNumber;
  const fetchedSegmentKeysRef = useRef<Set<string>>(new Set());

  const jumpToMushafPage = useCallback((targetPage: number) => {
    const clamped = Math.min(604, Math.max(1, Math.round(targetPage)));
    streamSessionIdRef.current += 1;
    inFlightPreloadRef.current.clear();
    setFailedPreloadPage(null);
    setMushafPageNumber(clamped);
    setPageStreamAnchor(clamped);
    setPageJumpNonce((n) => n + 1);
    setPageInputDraft(String(clamped));
  }, []);

  const lastNavCoordRef = useRef<string>(`${surahData.meta.number}:${activeAyahNumber}`);
  const prevSurahForNavRef = useRef<number>(surahData.meta.number);
  const prevPlayNonceForNavRef = useRef<number>(playTriggerNonce);
  const prevReaderModeForNavRef = useRef<ReaderMode>(readerMode);
  useEffect(() => {
    const nextCoord = `${surahData.meta.number}:${activeAyahNumber}`;
    const isSurahChanged = prevSurahForNavRef.current !== surahData.meta.number;
    const isPlayTriggered = prevPlayNonceForNavRef.current !== playTriggerNonce;
    const isReaderModeChanged = prevReaderModeForNavRef.current !== readerMode;
    prevSurahForNavRef.current = surahData.meta.number;
    prevPlayNonceForNavRef.current = playTriggerNonce;
    prevReaderModeForNavRef.current = readerMode;

    const isExplicitNavigation = isSurahChanged || isPlayTriggered || isReaderModeChanged;
    if (isSurahChanged || isPlayTriggered) {
      setManualHighlight(null);
    }

    const followBehavior = resolveReciterFollowBehavior({
      isPlayingAudio: Boolean(isPlayingAudio),
      scrollMode: scrollModeRef.current,
      isManualHighlightMode: isManualHighlightModeRef.current,
      hasManualHighlight: Boolean(manualHighlightRef.current),
      isExplicitNavigation,
    });

    if ((readerMode === 'surah' || lastNavCoordRef.current !== nextCoord) && followBehavior.shouldJumpMushafPage) {
      lastNavCoordRef.current = nextCoord;
      const matched = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
      const targetPage = matched?.page || surahData.meta.startPage || 1;
      if (
        shouldJumpMushafPageForAyah({
          readerMode,
          targetPage,
          loadedStreamPages: pageStreamRef.current.map((p) => p.pageNumber),
          isReaderModeChanged,
        })
      ) {
        jumpToMushafPage(targetPage);
      } else if (readerMode === 'page') {
        const shouldSkipDomScrollIntoView =
          !isExplicitNavigation &&
          followBehavior.shouldSyncReciterScroll &&
          isSmartScrollActive;
        if (!shouldSkipDomScrollIntoView) {
          const key = `${surahData.meta.number}:${activeAyahNumber}`;
          requestAnimationFrame(() => {
            const el = ayahRefs.current[key];
            if (el && (isExplicitNavigation || targetPage !== mushafPageNumberRef.current)) {
              programmaticSmoothScrollUntilRef.current = performance.now() + 750;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      }
    }
  }, [
    readerMode,
    surahData.meta.number,
    surahData.meta.startPage,
    activeAyahNumber,
    surahData.ayahs,
    jumpToMushafPage,
    isPlayingAudio,
    playTriggerNonce,
  ]);

  // Keep personal Khatma plan live
  useEffect(() => {
    const syncWirdPlan = () => setPersonalWirdPlan(loadPersonalKhatmaPlan());
    window.addEventListener(PERSONAL_KHATMA_EVENT, syncWirdPlan);
    window.addEventListener('storage', syncWirdPlan);
    return () => {
      window.removeEventListener(PERSONAL_KHATMA_EVENT, syncWirdPlan);
      window.removeEventListener('storage', syncWirdPlan);
    };
  }, []);

  // Fetch initial/anchor 604-page Mushaf data when Page mode is active or user jumps explicitly
  useEffect(() => {
    if (readerMode !== 'page') {
      initialPageInModeRef.current = null;
      return;
    }
    let isCancelled = false;
    streamSessionIdRef.current += 1;
    const sessionId = streamSessionIdRef.current;
    inFlightPreloadRef.current.clear();
    setFailedPreloadPage(null);
    setIsLoadingPage(true);
    setPageError(null);

    getMushafPageData(pageStreamAnchor)
      .then((data) => {
        if (!isCancelled && streamSessionIdRef.current === sessionId) {
          setPageStream([data]);
          setMushafPageNumber(pageStreamAnchor);
          setPageInputDraft(String(pageStreamAnchor));
          setIsLoadingPage(false);
          recordPageProgress(pageStreamAnchor);
          if (initialPageInModeRef.current === null) {
            initialPageInModeRef.current = pageStreamAnchor;
          } else if (initialPageInModeRef.current !== pageStreamAnchor) {
            recordMushafPageReadInWird(pageStreamAnchor);
          }
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            preciseScrollTop.current = 0;
            lastProgrammaticScrollTopRef.current = 0;
          }
          if (pageAdvanceTimeoutRef.current) {
            clearTimeout(pageAdvanceTimeoutRef.current);
            pageAdvanceTimeoutRef.current = null;
          }
          isAdvancingPageRef.current = false;
          setIsAdvancingPageUi(false);
          shortPageStartTimeRef.current = null;
        }
      })
      .catch((err) => {
        if (!isCancelled && streamSessionIdRef.current === sessionId) {
          setPageError(err instanceof Error ? err.message : t('تعذر تحميل صفحة المصحف', "Could not load Mus'haf page"));
          setIsLoadingPage(false);
          if (pageAdvanceTimeoutRef.current) {
            clearTimeout(pageAdvanceTimeoutRef.current);
            pageAdvanceTimeoutRef.current = null;
          }
          isAdvancingPageRef.current = false;
          setIsAdvancingPageUi(false);
          shortPageStartTimeRef.current = null;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [readerMode, pageStreamAnchor, pageJumpNonce, pageReloadTrigger]);

  // Silently preload and append the next Mushaf page below current page for seamless connected flow
  useEffect(() => {
    if (readerMode !== 'page' || isLoadingPage) return;

    if (!autoAdvancePage) {
      if (pageStream.length > 1) {
        const currentOnly = pageStream.find((p) => p.pageNumber === mushafPageNumber);
        if (currentOnly) {
          const firstEl = pageSectionRefs.current[pageStream[0].pageNumber];
          const activeEl = pageSectionRefs.current[currentOnly.pageNumber];
          if (firstEl && activeEl) {
            const delta = Math.max(0, activeEl.offsetTop - firstEl.offsetTop);
            if (delta > 0) {
              pendingTopTrimCompensationRef.current += delta;
            }
          }
          setPageStream([currentOnly]);
        }
      }
      setIsPreloadingNextPage(false);
      setFailedPreloadPage(null);
      return;
    }

    const nextTargetPage = mushafPageNumber + 1;
    if (nextTargetPage > 604) {
      setIsPreloadingNextPage(false);
      return;
    }

    if (pageStream.some((p) => p.pageNumber === nextTargetPage)) {
      setIsPreloadingNextPage(false);
      return;
    }

    if (inFlightPreloadRef.current.has(nextTargetPage)) return;

    const sessionId = streamSessionIdRef.current;
    inFlightPreloadRef.current.add(nextTargetPage);
    setIsPreloadingNextPage(true);
    setFailedPreloadPage(null);

    getMushafPageData(nextTargetPage)
      .then((nextData) => {
        inFlightPreloadRef.current.delete(nextTargetPage);
        if (streamSessionIdRef.current !== sessionId) return;
        setPageStream((prev) => appendUniquePageItem(prev, nextData));
        setIsPreloadingNextPage(inFlightPreloadRef.current.size > 0);
      })
      .catch(() => {
        inFlightPreloadRef.current.delete(nextTargetPage);
        if (streamSessionIdRef.current !== sessionId) return;
        setFailedPreloadPage(nextTargetPage);
        setIsPreloadingNextPage(inFlightPreloadRef.current.size > 0);
      });
  }, [readerMode, autoAdvancePage, mushafPageNumber, pageStream, isLoadingPage, preloadRetryNonce]);

  // Trim distant older pages from top of continuous stream without accumulating unbounded DOM
  useEffect(() => {
    if (readerMode !== 'page' || !autoAdvancePage || pageStream.length <= 6) return;
    const { kept, trimmedPageNumbers } = computeTrimmedPageStream(pageStream, mushafPageNumber, 6);
    if (trimmedPageNumbers.length === 0 || kept.length === 0) return;

    const firstTrimEl = pageSectionRefs.current[trimmedPageNumbers[0]];
    const firstKeptEl = pageSectionRefs.current[kept[0].pageNumber];
    if (firstTrimEl && firstKeptEl) {
      const delta = Math.max(0, firstKeptEl.offsetTop - firstTrimEl.offsetTop);
      if (delta > 0) {
        pendingTopTrimCompensationRef.current += delta;
      }
    }
    setPageStream(kept);
  }, [readerMode, autoAdvancePage, pageStream, mushafPageNumber]);

  // Apply scroll offset compensation synchronously before browser paint after top-page pruning
  useLayoutEffect(() => {
    const comp = pendingTopTrimCompensationRef.current;
    if (comp > 0 && containerRef.current) {
      pendingTopTrimCompensationRef.current = 0;
      const nextTop = Math.max(0, containerRef.current.scrollTop - comp);
      containerRef.current.scrollTop = nextTop;
      preciseScrollTop.current = nextTop;
      lastProgrammaticScrollTopRef.current = nextTop;
    }
  }, [pageStream]);

  // Fetch Quran.com word-timing segments
  useEffect(() => {
    const recId = selectedReciter?.quranComRecitationId;
    if (!recId) return;

    const targetSurahs = new Set<number>([surahData.meta.number]);
    if (readerMode === 'page') {
      pageStream.forEach((pg) => pg.ayahs.forEach((a) => targetSurahs.add(a.surahNumber)));
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
  }, [selectedReciter?.quranComRecitationId, surahData.meta.number, readerMode, pageStream]);

  // Unified Auto-Scroll Engine
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);
  const [scrollMode, setScrollMode] = useState<'reciter-sync' | 'manual-speed'>('reciter-sync');
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(() => getDefaultAutoScrollSpeed());
  const [adaptiveScrollPace, setAdaptiveScrollPace] = useState<boolean>(() => getDefaultAdaptiveScrollPace());
  const [pauseAtAyahEnds, setPauseAtAyahEnds] = useState<boolean>(false);
  const [isPausedAtAyah, setIsPausedAtAyah] = useState<boolean>(false);
  const [isAdvancingPageUi, setIsAdvancingPageUi] = useState<boolean>(false);
  const pausedAyahsHistory = useRef<Set<string>>(new Set());

  const autoScrollSpeedRef = useRef<number>(autoScrollSpeed);
  autoScrollSpeedRef.current = autoScrollSpeed;
  const fontSizeRef = useRef<number>(fontSize);
  fontSizeRef.current = fontSize;
  const adaptiveScrollPaceRef = useRef<boolean>(adaptiveScrollPace);
  adaptiveScrollPaceRef.current = adaptiveScrollPace;

  // Sync restored speed & manual highlight preferences when prefsReloadNonce updates
  useEffect(() => {
    if (prefsReloadNonce > 0) {
      setAutoScrollSpeed(getDefaultAutoScrollSpeed());
      setAdaptiveScrollPace(getDefaultAdaptiveScrollPace());
      setIsManualHighlightMode(getDefaultManualHighlightMode());
    }
  }, [prefsReloadNonce]);

  // Persist autoScrollSpeed, adaptiveScrollPace & isManualHighlightMode cleanly
  useEffect(() => {
    const prev = safeLocalStorage.getJSON<StoredReaderPrefs>(READER_PREFS_KEY, {});
    safeLocalStorage.setJSON(READER_PREFS_KEY, {
      ...prev,
      autoScrollSpeed,
      adaptiveScrollPace,
      isManualHighlightMode,
    });
  }, [autoScrollSpeed, adaptiveScrollPace, isManualHighlightMode]);

  // Long-press hold handlers for + / - fine speed stepping
  const speedHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedHoldDidRepeatRef = useRef<boolean>(false);

  const clearSpeedHoldTimers = useCallback(() => {
    if (speedHoldTimeoutRef.current) {
      clearTimeout(speedHoldTimeoutRef.current);
      speedHoldTimeoutRef.current = null;
    }
    if (speedHoldIntervalRef.current) {
      clearInterval(speedHoldIntervalRef.current);
      speedHoldIntervalRef.current = null;
    }
  }, []);

  const applyFineSpeedStep = useCallback(
    (direction: 1 | -1) => {
      const next = stepAutoScrollSpeed(autoScrollSpeedRef.current, direction);
      autoScrollSpeedRef.current = next;
      setAutoScrollSpeed(next);
      setScrollMode('manual-speed');
      if (
        (direction === 1 && next >= MAX_AUTO_SCROLL_SPEED) ||
        (direction === -1 && next <= MIN_AUTO_SCROLL_SPEED)
      ) {
        clearSpeedHoldTimers();
      }
    },
    [clearSpeedHoldTimers]
  );

  const handleSpeedHoldStart = useCallback(
    (direction: 1 | -1) => {
      clearSpeedHoldTimers();
      speedHoldDidRepeatRef.current = false;
      speedHoldTimeoutRef.current = setTimeout(() => {
        speedHoldDidRepeatRef.current = true;
        applyFineSpeedStep(direction);
        speedHoldIntervalRef.current = setInterval(() => {
          applyFineSpeedStep(direction);
        }, 95);
      }, 360);
    },
    [clearSpeedHoldTimers, applyFineSpeedStep]
  );

  const handleSpeedStepClick = useCallback(
    (direction: 1 | -1) => {
      clearSpeedHoldTimers();
      if (speedHoldDidRepeatRef.current) {
        speedHoldDidRepeatRef.current = false;
        return;
      }
      applyFineSpeedStep(direction);
    },
    [clearSpeedHoldTimers, applyFineSpeedStep]
  );

  const preciseScrollTop = useRef<number>(0);
  const lastProgrammaticScrollTopRef = useRef<number>(0);
  const programmaticSmoothScrollUntilRef = useRef<number>(0);
  const isTouchActive = useRef<boolean>(false);
  const isManualOverrideRef = useRef<boolean>(false);
  const isEngineActive = isAutoScrolling || (Boolean(isPlayingAudio) && isSmartScrollActive);
  const isEngineActiveRef = useRef<boolean>(isEngineActive);
  isEngineActiveRef.current = isEngineActive;
  const isAutoScrollingRef = useRef<boolean>(isAutoScrolling);
  isAutoScrollingRef.current = isAutoScrolling;
  const onNavigateToAyahRef = useRef(onNavigateToAyah);
  onNavigateToAyahRef.current = onNavigateToAyah;
  const surahAyahsRef = useRef(surahData.ayahs);
  surahAyahsRef.current = surahData.ayahs;

  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseAyahTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdvancingPageRef = useRef<boolean>(false);
  const shortPageStartTimeRef = useRef<number | null>(null);

  const isLoadingPageRef = useRef<boolean>(isLoadingPage);
  isLoadingPageRef.current = isLoadingPage;
  const autoAdvancePageRef = useRef<boolean>(autoAdvancePage);
  autoAdvancePageRef.current = autoAdvancePage;
  const mushafPageNumberRef = useRef<number>(mushafPageNumber);
  mushafPageNumberRef.current = mushafPageNumber;
  const readerModeRef = useRef<ReaderMode>(readerMode);
  readerModeRef.current = readerMode;
  const surahNumberRef = useRef<number>(surahData.meta.number);
  surahNumberRef.current = surahData.meta.number;

  // Tap, Swipe, & Pinch gesture refs
  const tapStartRef = useRef<{ x: number; y: number; time: number; interactive: boolean } | null>(null);
  const pinchStartRef = useRef<{ dist: number; initialSize: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPinchRef = useRef<boolean>(false);
  const didSwipeRef = useRef<boolean>(false);
  const didLongPressMenuRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
      if (pinchPreviewTimerRef.current) clearTimeout(pinchPreviewTimerRef.current);
      if (pageAdvanceTimeoutRef.current) clearTimeout(pageAdvanceTimeoutRef.current);
      clearSpeedHoldTimers();
    };
  }, [clearSpeedHoldTimers]);

  useEffect(() => {
    if (!isEngineActive || isAutoScrollPaused || !autoAdvancePage) {
      if (pageAdvanceTimeoutRef.current) {
        clearTimeout(pageAdvanceTimeoutRef.current);
        pageAdvanceTimeoutRef.current = null;
      }
      isAdvancingPageRef.current = false;
      setIsAdvancingPageUi(false);
      shortPageStartTimeRef.current = null;
    }
    if (!isEngineActive) {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      isTouchActive.current = false;
      isManualOverrideRef.current = false;
      setIsUserInteracting(false);
    }
  }, [isEngineActive, isAutoScrollPaused, autoAdvancePage]);

  useEffect(() => {
    shortPageStartTimeRef.current = null;
    if (pageAdvanceTimeoutRef.current) {
      clearTimeout(pageAdvanceTimeoutRef.current);
      pageAdvanceTimeoutRef.current = null;
    }
    isAdvancingPageRef.current = false;
    setIsAdvancingPageUi(false);
  }, [readerMode]);

  useEffect(() => {
    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      preciseScrollTop.current = top;
      lastProgrammaticScrollTopRef.current = top;
    }
    shortPageStartTimeRef.current = null;
  }, [surahData.meta.number, isAutoScrolling, autoScrollSpeed]);

  const scrollModeRef = useRef(scrollMode);
  scrollModeRef.current = scrollMode;
  const isManualHighlightModeRef = useRef(isManualHighlightMode);
  isManualHighlightModeRef.current = isManualHighlightMode;
  const manualHighlightRef = useRef(manualHighlight);
  manualHighlightRef.current = manualHighlight;

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

    if (pageAdvanceTimeoutRef.current) {
      clearTimeout(pageAdvanceTimeoutRef.current);
      pageAdvanceTimeoutRef.current = null;
    }
    isAdvancingPageRef.current = false;
    setIsAdvancingPageUi(false);
    shortPageStartTimeRef.current = null;

    if (pauseAyahTimeoutRef.current) {
      clearTimeout(pauseAyahTimeoutRef.current);
      pauseAyahTimeoutRef.current = null;
    }
    setIsPausedAtAyah(false);

    if (clearAyahPauseHistory) {
      pausedAyahsHistory.current.clear();
    }
  };

  const handleStepMushafPage = useCallback(
    (delta: number) => {
      if (pageAdvanceTimeoutRef.current) {
        clearTimeout(pageAdvanceTimeoutRef.current);
        pageAdvanceTimeoutRef.current = null;
      }
      isAdvancingPageRef.current = false;
      setIsAdvancingPageUi(false);
      shortPageStartTimeRef.current = null;

      jumpToMushafPage(mushafPageNumberRef.current + delta);
    },
    [jumpToMushafPage]
  );

  const pageStreamRef = useRef<MushafPageData[]>(pageStream);
  pageStreamRef.current = pageStream;

  const syncVisibleStreamPage = useCallback(() => {
    if (readerModeRef.current !== 'page') return;
    const stream = pageStreamRef.current;
    if (stream.length <= 1 || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const readingLineY = containerRect.top + Math.min(180, containerRect.height * 0.35);

    const entries = stream
      .map((pg) => {
        const el = pageSectionRefs.current[pg.pageNumber];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { pageNumber: pg.pageNumber, top: r.top, bottom: r.bottom };
      })
      .filter((e): e is { pageNumber: number; top: number; bottom: number } => e !== null);

    const visiblePage = resolveVisiblePageFromOffsets(entries, readingLineY, mushafPageNumberRef.current);
    if (visiblePage !== mushafPageNumberRef.current) {
      mushafPageNumberRef.current = visiblePage;
      setMushafPageNumber(visiblePage);
      setPageInputDraft(String(visiblePage));
      recordPageProgress(visiblePage);
      if (initialPageInModeRef.current !== null && initialPageInModeRef.current !== visiblePage) {
        recordMushafPageReadInWird(visiblePage);
      }
    }
  }, []);

  // Touch handlers: Pinch-to-Zoom + RTL Swipe Page Turn + Auto-Scroll Thumb Override
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isTouchActive.current = true;
    programmaticSmoothScrollUntilRef.current = 0;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    activateManualOverride(false);

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartRef.current = { dist, initialSize: fontSize };
      didPinchRef.current = true;
      swipeStartRef.current = null;
      return;
    }

    if (e.touches.length === 1) {
      didPinchRef.current = false;
      didSwipeRef.current = false;
      swipeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    isTouchActive.current = true;
    programmaticSmoothScrollUntilRef.current = 0;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    activateManualOverride(true);

    if (e.touches.length === 2 && pinchStartRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const nextSize = computePinchFontSize(
        pinchStartRef.current.initialSize,
        pinchStartRef.current.dist,
        curDist
      );
      setFontSize(nextSize);
      setPinchSizePreview(nextSize);
      if (pinchPreviewTimerRef.current) clearTimeout(pinchPreviewTimerRef.current);
      pinchPreviewTimerRef.current = setTimeout(() => setPinchSizePreview(null), 950);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchStartRef.current = null;
    }

    if (
      readerMode === 'page' &&
      !didPinchRef.current &&
      swipeStartRef.current &&
      e.changedTouches.length > 0 &&
      e.touches.length === 0
    ) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - swipeStartRef.current.x;
      const dy = touch.clientY - swipeStartRef.current.y;
      const swipeDelta = resolveRtlPageSwipeDelta(dx, dy, 60);
      if (swipeDelta !== 0) {
        didSwipeRef.current = true;
        handleStepMushafPage(swipeDelta);
      }
    }

    if (e.touches.length === 0) {
      isTouchActive.current = false;
      swipeStartRef.current = null;
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
    }
  };

  const handleWheel = () => {
    programmaticSmoothScrollUntilRef.current = 0;
    activateManualOverride(true);
    if (isEngineActiveRef.current) {
      scheduleManualResume();
    }
  };

  const handleContainerScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    syncVisibleStreamPage();

    const currentTop = container.scrollTop;
    if (!isTouchActive.current && performance.now() < programmaticSmoothScrollUntilRef.current) {
      preciseScrollTop.current = currentTop;
      lastProgrammaticScrollTopRef.current = currentTop;
      return;
    }

    const isDeltaManual = Math.abs(currentTop - lastProgrammaticScrollTopRef.current) > 2.5;

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

  // Pointer tap handler on Mushaf surface: single center tap toggles immersive chrome
  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    didLongPressMenuRef.current = false;
    tapStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      interactive: isInteractiveTapTarget(e.target),
    };
  };

  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || !tapStartRef.current) return;
    const start = tapStartRef.current;
    tapStartRef.current = null;

    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() || '' : '';
    const canToggle = shouldToggleImmersiveTap({
      dx: e.clientX - start.x,
      dy: e.clientY - start.y,
      durationMs: performance.now() - start.time,
      didPinch: didPinchRef.current,
      didLongPress: didLongPressMenuRef.current,
      didSwipe: didSwipeRef.current,
      hasSelection: sel.length > 0,
      isInteractiveTarget: start.interactive,
    });

    didPinchRef.current = false;
    didSwipeRef.current = false;
    didLongPressMenuRef.current = false;

    if (!canToggle) return;

    if (activeDockSheet !== 'none' || quickActionTarget) {
      setActiveDockSheet('none');
      setQuickActionTarget(null);
      return;
    }

    toggleChromeHidden();
  };

  // Keyboard shortcuts: Escape closes popovers or exits immersive mode; Arrows flip Mushaf pages in RTL
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (e.key === 'Escape') {
        if (quickActionTarget) {
          setQuickActionTarget(null);
          return;
        }
        if (activeDockSheet !== 'none') {
          setActiveDockSheet('none');
          return;
        }
        if (isChromeHidden) {
          toggleChromeHidden();
          return;
        }
      }

      if (isInputFocused || readerMode !== 'page') return;
      if (e.key === 'ArrowLeft') {
        handleStepMushafPage(1);
      } else if (e.key === 'ArrowRight') {
        handleStepMushafPage(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickActionTarget, activeDockSheet, isChromeHidden, toggleChromeHidden, readerMode, handleStepMushafPage]);

  // Clear paused history when anchor, surah, or mode changes or auto-scroll restarts
  useEffect(() => {
    pausedAyahsHistory.current.clear();
    if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
    setIsPausedAtAyah(false);
  }, [surahData.meta.number, pageStreamAnchor, pageJumpNonce, readerMode, isAutoScrolling]);

  // Reset scroll top & transition guard when moving to a new Surah in full-surah mode
  useEffect(() => {
    if (readerModeRef.current !== 'surah') return;
    if (pageAdvanceTimeoutRef.current) {
      clearTimeout(pageAdvanceTimeoutRef.current);
      pageAdvanceTimeoutRef.current = null;
    }
    isAdvancingPageRef.current = false;
    setIsAdvancingPageUi(false);
    shortPageStartTimeRef.current = null;
    if (isAutoScrollingRef.current && containerRef.current) {
      containerRef.current.scrollTop = 0;
      preciseScrollTop.current = 0;
      lastProgrammaticScrollTopRef.current = 0;
    }
  }, [surahData.meta.number]);

  // Sync reciter mode when audio starts or stops (always stop auto-scroll when reciter audio stops)
  const prevIsPlayingAudioRef = useRef(isPlayingAudio);
  useEffect(() => {
    const wasPlaying = Boolean(prevIsPlayingAudioRef.current);
    const nextPlaying = Boolean(isPlayingAudio);
    prevIsPlayingAudioRef.current = nextPlaying;

    const transition = resolveAutoScrollStateOnAudioChange({
      wasPlaying,
      isPlaying: nextPlaying,
      isSmartScrollActive,
      isManualHighlightActive: Boolean(isManualHighlightModeRef.current || manualHighlightRef.current),
    });

    if (!wasPlaying && nextPlaying && isSmartScrollActive) {
      setAutoScrollSpeed(0.5);
    }
    if (transition.shouldUpdateAutoScroll) {
      setIsAutoScrolling(transition.nextIsAutoScrolling);
    }
    if (transition.nextScrollMode) {
      setScrollMode(transition.nextScrollMode);
      setIsAutoScrollPaused(false);
    }
    if (wasPlaying && !nextPlaying) {
      setIsAutoScrollPaused(false);
      setIsPausedAtAyah(false);
      isManualOverrideRef.current = false;
    }
  }, [isPlayingAudio, isSmartScrollActive]);

  // 60 FPS Auto-Scroll Engine (continuous seamless flow across Mushaf pages)
  useEffect(() => {
    if (!isEngineActive || isAutoScrollPaused || isPausedAtAyah) return;

    let animId: number;
    let lastTime = performance.now();

    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      preciseScrollTop.current = top;
      lastProgrammaticScrollTopRef.current = top;
    }

    const triggerEndDecision = (delayMs: number) => {
      const decision = resolveAutoScrollEndAction({
        readerMode: readerModeRef.current,
        currentPage: mushafPageNumberRef.current,
        currentSurah: surahNumberRef.current,
        autoAdvancePage: autoAdvancePageRef.current,
        isLoadingPage: isLoadingPageRef.current,
        isAdvancingPage: isAdvancingPageRef.current,
        canNavigateSurah: typeof onNavigateToAyahRef.current === 'function',
      });

      if (decision.action === 'stop') {
        setIsAutoScrolling(false);
        return false;
      }

      if (decision.action === 'wait') {
        return true;
      }

      // In connected Mushaf page mode, if next page is still loading from network, hold smoothly until it appends
      if (decision.action === 'advance-page') {
        setIsAdvancingPageUi(true);
        return true;
      }

      isAdvancingPageRef.current = true;
      setIsAdvancingPageUi(true);
      shortPageStartTimeRef.current = null;
      if (pageAdvanceTimeoutRef.current) clearTimeout(pageAdvanceTimeoutRef.current);

      const executeAdvance = () => {
        pageAdvanceTimeoutRef.current = null;
        if (!isEngineActiveRef.current) {
          isAdvancingPageRef.current = false;
          setIsAdvancingPageUi(false);
          return;
        }
        onNavigateToAyahRef.current?.(decision.nextSurah, 1);
      };

      if (delayMs <= 0) {
        executeAdvance();
      } else {
        pageAdvanceTimeoutRef.current = setTimeout(executeAdvance, delayMs);
      }
      return true;
    };

    const scrollLoop = (now: number) => {
      const container = containerRef.current;
      if (!container) return;

      const elapsed = (now - lastTime) / 1000;
      lastTime = now;

      if (isTouchActive.current || isManualOverrideRef.current) {
        preciseScrollTop.current = container.scrollTop;
        animId = requestAnimationFrame(scrollLoop);
        return;
      }

      const followBehavior = resolveReciterFollowBehavior({
        isPlayingAudio: Boolean(isPlayingAudio),
        scrollMode,
        isManualHighlightMode,
        hasManualHighlight: Boolean(manualHighlight),
        isExplicitNavigation: false,
      });

      if (followBehavior.shouldSyncReciterScroll) {
        const el = ayahRefs.current[`${surahData.meta.number}:${activeAyahNumberRef.current}`];
        if (el) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const activeWordEl = el.querySelector<HTMLElement>('[data-active-word="true"]');
          const wordRect = activeWordEl ? activeWordEl.getBoundingClientRect() : null;

          const curDur = durationRef.current;
          const curTime = currentTimeRef.current;
          const progress = curDur && curDur > 0 ? Math.max(0, Math.min(1, (curTime || 0) / curDur)) : 0;

          const targetScrollTop = computeReciterSyncTargetScrollTop({
            containerTop: containerRect.top,
            containerHeight: containerRect.height,
            currentScrollTop: container.scrollTop,
            maxScrollTop: Math.max(0, container.scrollHeight - container.clientHeight),
            ayahTop: elRect.top,
            ayahHeight: elRect.height,
            activeWordTop: wordRect && wordRect.height > 0 ? wordRect.top : null,
            activeWordHeight: wordRect && wordRect.height > 0 ? wordRect.height : null,
            progressRatio: progress,
          });

          if (Math.abs(container.scrollTop - preciseScrollTop.current) > 2) {
            preciseScrollTop.current = container.scrollTop;
          }

          const syncStep = computeReciterSyncStepScrollTop({
            currentPreciseTop: preciseScrollTop.current,
            targetScrollTop,
            deltaSeconds: elapsed > 0 && elapsed < 0.2 ? elapsed : 1 / 60,
            playbackRate: playbackRateRef.current,
          });
          if (syncStep.shouldScroll) {
            preciseScrollTop.current = syncStep.nextPreciseTop;
            container.scrollTop = syncStep.nextPreciseTop;
            lastProgrammaticScrollTopRef.current = container.scrollTop;
            syncVisibleStreamPage();
          }
        }
      } else if (isAutoScrolling && elapsed > 0 && elapsed < 0.2) {
        if (isLoadingPageRef.current || isAdvancingPageRef.current) {
          preciseScrollTop.current = container.scrollTop;
          lastProgrammaticScrollTopRef.current = container.scrollTop;
          animId = requestAnimationFrame(scrollLoop);
          return;
        }

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const streamList = pageStreamRef.current;
        const lastLoadedPageNum = streamList[streamList.length - 1]?.pageNumber ?? mushafPageNumberRef.current;
        const hasMorePagesToStream =
          readerModeRef.current === 'page' &&
          autoAdvancePageRef.current &&
          lastLoadedPageNum < 604;

        if (maxScroll <= 8) {
          if (hasMorePagesToStream) {
            // Next page is preloading in background; stay ready so scrolling starts smoothly once appended
            animId = requestAnimationFrame(scrollLoop);
            return;
          }
          if (shortPageStartTimeRef.current === null) {
            shortPageStartTimeRef.current = now;
          }
          const dwellMs = computeShortPageDwellMs(autoScrollSpeedRef.current);
          if (now - shortPageStartTimeRef.current >= dwellMs) {
            const shouldContinue = triggerEndDecision(0);
            if (!shouldContinue) return;
          }
          animId = requestAnimationFrame(scrollLoop);
          return;
        }

        shortPageStartTimeRef.current = null;
        const pxPerSec = computeAutoScrollPxPerSec(
          autoScrollSpeedRef.current,
          fontSizeRef.current,
          adaptiveScrollPaceRef.current
        );
        preciseScrollTop.current += pxPerSec * elapsed;
        if (preciseScrollTop.current >= maxScroll - 4) {
          container.scrollTop = maxScroll;
          preciseScrollTop.current = maxScroll;
          lastProgrammaticScrollTopRef.current = container.scrollTop;
          syncVisibleStreamPage();
          if (hasMorePagesToStream) {
            // Waiting briefly for the next preloaded page to append smoothly below
            animId = requestAnimationFrame(scrollLoop);
            return;
          }
          const shouldContinue = triggerEndDecision(650);
          if (!shouldContinue) return;
          animId = requestAnimationFrame(scrollLoop);
          return;
        }

        setIsAdvancingPageUi(false);
        container.scrollTop = preciseScrollTop.current;
        lastProgrammaticScrollTopRef.current = container.scrollTop;
        syncVisibleStreamPage();

        if (pauseAtAyahEnds) {
          const containerRect = container.getBoundingClientRect();
          const focalLine = containerRect.top + containerRect.height * 0.4;
          const activeAyahList =
            readerModeRef.current === 'page'
              ? streamList.flatMap((pg) =>
                  pg.ayahs.map((a) => ({ surahNum: a.surahNumber, num: a.numberInSurah }))
                )
              : surahAyahsRef.current.map((a) => ({ surahNum: surahData.meta.number, num: a.numberInSurah }));

          for (const item of activeAyahList) {
            const key = `${item.surahNum}:${item.num}`;
            if (pausedAyahsHistory.current.has(key)) continue;

            const el = ayahRefs.current[key];
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.bottom >= focalLine - 16 && rect.bottom <= focalLine + 16) {
                pausedAyahsHistory.current.add(key);
                setIsPausedAtAyah(true);

                if (pauseAyahTimeoutRef.current) clearTimeout(pauseAyahTimeoutRef.current);
                pauseAyahTimeoutRef.current = setTimeout(() => {
                  setIsPausedAtAyah(false);
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
    isManualHighlightMode,
    manualHighlight,
    isAutoScrollPaused,
    isPausedAtAyah,
    pauseAtAyahEnds,
    readerMode,
    surahData.meta.number,
    syncVisibleStreamPage,
  ]);

  // Keep bookmarks synced
  useEffect(() => {
    const syncBookmarks = () => {
      setBookmarksBySurah(getBookmarkMapBySurah());
      setAllBookmarksList(loadAllBookmarks());
    };
    syncBookmarks();
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
    window.addEventListener('storage', syncBookmarks);
    return () => {
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
      window.removeEventListener('storage', syncBookmarks);
    };
  }, []);

  const handleToggleBookmark = (ayahNum: number, targetSurahNum = surahData.meta.number) => {
    let resolvedSurahName = targetSurahNum === surahData.meta.number ? surahData.meta.name : undefined;
    let resolvedPage: number | undefined;
    let resolvedSnippet: string | undefined;

    if (targetSurahNum === surahData.meta.number) {
      const found = surahData.ayahs.find((a) => a.numberInSurah === ayahNum);
      if (found) {
        resolvedPage = found.page;
        resolvedSnippet = sanitizeAyahText(found.text, targetSurahNum, ayahNum);
      }
    } else if (pageData) {
      const foundOnPage = pageData.ayahs.find(
        (a) => a.surahNumber === targetSurahNum && a.numberInSurah === ayahNum
      );
      if (foundOnPage) {
        resolvedSurahName = foundOnPage.surahName;
        resolvedPage = foundOnPage.page;
        resolvedSnippet = sanitizeAyahText(foundOnPage.text, targetSurahNum, ayahNum);
      }
    }

    toggleSurahBookmark({
      surahNumber: targetSurahNum,
      surahName: resolvedSurahName,
      ayahNumber: ayahNum,
      page: resolvedPage,
      ayahSnippet: resolvedSnippet,
    });
    setBookmarksBySurah(getBookmarkMapBySurah());
    setAllBookmarksList(loadAllBookmarks());
  };

  const isLightPaper = theme === 'parchment' || theme === 'sepia';
  const { lineHeightPx } = useMemo(() => computeRuledLineMetrics(fontSize), [fontSize]);

  const ruledLinesStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      lineHeight: `${lineHeightPx}px`,
    };
    if (!isRuledLines) return base;
    const ruleColor = isLightPaper ? 'rgba(138, 100, 24, 0.16)' : 'rgba(217, 180, 90, 0.14)';
    return {
      ...base,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineHeightPx - 1}px, ${ruleColor} ${lineHeightPx - 1}px, ${ruleColor} ${lineHeightPx}px)`,
      backgroundSize: `100% ${lineHeightPx}px`,
      backgroundPosition: '0 0',
    };
  }, [isRuledLines, lineHeightPx, isLightPaper]);

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

  const getBorderColor = () => (isLightPaper ? '#8A6418' : '#D9B45A');

  const midPoint = Math.ceil(surahData.ayahs.length / 2);
  const rightPageAyahs = isDualPage ? surahData.ayahs.slice(0, midPoint) : surahData.ayahs;
  const leftPageAyahs = isDualPage ? surahData.ayahs.slice(midPoint) : [];

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

  // Dynamic active Mushaf header metadata (always matches currently displayed page)
  const headerSurahNumber =
    readerMode === 'page' && pageSurahGroups[0] ? pageSurahGroups[0].surahNumber : surahData.meta.number;
  const headerSurahName =
    readerMode === 'page' && pageSurahGroups[0] ? pageSurahGroups[0].surahName : surahData.meta.name;
  const headerJuzNumber =
    readerMode === 'page' && pageData?.ayahs[0]
      ? pageData.ayahs[0].juz
      : surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber)?.juz || surahData.meta.juzNumber;

  const activeAyahContext = useMemo(() => {
    if (manualHighlight) {
      return manualHighlight;
    }
    if (readerMode === 'page' && pageData?.ayahs.length) {
      const matching = pageData.ayahs.find(
        (a) => a.surahNumber === surahData.meta.number && a.numberInSurah === activeAyahNumber
      );
      const target = matching || pageData.ayahs[0];
      return {
        ayah: target as Ayah,
        surahNumber: target.surahNumber,
        surahName: target.surahName,
      };
    }
    const found = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber) || surahData.ayahs[0];
    return {
      ayah: found,
      surahNumber: surahData.meta.number,
      surahName: surahData.meta.name,
    };
  }, [manualHighlight, readerMode, pageData, surahData, activeAyahNumber]);

  const computeActiveWordIndex = (ayah: Ayah, targetSurahNum: number): number | undefined => {
    const isActive = targetSurahNum === surahData.meta.number && activeAyahNumber === ayah.numberInSurah;
    if (!isActive || !isPlayingAudio || !duration || duration <= 0) return undefined;

    const cleanText = sanitizeAyahText(ayah.text, targetSurahNum, ayah.numberInSurah);
    const words = cleanText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return undefined;

    const spokenIndices = getSpokenWordRawIndices(words);
    const recId = selectedReciter?.quranComRecitationId;
    const segs = recId ? segmentsBySurahKey[`${recId}:${targetSurahNum}`]?.[ayah.numberInSurah] : undefined;

    const wordWeights = !segs
      ? spokenIndices.map((idx) =>
          Math.max(1, words[idx].replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u200C]/g, '').length)
        )
      : undefined;

    const spokenIdx = resolveActiveWordIndex(
      segs,
      (currentTime || 0) * 1000,
      duration * 1000,
      spokenIndices.length,
      wordWeights
    );

    if (spokenIdx < 0) return undefined;
    return spokenIndices[spokenIdx];
  };

  const handleJumpMushafPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (pageAdvanceTimeoutRef.current) {
      clearTimeout(pageAdvanceTimeoutRef.current);
      pageAdvanceTimeoutRef.current = null;
    }
    isAdvancingPageRef.current = false;
    setIsAdvancingPageUi(false);
    shortPageStartTimeRef.current = null;

    const parsed = parseInt(pageInputDraft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(604, Math.max(1, parsed));
      setReaderMode('page');
      jumpToMushafPage(clamped);
      setActiveDockSheet('none');
    } else {
      setPageInputDraft(String(mushafPageNumber));
    }
  };

  const anchorHighlightedAyahInView = useCallback((targetSurahNum: number, targetAyahNum: number) => {
    requestAnimationFrame(() => {
      const container = containerRef.current;
      const el = ayahRefs.current[`${targetSurahNum}:${targetAyahNum}`];
      if (!container || !el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elementTopOffset = elRect.top - containerRect.top + container.scrollTop;
      const nextTop = computeManualHighlightAnchorScrollTop({
        elementTopOffset,
        containerHeight: container.clientHeight,
        currentScrollTop: container.scrollTop,
        maxScrollTop: container.scrollHeight - container.clientHeight,
      });
      if (nextTop !== null) {
        programmaticSmoothScrollUntilRef.current = performance.now() + 750;
        container.scrollTo({ top: nextTop, behavior: 'smooth' });
        preciseScrollTop.current = nextTop;
        lastProgrammaticScrollTopRef.current = nextTop;
      }
    });
  }, []);

  const handleToggleManualHighlightMode = useCallback(() => {
    setIsManualHighlightMode((prev) => {
      const next = !prev;
      if (next && isPlayingAudio && scrollModeRef.current === 'reciter-sync') {
        setScrollMode('manual-speed');
      }
      if (!next && manualHighlightRef.current) {
        setIsAutoScrollPaused(false);
      }
      return next;
    });
  }, [isPlayingAudio]);

  const handleReturnToReciter = useCallback(() => {
    setManualHighlight(null);
    setQuickActionTarget(null);
    setScrollMode('reciter-sync');
    if (isSmartScrollActive) {
      setIsAutoScrolling(true);
    }
    setIsAutoScrollPaused(false);
    isManualOverrideRef.current = false;
    const matched = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
    const targetPage = matched?.page || surahData.meta.startPage || 1;
    if (
      readerMode === 'page' &&
      shouldJumpMushafPageForAyah({
        readerMode,
        targetPage,
        loadedStreamPages: pageStreamRef.current.map((p) => p.pageNumber),
        isReaderModeChanged: false,
      })
    ) {
      jumpToMushafPage(targetPage);
    }
    requestAnimationFrame(() => {
      const el = ayahRefs.current[`${surahData.meta.number}:${activeAyahNumber}`];
      if (el) {
        programmaticSmoothScrollUntilRef.current = performance.now() + 750;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [
    surahData.ayahs,
    surahData.meta.number,
    surahData.meta.startPage,
    activeAyahNumber,
    isSmartScrollActive,
    readerMode,
    jumpToMushafPage,
  ]);

  const handleClearManualHighlight = useCallback(() => {
    setManualHighlight(null);
    setIsAutoScrollPaused(false);
  }, []);

  const handleManualSelectAyah = useCallback(
    (cleaned: Ayah, targetSurahNum: number, targetSurahName: string) => {
      if (
        resolveAyahSelectionTarget(Boolean(isPlayingAudio), isManualHighlightModeRef.current) ===
        'manual-highlight'
      ) {
        const current = manualHighlightRef.current;
        const isSameAyah =
          Boolean(current) &&
          current!.surahNumber === targetSurahNum &&
          current!.ayah.numberInSurah === cleaned.numberInSurah;

        if (isSameAyah) {
          setManualHighlight(null);
          setIsAutoScrollPaused(false);
        } else {
          setManualHighlight({
            ayah: cleaned,
            surahNumber: targetSurahNum,
            surahName: targetSurahName,
          });
          if (isPlayingAudio && scrollModeRef.current === 'reciter-sync') {
            setScrollMode('manual-speed');
          }
          if (isEngineActiveRef.current) {
            setIsAutoScrollPaused(true);
          }
          anchorHighlightedAyahInView(targetSurahNum, cleaned.numberInSurah);
        }
      } else {
        setManualHighlight(null);
        setIsAutoScrollPaused(false);
        onSelectAyah(cleaned, targetSurahNum, targetSurahName);
      }
    },
    [isPlayingAudio, onSelectAyah, anchorHighlightedAyahInView]
  );

  const handleTriggerAyahMenu = useCallback(
    (cleaned: Ayah, targetSurahNum: number, targetSurahName: string) => {
      didLongPressMenuRef.current = true;
      if (
        resolveAyahSelectionTarget(Boolean(isPlayingAudio), isManualHighlightModeRef.current) ===
        'manual-highlight'
      ) {
        setManualHighlight({
          ayah: cleaned,
          surahNumber: targetSurahNum,
          surahName: targetSurahName,
        });
        if (isPlayingAudio && scrollModeRef.current === 'reciter-sync') {
          setScrollMode('manual-speed');
        }
        if (isEngineActiveRef.current) {
          setIsAutoScrollPaused(true);
        }
        anchorHighlightedAyahInView(targetSurahNum, cleaned.numberInSurah);
      } else {
        setManualHighlight(null);
        setIsAutoScrollPaused(false);
        onSelectAyah(cleaned, targetSurahNum, targetSurahName);
      }
      setActiveDockSheet('none');
      setQuickActionTarget({
        ayah: cleaned,
        surahNumber: targetSurahNum,
        surahName: targetSurahName,
      });
    },
    [isPlayingAudio, onSelectAyah, anchorHighlightedAyahInView]
  );

  const audioProgressPercent =
    duration && duration > 0 && currentTime !== undefined
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  const wirdSummary = useMemo(() => getDailyWirdSummary(personalWirdPlan), [personalWirdPlan]);
  const isCurrentPageRecordedToday = wirdSummary.todayPagesList.includes(mushafPageNumber);
  const currentBookmarkOnActive = bookmarksBySurah[activeAyahContext.surahNumber] === activeAyahContext.ayah?.numberInSurah;

  const glassHeaderClasses = isLightPaper
    ? 'bg-[#FBF7EE]/88 border-[#8A6418]/20 text-[#1B1A17]'
    : 'bg-[#10161F]/88 border-[#D9B45A]/22 text-[#E9E3D3]';

  const glassDockClasses = isLightPaper
    ? 'bg-[#FBF7EE]/80 border-[#8A6418]/25 text-[#1B1A17] shadow-[0_12px_36px_rgba(31,58,110,0.14)]'
    : 'bg-[#10161F]/78 border-[#D9B45A]/28 text-[#E9E3D3] shadow-[0_14px_40px_rgba(0,0,0,0.58)]';

  const glassSheetClasses = isLightPaper
    ? 'bg-[#FBF7EE]/95 border-[#8A6418]/30 text-[#1B1A17] shadow-[0_18px_50px_rgba(31,58,110,0.18)]'
    : 'bg-[#10161F]/95 border-[#D9B45A]/30 text-[#E9E3D3] shadow-[0_20px_54px_rgba(0,0,0,0.65)]';

  const dialItems = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      title: string;
      isActive: boolean;
      icon: React.ReactNode;
      onClick: () => void;
      onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    }> = [
      // Wave 1 (First 4 visible beside Recite CTA): Active reading & immediate actions
      {
        id: 'autoscroll',
        label: isAutoScrolling ? formatSpeedLabel(autoScrollSpeed, lang) : t('آلي', 'Scroll'),
        title: t(
          'التمرير التلقائي المريح للعين (ضغطة مطولة للإعدادات)',
          'Comfort Auto-Scroll (right-click or hold for settings)'
        ),
        isActive: isAutoScrolling || activeDockSheet === 'autoscroll',
        icon: isAutoScrolling ? (
          <Pause className="w-4 h-4" />
        ) : (
          <ChevronsDown className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
        ),
        onClick: () => {
          if (isAutoScrolling) {
            setIsAutoScrolling(false);
            setIsAutoScrollPaused(false);
          } else {
            setScrollMode(
              isPlayingAudio && !isManualHighlightModeRef.current && !manualHighlightRef.current
                ? 'reciter-sync'
                : 'manual-speed'
            );
            setIsAutoScrolling(true);
            setIsAutoScrollPaused(false);
          }
        },
        onContextMenu: (e) => {
          e.preventDefault();
          setActiveDockSheet((s) => (s === 'autoscroll' ? 'none' : 'autoscroll'));
        },
      },
    ];

    if (activeAyahContext.ayah) {
      const targetAyah = activeAyahContext.ayah;
      const targetSurahNum = activeAyahContext.surahNumber;
      const targetSurahName = activeAyahContext.surahName;
      items.push({
        id: 'tafsir',
        label: t('التفسير', 'Tafsir'),
        title: t('التفسير والتدبر للآية النشطة', 'Tafsir & reflection for active Ayah'),
        isActive: false,
        icon: <BookOpen className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
        onClick: () => {
          setActiveDockSheet('none');
          onOpenTadabburModal(targetAyah, targetSurahNum, targetSurahName);
        },
      });
    }

    items.push(
      {
        id: 'bookmarks',
        label: t('المراجع', 'Saved'),
        title: t('علامات الوقف والمواضع المحفوظة', 'Saved bookmarks & resume points'),
        isActive: activeDockSheet === 'bookmarks',
        icon: (
          <Bookmark
            className={`w-4 h-4 ${
              currentBookmarkOnActive ? 'fill-current' : ''
            } ${activeDockSheet === 'bookmarks' ? '' : isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`}
          />
        ),
        onClick: () => setActiveDockSheet((s) => (s === 'bookmarks' ? 'none' : 'bookmarks')),
      },
      {
        id: 'memorization',
        label: t('الحفظ', 'Hifz'),
        title: t('بدء الحفظ والتسميع من هذا الموضع', 'Start Hifz & recitation from this position'),
        isActive: false,
        icon: <Award className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
        onClick: () => {
          setActiveDockSheet('none');
          if (onOpenMemorization) {
            onOpenMemorization({
              surahNumber: headerSurahNumber,
              pageNumber: mushafPageNumber,
              ayahNumber: activeAyahContext.ayah?.numberInSurah || activeAyahNumber,
              readerMode,
            });
          } else {
            onNavigateView?.('memorization');
          }
        },
      }
    );

    // Wave 2: Family Hifz, Translations, Tajweed & Devotional sections
    if (onNavigateView) {
      items.push(
        {
          id: 'kids',
          label: t('تحفيظ الصغار', 'Kids'),
          title: t('قسم تحفيظ الصغار والتلقين والنجوم', 'Kids Hifz & audio stars'),
          isActive: false,
          icon: <Sprout className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
          onClick: () => {
            setActiveDockSheet('none');
            onNavigateView('kids');
          },
        },
        {
          id: 'translations',
          label: t('الترجمات', 'Translate'),
          title: t('ترجمات معاني القرآن (السويدية والإنجليزية)', 'Quran Translations (Swedish, English & more)'),
          isActive: false,
          icon: <Globe className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
          onClick: () => {
            setActiveDockSheet('none');
            onNavigateView('translations');
          },
        }
      );
    }

    items.push({
      id: 'tajweed',
      label: t('التجويد', 'Tajweed'),
      title: onNavigateView
        ? t('موسوعة التجويد', 'Tajweed Encyclopedia')
        : t('دليل ألوان التجويد', 'Tajweed Color Legend'),
      isActive: false,
      icon: <Sparkles className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
      onClick: () => {
        setActiveDockSheet('none');
        if (onNavigateView) {
          onNavigateView('tajweed');
        } else {
          onOpenTajweedLegend();
        }
      },
    });

    if (onNavigateView) {
      items.push(
        {
          id: 'khatma',
          label: t('الختمات', 'Khatma'),
          title: t('الختمات والورد اليومي', 'Collective Khatmas & Daily Wird'),
          isActive: false,
          icon: <Compass className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
          onClick: () => {
            setActiveDockSheet('none');
            onNavigateView('khatma');
          },
        },
        {
          id: 'ruqyah',
          label: t('الرقية', 'Ruqyah'),
          title: t('الرقية الشرعية والأذكار', 'Authentic Ruqyah & Adhkar'),
          isActive: false,
          icon: <ShieldCheck className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
          onClick: () => {
            setActiveDockSheet('none');
            onNavigateView('ruqyah');
          },
        },
        // Wave 3: Journaling & Settings
        {
          id: 'journal',
          label: t('مفكرتي', 'Notes'),
          title: t('مفكرتي وعلامات التدبر', 'Personal journal & reflections'),
          isActive: false,
          icon: <PenLine className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />,
          onClick: () => {
            setActiveDockSheet('none');
            onNavigateView('journal');
          },
        }
      );
    }

    items.push({
      id: 'more',
      label: t('الضبط', 'Settings'),
      title: t('إعدادات المصحف وبقية أقسام بيان', "Mus'haf settings & Bayan sections"),
      isActive: activeDockSheet === 'more',
      icon: (
        <SlidersHorizontal
          className={`w-4 h-4 ${activeDockSheet === 'more' ? '' : isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`}
        />
      ),
      onClick: () => setActiveDockSheet((s) => (s === 'more' ? 'none' : 'more')),
    });

    return items;
  }, [
    lang,
    t,
    isAutoScrolling,
    autoScrollSpeed,
    activeDockSheet,
    isLightPaper,
    isPlayingAudio,
    currentBookmarkOnActive,
    onOpenMemorization,
    headerSurahNumber,
    mushafPageNumber,
    activeAyahContext,
    activeAyahNumber,
    readerMode,
    onNavigateView,
    onOpenTadabburModal,
    onOpenTajweedLegend,
  ]);

  const stopDialAnimation = useCallback(() => {
    if (dialAnimFrameRef.current !== null) {
      cancelAnimationFrame(dialAnimFrameRef.current);
      dialAnimFrameRef.current = null;
    }
  }, []);

  useEffect(() => () => stopDialAnimation(), [stopDialAnimation]);

  const animateDialTo = useCallback(
    (rawTarget: number) => {
      stopDialAnimation();
      const target = Math.round(rawTarget);
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        dialOffsetRef.current = target;
        setDialOffset(target);
        return;
      }

      const startValue = dialOffsetRef.current;
      const distance = target - startValue;
      if (Math.abs(distance) < 0.002) {
        dialOffsetRef.current = target;
        setDialOffset(target);
        return;
      }

      const durationMs = Math.min(300, Math.max(160, Math.abs(distance) * 140));
      const startTime = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + distance * eased;
        dialOffsetRef.current = current;
        setDialOffset(current);

        if (progress < 1) {
          dialAnimFrameRef.current = requestAnimationFrame(tick);
        } else {
          dialAnimFrameRef.current = null;
          dialOffsetRef.current = target;
          setDialOffset(target);
        }
      };

      dialAnimFrameRef.current = requestAnimationFrame(tick);
    },
    [stopDialAnimation]
  );

  const stepCircularDial = useCallback(
    (deltaSteps: number) => {
      const target = Math.round(dialOffsetRef.current) + deltaSteps;
      animateDialTo(target);
    },
    [animateDialTo]
  );

  const handleDialPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      stopDialAnimation();
      const trackWidth = dialTrackRef.current?.clientWidth || 260;
      const slotWidth = Math.max(48, trackWidth / 4);
      dialDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        lastX: e.clientX,
        lastTime: performance.now(),
        startOffset: dialOffsetRef.current,
        slotWidth,
        velocitySlotsPerSec: 0,
        didDrag: false,
      };
    },
    [stopDialAnimation]
  );

  const handleDialPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dialDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dxFromStart = e.clientX - drag.startX;
      if (!drag.didDrag && Math.abs(dxFromStart) >= 6) {
        drag.didDrag = true;
        setIsDialDragging(true);
        try {
          dialTrackRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if pointer capture is unavailable on detached elements
        }
      }

      if (!drag.didDrag) return;

      const now = performance.now();
      const dt = Math.max(8, now - drag.lastTime);
      const stepDx = e.clientX - drag.lastX;
      const directionSign = dir === 'rtl' ? 1 : -1;
      const instantVelocity = directionSign * ((stepDx / drag.slotWidth) / (dt / 1000));
      drag.velocitySlotsPerSec = drag.velocitySlotsPerSec * 0.55 + instantVelocity * 0.45;
      drag.lastX = e.clientX;
      drag.lastTime = now;

      // In RTL: swiping rightward (+dx) pulls dial items into the right edge; in LTR: swiping leftward (-dx) advances items from the right edge
      const nextOffset = drag.startOffset + directionSign * (dxFromStart / drag.slotWidth);
      dialOffsetRef.current = nextOffset;
      setDialOffset(nextOffset);
    },
    [dir]
  );

  const finishDialPointerDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dialDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dialDragRef.current = null;
      setIsDialDragging(false);

      try {
        if (dialTrackRef.current?.hasPointerCapture(e.pointerId)) {
          dialTrackRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }

      if (!drag.didDrag) return;
      suppressDialClickUntilRef.current = performance.now() + 260;

      const extraSlots = clampCircularMomentumSlots(drag.velocitySlotsPerSec, 3.5);
      const snappedTarget = Math.round(dialOffsetRef.current + extraSlots);
      animateDialTo(snappedTarget);
    },
    [animateDialTo]
  );

  const circularDialSlots = useMemo(
    () => computeCircularDialSlots(dialOffset, dialItems.length, 4),
    [dialOffset, dialItems.length]
  );

  const dialWaveCount = Math.max(1, Math.ceil(dialItems.length / 4));
  const activeDialIndex = wrapCircularIndex(Math.round(dialOffset), dialItems.length);
  const activeDialWave = Math.min(dialWaveCount - 1, Math.floor(activeDialIndex / 4));

  const jumpDialToWave = useCallback(
    (waveIdx: number) => {
      const count = dialItems.length || 1;
      const targetMod = Math.min(count - 1, waveIdx * 4);
      const currentRounded = Math.round(dialOffsetRef.current);
      const currentMod = wrapCircularIndex(currentRounded, count);
      let diff = targetMod - currentMod;
      if (diff > count / 2) diff -= count;
      if (diff < -count / 2) diff += count;
      animateDialTo(currentRounded + diff);
    },
    [dialItems.length, animateDialTo]
  );

  return (
    <div
      className={`flex flex-col transition-colors duration-200 ${
        isChromeHidden
          ? 'fixed inset-0 z-40 h-[100dvh]'
          : 'fixed inset-0 z-20 h-[100dvh] lg:static lg:inset-auto lg:h-auto lg:w-full'
      }`}
    >
      {/* ===================== SLIM MUSHAF TOP HEADER (Fades & glides out in pure mode) ===================== */}
      <div
        className={`z-30 backdrop-blur-xl border-b transition-[opacity,transform] duration-200 will-change-transform ${glassHeaderClasses} ${
          isChromeHidden
            ? 'fixed top-0 inset-x-0 -translate-y-full opacity-0 pointer-events-none'
            : 'fixed top-0 inset-x-0 lg:sticky lg:top-0 lg:rounded-t-3xl lg:border lg:border-b-0 translate-y-0 opacity-100'
        }`}
      >
        {/* Ultra-Slim Row 1: Bayan Mobile Utility Strip (also shown in desktop if needed, minimal height) */}
        <div
          className={`max-w-5xl mx-auto px-3 sm:px-5 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 min-h-9 flex items-center justify-between gap-2 text-[11px] border-b ${
            isLightPaper ? 'border-[#8A6418]/12' : 'border-[#D9B45A]/12'
          } ${!isChromeHidden ? 'lg:hidden' : ''}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveDockSheet((s) => (s === 'more' ? 'none' : 'more'))}
              className="min-h-[32px] px-2 rounded-lg flex items-center gap-1 font-bold hover:bg-current/5 transition-colors cursor-pointer whitespace-nowrap"
              aria-label={t('أقسام بيان', 'Bayan sections')}
            >
              <span className="w-5 h-5 rounded-md bg-[#1F3A6E] text-[#D9B45A] flex items-center justify-center font-kufi text-xs">
                ب
              </span>
              <span>{t('الأقسام', 'Menu')}</span>
            </button>

            {onOpenKhatmaPlanner && (
              <button
                type="button"
                onClick={onOpenKhatmaPlanner}
                className={`min-h-[30px] px-2 rounded-lg font-semibold flex items-center gap-1 tabular-nums whitespace-nowrap cursor-pointer ${
                  wirdSummary.hasPlan && wirdSummary.isTodayComplete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isLightPaper
                    ? 'text-[#8A6418]'
                    : 'text-[#D9B45A]'
                }`}
              >
                <span>
                  {wirdSummary.hasPlan
                    ? t(
                        `الورد ${formatLocalizedDigits(wirdSummary.todayPagesRead, lang)}/${formatLocalizedDigits(wirdSummary.dailyTargetPages, lang)}`,
                        `Wird ${wirdSummary.todayPagesRead}/${wirdSummary.dailyTargetPages}`
                      )
                    : t('مخطط الورد', 'Daily Wird')}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={t('Switch interface to English', 'التبديل إلى الواجهة العربية')}
              title={t('Switch to English', 'التبديل إلى العربية')}
              className="min-h-[32px] px-2 flex items-center justify-center gap-1 rounded-lg hover:bg-current/5 font-bold cursor-pointer"
            >
              <Languages className={`w-3.5 h-3.5 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
              <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            {onOpenAyahSearch && (
              <button
                type="button"
                onClick={onOpenAyahSearch}
                aria-label={t('بحث في آيات القرآن', 'Search Quran Ayahs')}
                className="min-w-[34px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-current/5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleAppTheme && (
              <button
                type="button"
                onClick={onToggleAppTheme}
                aria-label={
                  appTheme === 'dark'
                    ? t('التبديل إلى الوضع النهاري', 'Switch to light mode')
                    : t('التبديل إلى الوضع الليلي', 'Switch to dark mode')
                }
                title={
                  appTheme === 'dark'
                    ? t('التبديل إلى الوضع النهاري', 'Switch to light mode')
                    : t('التبديل إلى الوضع الليلي', 'Switch to dark mode')
                }
                className="min-h-[32px] px-2 flex items-center justify-center gap-1 rounded-lg hover:bg-current/5 font-bold cursor-pointer"
              >
                {appTheme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-[#D9B45A]" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-[#1F3A6E]" />
                )}
                <span>{appTheme === 'dark' ? t('نهاري', 'Day') : t('ليلي', 'Night')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Authentic Framed Mushaf Header (Surah | Page | Juz) */}
        <div className="max-w-5xl mx-auto px-3 sm:px-5 h-12 flex items-center justify-between gap-2">
          {/* Start: Surah Name Cartouche */}
          <button
            type="button"
            onClick={() => onOpenSurahPicker?.()}
            className={`min-h-[36px] max-w-[36%] px-3 py-1 rounded-xl border font-kufi text-sm sm:text-base font-bold flex items-center gap-1.5 transition-colors cursor-pointer truncate ${
              isLightPaper
                ? 'bg-[#EFE6D1]/70 hover:bg-[#EFE6D1] border-[#8A6418]/35 text-[#1B1A17]'
                : 'bg-[#172235]/80 hover:bg-[#1F3A6E]/55 border-[#D9B45A]/35 text-[#F6EFDD]'
            }`}
            title={t('اختر سورة من الفهرس', 'Choose a Surah from the index')}
          >
            <span className="truncate">
              {t(`سورة ${headerSurahName}`, `Surah ${resolveSurahTitle(headerSurahNumber, headerSurahName)}`)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>

          {/* Center: Localized Page Number + Subtle Step Arrows */}
          <div className="flex items-center gap-1 shrink-0">
            {readerMode === 'page' && (
              <button
                type="button"
                onClick={() => handleStepMushafPage(-1)}
                disabled={mushafPageNumber <= 1}
                aria-label={t('الصفحة السابقة', 'Previous page')}
                title={t('الصفحة السابقة', 'Previous page')}
                className="hidden sm:flex min-w-[32px] min-h-[32px] items-center justify-center rounded-lg hover:bg-current/5 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setQuickJumpTab('page');
                setActiveDockSheet((s) => (s === 'quickjump' ? 'none' : 'quickjump'));
              }}
              className={`min-h-[34px] px-3 py-1 rounded-xl font-bold text-sm sm:text-base tabular-nums transition-colors cursor-pointer flex items-center gap-1.5 ${
                isLightPaper
                  ? 'hover:bg-[#EFE6D1]/80 text-[#8A6418]'
                  : 'hover:bg-white/5 text-[#D9B45A]'
              }`}
              title={t('الانتقال السريع إلى صفحة أو جزء', 'Quick jump to a page or Juz')}
            >
              <span>
                {readerMode === 'page'
                  ? formatLocalizedDigits(mushafPageNumber, lang)
                  : t(`ص ${formatLocalizedDigits(mushafPageNumber, lang)}`, `P ${mushafPageNumber}`)}
              </span>
            </button>

            {readerMode === 'page' && (
              <button
                type="button"
                onClick={() => handleStepMushafPage(1)}
                disabled={mushafPageNumber >= 604}
                aria-label={t('الصفحة التالية', 'Next page')}
                title={t('الصفحة التالية', 'Next page')}
                className="hidden sm:flex min-w-[32px] min-h-[32px] items-center justify-center rounded-lg hover:bg-current/5 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* End: Juz Cartouche + Desktop Fullscreen Toggle */}
          <div className="flex items-center gap-1.5 max-w-[38%] shrink-0">
            <button
              type="button"
              onClick={() => {
                setQuickJumpTab('juz');
                setActiveDockSheet((s) => (s === 'quickjump' ? 'none' : 'quickjump'));
              }}
              className={`min-h-[36px] px-3 py-1 rounded-xl border font-kufi text-xs sm:text-sm font-bold flex items-center gap-1 transition-colors cursor-pointer truncate ${
                isLightPaper
                  ? 'bg-[#EFE6D1]/70 hover:bg-[#EFE6D1] border-[#8A6418]/35 text-[#1B1A17]'
                  : 'bg-[#172235]/80 hover:bg-[#1F3A6E]/55 border-[#D9B45A]/35 text-[#F6EFDD]'
              }`}
              title={t('تصفح الأجزاء الثلاثين', 'Browse all 30 Ajza')}
            >
              <span className="truncate">{getJuzLabel(headerJuzNumber, lang)}</span>
            </button>

            {onToggleFullScreen && (
              <button
                type="button"
                onClick={toggleChromeHidden}
                aria-label={t('القراءة الصافية بملء الشاشة', 'Distraction-free fullscreen reading')}
                title={t('إخفاء القوائم للقراءة الصافية', 'Hide toolbars for pure reading')}
                className="hidden lg:flex min-w-[36px] min-h-[36px] items-center justify-center rounded-xl hover:bg-current/5 transition-colors cursor-pointer shrink-0"
              >
                {isChromeHidden ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 opacity-75" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Pinch Font-Size Feedback Pill */}
      {pinchSizePreview !== null && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-3.5 py-1.5 rounded-full bg-[#1F3A6E] border border-[#D9B45A]/50 text-[#F6EFDD] text-xs font-bold tabular-nums shadow-xl pointer-events-none">
          {t(`حجم الخط: ${formatLocalizedDigits(pinchSizePreview, lang)}`, `Font size: ${pinchSizePreview}`)}
        </div>
      )}

      {/* Floating Manual Touch Override Pill (only during active auto-reading) */}
      {isUserInteracting && isEngineActive && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-1.5rem)] py-1.5 px-3.5 rounded-full bg-[#10161f]/95 border border-[#648CD4]/55 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-[11px] text-[#F6EFDD] flex items-center gap-1.5 font-medium whitespace-nowrap">
            <Hand className="w-3.5 h-3.5 text-[#D9B45A] shrink-0" />
            <span>{t('تحكم يدوي باللمس · ستستأنف القراءة تلقائياً', 'Manual scroll · auto-reading will resume')}</span>
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
          >
            {t('استئناف', 'Resume')}
          </button>
        </div>
      )}

      {/* ===================== PURE MUSHAF PAPER FRAME & SCROLLABLE SURFACE ===================== */}
      <div
        className={`relative flex-1 min-h-0 flex flex-col transition-colors duration-200 ${
          isChromeHidden
            ? 'rounded-none border-none h-full'
            : 'lg:rounded-b-3xl lg:border lg:border-t-0 lg:shadow-2xl'
        } ${getThemeClasses()}`}
      >
        {/* Subtle Corner Ornaments */}
        <div
          className="hidden sm:block absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 opacity-35 pointer-events-none rounded-br-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />
        <div
          className="hidden sm:block absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 opacity-35 pointer-events-none rounded-bl-lg z-10"
          style={{ borderColor: getBorderColor() }}
        />

        {/* Scrollable Mushaf Reading Canvas */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onScroll={handleContainerScroll}
          onPointerDown={handleSurfacePointerDown}
          onPointerUp={handleSurfacePointerUp}
          className={`relative flex-1 overflow-y-auto overscroll-contain touch-pan-y select-text ${
            isChromeHidden
              ? 'h-full px-3.5 sm:px-10 pt-8 pb-24 max-w-4xl mx-auto w-full'
              : 'pt-[5.6rem] pb-28 px-3.5 sm:px-8 lg:pt-6 lg:pb-28 lg:max-h-[78vh]'
          }`}
        >
          {readerMode === 'page' ? (
            /* ===================== 604-PAGE MEDINA MUSHAF VIEW ===================== */
            <div className="space-y-5 max-w-4xl mx-auto">
              {isLoadingPage ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3 font-sans">
                  <div className="w-9 h-9 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                  <p className="text-xs opacity-80">
                    {t(`جارٍ تحميل صفحة المصحف رقم ${formatLocalizedDigits(mushafPageNumber, lang)}…`, `Loading Mus'haf page ${mushafPageNumber}…`)}
                  </p>
                </div>
              ) : pageError ? (
                <div className="py-12 text-center space-y-3 font-sans">
                  <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-xs text-rose-400">{pageError}</p>
                  <button
                    type="button"
                    onClick={() => setPageReloadTrigger((c) => c + 1)}
                    className="py-2 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('إعادة المحاولة', 'Try Again')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pageStream.map((pg, idx) => {
                    const groups: {
                      surahNumber: number;
                      surahName: string;
                      revelationTypeAr: 'مكية' | 'مدنية';
                      bismillahPre: boolean;
                      startsAtAyahOne: boolean;
                      ayahs: MushafPageAyah[];
                    }[] = [];

                    for (const ayah of pg.ayahs) {
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

                    const prevPageLastAyah = idx > 0 ? pageStream[idx - 1].ayahs[pageStream[idx - 1].ayahs.length - 1] : null;
                    const isSameSurahFlow = Boolean(prevPageLastAyah && groups[0] && prevPageLastAyah.surahNumber === groups[0].surahNumber);

                    return (
                      <section
                        key={pg.pageNumber}
                        ref={(el) => {
                          pageSectionRefs.current[pg.pageNumber] = el;
                        }}
                        className="space-y-4"
                      >
                        {idx > 0 && (
                          <div
                            aria-label={t(
                              `بداية الصفحة ${formatLocalizedDigits(pg.pageNumber, lang)}`,
                              `Start of page ${pg.pageNumber}`
                            )}
                            className={`flex items-center gap-3 select-none font-sans ${
                              isSameSurahFlow ? 'my-1.5 opacity-45' : 'my-3 opacity-60'
                            }`}
                          >
                            <div className="flex-1 h-px bg-current/25" />
                            <span className="text-[10px] font-semibold tabular-nums">
                              {formatLocalizedDigits(pg.pageNumber, lang)}
                            </span>
                            <div className="flex-1 h-px bg-current/25" />
                          </div>
                        )}

                        {groups.map((group) => (
                          <div key={`${pg.pageNumber}-${group.surahNumber}`} className="space-y-3">
                            {group.startsAtAyahOne ? (
                              <div dir="rtl" lang="ar" className="text-center py-2">
                                <div
                                  className={`inline-block px-7 py-2 rounded-2xl border shadow-inner ${
                                    isLightPaper
                                      ? 'bg-[#D9B45A]/15 border-[#8A6418]/45 text-[#1B1A17]'
                                      : 'bg-gradient-to-r from-[#1F3A6E]/35 via-[#D9B45A]/15 to-[#1F3A6E]/35 border-[#D9B45A]/45 text-[#F6EFDD]'
                                  }`}
                                >
                                  <h2 className="font-kufi text-xl sm:text-2xl font-bold">سُورَةُ {group.surahName}</h2>
                                </div>
                                {group.bismillahPre && (
                                  <p
                                    className={`mt-3 font-quran text-2xl sm:text-3xl leading-loose ${
                                      isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'
                                    }`}
                                  >
                                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                                  </p>
                                )}
                              </div>
                            ) : null}

                            <div
                              dir="rtl"
                              lang="ar"
                              className="text-right sm:text-justify font-quran select-text"
                              style={ruledLinesStyle}
                            >
                              {group.ayahs.map((ayah) => {
                                const isActive =
                                  group.surahNumber === surahData.meta.number &&
                                  activeAyahNumber === ayah.numberInSurah;
                                const isManualSelected =
                                  manualHighlight?.surahNumber === group.surahNumber &&
                                  manualHighlight?.ayah.numberInSurah === ayah.numberInSurah;
                                const savedBookmark = bookmarksBySurah[group.surahNumber] ?? null;
                                const isBookmarked = savedBookmark === ayah.numberInSurah;

                                return (
                                  <AyahSpan
                                    key={`${group.surahNumber}:${ayah.numberInSurah}`}
                                    ayah={ayah}
                                    surahNumber={group.surahNumber}
                                    surahName={group.surahName}
                                    lang={lang}
                                    isActive={isActive}
                                    isManualSelected={isManualSelected}
                                    isManualHighlightMode={isManualHighlightMode}
                                    isBookmarked={isBookmarked}
                                    isPlayingAudio={isPlayingAudio}
                                    isLightPaper={isLightPaper}
                                    fontSize={fontSize}
                                    lineHeightPx={lineHeightPx}
                                    isTajweedActive={isTajweedActive}
                                    activeWordIndex={computeActiveWordIndex(ayah, group.surahNumber)}
                                    onManualSelectAyah={handleManualSelectAyah}
                                    onTriggerAyahMenu={handleTriggerAyahMenu}
                                    onToggleBookmark={handleToggleBookmark}
                                    setRef={(el) => {
                                      ayahRefs.current[`${group.surahNumber}:${ayah.numberInSurah}`] = el;
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </section>
                    );
                  })}

                  {autoAdvancePage && isPreloadingNextPage && (
                    <div className="py-3 flex items-center justify-center gap-2 text-[11px] opacity-60 font-sans">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                      <span>{t('جارٍ وصل الصفحة التالية…', 'Connecting next page…')}</span>
                    </div>
                  )}

                  {autoAdvancePage && failedPreloadPage !== null && (
                    <div className="py-3 flex items-center justify-center gap-2 text-xs font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setFailedPreloadPage(null);
                          setPreloadRetryNonce((n) => n + 1);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {t(
                            `إعادة تحميل الصفحة ${formatLocalizedDigits(failedPreloadPage, lang)}`,
                            `Reload page ${failedPreloadPage}`
                          )}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Subtle Bottom Page Turn & Wird Bar (shown when continuous stream stops or at final page) */}
              {(!autoAdvancePage || (pageStream[pageStream.length - 1]?.pageNumber ?? mushafPageNumber) >= 604) && (
                <div className="pt-4 border-t border-current/12 flex items-center justify-between gap-2 text-xs font-sans tabular-nums opacity-85">
                  <button
                    type="button"
                    onClick={() => handleStepMushafPage(-1)}
                    disabled={mushafPageNumber <= 1}
                    className="min-h-[38px] px-3 rounded-xl border border-current/20 flex items-center gap-1 disabled:opacity-30 hover:bg-current/5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span>{t('السابقة', 'Previous')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span>
                      {t(
                        `صفحة ${formatLocalizedDigits(mushafPageNumber, lang)} / ٦٠٤`,
                        `Page ${mushafPageNumber} / 604`
                      )}
                    </span>
                    {personalWirdPlan && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCurrentPageRecordedToday) {
                            recordMushafPageReadInWird(mushafPageNumber);
                          }
                        }}
                        disabled={isCurrentPageRecordedToday}
                        className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          isCurrentPageRecordedToday
                            ? 'border-emerald-500/45 text-emerald-500 cursor-default'
                            : isLightPaper
                            ? 'border-[#8A6418]/40 text-[#8A6418] hover:bg-[#8A6418]/10'
                            : 'border-[#D9B45A]/40 text-[#D9B45A] hover:bg-[#D9B45A]/10'
                        }`}
                      >
                        {isCurrentPageRecordedToday ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{t('في الورد', 'In Wird')}</span>
                          </>
                        ) : (
                          <span>{t('+ تسجيل للورد', '+ Log Wird')}</span>
                        )}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStepMushafPage(1)}
                    disabled={mushafPageNumber >= 604}
                    className="min-h-[38px] px-3 rounded-xl border border-current/20 flex items-center gap-1 disabled:opacity-30 hover:bg-current/5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>{t('التالية', 'Next')}</span>
                    {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ===================== FULL SURAH VIEW (SINGLE OR DUAL PAGE) ===================== */
            <div className="max-w-4xl mx-auto">
              <div className="relative text-center mb-6 sm:mb-7 pb-1">
                <div
                  className={`inline-block relative px-6 sm:px-9 py-2.5 max-w-full rounded-2xl border shadow-inner ${
                    isLightPaper
                      ? 'bg-[#D9B45A]/15 border-[#8A6418]/45 text-[#1B1A17]'
                      : 'bg-gradient-to-r from-[#1F3A6E]/35 via-[#D9B45A]/15 to-[#1F3A6E]/35 border-[#D9B45A]/45 text-[#F6EFDD]'
                  }`}
                >
                  <h1 dir="rtl" lang="ar" className="font-kufi text-2xl sm:text-3xl font-bold tracking-wide">
                    سُورَةُ {surahData.meta.name}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-1 text-xs opacity-80 font-sans tabular-nums">
                    <span>{getRevelationTypeLabel(surahData.meta.revelationType, lang)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatLocalizedDigits(surahData.meta.numberOfAyahs, lang)} {t('آية', 'Ayahs')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{getJuzLabel(surahData.meta.juzNumber, lang)}</span>
                  </div>
                </div>

                {surahData.bismillahPre && (
                  <div dir="rtl" lang="ar" className="mt-4 text-center">
                    <p
                      className={`font-quran text-2xl sm:text-3xl leading-loose ${
                        isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'
                      }`}
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </p>
                  </div>
                )}
              </div>

              <div
                dir="rtl"
                className={
                  isDualPage
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x-2 md:divide-x-reverse divide-[#D9B45A]/25'
                    : ''
                }
              >
                <div
                  dir="rtl"
                  lang="ar"
                  className={`text-right sm:text-justify font-quran select-text ${isDualPage ? 'md:pl-6' : ''}`}
                  style={ruledLinesStyle}
                >
                  {rightPageAyahs.map((ayah) => {
                    const isActive = activeAyahNumber === ayah.numberInSurah;
                    const isManualSelected =
                      manualHighlight?.surahNumber === surahData.meta.number &&
                      manualHighlight?.ayah.numberInSurah === ayah.numberInSurah;
                    const isBookmarked = bookmarksBySurah[surahData.meta.number] === ayah.numberInSurah;

                    return (
                      <AyahSpan
                        key={ayah.numberInSurah}
                        ayah={ayah}
                        surahNumber={surahData.meta.number}
                        surahName={surahData.meta.name}
                        lang={lang}
                        isActive={isActive}
                        isManualSelected={isManualSelected}
                        isManualHighlightMode={isManualHighlightMode}
                        isBookmarked={isBookmarked}
                        isPlayingAudio={isPlayingAudio}
                        isLightPaper={isLightPaper}
                        fontSize={fontSize}
                        lineHeightPx={lineHeightPx}
                        isTajweedActive={isTajweedActive}
                        activeWordIndex={computeActiveWordIndex(ayah, surahData.meta.number)}
                        onManualSelectAyah={handleManualSelectAyah}
                        onTriggerAyahMenu={handleTriggerAyahMenu}
                        onToggleBookmark={handleToggleBookmark}
                        setRef={(el) => {
                          ayahRefs.current[`${surahData.meta.number}:${ayah.numberInSurah}`] = el;
                        }}
                      />
                    );
                  })}
                </div>

                {isDualPage && (
                  <div
                    dir="rtl"
                    lang="ar"
                    className="text-right sm:text-justify font-quran select-text md:pr-6"
                    style={ruledLinesStyle}
                  >
                    {leftPageAyahs.map((ayah) => {
                      const isActive = activeAyahNumber === ayah.numberInSurah;
                      const isManualSelected =
                        manualHighlight?.surahNumber === surahData.meta.number &&
                        manualHighlight?.ayah.numberInSurah === ayah.numberInSurah;
                      const isBookmarked = bookmarksBySurah[surahData.meta.number] === ayah.numberInSurah;

                      return (
                        <AyahSpan
                          key={ayah.numberInSurah}
                          ayah={ayah}
                          surahNumber={surahData.meta.number}
                          surahName={surahData.meta.name}
                          lang={lang}
                          isActive={isActive}
                          isManualSelected={isManualSelected}
                          isManualHighlightMode={isManualHighlightMode}
                          isBookmarked={isBookmarked}
                          isPlayingAudio={isPlayingAudio}
                          isLightPaper={isLightPaper}
                          fontSize={fontSize}
                          lineHeightPx={lineHeightPx}
                          isTajweedActive={isTajweedActive}
                          activeWordIndex={computeActiveWordIndex(ayah, surahData.meta.number)}
                          onManualSelectAyah={handleManualSelectAyah}
                          onTriggerAyahMenu={handleTriggerAyahMenu}
                          onToggleBookmark={handleToggleBookmark}
                          setRef={(el) => {
                            ayahRefs.current[`${surahData.meta.number}:${ayah.numberInSurah}`] = el;
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-10 pt-5 border-t border-current/15 opacity-75 flex flex-wrap items-center justify-between gap-2 text-xs font-sans tabular-nums">
                <span>{getJuzLabel(surahData.meta.juzNumber, lang)}</span>
                <span>{t('بيان · مصحف وقف لوجه الله تعالى', "Bayan · A Charitable Qur'an Endowment")}</span>
                <button
                  type="button"
                  onClick={() => setReaderMode('page')}
                  className="underline hover:text-[#D9B45A] cursor-pointer"
                >
                  {t('عرض صفحات المصحف (٦٠٤)', "Switch to 604-Page Mus'haf")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== SLIM ACTIVE STATUS STRIP & MANUAL HIGHLIGHT BAR ABOVE GLASS DOCK ===================== */}
      {!isChromeHidden && activeDockSheet === 'none' && !isAudioSheetOpen && !quickActionTarget && (isPlayingAudio || isAutoScrolling || Boolean(manualHighlight)) && (
        <div className="fixed bottom-[5.15rem] left-1/2 -translate-x-1/2 z-[39] w-[min(94vw,540px)] space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {manualHighlight && (
            <div
              className={`px-3 py-1.5 rounded-2xl border backdrop-blur-xl flex items-center justify-between gap-2 text-[11px] font-semibold ${
                isLightPaper
                  ? 'bg-[#FBF7EE]/95 border-[#8A6418]/40 text-[#1B1A17] shadow-lg'
                  : 'bg-[#10161F]/95 border-[#D9B45A]/45 text-[#E9E3D3] shadow-xl'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const key = `${manualHighlight.surahNumber}:${manualHighlight.ayah.numberInSurah}`;
                  const el = ayahRefs.current[key];
                  if (el) {
                    programmaticSmoothScrollUntilRef.current = performance.now() + 750;
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80"
                title={t('التمرير إلى الآية المظلّلة', 'Scroll to highlighted Ayah')}
              >
                <span className="w-2 h-2 rounded-full bg-[#D9B45A] shrink-0" />
                <span className="truncate font-bold">
                  {t(
                    `محددة: ${manualHighlight.surahName} · ${formatLocalizedDigits(manualHighlight.ayah.numberInSurah, lang)}`,
                    `Selected: ${resolveSurahTitle(manualHighlight.surahNumber, manualHighlight.surahName)} · ${manualHighlight.ayah.numberInSurah}`
                  )}
                </span>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onOpenTadabburModal(
                      manualHighlight.ayah,
                      manualHighlight.surahNumber,
                      manualHighlight.surahName
                    );
                  }}
                  title={t('التفسير والتدبر دون إيقاف الصوت', 'Tafsir & Reflection without stopping audio')}
                  className={`min-h-[28px] px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    isLightPaper
                      ? 'border-[#8A6418]/30 text-[#6F4E0E] hover:bg-[#8A6418]/10'
                      : 'border-[#D9B45A]/35 text-[#D9B45A] hover:bg-[#D9B45A]/15'
                  }`}
                >
                  <PenLine className="w-3 h-3" />
                  <span>{t('تدبّر', 'Reflect')}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleBookmark(manualHighlight.ayah.numberInSurah, manualHighlight.surahNumber)
                  }
                  aria-label={t('حفظ علامة وقف', 'Bookmark Ayah')}
                  title={t('علامة وقف', 'Bookmark')}
                  className={`min-w-[28px] min-h-[28px] rounded-lg border flex items-center justify-center cursor-pointer ${
                    bookmarksBySurah[manualHighlight.surahNumber] === manualHighlight.ayah.numberInSurah
                      ? 'bg-[#D9B45A]/25 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A]'
                      : 'border-current/20 hover:bg-current/5'
                  }`}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      bookmarksBySurah[manualHighlight.surahNumber] === manualHighlight.ayah.numberInSurah
                        ? 'fill-current'
                        : ''
                    }`}
                  />
                </button>

                {onOpenShareModal && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenShareModal(
                        manualHighlight.ayah,
                        manualHighlight.surahNumber,
                        manualHighlight.surahName
                      )
                    }
                    aria-label={t('مشاركة بطاقة', 'Share card')}
                    title={t('بطاقة مشاركة', 'Share card')}
                    className="min-w-[28px] min-h-[28px] rounded-lg border border-current/20 hover:bg-current/5 flex items-center justify-center cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {isAutoScrolling && (
                  <button
                    type="button"
                    onClick={() => setIsAutoScrollPaused((p) => !p)}
                    title={
                      isAutoScrollPaused
                        ? t('متابعة التمرير الآلي مع إبقاء التظليل', 'Resume auto-scroll while keeping highlight')
                        : t('إيقاف التمرير الآلي مؤقتًا للتأمل', 'Pause auto-scroll for reflection')
                    }
                    className={`min-h-[28px] px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      isAutoScrollPaused
                        ? 'bg-[#D9B45A] border-[#D9B45A] text-[#1B1A17]'
                        : 'border-current/20 hover:bg-current/5'
                    }`}
                  >
                    {isAutoScrollPaused ? (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>{t('متابعة', 'Resume')}</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3 h-3" />
                        <span className="hidden sm:inline">{t('تثبيت', 'Hold')}</span>
                      </>
                    )}
                  </button>
                )}

                {onAyahAudioSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      onAyahAudioSelect(manualHighlight.ayah.numberInSurah, manualHighlight.surahNumber);
                      handleClearManualHighlight();
                    }}
                    title={t('نقل قراءة الشيخ لهذه الآية', 'Move Sheikh recitation to this Ayah')}
                    className="min-h-[28px] px-2 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3 text-[#D9B45A]" />
                    <span className="hidden sm:inline">{t('استماع', 'Listen')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearManualHighlight}
                  aria-label={t('إلغاء التحديد اليدوي', 'Clear manual highlight')}
                  title={t('إلغاء التحديد واستئناف التمرير', 'Clear highlight & resume scroll')}
                  className="min-w-[28px] min-h-[28px] rounded-lg hover:bg-current/10 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {(isPlayingAudio || isAutoScrolling) && (
            <div className={`px-3 py-1.5 rounded-full border backdrop-blur-xl flex items-center justify-between gap-2 text-[11px] font-semibold ${glassDockClasses}`}>
              {isPlayingAudio ? (
                <>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
                    <span className="truncate">
                      {selectedReciter
                        ? getReciterDisplayName(selectedReciter, lang).split(' ').slice(0, 2).join(' ')
                        : t('تلاوة', 'Reciting')}{' '}
                      · {t(`الآية ${formatLocalizedDigits(activeAyahNumber, lang)}`, `Ayah ${activeAyahNumber}`)}
                    </span>
                    {(manualHighlight || scrollMode === 'manual-speed' || isManualHighlightMode) && (
                      <button
                        type="button"
                        onClick={handleReturnToReciter}
                        title={t('العودة والتركيز على آية الشيخ الآن', "Return to the Sheikh's live Ayah")}
                        className={`min-h-[24px] px-2 rounded-full text-[10px] font-bold shrink-0 cursor-pointer border transition-colors ${
                          isLightPaper
                            ? 'border-[#1F3A6E]/30 bg-[#1F3A6E]/10 text-[#1F3A6E] hover:bg-[#1F3A6E]/15'
                            : 'border-[#D9B45A]/35 bg-[#D9B45A]/15 text-[#D9B45A] hover:bg-[#D9B45A]/25'
                        }`}
                      >
                        {t('للقارئ', 'Reciter')}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleManualHighlightMode}
                      aria-pressed={isManualHighlightMode}
                      title={t(
                        'تظليل يدوي: اضغط على أي آية للتحديد والتدبر دون قطع الصوت',
                        'Manual Highlight: tap any Ayah to select & reflect without interrupting audio'
                      )}
                      className={`min-h-[28px] px-2 rounded-full text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                        isManualHighlightMode
                          ? 'bg-[#D9B45A] border-[#D9B45A] text-[#1B1A17]'
                          : isLightPaper
                          ? 'border-[#8A6418]/25 text-[#1B1A17] hover:bg-current/5'
                          : 'border-[#D9B45A]/25 text-[#E9E3D3] hover:bg-current/5'
                      }`}
                    >
                      <Highlighter className="w-3 h-3 shrink-0" />
                      <span>{t('تظليل يدوي', 'Highlight')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDockSheet('autoscroll')}
                      title={t('سرعة التمرير الآلي البطيء أثناء الاستماع', 'Slow auto-scroll settings while listening')}
                      className={`min-h-[28px] px-2 rounded-full text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                        scrollMode === 'manual-speed' && isAutoScrolling
                          ? isLightPaper
                            ? 'border-[#1F3A6E]/35 bg-[#1F3A6E]/10 text-[#1F3A6E]'
                            : 'border-[#D9B45A]/45 bg-[#D9B45A]/15 text-[#D9B45A]'
                          : 'border-current/20 hover:bg-current/5'
                      }`}
                    >
                      <ChevronsDown className="w-3 h-3 shrink-0" />
                      <span className="tabular-nums">
                        {scrollMode === 'manual-speed' && isAutoScrolling
                          ? formatSpeedLabel(autoScrollSpeed, lang)
                          : t('تمرير', 'Scroll')}
                      </span>
                    </button>

                    {onOpenAudioSheet && (
                      <button
                        type="button"
                        onClick={onOpenAudioSheet}
                        className={`min-h-[28px] px-2.5 rounded-full text-[11px] font-bold cursor-pointer ${
                          isLightPaper
                            ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                            : 'bg-[#D9B45A] text-[#1B1A17]'
                        }`}
                      >
                        {t('الصوت', 'Audio')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronsDown className={`w-3.5 h-3.5 shrink-0 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
                    <span className="truncate">
                      {isAutoScrollPaused && manualHighlight
                        ? t('متوقف للتدبّر', 'Paused to reflect')
                        : isAdvancingPageUi
                        ? t('انتقال للصفحة التالية…', 'Turning page…')
                        : autoAdvancePage
                        ? t('تمرير آلي متواصل', 'Continuous Scroll')
                        : t('تمرير آلي', 'Auto Scroll')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleManualHighlightMode}
                      aria-pressed={isManualHighlightMode}
                      title={t(
                        'تظليل يدوي: اضغط على أي آية للتحديد والتأمل مع التمرير الآلي',
                        'Manual Highlight: tap any Ayah to select & reflect during auto-scroll'
                      )}
                      className={`min-h-[30px] px-2 rounded-full text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                        isManualHighlightMode
                          ? 'bg-[#D9B45A] border-[#D9B45A] text-[#1B1A17]'
                          : isLightPaper
                          ? 'border-[#8A6418]/25 text-[#1B1A17] hover:bg-current/5'
                          : 'border-[#D9B45A]/25 text-[#E9E3D3] hover:bg-current/5'
                      }`}
                    >
                      <Highlighter className="w-3 h-3 shrink-0" />
                      <span className="hidden xs:inline sm:inline">{t('تظليل', 'Mark')}</span>
                    </button>

                    <div
                      dir="ltr"
                      className={`flex items-center rounded-full border p-0.5 ${
                        isLightPaper
                          ? 'border-[#8A6418]/25 bg-[#EFE6D1]/70'
                          : 'border-[#D9B45A]/25 bg-[#172235]/80'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={autoScrollSpeed <= MIN_AUTO_SCROLL_SPEED}
                        onPointerDown={() => handleSpeedHoldStart(-1)}
                        onPointerUp={clearSpeedHoldTimers}
                        onPointerLeave={clearSpeedHoldTimers}
                        onPointerCancel={clearSpeedHoldTimers}
                        onClick={() => handleSpeedStepClick(-1)}
                        aria-label={t('إبطاء سرعة التمرير', 'Decrease scroll speed')}
                        title={t('إبطاء التمرير (اضغط باستمرار للتدرج)', 'Slow down (hold to step)')}
                        className="min-w-[30px] min-h-[28px] rounded-full flex items-center justify-center hover:bg-current/10 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveDockSheet('autoscroll')}
                        aria-label={t('السرعة الحالية وفتح الإعدادات', 'Current speed and settings')}
                        className={`min-w-[46px] min-h-[28px] px-1 rounded-full text-[11px] font-bold tabular-nums cursor-pointer ${
                          isLightPaper
                            ? 'text-[#1F3A6E] hover:bg-current/5'
                            : 'text-[#D9B45A] hover:bg-current/5'
                        }`}
                      >
                        {formatSpeedLabel(autoScrollSpeed, lang)}
                      </button>

                      <button
                        type="button"
                        disabled={autoScrollSpeed >= MAX_AUTO_SCROLL_SPEED}
                        onPointerDown={() => handleSpeedHoldStart(1)}
                        onPointerUp={clearSpeedHoldTimers}
                        onPointerLeave={clearSpeedHoldTimers}
                        onPointerCancel={clearSpeedHoldTimers}
                        onClick={() => handleSpeedStepClick(1)}
                        aria-label={t('زيادة سرعة التمرير', 'Increase scroll speed')}
                        title={t('تسريع التمرير (اضغط باستمرار للتدرج)', 'Speed up (hold to step)')}
                        className="min-w-[30px] min-h-[28px] rounded-full flex items-center justify-center hover:bg-current/10 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveDockSheet('autoscroll')}
                      aria-label={t('إعدادات التمرير الآلي', 'Auto-scroll settings')}
                      className="min-w-[30px] min-h-[30px] rounded-full flex items-center justify-center hover:bg-current/10 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== ANCHORED CIRCULAR GLASS DOCK (Recite CTA + Circular Sliding Dial) ===================== */}
      <nav
        aria-label={t('أدوات المصحف السريعة', "Mus'haf quick tools")}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={`fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(94vw,540px)] z-40 rounded-3xl border backdrop-blur-xl transition-[opacity,transform] duration-200 will-change-transform pb-[env(safe-area-inset-bottom)] overflow-hidden ${glassDockClasses} ${
          isChromeHidden
            ? 'translate-y-24 opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Razor-thin audio progress indicator along top rim of dock */}
        {isPlayingAudio && (
          <div dir="ltr" className="w-full h-[2.5px] bg-current/10">
            <div
              className="h-full bg-gradient-to-r from-[#1F3A6E] via-[#2E5499] to-[#D9B45A]"
              style={{ width: `${audioProgressPercent}%` }}
            />
          </div>
        )}

        <div className="flex items-center px-1.5 py-1.5 gap-1">
          {/* Anchored Primary CTA: Recite */}
          <button
            type="button"
            onClick={() => {
              setActiveDockSheet('none');
              if (isPlayingAudio) {
                onTogglePlayAudio?.();
                return;
              }
              const startTarget = resolveReciteStartTarget({
                readerMode,
                currentSurahNumber: surahData.meta.number,
                activeAyahNumber,
                visiblePageAyahs: pageData?.ayahs || [],
                manualHighlight: manualHighlight
                  ? {
                      surahNumber: manualHighlight.surahNumber,
                      ayahNumber: manualHighlight.ayah.numberInSurah,
                    }
                  : null,
              });
              if (startTarget.needsSwitch && onAyahAudioSelect) {
                onAyahAudioSelect(startTarget.ayahNumber, startTarget.surahNumber);
                return;
              }
              if (onTogglePlayAudio) {
                onTogglePlayAudio();
              } else {
                onOpenAudioSheet?.();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenAudioSheet?.();
            }}
            className={`w-[20%] min-w-[64px] max-w-[82px] shrink-0 min-h-[50px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              isPlayingAudio || isAudioSheetOpen
                ? isLightPaper
                  ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                  : 'bg-[#1F3A6E]/80 text-[#D9B45A] border border-[#D9B45A]/35'
                : 'hover:bg-current/5'
            }`}
            title={t('تشغيل أو إيقاف التلاوة الصوتية', 'Play or pause audio recitation')}
          >
            {isPlayingAudio ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
            )}
            <span className="text-[11px] font-bold whitespace-nowrap">{t('تلاوة', 'Recite')}</span>
          </button>

          {/* Subtle Hairline Divider */}
          <div
            aria-hidden="true"
            className={`h-8 w-px shrink-0 ${isLightPaper ? 'bg-[#8A6418]/22' : 'bg-[#D9B45A]/22'}`}
          />

          {/* Desktop prev step button */}
          <button
            type="button"
            onClick={() => stepCircularDial(-1)}
            aria-label={t('الأدوات السابقة', 'Previous tools')}
            title={t('الأدوات السابقة', 'Previous tools')}
            className="hidden sm:flex shrink-0 w-7 min-h-[44px] items-center justify-center rounded-xl opacity-65 hover:opacity-100 hover:bg-current/5 transition-opacity cursor-pointer"
          >
            {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Infinite Circular Dial Track (4 visible items smoothly rotating on swipe/wheel) */}
          <div
            ref={dialTrackRef}
            role="region"
            aria-roledescription={t('شريط أدوات دائري متحرك', 'Circular rotating toolbar')}
            aria-label={t(
              'أقسام وأدوات القراءة المتحركة — اسحب يميناً أو يساراً للتدوير',
              'Rotating reading tools — swipe left or right to browse'
            )}
            tabIndex={0}
            onPointerDown={handleDialPointerDown}
            onPointerMove={handleDialPointerMove}
            onPointerUp={finishDialPointerDrag}
            onPointerCancel={finishDialPointerDrag}
            onWheel={(e) => {
              const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
              if (Math.abs(delta) < 6) return;
              const now = performance.now();
              if (now - lastDialWheelRef.current < 160) return;
              lastDialWheelRef.current = now;
              stepCircularDial(delta > 0 ? 1 : -1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                stepCircularDial(1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                stepCircularDial(-1);
              }
            }}
            style={{
              touchAction: 'pan-y',
              overscrollBehaviorX: 'contain',
              maskImage: 'linear-gradient(to left, transparent 0%, black 7%, black 93%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to left, transparent 0%, black 7%, black 93%, transparent 100%)',
            }}
            className={`relative flex-1 min-w-0 h-[50px] overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]/60 rounded-2xl ${
              isDialDragging ? 'cursor-grabbing' : 'cursor-grab sm:cursor-pointer'
            }`}
          >
            {circularDialSlots.map((slot) => {
              const item = dialItems[slot.itemIndex];
              if (!item) return null;
              return (
                <button
                  key={`dial-slot-${slot.virtualSlot}`}
                  type="button"
                  disabled={!slot.isInteractive}
                  aria-hidden={!slot.isInteractive}
                  tabIndex={slot.isInteractive ? 0 : -1}
                  onClick={(e) => {
                    if (performance.now() < suppressDialClickUntilRef.current || !slot.isInteractive) {
                      e.preventDefault();
                      return;
                    }
                    item.onClick();
                  }}
                  onContextMenu={item.onContextMenu}
                  title={item.title}
                  style={{
                    transform: `translate3d(${dir === 'rtl' ? -slot.slotPosition * 100 : slot.slotPosition * 100}%, 0, 0) scale(${slot.scale})`,
                    opacity: slot.opacity,
                  }}
                  className={`absolute top-0 bottom-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-1/4 px-0.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors will-change-transform ${
                    slot.isInteractive ? 'cursor-pointer' : 'pointer-events-none'
                  } ${
                    item.isActive
                      ? isLightPaper
                        ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                        : 'bg-[#1F3A6E]/80 text-[#D9B45A] border border-[#D9B45A]/35'
                      : 'hover:bg-current/5'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] min-[375px]:text-[11px] font-bold whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop next step button */}
          <button
            type="button"
            onClick={() => stepCircularDial(1)}
            aria-label={t('المزيد من الأدوات', 'Next tools')}
            title={t('المزيد من الأدوات', 'Next tools')}
            className="hidden sm:flex shrink-0 w-7 min-h-[44px] items-center justify-center rounded-xl opacity-65 hover:opacity-100 hover:bg-current/5 transition-opacity cursor-pointer"
          >
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Subtle Swipe-Wave Indicator Segments Below Circular Dial */}
        {dialWaveCount > 1 && (
          <div className="flex items-center px-1.5 pb-1 -mt-0.5 gap-1">
            <div className="w-[20%] min-w-[64px] max-w-[82px] shrink-0" aria-hidden="true" />
            <div className="w-px shrink-0" aria-hidden="true" />
            <div className="flex-1 flex items-center justify-center gap-1">
              {Array.from({ length: dialWaveCount }, (_, waveIdx) => {
                const isActive = waveIdx === activeDialWave;
                return (
                  <button
                    key={waveIdx}
                    type="button"
                    onClick={() => jumpDialToWave(waveIdx)}
                    aria-label={t(
                      `مجموعة أدوات ${formatLocalizedDigits(waveIdx + 1, lang)} من ${formatLocalizedDigits(dialWaveCount, lang)}`,
                      `Tool group ${waveIdx + 1} of ${dialWaveCount}`
                    )}
                    className="px-1.5 py-0.5 flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className={`block h-[2.5px] rounded-full transition-all duration-200 ${
                        isActive
                          ? isLightPaper
                            ? 'w-5 bg-[#1F3A6E]'
                            : 'w-5 bg-[#D9B45A]'
                          : 'w-2.5 bg-current opacity-25 hover:opacity-50'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* ===================== DOCK FLOATING SHEETS ===================== */}
      {activeDockSheet !== 'none' && !isChromeHidden && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setActiveDockSheet('none')}
          />

          {/* Sheet 1: Quick Page & Juz Jump */}
          {activeDockSheet === 'quickjump' && (
            <div
              role="dialog"
              aria-label={t('الانتقال السريع للصفحة والجزء', 'Quick jump to Page or Juz')}
              className={`fixed bottom-[5.45rem] left-1/2 -translate-x-1/2 z-[45] w-[min(94vw,520px)] max-h-[70vh] overflow-y-auto rounded-3xl border backdrop-blur-xl p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150 ${glassSheetClasses}`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-current/12">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickJumpTab('page')}
                    className={`min-h-[34px] px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      quickJumpTab === 'page'
                        ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                        : 'hover:bg-current/5 opacity-75'
                    }`}
                  >
                    {t('رقم الصفحة (١–٦٠٤)', 'Page (1–604)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickJumpTab('juz')}
                    className={`min-h-[34px] px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      quickJumpTab === 'juz'
                        ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                        : 'hover:bg-current/5 opacity-75'
                    }`}
                  >
                    {t('الأجزاء (٣٠)', 'Juz (30)')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDockSheet('none')}
                  aria-label={t('إغلاق', 'Close')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-current/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quickJumpTab === 'page' ? (
                <form onSubmit={handleJumpMushafPage} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={pageInputDraft}
                      onChange={(e) => setPageInputDraft(e.target.value)}
                      placeholder={t('رقم الصفحة (١–٦٠٤)', 'Page number (1–604)')}
                      aria-label={t('أدخل رقم الصفحة', 'Enter page number')}
                      className="flex-1 min-h-[44px] px-3 rounded-xl bg-current/5 border border-current/20 text-sm font-bold text-center tabular-nums outline-none focus:border-[#D9B45A]"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold cursor-pointer"
                    >
                      {t('انتقال', 'Go')}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-xs">
                    {[1, 50, 100, 200, 300, 400, 500, 582].map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => {
                          setReaderMode('page');
                          jumpToMushafPage(pg);
                          setActiveDockSheet('none');
                        }}
                        className="min-h-[36px] rounded-xl border border-current/15 hover:bg-current/5 font-bold tabular-nums cursor-pointer"
                      >
                        {t(`ص ${formatLocalizedDigits(pg, lang)}`, `P ${pg}`)}
                      </button>
                    ))}
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 text-xs">
                  {Array.from({ length: 30 }, (_, idx) => idx + 1).map((juz) => {
                    const isCurrent = juz === headerJuzNumber;
                    return (
                      <button
                        key={juz}
                        type="button"
                        onClick={() => {
                          setActiveDockSheet('none');
                          onNavigateToJuz?.(juz);
                        }}
                        className={`min-h-[40px] rounded-xl border font-bold tabular-nums cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-[#1F3A6E] text-[#D9B45A] border-[#D9B45A]/60'
                            : 'border-current/15 hover:bg-current/5'
                        }`}
                        title={getJuzLabel(juz, lang)}
                      >
                        {t(`جـ ${formatLocalizedDigits(juz, lang)}`, `Juz ${juz}`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sheet 2: Bookmarks & Resume ("المراجع" / "Saved") */}
          {activeDockSheet === 'bookmarks' && (
            <div
              role="dialog"
              aria-label={t('المراجع وعلامات الوقف', 'Bookmarks & Resume')}
              className={`fixed bottom-[5.45rem] left-1/2 -translate-x-1/2 z-[45] w-[min(94vw,520px)] max-h-[70vh] overflow-y-auto rounded-3xl border backdrop-blur-xl p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150 ${glassSheetClasses}`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-current/12">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Bookmark className={`w-4 h-4 ${isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'}`} />
                  <span>{t('المراجع وعلامات الوقف', 'Bookmarks & Resume')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDockSheet('none')}
                  aria-label={t('إغلاق المراجع', 'Close bookmarks')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-current/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toggle Bookmark on Active Ayah */}
              {activeAyahContext.ayah && (
                <button
                  type="button"
                  onClick={() => handleToggleBookmark(activeAyahContext.ayah.numberInSurah, activeAyahContext.surahNumber)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between cursor-pointer ${
                    currentBookmarkOnActive
                      ? 'bg-[#D9B45A]/20 border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                      : 'bg-[#1F3A6E] border-[#648CD4]/40 text-[#F6EFDD]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bookmark className={`w-4 h-4 ${currentBookmarkOnActive ? 'fill-current' : ''}`} />
                    <span>
                      {currentBookmarkOnActive
                        ? t(
                            `إزالة العلامة عن سورة ${activeAyahContext.surahName} (${formatLocalizedDigits(activeAyahContext.ayah.numberInSurah, lang)})`,
                            `Remove bookmark on ${resolveSurahTitle(activeAyahContext.surahNumber, activeAyahContext.surahName)} (${activeAyahContext.ayah.numberInSurah})`
                          )
                        : t(
                            `حفظ علامة وقف عند سورة ${activeAyahContext.surahName} (${formatLocalizedDigits(activeAyahContext.ayah.numberInSurah, lang)})`,
                            `Bookmark ${resolveSurahTitle(activeAyahContext.surahNumber, activeAyahContext.surahName)} (${activeAyahContext.ayah.numberInSurah})`
                          )}
                    </span>
                  </span>
                </button>
              )}

              {/* Resume Position */}
              {savedResumePos && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDockSheet('none');
                    onNavigateToAyah?.(savedResumePos.surahNumber, savedResumePos.ayahNumber);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-current/15 hover:bg-current/5 text-xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <Compass className={`w-4 h-4 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
                    <span>
                      {t(
                        `أكمل من حيث توقفت: سورة ${savedResumePos.surahName}`,
                        `Resume: ${resolveSurahTitle(savedResumePos.surahNumber, savedResumePos.surahName)}`
                      )}
                    </span>
                  </span>
                  <span className="tabular-nums opacity-75">
                    {t(`آية ${formatLocalizedDigits(savedResumePos.ayahNumber, lang)}`, `Ayah ${savedResumePos.ayahNumber}`)}
                  </span>
                </button>
              )}

              {/* Saved Bookmarks List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold opacity-70">
                  {t(
                    `العلامات المحفوظة (${formatLocalizedDigits(allBookmarksList.length, lang)})`,
                    `Saved Bookmarks (${allBookmarksList.length})`
                  )}
                </div>
                {allBookmarksList.length === 0 ? (
                  <p className="text-xs opacity-65 py-4 text-center">
                    {t(
                      'لا توجد علامات وقف محفوظة بعد. اضغط مطولاً على أي آية أو انقر رمزها ﴿١﴾ لحفظ علامة.',
                      'No bookmarks saved yet. Long-press any Ayah or tap its verse marker ﴿١﴾ to save one.'
                    )}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {allBookmarksList.map((b) => (
                      <button
                        key={`${b.surahNumber}:${b.ayahNumber}`}
                        type="button"
                        onClick={() => {
                          setActiveDockSheet('none');
                          onNavigateToAyah?.(b.surahNumber, b.ayahNumber);
                        }}
                        className="w-full p-2.5 rounded-xl border border-current/15 hover:bg-current/5 text-start flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold">
                            {t(
                              `سورة ${b.surahName} · آية ${formatLocalizedDigits(b.ayahNumber, lang)}`,
                              `${resolveSurahTitle(b.surahNumber, b.surahName)} · Ayah ${b.ayahNumber}`
                            )}
                          </div>
                          {b.ayahSnippet && (
                            <p dir="rtl" lang="ar" className="font-quran text-sm opacity-75 truncate text-right">
                              {b.ayahSnippet}
                            </p>
                          )}
                        </div>
                        {b.page && (
                          <span className="text-[11px] opacity-70 tabular-nums shrink-0">
                            {t(`ص ${formatLocalizedDigits(b.page, lang)}`, `P ${b.page}`)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {onNavigateView && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDockSheet('none');
                    onNavigateView('journal');
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-current/15 hover:bg-current/5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>{t('فتح مفكرتي والعلامات', 'Open Notes & Bookmarks')}</span>
                </button>
              )}
            </div>
          )}

          {/* Sheet 3: Auto-Scroll Settings */}
          {activeDockSheet === 'autoscroll' && (
            <div
              role="dialog"
              aria-label={t('إعدادات التمرير التلقائي', 'Auto-scroll settings')}
              className={`fixed bottom-[5.45rem] left-1/2 -translate-x-1/2 z-[45] w-[min(94vw,520px)] rounded-3xl border backdrop-blur-xl p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150 ${glassSheetClasses}`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-current/12 text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <SlidersHorizontal className={`w-4 h-4 ${isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'}`} />
                  <span>{t('إعدادات القراءة الآلية', 'Auto-Scroll Settings')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDockSheet('none')}
                  aria-label={t('إغلاق', 'Close')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-current/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isPlayingAudio && (
                <div className="grid grid-cols-2 gap-1.5 bg-current/5 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setScrollMode('reciter-sync');
                      setIsAutoScrolling(true);
                    }}
                    className={`min-h-[38px] rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      scrollMode === 'reciter-sync' ? 'bg-[#1F3A6E] text-[#F6EFDD]' : 'opacity-75'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{t('مزامنة القارئ', 'Sync Reciter')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScrollMode('manual-speed');
                      setIsAutoScrolling(true);
                    }}
                    className={`min-h-[38px] rounded-lg font-bold cursor-pointer ${
                      scrollMode === 'manual-speed' ? 'bg-[#D9B45A] text-[#1B1A17]' : 'opacity-75'
                    }`}
                  >
                    <span>
                      {t('سرعة حرة', 'Free Speed')} ({formatSpeedLabel(MIN_AUTO_SCROLL_SPEED, lang)}–{formatSpeedLabel(MAX_AUTO_SCROLL_SPEED, lang)})
                    </span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleManualHighlightMode}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isManualHighlightMode
                    ? 'bg-[#D9B45A]/15 border-[#D9B45A]/60 text-[#6F4E0E] dark:text-[#D9B45A]'
                    : 'border-current/15 hover:bg-current/5'
                }`}
              >
                <div className="flex items-center gap-2 text-start min-w-0">
                  <Highlighter className="w-4 h-4 shrink-0 text-[#D9B45A]" />
                  <div className="min-w-0">
                    <div className="font-bold">
                      {t('التظليل اليدوي مع التمرير الآلي', 'Manual Highlight with Auto-Scroll')}
                    </div>
                    <div className="text-[11px] opacity-75 truncate">
                      {t(
                        'تظليل أي آية للتدبر مع وقفة تلقائية للتمرير دون قطع التلاوة',
                        'Tap any Ayah to pause scroll & reflect without interrupting audio'
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                    isManualHighlightMode
                      ? 'bg-[#D9B45A] text-[#1B1A17]'
                      : 'bg-current/10 opacity-80'
                  }`}
                >
                  {isManualHighlightMode ? t('مفعّل', 'ON') : t('إيقاف', 'OFF')}
                </span>
              </button>

              {/* 3 Quranic Pace Presets */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {AUTO_SCROLL_PRESETS.map((preset) => {
                  const isSelected = Math.abs(autoScrollSpeed - preset.speed) < 0.05;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAutoScrollSpeed(preset.speed);
                        setScrollMode('manual-speed');
                        setIsAutoScrolling(true);
                        setIsAutoScrollPaused(false);
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A]'
                          : 'border-current/15 hover:bg-current/5'
                      }`}
                    >
                      <span className="font-bold whitespace-nowrap">{getAutoScrollPresetLabel(preset.id, lang)}</span>
                      <span className={`text-[10px] tabular-nums ${isSelected ? 'text-[#D9B45A]' : 'opacity-65'}`}>
                        {formatSpeedLabel(preset.speed, lang)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Precision +/- & Continuous Slider */}
              <div className="p-3 rounded-2xl border border-current/15 bg-current/[0.03] space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold opacity-80">{t('السرعة الدقيقة', 'Fine Speed')}</span>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <span
                      className={`px-2 py-0.5 rounded-lg font-bold ${
                        isLightPaper ? 'bg-[#1F3A6E] text-[#F6EFDD]' : 'bg-[#1F3A6E] text-[#D9B45A]'
                      }`}
                    >
                      {formatSpeedLabel(autoScrollSpeed, lang)}
                    </span>
                    <span className="text-[11px] opacity-65">
                      ({formatLocalizedDigits(Math.round(computeAutoScrollPxPerSec(autoScrollSpeed, fontSize, adaptiveScrollPace)), lang)}{' '}
                      {t('بكسل/ث', 'px/s')})
                    </span>
                  </div>
                </div>

                <div dir="ltr" className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={autoScrollSpeed <= MIN_AUTO_SCROLL_SPEED}
                    onPointerDown={() => handleSpeedHoldStart(-1)}
                    onPointerUp={clearSpeedHoldTimers}
                    onPointerLeave={clearSpeedHoldTimers}
                    onPointerCancel={clearSpeedHoldTimers}
                    onClick={() => handleSpeedStepClick(-1)}
                    aria-label={t('إبطاء سرعة التمرير', 'Decrease scroll speed')}
                    className="min-w-[40px] min-h-[40px] rounded-xl border border-current/20 hover:bg-current/5 flex items-center justify-center disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min={MIN_AUTO_SCROLL_SPEED}
                    max={MAX_AUTO_SCROLL_SPEED}
                    step={0.1}
                    value={autoScrollSpeed}
                    aria-label={t('شريط ضبط سرعة التمرير', 'Auto-scroll speed slider')}
                    onChange={(e) => {
                      const next = clampAutoScrollSpeed(parseFloat(e.target.value));
                      setAutoScrollSpeed(next);
                      setScrollMode('manual-speed');
                    }}
                    className="flex-1 h-2 accent-[#1F3A6E] dark:accent-[#D9B45A] cursor-pointer"
                  />

                  <button
                    type="button"
                    disabled={autoScrollSpeed >= MAX_AUTO_SCROLL_SPEED}
                    onPointerDown={() => handleSpeedHoldStart(1)}
                    onPointerUp={clearSpeedHoldTimers}
                    onPointerLeave={clearSpeedHoldTimers}
                    onPointerCancel={clearSpeedHoldTimers}
                    onClick={() => handleSpeedStepClick(1)}
                    aria-label={t('زيادة سرعة التمرير', 'Increase scroll speed')}
                    className="min-w-[40px] min-h-[40px] rounded-xl border border-current/20 hover:bg-current/5 flex items-center justify-center disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPauseAtAyahEnds((p) => !p)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-current/15 text-xs font-semibold flex items-center justify-between cursor-pointer"
              >
                <span className="opacity-75">{t('حركة النزول:', 'Scroll Rhythm:')}</span>
                <span className="font-bold">
                  {pauseAtAyahEnds
                    ? t('وقفة عند رأس الآية', 'Pause at Ayah ends')
                    : t('انسياب مستمر', 'Continuous flow')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdaptiveScrollPace((v) => !v)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-current/15 text-xs font-semibold flex items-center justify-between cursor-pointer"
              >
                <span className="opacity-75">{t('موازنة السرعة مع حجم الخط:', 'Adapt to font size:')}</span>
                <span className="font-bold">
                  {adaptiveScrollPace
                    ? t('تلقائية (إيقاع ثابت)', 'Adaptive pace')
                    : t('ثابتة بالبكسل', 'Fixed px/s')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAutoAdvancePage((v) => !v)}
                className={`w-full min-h-[42px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  autoAdvancePage
                    ? 'border-[#D9B45A]/50 bg-[#1F3A6E]/10'
                    : 'border-current/15 hover:bg-current/5'
                }`}
              >
                <span className="opacity-80">{t('تواصل الصفحات في القراءة الآلية:', 'Auto-advance pages:')}</span>
                <span
                  className={`font-bold ${
                    autoAdvancePage
                      ? isLightPaper
                        ? 'text-[#1F3A6E]'
                        : 'text-[#D9B45A]'
                      : 'opacity-70'
                  }`}
                >
                  {autoAdvancePage
                    ? t('متصلة بانسياب مستمر', 'Seamless flow')
                    : t('تتوقف بنهاية الصفحة', 'Stop at page end')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAutoScrolling) {
                    setIsAutoScrolling(false);
                    setIsAutoScrollPaused(false);
                  } else {
                    setScrollMode(
                      isPlayingAudio &&
                        !isManualHighlightMode &&
                        !manualHighlight &&
                        scrollMode !== 'manual-speed'
                        ? 'reciter-sync'
                        : 'manual-speed'
                    );
                    setIsAutoScrolling(true);
                    setIsAutoScrollPaused(false);
                  }
                  setActiveDockSheet('none');
                }}
                className={`w-full min-h-[44px] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isAutoScrolling
                    ? 'border border-current/20 hover:bg-current/5'
                    : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] border border-[#D9B45A]/50'
                }`}
              >
                {isAutoScrolling ? <Pause className="w-4 h-4" /> : <ChevronsDown className="w-4 h-4 text-[#D9B45A]" />}
                <span>
                  {isAutoScrolling
                    ? t('إيقاف التمرير الآلي', 'Stop Auto-Scroll')
                    : t('تشغيل التمرير الآلي الآن', 'Start Auto-Scroll')}
                </span>
              </button>
            </div>
          )}

          {/* Sheet 4: Unified "More" Drawer (Current Ayah + Mushaf Settings + Bayan Sections) */}
          {activeDockSheet === 'more' && (
            <div
              role="dialog"
              aria-label={t('المزيد وإعدادات المصحف', "More & Mus'haf Settings")}
              className={`fixed bottom-[5.45rem] left-1/2 -translate-x-1/2 z-[45] w-[min(94vw,540px)] max-h-[75vh] overflow-y-auto rounded-3xl border backdrop-blur-xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150 ${glassSheetClasses}`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-current/12">
                <span className="font-bold text-sm font-kufi">
                  {t('إعدادات المصحف وأقسام بيان', "Mus'haf Settings & Bayan")}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDockSheet('none')}
                  aria-label={t('إغلاق المزيد', 'Close settings')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-current/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Section A: Quick Actions on Active Ayah & Audio Sheet */}
              {activeAyahContext.ayah && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold opacity-70">
                    {t(
                      `سورة ${activeAyahContext.surahName} · الآية ${formatLocalizedDigits(activeAyahContext.ayah.numberInSurah, lang)}`,
                      `${resolveSurahTitle(activeAyahContext.surahNumber, activeAyahContext.surahName)} · Ayah ${activeAyahContext.ayah.numberInSurah}`
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDockSheet('none');
                        onOpenTadabburModal(
                          activeAyahContext.ayah,
                          activeAyahContext.surahNumber,
                          activeAyahContext.surahName
                        );
                      }}
                      className="min-h-[42px] px-2 rounded-xl border border-current/15 hover:bg-current/5 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>{t('التفسير', 'Tafsir')}</span>
                    </button>

                    {onOpenShareModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDockSheet('none');
                          onOpenShareModal(
                            activeAyahContext.ayah,
                            activeAyahContext.surahNumber,
                            activeAyahContext.surahName
                          );
                        }}
                        className="min-h-[42px] px-2 rounded-xl border border-current/15 hover:bg-current/5 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{t('مشاركة بطاقة', 'Share Card')}</span>
                      </button>
                    )}

                    {onOpenAudioSheet && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDockSheet('none');
                          onOpenAudioSheet();
                        }}
                        className="min-h-[42px] px-2 rounded-xl bg-[#1F3A6E] text-[#F6EFDD] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                        <span>{t('خيارات الصوت', 'Audio')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Section B: Display & Mushaf Paper Controls */}
              <div className="space-y-3 pt-2 border-t border-current/12 text-xs">
                <div className="grid grid-cols-2 gap-1.5 bg-current/5 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReaderMode('page')}
                    className={`min-h-[38px] rounded-lg font-bold cursor-pointer ${
                      readerMode === 'page' ? 'bg-[#1F3A6E] text-[#F6EFDD]' : 'opacity-75'
                    }`}
                  >
                    {t('المصحف (٦٠٤ صفحة)', "Mus'haf (604 Pages)")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderMode('surah')}
                    className={`min-h-[38px] rounded-lg font-bold cursor-pointer ${
                      readerMode === 'surah' ? 'bg-[#1F3A6E] text-[#F6EFDD]' : 'opacity-75'
                    }`}
                  >
                    {t('السورة كاملة', 'Full Surah')}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold opacity-80">{t('حجم الخط:', 'Font size:')}</span>
                  <div className="flex items-center gap-1.5 border border-current/15 rounded-xl px-2 py-1 tabular-nums">
                    <button
                      type="button"
                      onClick={() => setFontSize((s) => clampMushafFontSize(s - 2))}
                      aria-label={t('تصغير الخط', 'Decrease font size')}
                      className="min-w-[34px] min-h-[32px] flex items-center justify-center cursor-pointer"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="font-bold min-w-[2.2rem] text-center">
                      {formatLocalizedDigits(fontSize, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFontSize((s) => clampMushafFontSize(s + 2))}
                      aria-label={t('تكبير الخط', 'Increase font size')}
                      className="min-w-[34px] min-h-[32px] flex items-center justify-center cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold opacity-80">{t('لون ورق المصحف:', 'Paper theme:')}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectPaperTheme('parchment')}
                      aria-label={t('ورق نهاري دافئ', 'Warm Parchment')}
                      className={`w-7 h-7 rounded-lg bg-[#F6EFDD] border cursor-pointer ${
                        theme === 'parchment' ? 'ring-2 ring-[#D9B45A] border-[#1B1A17]' : 'border-slate-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectPaperTheme('sepia')}
                      aria-label={t('ورق عاجي', 'Ivory Sepia')}
                      className={`w-7 h-7 rounded-lg bg-[#f4eedb] border cursor-pointer ${
                        theme === 'sepia' ? 'ring-2 ring-[#D9B45A] border-amber-900' : 'border-amber-700/60'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectPaperTheme('dark')}
                      aria-label={t('حبر ليلي', 'Midnight Ink')}
                      className={`w-7 h-7 rounded-lg bg-[#10161F] border cursor-pointer ${
                        theme === 'dark' ? 'ring-2 ring-[#D9B45A] border-white' : 'border-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectPaperTheme('emerald')}
                      aria-label={t('الزمرد الليلي', 'Deep Emerald')}
                      className={`w-7 h-7 rounded-lg bg-[#061914] border cursor-pointer ${
                        theme === 'emerald' ? 'ring-2 ring-[#D9B45A] border-white' : 'border-emerald-800'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRuledLines((r) => !r)}
                    className={`min-h-[40px] px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      isRuledLines ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A]/50' : 'border-current/15'
                    }`}
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                    <span>{t('الأسطر الفاصلة', 'Ruled Lines')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleTajweed}
                    className={`min-h-[40px] px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      isTajweedActive ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A]/50' : 'border-current/15'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('ألوان التجويد', 'Tajweed Colors')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveDockSheet('none');
                      onOpenTajweedLegend();
                    }}
                    className="min-h-[40px] px-3 rounded-xl border border-current/15 hover:bg-current/5 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t('دليل التجويد', 'Tajweed Key')}</span>
                  </button>

                  {readerMode === 'surah' ? (
                    <button
                      type="button"
                      onClick={() => setIsDualPage((d) => !d)}
                      className={`hidden md:flex min-h-[40px] px-3 rounded-xl border font-semibold items-center justify-center gap-1.5 cursor-pointer ${
                        isDualPage ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A]/50' : 'border-current/15'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>{isDualPage ? t('صفحتان', 'Two Pages') : t('صفحة واحدة', 'Single Page')}</span>
                    </button>
                  ) : (
                    onToggleAppTheme && (
                      <button
                        type="button"
                        onClick={onToggleAppTheme}
                        className="min-h-[40px] px-3 rounded-xl border border-current/15 hover:bg-current/5 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {appTheme === 'dark' ? (
                          <Sun className="w-3.5 h-3.5 text-[#D9B45A]" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-[#1F3A6E]" />
                        )}
                        <span>{appTheme === 'dark' ? t('نهاري', 'Day') : t('ليلي', 'Night')}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Section C: Bayan Sections Navigation */}
              {onNavigateView && (
                <div className="space-y-2 pt-2 border-t border-current/12 text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-70">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{t('أقسام بيان القرآنية', 'Bayan Sections')}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'translations' as const, label: t('ترجمات المعاني', 'Translations'), icon: Globe },
                      { id: 'ruqyah' as const, label: t('الرقية الشرعية', 'Ruqyah'), icon: ShieldCheck },
                      { id: 'khatma' as const, label: t('الختمات', 'Khatmas'), icon: Sparkles },
                      { id: 'tajweed' as const, label: t('موسوعة التجويد', 'Tajweed Guide'), icon: HelpCircle },
                      { id: 'kids' as const, label: t('تحفيظ الصغار', 'Kids Hifz'), icon: Sprout },
                      { id: 'mood' as const, label: t('القرآن حياتي', 'Quran & Mood'), icon: Heart },
                      { id: 'analytics' as const, label: t('سجل الختمات', 'Reading Log'), icon: Calendar },
                      { id: 'journal' as const, label: t('مفكرتي', 'My Notes'), icon: PenLine },
                    ].map((sec) => {
                      const Icon = sec.icon;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setActiveDockSheet('none');
                            onNavigateView(sec.id);
                          }}
                          className="min-h-[42px] px-2.5 py-2 rounded-xl border border-current/15 hover:bg-current/5 font-semibold flex items-center gap-2 cursor-pointer text-start"
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
                          <span className="truncate">{sec.label}</span>
                        </button>
                      );
                    })}
                    {onOpenKhatmaPlanner && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDockSheet('none');
                          onOpenKhatmaPlanner();
                        }}
                        className="min-h-[42px] px-2.5 py-2 rounded-xl border border-current/15 hover:bg-current/5 font-semibold flex items-center gap-2 cursor-pointer text-start"
                      >
                        <BookOpen className={`w-4 h-4 shrink-0 ${isLightPaper ? 'text-[#1F3A6E]' : 'text-[#D9B45A]'}`} />
                        <span className="truncate">{t('مخطط الورد', 'Daily Wird')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== AYAH CONTEXTUAL QUICK-ACTION SHEET (on ﴿١٤﴾ tap or Long-Press) ===================== */}
      {quickActionTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            onClick={() => setQuickActionTarget(null)}
          />
          <div
            role="dialog"
            aria-label={t(`خيارات الآية ${quickActionTarget.ayah.numberInSurah}`, `Ayah ${quickActionTarget.ayah.numberInSurah} options`)}
            className={`fixed left-1/2 -translate-x-1/2 z-50 w-[min(94vw,460px)] p-3.5 rounded-3xl border backdrop-blur-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150 ${glassSheetClasses} ${
              isChromeHidden ? 'bottom-6' : 'bottom-[5.45rem]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/12">
              <div className="min-w-0">
                <div className={`text-xs font-bold tabular-nums ${isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'}`}>
                  {t(
                    `سورة ${quickActionTarget.surahName} · الآية ${formatLocalizedDigits(quickActionTarget.ayah.numberInSurah, lang)}`,
                    `${resolveSurahTitle(quickActionTarget.surahNumber, quickActionTarget.surahName)} · Ayah ${quickActionTarget.ayah.numberInSurah}`
                  )}
                </div>
                <p dir="rtl" lang="ar" className="font-quran text-base truncate mt-0.5 text-right">
                  {quickActionTarget.ayah.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickActionTarget(null)}
                aria-label={t('إغلاق شريط الآية', 'Close Ayah menu')}
                className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-current/5 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {onAyahAudioSelect && (
                <button
                  type="button"
                  onClick={() => {
                    onAyahAudioSelect(quickActionTarget.ayah.numberInSurah, quickActionTarget.surahNumber);
                    setManualHighlight(null);
                    setQuickActionTarget(null);
                  }}
                  className="min-h-[44px] py-2 px-2.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Volume2 className="w-4 h-4 text-[#D9B45A] shrink-0" />
                  <span>{t('استماع', 'Listen')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const target = quickActionTarget;
                  setQuickActionTarget(null);
                  onOpenTadabburModal(target.ayah, target.surahNumber, target.surahName);
                }}
                className="min-h-[44px] py-2 px-2.5 rounded-xl border border-current/20 hover:bg-current/5 font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <PenLine className={`w-4 h-4 shrink-0 ${isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'}`} />
                <span>{t('تفسير وتدبّر', 'Tafsir & Notes')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleToggleBookmark(quickActionTarget.ayah.numberInSurah, quickActionTarget.surahNumber);
                }}
                className={`min-h-[44px] py-2 px-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  bookmarksBySurah[quickActionTarget.surahNumber] === quickActionTarget.ayah.numberInSurah
                    ? 'bg-[#D9B45A]/20 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A]'
                    : 'border-current/20 hover:bg-current/5'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 shrink-0 ${
                    bookmarksBySurah[quickActionTarget.surahNumber] === quickActionTarget.ayah.numberInSurah
                      ? 'fill-current'
                      : ''
                  }`}
                />
                <span>
                  {bookmarksBySurah[quickActionTarget.surahNumber] === quickActionTarget.ayah.numberInSurah
                    ? t('محفوظة', 'Saved')
                    : t('علامة وقف', 'Bookmark')}
                </span>
              </button>

              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={() => {
                    const target = quickActionTarget;
                    setQuickActionTarget(null);
                    onOpenShareModal(target.ayah, target.surahNumber, target.surahName);
                  }}
                  className="min-h-[44px] py-2 px-2.5 rounded-xl border border-current/20 hover:bg-current/5 font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Share2 className={`w-4 h-4 shrink-0 ${isLightPaper ? 'text-[#8A6418]' : 'text-[#D9B45A]'}`} />
                  <span>{t('بطاقة', 'Share')}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
