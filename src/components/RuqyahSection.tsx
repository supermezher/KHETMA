import React, { useState, useEffect, useRef } from 'react';
import {
  RUQYAH_ITEMS,
  RUQYAH_ETIQUETTES,
  RuqyahItem,
  AudioAyahRef
} from '../data/ruqyahData';
import {
  RECITERS_LIST,
  Reciter,
  getAyahAudioUrl
} from '../data/reciters';
import {
  ShieldCheck, Sparkles, BookOpen, Heart, Volume2, VolumeX, Copy, Check,
  RotateCcw, Info, Compass, CheckCircle2, Play, Pause, Square,
  SkipForward, ChevronDown, User, RefreshCw, Zap
} from 'lucide-react';

interface RuqyahSectionProps {
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onPlayAyahAudio?: (ayahNumber: number, surahNumber?: number) => void;
}

type TabType = 'all' | 'quranic' | 'prophetic' | 'sakina' | 'etiquette';

export const RuqyahSection: React.FC<RuqyahSectionProps> = ({
  onNavigateToAyah,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reciter & Audio state
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS_LIST[0]); // Default: Mishary Alafasy
  const [isReciterMenuOpen, setIsReciterMenuOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoLoopUntilTarget, setAutoLoopUntilTarget] = useState<boolean>(true);

  // Active playing card state
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [playingAyahIndex, setPlayingAyahIndex] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

  // Prophetic speech state
  const [isSpeakingDua, setIsSpeakingDua] = useState<boolean>(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter items based on active tab
  const filteredItems = RUQYAH_ITEMS.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'quranic') return item.category === 'quranic';
    if (activeTab === 'prophetic') return item.category === 'prophetic';
    if (activeTab === 'sakina') return item.category === 'sakina';
    return true;
  });

  // Calculate completed count
  const completedCount = RUQYAH_ITEMS.filter(
    (item) => (counters[item.id] || 0) >= item.repeatTarget
  ).length;

  // Active item being played
  const activePlayingItem = RUQYAH_ITEMS.find((i) => i.id === playingItemId);

  // Handle repetition increment
  const handleIncrement = (item: RuqyahItem) => {
    setCounters((prev) => {
      const current = prev[item.id] || 0;
      if (current >= item.repeatTarget) return prev;
      return { ...prev, [item.id]: current + 1 };
    });
  };

  const handleReset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCounters((prev) => ({ ...prev, [id]: 0 }));
  };

  const handleResetAll = () => {
    setCounters({});
  };

  // Safe clipboard copy
  const handleCopy = async (item: RuqyahItem) => {
    const textToCopy = `${item.title}\n\n${item.arabicText}\n\n[المصدر: ${item.source}]\nفضله: ${item.virtueAndFadl}\nمن تطبيق بَيَان - المصحف الرقمي الوقفي`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // -------------------------------------------------------------
  // AUDIO ENGINE: Quranic recitation & Prophetic Duas
  // -------------------------------------------------------------

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsSpeakingDua(false);
    setPlayingItemId(null);
    setPlayingAyahIndex(0);
    setAudioProgress(0);
  };

  // Start or toggle Quran recitation for an item
  const handleToggleQuranAudio = (item: RuqyahItem) => {
    // If this item is currently playing, toggle pause/play
    if (playingItemId === item.id) {
      if (isPlayingAudio) {
        audioRef.current?.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current?.play().then(() => setIsPlayingAudio(true)).catch(() => {});
      }
      return;
    }

    // Stop existing audio
    stopAllAudio();

    if (!item.audioSequence || item.audioSequence.length === 0) {
      // Single fallback
      if (item.surahNumber && item.ayahNumber) {
        playAyah(item.id, [{ surah: item.surahNumber, ayah: item.ayahNumber }], 0);
      }
      return;
    }

    playAyah(item.id, item.audioSequence, 0);
  };

  // Play specific ayah in item's sequence
  const playAyah = (itemId: string, sequence: AudioAyahRef[], index: number) => {
    if (!sequence[index]) return;
    const { surah, ayah } = sequence[index];
    const url = getAyahAudioUrl(selectedReciter.serverKey, surah, ayah);

    setPlayingItemId(itemId);
    setPlayingAyahIndex(index);
    setIsAudioLoading(true);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    audioRef.current.src = url;
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current
      .play()
      .then(() => {
        setIsAudioLoading(false);
        setIsPlayingAudio(true);
      })
      .catch((err) => {
        console.warn('Playback error:', err);
        setIsAudioLoading(false);
        setIsPlayingAudio(false);
      });
  };

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setAudioProgress(audio.currentTime);
      setAudioDuration(audio.duration || 0);
    };

    const onEnded = () => {
      if (!playingItemId) return;
      const item = RUQYAH_ITEMS.find((i) => i.id === playingItemId);
      if (!item || !item.audioSequence) {
        stopAllAudio();
        return;
      }

      // Check if there are more ayahs in sequence
      const nextIndex = playingAyahIndex + 1;
      if (nextIndex < item.audioSequence.length) {
        playAyah(item.id, item.audioSequence, nextIndex);
      } else {
        // Sequence completed! Increment counter
        handleIncrement(item);

        const currentCount = (counters[item.id] || 0) + 1;
        if (autoLoopUntilTarget && currentCount < item.repeatTarget) {
          // Restart sequence from start
          playAyah(item.id, item.audioSequence, 0);
        } else {
          // Stop audio
          setIsPlayingAudio(false);
          setPlayingAyahIndex(0);
          setAudioProgress(0);
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playingItemId, playingAyahIndex, autoLoopUntilTarget, counters, selectedReciter, playbackSpeed]);

  // Update playback speed if user changes it
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Prophetic Dua speech
  const handleTogglePropheticAudio = (item: RuqyahItem) => {
    if (playingItemId === item.id && isSpeakingDua) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeakingDua(false);
      setPlayingItemId(null);
      return;
    }

    stopAllAudio();

    if (!('speechSynthesis' in window)) {
      alert('ميزة التلاوة الصوتية للأدعية غير مدعومة في هذا المتصفح');
      return;
    }

    // Clean diacritics / quotes if needed, or speak full text clearly
    const textToSpeak = item.arabicText.replace(/[«»]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.85; // Reverent, gentle pace
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setPlayingItemId(item.id);
      setIsSpeakingDua(true);
    };

    utterance.onend = () => {
      setIsSpeakingDua(false);
      setPlayingItemId(null);
      handleIncrement(item);
    };

    utterance.onerror = () => {
      setIsSpeakingDua(false);
      setPlayingItemId(null);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">
      
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>الرقية الشرعية المحققة من القرآن والسنة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-kufi tracking-tight">
              وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              حصن المسلم الجامع لآيات الشفاء والتحصين من العين والسحر، مع الاستماع المباشر بصوت كبار القراء، وعداد تكرار تفاعلي وتوجيه نبوي مسند.
            </p>
          </div>

          {/* Daily Progress Card */}
          <div className="w-full md:w-auto shrink-0 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center min-w-[200px] shadow-lg">
            <div className="text-[11px] text-slate-400 font-semibold mb-1">إنجاز رقية اليوم</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-emerald-400 font-mono">{completedCount}</span>
              <span className="text-xs text-slate-400">من {RUQYAH_ITEMS.length} أوراد</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                style={{ width: `${(completedCount / RUQYAH_ITEMS.length) * 100}%` }}
              />
            </div>

            {completedCount > 0 && (
              <button
                onClick={handleResetAll}
                className="mt-3 text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                title="إعادة تصفير عدادات الأوراد"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط العدادات</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Ruqyah Audio Settings Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">صوت التلاوة للرقية</span>
            <span className="text-[11px] text-slate-400">اختر القارئ واستمع لآيات الشفاء</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Reciter Selector */}
          <div className="relative">
            <button
              onClick={() => setIsReciterMenuOpen(!isReciterMenuOpen)}
              className="py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>{selectedReciter.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isReciterMenuOpen && (
              <div className="absolute left-0 sm:right-0 mt-1.5 w-64 max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50">
                <div className="text-[11px] font-bold text-slate-400 px-2.5 py-1.5 border-b border-slate-800">
                  اختر القارئ المفضل للرقية:
                </div>
                {RECITERS_LIST.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedReciter(r);
                      setIsReciterMenuOpen(false);
                      // If something is playing, update audio
                      if (playingItemId) {
                        const item = RUQYAH_ITEMS.find(i => i.id === playingItemId);
                        if (item && item.audioSequence) {
                          playAyah(item.id, item.audioSequence, playingAyahIndex);
                        }
                      }
                    }}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedReciter.id === r.id
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className="text-[10px] text-slate-500">{r.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auto Loop Switch */}
          <button
            onClick={() => setAutoLoopUntilTarget(!autoLoopUntilTarget)}
            className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoLoopUntilTarget
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="تكرار الآية تلقائياً بعدد المرات المسنونة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoLoopUntilTarget ? 'text-emerald-400 animate-spin-slow' : ''}`} />
            <span>تكرار تلقائي للورد</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
            {[1.0, 1.25].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Stop Audio Button if playing */}
          {(isPlayingAudio || isSpeakingDua) && (
            <button
              onClick={stopAllAudio}
              className="py-1.5 px-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>إيقاف الصوت</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none">
        {[
          { id: 'all', label: 'الرقية الشاملة', count: RUQYAH_ITEMS.length, icon: Sparkles },
          { id: 'quranic', label: 'آيات الشفاء والحفظ', count: RUQYAH_ITEMS.filter(i => i.category === 'quranic').length, icon: BookOpen },
          { id: 'prophetic', label: 'الأدعية النبوية', count: RUQYAH_ITEMS.filter(i => i.category === 'prophetic').length, icon: ShieldCheck },
          { id: 'sakina', label: 'سكينة وطرد القلق', count: RUQYAH_ITEMS.filter(i => i.category === 'sakina').length, icon: Heart },
          { id: 'etiquette', label: 'آداب وسنن الرقية', count: RUQYAH_ETIQUETTES.length, icon: Compass },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: ETIQUETTE & SUNNAH GUIDE */}
      {activeTab === 'etiquette' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>شروط وآداب الرقية الشرعية الصحيحة</span>
            </h3>
            <p className="text-xs text-slate-400">
              أجمع أهل العلم على أن الرقية تكون مشروعة ونافعة إذا تحققت فيها الشروط النبوية التالية:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RUQYAH_ETIQUETTES.map((eti) => (
              <div
                key={eti.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-3.5 hover:border-slate-700 transition-colors shadow-md"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-sm">
                  {eti.id}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{eti.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{eti.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Golden Reminder Card */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>تذكير نبوي:</strong> أفضل ما يرقي به المسلم نفسه هو أن يرقي نفسه بنفسه دون الذهاب لأحد؛ اقتداءً برسول الله ﷺ وأخذاً بمسلك التوكل التام وصدق الالتجاء.
            </span>
          </div>
        </div>
      ) : (
        /* VIEW 2: RUQYAH ITEMS LIST */
        <div className="space-y-4">
          {filteredItems.map((item, index) => {
            const count = counters[item.id] || 0;
            const isCompleted = count >= item.repeatTarget;
            const isThisItemPlayingQuran = playingItemId === item.id && isPlayingAudio;
            const isThisItemSpeakingDua = playingItemId === item.id && isSpeakingDua;
            const isThisItemActive = isThisItemPlayingQuran || isThisItemSpeakingDua;

            const currentAyahSeq = item.audioSequence ? item.audioSequence[playingAyahIndex] : null;

            return (
              <div
                key={item.id}
                className={`p-5 sm:p-6 rounded-3xl border transition-all duration-200 shadow-xl ${
                  isThisItemActive
                    ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/50 shadow-emerald-950/40'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/20'
                    : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Header Row: Title & Source */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base font-kufi flex items-center gap-2">
                        <span>{item.title}</span>
                        {isThisItemActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-sans border border-emerald-500/40 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>جارٍ الاستماع</span>
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] text-emerald-400 font-medium">
                        {item.source}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Audio, Navigate, Copy */}
                  <div className="flex items-center gap-1.5">
                    
                    {/* Quran Audio Button */}
                    {item.category === 'quranic' && (
                      <button
                        onClick={() => handleToggleQuranAudio(item)}
                        className={`py-1 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isThisItemPlayingQuran
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-md shadow-emerald-900/50'
                            : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-400'
                        }`}
                        title={isThisItemPlayingQuran ? 'إيقاف التلاوة' : 'استماع لتلاوة الآية'}
                      >
                        {isAudioLoading && playingItemId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : isThisItemPlayingQuran ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>إيقاف مؤقت</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>استماع للتلاوة</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Prophetic Speech Audio Button */}
                    {(item.category === 'prophetic' || item.category === 'sakina') && (
                      <button
                        onClick={() => handleTogglePropheticAudio(item)}
                        className={`py-1 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isThisItemSpeakingDua
                            ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-md shadow-teal-900/50'
                            : 'bg-slate-950 border-slate-800 hover:border-teal-500/50 text-slate-200 hover:text-teal-400'
                        }`}
                        title={isThisItemSpeakingDua ? 'إيقاف قراءة الدعاء' : 'استماع للدعاء بصوت واضح'}
                      >
                        {isThisItemSpeakingDua ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>إيقاف القراءة</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                            <span>استماع للدعاء</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Open in Mushaf button */}
                    {item.surahNumber && onNavigateToAyah && (
                      <button
                        onClick={() => onNavigateToAyah(item.surahNumber!, item.ayahNumber || 1)}
                        className="py-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="فتح السورة وقراءة الآية في المصحف الشريف"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">في المصحف</span>
                      </button>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="نسخ الآية وفضلها"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Text Content */}
                <div className="my-5 text-center px-2">
                  <p className="font-quran text-lg sm:text-2xl text-emerald-100 leading-loose select-text text-justify sm:text-center whitespace-pre-line">
                    {item.arabicText}
                  </p>
                </div>

                {/* In-Card Active Recitation Strip */}
                {isThisItemPlayingQuran && (
                  <div className="my-3 p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-emerald-400">
                        <span className="w-1 h-3 bg-emerald-400 animate-pulse rounded-full" />
                        <span className="w-1 h-4 bg-emerald-300 animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-2 bg-emerald-500 animate-pulse delay-150 rounded-full" />
                      </div>
                      <span className="text-white font-bold">بصوت: {selectedReciter.name}</span>
                      {item.audioSequence && item.audioSequence.length > 1 && (
                        <span className="text-emerald-300 font-mono bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-700/50">
                          {currentAyahSeq?.label || `آية ${playingAyahIndex + 1}/${item.audioSequence.length}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.audioSequence && item.audioSequence.length > 1 && playingAyahIndex + 1 < item.audioSequence.length && (
                        <button
                          onClick={() => playAyah(item.id, item.audioSequence!, playingAyahIndex + 1)}
                          className="py-1 px-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <span>الآية التالية</span>
                          <SkipForward className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={stopAllAudio}
                        className="py-1 px-2 rounded-lg bg-slate-900 text-slate-300 hover:text-rose-400 text-[11px] font-medium"
                      >
                        إيقاف
                      </button>
                    </div>
                  </div>
                )}

                {/* Virtue & Instruction Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 my-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 leading-relaxed">
                    <span className="font-bold text-amber-400 block mb-1">فضله وأثره النبوي:</span>
                    <span>{item.virtueAndFadl}</span>
                  </div>

                  {item.instruction && (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-200 leading-relaxed">
                      <span className="font-bold text-emerald-400 block mb-1">كيفية الرقية والتطبيق:</span>
                      <span>{item.instruction}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Interactive Counter Button */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span>التكرار المسنون:</span>
                    <strong className="text-white font-mono">{item.repeatTarget} {item.repeatTarget === 1 ? 'مرة' : 'مرات'}</strong>
                    {count > 0 && (
                      <span className="text-emerald-400 text-[10px] mr-1">
                        (أُنجز {count} من {item.repeatTarget})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <button
                        onClick={(e) => handleReset(item.id, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="إعادة تصفير العداد"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleIncrement(item)}
                      disabled={isCompleted}
                      className={`py-2 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-900/40'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>تم الورد بنجاح ✓ ({count}/{item.repeatTarget})</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>قراءة ({count} من {item.repeatTarget})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
