import React, { useState, useEffect, useRef } from 'react';
import {
  Flame, BookOpen, CheckCircle, Clock, Calendar, Trophy, TrendingUp,
  Download, Upload, HardDriveDownload, Check, AlertCircle, ShieldAlert, X
} from 'lucide-react';
import {
  loadFaithStats,
  generateRealHeatmapData,
  FaithStats,
  HeatmapDay
} from '../data/faithAnalyticsService';
import { downloadFullQuranOffline, getOfflineCachedSurahsCount } from '../data/quranService';
import { safeLocalStorage } from '../utils/safeStorage';
import {
  BayanUserBackup,
  buildUserBackupPayload,
  validateAndParseUserBackup,
  restoreUserBackupData
} from '../utils/userBackup';
import { toArabicIndic } from './khatma/KhatmaRing';
import {
  getDailyWirdSummary,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  PERSONAL_KHATMA_EVENT,
} from '../utils/personalKhatma';

interface FaithAnalyticsProps {
  onClose?: () => void;
  onBackupRestored?: (backup: BayanUserBackup) => void;
}

export const FaithAnalytics: React.FC<FaithAnalyticsProps> = ({ onBackupRestored }) => {
  const [stats, setStats] = useState<FaithStats>(() => loadFaithStats());
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>(() =>
    generateRealHeatmapData(stats.history)
  );
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const [journalNotesCount, setJournalNotesCount] = useState<number>(
    () => safeLocalStorage.getJSON<unknown[]>('bayan_journal_notes', []).length
  );

  // Offline bundle & backup management state
  const [cachedSurahsCount, setCachedSurahsCount] = useState<number>(4);
  const [isDownloadingQuran, setIsDownloadingQuran] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BayanUserBackup | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState<boolean>(false);
  const [personalPlan, setPersonalPlan] = useState<KhatmaPlan | null>(() => loadPersonalKhatmaPlan());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMetrics = () => {
    const loaded = loadFaithStats();
    setStats(loaded);
    setHeatmapData(generateRealHeatmapData(loaded.history));
    setJournalNotesCount(safeLocalStorage.getJSON<unknown[]>('bayan_journal_notes', []).length);
    setPersonalPlan(loadPersonalKhatmaPlan());
  };

  useEffect(() => {
    refreshMetrics();
    getOfflineCachedSurahsCount().then(setCachedSurahsCount).catch(() => {});
    const onPlanSync = () => setPersonalPlan(loadPersonalKhatmaPlan());
    window.addEventListener(PERSONAL_KHATMA_EVENT, onPlanSync);
    window.addEventListener('storage', onPlanSync);
    return () => {
      window.removeEventListener(PERSONAL_KHATMA_EVENT, onPlanSync);
      window.removeEventListener('storage', onPlanSync);
    };
  }, []);

  const handleDownloadOfflineQuran = async () => {
    if (isDownloadingQuran) return;
    setIsDownloadingQuran(true);
    setBackupMessage(null);
    setDownloadProgress({ completed: 0, total: 114, failed: 0 });
    const res = await downloadFullQuranOffline((progress) => {
      setDownloadProgress(progress);
    });
    const newCount = await getOfflineCachedSurahsCount();
    setCachedSurahsCount(newCount);
    setIsDownloadingQuran(false);
    setBackupMessage(
      res.failed === 0
        ? { type: 'ok', text: `تم حفظ المصحف الكامل (${res.completed} سورة) محلياً للعمل دون اتصال.` }
        : { type: 'err', text: `تم حفظ ${res.completed} سورة وتعذر تحميل ${res.failed} سورة بسبب الشبكة.` }
    );
  };

  const handleExportBackup = () => {
    const payload = buildUserBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bayan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage({ type: 'ok', text: 'تم تنزيل ملف النسخ الاحتياطي لبياناتك بنجاح.' });
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = validateAndParseUserBackup(text);
      if (!parsed.ok) {
        setBackupMessage({ type: 'err', text: parsed.error });
        return;
      }
      // Show explicit confirmation before overwriting existing notes, bookmarks, or SRS progress
      setPendingBackup(parsed.data);
      setBackupMessage(null);
    } catch {
      setBackupMessage({ type: 'err', text: 'حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackup || isRestoringBackup) return;
    setIsRestoringBackup(true);
    try {
      const counts = await restoreUserBackupData(pendingBackup);
      refreshMetrics();
      onBackupRestored?.(pendingBackup);
      setPendingBackup(null);
      setBackupMessage(
        counts.persistedOk
          ? {
              type: 'ok',
              text: `تمت الاستعادة بنجاح: ${counts.notesCount} خواطر، ${counts.bookmarksCount} علامات، ${counts.srsCount} بطاقة حفظ.`
            }
          : {
              type: 'err',
              text: 'تم استرجاع النسخة في الجلسة ولكن امتلأت سعة تخزين المتصفح المحلية — قد لا تُحفظ بعض الحقول بعد التحديث.'
            }
      );
    } catch {
      setBackupMessage({ type: 'err', text: 'تعذر إتمام استعادة النسخة الاحتياطية.' });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const getCellColor = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-[#D6E1F4] border-[#8FAAD9]/60 dark:bg-[#172848] dark:border-[#2E5499]/40';
      case 2:
        return 'bg-[#4E74B8] border-[#1F3A6E]/60 dark:bg-[#2E5499] dark:border-[#648CD4]/50';
      case 3:
        return 'bg-[#B6903B] border-[#8A6418] dark:border-[#D9B45A] shadow-sm shadow-[#D9B45A]/20';
      case 4:
        return 'bg-[#D9B45A] border-[#8A6418] dark:border-[#F6EFDD] shadow-sm shadow-[#D9B45A]/40';
      default:
        return 'bg-[#E8DFC8] border-[#8A6418]/15 dark:bg-slate-800/50 dark:border-slate-800/80';
    }
  };

  const khatmaPercentage = Math.round((stats.currentKhatmaPage / 604) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-l from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1] dark:from-[#142038] dark:via-[#10161f] dark:to-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/25 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] text-xs font-bold mb-2">
              <Trophy className="w-3.5 h-3.5" />
              <span>لوحة الإنجاز الإيماني وسجل الورد الفعلي</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] mb-1 font-kufi">
              ﴿ وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ ﴾
            </h2>
            <p className="font-naskh text-sm sm:text-base text-[#5C5549] dark:text-slate-300 max-w-xl leading-relaxed">
              قال رسول الله ﷺ: «أَحَبُّ الأعمالِ إلى اللهِ أَدْوَمُها وإنْ قَلَّ». تُسجل هذه اللوحة وردك القرآني الحقيقي يوماً بيوم لتبني عادة إيمانية راسخة.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#EFE6D1] dark:bg-[#0a0f17]/90 p-3.5 rounded-2xl border border-[#8A6418]/25 dark:border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-[#D9B45A]/20 text-[#8A6418] dark:text-[#D9B45A] flex items-center justify-center font-bold text-xl border border-[#8A6418]/30 dark:border-[#D9B45A]/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#1B1A17] dark:text-[#F6EFDD] font-mono tabular-nums">
                {toArabicIndic(stats.streakDays)} {stats.streakDays === 1 ? 'يوم' : 'أيام'}
              </div>
              <div className="text-xs text-[#5C5549] dark:text-slate-400">سلسلة الورد المتصل الحقيقي</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">مجموع الآيات المقروءة</span>
            <BookOpen className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
          </div>
          <div className="text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-mono tabular-nums">{stats.totalAyahs.toLocaleString('ar-SA')}</div>
          <div className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] mt-1 flex items-center gap-1 tabular-nums">
            <TrendingUp className="w-3 h-3" />
            <span>+{toArabicIndic(stats.thisWeekAyahs)} آية هذا الأسبوع</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">الختمات المكتملة</span>
            <CheckCircle className="w-4 h-4 text-[#1F3A6E] dark:text-[#648CD4]" />
          </div>
          <div className="text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-mono tabular-nums">
            {toArabicIndic(stats.completedKhatmas)} {stats.completedKhatmas === 1 ? 'ختمة' : 'ختمات'}
          </div>
          <div className="text-[11px] text-[#5C5549] dark:text-slate-400 mt-1 tabular-nums">
            الختمة الحالية: {toArabicIndic(khatmaPercentage)}% (صفحة {toArabicIndic(stats.currentKhatmaPage)})
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">دقائق التلاوة والاستماع</span>
            <Clock className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
          </div>
          <div className="text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-mono tabular-nums">{toArabicIndic(stats.totalMinutes)} دقيقة</div>
          <div className="text-[11px] text-[#5C5549] dark:text-slate-400 mt-1">
            من وقتك المبارك مع كتاب الله
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">خواطر التدبر</span>
            <Calendar className="w-4 h-4 text-[#1F3A6E] dark:text-[#648CD4]" />
          </div>
          <div className="text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-mono tabular-nums">{toArabicIndic(journalNotesCount)} تدبراً</div>
          <div className="text-[11px] text-[#1F3A6E] dark:text-[#648CD4] mt-1">
            مسجلة في مفكرتك الخاصة
          </div>
        </div>
      </div>

      {/* Unified Personal Khatma & Daily Wird Sync Summary */}
      {personalPlan && (() => {
        const wird = getDailyWirdSummary(personalPlan);
        return (
          <div className="p-5 rounded-3xl bg-gradient-to-l from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1] dark:from-[#142038]/90 dark:via-[#10161f] dark:to-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/30 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
                <h3 className="font-bold text-sm sm:text-base text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
                  مؤشر وِردك اليومي الموحّد
                </h3>
              </div>
              <span
                className={`text-xs font-bold tabular-nums px-2.5 py-1 rounded-lg border ${
                  wird.isTodayComplete
                    ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-[#EFE6D1] border-[#8A6418]/25 text-[#8A6418] dark:bg-slate-950 dark:border-slate-800 dark:text-[#D9B45A]'
                }`}
              >
                {wird.isTodayComplete
                  ? `✓ أتممت ورد اليوم (${toArabicIndic(wird.todayPagesRead)}/${toArabicIndic(wird.dailyTargetPages)})`
                  : `اليوم: ${toArabicIndic(wird.todayPagesRead)} من ${toArabicIndic(wird.dailyTargetPages)} صفحة (${toArabicIndic(wird.todayPercent)}٪)`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs tabular-nums">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-300">
                  <span>إنجاز اليوم</span>
                  <span className="font-bold text-[#8A6418] dark:text-[#D9B45A]">{toArabicIndic(wird.todayPercent)}٪</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#E5DBBF] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      wird.isTodayComplete
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-gradient-to-l from-[#D9B45A] to-[#1F3A6E]'
                    }`}
                    style={{ width: `${wird.todayPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[#5C5549] dark:text-slate-300">
                  <span>إجمالي الختمة ({toArabicIndic(wird.completedPages)} / {toArabicIndic(wird.totalPages)} صفحة)</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{toArabicIndic(wird.totalPercent)}٪</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#E5DBBF] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-emerald-500 to-[#D9B45A] transition-all duration-300"
                    style={{ width: `${wird.totalPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Yearly Activity Heatmap */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>سجل النشاط والتلاوة الفعلي (365 يوماً)</span>
            </h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-400">
              كل مربع يمثل يوماً حقيقياً، وتزداد إضاءة المربع بتزايد عدد الآيات التي قرأتها في ذلك اليوم
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#5C5549] dark:text-slate-400">
            <span>أقل</span>
            <div className="w-3 h-3 rounded-xs bg-[#E8DFC8] border border-[#8A6418]/20 dark:bg-slate-800/80 dark:border-slate-700" />
            <div className="w-3 h-3 rounded-xs bg-[#D6E1F4] border border-[#8FAAD9]/60 dark:bg-[#172848] dark:border-[#2E5499]/40" />
            <div className="w-3 h-3 rounded-xs bg-[#4E74B8] dark:bg-[#2E5499]" />
            <div className="w-3 h-3 rounded-xs bg-[#B6903B]" />
            <div className="w-3 h-3 rounded-xs bg-[#D9B45A]" />
            <span>أكثر</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-grid grid-flow-col grid-rows-7 gap-1 min-w-[700px]">
            {heatmapData.map((day, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-3 h-3 rounded-xs border transition-transform hover:scale-125 cursor-pointer ${getCellColor(
                  day.intensity
                )}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 text-xs text-[#5C5549] dark:text-slate-400 h-5 flex items-center tabular-nums">
          {hoveredDay ? (
            <span className="text-[#8A6418] dark:text-[#D9B45A] font-medium">
              {hoveredDay.date}: قرأت {hoveredDay.ayahCount} آية كريمة ({hoveredDay.minutes} دقيقة)
            </span>
          ) : (
            <span>مرر المؤشر فوق المربعات لعرض نشاطك المسجل في ذلك اليوم</span>
          )}
        </div>
      </div>

      {/* Offline Quran Storage & Data Backup Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Offline Full Quran Downloader */}
        <div className="p-5 rounded-3xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-sm flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>حفظ المصحف الكامل دون اتصال (IndexedDB)</span>
            </h3>
            <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-mono tabular-nums">
              {toArabicIndic(cachedSurahsCount)} / ١١٤ سورة
            </span>
          </div>
          <p className="text-xs text-[#5C5549] dark:text-slate-400 leading-relaxed">
            قم بتنزيل نصوص المصحف الكامل بالرسم العثماني والتجويد والتفسير الميسر محلياً للبحث والقراءة بلا إنترنت.
          </p>

          {downloadProgress && isDownloadingQuran && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-[#E5DBBF] dark:bg-slate-950 rounded-full overflow-hidden border border-[#8A6418]/20 dark:border-slate-800">
                <div
                  className="h-full bg-[#D9B45A] transition-all"
                  style={{ width: `${Math.round(((downloadProgress.completed + downloadProgress.failed) / downloadProgress.total) * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-[#5C5549] dark:text-slate-400 tabular-nums">
                تم تحميل {downloadProgress.completed} من {downloadProgress.total} سورة...
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadOfflineQuran}
            disabled={isDownloadingQuran}
            className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] disabled:opacity-60 text-[#F6EFDD] border border-[#648CD4]/40 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>
              {isDownloadingQuran
                ? 'جارٍ التنزيل المحلي...'
                : cachedSurahsCount >= 114
                  ? 'تحديث النسخة المحلية الكاملة (١١٤ سورة)'
                  : 'تنزيل المصحف الكامل للعمل دون اتصال'}
            </span>
          </button>
        </div>

        {/* Backup & Restore User Data */}
        <div className="p-5 rounded-3xl bg-[#FBF7EE] dark:bg-[#10161f]/90 border border-[#8A6418]/25 dark:border-slate-800 shadow-lg space-y-3">
          <h3 className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-[#1F3A6E] dark:text-[#648CD4]" />
            <span>النسخ الاحتياطي والاستعادة لبياناتك</span>
          </h3>
          <p className="text-xs text-[#5C5549] dark:text-slate-400 leading-relaxed">
            احفظ نسخة من مفكرة التدبر، العلامات المرجعية، تفضيلات المصحف، خطة الحفظ المتباعد، وسجل الختمات في ملف JSON أو استعدها على جهاز آخر.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="min-h-[42px] py-2.5 px-3 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 border border-[#8A6418]/25 dark:border-slate-700 text-[#1B1A17] dark:text-[#F6EFDD] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>تصدير نسخة (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] py-2.5 px-3 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 border border-[#8A6418]/25 dark:border-slate-700 text-[#1B1A17] dark:text-[#F6EFDD] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
              <span>استيراد واستعادة</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>

          {pendingBackup && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-[#8A6418]/40 dark:border-[#D9B45A]/45 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8A6418] dark:text-[#D9B45A]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>تأكيد استبدال البيانات الحالية</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingBackup(null)}
                  aria-label="إلغاء الاستعادة"
                  className="p-1 text-[#5C5549] hover:text-[#1B1A17] dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[#5C5549] dark:text-slate-300 leading-relaxed">
                سيتم استعادة{' '}
                <strong>{pendingBackup.journalNotes.length}</strong> خواطر،{' '}
                <strong>{Object.keys(pendingBackup.bookmarks).length}</strong> علامات مرجعية، و
                <strong>{Object.keys(pendingBackup.memorizationSrs).length}</strong> بطاقة حفظ فوق السجلات الحالية.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoringBackup}
                  className="flex-1 min-h-[38px] py-1.5 px-3 rounded-xl bg-[#D9B45A] hover:bg-[#e3be69] text-[#1B1A17] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isRestoringBackup ? 'جارٍ الاستعادة...' : 'تأكيد الاستعادة الآن'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBackup(null)}
                  className="min-h-[38px] py-1.5 px-3 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1B1A17] dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {backupMessage && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                backupMessage.type === 'ok'
                  ? 'bg-[#1F3A6E]/10 border-[#1F3A6E]/30 text-[#1B1A17] dark:bg-[#172848]/70 dark:border-[#648CD4]/40 dark:text-[#F6EFDD]'
                  : 'bg-rose-50 border-rose-500/40 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
              }`}
            >
              {backupMessage.type === 'ok' ? <Check className="w-3.5 h-3.5 shrink-0 text-[#8A6418] dark:text-[#D9B45A]" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />}
              <span>{backupMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
