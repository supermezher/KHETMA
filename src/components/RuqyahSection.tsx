import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  RUQYAH_ITEMS,
  RUQYAH_ETIQUETTES,
  RuqyahItem,
  AudioAyahRef,
  getRuqyahEtiquetteTitle,
  getRuqyahEtiquetteDesc,
  getRuqyahItemTitle,
  getRuqyahItemSource,
  getRuqyahItemVirtue,
  getRuqyahItemGrade,
  getRuqyahItemInstruction,
  getRuqyahAudioStepLabel,
} from '../data/ruqyahData';
import {
  RECITERS_LIST,
  Reciter,
  getAyahAudioUrl,
  getReciterDisplayCountry,
  getReciterDisplayName,
} from '../data/reciters';
import { SURAHS_LIST, getSurahDisplayName } from '../data/quranMetadata';
import { safeLocalStorage } from '../utils/safeStorage';
import { formatLocalizedDigits, useLanguage } from '../utils/i18n';
import {
  ShieldCheck, Sparkles, BookOpen, Heart, Volume2, Copy, Check,
  RotateCcw, Info, Compass, CheckCircle2, Pause, Square,
  SkipForward, ChevronDown, User, RefreshCw, Plus, Trash2, X,
  AlertCircle
} from 'lucide-react';

interface RuqyahSectionProps {
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onPlayAyahAudio?: (ayahNumber: number, surahNumber?: number) => void;
}

type TabType = 'all' | 'quranic' | 'prophetic' | 'sakina' | 'custom' | 'etiquette';

export const RuqyahSection: React.FC<RuqyahSectionProps> = ({
  onNavigateToAyah,
}) => {
  const { lang, isEnglish } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom User/Developer added Ruqyah items (stored in safeLocalStorage)
  const [customItems, setCustomItems] = useState<RuqyahItem[]>(() => {
    return safeLocalStorage.getJSON<RuqyahItem[]>('bayan_custom_ruqyah_items', []);
  });

  // In-app toast & restore confirmation (replaces browser alert/confirm)
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatusToast = useCallback((msg: string) => {
    setStatusToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setStatusToast(null), 3500);
  }, []);

  // Modal state for adding a new item
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<'quranic' | 'prophetic' | 'sakina'>('quranic');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemSource, setNewItemSource] = useState('');
  const [newItemArabicText, setNewItemArabicText] = useState('');
  const [newItemRepeatTarget, setNewItemRepeatTarget] = useState(3);
  const [newItemVirtue, setNewItemVirtue] = useState('');
  const [newItemInstruction, setNewItemInstruction] = useState('');
  
  // Quranic specific form state
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(1);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);
  const [formError, setFormError] = useState<string | null>(null);

  // Reciter & Audio state
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS_LIST[0]); // Default: Mishary Alafasy
  const [isReciterMenuOpen, setIsReciterMenuOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoLoopUntilTarget, setAutoLoopUntilTarget] = useState<boolean>(true);

  // Close open modals/menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isRestoreConfirmOpen) setIsRestoreConfirmOpen(false);
        if (isReciterMenuOpen) setIsReciterMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, isRestoreConfirmOpen, isReciterMenuOpen]);

  // Active playing card state
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [playingAyahIndex, setPlayingAyahIndex] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

  // Prophetic speech state
  const [isSpeakingDua, setIsSpeakingDua] = useState<boolean>(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Memoize combined items so downstream effects/renders remain stable
  const allItems: RuqyahItem[] = useMemo(() => [...customItems, ...RUQYAH_ITEMS], [customItems]);

  // Keep latest mutable refs for stable audio event callbacks
  const allItemsRef = useRef(allItems);
  const countersRef = useRef(counters);
  const autoLoopRef = useRef(autoLoopUntilTarget);
  const playingItemIdRef = useRef(playingItemId);
  const playingAyahIndexRef = useRef(playingAyahIndex);
  const selectedReciterRef = useRef(selectedReciter);
  const playbackSpeedRef = useRef(playbackSpeed);

  allItemsRef.current = allItems;
  countersRef.current = counters;
  autoLoopRef.current = autoLoopUntilTarget;
  playingItemIdRef.current = playingItemId;
  playingAyahIndexRef.current = playingAyahIndex;
  selectedReciterRef.current = selectedReciter;
  playbackSpeedRef.current = playbackSpeed;

  // Save custom items whenever updated
  const saveCustomItems = (items: RuqyahItem[]) => {
    setCustomItems(items);
    safeLocalStorage.setJSON('bayan_custom_ruqyah_items', items);
  };

  // Delete a single custom item
  const handleDeleteCustomItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingItemId === id) {
      stopAllAudio();
    }
    const updated = customItems.filter((i) => i.id !== id);
    saveCustomItems(updated);
  };

  // Clear all custom items (revert to default via in-app confirm dialog)
  const handleRestoreDefaults = () => {
    setIsRestoreConfirmOpen(true);
  };

  const confirmRestoreDefaults = () => {
    stopAllAudio();
    saveCustomItems([]);
    setIsRestoreConfirmOpen(false);
    showStatusToast(
      isEnglish
        ? 'Default Ruqyah list restored successfully.'
        : 'تمت استعادة قائمة الرقية الشرعية الافتراضية بنجاح'
    );
  };

  // Filter items based on active tab
  const filteredItems = allItems.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'custom') return item.isCustom;
    if (activeTab === 'quranic') return item.category === 'quranic';
    if (activeTab === 'prophetic') return item.category === 'prophetic';
    if (activeTab === 'sakina') return item.category === 'sakina';
    return true;
  });

  // Calculate completed count
  const completedCount = allItems.filter(
    (item) => (counters[item.id] || 0) >= item.repeatTarget
  ).length;

  // Repetition counters
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
    const title = getRuqyahItemTitle(item, lang);
    const source = getRuqyahItemSource(item, lang);
    const virtue = getRuqyahItemVirtue(item, lang);
    const textToCopy = isEnglish
      ? `${title}\n\n${item.arabicText}\n\n[Source: ${source}]\nVirtue: ${virtue}\nFrom Bayan App - Digital Qur'an Mus'haf`
      : `${title}\n\n${item.arabicText}\n\n[المصدر: ${source}]\nفضله: ${virtue}\nمن تطبيق بَيَان - المصحف الرقمي الوقفي`;
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

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsSpeakingDua(false);
    setPlayingItemId(null);
    setPlayingAyahIndex(0);
  }, []);

  const handleToggleQuranAudio = (item: RuqyahItem) => {
    if (playingItemId === item.id) {
      if (isPlayingAudio) {
        audioRef.current?.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current?.play().then(() => setIsPlayingAudio(true)).catch(() => {
          showStatusToast(
            isEnglish
              ? 'Unable to resume recitation audio; please check your connection.'
              : 'تعذر استئناف التلاوة الصوتية، يرجى التحقق من الاتصال'
          );
        });
      }
      return;
    }

    stopAllAudio();

    if (!item.audioSequence || item.audioSequence.length === 0) {
      if (item.surahNumber && item.ayahNumber) {
        playAyah(item.id, [{ surah: item.surahNumber, ayah: item.ayahNumber }], 0);
      }
      return;
    }

    playAyah(item.id, item.audioSequence, 0);
  };

  const playAyah = useCallback((itemId: string, sequence: AudioAyahRef[], index: number) => {
    if (!sequence[index]) return;
    const { surah, ayah } = sequence[index];
    const url = getAyahAudioUrl(selectedReciterRef.current.serverKey, surah, ayah);

    setPlayingItemId(itemId);
    setPlayingAyahIndex(index);
    setIsAudioLoading(true);

    if (!audioRef.current) {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackSpeedRef.current;
        }
      };
      audio.onended = () => {
        const currentId = playingItemIdRef.current;
        if (!currentId) return;
        const item = allItemsRef.current.find((i) => i.id === currentId);
        const resolvedSequence: AudioAyahRef[] | undefined =
          item?.audioSequence && item.audioSequence.length > 0
            ? item.audioSequence
            : item?.surahNumber && item?.ayahNumber
            ? [{ surah: item.surahNumber, ayah: item.ayahNumber }]
            : undefined;

        if (!item || !resolvedSequence) {
          stopAllAudio();
          return;
        }

        const nextIndex = playingAyahIndexRef.current + 1;
        if (nextIndex < resolvedSequence.length) {
          playAyah(item.id, resolvedSequence, nextIndex);
        } else {
          handleIncrement(item);

          const nextCount = (countersRef.current[item.id] || 0) + 1;
          if (autoLoopRef.current && nextCount < item.repeatTarget) {
            playAyah(item.id, resolvedSequence, 0);
          } else {
            setIsPlayingAudio(false);
            setPlayingAyahIndex(0);
          }
        }
      };
      audio.onerror = () => {
        setIsAudioLoading(false);
        setIsPlayingAudio(false);
        showStatusToast(
          isEnglish
            ? 'Unable to load recitation audio from server; please check your connection.'
            : 'تعذر تحميل ملف التلاوة من الخادم، تحقق من اتصال الإنترنت'
        );
      };
      audioRef.current = audio;
    }

    audioRef.current.src = url;
    audioRef.current.playbackRate = playbackSpeedRef.current;
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
  }, [stopAllAudio, showStatusToast, isEnglish]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Reset paused/active audio when user changes reciter so next play loads the new reciter
  useEffect(() => {
    stopAllAudio();
  }, [selectedReciter.serverKey, stopAllAudio]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleTogglePropheticAudio = (item: RuqyahItem) => {
    if (playingItemId === item.id && isSpeakingDua) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeakingDua(false);
      setPlayingItemId(null);
      return;
    }

    stopAllAudio();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showStatusToast(
        isEnglish
          ? 'Speech synthesis for prophetic duas is not supported in this browser.'
          : 'ميزة النطق الصوتي للأدعية غير مدعومة في هذا المتصفح'
      );
      return;
    }

    const textToSpeak = item.arabicText.replace(/[«»]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.85;
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

  // -------------------------------------------------------------
  // CUSTOM ITEM MODAL HANDLER
  // -------------------------------------------------------------
  const handleOpenAddModal = () => {
    const fatiha = SURAHS_LIST[0];
    setNewItemCategory('quranic');
    setNewItemTitle('');
    setSelectedSurahNumber(1);
    setFromAyah(1);
    setToAyah(7);
    setNewItemSource(
      isEnglish
        ? `${getSurahDisplayName(fatiha, 'en')}: 1 - 7`
        : 'سورة الفاتحة: 1 - 7'
    );
    setNewItemArabicText('');
    setNewItemRepeatTarget(3);
    setNewItemVirtue('');
    setNewItemInstruction('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSurahChange = (surahNum: number) => {
    setSelectedSurahNumber(surahNum);
    const surah = SURAHS_LIST.find((s) => s.number === surahNum);
    if (surah) {
      setFromAyah(1);
      const defaultTo = Math.min(surah.numberOfAyahs, 5);
      setToAyah(defaultTo);
      setNewItemSource(
        isEnglish
          ? `${getSurahDisplayName(surah, 'en')}: 1${defaultTo > 1 ? ` - ${defaultTo}` : ''}`
          : `سورة ${surah.name}: 1${defaultTo > 1 ? ` - ${defaultTo}` : ''}`
      );
    }
  };

  const handleAyahRangeChange = (from: number, to: number) => {
    const surah = SURAHS_LIST.find((s) => s.number === selectedSurahNumber);
    const maxAyahs = surah?.numberOfAyahs || 1;
    const safeFrom = Math.max(1, Math.min(from, maxAyahs));
    const safeTo = Math.max(safeFrom, Math.min(to, maxAyahs));
    setFromAyah(safeFrom);
    setToAyah(safeTo);
    if (surah) {
      setNewItemSource(
        isEnglish
          ? `${getSurahDisplayName(surah, 'en')}: ${safeFrom}${safeTo > safeFrom ? ` - ${safeTo}` : ''}`
          : `سورة ${surah.name}: ${safeFrom}${safeTo > safeFrom ? ` - ${safeTo}` : ''}`
      );
    }
  };

  const handleSubmitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) {
      setFormError(isEnglish ? 'Please enter a title for the Ruqyah entry.' : 'يرجى إدخال عنوان الورد المبارك');
      return;
    }
    if (!newItemArabicText.trim()) {
      setFormError(
        isEnglish
          ? 'Please enter the Arabic Quranic or Dua text.'
          : 'يرجى إدخال نص الآية أو الدعاء باللغة العربية'
      );
      return;
    }

    const surah = SURAHS_LIST.find((s) => s.number === selectedSurahNumber);
    let sequence: AudioAyahRef[] | undefined = undefined;

    if (newItemCategory === 'quranic') {
      sequence = [];
      for (let a = fromAyah; a <= toAyah; a++) {
        sequence.push({
          surah: selectedSurahNumber,
          ayah: a,
          label: `${surah?.name || 'سورة'}: ${a}`,
          labelEn: `${surah ? getSurahDisplayName(surah, 'en') : 'Surah'}: ${a}`,
        });
      }
    }

    const finalItem: RuqyahItem = {
      id: `custom-${Date.now()}`,
      category: newItemCategory,
      title: newItemTitle.trim(),
      source:
        newItemSource.trim() ||
        (newItemCategory === 'quranic'
          ? isEnglish
            ? `${surah ? getSurahDisplayName(surah, 'en') : 'Surah'}`
            : `سورة ${surah?.name}`
          : isEnglish
          ? 'Authentic Narration'
          : 'مأثور'),
      arabicText: newItemArabicText.trim(),
      repeatTarget: Math.max(1, newItemRepeatTarget),
      virtueAndFadl:
        newItemVirtue.trim() ||
        (isEnglish
          ? 'A blessed verse / supplication for healing, protection, and comfort by Allah’s leave.'
          : 'آية / دعاء مبارك للشفاء والتحصين ودفع البلاء بإذن الله.'),
      instruction: newItemInstruction.trim() || undefined,
      surahNumber: newItemCategory === 'quranic' ? selectedSurahNumber : undefined,
      ayahNumber: newItemCategory === 'quranic' ? fromAyah : undefined,
      audioSequence: sequence,
      isCustom: true,
      createdAt: new Date().toLocaleDateString(isEnglish ? 'en-US' : 'ar-SA')
    };

    saveCustomItems([finalItem, ...customItems]);
    setIsAddModalOpen(false);
  };

  const currentSelectedSurah = SURAHS_LIST.find((s) => s.number === selectedSurahNumber);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">
      
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1] dark:from-[#142038] dark:via-[#10161f] dark:to-[#0f172a] border border-[#8A6418]/30 dark:border-[#D9B45A]/30 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-xl bg-[#D9B45A]/15 text-[#8A6418] dark:text-[#D9B45A] text-xs font-bold border border-[#8A6418]/30 dark:border-[#D9B45A]/40 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>
                {isEnglish
                  ? 'Authentic Ruqyah from the Quran & Sunnah'
                  : 'الرقية الشرعية المحققة من القرآن والسنة'}
              </span>
            </div>
            <h1
              dir="rtl"
              lang="ar"
              className="text-2xl sm:text-3xl font-extrabold text-[#1B1A17] dark:text-[#F6EFDD] font-kufi tracking-tight"
            >
              وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ
            </h1>
            {isEnglish && (
              <p className="text-xs font-semibold text-[#8A6418] dark:text-[#D9B45A] italic">
                “And We send down of the Qur’an that which is healing and mercy for the believers…” (Al-Isra: 82)
              </p>
            )}
            <p className="text-xs sm:text-sm text-[#5C5549] dark:text-slate-300 leading-relaxed">
              {isEnglish
                ? 'A comprehensive fortress of authentic healing verses and prophetic supplications for protection and inner peace, complete with reciter audio playback, repeat counters, and custom entries.'
                : 'حصن المسلم الجامع لآيات الشفاء والتحصين من العين والسحر، مع الاستماع المباشر بصوت كبار القراء، وعداد تكرار تفاعلي، وإمكانية إضافة أوراد مخصصة.'}
            </p>
          </div>

          {/* Daily Progress Card & Add Button */}
          <div className="w-full md:w-auto shrink-0 bg-[#EFE6D1] dark:bg-slate-950/80 border border-[#8A6418]/25 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center min-w-[210px] shadow-lg">
            <div className="text-[11px] text-[#5C5549] dark:text-slate-400 font-semibold mb-1">
              {isEnglish ? 'Today’s Ruqyah Progress' : 'إنجاز رقية اليوم'}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#8A6418] dark:text-[#D9B45A] font-mono tabular-nums">
                {formatLocalizedDigits(completedCount, lang)}
              </span>
              <span className="text-xs text-[#5C5549] dark:text-slate-400">
                {isEnglish
                  ? `of ${allItems.length} items`
                  : `من ${formatLocalizedDigits(allItems.length, lang)} أوراد`}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[#E0D4B7] dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1F3A6E] to-[#D9B45A] transition-all duration-300 rounded-full"
                style={{ width: `${(completedCount / allItems.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleOpenAddModal}
                className="py-1.5 px-3 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title={isEnglish ? 'Add a custom Ruqyah entry' : 'إضافة ورد جديد للرقية الشرعية'}
              >
                <Plus className="w-3.5 h-3.5 text-[#D9B45A]" />
                <span>{isEnglish ? 'Add Custom Entry' : 'إضافة ورد جديد'}</span>
              </button>

              {completedCount > 0 && (
                <button
                  onClick={handleResetAll}
                  className="p-1.5 rounded-xl text-[#5C5549] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#E4D7BA] dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  title={isEnglish ? 'Reset all daily counters' : 'إعادة تصفير عدادات الأوراد'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 end-0 -me-16 -mt-16 w-64 h-64 bg-[#D9B45A]/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Sharia & Medical Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-[#8A6418]/30 dark:border-amber-500/30 text-[#4A3B12] dark:text-amber-200 text-xs leading-relaxed flex items-start sm:items-center gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#8A6418] dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <div>
          <strong className="font-bold text-[#8A6418] dark:text-amber-300 block sm:inline sm:me-1">
            {isEnglish ? 'Important Islamic & Medical Note:' : 'تنبيه شرعي وطبي هام:'}
          </strong>
          <span>
            {isEnglish
              ? 'Ruqyah and supplication are blessed spiritual means for healing and serenity, and do not replace consulting a qualified physician or taking prescribed medical treatment—in obedience to the authentic prophetic guidance: “Seek medical treatment, for Allah has not created a disease without also providing its cure.”'
              : 'الرقية الشرعية والدعاء سببان شرعيان مباركان للشفاء واستجلاب البركة، ولا يُغنيان عن مراجعة الطبيب المختص والأخذ بالأسباب الطبية المادية وتناول العلاج الموصوف؛ عملاً بالحديث الشريف الصحيح: «تَدَاوَوْا فَإِنَّ اللَّهَ لَمْ يَضَعْ دَاءً إِلَّا وَضَعَ لَهُ شِفَاءً» (رواه الإمام أحمد وأصحاب السنن).'}
          </span>
        </div>
      </div>

      {/* Ruqyah Audio & Controls Strip */}
      <div className="bg-[#FBF7EE] dark:bg-slate-900/90 border border-[#8A6418]/25 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#D9B45A]/15 border border-[#8A6418]/30 dark:border-[#D9B45A]/30 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A]">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#1B1A17] dark:text-white block">
              {isEnglish ? 'Ruqyah Recitation Audio' : 'صوت التلاوة للرقية'}
            </span>
            <span className="text-[11px] text-[#5C5549] dark:text-slate-400">
              {isEnglish ? 'Choose a reciter and listen to verses of healing' : 'اختر القارئ واستمع لآيات الشفاء'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Reciter Selector */}
          <div className="relative">
            <button
              onClick={() => setIsReciterMenuOpen(!isReciterMenuOpen)}
              className="py-1.5 px-3 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 hover:border-[#8A6418]/50 dark:hover:border-slate-700 text-xs text-[#1B1A17] dark:text-slate-200 font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>{getReciterDisplayName(selectedReciter, lang)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#5C5549] dark:text-slate-400" />
            </button>

            {isReciterMenuOpen && (
              <div className="absolute start-0 mt-1.5 w-64 max-h-60 overflow-y-auto bg-[#FBF7EE] dark:bg-slate-950 border border-[#8A6418]/30 dark:border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50">
                <div className="text-[11px] font-bold text-[#5C5549] dark:text-slate-400 px-2.5 py-1.5 border-b border-[#8A6418]/15 dark:border-slate-800">
                  {isEnglish ? 'Select preferred Ruqyah reciter:' : 'اختر القارئ المفضل للرقية:'}
                </div>
                {RECITERS_LIST.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedReciter(r);
                      setIsReciterMenuOpen(false);
                      if (playingItemId) {
                        const item = allItems.find(i => i.id === playingItemId);
                        if (item && item.audioSequence) {
                          playAyah(item.id, item.audioSequence, playingAyahIndex);
                        }
                      }
                    }}
                    className={`w-full text-start px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedReciter.id === r.id
                        ? 'bg-[#1F3A6E] text-[#F6EFDD] font-bold'
                        : 'text-[#1B1A17] dark:text-slate-300 hover:bg-[#EFE6D1] dark:hover:bg-slate-900'
                    }`}
                  >
                    <span>{getReciterDisplayName(r, lang)}</span>
                    <span className={`text-[10px] ${selectedReciter.id === r.id ? 'text-[#D9B45A]' : 'text-[#5C5549] dark:text-slate-500'}`}>
                      {getReciterDisplayCountry(r, lang)}
                    </span>
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
                ? 'bg-[#D9B45A]/20 border-[#8A6418] dark:border-[#D9B45A]/50 text-[#8A6418] dark:text-[#D9B45A]'
                : 'bg-[#EFE6D1] dark:bg-slate-950 border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
            }`}
            title={isEnglish ? 'Automatically repeat until target count' : 'تكرار الآية تلقائياً بعدد المرات المسنونة'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoLoopUntilTarget ? 'text-[#8A6418] dark:text-[#D9B45A] animate-spin-slow' : ''}`} />
            <span>{isEnglish ? 'Auto Repeat' : 'تكرار تلقائي للورد'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 rounded-xl p-0.5 text-xs font-mono">
            {[1.0, 1.25].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] font-bold'
                    : 'text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Restore Defaults button if custom items exist */}
          {customItems.length > 0 && (
            <button
              onClick={handleRestoreDefaults}
              className="py-1.5 px-3 rounded-xl bg-amber-500/15 border border-[#8A6418]/35 text-[#8A6418] dark:text-amber-300 text-xs font-medium flex items-center gap-1 hover:bg-amber-500/25 transition-colors cursor-pointer"
              title={isEnglish ? 'Remove custom entries and restore default list' : 'حذف جميع الأوراد المضافة واسترجاع القائمة الافتراضية'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {isEnglish
                  ? `Restore Defaults (${customItems.length} custom)`
                  : `استعادة الأصل (${formatLocalizedDigits(customItems.length, lang)} مضاف)`}
              </span>
            </button>
          )}

          {/* Stop Audio Button if playing */}
          {(isPlayingAudio || isSpeakingDua) && (
            <button
              onClick={stopAllAudio}
              className="py-1.5 px-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1 hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isEnglish ? 'Stop Audio' : 'إيقاف الصوت'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none">
        {[
          { id: 'all', label: isEnglish ? 'All Ruqyah' : 'الرقية الشاملة', count: allItems.length, icon: Sparkles },
          ...(customItems.length > 0
            ? [{ id: 'custom', label: isEnglish ? 'My Custom Items' : 'أورادي المضافة', count: customItems.length, icon: Plus }]
            : []),
          { id: 'quranic', label: isEnglish ? 'Quranic Healing' : 'آيات الشفاء والحفظ', count: allItems.filter(i => i.category === 'quranic').length, icon: BookOpen },
          { id: 'prophetic', label: isEnglish ? 'Prophetic Duas' : 'الأدعية النبوية', count: allItems.filter(i => i.category === 'prophetic').length, icon: ShieldCheck },
          { id: 'sakina', label: isEnglish ? 'Serenity & Calm' : 'سكينة وطرد القلق', count: allItems.filter(i => i.category === 'sakina').length, icon: Heart },
          { id: 'etiquette', label: isEnglish ? 'Etiquette & Sunnah' : 'آداب وسنن الرقية', count: RUQYAH_ETIQUETTES.length, icon: Compass },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1F3A6E] text-[#F6EFDD] shadow-lg ring-1 ring-[#D9B45A]/60'
                  : 'bg-[#FBF7EE] dark:bg-slate-900/80 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#8A6418]/20 dark:border-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#D9B45A]' : ''}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-lg tabular-nums ${
                isActive ? 'bg-white/20 text-[#F6EFDD]' : 'bg-[#EFE6D1] dark:bg-slate-800 text-[#5C5549] dark:text-slate-400'
              }`}>
                {formatLocalizedDigits(tab.count, lang)}
              </span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: ETIQUETTE & SUNNAH GUIDE */}
      {activeTab === 'etiquette' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-800">
            <h3 className="font-bold text-[#1B1A17] dark:text-white text-sm mb-1 flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>{isEnglish ? 'Conditions & Etiquette of Authentic Ruqyah' : 'شروط وآداب الرقية الشرعية الصحيحة'}</span>
            </h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-400">
              {isEnglish
                ? 'Scholars agree that Ruqyah is sound and beneficial when it fulfills the following prophetic conditions:'
                : 'أجمع أهل العلم على أن الرقية تكون مشروعة ونافعة إذا تحققت فيها الشروط النبوية التالية:'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RUQYAH_ETIQUETTES.map((eti) => (
              <div
                key={eti.id}
                className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900/90 border border-[#8A6418]/25 dark:border-slate-800 flex items-start gap-3.5 hover:border-[#8A6418]/45 dark:hover:border-slate-700 transition-colors shadow-md"
              >
                <div className="w-9 h-9 rounded-xl bg-[#D9B45A]/15 border border-[#8A6418]/30 dark:border-[#D9B45A]/30 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A] shrink-0 font-bold text-sm tabular-nums">
                  {formatLocalizedDigits(eti.id, lang)}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[#1B1A17] dark:text-white text-sm">
                    {getRuqyahEtiquetteTitle(eti, lang)}
                  </h4>
                  <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
                    {getRuqyahEtiquetteDesc(eti, lang)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Golden Reminder Card */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-[#8A6418]/30 dark:border-amber-500/30 text-[#4A3B12] dark:text-amber-200 text-xs leading-relaxed flex items-center gap-3">
            <Info className="w-5 h-5 text-[#8A6418] dark:text-amber-400 shrink-0" />
            <span>
              <strong>{isEnglish ? 'Prophetic Reminder:' : 'تذكير نبوي:'}</strong>{' '}
              {isEnglish
                ? 'The best Ruqyah is when a Muslim recites for themselves with sincere reliance on Allah (Tawakkul), following the practice of the Prophet ﷺ.'
                : 'أفضل ما يرقي به المسلم نفسه هو أن يرقي نفسه بنفسه دون الذهاب لأحد؛ اقتداءً برسول الله ﷺ وأخذاً بمسلك التوكل التام وصدق الالتجاء.'}
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
            const displayTitle = getRuqyahItemTitle(item, lang);
            const displaySource = getRuqyahItemSource(item, lang);
            const displayGrade = getRuqyahItemGrade(item, lang);
            const displayVirtue = getRuqyahItemVirtue(item, lang);
            const displayInstruction = getRuqyahItemInstruction(item, lang);

            return (
              <div
                key={item.id}
                className={`p-5 sm:p-6 rounded-3xl border transition-all duration-200 shadow-xl ${
                  isThisItemActive
                    ? 'bg-[#EFE6D1] dark:bg-[#142038]/80 border-[#8A6418] dark:border-[#D9B45A] ring-1 ring-[#D9B45A]/50'
                    : isCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-600/40 dark:border-emerald-500/40'
                    : 'bg-[#FBF7EE] dark:bg-slate-900/90 border-[#8A6418]/25 dark:border-slate-800/90 hover:border-[#8A6418]/45 dark:hover:border-slate-700'
                }`}
              >
                {/* Header Row: Title & Source */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/50 border border-[#8A6418]/25 dark:border-[#648CD4]/35 text-[#8A6418] dark:text-[#D9B45A] font-bold text-xs flex items-center justify-center tabular-nums">
                      {formatLocalizedDigits(index + 1, lang)}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#1B1A17] dark:text-white text-sm sm:text-base font-kufi flex items-center gap-2 flex-wrap">
                        <span>{displayTitle}</span>
                        {item.isCustom && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/40 text-[#1F3A6E] dark:text-[#648CD4] border border-[#1F3A6E]/25 font-sans">
                            {isEnglish ? 'Custom Entry' : 'ورد مضاف يدوياً'}
                          </span>
                        )}
                        {isThisItemActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#D9B45A]/20 text-[#8A6418] dark:text-[#D9B45A] text-[10px] font-sans border border-[#8A6418]/35 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D9B45A] animate-ping" />
                            <span>{isEnglish ? 'Playing' : 'جارٍ الاستماع'}</span>
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-medium">
                          {displaySource}
                        </span>
                        {displayGrade && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EFE6D1] dark:bg-slate-800 text-[#5C5549] dark:text-slate-300 border border-[#8A6418]/20 dark:border-slate-700 font-semibold font-sans">
                            {displayGrade}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Audio, Navigate, Copy, Delete */}
                  <div className="flex items-center gap-1.5">
                    
                    {/* Quran Audio Button */}
                    {item.category === 'quranic' && (
                      <button
                        onClick={() => handleToggleQuranAudio(item)}
                        className={`py-1 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isThisItemPlayingQuran
                            ? 'bg-[#D9B45A] text-[#1B1A17] border-[#8A6418] font-bold shadow-md'
                            : 'bg-[#EFE6D1] dark:bg-slate-950 border-[#8A6418]/25 dark:border-slate-800 hover:border-[#8A6418] dark:hover:border-[#D9B45A]/50 text-[#1B1A17] dark:text-slate-200 hover:text-[#8A6418] dark:hover:text-[#D9B45A]'
                        }`}
                        title={
                          isThisItemPlayingQuran
                            ? isEnglish
                              ? 'Pause recitation'
                              : 'إيقاف التلاوة'
                            : isEnglish
                            ? 'Listen to Ayah recitation'
                            : 'استماع لتلاوة الآية'
                        }
                      >
                        {isAudioLoading && playingItemId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8A6418] dark:text-[#D9B45A]" />
                        ) : isThisItemPlayingQuran ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>{isEnglish ? 'Pause' : 'إيقاف مؤقت'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                            <span>{isEnglish ? 'Listen' : 'استماع للتلاوة'}</span>
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
                            ? 'bg-[#D9B45A] text-[#1B1A17] border-[#8A6418] font-bold shadow-md'
                            : 'bg-[#EFE6D1] dark:bg-slate-950 border-[#8A6418]/25 dark:border-slate-800 hover:border-[#8A6418] text-[#1B1A17] dark:text-slate-200'
                        }`}
                        title={
                          isThisItemSpeakingDua
                            ? isEnglish
                              ? 'Stop Arabic Dua speech'
                              : 'إيقاف قراءة الدعاء'
                            : isEnglish
                            ? 'Listen to Arabic Dua aloud'
                            : 'استماع للدعاء بصوت واضح'
                        }
                      >
                        {isThisItemSpeakingDua ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>{isEnglish ? 'Stop' : 'إيقاف القراءة'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
                            <span>{isEnglish ? 'Hear Dua' : 'استماع للدعاء'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Open in Mushaf button */}
                    {item.surahNumber && onNavigateToAyah && (
                      <button
                        onClick={() => onNavigateToAyah(item.surahNumber!, item.ayahNumber || 1)}
                        className="py-1 px-2.5 rounded-lg bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 hover:border-[#8A6418] dark:hover:border-slate-700 text-[#1B1A17] dark:text-slate-300 hover:text-[#1F3A6E] dark:hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title={isEnglish ? 'Open in Mushaf reader' : 'فتح السورة وقراءة الآية في المصحف الشريف'}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                        <span className="hidden sm:inline">{isEnglish ? 'In Mushaf' : 'في المصحف'}</span>
                      </button>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1.5 rounded-lg bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 hover:border-[#8A6418] dark:hover:border-slate-700 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white transition-colors cursor-pointer"
                      title={isEnglish ? 'Copy text & virtue' : 'نسخ الآية وفضلها'}
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete Custom Item Button */}
                    {item.isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustomItem(item.id, e)}
                        className="p-1.5 rounded-lg bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 hover:border-rose-500/50 text-[#5C5549] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title={isEnglish ? 'Delete custom entry' : 'حذف هذا الورد المضاف يدوياً'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Text Content (Kept strictly RTL Arabic for Qur'an and Duas) */}
                <div dir="rtl" lang="ar" className="my-5 text-center px-2">
                  <p className="font-quran text-lg sm:text-2xl text-[#1B1A17] dark:text-[#F6EFDD] leading-loose select-text text-justify sm:text-center whitespace-pre-line">
                    {item.arabicText}
                  </p>
                </div>

                {/* In-Card Active Recitation Strip */}
                {isThisItemPlayingQuran && (
                  <div className="my-3 p-3 rounded-2xl bg-[#EFE6D1] dark:bg-[#142038]/80 border border-[#8A6418]/35 dark:border-[#D9B45A]/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[#8A6418] dark:text-[#D9B45A]">
                        <span className="w-1 h-3 bg-[#8A6418] dark:bg-[#D9B45A] animate-pulse rounded-full" />
                        <span className="w-1 h-4 bg-[#1F3A6E] dark:bg-[#648CD4] animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-2 bg-[#8A6418] dark:bg-[#D9B45A] animate-pulse delay-150 rounded-full" />
                      </div>
                      <span className="text-[#1B1A17] dark:text-white font-bold">
                        {isEnglish
                          ? `Reciter: ${getReciterDisplayName(selectedReciter, lang)}`
                          : `بصوت: ${selectedReciter.name}`}
                      </span>
                      {item.audioSequence && item.audioSequence.length > 1 && (
                        <span className="text-[#1F3A6E] dark:text-[#D9B45A] font-mono bg-white/70 dark:bg-slate-900/80 px-2 py-0.5 rounded-lg border border-[#8A6418]/25">
                          {currentAyahSeq
                            ? getRuqyahAudioStepLabel(currentAyahSeq, lang)
                            : isEnglish
                            ? `Ayah ${playingAyahIndex + 1}/${item.audioSequence.length}`
                            : `آية ${playingAyahIndex + 1}/${item.audioSequence.length}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.audioSequence && item.audioSequence.length > 1 && playingAyahIndex + 1 < item.audioSequence.length && (
                        <button
                          onClick={() => playAyah(item.id, item.audioSequence!, playingAyahIndex + 1)}
                          className="py-1 px-2 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>{isEnglish ? 'Next Ayah' : 'الآية التالية'}</span>
                          <SkipForward className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={stopAllAudio}
                        className="py-1 px-2 rounded-lg bg-white/70 dark:bg-slate-900 text-[#5C5549] dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-medium cursor-pointer"
                      >
                        {isEnglish ? 'Stop' : 'إيقاف'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Virtue & Instruction Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 my-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#EFE6D1]/80 dark:bg-slate-950/70 border border-[#8A6418]/15 dark:border-slate-800/80 text-[#1B1A17] dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] block mb-1">
                      {isEnglish ? 'Virtue & Prophetic Impact:' : 'فضله وأثره النبوي:'}
                    </span>
                    <span>{displayVirtue}</span>
                  </div>

                  {displayInstruction && (
                    <div className="p-3 rounded-xl bg-[#1F3A6E]/8 dark:bg-[#142038]/50 border border-[#1F3A6E]/20 dark:border-[#648CD4]/30 text-[#1B1A17] dark:text-slate-200 leading-relaxed">
                      <span className="font-bold text-[#1F3A6E] dark:text-[#648CD4] block mb-1">
                        {isEnglish ? 'How to Practice:' : 'كيفية الرقية والتطبيق:'}
                      </span>
                      <span>{displayInstruction}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Interactive Counter Button */}
                <div className="pt-3 border-t border-[#8A6418]/15 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-[#5C5549] dark:text-slate-400 flex items-center gap-1.5">
                    <span>{isEnglish ? 'Sunnah Count:' : 'التكرار المسنون:'}</span>
                    <strong className="text-[#1B1A17] dark:text-white font-mono tabular-nums">
                      {isEnglish
                        ? `${item.repeatTarget} ${item.repeatTarget === 1 ? 'time' : 'times'}`
                        : `${formatLocalizedDigits(item.repeatTarget, lang)} ${item.repeatTarget === 1 ? 'مرة' : 'مرات'}`}
                    </strong>
                    {count > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400 text-[10px] ms-1">
                        {isEnglish
                          ? `(${count} of ${item.repeatTarget} done)`
                          : `(أُنجز ${formatLocalizedDigits(count, lang)} من ${formatLocalizedDigits(item.repeatTarget, lang)})`}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <button
                        onClick={(e) => handleReset(item.id, e)}
                        className="p-2 rounded-xl text-[#5C5549] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isEnglish ? 'Reset counter' : 'إعادة تصفير العداد'}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleIncrement(item)}
                      disabled={isCompleted}
                      className={`py-2 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all shadow-md cursor-pointer tabular-nums ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/40 cursor-default'
                          : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] active:scale-95'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {isEnglish
                              ? `Completed ✓ (${count}/${item.repeatTarget})`
                              : `تم الورد بنجاح ✓ (${formatLocalizedDigits(count, lang)}/${formatLocalizedDigits(item.repeatTarget, lang)})`}
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-[#D9B45A]" />
                          <span>
                            {isEnglish
                              ? `Recite (${count} of ${item.repeatTarget})`
                              : `قراءة (${formatLocalizedDigits(count, lang)} من ${formatLocalizedDigits(item.repeatTarget, lang)})`}
                          </span>
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

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOM RUQYAH ITEM                                            */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-ruqyah-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D9B45A]/15 border border-[#8A6418]/30 dark:border-[#D9B45A]/30 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="add-ruqyah-title" className="font-bold text-[#1B1A17] dark:text-white text-base font-kufi">
                    {isEnglish ? 'Add Custom Ruqyah Entry' : 'إضافة ورد أو آية جديدة للرقية'}
                  </h3>
                  <p className="text-[11px] text-[#5C5549] dark:text-slate-400">
                    {isEnglish
                      ? 'Saved locally with full audio playback, repeat counter, and Mushaf navigation'
                      : 'ستُحفظ في التطبيق وتعمل بكامل خصائص الصوت والعداد والتنقل'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                aria-label={isEnglish ? 'Close modal' : 'إغلاق'}
                className="p-1.5 rounded-xl text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewItem} className="space-y-4">
              
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1.5">
                  {isEnglish ? 'Entry Type:' : 'نوع الورد:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quranic', label: isEnglish ? 'Quranic Verses' : 'آية قرآنية', icon: BookOpen },
                    { id: 'prophetic', label: isEnglish ? 'Prophetic Dua' : 'دعاء نبوي', icon: ShieldCheck },
                    { id: 'sakina', label: isEnglish ? 'Serenity Dua' : 'دعاء سكينة وكرب', icon: Heart }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = newItemCategory === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          setNewItemCategory(cat.id as 'quranic' | 'prophetic' | 'sakina');
                          if (cat.id !== 'quranic' && newItemSource.includes('سورة')) {
                            setNewItemSource('');
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#D9B45A] shadow-md'
                            : 'bg-[#EFE6D1] dark:bg-slate-950 border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1">
                  {isEnglish ? 'Title' : 'عنوان الورد'} <span className="text-rose-500 dark:text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder={isEnglish ? 'e.g., Verses of Healing or Protection Dua' : 'مثال: آيات إحياء العظام والشفاء، أو دعاء الحفظ'}
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-[#1B1A17] dark:text-white placeholder-[#5C5549]/60 dark:placeholder-slate-600 focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                />
              </div>

              {/* Quranic Specific: Surah Picker & Ayah Range */}
              {newItemCategory === 'quranic' && (
                <div className="p-3.5 rounded-2xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
                    <span>{isEnglish ? 'Select Surah & Ayah range for audio & jump:' : 'تحديد السورة والآيات لتشغيل الصوت والتنقل:'}</span>
                    <span className="tabular-nums">
                      {isEnglish
                        ? `${currentSelectedSurah?.numberOfAyahs} Ayahs`
                        : `${formatLocalizedDigits(currentSelectedSurah?.numberOfAyahs || 0, lang)} آية`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Surah Dropdown */}
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] text-[#5C5549] dark:text-slate-400 mb-1">
                        {isEnglish ? 'Surah:' : 'السورة:'}
                      </label>
                      <select
                        value={selectedSurahNumber}
                        onChange={(e) => handleSurahChange(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-[#1B1A17] dark:text-white focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                      >
                        {SURAHS_LIST.map((s) => (
                          <option key={s.number} value={s.number} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                            {formatLocalizedDigits(s.number, lang)}. {getSurahDisplayName(s, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* From Ayah */}
                    <div>
                      <label className="block text-[11px] text-[#5C5549] dark:text-slate-400 mb-1">
                        {isEnglish ? 'From Ayah:' : 'من آية:'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={currentSelectedSurah?.numberOfAyahs || 1}
                        value={fromAyah}
                        onChange={(e) => handleAyahRangeChange(Number(e.target.value), toAyah)}
                        className="w-full bg-white dark:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#1B1A17] dark:text-white text-center focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                      />
                    </div>

                    {/* To Ayah */}
                    <div>
                      <label className="block text-[11px] text-[#5C5549] dark:text-slate-400 mb-1">
                        {isEnglish ? 'To Ayah:' : 'إلى آية:'}
                      </label>
                      <input
                        type="number"
                        min={fromAyah}
                        max={currentSelectedSurah?.numberOfAyahs || 1}
                        value={toAyah}
                        onChange={(e) => handleAyahRangeChange(fromAyah, Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#1B1A17] dark:text-white text-center focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-[#5C5549] dark:text-slate-400 flex items-center justify-between">
                    <span>{isEnglish ? 'Suggested Source:' : 'المصدر المقترح:'}</span>
                    <strong className="text-[#8A6418] dark:text-[#D9B45A] font-mono">{newItemSource}</strong>
                  </div>
                </div>
              )}

              {/* Source Input for Prophetic / Sakina */}
              {newItemCategory !== 'quranic' && (
                <div>
                  <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1">
                    {isEnglish ? 'Source / Hadith Reference:' : 'المصدر / التخريج:'}
                  </label>
                  <input
                    type="text"
                    placeholder={isEnglish ? 'e.g., Sahih Muslim' : 'مثال: صحيح مسلم عن عثمان بن أبي العاص'}
                    value={newItemSource}
                    onChange={(e) => setNewItemSource(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-[#1B1A17] dark:text-white placeholder-[#5C5549]/60 dark:placeholder-slate-600 focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                  />
                </div>
              )}

              {/* Arabic Text Area */}
              <div>
                <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1">
                  {isEnglish ? 'Arabic Verse or Dua Text' : 'نص الآية أو الدعاء باللغة العربية'}{' '}
                  <span className="text-rose-500 dark:text-rose-400">*</span>:
                </label>
                <textarea
                  rows={4}
                  dir="rtl"
                  lang="ar"
                  required
                  placeholder={isEnglish ? 'Enter or paste the Arabic Quranic/Dua text…' : 'اكتب أو الصق نص الآيات المباركة بالرسم العثماني أو المشكول...'}
                  value={newItemArabicText}
                  onChange={(e) => setNewItemArabicText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 rounded-xl p-3 text-sm font-quran text-[#1B1A17] dark:text-[#F6EFDD] placeholder-[#5C5549]/60 dark:placeholder-slate-600 focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A] leading-relaxed text-right"
                />
              </div>

              {/* Repeat Target & Quick selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1B1A17] dark:text-slate-300">
                    {isEnglish ? 'Sunnah Repeat Target:' : 'التكرار المسنون للورد:'}
                  </label>
                  <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-mono font-bold tabular-nums">
                    {isEnglish
                      ? `${newItemRepeatTarget} ${newItemRepeatTarget === 1 ? 'time' : 'times'}`
                      : `${formatLocalizedDigits(newItemRepeatTarget, lang)} ${newItemRepeatTarget === 1 ? 'مرة' : 'مرات'}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 3, 7, 10].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setNewItemRepeatTarget(num)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                        newItemRepeatTarget === num
                          ? 'bg-[#1F3A6E] text-[#F6EFDD] font-mono'
                          : 'bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                      }`}
                    >
                      {isEnglish
                        ? `${num} ${num === 1 ? 'time' : 'times'}`
                        : `${formatLocalizedDigits(num, lang)} ${num === 1 ? 'مرة' : 'مرات'}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Virtue and Fadl */}
              <div>
                <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1">
                  {isEnglish ? 'Virtue & Healing Benefit:' : 'فضله وأثره في الشفاء:'}
                </label>
                <input
                  type="text"
                  placeholder={isEnglish ? 'e.g., Recited morning & evening for protection' : 'مثال: من قرأها صباحاً ومساءً كفاه الله كل سوء'}
                  value={newItemVirtue}
                  onChange={(e) => setNewItemVirtue(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-[#1B1A17] dark:text-white placeholder-[#5C5549]/60 dark:placeholder-slate-600 focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                />
              </div>

              {/* Instruction */}
              <div>
                <label className="block text-xs font-bold text-[#1B1A17] dark:text-slate-300 mb-1">
                  {isEnglish ? 'How to Practice (optional):' : 'طريقة التطبيق والنفث (اختياري):'}
                </label>
                <input
                  type="text"
                  placeholder={isEnglish ? 'e.g., Blow gently into palms and wipe gently' : 'مثال: ينفث في يديه ويمسح بهما موضع الألم'}
                  value={newItemInstruction}
                  onChange={(e) => setNewItemInstruction(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-[#1B1A17] dark:text-white placeholder-[#5C5549]/60 dark:placeholder-slate-600 focus:outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#8A6418]/15 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isEnglish ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#D9B45A]" />
                  <span>{isEnglish ? 'Save to Ruqyah List' : 'حفظ الورد وإضافته للرقية'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* IN-APP RESTORE DEFAULTS CONFIRMATION MODAL */}
      {isRestoreConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isEnglish ? 'Confirm restoring default Ruqyah entries' : 'تأكيد استعادة الأوراد الافتراضية'}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/40 dark:border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-amber-400 font-bold">
                <RotateCcw className="w-4 h-4" />
                <h3 className="text-base text-[#1B1A17] dark:text-white">
                  {isEnglish ? 'Restore Default Entries' : 'استعادة الأوراد الافتراضية'}
                </h3>
              </div>
              <button
                onClick={() => setIsRestoreConfirmOpen(false)}
                className="p-1 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
              {isEnglish
                ? `Remove all custom entries you added (${customItems.length}) and restore the default Ruqyah list only?`
                : `هل تريد حذف جميع الأوراد التي أضفتها يدوياً (${formatLocalizedDigits(customItems.length, lang)} ورد) واستعادة القائمة الافتراضية فقط؟`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRestoreConfirmOpen(false)}
                className="py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {isEnglish ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                onClick={confirmRestoreDefaults}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                {isEnglish ? 'Yes, Restore Defaults' : 'نعم، استعادة الأصل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP STATUS TOAST */}
      {statusToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/40 dark:border-amber-500/40 text-[#1B1A17] dark:text-amber-100 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-3">
          <AlertCircle className="w-4 h-4 text-[#8A6418] dark:text-amber-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

    </div>
  );
};
