import React, { useState, useEffect, useRef, lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import {
  BookOpen, Sparkles, Award, Heart, Calendar, HelpCircle,
  PenLine, Search, ChevronDown,
  ShieldCheck, Flame, Maximize2,
  Menu, X, AlertCircle, RefreshCw, AlertTriangle, Sprout,
  Sun, Moon, Globe
} from 'lucide-react';
import { SURAHS_LIST } from './data/quranMetadata';
import {
  SurahData,
  Ayah,
  getSurahData,
  searchQuranAyahs,
  QuranSearchMatch,
  cleanupLegacySurahLocalStorage
} from './data/quranService';
import { recordAyahReadActivity, recordPageProgress } from './data/faithAnalyticsService';
import { QuranReader } from './components/QuranReader';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AmbientAudioBar } from './components/AmbientAudioBar';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import type { JournalNotePayload } from './components/TadabburModal';
import type { MemorizationRepeatTarget, PlaybackCycleEvent } from './components/MemorizationMode';
import { setPendingMushafPageTarget } from './utils/memorizationHelpers';
import type { JournalNote } from './components/QuranJournal';
import { Reciter, RECITERS_LIST } from './data/reciters';
import { safeLocalStorage } from './utils/safeStorage';
import { idbGet, idbSet } from './utils/quranIndexedDb';
import { BayanUserBackup, READER_PREFS_KEY, sanitizeJournalNotesList } from './utils/userBackup';
import { toArabicIndic } from './components/khatma/KhatmaRing';
import {
  getDailyWirdSummary,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  PERSONAL_KHATMA_EVENT,
  recordMushafPageReadInWird,
  savePersonalKhatmaPlan,
} from './utils/personalKhatma';
import {
  APP_THEME_EVENT,
  AppTheme,
  applyAppTheme,
  LastReadingPosition,
  loadAppTheme,
  loadLastReadingPosition,
  saveAppTheme,
  saveLastReadingPosition,
} from './utils/appTheme';

const TadabburModal = lazy(() => import('./components/TadabburModal').then((m) => ({ default: m.TadabburModal })));
const SocialShareModal = lazy(() => import('./components/SocialShareModal').then((m) => ({ default: m.SocialShareModal })));
const TajweedLegendModal = lazy(() => import('./components/TajweedLegendModal').then((m) => ({ default: m.TajweedLegendModal })));
const KhatmaPlannerModal = lazy(() => import('./components/KhatmaPlannerModal').then((m) => ({ default: m.KhatmaPlannerModal })));

const MemorizationMode = lazy(() => import('./components/MemorizationMode').then((m) => ({ default: m.MemorizationMode })));
const FaithAnalytics = lazy(() => import('./components/FaithAnalytics').then((m) => ({ default: m.FaithAnalytics })));
const CollectiveKhatma = lazy(() => import('./components/CollectiveKhatma').then((m) => ({ default: m.CollectiveKhatma })));
const TajweedEncyclopedia = lazy(() => import('./components/TajweedEncyclopedia').then((m) => ({ default: m.TajweedEncyclopedia })));
const MoodVersesExplorer = lazy(() => import('./components/MoodVersesExplorer').then((m) => ({ default: m.MoodVersesExplorer })));
const QuranJournal = lazy(() => import('./components/QuranJournal').then((m) => ({ default: m.QuranJournal })));
const FlutterArchitectureDoc = lazy(() => import('./components/FlutterArchitectureDoc').then((m) => ({ default: m.FlutterArchitectureDoc })));
const RuqyahSection = lazy(() => import('./components/RuqyahSection').then((m) => ({ default: m.RuqyahSection })));
const KidsHifzSection = lazy(() => import('./components/KidsHifzSection').then((m) => ({ default: m.KidsHifzSection })));
const TranslationsSection = lazy(() => import('./components/TranslationsSection').then((m) => ({ default: m.TranslationsSection })));

const SectionLoadingFallback: React.FC = () => (
  <div className="p-16 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/60 border border-[#D9B45A]/25 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
    <div className="w-10 h-10 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
    <p className="text-xs text-[#5C5549] dark:text-slate-300 font-medium">جارٍ تجهيز القسم…</p>
  </div>
);

interface LazySectionBoundaryProps {
  resetKey: string;
  children: ReactNode;
}

interface LazySectionBoundaryState {
  hasError: boolean;
}

class LazySectionBoundary extends Component<LazySectionBoundaryProps, LazySectionBoundaryState> {
  state: LazySectionBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazySectionBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: LazySectionBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Section chunk load error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto my-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">تعذر فتح هذا القسم</h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
              قد يكون السبب انقطاع الاتصال أثناء تحميل ملفات القسم لأول مرة.
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="min-h-[42px] py-2.5 px-6 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/45 text-[#F6EFDD] font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Exact Medina Mus'haf starting (surahNumber, ayahNumber) for all 30 Ajza
const JUZ_START_COORDINATES: Record<number, { surah: number; ayah: number }> = {
  1: { surah: 1, ayah: 1 },
  2: { surah: 2, ayah: 142 },
  3: { surah: 2, ayah: 253 },
  4: { surah: 3, ayah: 93 },
  5: { surah: 4, ayah: 24 },
  6: { surah: 4, ayah: 148 },
  7: { surah: 5, ayah: 82 },
  8: { surah: 6, ayah: 111 },
  9: { surah: 7, ayah: 88 },
  10: { surah: 8, ayah: 41 },
  11: { surah: 9, ayah: 93 },
  12: { surah: 11, ayah: 6 },
  13: { surah: 12, ayah: 53 },
  14: { surah: 15, ayah: 1 },
  15: { surah: 17, ayah: 1 },
  16: { surah: 18, ayah: 75 },
  17: { surah: 21, ayah: 1 },
  18: { surah: 23, ayah: 1 },
  19: { surah: 25, ayah: 21 },
  20: { surah: 27, ayah: 56 },
  21: { surah: 29, ayah: 46 },
  22: { surah: 33, ayah: 31 },
  23: { surah: 36, ayah: 28 },
  24: { surah: 39, ayah: 32 },
  25: { surah: 41, ayah: 47 },
  26: { surah: 46, ayah: 1 },
  27: { surah: 51, ayah: 31 },
  28: { surah: 58, ayah: 1 },
  29: { surah: 67, ayah: 1 },
  30: { surah: 78, ayah: 1 },
};

type ActiveView =
  | 'mushaf'
  | 'memorization'
  | 'kids'
  | 'translations'
  | 'ruqyah'
  | 'mood'
  | 'analytics'
  | 'khatma'
  | 'tajweed'
  | 'journal'
  | 'flutter-arch';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as ActiveView;
      if (tab && ['mushaf', 'memorization', 'kids', 'translations', 'ruqyah', 'mood', 'analytics', 'khatma', 'tajweed', 'journal', 'flutter-arch'].includes(tab)) {
        return tab;
      }
    }
    return 'mushaf';
  });
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rawSurah = Number(params.get('surah'));
      if (Number.isInteger(rawSurah) && rawSurah >= 1 && rawSurah <= 114) {
        return rawSurah;
      }
    }
    return 1;
  });
  const [surahData, setSurahData] = useState<SurahData | null>(null);
  const [activeAyahNumber, setActiveAyahNumber] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rawAyah = Number(params.get('ayah'));
      if (Number.isInteger(rawAyah) && rawAyah >= 1) {
        return rawAyah;
      }
    }
    return 1;
  });
  const [isLoadingSurah, setIsLoadingSurah] = useState<boolean>(true);

  // Audio & Tajweed state (persisted in READER_PREFS_KEY)
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(() => {
    const prefs = safeLocalStorage.getJSON<{ selectedReciterId?: string }>(READER_PREFS_KEY, {});
    return RECITERS_LIST.find((r) => r.id === prefs?.selectedReciterId) || RECITERS_LIST[0];
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playTriggerNonce, setPlayTriggerNonce] = useState<number>(0);
  const [memorizationRepeatTarget, setMemorizationRepeatTarget] = useState<MemorizationRepeatTarget>(1);
  const [memorizationCurrentRepeat, setMemorizationCurrentRepeat] = useState<number>(1);
  const [memorizationPlaybackCycle, setMemorizationPlaybackCycle] = useState<PlaybackCycleEvent | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(1);
  const [isTajweedActive, setIsTajweedActive] = useState<boolean>(() => {
    const prefs = safeLocalStorage.getJSON<{ isTajweedActive?: boolean }>(READER_PREFS_KEY, {});
    return typeof prefs?.isTajweedActive === 'boolean' ? prefs.isTajweedActive : true;
  });
  const [prefsReloadNonce, setPrefsReloadNonce] = useState<number>(0);
  const [isSmartScrollActive, setIsSmartScrollActive] = useState<boolean>(true);
  const [isFullScreenReading, setIsFullScreenReading] = useState<boolean>(false);
  const [isAudioBarVisible, setIsAudioBarVisible] = useState<boolean>(true);
  const [isMushafAudioSheetOpen, setIsMushafAudioSheetOpen] = useState<boolean>(false);
  const audioBarBeforeFullScreenRef = useRef<boolean>(true);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [isDesktopMoreOpen, setIsDesktopMoreOpen] = useState<boolean>(false);
  const desktopMoreRef = useRef<HTMLDivElement | null>(null);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => loadAppTheme());
  const [savedResumePos, setSavedResumePos] = useState<LastReadingPosition | null>(() => loadLastReadingPosition());

  // Modals state
  const [tadabburAyah, setTadabburAyah] = useState<Ayah | null>(null);
  const [tadabburSurahContext, setTadabburSurahContext] = useState<{ number: number; name: string } | null>(null);
  const [shareAyah, setShareAyah] = useState<Ayah | null>(null);
  const [shareSurahName, setShareSurahName] = useState<string | null>(null);
  const [shareSurahNumber, setShareSurahNumber] = useState<number | null>(null);
  const [shareReflectionContext, setShareReflectionContext] = useState<{
    text: string;
    dir: 'rtl' | 'ltr';
    label: string;
  } | null>(null);
  const [isTajweedLegendOpen, setIsTajweedLegendOpen] = useState<boolean>(false);
  const [isKhatmaPlannerOpen, setIsKhatmaPlannerOpen] = useState<boolean>(false);
  const [personalKhatmaPlan, setPersonalKhatmaPlan] = useState<KhatmaPlan | null>(() => loadPersonalKhatmaPlan());
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'surahs' | 'ayahs'>('surahs');
  const [surahSearchTerm, setSurahSearchTerm] = useState<string>('');
  const [ayahSearchQuery, setAyahSearchQuery] = useState<string>('');
  const [ayahSearchResults, setAyahSearchResults] = useState<QuranSearchMatch[]>([]);
  const [isSearchingAyahs, setIsSearchingAyahs] = useState<boolean>(false);

  // Journal notes stored locally (no hardcoded fake notes) + hydrated with IndexedDB
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>(() => {
    return sanitizeJournalNotesList(safeLocalStorage.getJSON<unknown[]>('bayan_journal_notes', []));
  });

  // Pending target ayah when switching surah (stored in ref so clearing it never retriggers load effect)
  const pendingTargetAyahRef = useRef<number | null>(
    typeof window !== 'undefined'
      ? (() => {
          const rawAyah = Number(new URLSearchParams(window.location.search).get('ayah'));
          return Number.isInteger(rawAyah) && rawAyah >= 1 ? rawAyah : null;
        })()
      : null
  );
  const [surahReloadTrigger, setSurahReloadTrigger] = useState<number>(0);

  const [surahError, setSurahError] = useState<string | null>(null);
  const [plannerToast, setPlannerToast] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Sync theme, bookmarks, khatma plan, and storage events
  useEffect(() => {
    cleanupLegacySurahLocalStorage();
    applyAppTheme(appTheme);

    idbGet<unknown[]>('user_data', 'bayan_journal_notes')
      .then((idbNotes) => {
        const sanitized = sanitizeJournalNotesList(idbNotes);
        if (sanitized.length > 0) {
          setJournalNotes((prev) => (prev.length === 0 ? sanitized : prev));
        }
      })
      .catch(() => {});

    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setStorageWarning(detail?.message || 'تعذر حفظ التغييرات محلياً: قد تكون سعة التخزين ممتلئة.');
    };
    const handleKhatmaSync = () => {
      setPersonalKhatmaPlan(loadPersonalKhatmaPlan());
    };
    const handleThemeEvent = (e: Event) => {
      const next = (e as CustomEvent<AppTheme>).detail;
      if (next === 'light' || next === 'dark') {
        setAppTheme(next);
      }
    };
    window.addEventListener('bayan:storage-error', handleStorageError);
    window.addEventListener(PERSONAL_KHATMA_EVENT, handleKhatmaSync);
    window.addEventListener(APP_THEME_EVENT, handleThemeEvent);
    window.addEventListener('storage', handleKhatmaSync);
    return () => {
      window.removeEventListener('bayan:storage-error', handleStorageError);
      window.removeEventListener(PERSONAL_KHATMA_EVENT, handleKhatmaSync);
      window.removeEventListener(APP_THEME_EVENT, handleThemeEvent);
      window.removeEventListener('storage', handleKhatmaSync);
    };
  }, []);

  // Persist Tajweed toggle and selected Reciter cleanly
  useEffect(() => {
    const prev = safeLocalStorage.getJSON<Record<string, unknown>>(READER_PREFS_KEY, {});
    safeLocalStorage.setJSON(READER_PREFS_KEY, {
      ...prev,
      isTajweedActive,
      selectedReciterId: selectedReciter.id,
    });
  }, [isTajweedActive, selectedReciter.id]);

  // Pause main Mushaf audio bar when switching into Kids Hifz view
  useEffect(() => {
    if (activeView === 'kids') {
      setIsPlayingAudio(false);
    }
  }, [activeView]);

  // Close Surah Picker on Escape key
  useEffect(() => {
    if (!isSurahPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSurahPickerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSurahPickerOpen]);

  // Close Desktop "More" menu on Escape or outside click
  useEffect(() => {
    if (!isDesktopMoreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDesktopMoreOpen(false);
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) {
        setIsDesktopMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isDesktopMoreOpen]);

  // Debounced Full-Quran Ayah Search when Ayah search tab is active
  useEffect(() => {
    if (!isSurahPickerOpen || pickerTab !== 'ayahs') return;
    const q = ayahSearchQuery.trim();
    if (q.length < 2) {
      setAyahSearchResults([]);
      setIsSearchingAyahs(false);
      return;
    }

    let cancelled = false;
    setIsSearchingAyahs(true);
    const timer = setTimeout(() => {
      searchQuranAyahs(q)
        .then((matches) => {
          if (!cancelled) {
            setAyahSearchResults(matches);
            setIsSearchingAyahs(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAyahSearchResults([]);
            setIsSearchingAyahs(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isSurahPickerOpen, pickerTab, ayahSearchQuery]);

  // Load Surah data when surah number or retry counter changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSurah(true);
    setSurahError(null);

    getSurahData(currentSurahNumber)
      .then((data) => {
        if (!isCancelled) {
          setSurahData(data);
          const requestedAyah = pendingTargetAyahRef.current;
          pendingTargetAyahRef.current = null;
          const resolvedAyah = requestedAyah && requestedAyah >= 1 && requestedAyah <= data.meta.numberOfAyahs
            ? requestedAyah
            : 1;
          setActiveAyahNumber(resolvedAyah);
          const matchedAyah = data.ayahs.find((a) => a.numberInSurah === resolvedAyah);
          if (matchedAyah?.page) {
            recordPageProgress(matchedAyah.page);
          }
          setIsLoadingSurah(false);
          setSurahError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed loading surah:', err);
          setIsLoadingSurah(false);
          setSurahError(err.message || 'تعذر تحميل السورة الكريمة من الخادم');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentSurahNumber, surahReloadTrigger]);

  // Record page progress & last reading position whenever active ayah shifts cleanly beyond 1:1
  useEffect(() => {
    if (!surahData) return;
    const currentAyah = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
    if (currentAyah?.page) {
      recordPageProgress(currentAyah.page);
    }
    if (surahData.meta.number !== 1 || activeAyahNumber !== 1) {
      const nextPos: LastReadingPosition = {
        surahNumber: surahData.meta.number,
        surahName: surahData.meta.name,
        ayahNumber: activeAyahNumber,
        page: currentAyah?.page,
        updatedAt: Date.now(),
      };
      saveLastReadingPosition(nextPos);
      setSavedResumePos(nextPos);
    }
  }, [surahData, activeAyahNumber]);

  // Track ayahs interacted with during this session for honest reading telemetry
  const sessionTrackedAyahsRef = useRef<Set<number>>(new Set());
  const trackAyahInteraction = (overallAyahId: number, durationSec = 0) => {
    const mins = durationSec > 0 ? Math.max(0.1, durationSec / 60) : 0;
    if (!sessionTrackedAyahsRef.current.has(overallAyahId)) {
      sessionTrackedAyahsRef.current.add(overallAyahId);
      recordAyahReadActivity(1, mins);
    } else if (mins > 0) {
      recordAyahReadActivity(0, mins);
    }
  };

  // Handle saving journal note with direct self-contained payload (localStorage + IndexedDB)
  const handleSaveJournalNote = (payload: JournalNotePayload) => {
    const updated: JournalNote[] = [
      {
        ayahId: payload.ayahId,
        surahNumber: payload.surahNumber,
        surahName: payload.surahName,
        ayahNumber: payload.ayahNumber,
        text: payload.note,
        date: payload.date
      },
      ...journalNotes.filter(n => n.ayahId !== payload.ayahId)
    ];
    setJournalNotes(updated);
    safeLocalStorage.setJSON('bayan_journal_notes', updated);
    idbSet('user_data', 'bayan_journal_notes', updated).catch(() => {});
  };

  const handleDeleteJournalNote = (ayahId: number) => {
    const updated = journalNotes.filter(n => n.ayahId !== ayahId);
    setJournalNotes(updated);
    safeLocalStorage.setJSON('bayan_journal_notes', updated);
    idbSet('user_data', 'bayan_journal_notes', updated).catch(() => {});
  };

  const handleUpdateJournalNote = (ayahId: number, newText: string) => {
    const updated = journalNotes.map((n) =>
      n.ayahId === ayahId
        ? { ...n, text: newText, date: new Date().toLocaleDateString('ar-SA') }
        : n
    );
    setJournalNotes(updated);
    safeLocalStorage.setJSON('bayan_journal_notes', updated);
    idbSet('user_data', 'bayan_journal_notes', updated).catch(() => {});
  };

  const handleBackupRestored = (backup: BayanUserBackup) => {
    setJournalNotes(backup.journalNotes);
    if (backup.readerPrefs) {
      if (typeof backup.readerPrefs.isTajweedActive === 'boolean') {
        setIsTajweedActive(backup.readerPrefs.isTajweedActive);
      }
      if (typeof backup.readerPrefs.selectedReciterId === 'string') {
        const found = RECITERS_LIST.find((r) => r.id === backup.readerPrefs?.selectedReciterId);
        if (found) setSelectedReciter(found);
      }
      setPrefsReloadNonce((n) => n + 1);
    }
  };

  const handleNavigateToAyah = (surahNum: number, ayahNum: number) => {
    if (surahNum === currentSurahNumber) {
      setActiveAyahNumber(ayahNum);
    } else {
      pendingTargetAyahRef.current = ayahNum;
      setCurrentSurahNumber(surahNum);
    }
    setActiveView('mushaf');
  };

  const handleNavigateToJuz = (juzNumber: number) => {
    const coord = JUZ_START_COORDINATES[juzNumber] || { surah: 1, ayah: 1 };
    handleNavigateToAyah(coord.surah, coord.ayah);
  };

  const handlePlayAyahAudio = (ayahNum: number, surahNum?: number) => {
    if (surahNum && surahNum !== currentSurahNumber) {
      pendingTargetAyahRef.current = ayahNum;
      setCurrentSurahNumber(surahNum);
    } else {
      setActiveAyahNumber(ayahNum);
    }
    setMemorizationCurrentRepeat(1);
    setPlayTriggerNonce((n) => n + 1);
    setIsPlayingAudio(true);
    setIsAudioBarVisible(true);
  };

  const handleToggleFullScreen = () => {
    if (!isFullScreenReading) {
      audioBarBeforeFullScreenRef.current = isAudioBarVisible;
      if (!isPlayingAudio) {
        setIsAudioBarVisible(false);
      }
      setIsFullScreenReading(true);
    } else {
      setIsFullScreenReading(false);
      setIsAudioBarVisible(isPlayingAudio ? true : audioBarBeforeFullScreenRef.current);
    }
  };

  const filteredSurahs = SURAHS_LIST.filter(s =>
    s.name.includes(surahSearchTerm) ||
    s.englishName.toLowerCase().includes(surahSearchTerm.toLowerCase()) ||
    String(s.number) === surahSearchTerm ||
    String(s.juzNumber) === surahSearchTerm
  );

  const handleToggleAppTheme = () => {
    const next: AppTheme = appTheme === 'dark' ? 'light' : 'dark';
    setAppTheme(next);
    saveAppTheme(next);
  };

  return (
    <div className="min-h-screen bg-[#F6EFDD] dark:bg-[#10161f] text-[#1B1A17] dark:text-[#E9E3D3] flex flex-col font-sans selection:bg-[#D9B45A]/30 selection:text-[#1B1A17] dark:selection:text-[#F6EFDD] transition-colors duration-200">
      <OfflineIndicator />

      {/* Visible Storage / Quota Failure Warning Banner (F4) */}
      {storageWarning && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/95 border-b border-rose-500/40 px-4 py-2 text-xs text-rose-800 dark:text-rose-100 flex items-center justify-between gap-3 z-50"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{storageWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setStorageWarning(null)}
            aria-label="إغلاق التنبيه"
            className="p-1 rounded-lg hover:bg-rose-200/60 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Main Navigation Bar (Hidden in full screen reading, and hidden on mobile when Mushaf owns the viewport) */}
      {!isFullScreenReading && (
        <header className={`sticky top-0 z-30 bayan-header-glass backdrop-blur-md transition-colors ${activeView === 'mushaf' ? 'hidden lg:block' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-5">
            {/* Zone 1: Brand Wordmark */}
            <button
              type="button"
              onClick={() => {
                setActiveView('mushaf');
                setIsDesktopMoreOpen(false);
              }}
              className="flex items-center gap-2.5 cursor-pointer group whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] rounded-xl p-1 -mr-1"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1F3A6E] to-[#2E5499] border border-[#D9B45A]/45 flex items-center justify-center text-[#D9B45A] shadow-md font-bold text-lg font-kufi group-hover:scale-105 transition-transform">
                ب
              </span>
              <span className="font-bold text-lg text-[#1B1A17] dark:text-[#F6EFDD] font-kufi tracking-tight">
                بَيَان
              </span>
            </button>

            {/* Zone 2: Primary Desktop Navigation + Organized 2-Group Overflow Menu */}
            <nav
              aria-label="التنقل الرئيسي"
              className="hidden lg:flex items-center gap-1 h-full"
            >
              {[
                { id: 'mushaf', label: 'المصحف الشريف', icon: BookOpen },
                { id: 'memorization', label: 'حلقة الحفظ', icon: Award },
                { id: 'ruqyah', label: 'الرقية الشرعية', icon: ShieldCheck },
                { id: 'khatma', label: 'الختمات', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveView(tab.id as ActiveView);
                      setIsDesktopMoreOpen(false);
                    }}
                    className={`relative h-full px-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                      isActive
                        ? 'text-[#8A6418] dark:text-[#D9B45A] font-bold'
                        : 'text-[#4A4338] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-[#F6EFDD]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#8A6418] dark:bg-[#D9B45A] rounded-full" />
                    )}
                  </button>
                );
              })}

              {/* Secondary Destinations Dropdown ("المزيد") — 2 Logical Groups */}
              <div ref={desktopMoreRef} className="relative h-full flex items-center">
                {(() => {
                  const learningTabs: { id: ActiveView; label: string; sub: string; icon: typeof Heart }[] = [
                    { id: 'translations', label: 'ترجمات المعاني', sub: 'السويدية والإنجليزية ولغات أخرى', icon: Globe },
                    { id: 'tajweed', label: 'موسوعة التجويد', sub: 'أحكام التلاوة والأمثلة والتطبيق', icon: HelpCircle },
                    { id: 'kids', label: 'تحفيظ الصغار', sub: 'تلقين صوتي ونجوم للأطفال', icon: Sprout },
                    { id: 'mood', label: 'القرآن حياتي', sub: 'آيات بحسب المشاعر والحال', icon: Heart },
                  ];
                  const trackingTabs: { id: ActiveView; label: string; sub: string; icon: typeof Heart }[] = [
                    { id: 'analytics', label: 'سجل الختمات', sub: 'إحصاءات القراءة والنسخ الاحتياطي', icon: Calendar },
                    { id: 'journal', label: 'مفكرتي والعلامات', sub: 'الخواطر وعلامات الوقف المحفوظة', icon: PenLine },
                  ];
                  const allSecondary = [...learningTabs, ...trackingTabs];
                  const activeSecondary = allSecondary.find((t) => t.id === activeView);
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsDesktopMoreOpen((o) => !o)}
                        aria-expanded={isDesktopMoreOpen}
                        aria-haspopup="menu"
                        className={`relative h-full px-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                          activeSecondary
                            ? 'text-[#8A6418] dark:text-[#D9B45A] font-bold'
                            : isDesktopMoreOpen
                            ? 'text-[#1B1A17] dark:text-[#F6EFDD]'
                            : 'text-[#4A4338] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-[#F6EFDD]'
                        }`}
                      >
                        <span>{activeSecondary ? activeSecondary.label : 'المزيد'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            isDesktopMoreOpen ? 'rotate-180' : ''
                          }`}
                        />
                        {activeSecondary && (
                          <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#8A6418] dark:bg-[#D9B45A] rounded-full" />
                        )}
                      </button>

                      {isDesktopMoreOpen && (
                        <div
                          role="menu"
                          className="absolute top-full end-0 mt-1.5 w-72 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 shadow-2xl p-2 z-50 space-y-2"
                        >
                          <div className="space-y-0.5">
                            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold text-[#8A6418] dark:text-[#D9B45A]/90">
                              التعلّم والتدبّر
                            </div>
                            {learningTabs.map((item) => {
                              const Icon = item.icon;
                              const isSelected = activeView === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setActiveView(item.id);
                                    setIsDesktopMoreOpen(false);
                                  }}
                                  className={`w-full text-right p-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 text-[#F6EFDD] dark:text-[#D9B45A] border border-[#648CD4]/45'
                                      : 'text-[#1B1A17] dark:text-[#E9E3D3] hover:bg-[#EFE6D1] dark:hover:bg-slate-800/80 border border-transparent'
                                  }`}
                                >
                                  <span
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-[#D9B45A]/20 text-[#D9B45A]'
                                        : 'bg-white dark:bg-slate-950 border border-[#D9B45A]/20 dark:border-slate-800 text-[#1F3A6E] dark:text-slate-300'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-xs font-bold">{item.label}</span>
                                    <span className={`block text-[10px] truncate ${isSelected ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>
                                      {item.sub}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="border-t border-[#D9B45A]/20 dark:border-slate-800 pt-1.5 space-y-0.5">
                            <div className="px-2.5 pt-0.5 pb-0.5 text-[10px] font-bold text-[#1F3A6E] dark:text-[#648CD4]">
                              المتابعة الشخصية
                            </div>
                            {trackingTabs.map((item) => {
                              const Icon = item.icon;
                              const isSelected = activeView === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setActiveView(item.id);
                                    setIsDesktopMoreOpen(false);
                                  }}
                                  className={`w-full text-right p-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 text-[#F6EFDD] dark:text-[#D9B45A] border border-[#648CD4]/45'
                                      : 'text-[#1B1A17] dark:text-[#E9E3D3] hover:bg-[#EFE6D1] dark:hover:bg-slate-800/80 border border-transparent'
                                  }`}
                                >
                                  <span
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-[#D9B45A]/20 text-[#D9B45A]'
                                        : 'bg-white dark:bg-slate-950 border border-[#D9B45A]/20 dark:border-slate-800 text-[#1F3A6E] dark:text-slate-300'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-xs font-bold">{item.label}</span>
                                    <span className={`block text-[10px] truncate ${isSelected ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>
                                      {item.sub}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </nav>

            {/* Zone 3: Utilities, Day/Night Theme Toggle & Daily Wird */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <PWAInstallButton />
              <AmbientAudioBar />

              <button
                type="button"
                onClick={handleToggleAppTheme}
                aria-label={appTheme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                title={appTheme === 'dark' ? 'الوضع النهاري الدافئ' : 'الوضع الليلي الهادي'}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center gap-1.5 px-2.5 rounded-xl bg-white/90 dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]"
              >
                {appTheme === 'dark' ? (
                  <Sun className="w-4 h-4 text-[#D9B45A] shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-[#1F3A6E] shrink-0" />
                )}
                <span className="hidden xl:inline">{appTheme === 'dark' ? 'نهاري' : 'ليلي'}</span>
              </button>

              {(() => {
                const wirdSummary = getDailyWirdSummary(personalKhatmaPlan);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalKhatmaPlan(loadPersonalKhatmaPlan());
                      setIsKhatmaPlannerOpen(true);
                    }}
                    className={`min-h-[38px] flex items-center gap-1.5 py-2 px-3 sm:px-3.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 shadow-sm transition-colors cursor-pointer tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
                      wirdSummary.hasPlan && wirdSummary.isTodayComplete
                        ? 'bg-emerald-700 dark:bg-emerald-950/80 hover:bg-emerald-800 dark:hover:bg-emerald-900 border-emerald-500/50 text-white dark:text-emerald-200'
                        : 'bg-[#1F3A6E] hover:bg-[#2E5499] border-[#648CD4]/45 text-[#F6EFDD]'
                    }`}
                    title={
                      wirdSummary.hasPlan
                        ? `وِرد اليوم: ${toArabicIndic(wirdSummary.todayPagesRead)} من ${toArabicIndic(wirdSummary.dailyTargetPages)} صفحة`
                        : 'مخطط الورد والختمة الذكية'
                    }
                  >
                    <Flame className={`w-3.5 h-3.5 shrink-0 ${wirdSummary.hasPlan && wirdSummary.isTodayComplete ? 'text-emerald-300 dark:text-emerald-400' : 'text-[#D9B45A]'}`} />
                    {wirdSummary.hasPlan ? (
                      <>
                        <span className="sm:hidden">
                          {toArabicIndic(wirdSummary.todayPagesRead)}/{toArabicIndic(wirdSummary.dailyTargetPages)}
                        </span>
                        <span className="hidden sm:inline">
                          {wirdSummary.isTodayComplete
                            ? '✓ اكتمل الورد'
                            : `الورد (${toArabicIndic(wirdSummary.todayPagesRead)}/${toArabicIndic(wirdSummary.dailyTargetPages)})`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="sm:hidden">الورد</span>
                        <span className="hidden sm:inline">مخطط الورد</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </header>
      )}

      {/* Main Viewport Content */}
      <main className={`flex-1 w-full mx-auto transition-all ${
        isFullScreenReading
          ? 'p-0 max-w-full m-0'
          : activeView === 'mushaf'
          ? 'p-0 lg:max-w-7xl lg:px-5 lg:py-4 lg:pb-24'
          : isAudioBarVisible
          ? 'max-w-7xl p-3 sm:p-5 pb-32 md:pb-24 lg:pb-20'
          : 'max-w-7xl p-3 sm:p-5 pb-24 lg:pb-12'
      }`}>
        {activeView === 'mushaf' && (
          <div className="relative">

            {isLoadingSurah && surahData && (
              <div className="mb-2 flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-[#FBF7EE] dark:bg-[#142038] border border-[#D9B45A]/30 text-xs text-[#8A6418] dark:text-[#D9B45A] max-w-fit mx-auto">
                <div className="w-3 h-3 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                <span>جارٍ تحميل السورة الكريمة…</span>
              </div>
            )}

            {isLoadingSurah && !surahData ? (
              <div className="p-16 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/60 border border-[#D9B45A]/25 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                <p className="text-xs text-[#5C5549] dark:text-slate-300 font-medium">جارٍ تحميل السورة بالرسم العثماني المعتمد…</p>
              </div>
            ) : surahError && !surahData ? (
              <div className="p-10 text-center rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto my-12 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">تعذر تحميل السورة الكريمة</h3>
                  <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">{surahError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSurahReloadTrigger(c => c + 1)}
                  className="min-h-[42px] py-2.5 px-6 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/45 text-[#F6EFDD] font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة الآن</span>
                </button>
              </div>
            ) : surahData ? (
              <QuranReader
                surahData={surahData}
                activeAyahNumber={activeAyahNumber}
                onSelectAyah={(a, overrideSurahNumber) => {
                  if (!overrideSurahNumber || overrideSurahNumber === surahData.meta.number) {
                    setActiveAyahNumber(a.numberInSurah);
                  }
                  trackAyahInteraction(a.overallNumber);
                }}
                onAyahAudioSelect={handlePlayAyahAudio}
                onOpenShareModal={(a, overrideSurahNumber, overrideSurahName) => {
                  setShareSurahNumber(overrideSurahNumber || surahData.meta.number);
                  setShareSurahName(overrideSurahName || surahData.meta.name);
                  setShareAyah(a);
                }}
                onOpenTadabburModal={(a, overrideSurahNumber, overrideSurahName) => {
                  setTadabburSurahContext(
                    overrideSurahNumber && overrideSurahName
                      ? { number: overrideSurahNumber, name: overrideSurahName }
                      : { number: surahData.meta.number, name: surahData.meta.name }
                  );
                  setTadabburAyah(a);
                }}
                isTajweedActive={isTajweedActive}
                onToggleTajweed={() => setIsTajweedActive(!isTajweedActive)}
                isSmartScrollActive={isSmartScrollActive}
                onToggleSmartScroll={() => setIsSmartScrollActive(!isSmartScrollActive)}
                onOpenTajweedLegend={() => setIsTajweedLegendOpen(true)}
                isPlayingAudio={isPlayingAudio}
                currentTime={audioCurrentTime}
                duration={audioDuration}
                isFullScreen={isFullScreenReading}
                onToggleFullScreen={handleToggleFullScreen}
                isAudioBarVisible={isAudioBarVisible}
                onToggleAudioBar={() => setIsAudioBarVisible(prev => !prev)}
                onOpenSurahPicker={() => {
                  setPickerTab('surahs');
                  setIsSurahPickerOpen(true);
                }}
                onOpenAyahSearch={() => {
                  setPickerTab('ayahs');
                  setIsSurahPickerOpen(true);
                }}
                selectedReciter={selectedReciter}
                onTogglePlayAudio={() => {
                  const next = !isPlayingAudio;
                  setIsPlayingAudio(next);
                  if (next) setIsAudioBarVisible(true);
                }}
                prefsReloadNonce={prefsReloadNonce}
                appTheme={appTheme}
                onToggleAppTheme={handleToggleAppTheme}
                onOpenKhatmaPlanner={() => {
                  setPersonalKhatmaPlan(loadPersonalKhatmaPlan());
                  setIsKhatmaPlannerOpen(true);
                }}
                onOpenMemorization={(ctx) => {
                  setPendingMushafPageTarget({
                    surahNumber: ctx.surahNumber,
                    pageNumber: ctx.pageNumber,
                    reciteViewMode: ctx.readerMode === 'page' ? 'full-page' : 'single-ayah',
                  });
                  if (ctx.surahNumber !== currentSurahNumber) {
                    pendingTargetAyahRef.current = ctx.ayahNumber;
                    setCurrentSurahNumber(ctx.surahNumber);
                  } else {
                    setActiveAyahNumber(ctx.ayahNumber);
                  }
                  setIsFullScreenReading(false);
                  setIsMushafAudioSheetOpen(false);
                  setActiveView('memorization');
                }}
                onNavigateView={(view) => {
                  setIsFullScreenReading(false);
                  setIsMushafAudioSheetOpen(false);
                  setActiveView(view);
                }}
                onNavigateToAyah={handleNavigateToAyah}
                onNavigateToJuz={handleNavigateToJuz}
                onOpenAudioSheet={() => setIsMushafAudioSheetOpen((prev) => !prev)}
                isAudioSheetOpen={isMushafAudioSheetOpen}
                savedResumePos={savedResumePos}
              />
            ) : null}
          </div>
        )}

        {activeView !== 'mushaf' && (
          <LazySectionBoundary resetKey={activeView}>
            <Suspense fallback={<SectionLoadingFallback />}>
              {activeView === 'memorization' && (
                surahData && surahData.meta.number === currentSurahNumber ? (
                  <MemorizationMode
                    ayahs={surahData.ayahs}
                    surahNumber={surahData.meta.number}
                    surahName={surahData.meta.name}
                    onClose={() => {
                      setIsPlayingAudio(false);
                      setActiveView('mushaf');
                    }}
                    onPlayAyah={(ayahNum) => handlePlayAyahAudio(ayahNum)}
                    onPauseAudio={() => setIsPlayingAudio(false)}
                    onFocusAyah={(ayahNum) => setActiveAyahNumber(ayahNum)}
                    onChangeSurah={(surahNum) => {
                      if (surahNum !== currentSurahNumber) {
                        setIsPlayingAudio(false);
                        pendingTargetAyahRef.current = 1;
                        setCurrentSurahNumber(surahNum);
                      }
                    }}
                    activeAudioAyahNumber={activeAyahNumber}
                    isPlayingAudio={isPlayingAudio}
                    repeatTarget={memorizationRepeatTarget}
                    onChangeRepeatTarget={(target) => {
                      setMemorizationRepeatTarget(target);
                    }}
                    currentRepeat={memorizationCurrentRepeat}
                    playbackCycleEvent={memorizationPlaybackCycle}
                    reciterName={selectedReciter.name}
                  />
                ) : (
                  <div className="p-16 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/60 border border-[#D9B45A]/25 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
                    <div className="w-10 h-10 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                    <p className="text-xs text-[#5C5549] dark:text-slate-300 font-medium">جارٍ تجهيز آيات السورة لحلقة الحفظ…</p>
                  </div>
                )
              )}

              {activeView === 'kids' && (
                <KidsHifzSection />
              )}

              {activeView === 'translations' && (
                <TranslationsSection
                  initialSurahNumber={currentSurahNumber}
                  activeAudioSurahNumber={currentSurahNumber}
                  activeAudioAyahNumber={activeAyahNumber}
                  isPlayingAudio={isPlayingAudio}
                  onPlayAyah={(surahNum, ayahNum) => handlePlayAyahAudio(ayahNum, surahNum)}
                  onPauseAudio={() => setIsPlayingAudio(false)}
                  onNavigateToAyah={handleNavigateToAyah}
                  onShareVerse={({ surahNumber, surahName, verse, edition }) => {
                    setShareSurahNumber(surahNumber);
                    setShareSurahName(surahName);
                    setShareReflectionContext({
                      text: verse.translationText,
                      dir: edition.dir,
                      label: `ترجمة المعاني (${edition.nativeTitle})`,
                    });
                    setShareAyah({
                      numberInSurah: verse.ayahNumber,
                      overallNumber: verse.overallNumber || verse.ayahNumber,
                      text: verse.arabicText,
                      tafsir: verse.translationText,
                      juz: verse.juz || 1,
                      page: verse.page || 1,
                      hizbQuarter: 1,
                    });
                  }}
                />
              )}

              {activeView === 'ruqyah' && (
                <RuqyahSection
                  onNavigateToAyah={handleNavigateToAyah}
                  onPlayAyahAudio={handlePlayAyahAudio}
                />
              )}

              {activeView === 'mood' && (
                <MoodVersesExplorer
                  onNavigateToAyah={handleNavigateToAyah}
                />
              )}

              {activeView === 'analytics' && (
                <FaithAnalytics onBackupRestored={handleBackupRestored} />
              )}

              {activeView === 'khatma' && (
                <CollectiveKhatma
                  onNavigateToJuz={handleNavigateToJuz}
                  onNavigateToAyah={handleNavigateToAyah}
                  onOpenPersonalPlanner={() => {
                    setPersonalKhatmaPlan(loadPersonalKhatmaPlan());
                    setIsKhatmaPlannerOpen(true);
                  }}
                />
              )}

              {activeView === 'tajweed' && (
                <TajweedEncyclopedia
                  selectedReciter={selectedReciter}
                  onNavigateToAyah={handleNavigateToAyah}
                  onPauseAudio={() => setIsPlayingAudio(false)}
                />
              )}

              {activeView === 'journal' && (
                <QuranJournal
                  notes={journalNotes}
                  onDeleteNote={handleDeleteJournalNote}
                  onUpdateNote={handleUpdateJournalNote}
                  onNavigateToAyah={handleNavigateToAyah}
                />
              )}

              {activeView === 'flutter-arch' && (
                <FlutterArchitectureDoc />
              )}
            </Suspense>
          </LazySectionBoundary>
        )}
      </main>

      {/* Floating Audio Player Bar (Persistent so recitation is never cut off, hidden in Kids mode) */}
      {surahData && activeView !== 'kids' && (
        <AudioPlayerBar
          surahNumber={surahData.meta.number}
          surahName={surahData.meta.name}
          totalAyahs={surahData.meta.numberOfAyahs}
          currentAyahNumber={activeAyahNumber}
          onAyahChange={(num) => {
            setActiveAyahNumber(num);
            setAudioCurrentTime(0);
          }}
          isPlaying={isPlayingAudio}
          onPlayPauseToggle={(playing) => setIsPlayingAudio(playing)}
          isSmartScrollEnabled={isSmartScrollActive}
          onToggleSmartScroll={() => setIsSmartScrollActive(!isSmartScrollActive)}
          onPlaybackProgress={(cur, dur) => {
            setAudioCurrentTime(cur);
            setAudioDuration(dur);
          }}
          onAyahComplete={(ayahNum, durationSec) => {
            const completedAyah = surahData.ayahs.find((a) => a.numberInSurah === ayahNum);
            if (completedAyah) {
              trackAyahInteraction(completedAyah.overallNumber, durationSec);
              if (completedAyah.page) {
                recordMushafPageReadInWird(completedAyah.page);
              }
            }
          }}
          isFullScreen={isFullScreenReading}
          isVisible={isAudioBarVisible}
          onHideBar={() => setIsAudioBarVisible(false)}
          selectedReciter={selectedReciter}
          onSelectReciter={(r) => setSelectedReciter(r)}
          playTriggerNonce={playTriggerNonce}
          stopAfterAyahMode={activeView === 'memorization'}
          memorizationRepeatTarget={memorizationRepeatTarget}
          onMemorizationRepeatChange={setMemorizationCurrentRepeat}
          onPlaybackCycleComplete={(ayahNum) => {
            if (activeView === 'memorization') {
              setMemorizationPlaybackCycle((prev) => ({
                ayahNumber: ayahNum,
                nonce: (prev?.nonce ?? 0) + 1,
              }));
            }
          }}
          mushafSheetMode={activeView === 'mushaf'}
          isMushafSheetOpen={isMushafAudioSheetOpen}
          onCloseMushafSheet={() => setIsMushafAudioSheetOpen(false)}
          isChromeHidden={isFullScreenReading}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Hidden in full-screen reading, desktop, and in Mushaf view where Floating Glass Dock is active) */}
      {!isFullScreenReading && activeView !== 'mushaf' && (
        <nav
          aria-label="التنقل السفلي"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBF7EE]/95 dark:bg-[#0d121a]/95 border-t border-[#D9B45A]/25 dark:border-slate-800 backdrop-blur-xl shadow-2xl flex items-center justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] select-none"
        >
          {[
            { id: 'mushaf', label: 'المصحف', icon: BookOpen },
            { id: 'memorization', label: 'الحفظ', icon: Award },
            { id: 'ruqyah', label: 'الرقية', icon: ShieldCheck },
            { id: 'khatma', label: 'الختمات', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveView(tab.id as ActiveView);
                  setIsMobileMoreOpen(false);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#8A6418] dark:text-[#D9B45A] font-bold'
                    : 'text-[#4A4338] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 text-[#D9B45A]' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* More Drawer Button */}
          <button
            type="button"
            onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
            aria-expanded={isMobileMoreOpen}
            className={`min-h-[44px] flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
              isMobileMoreOpen || ['kids', 'translations', 'mood', 'analytics', 'tajweed', 'journal'].includes(activeView)
                ? 'text-[#8A6418] dark:text-[#D9B45A] font-bold'
                : 'text-[#4A4338] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${
              isMobileMoreOpen || ['kids', 'translations', 'mood', 'analytics', 'tajweed', 'journal'].includes(activeView)
                ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 text-[#D9B45A]'
                : ''
            }`}>
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium">المزيد</span>
          </button>
        </nav>
      )}

      {/* Mobile "More" Bottom Sheet Drawer (2 Organized Groups) */}
      {isMobileMoreOpen && !isFullScreenReading && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMoreOpen(false)}
          />

          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-[#FBF7EE] dark:bg-[#10161f] border-t border-[#D9B45A]/35 rounded-t-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-y-auto animate-in slide-from-bottom duration-250 space-y-4">
            <div className="w-12 h-1.5 bg-[#D9B45A]/40 dark:bg-slate-700 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-[#D9B45A]/20 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                <h3 className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-sm font-kufi">أقسام بيان القرآنية</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                aria-label="إغلاق القائمة"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Group 1: Learning & Tadabbur */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#8A6418] dark:text-[#D9B45A] px-1">التعلّم والتدبّر</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'translations',
                      label: 'ترجمات المعاني',
                      sub: 'السويدية والإنجليزية ولغات أخرى',
                      icon: Globe,
                      color: 'text-[#1F3A6E] dark:text-[#648CD4] bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/40 border-[#648CD4]/35'
                    },
                    {
                      id: 'tajweed',
                      label: 'موسوعة التجويد',
                      sub: 'أحكام التلاوة والتدريب الصوتي',
                      icon: HelpCircle,
                      color: 'text-[#8A6418] dark:text-[#D9B45A] bg-[#D9B45A]/15 border-[#D9B45A]/30'
                    },
                    {
                      id: 'kids',
                      label: 'تحفيظ الصغار',
                      sub: 'تلقين صوتي ونجوم للأطفال',
                      icon: Sprout,
                      color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-950/60 border-emerald-500/40'
                    },
                    {
                      id: 'mood',
                      label: 'القرآن حياتي',
                      sub: 'آيات بحسب مشاعرك وحالك',
                      icon: Heart,
                      color: 'text-[#1F3A6E] dark:text-[#648CD4] bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/40 border-[#648CD4]/35'
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveView(item.id as ActiveView);
                          setIsMobileMoreOpen(false);
                        }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border-[#D9B45A] text-[#F6EFDD] shadow-md'
                            : 'bg-white dark:bg-slate-950/70 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]/50 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${isActive ? 'bg-[#D9B45A]/20 border-[#D9B45A]/45 text-[#D9B45A]' : item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-bold text-xs ${isActive ? 'text-[#F6EFDD]' : 'text-[#1B1A17] dark:text-[#F6EFDD]'}`}>{item.label}</div>
                          <div className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Personal Tracking */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#1F3A6E] dark:text-[#648CD4] px-1">المتابعة الشخصية</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'analytics',
                      label: 'سجل الختمات',
                      sub: 'إحصاءات التدبر والنسخ الاحتياطي',
                      icon: Calendar,
                      color: 'text-[#1F3A6E] dark:text-[#648CD4] bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/40 border-[#648CD4]/35'
                    },
                    {
                      id: 'journal',
                      label: 'مفكرتي والعلامات',
                      sub: 'خواطر التدبر وعلامات الوقف',
                      icon: PenLine,
                      color: 'text-[#1F3A6E] dark:text-[#648CD4] bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/40 border-[#648CD4]/35'
                    },
                    {
                      id: 'planner',
                      label: 'مخطط الورد',
                      sub: 'جدول الختمة الميسرة في ٣٠ يوماً',
                      icon: Flame,
                      color: 'text-[#8A6418] dark:text-[#D9B45A] bg-[#D9B45A]/15 border-[#D9B45A]/30',
                      action: () => {
                        setIsMobileMoreOpen(false);
                        setPersonalKhatmaPlan(loadPersonalKhatmaPlan());
                        setIsKhatmaPlannerOpen(true);
                      }
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.action) {
                            item.action();
                          } else {
                            setActiveView(item.id as ActiveView);
                            setIsMobileMoreOpen(false);
                          }
                        }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/55 border-[#D9B45A] text-[#F6EFDD] shadow-md'
                            : 'bg-white dark:bg-slate-950/70 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]/50 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${isActive ? 'bg-[#D9B45A]/20 border-[#D9B45A]/45 text-[#D9B45A]' : item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-bold text-xs ${isActive ? 'text-[#F6EFDD]' : 'text-[#1B1A17] dark:text-[#F6EFDD]'}`}>{item.label}</div>
                          <div className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800 flex items-center justify-between text-xs text-[#5C5549] dark:text-slate-400">
              <span className="text-[11px]">وقف خيري لوجه الله تعالى</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAppTheme}
                  className="min-h-[36px] py-1 px-3 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-[#1B1A17] dark:text-[#F6EFDD] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {appTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-[#D9B45A]" /> : <Moon className="w-3.5 h-3.5 text-[#1F3A6E]" />}
                  <span>{appTheme === 'dark' ? 'نهاري' : 'ليلي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    if (!isFullScreenReading) handleToggleFullScreen();
                  }}
                  className="min-h-[36px] py-1 px-3 rounded-xl bg-[#D9B45A]/15 border border-[#D9B45A]/35 text-[#8A6418] dark:text-[#D9B45A] font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>ملء الشاشة</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Surah Picker & Full-Quran Search Modal */}
      {isSurahPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فهرس السور والبحث في القرآن"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D9B45A]/20 dark:border-slate-800 bg-[#EFE6D1]/70 dark:bg-[#0b1018] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickerTab('surahs')}
                  className={`min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pickerTab === 'surahs'
                      ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50 shadow'
                      : 'bg-white dark:bg-slate-900 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white border border-[#D9B45A]/25 dark:border-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>فهرس السور (١١٤)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('ayahs')}
                  className={`min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pickerTab === 'ayahs'
                      ? 'bg-[#D9B45A] text-[#1B1A17] shadow'
                      : 'bg-white dark:bg-slate-900 text-[#3F3A32] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white border border-[#D9B45A]/25 dark:border-slate-800'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث في آيات القرآن</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsSurahPickerOpen(false)}
                aria-label="إغلاق الفهرس"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerTab === 'surahs' ? (
              <>
                <div className="p-3 border-b border-[#D9B45A]/20 dark:border-slate-800 bg-[#FBF7EE] dark:bg-[#10161f]">
                  <div className="relative">
                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-[#5C5549] dark:text-slate-400" />
                    <input
                      type="text"
                      value={surahSearchTerm}
                      onChange={(e) => setSurahSearchTerm(e.target.value)}
                      placeholder="ابحث باسم السورة، رقمها، أو الجزء..."
                      aria-label="ابحث باسم السورة، رقمها، أو الجزء"
                      className="w-full min-h-[42px] pr-10 pl-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredSurahs.map((s) => {
                    const isSelected = s.number === currentSurahNumber;
                    return (
                      <button
                        key={s.number}
                        type="button"
                        onClick={() => {
                          setCurrentSurahNumber(s.number);
                          setIsSurahPickerOpen(false);
                          setSurahSearchTerm('');
                        }}
                        className={`min-h-[48px] p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/60 border-[#D9B45A] text-[#F6EFDD] font-bold'
                            : 'bg-white dark:bg-slate-950/60 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]/50 dark:hover:border-slate-700 hover:bg-[#EFE6D1]/70 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-lg font-bold text-xs tabular-nums flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#D9B45A]/20 text-[#D9B45A]'
                              : 'bg-[#EFE6D1] dark:bg-slate-800/80 text-[#8A6418] dark:text-[#D9B45A]'
                          }`}>
                            {toArabicIndic(s.number)}
                          </span>
                          <div>
                            <div className={`font-bold text-xs ${isSelected ? 'text-[#F6EFDD]' : 'text-[#1B1A17] dark:text-[#F6EFDD]'}`}>سورة {s.name}</div>
                            <div className={`text-[11px] tabular-nums ${isSelected ? 'text-[#E9E3D3]/80' : 'text-[#5C5549] dark:text-slate-400'}`}>{s.revelationTypeAr} · {toArabicIndic(s.numberOfAyahs)} آيات</div>
                          </div>
                        </div>
                        <span className={`text-[11px] tabular-nums ${isSelected ? 'text-[#D9B45A]' : 'text-[#5C5549] dark:text-slate-400'}`}>جـ {toArabicIndic(s.juzNumber)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="p-3 border-b border-[#D9B45A]/20 dark:border-slate-800 bg-[#FBF7EE] dark:bg-[#10161f]">
                  <div className="relative">
                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                    <input
                      type="text"
                      value={ayahSearchQuery}
                      onChange={(e) => setAyahSearchQuery(e.target.value)}
                      placeholder="اكتب كلمة أو جزءاً من آية للبحث في المصحف الشريف كله..."
                      aria-label="البحث في آيات القرآن"
                      className="w-full min-h-[42px] pr-10 pl-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/30 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#D9B45A]"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto space-y-2 min-h-[260px]">
                  {ayahSearchQuery.trim().length < 2 ? (
                    <div className="text-center py-12 text-xs text-[#5C5549] dark:text-slate-400 space-y-1.5">
                      <p className="font-semibold text-[#1B1A17] dark:text-slate-200">ابحث في آيات القرآن الكريم</p>
                      <p>أدخل حرفين على الأقل للبحث الفوري في السور المخزنة محلياً وعبر خادم المصحف المعتمد</p>
                    </div>
                  ) : isSearchingAyahs ? (
                    <div className="py-12 text-center flex flex-col items-center gap-2.5 text-xs text-[#5C5549] dark:text-slate-400">
                      <div className="w-7 h-7 rounded-full border-2 border-[#D9B45A] border-t-transparent animate-spin" />
                      <span>جارٍ البحث في آيات المصحف الشريف…</span>
                    </div>
                  ) : ayahSearchResults.length === 0 ? (
                    <div className="text-center py-12 text-xs text-[#5C5549] dark:text-slate-400">
                      لم يتم العثور على آيات مطابقة لعبارة «{ayahSearchQuery}»
                    </div>
                  ) : (
                    <>
                      <div className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-semibold px-1">
                        تم العثور على {toArabicIndic(ayahSearchResults.length)} نتيجة
                      </div>
                      {ayahSearchResults.map((match) => (
                        <button
                          key={`${match.surahNumber}:${match.ayahNumber}`}
                          type="button"
                          onClick={() => {
                            handleNavigateToAyah(match.surahNumber, match.ayahNumber);
                            setIsSurahPickerOpen(false);
                          }}
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-950/70 hover:bg-[#EFE6D1]/80 dark:hover:bg-slate-800/80 border border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#D9B45A]/60 text-right transition-all space-y-1.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">
                              سورة {match.surahName} · الآية {toArabicIndic(match.ayahNumber)}
                            </span>
                            <span className="text-[#5C5549] dark:text-slate-400">انتقال للقراءة ↵</span>
                          </div>
                          <p className="font-quran text-base sm:text-lg text-[#1B1A17] dark:text-[#F6EFDD] leading-relaxed">
                            {match.text}
                          </p>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tadabbur & Tafsir Modal */}
      {Boolean(tadabburAyah) && (
        <Suspense fallback={null}>
          <TadabburModal
            isOpen={Boolean(tadabburAyah)}
            onClose={() => {
              setTadabburAyah(null);
              setTadabburSurahContext(null);
            }}
            ayah={tadabburAyah}
            surahNumber={tadabburSurahContext?.number || surahData?.meta.number || currentSurahNumber}
            surahName={tadabburSurahContext?.name || surahData?.meta.name || ''}
            onSaveJournalNote={handleSaveJournalNote}
            savedNote={journalNotes.find(n => n.ayahId === tadabburAyah?.overallNumber)?.text || ''}
            onPlayAyah={(num) => {
              handlePlayAyahAudio(num, tadabburSurahContext?.number);
            }}
            onOpenShareModal={(a) => {
              const sNumber = tadabburSurahContext?.number || surahData?.meta.number || currentSurahNumber;
              const sName = tadabburSurahContext?.name || surahData?.meta.name || '';
              setTadabburAyah(null);
              setTadabburSurahContext(null);
              setShareSurahNumber(sNumber);
              setShareSurahName(sName);
              setShareAyah(a);
            }}
          />
        </Suspense>
      )}

      {/* Social Share Card Generator Modal */}
      {Boolean(shareAyah) && (
        <Suspense fallback={null}>
          <SocialShareModal
            isOpen={Boolean(shareAyah)}
            onClose={() => {
              setShareAyah(null);
              setShareSurahName(null);
              setShareSurahNumber(null);
              setShareReflectionContext(null);
            }}
            ayah={shareAyah}
            surahName={shareSurahName || surahData?.meta.name || ''}
            surahNumber={shareSurahNumber || surahData?.meta.number || currentSurahNumber}
            selectedReciter={selectedReciter}
            initialReflectionText={shareReflectionContext?.text}
            initialReflectionDir={shareReflectionContext?.dir}
            initialReflectionLabel={shareReflectionContext?.label}
          />
        </Suspense>
      )}

      {/* Tajweed Legend Modal */}
      {isTajweedLegendOpen && (
        <Suspense fallback={null}>
          <TajweedLegendModal
            isOpen={isTajweedLegendOpen}
            onClose={() => setIsTajweedLegendOpen(false)}
          />
        </Suspense>
      )}

      {/* Khatma Planner Modal */}
      {isKhatmaPlannerOpen && (
        <Suspense fallback={null}>
          <KhatmaPlannerModal
            isOpen={isKhatmaPlannerOpen}
            onClose={() => setIsKhatmaPlannerOpen(false)}
            initialPlan={personalKhatmaPlan}
            onApplyPlan={(plan) => {
              const saved = savePersonalKhatmaPlan(plan);
              setPersonalKhatmaPlan(saved);
              setIsKhatmaPlannerOpen(false);
              const targetDesc =
                saved.goalMode === 'juz'
                  ? `${toArabicIndic(saved.targetJuzCount || 30)} جزءاً`
                  : (saved.targetKhatmas || 1) === 1
                  ? 'ختمة واحدة'
                  : `${toArabicIndic(saved.targetKhatmas || 1)} ختمات`;
              setPlannerToast(
                `تم اعتماد خطتك (${targetDesc}): ${toArabicIndic(saved.pagesPerDay)} صفحة يومياً خلال ${toArabicIndic(saved.targetDays)} يوماً`
              );
              setTimeout(() => setPlannerToast(null), 4000);
            }}
          />
        </Suspense>
      )}

      {/* Planner Success Toast */}
      {plannerToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/50 text-[#1B1A17] dark:text-[#F6EFDD] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm tabular-nums animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
          <span>{plannerToast}</span>
        </div>
      )}

    </div>
  );
}
