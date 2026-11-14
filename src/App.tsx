import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Sparkles, Award, Heart, Calendar, HelpCircle,
  PenLine, Cpu, Search, ChevronDown,
  ShieldCheck, Flame, Maximize2,
  Menu, X, AlertCircle, RefreshCw
} from 'lucide-react';
import { SURAHS_LIST } from './data/quranMetadata';
import { SurahData, Ayah, getSurahData, searchQuranAyahs, QuranSearchMatch } from './data/quranService';
import { recordAyahReadActivity, recordPageProgress } from './data/faithAnalyticsService';
import { QuranReader } from './components/QuranReader';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { TadabburModal, JournalNotePayload } from './components/TadabburModal';
import { SocialShareModal } from './components/SocialShareModal';
import { MemorizationMode } from './components/MemorizationMode';
import { FaithAnalytics } from './components/FaithAnalytics';
import { CollectiveKhatma } from './components/CollectiveKhatma';
import { TajweedEncyclopedia } from './components/TajweedEncyclopedia';
import { MoodVersesExplorer } from './components/MoodVersesExplorer';
import { QuranJournal, JournalNote } from './components/QuranJournal';
import { FlutterArchitectureDoc } from './components/FlutterArchitectureDoc';
import { TajweedLegendModal } from './components/TajweedLegendModal';
import { KhatmaPlannerModal } from './components/KhatmaPlannerModal';
import { AmbientAudioBar } from './components/AmbientAudioBar';
import { RuqyahSection } from './components/RuqyahSection';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { Reciter, RECITERS_LIST } from './data/reciters';
import { safeLocalStorage } from './utils/safeStorage';

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
      if (tab && ['mushaf', 'memorization', 'ruqyah', 'mood', 'analytics', 'khatma', 'tajweed', 'journal', 'flutter-arch'].includes(tab)) {
        return tab;
      }
    }
    return 'mushaf';
  });
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number>(1);
  const [surahData, setSurahData] = useState<SurahData | null>(null);
  const [activeAyahNumber, setActiveAyahNumber] = useState<number>(1);
  const [isLoadingSurah, setIsLoadingSurah] = useState<boolean>(true);

  // Audio & Tajweed state
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS_LIST[0]);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(1);
  const [isTajweedActive, setIsTajweedActive] = useState<boolean>(true);
  const [isSmartScrollActive, setIsSmartScrollActive] = useState<boolean>(true);
  const [isFullScreenReading, setIsFullScreenReading] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  // Modals state
  const [tadabburAyah, setTadabburAyah] = useState<Ayah | null>(null);
  const [tadabburSurahContext, setTadabburSurahContext] = useState<{ number: number; name: string } | null>(null);
  const [shareAyah, setShareAyah] = useState<Ayah | null>(null);
  const [shareSurahName, setShareSurahName] = useState<string | null>(null);
  const [isTajweedLegendOpen, setIsTajweedLegendOpen] = useState<boolean>(false);
  const [isKhatmaPlannerOpen, setIsKhatmaPlannerOpen] = useState<boolean>(false);
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'surahs' | 'ayahs'>('surahs');
  const [surahSearchTerm, setSurahSearchTerm] = useState<string>('');
  const [ayahSearchQuery, setAyahSearchQuery] = useState<string>('');
  const [ayahSearchResults, setAyahSearchResults] = useState<QuranSearchMatch[]>([]);
  const [isSearchingAyahs, setIsSearchingAyahs] = useState<boolean>(false);

  // Journal notes stored locally (no hardcoded fake notes)
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>(() => {
    return safeLocalStorage.getJSON<JournalNote[]>('bayan_journal_notes', []);
  });

  // Pending target ayah when switching surah (stored in ref so clearing it never retriggers load effect)
  const pendingTargetAyahRef = useRef<number | null>(null);
  const [surahReloadTrigger, setSurahReloadTrigger] = useState<number>(0);

  const [surahError, setSurahError] = useState<string | null>(null);
  const [plannerToast, setPlannerToast] = useState<string | null>(null);

  // Close Surah Picker on Escape key
  useEffect(() => {
    if (!isSurahPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSurahPickerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSurahPickerOpen]);

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

  // Record page progress whenever active ayah shifts cleanly
  useEffect(() => {
    if (!surahData) return;
    const currentAyah = surahData.ayahs.find((a) => a.numberInSurah === activeAyahNumber);
    if (currentAyah?.page) {
      recordPageProgress(currentAyah.page);
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

  // Handle saving journal note with direct self-contained payload
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
  };

  const handleDeleteJournalNote = (ayahId: number) => {
    const updated = journalNotes.filter(n => n.ayahId !== ayahId);
    setJournalNotes(updated);
    safeLocalStorage.setJSON('bayan_journal_notes', updated);
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
    setIsPlayingAudio(true);
  };

  const filteredSurahs = SURAHS_LIST.filter(s =>
    s.name.includes(surahSearchTerm) ||
    s.englishName.toLowerCase().includes(surahSearchTerm.toLowerCase()) ||
    String(s.number) === surahSearchTerm ||
    String(s.juzNumber) === surahSearchTerm
  );

  return (
    <div className="min-h-screen bg-[#0b1117] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <OfflineIndicator />

      {/* Top Main Navigation Bar (Hidden when in full screen reading) */}
      {!isFullScreenReading && (
        <header className="sticky top-0 z-30 bg-[#090f14]/95 border-b border-slate-800/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            
            {/* Logo & Waqf Title */}
            <div className="flex items-center gap-3">
              <div
                onClick={() => setActiveView('mushaf')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950 font-bold text-xl font-kufi group-hover:scale-105 transition-transform">
                  ب
                </div>
                <div>
                  <div className="font-bold text-base sm:text-lg text-white font-kufi flex items-center gap-2">
                    <span>بَيَان</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans font-medium">
                      وقف خيري
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    المصحف الرقمي الذكي بالرسم العثماني
                  </div>
                </div>
              </div>

              {/* Quick Surah selector button & Full-Screen quick toggle */}
              {activeView === 'mushaf' && surahData && (
                <div className="flex items-center gap-1.5 mr-2">
                  <button
                    onClick={() => setIsSurahPickerOpen(true)}
                    className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>سورة {surahData.meta.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => setIsFullScreenReading(true)}
                    className="py-1.5 px-2 sm:px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-bold flex items-center gap-1 transition-all"
                    title="تفعيل وضع ملء الشاشة القرآني (إخفاء كل القوائم لتفرغ القراءة)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">ملء الشاشة</span>
                  </button>
                </div>
              )}
            </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80">
            {[
              { id: 'mushaf', label: 'المصحف الشريف', icon: BookOpen },
              { id: 'ruqyah', label: 'الرقية الشرعية', icon: ShieldCheck },
              { id: 'memorization', label: 'حلقة الحفظ', icon: Award },
              { id: 'mood', label: 'القرآن حياتي', icon: Heart },
              { id: 'analytics', label: 'سجل الختمات', icon: Calendar },
              { id: 'khatma', label: 'الختمات', icon: Sparkles },
              { id: 'tajweed', label: 'التجويد', icon: HelpCircle },
              { id: 'journal', label: 'مفكرتي', icon: PenLine },
              { id: 'flutter-arch', label: 'هندسة Flutter', icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as ActiveView)}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Helpers */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <AmbientAudioBar />
            
            <button
              onClick={() => setIsKhatmaPlannerOpen(true)}
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors"
              title="مخطط الورد والختمة الذكية"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>مخطط الورد</span>
            </button>
          </div>

        </div>
      </header>
      )}

      {/* Main Viewport Content */}
      <main className={`flex-1 w-full mx-auto transition-all ${
        isFullScreenReading
          ? 'p-0 max-w-full m-0'
          : 'max-w-7xl p-4 sm:p-6 pb-40 lg:pb-28'
      }`}>
        {activeView === 'mushaf' && (
          <div className="relative">
            {isLoadingSurah && surahData && (
              <div className="mb-2 flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-emerald-950/70 border border-emerald-500/30 text-xs text-emerald-300 max-w-fit mx-auto">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>جارٍ تحميل السورة الكريمة...</span>
              </div>
            )}

            {isLoadingSurah && !surahData ? (
              <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-xs text-slate-400 font-medium">جارٍ تحميل آيات السورة الكريمة بالرسم العثماني المعتمد...</p>
              </div>
            ) : surahError && !surahData ? (
              <div className="p-10 text-center rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto my-12 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">تعذر تحميل السورة الكريمة</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{surahError}</p>
                </div>
                <button
                  onClick={() => setSurahReloadTrigger(c => c + 1)}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
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
                onOpenShareModal={(a) => {
                  setShareSurahName(surahData.meta.name);
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
                onToggleFullScreen={() => setIsFullScreenReading(prev => !prev)}
                selectedReciter={selectedReciter}
                onTogglePlayAudio={() => setIsPlayingAudio(prev => !prev)}
              />
            ) : null}
          </div>
        )}

        {activeView === 'memorization' && (
          surahData ? (
            <MemorizationMode
              ayahs={surahData.ayahs}
              surahNumber={surahData.meta.number}
              surahName={surahData.meta.name}
              onClose={() => setActiveView('mushaf')}
              onPlayAyah={handlePlayAyahAudio}
            />
          ) : (
            <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-400 font-medium">جارٍ تجهيز آيات السورة لحلقة الحفظ...</p>
            </div>
          )
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
          <FaithAnalytics />
        )}

        {activeView === 'khatma' && (
          <CollectiveKhatma onNavigateToJuz={handleNavigateToJuz} />
        )}

        {activeView === 'tajweed' && (
          <TajweedEncyclopedia />
        )}

        {activeView === 'journal' && (
          <QuranJournal
            notes={journalNotes}
            onDeleteNote={handleDeleteJournalNote}
            onNavigateToAyah={handleNavigateToAyah}
          />
        )}

        {activeView === 'flutter-arch' && (
          <FlutterArchitectureDoc />
        )}
      </main>

      {/* Floating Audio Player Bar (Persistent so recitation is never cut off, supports full-screen floating mode) */}
      {surahData && (
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
            }
          }}
          isFullScreen={isFullScreenReading}
          selectedReciter={selectedReciter}
          onSelectReciter={(r) => setSelectedReciter(r)}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Hidden in full-screen reading and on desktop) */}
      {!isFullScreenReading && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-950/95 border-t border-slate-800 backdrop-blur-xl shadow-2xl flex items-center justify-around px-2 select-none">
          {[
            { id: 'mushaf', label: 'المصحف', icon: BookOpen },
            { id: 'memorization', label: 'الحفظ', icon: Award },
            { id: 'khatma', label: 'الختمات', icon: Sparkles },
            { id: 'journal', label: 'مفكرتي', icon: PenLine },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveView(tab.id as ActiveView);
                  setIsMobileMoreOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-emerald-400 font-bold scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-emerald-500/15 text-emerald-400' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* More Drawer Button */}
          <button
            onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
              isMobileMoreOpen || ['ruqyah', 'mood', 'analytics', 'tajweed', 'flutter-arch'].includes(activeView)
                ? 'text-amber-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${
              isMobileMoreOpen || ['ruqyah', 'mood', 'analytics', 'tajweed', 'flutter-arch'].includes(activeView)
                ? 'bg-amber-500/15 text-amber-400'
                : ''
            }`}>
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">المزيد</span>
          </button>
        </nav>
      )}

      {/* Mobile "More" Bottom Sheet Drawer */}
      {isMobileMoreOpen && !isFullScreenReading && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMoreOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-slate-900 border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-5 overflow-y-auto animate-in slide-from-bottom duration-250 space-y-4">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm font-kufi">أقسام ومميزات بيان الإضافية</h3>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of Features */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'ruqyah',
                  label: 'الرقية الشرعية',
                  sub: 'آيات وأدعية الشفاء والتحصين',
                  icon: ShieldCheck,
                  color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                },
                {
                  id: 'mood',
                  label: 'القرآن حياتي',
                  sub: 'آيات بحسب مشاعرك وحالك',
                  icon: Heart,
                  color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                },
                {
                  id: 'analytics',
                  label: 'سجل الختمات',
                  sub: 'إحصاءات التدبر والإنجاز',
                  icon: Calendar,
                  color: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                },
                {
                  id: 'tajweed',
                  label: 'موسوعة التجويد',
                  sub: 'أحكام التلاوة والتجويد الملون',
                  icon: HelpCircle,
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                },
                {
                  id: 'planner',
                  label: 'مخطط الورد',
                  sub: 'جدول الختمة الميسرة في 30 يوماً',
                  icon: Flame,
                  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  action: () => {
                    setIsMobileMoreOpen(false);
                    setIsKhatmaPlannerOpen(true);
                  }
                },
                {
                  id: 'flutter-arch',
                  label: 'هندسة Flutter',
                  sub: 'دليل تطبيق الجوال الأصلي',
                  icon: Cpu,
                  color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
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
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Action in Bottom Sheet */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">وقف خيري إسلامي مجاني 100% بدون إعلانات</span>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsFullScreenReading(true);
                }}
                className="py-1 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>ملء الشاشة</span>
              </button>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickerTab('surahs')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pickerTab === 'surahs'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>فهرس السور (114)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('ayahs')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pickerTab === 'ayahs'
                      ? 'bg-amber-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث في آيات القرآن</span>
                </button>
              </div>
              <button
                onClick={() => setIsSurahPickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerTab === 'surahs' ? (
              <>
                <div className="p-3 border-b border-slate-800 bg-slate-900">
                  <div className="relative">
                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={surahSearchTerm}
                      onChange={(e) => setSurahSearchTerm(e.target.value)}
                      placeholder="ابحث باسم السورة، رقمها، أو الجزء..."
                      className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredSurahs.map((s) => {
                    const isSelected = s.number === currentSurahNumber;
                    return (
                      <button
                        key={s.number}
                        onClick={() => {
                          setCurrentSurahNumber(s.number);
                          setIsSurahPickerOpen(false);
                          setSurahSearchTerm('');
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-slate-800/80 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {s.number}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-white">سورة {s.name}</div>
                            <div className="text-[10px] text-slate-400">{s.revelationTypeAr} • {s.numberOfAyahs} آيات</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500">جـ{s.juzNumber}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="p-3 border-b border-slate-800 bg-slate-900">
                  <div className="relative">
                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-amber-400" />
                    <input
                      type="text"
                      value={ayahSearchQuery}
                      onChange={(e) => setAyahSearchQuery(e.target.value)}
                      placeholder="اكتب كلمة أو جزءاً من آية للبحث في المصحف الشريف كله (دون الحاجة للتشكيل)..."
                      className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto space-y-2 min-h-[260px]">
                  {ayahSearchQuery.trim().length < 2 ? (
                    <div className="text-center py-12 text-xs text-slate-400 space-y-1.5">
                      <p className="font-semibold text-slate-300">ابحث في آيات القرآن الكريم</p>
                      <p>أدخل حرفين على الأقل للبحث الفوري في السور المخزنة محلياً وعبر خادم المصحف المعتمد</p>
                    </div>
                  ) : isSearchingAyahs ? (
                    <div className="py-12 text-center flex flex-col items-center gap-2.5 text-xs text-slate-400">
                      <div className="w-7 h-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      <span>جارٍ البحث في آيات المصحف الشريف...</span>
                    </div>
                  ) : ayahSearchResults.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      لم يتم العثور على آيات مطابقة لعبارة «{ayahSearchQuery}»
                    </div>
                  ) : (
                    <>
                      <div className="text-[11px] text-amber-400 font-semibold px-1">
                        تم العثور على {ayahSearchResults.length} نتيجة
                      </div>
                      {ayahSearchResults.map((match) => (
                        <button
                          key={`${match.surahNumber}:${match.ayahNumber}`}
                          type="button"
                          onClick={() => {
                            handleNavigateToAyah(match.surahNumber, match.ayahNumber);
                            setIsSurahPickerOpen(false);
                          }}
                          className="w-full p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 text-right transition-all space-y-1.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-400">
                              سورة {match.surahName} • الآية {match.ayahNumber}
                            </span>
                            <span className="text-slate-500">انتقال للقراءة ↵</span>
                          </div>
                          <p className="font-quran text-base sm:text-lg text-slate-100 leading-relaxed">
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
          const sName = tadabburSurahContext?.name || surahData?.meta.name || '';
          setTadabburAyah(null);
          setTadabburSurahContext(null);
          setShareSurahName(sName);
          setShareAyah(a);
        }}
      />

      {/* Social Share Card Generator Modal */}
      <SocialShareModal
        isOpen={Boolean(shareAyah)}
        onClose={() => {
          setShareAyah(null);
          setShareSurahName(null);
        }}
        ayah={shareAyah}
        surahName={shareSurahName || surahData?.meta.name || ''}
      />

      {/* Tajweed Legend Modal */}
      <TajweedLegendModal
        isOpen={isTajweedLegendOpen}
        onClose={() => setIsTajweedLegendOpen(false)}
      />

      {/* Khatma Planner Modal */}
      <KhatmaPlannerModal
        isOpen={isKhatmaPlannerOpen}
        onClose={() => setIsKhatmaPlannerOpen(false)}
        onApplyPlan={(plan) => {
          safeLocalStorage.setJSON('bayan_khatma_plan', plan);
          setIsKhatmaPlannerOpen(false);
          setPlannerToast(`تم اعتماد خطة الختمة المباركة: ${plan.pagesPerDay} صفحات يومياً لإنهاء الختمة في ${plan.targetDays} يوماً ✨`);
          setTimeout(() => setPlannerToast(null), 4000);
        }}
      />

      {/* Planner Success Toast */}
      {plannerToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{plannerToast}</span>
        </div>
      )}

    </div>
  );
}
