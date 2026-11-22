import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns,
  Copy,
  Download,
  FileJson,
  Globe,
  HardDriveDownload,
  Heart,
  Layers,
  List,
  Minus,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { SURAHS_LIST } from '../data/quranMetadata';
import { toArabicIndic } from './khatma/KhatmaRing';
import {
  MAX_TRANSLATION_FONT_SIZE,
  MIN_TRANSLATION_FONT_SIZE,
  TRANSLATION_EDITIONS,
  TranslatedSurahData,
  TranslatedVerse,
  TranslationDisplayMode,
  TranslationEdition,
  TranslationFavoriteEntry,
  clampTranslationFontSize,
  downloadEditionOffline,
  filterTranslatedVerses,
  filterTranslationSurahs,
  getCachedSurahNumbersForEdition,
  getSurahComparisonTranslations,
  getSurahWithTranslation,
  getTranslationEditionById,
  importVerifiedTranslationJson,
  isTranslationFavorited,
  loadTranslationFavorites,
  loadTranslationPrefs,
  saveTranslationPrefs,
  toggleTranslationFavorite,
} from '../data/translationsService';

export interface ShareTranslatedVersePayload {
  surahNumber: number;
  surahName: string;
  verse: TranslatedVerse;
  edition: TranslationEdition;
}

interface TranslationsSectionProps {
  initialSurahNumber?: number;
  activeAudioSurahNumber?: number;
  activeAudioAyahNumber?: number;
  isPlayingAudio?: boolean;
  onPlayAyah?: (surahNumber: number, ayahNumber: number) => void;
  onPauseAudio?: () => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onShareVerse?: (payload: ShareTranslatedVersePayload) => void;
}

type SectionSubTab = 'reader' | 'favorites';

/** Andalusian stepped corner L-bracket + diamond rosette echoing Bayan's canvas geometry */
const BayanCornerOrnament: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 32 32"
    fill="none"
    className={`w-6 h-6 sm:w-7 sm:h-7 pointer-events-none select-none ${className}`}
  >
    <path
      d="M2 24V2H24"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 18V7.5H18"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
    <polygon points="4.75,3.25 6.25,4.75 4.75,6.25 3.25,4.75" fill="currentColor" opacity="0.85" />
  </svg>
);

const BayanCornerFrame: React.FC<{ className?: string }> = ({
  className = 'text-[#8A6418]/40 dark:text-[#D9B45A]/40',
}) => (
  <>
    <BayanCornerOrnament className={`absolute top-2.5 right-2.5 ${className}`} />
    <BayanCornerOrnament className={`absolute top-2.5 left-2.5 -scale-x-100 ${className}`} />
    <BayanCornerOrnament className={`absolute bottom-2.5 right-2.5 -scale-y-100 ${className}`} />
    <BayanCornerOrnament className={`absolute bottom-2.5 left-2.5 -scale-x-100 -scale-y-100 ${className}`} />
  </>
);

/** 8-pointed Islamic geometric Rub-el-Hizb star badge for Surah/Ayah numerals */
const BayanRubElHizbBadge: React.FC<{
  label: string;
  active?: boolean;
  sizeClass?: string;
}> = ({ label, active = false, sizeClass = 'w-9 h-9' }) => (
  <span
    className={`relative inline-flex items-center justify-center shrink-0 tabular-nums font-bold text-xs ${sizeClass} ${
      active
        ? 'text-[#1B1A17]'
        : 'text-[#8A6418] dark:text-[#D9B45A]'
    }`}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 36 36"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <rect
        x="7"
        y="7"
        width="22"
        height="22"
        rx="2"
        fill={active ? '#D9B45A' : 'currentColor'}
        fillOpacity={active ? '0.96' : '0.1'}
        stroke={active ? '#F6EFDD' : 'currentColor'}
        strokeOpacity={active ? '0.65' : '0.42'}
        strokeWidth="1.2"
      />
      <rect
        x="7"
        y="7"
        width="22"
        height="22"
        rx="2"
        transform="rotate(45 18 18)"
        fill={active ? '#D9B45A' : 'currentColor'}
        fillOpacity={active ? '0.96' : '0.1'}
        stroke={active ? '#F6EFDD' : 'currentColor'}
        strokeOpacity={active ? '0.65' : '0.42'}
        strokeWidth="1.2"
      />
    </svg>
    <span className="relative z-10 leading-none">{label}</span>
  </span>
);

/** Fine ornamental Islamic star & brass hairline divider */
const BayanCalligraphicDivider: React.FC = () => (
  <div aria-hidden="true" className="flex items-center justify-center gap-3 my-1">
    <div className="h-px flex-1 max-w-[110px] bg-gradient-to-l from-[#8A6418]/45 dark:from-[#D9B45A]/45 to-transparent" />
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0"
      fill="none"
    >
      <rect x="6" y="6" width="12" height="12" stroke="currentColor" strokeWidth="1.3" />
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        transform="rotate(45 12 12)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
    <div className="h-px flex-1 max-w-[110px] bg-gradient-to-r from-[#8A6418]/45 dark:from-[#D9B45A]/45 to-transparent" />
  </div>
);

export const TranslationsSection: React.FC<TranslationsSectionProps> = ({
  initialSurahNumber,
  activeAudioSurahNumber,
  activeAudioAyahNumber,
  isPlayingAudio = false,
  onPlayAyah,
  onPauseAudio,
  onNavigateToAyah,
  onShareVerse,
}) => {
  const initialPrefs = useMemo(() => loadTranslationPrefs(), []);

  const [subTab, setSubTab] = useState<SectionSubTab>('reader');
  const [selectedEditionId, setSelectedEditionId] = useState<string>(initialPrefs.editionId);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(() => {
    if (
      typeof initialSurahNumber === 'number' &&
      Number.isInteger(initialSurahNumber) &&
      initialSurahNumber >= 1 &&
      initialSurahNumber <= 114
    ) {
      return initialPrefs.surahNumber || initialSurahNumber;
    }
    return initialPrefs.surahNumber;
  });
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>(initialPrefs.displayMode);
  const [fontSize, setFontSize] = useState<number>(initialPrefs.fontSize);
  const [autoFollowAudio, setAutoFollowAudio] = useState<boolean>(true);

  const [surahQuery, setSurahQuery] = useState<string>('');
  const [verseQuery, setVerseQuery] = useState<string>('');
  const [isMobileSurahDrawerOpen, setIsMobileSurahDrawerOpen] = useState<boolean>(false);
  const [isStoragePanelOpen, setIsStoragePanelOpen] = useState<boolean>(false);

  const [data, setData] = useState<TranslatedSurahData | null>(null);
  const [comparisonData, setComparisonData] = useState<TranslatedSurahData[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [favorites, setFavorites] = useState<TranslationFavoriteEntry[]>(() =>
    loadTranslationFavorites()
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Offline download & audited JSON import state
  const [cachedSurahsCount, setCachedSurahsCount] = useState<number>(4);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState<boolean>(false);
  const [offlineProgress, setOfflineProgress] = useState<{
    completed: number;
    total: number;
    failed: number;
  } | null>(null);
  const [storageNotice, setStorageNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerTopRef = useRef<HTMLDivElement | null>(null);
  const verseRefs = useRef<Record<number, HTMLElement | null>>({});
  const downloadAbortRef = useRef<AbortController | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentEdition = useMemo(
    () => getTranslationEditionById(selectedEditionId),
    [selectedEditionId]
  );

  const currentSurahMeta = useMemo(
    () => SURAHS_LIST[selectedSurahNumber - 1] || SURAHS_LIST[0],
    [selectedSurahNumber]
  );

  // Persist user preferences cleanly
  useEffect(() => {
    saveTranslationPrefs({
      editionId: selectedEditionId,
      displayMode,
      fontSize,
      surahNumber: selectedSurahNumber,
    });
  }, [selectedEditionId, displayMode, fontSize, selectedSurahNumber]);

  // Cleanup copy timers & abort downloads on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (downloadAbortRef.current) downloadAbortRef.current.abort();
    };
  }, []);

  // Refresh cached Surah count when edition or reload changes
  useEffect(() => {
    let cancelled = false;
    getCachedSurahNumbersForEdition(selectedEditionId).then((set) => {
      if (!cancelled) {
        setCachedSurahsCount(set.size);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEditionId, reloadNonce, data]);

  // Load current Surah (single edition or parallel comparison)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMsg(null);

    if (displayMode === 'compare') {
      getSurahComparisonTranslations(selectedSurahNumber)
        .then((allEditions) => {
          if (!cancelled) {
            setComparisonData(allEditions);
            const activeBlock =
              allEditions.find((b) => b.edition.id === selectedEditionId) || allEditions[0];
            setData(activeBlock);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setErrorMsg(
              err instanceof Error
                ? err.message
                : 'تعذر تحميل مقارنة اللغات لهذه السورة حالياً، يرجى المحاولة مجدداً.'
            );
            setIsLoading(false);
          }
        });
    } else {
      getSurahWithTranslation(selectedSurahNumber, selectedEditionId)
        .then((res) => {
          if (!cancelled) {
            setData(res);
            setComparisonData(null);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setErrorMsg(
              err instanceof Error
                ? err.message
                : 'تعذر تحميل ترجمة هذه السورة حالياً، يرجى المحاولة مجدداً.'
            );
            setIsLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedSurahNumber, selectedEditionId, displayMode, reloadNonce]);

  // Smooth auto-follow active verse during audio recitation
  useEffect(() => {
    if (
      subTab !== 'reader' ||
      !autoFollowAudio ||
      !isPlayingAudio ||
      activeAudioSurahNumber !== selectedSurahNumber ||
      !activeAudioAyahNumber
    ) {
      return;
    }

    const targetEl = verseRefs.current[activeAudioAyahNumber];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [
    subTab,
    autoFollowAudio,
    isPlayingAudio,
    activeAudioSurahNumber,
    activeAudioAyahNumber,
    selectedSurahNumber,
  ]);

  const filteredSurahs = useMemo(
    () => filterTranslationSurahs(surahQuery),
    [surahQuery]
  );

  const filteredVerses = useMemo(
    () => filterTranslatedVerses(data?.verses || [], verseQuery),
    [data?.verses, verseQuery]
  );

  const comparisonVerseMaps = useMemo(() => {
    if (!comparisonData) return [];
    return comparisonData.map((block) => ({
      edition: block.edition,
      byAyah: new Map(block.verses.map((v) => [v.ayahNumber, v.translationText])),
    }));
  }, [comparisonData]);

  const handleSelectSurah = useCallback((num: number) => {
    const safe = Math.min(114, Math.max(1, num));
    setSelectedSurahNumber(safe);
    setSubTab('reader');
    setVerseQuery('');
    setIsMobileSurahDrawerOpen(false);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCopyVerse = useCallback(
    async (
      verse: TranslatedVerse,
      edition: TranslationEdition = currentEdition,
      surahNum: number = selectedSurahNumber,
      surahNameAr: string = currentSurahMeta.name,
      surahNameEn: string = currentSurahMeta.englishName
    ) => {
      const lines =
        displayMode === 'translation-only'
          ? [
              verse.translationText,
              `— ${surahNameEn} (${surahNum}:${verse.ayahNumber}) · ${edition.translatorName}`,
            ]
          : [
              verse.arabicText,
              verse.translationText,
              `— سورة ${surahNameAr} (${toArabicIndic(verse.ayahNumber)}) · ${edition.nativeTitle}`,
            ];

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(lines.join('\n'));
        }
        const key = `${edition.id}:${surahNum}:${verse.ayahNumber}`;
        setCopiedKey(key);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1800);
      } catch {
        // Ignore clipboard errors cleanly
      }
    },
    [
      currentEdition,
      currentSurahMeta.englishName,
      currentSurahMeta.name,
      displayMode,
      selectedSurahNumber,
    ]
  );

  const handleToggleFavorite = useCallback(
    (verse: TranslatedVerse) => {
      const next = toggleTranslationFavorite(favorites, {
        surahNumber: selectedSurahNumber,
        surahName: currentSurahMeta.name,
        englishName: currentSurahMeta.englishName,
        ayahNumber: verse.ayahNumber,
        overallNumber: verse.overallNumber,
        arabicText: verse.arabicText,
        translationText: verse.translationText,
        editionId: currentEdition.id,
        editionTitle: currentEdition.arabicTitle,
        dir: currentEdition.dir,
      });
      setFavorites(next);
    },
    [
      currentEdition.arabicTitle,
      currentEdition.dir,
      currentEdition.id,
      currentSurahMeta.englishName,
      currentSurahMeta.name,
      favorites,
      selectedSurahNumber,
    ]
  );

  const handleDownloadFullEdition = useCallback(async () => {
    if (isDownloadingOffline) {
      downloadAbortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setIsDownloadingOffline(true);
    setStorageNotice(null);
    setOfflineProgress({ completed: 0, total: 114, failed: 0 });

    const res = await downloadEditionOffline(
      selectedEditionId,
      (prog) => setOfflineProgress(prog),
      controller.signal
    );

    downloadAbortRef.current = null;
    setIsDownloadingOffline(false);

    const updatedSet = await getCachedSurahNumbersForEdition(selectedEditionId);
    setCachedSurahsCount(updatedSet.size);

    if (res.aborted) {
      setStorageNotice({
        type: 'error',
        text: `تم إيقاف التحميل عند ${toArabicIndic(updatedSet.size)} من ١١٤ سورة.`,
      });
    } else if (res.failed === 0) {
      setStorageNotice({
        type: 'success',
        text: `اكتمل تحميل جميع السور (١١٤) للـ${currentEdition.arabicTitle} للاستخدام دون إنترنت.`,
      });
    } else {
      setStorageNotice({
        type: 'error',
        text: `تم حفظ ${toArabicIndic(res.completed)} سورة وتعذر تحميل ${toArabicIndic(res.failed)} سورة؛ يمكنك إعادة المحاولة لاحقاً.`,
      });
    }
  }, [currentEdition.arabicTitle, isDownloadingOffline, selectedEditionId]);

  const handleImportJsonFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setStorageNotice(null);
      try {
        const text = await file.text();
        const imported = await importVerifiedTranslationJson(text);
        setSelectedEditionId(imported.edition.id);
        setSelectedSurahNumber(imported.surahNumber);
        setReloadNonce((n) => n + 1);
        setStorageNotice({
          type: 'success',
          text: `تم استيراد واعتماد سورة ${imported.meta.name} (${imported.edition.arabicTitle}) بنجاح (${toArabicIndic(imported.verses.length)} آية).`,
        });
      } catch (err) {
        setStorageNotice({
          type: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'تعذر قراءة ملف JSON؛ تأكد من مطابقته للصيغة المعتمدة.',
        });
      }
    },
    []
  );

  const renderVerseActionBar = (
    verse: TranslatedVerse,
    compact = false
  ) => {
    const isThisVersePlaying =
      isPlayingAudio &&
      activeAudioSurahNumber === selectedSurahNumber &&
      activeAudioAyahNumber === verse.ayahNumber;
    const isFav = isTranslationFavorited(
      favorites,
      currentEdition.id,
      selectedSurahNumber,
      verse.ayahNumber
    );
    const isCopied =
      copiedKey === `${currentEdition.id}:${selectedSurahNumber}:${verse.ayahNumber}`;

    return (
      <div className="flex items-center flex-wrap gap-1.5">
        {onPlayAyah && (
          <button
            type="button"
            onClick={() => {
              if (isThisVersePlaying && onPauseAudio) {
                onPauseAudio();
              } else {
                onPlayAyah(selectedSurahNumber, verse.ayahNumber);
              }
            }}
            aria-label={
              isThisVersePlaying
                ? `إيقاف تلاوة الآية ${verse.ayahNumber}`
                : `استماع إلى الآية ${verse.ayahNumber}`
            }
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isThisVersePlaying
                ? 'bg-[#D9B45A] text-[#1B1A17] shadow-sm'
                : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
            }`}
          >
            {isThisVersePlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 shrink-0" />
                {!compact && <span>إيقاف</span>}
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#D9B45A] shrink-0" />
                {!compact && <span>استماع</span>}
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleToggleFavorite(verse)}
          aria-label={
            isFav
              ? `إزالة الآية ${verse.ayahNumber} من المفضلة`
              : `حفظ الآية ${verse.ayahNumber} في المفضلة`
          }
          className={`min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            isFav
              ? 'bg-[#D9B45A]/15 border-[#8A6418] dark:border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A]'
              : 'border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-[#1B1A17] dark:text-[#E9E3D3]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 shrink-0 ${isFav ? 'fill-current' : ''}`} />
          {!compact && <span className="hidden sm:inline">{isFav ? 'محفوظة' : 'مفضلة'}</span>}
        </button>

        {onShareVerse && (
          <button
            type="button"
            onClick={() =>
              onShareVerse({
                surahNumber: selectedSurahNumber,
                surahName: currentSurahMeta.name,
                verse,
                edition: currentEdition,
              })
            }
            aria-label={`مشاركة بطاقة الآية ${verse.ayahNumber} مع الترجمة`}
            className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
            {!compact && <span className="hidden sm:inline">بطاقة</span>}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleCopyVerse(verse)}
          aria-label={`نسخ الآية ${verse.ayahNumber} والترجمة`}
          className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {!compact && (
                <span className="text-emerald-700 dark:text-emerald-300">تم النسخ</span>
              )}
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
              {!compact && <span className="hidden sm:inline">نسخ</span>}
            </>
          )}
        </button>

        {onNavigateToAyah && !compact && (
          <button
            type="button"
            onClick={() => onNavigateToAyah(selectedSurahNumber, verse.ayahNumber)}
            aria-label={`فتح الآية ${verse.ayahNumber} في المصحف`}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
            <span className="hidden md:inline">المصحف</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-16 animate-in fade-in duration-200" ref={readerTopRef}>
      {/* ===================== BAYAN HERO + LANGUAGE SELECTOR + SUB-NAVIGATION ===================== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1] dark:from-[#142038] dark:via-[#151d29] dark:to-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/30 p-5 sm:p-7 shadow-sm space-y-5">
        <BayanCornerFrame className="text-[#8A6418]/30 dark:text-[#D9B45A]/30" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#D9B45A]/10 blur-3xl"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
              <Globe className="w-4 h-4 shrink-0" />
              <span>مكتبة بيان للترجمات المعتمدة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-kufi text-[#1B1A17] dark:text-[#F6EFDD] tracking-tight">
              ترجمات معاني القرآن الكريم
            </h1>
            <p className="text-xs sm:text-sm text-[#5C5549] dark:text-slate-300 leading-relaxed max-w-2xl">
              اقرأ النص العربي بالرسم العثماني مقترناً بترجمة موثوقة للمعاني بهوية المصحف المقابل أو المقارَن، مع الحفظ في المفضلة والعمل دون إنترنت.
            </p>
          </div>

          {/* Primary sub-tabs: Reader vs Favorites + Mobile Surah Picker */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="tablist"
              aria-label="أقسام الترجمات"
              className="inline-flex rounded-2xl p-1 bg-[#EFE6D1]/85 dark:bg-[#0b1018] border border-[#8A6418]/25 dark:border-[#D9B45A]/25"
            >
              <button
                type="button"
                role="tab"
                aria-selected={subTab === 'reader'}
                onClick={() => setSubTab('reader')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  subTab === 'reader'
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] shadow-sm'
                    : 'text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-[#F6EFDD]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-[#D9B45A]" />
                <span>قراءة السورة</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subTab === 'favorites'}
                onClick={() => setSubTab('favorites')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  subTab === 'favorites'
                    ? 'bg-[#1F3A6E] text-[#F6EFDD] shadow-sm'
                    : 'text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-[#F6EFDD]'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-[#D9B45A]" />
                <span>المفضلة ({toArabicIndic(favorites.length)})</span>
              </button>
            </div>

            {subTab === 'reader' && (
              <button
                type="button"
                onClick={() => setIsMobileSurahDrawerOpen(true)}
                className="lg:hidden min-h-[44px] px-4 py-2 rounded-2xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 shadow cursor-pointer"
              >
                <List className="w-4 h-4 text-[#D9B45A]" />
                <span>السورة ({toArabicIndic(selectedSurahNumber)} · {currentSurahMeta.name})</span>
              </button>
            )}
          </div>
        </div>

        {/* Language Picker Row (Driven dynamically by TRANSLATION_EDITIONS registry) */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TRANSLATION_EDITIONS.map((edition) => {
            const isSelected = edition.id === currentEdition.id;
            return (
              <button
                key={edition.id}
                type="button"
                onClick={() => {
                  setSelectedEditionId(edition.id);
                  if (displayMode === 'compare') {
                    setDisplayMode('split');
                  }
                }}
                className={`min-h-[44px] p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/90 border-[#D9B45A] text-[#F6EFDD] shadow-md'
                    : 'bg-[#FBF7EE]/90 dark:bg-[#151d29]/85 border-[#8A6418]/25 dark:border-[#D9B45A]/25 text-[#1B1A17] dark:text-[#E9E3D3] hover:border-[#8A6418]/60 dark:hover:border-[#D9B45A]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-bold text-sm font-kufi">{edition.arabicTitle}</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'text-[#D9B45A]'
                        : 'text-[#8A6418] dark:text-[#D9B45A]'
                    }`}
                  >
                    {edition.langCode}
                  </span>
                </div>
                <div className="space-y-0.5 w-full" dir={edition.dir}>
                  <div
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-[#F6EFDD]' : 'text-[#1F3A6E] dark:text-[#D9B45A]'
                    }`}
                  >
                    {edition.nativeTitle}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      isSelected ? 'text-[#E9E3D3]/85' : 'text-[#5C5549] dark:text-slate-400'
                    }`}
                  >
                    {edition.translatorName}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Storage / Audited JSON Utility Trigger Card */}
          <button
            type="button"
            onClick={() => setIsStoragePanelOpen((v) => !v)}
            aria-expanded={isStoragePanelOpen}
            className={`min-h-[44px] p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              isStoragePanelOpen
                ? 'bg-[#EFE6D1] dark:bg-[#0b1018] border-[#8A6418] dark:border-[#D9B45A] text-[#1B1A17] dark:text-[#F6EFDD]'
                : 'bg-[#FBF7EE]/90 dark:bg-[#151d29]/85 border-[#8A6418]/25 dark:border-[#D9B45A]/25 text-[#1B1A17] dark:text-[#E9E3D3] hover:border-[#8A6418]/60 dark:hover:border-[#D9B45A]/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="font-bold text-sm font-kufi">دون إنترنت والملفات</span>
              <HardDriveDownload className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#5C5549] dark:text-slate-400 tabular-nums w-full">
              <span>محفوظ حالياً: {toArabicIndic(cachedSurahsCount)} / ١١٤ سورة</span>
              <span className="font-bold text-[#1F3A6E] dark:text-[#D9B45A]">
                {isStoragePanelOpen ? 'إخفاء' : 'إدارة'}
              </span>
            </div>
          </button>
        </div>

        {/* Collapsible Offline Pack & Audited JSON Import Panel */}
        {isStoragePanelOpen && (
          <div className="relative z-10 rounded-2xl bg-[#FBF7EE] dark:bg-[#0b1018]/90 border border-[#8A6418]/30 dark:border-[#D9B45A]/25 p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                  حفظ {currentEdition.arabicTitle} دون إنترنت واستيراد JSON مراجَع
                </h3>
                <p className="text-xs text-[#5C5549] dark:text-slate-400">
                  يمكنك تنزيل كامل القرآن (١١٤ سورة) للعمل في السفر دون شبكة، أو اعتماد ملف JSON مدقَّق يدوياً لأي سورة.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadFullEdition}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isDownloadingOffline
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD]'
                  }`}
                >
                  <Download className="w-4 h-4 text-[#D9B45A]" />
                  <span>
                    {isDownloadingOffline
                      ? `إيقاف (${toArabicIndic(offlineProgress?.completed || 0)}/١١٤)`
                      : `تحميل المصحف (${currentEdition.langCode.toUpperCase()})`}
                  </span>
                </button>

                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonFileInputRef.current?.click()}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#8A6418]/35 dark:border-[#D9B45A]/35 bg-[#EFE6D1]/70 dark:bg-[#151d29] hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileJson className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                  <span>استيراد ملف JSON</span>
                </button>
              </div>
            </div>

            {isDownloadingOffline && offlineProgress && (
              <div className="space-y-1.5 pt-1">
                <div className="w-full h-2 rounded-full bg-[#EFE6D1] dark:bg-[#151d29] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1F3A6E] to-[#D9B45A] transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((offlineProgress.completed + offlineProgress.failed) /
                            offlineProgress.total) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#5C5549] dark:text-slate-400 tabular-nums">
                  <span>جارٍ حفظ السور في قاعدة البيانات المحلية…</span>
                  <span>
                    {toArabicIndic(offlineProgress.completed)} / {toArabicIndic(offlineProgress.total)}
                  </span>
                </div>
              </div>
            )}

            {storageNotice && (
              <div
                role="status"
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  storageNotice.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/35 text-rose-800 dark:text-rose-200'
                }`}
              >
                <span>{storageNotice.text}</span>
                <button
                  type="button"
                  onClick={() => setStorageNotice(null)}
                  aria-label="إغلاق الرسالة"
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===================== FAVORITES VIEW ===================== */}
      {subTab === 'favorites' ? (
        <section className="space-y-4">
          <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-kufi text-[#1B1A17] dark:text-[#F6EFDD]">
                الآيات المحفوظة في مفضلة الترجمات
              </h2>
              <p className="text-xs text-[#5C5549] dark:text-slate-400 mt-0.5">
                جميع الآيات التي حفظتها بالسويدية أو الإنجليزية جاهزة للمراجعة والاستماع والمشاركة.
              </p>
            </div>
            <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] tabular-nums">
              {toArabicIndic(favorites.length)} آية محفوظة
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 p-12 text-center space-y-3">
              <Heart className="w-8 h-8 text-[#8A6418] dark:text-[#D9B45A] mx-auto opacity-75" />
              <p className="text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                لا توجد آيات في المفضلة بعد
              </p>
              <p className="text-xs text-[#5C5549] dark:text-slate-400 max-w-md mx-auto">
                اضغط على أيقونة القلب بجانب أي آية أثناء القراءة لحفظها مع ترجمتها هنا للوصول السريع.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('reader')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold text-xs cursor-pointer"
              >
                العودة لقراءة السورة
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((fav) => {
                const isCopied = copiedKey === fav.key;
                const editionObj = getTranslationEditionById(fav.editionId);
                return (
                  <article
                    key={fav.key}
                    className="rounded-2xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#8A6418]/15 dark:border-[#D9B45A]/15">
                      <div className="flex items-center gap-2 text-xs">
                        <BayanRubElHizbBadge
                          label={toArabicIndic(fav.ayahNumber)}
                          sizeClass="w-7 h-7 text-[11px]"
                        />
                        <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] tabular-nums">
                          سورة {fav.surahName}
                        </span>
                        <span aria-hidden="true" className="text-[#5C5549] dark:text-slate-500">·</span>
                        <span className="text-[#5C5549] dark:text-slate-400">
                          {fav.editionTitle}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-1.5">
                        {onPlayAyah && (
                          <button
                            type="button"
                            onClick={() => onPlayAyah(fav.surahNumber, fav.ayahNumber)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-[#D9B45A]" />
                            <span>استماع</span>
                          </button>
                        )}

                        {onShareVerse && (
                          <button
                            type="button"
                            onClick={() =>
                              onShareVerse({
                                surahNumber: fav.surahNumber,
                                surahName: fav.surahName,
                                verse: {
                                  ayahNumber: fav.ayahNumber,
                                  overallNumber: fav.overallNumber,
                                  arabicText: fav.arabicText,
                                  translationText: fav.translationText,
                                },
                                edition: editionObj,
                              })
                            }
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                            <span>بطاقة</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleCopyVerse(
                              {
                                ayahNumber: fav.ayahNumber,
                                arabicText: fav.arabicText,
                                translationText: fav.translationText,
                              },
                              editionObj,
                              fav.surahNumber,
                              fav.surahName,
                              fav.englishName
                            )
                          }
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-300">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEditionId(fav.editionId);
                            handleSelectSurah(fav.surahNumber);
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#8A6418]/25 dark:border-[#D9B45A]/25 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-xs font-semibold text-[#1B1A17] dark:text-[#E9E3D3] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          فتح السورة
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = toggleTranslationFavorite(favorites, {
                              surahNumber: fav.surahNumber,
                              surahName: fav.surahName,
                              englishName: fav.englishName,
                              ayahNumber: fav.ayahNumber,
                              overallNumber: fav.overallNumber,
                              arabicText: fav.arabicText,
                              translationText: fav.translationText,
                              editionId: fav.editionId,
                              editionTitle: fav.editionTitle,
                              dir: fav.dir,
                            });
                            setFavorites(next);
                          }}
                          aria-label="حذف من المفضلة"
                          className="min-h-[38px] min-w-[38px] rounded-xl border border-rose-500/25 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-quran text-xl sm:text-2xl leading-[2.05] text-[#1B1A17] dark:text-[#F6EFDD] text-right"
                    >
                      {fav.arabicText}{' '}
                      <span className="text-[#8A6418] dark:text-[#D9B45A] font-sans text-[0.72em] mx-1">
                        ﴿{toArabicIndic(fav.ayahNumber)}﴾
                      </span>
                    </p>
                    <p
                      dir={fav.dir}
                      className={`text-sm sm:text-base leading-relaxed text-[#2D2A24] dark:text-[#E9E3D3] ${
                        fav.dir === 'ltr' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {fav.translationText}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* ===================== DESKTOP 2-COLUMN READER LAYOUT ===================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Desktop Sidebar: Searchable 114-Surah Index */}
          <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col rounded-3xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 overflow-hidden sticky top-20 max-h-[calc(100vh-6.5rem)] shadow-sm">
            <div className="p-3.5 border-b border-[#8A6418]/20 dark:border-[#D9B45A]/20 space-y-2.5 bg-[#EFE6D1]/70 dark:bg-[#0b1018]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-kufi text-[#1B1A17] dark:text-[#F6EFDD]">
                  فهرس السور ({toArabicIndic(114)})
                </span>
                <span className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-bold uppercase">
                  {currentEdition.langCode}
                </span>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-[#5C5549] dark:text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={surahQuery}
                  onChange={(e) => setSurahQuery(e.target.value)}
                  placeholder="ابحث بالعربية أو English أو الرقم..."
                  aria-label="البحث في فهرس السور"
                  className="w-full min-h-[40px] pr-9 pl-3 py-1.5 rounded-xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/25 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto space-y-1">
              {filteredSurahs.map((s) => {
                const isSelected = s.number === selectedSurahNumber;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => handleSelectSurah(s.number)}
                    className={`w-full min-h-[48px] px-3 py-2 rounded-2xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/90 border-[#D9B45A] text-[#F6EFDD] shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-[#EFE6D1]/70 dark:hover:bg-[#10161f]/80 text-[#1B1A17] dark:text-[#E9E3D3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BayanRubElHizbBadge
                        label={toArabicIndic(s.number)}
                        active={isSelected}
                        sizeClass="w-8 h-8 text-[11px]"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">سورة {s.name}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-[#E9E3D3]/85' : 'text-[#5C5549] dark:text-slate-400'
                          }`}
                          dir="ltr"
                        >
                          {s.englishName} · {s.englishNameTranslation}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] tabular-nums shrink-0 ${
                        isSelected ? 'text-[#D9B45A]' : 'text-[#5C5549] dark:text-slate-400'
                      }`}
                    >
                      {toArabicIndic(s.numberOfAyahs)}
                    </span>
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <div className="p-6 text-center text-xs text-[#5C5549] dark:text-slate-400">
                  لا توجد سورة مطابقة لـ «{surahQuery}»
                </div>
              )}
            </div>
          </aside>

          {/* Main Column: Bayan Mushaf Surah Cartouche + Controls + Active Reader */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {/* Toolbar Controls */}
            <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 p-4 space-y-3 shadow-sm">
              <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                {/* Display Modes (4 crisp segmented modes) */}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-label="نمط العرض"
                    className="inline-flex flex-wrap rounded-xl p-1 bg-[#EFE6D1]/80 dark:bg-[#0b1018] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 gap-1"
                  >
                    {[
                      { id: 'split' as const, label: 'عمودان متقابلان', icon: Columns },
                      { id: 'bilingual' as const, label: 'متتالي', icon: List },
                      { id: 'compare' as const, label: 'مقارنة اللغات', icon: Layers },
                      { id: 'translation-only' as const, label: 'الترجمة فقط', icon: Globe },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const active = displayMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setDisplayMode(mode.id)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#1F3A6E] text-[#F6EFDD] shadow-sm'
                              : 'text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-[#F6EFDD]'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#D9B45A]' : ''}`} />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Font size stepper */}
                  <div className="inline-flex items-center gap-1 rounded-xl px-1.5 py-1 bg-[#EFE6D1]/80 dark:bg-[#0b1018] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 tabular-nums">
                    <button
                      type="button"
                      onClick={() => setFontSize((f) => clampTranslationFontSize(f - 1))}
                      disabled={fontSize <= MIN_TRANSLATION_FONT_SIZE}
                      aria-label="تصغير خط الترجمة"
                      className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#1B1A17] dark:text-[#F6EFDD] hover:bg-[#FBF7EE] dark:hover:bg-[#151d29] disabled:opacity-35 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
                      {toArabicIndic(fontSize)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFontSize((f) => clampTranslationFontSize(f + 1))}
                      disabled={fontSize >= MAX_TRANSLATION_FONT_SIZE}
                      aria-label="تكبير خط الترجمة"
                      className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#1B1A17] dark:text-[#F6EFDD] hover:bg-[#FBF7EE] dark:hover:bg-[#151d29] disabled:opacity-35 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Verse search + Auto-follow toggle + Mushaf link */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px] sm:w-64">
                    <Search className="w-4 h-4 text-[#5C5549] dark:text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={verseQuery}
                      onChange={(e) => setVerseQuery(e.target.value)}
                      placeholder="ابحث داخل السورة..."
                      aria-label="البحث في آيات السورة"
                      className="w-full min-h-[40px] pr-9 pl-8 py-1.5 rounded-xl bg-[#F6EFDD]/60 dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                    />
                    {verseQuery && (
                      <button
                        type="button"
                        onClick={() => setVerseQuery('')}
                        aria-label="مسح البحث"
                        className="absolute left-2 top-2 min-w-[26px] min-h-[26px] rounded-lg flex items-center justify-center text-[#5C5549] dark:text-slate-400 hover:bg-[#EFE6D1] dark:hover:bg-[#151d29] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAutoFollowAudio((v) => !v)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      autoFollowAudio
                        ? 'bg-[#D9B45A]/15 border-[#8A6418]/50 dark:border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                        : 'border-[#8A6418]/25 dark:border-[#D9B45A]/20 text-[#5C5549] dark:text-slate-400'
                    }`}
                  >
                    تتبع التلاوة: {autoFollowAudio ? 'مفعل' : 'متوقف'}
                  </button>

                  {onNavigateToAyah && (
                    <button
                      type="button"
                      onClick={() => onNavigateToAyah(selectedSurahNumber, 1)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#8A6418]/35 dark:border-[#D9B45A]/35 bg-[#EFE6D1]/70 dark:bg-[#0b1018] hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] text-[#1B1A17] dark:text-[#F6EFDD] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                      <span>فتح في المصحف</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Reader Body */}
            {isLoading ? (
              <div className="p-14 text-center rounded-3xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 flex flex-col items-center justify-center space-y-3">
                <div className="w-9 h-9 rounded-full border-2 border-[#8A6418] dark:border-[#D9B45A] border-t-transparent animate-spin" />
                <p className="text-xs font-medium text-[#5C5549] dark:text-slate-300">
                  جارٍ تجهيز {displayMode === 'compare' ? 'مقارنة الترجمات' : currentEdition.arabicTitle} لسورة {currentSurahMeta.name}…
                </p>
              </div>
            ) : errorMsg ? (
              <div className="p-8 text-center rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 flex flex-col items-center justify-center space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm text-[#1B1A17] dark:text-[#F6EFDD] max-w-md leading-relaxed">
                  {errorMsg}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-[#D9B45A]" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bayan Native Manuscript Surah Cartouche & Basmala (Full Day/Night Identity Parity) */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1]/90 dark:from-[#142038] dark:via-[#151d29] dark:to-[#10161f] border border-[#8A6418]/40 dark:border-[#D9B45A]/40 text-[#1B1A17] dark:text-[#F6EFDD] shadow-sm p-1.5">
                  <div className="relative rounded-[20px] border border-[#8A6418]/25 dark:border-[#D9B45A]/25 px-4 py-5 sm:px-7 sm:py-6 text-center space-y-3">
                    <BayanCornerFrame className="text-[#8A6418]/35 dark:text-[#D9B45A]/35" />

                    {/* Signature Bayan Mushaf Surah Cartouche (matches QuranReader.tsx) */}
                    <div className="inline-block relative px-6 sm:px-10 py-2.5 max-w-full rounded-2xl border shadow-inner bg-[#D9B45A]/15 border-[#8A6418]/45 text-[#1B1A17] dark:bg-gradient-to-r dark:from-[#1F3A6E]/45 dark:via-[#D9B45A]/15 dark:to-[#1F3A6E]/45 dark:border-[#D9B45A]/45 dark:text-[#F6EFDD]">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3">
                        <h2 className="font-kufi text-2xl sm:text-3xl font-bold tracking-wide">
                          سُورَةُ {currentSurahMeta.name}
                        </h2>
                        <span className="hidden sm:inline text-[#8A6418]/60 dark:text-[#D9B45A]/70">—</span>
                        <span
                          dir="ltr"
                          className="text-base sm:text-xl font-semibold text-[#8A6418] dark:text-[#E8C97A]"
                        >
                          Surah {currentSurahMeta.englishName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-[#5C5549] dark:text-[#E9E3D3]/80 font-sans tabular-nums">
                        <span>{currentSurahMeta.englishNameTranslation}</span>
                        <span aria-hidden="true">·</span>
                        <span>{currentSurahMeta.revelationTypeAr}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          الآيات {toArabicIndic(1)}–{toArabicIndic(currentSurahMeta.numberOfAyahs)}
                        </span>
                        {displayMode !== 'compare' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#8A6418] dark:text-[#D9B45A]">
                              {currentEdition.sourceLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Opening Basmala Bar inside the Bayan Manuscript Frame */}
                    {data?.bismillahPre && !verseQuery.trim() && (
                      <div className="pt-1 space-y-1.5">
                        <BayanCalligraphicDivider />
                        {displayMode !== 'translation-only' && (
                          <p className="font-quran text-2xl sm:text-3xl leading-relaxed text-[#8A6418] dark:text-[#D9B45A]">
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                          </p>
                        )}
                        <p
                          dir={currentEdition.dir}
                          className="text-xs sm:text-sm text-[#5C5549] dark:text-[#E9E3D3]/85 font-medium"
                        >
                          {displayMode === 'compare'
                            ? TRANSLATION_EDITIONS.map((e) => e.bismillahText).join(' · ')
                            : currentEdition.bismillahText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {filteredVerses.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/25 dark:border-[#D9B45A]/20 text-xs text-[#5C5549] dark:text-slate-400">
                    لم يتم العثور على آيات مطابقة لعبارة «{verseQuery}» في سورة {currentSurahMeta.name}.
                  </div>
                ) : displayMode === 'split' ? (
                  /* ===================== MODE 1: BAYAN TWO-PAGE MANUSCRIPT SPREAD ===================== */
                  <div className="rounded-3xl bg-[#F6EFDD] dark:bg-[#10161f] border-2 border-[#8A6418]/35 dark:border-[#D9B45A]/30 p-1.5 sm:p-2 shadow-sm">
                    <div className="rounded-[20px] overflow-hidden border border-[#8A6418]/25 dark:border-[#D9B45A]/20 bg-[#FBF7EE] dark:bg-[#151d29]">
                      {/* Column Labels Header (RTL layout -> Arabic Right, Translation Left) */}
                      <div className="grid grid-cols-2 border-b border-[#8A6418]/25 dark:border-[#D9B45A]/25 bg-[#EFE6D1]/80 dark:bg-[#0b1018] text-[11px] sm:text-xs font-bold">
                        <div className="px-3 sm:px-5 py-2.5 border-e border-[#8A6418]/25 dark:border-[#D9B45A]/25 text-right font-kufi text-[#8A6418] dark:text-[#D9B45A]">
                          النص العربي · الرسم العثماني
                        </div>
                        <div
                          dir={currentEdition.dir}
                          className={`px-3 sm:px-5 py-2.5 text-[#1F3A6E] dark:text-[#E8C97A] truncate ${
                            currentEdition.dir === 'ltr' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {currentEdition.nativeTitle}
                        </div>
                      </div>

                      {/* Split Verse Rows with Manuscript Spine */}
                      <div className="divide-y divide-[#8A6418]/20 dark:divide-[#D9B45A]/15">
                        {filteredVerses.map((verse) => {
                          const isThisVersePlaying =
                            isPlayingAudio &&
                            activeAudioSurahNumber === selectedSurahNumber &&
                            activeAudioAyahNumber === verse.ayahNumber;

                          return (
                            <article
                              key={verse.ayahNumber}
                              ref={(el) => {
                                verseRefs.current[verse.ayahNumber] = el;
                              }}
                              className={`transition-colors ${
                                isThisVersePlaying
                                  ? 'bg-[#D9B45A]/15 dark:bg-[#1F3A6E]/35'
                                  : 'hover:bg-[#EFE6D1]/35 dark:hover:bg-[#10161f]/60'
                              }`}
                            >
                              {/* Side-by-Side Columns: Arabic Right | Translation Left */}
                              <div className="grid grid-cols-2 items-stretch">
                                {/* Right Column: Pure Arabic Uthmani Text */}
                                <div
                                  dir="rtl"
                                  lang="ar"
                                  className="px-3 py-3.5 sm:px-5 sm:py-4 border-e border-[#8A6418]/20 dark:border-[#D9B45A]/20 flex flex-col justify-between gap-2 min-w-0"
                                >
                                  <p
                                    style={{
                                      fontSize: `clamp(16px, 4.1vw, ${Math.round(fontSize * 1.38)}px)`,
                                    }}
                                    className="font-quran leading-[2.0] text-[#1B1A17] dark:text-[#F6EFDD] text-right"
                                  >
                                    {verse.arabicText}{' '}
                                    <span className="text-[#8A6418] dark:text-[#D9B45A] font-sans text-[0.72em] mx-0.5 whitespace-nowrap">
                                      ﴿{toArabicIndic(verse.ayahNumber)}﴾
                                    </span>
                                  </p>
                                </div>

                                {/* Left Column: Translation Text */}
                                <div
                                  dir={currentEdition.dir}
                                  lang={currentEdition.langCode}
                                  className="px-3 py-3.5 sm:px-5 sm:py-4 flex flex-col justify-between gap-2 min-w-0"
                                >
                                  <p
                                    style={{
                                      fontSize: `clamp(13px, 3.25vw, ${fontSize}px)`,
                                    }}
                                    className={`leading-[1.7] text-[#2D2A24] dark:text-[#E9E3D3] ${
                                      currentEdition.dir === 'ltr' ? 'text-left' : 'text-right'
                                    }`}
                                  >
                                    <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] mr-1.5 tabular-nums">
                                      {verse.ayahNumber}.
                                    </span>
                                    {verse.translationText}
                                  </p>
                                </div>
                              </div>

                              {/* Quiet Action Bar on Row Footer */}
                              <div className="px-3 sm:px-5 py-2 bg-[#EFE6D1]/40 dark:bg-[#0b1018]/65 border-t border-[#8A6418]/15 dark:border-[#D9B45A]/15 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-[#5C5549] dark:text-slate-400 tabular-nums">
                                  الآية {toArabicIndic(verse.ayahNumber)}
                                  {typeof verse.page === 'number' && verse.page > 0
                                    ? ` · ص ${toArabicIndic(verse.page)}`
                                    : ''}
                                </span>
                                {renderVerseActionBar(verse, true)}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : displayMode === 'compare' ? (
                  /* ===================== MODE 3: MULTI-LANGUAGE COMPARISON ===================== */
                  <div className="space-y-3">
                    {filteredVerses.map((verse) => {
                      const isThisVersePlaying =
                        isPlayingAudio &&
                        activeAudioSurahNumber === selectedSurahNumber &&
                        activeAudioAyahNumber === verse.ayahNumber;

                      return (
                        <article
                          key={verse.ayahNumber}
                          ref={(el) => {
                            verseRefs.current[verse.ayahNumber] = el;
                          }}
                          className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition-colors ${
                            isThisVersePlaying
                              ? 'bg-[#EFE6D1]/85 dark:bg-[#1F3A6E]/35 border-[#8A6418] dark:border-[#D9B45A] shadow-md'
                              : 'bg-[#FBF7EE] dark:bg-[#151d29] border-[#8A6418]/25 dark:border-[#D9B45A]/25'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#8A6418]/15 dark:border-[#D9B45A]/15">
                            <div className="flex items-center gap-2">
                              <BayanRubElHizbBadge
                                label={toArabicIndic(verse.ayahNumber)}
                                active={isThisVersePlaying}
                                sizeClass="w-7 h-7 text-[11px]"
                              />
                              <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] tabular-nums">
                                سورة {currentSurahMeta.name}
                              </span>
                            </div>
                            {renderVerseActionBar(verse)}
                          </div>

                          <p
                            dir="rtl"
                            lang="ar"
                            style={{ fontSize: `${Math.round(fontSize * 1.4)}px` }}
                            className="font-quran leading-[2.05] text-[#1B1A17] dark:text-[#F6EFDD] text-right"
                          >
                            {verse.arabicText}{' '}
                            <span className="text-[#8A6418] dark:text-[#D9B45A] font-sans text-[0.72em] mx-1">
                              ﴿{toArabicIndic(verse.ayahNumber)}﴾
                            </span>
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#8A6418]/15 dark:border-[#D9B45A]/15">
                            {comparisonVerseMaps.map((entry) => {
                              const trText = entry.byAyah.get(verse.ayahNumber) || '';
                              return (
                                <div
                                  key={entry.edition.id}
                                  dir={entry.edition.dir}
                                  lang={entry.edition.langCode}
                                  className="rounded-xl bg-[#F6EFDD]/65 dark:bg-[#0b1018]/80 border border-[#8A6418]/20 dark:border-[#D9B45A]/20 p-3.5 space-y-1.5"
                                >
                                  <div
                                    className={`text-[11px] font-bold text-[#1F3A6E] dark:text-[#D9B45A] ${
                                      entry.edition.dir === 'ltr' ? 'text-left' : 'text-right'
                                    }`}
                                  >
                                    {entry.edition.nativeTitle}
                                  </div>
                                  <p
                                    style={{ fontSize: `${fontSize}px` }}
                                    className={`leading-[1.7] text-[#2D2A24] dark:text-[#E9E3D3] ${
                                      entry.edition.dir === 'ltr' ? 'text-left' : 'text-right'
                                    }`}
                                  >
                                    {trText}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  /* ===================== MODES 2 & 4: STACKED BILINGUAL OR TRANSLATION ONLY ===================== */
                  <div className="space-y-3">
                    {filteredVerses.map((verse) => {
                      const isThisVersePlaying =
                        isPlayingAudio &&
                        activeAudioSurahNumber === selectedSurahNumber &&
                        activeAudioAyahNumber === verse.ayahNumber;

                      return (
                        <article
                          key={verse.ayahNumber}
                          ref={(el) => {
                            verseRefs.current[verse.ayahNumber] = el;
                          }}
                          className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3.5 ${
                            isThisVersePlaying
                              ? 'bg-[#EFE6D1]/85 dark:bg-[#1F3A6E]/35 border-[#8A6418] dark:border-[#D9B45A] shadow-md'
                              : 'bg-[#FBF7EE] dark:bg-[#151d29] border-[#8A6418]/25 dark:border-[#D9B45A]/25'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#8A6418]/15 dark:border-[#D9B45A]/15">
                            <div className="flex items-center gap-2 text-xs tabular-nums">
                              <BayanRubElHizbBadge
                                label={toArabicIndic(verse.ayahNumber)}
                                active={isThisVersePlaying}
                                sizeClass="w-7 h-7 text-[11px]"
                              />
                              <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">
                                {toArabicIndic(selectedSurahNumber)}:{toArabicIndic(verse.ayahNumber)}
                              </span>
                              {typeof verse.page === 'number' && verse.page > 0 && (
                                <span className="text-[#5C5549] dark:text-slate-400">
                                  · ص {toArabicIndic(verse.page)}
                                </span>
                              )}
                            </div>
                            {renderVerseActionBar(verse)}
                          </div>

                          {displayMode === 'bilingual' && (
                            <p
                              dir="rtl"
                              lang="ar"
                              style={{ fontSize: `${Math.round(fontSize * 1.42)}px` }}
                              className="font-quran leading-[2.05] text-[#1B1A17] dark:text-[#F6EFDD] text-right"
                            >
                              {verse.arabicText}{' '}
                              <span className="text-[#8A6418] dark:text-[#D9B45A] font-sans text-[0.72em] mx-1">
                                ﴿{toArabicIndic(verse.ayahNumber)}﴾
                              </span>
                            </p>
                          )}

                          <p
                            dir={currentEdition.dir}
                            lang={currentEdition.langCode}
                            style={{ fontSize: `${fontSize}px` }}
                            className={`leading-[1.75] ${
                              currentEdition.dir === 'ltr' ? 'text-left' : 'text-right'
                            } text-[#2D2A24] dark:text-[#E9E3D3] font-normal`}
                          >
                            {displayMode === 'translation-only' && (
                              <span className="font-bold text-[#8A6418] dark:text-[#D9B45A] mr-2 tabular-nums">
                                {verse.ayahNumber}.
                              </span>
                            )}
                            {verse.translationText}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* Footer Surah Navigation */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={selectedSurahNumber <= 1}
                    onClick={() => handleSelectSurah(selectedSurahNumber - 1)}
                    className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#FBF7EE] dark:bg-[#151d29] border border-[#8A6418]/30 dark:border-[#D9B45A]/25 hover:border-[#8A6418] dark:hover:border-[#D9B45A] text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                    <span>
                      {selectedSurahNumber > 1
                        ? `السابقة: ${SURAHS_LIST[selectedSurahNumber - 2].name}`
                        : 'بداية المصحف'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedSurahNumber >= 114}
                    onClick={() => handleSelectSurah(selectedSurahNumber + 1)}
                    className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <span>
                      {selectedSurahNumber < 114
                        ? `التالية: ${SURAHS_LIST[selectedSurahNumber].name}`
                        : 'ختام المصحف'}
                    </span>
                    <ChevronLeft className="w-4 h-4 text-[#D9B45A]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MOBILE SURAH PICKER DRAWER ===================== */}
      {isMobileSurahDrawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSurahDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="فهرس سور الترجمة"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[82vh] bg-[#FBF7EE] dark:bg-[#151d29] border-t border-[#8A6418]/35 dark:border-[#D9B45A]/35 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="w-10 h-1.5 bg-[#8A6418]/40 dark:bg-[#D9B45A]/40 rounded-full mx-auto mt-3" />
            <div className="p-4 border-b border-[#8A6418]/20 dark:border-[#D9B45A]/20 flex items-center justify-between">
              <div className="font-bold text-sm font-kufi text-[#1B1A17] dark:text-[#F6EFDD]">
                اختيار السورة ({toArabicIndic(114)})
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSurahDrawerOpen(false)}
                aria-label="إغلاق الفهرس"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5C5549] dark:text-slate-300 hover:bg-[#EFE6D1] dark:hover:bg-[#10161f] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-[#8A6418]/20 dark:border-[#D9B45A]/20">
              <div className="relative">
                <Search className="w-4 h-4 text-[#5C5549] dark:text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={surahQuery}
                  onChange={(e) => setSurahQuery(e.target.value)}
                  placeholder="ابحث بالعربية أو English أو الرقم..."
                  aria-label="بحث السورة"
                  className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-xl bg-[#F6EFDD]/60 dark:bg-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/25 text-xs text-[#1B1A17] dark:text-[#F6EFDD] outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                />
              </div>
            </div>

            <div className="p-3 overflow-y-auto space-y-1.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {filteredSurahs.map((s) => {
                const isSelected = s.number === selectedSurahNumber;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => handleSelectSurah(s.number)}
                    className={`w-full min-h-[48px] px-3 py-2.5 rounded-2xl border text-right flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#1F3A6E] border-[#D9B45A] text-[#F6EFDD]'
                        : 'bg-[#F6EFDD]/50 dark:bg-[#10161f]/70 border-[#8A6418]/20 dark:border-[#D9B45A]/20 text-[#1B1A17] dark:text-[#E9E3D3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BayanRubElHizbBadge
                        label={toArabicIndic(s.number)}
                        active={isSelected}
                        sizeClass="w-8 h-8 text-[11px]"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs">سورة {s.name}</div>
                        <div
                          dir="ltr"
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-[#E9E3D3]/85' : 'text-[#5C5549] dark:text-slate-400'
                          }`}
                        >
                          {s.englishName} · {s.englishNameTranslation}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] tabular-nums opacity-75">
                      {toArabicIndic(s.numberOfAyahs)} آية
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
