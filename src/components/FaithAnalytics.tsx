import React, { useState, useEffect, useRef } from 'react';
import {
  Flame, BookOpen, CheckCircle, Clock, Calendar, Trophy, TrendingUp,
  Download, Upload, HardDriveDownload, Check, AlertCircle
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
  buildUserBackupPayload,
  validateAndParseUserBackup,
  restoreUserBackupData
} from '../utils/userBackup';

interface FaithAnalyticsProps {
  onClose?: () => void;
}

export const FaithAnalytics: React.FC<FaithAnalyticsProps> = () => {
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMetrics = () => {
    const loaded = loadFaithStats();
    setStats(loaded);
    setHeatmapData(generateRealHeatmapData(loaded.history));
    setJournalNotesCount(safeLocalStorage.getJSON<unknown[]>('bayan_journal_notes', []).length);
  };

  useEffect(() => {
    refreshMetrics();
    getOfflineCachedSurahsCount().then(setCachedSurahsCount).catch(() => {});
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
      const counts = restoreUserBackupData(parsed.data);
      refreshMetrics();
      setBackupMessage({
        type: 'ok',
        text: `تمت الاستعادة: ${counts.notesCount} خواطر، ${counts.bookmarksCount} علامات، ${counts.srsCount} بطاقة حفظ.`
      });
    } catch {
      setBackupMessage({ type: 'err', text: 'حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.' });
    } finally {
      e.target.value = '';
    }
  };

  const getCellColor = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-emerald-950/80 border-emerald-800/40';
      case 2:
        return 'bg-emerald-700 border-emerald-600';
      case 3:
        return 'bg-emerald-500 border-emerald-400 shadow-sm shadow-emerald-500/30';
      case 4:
        return 'bg-emerald-300 border-white shadow-sm shadow-emerald-400/50';
      default:
        return 'bg-slate-800/50 border-slate-800/80';
    }
  };

  const khatmaPercentage = Math.round((stats.currentKhatmaPage / 604) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/20 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold mb-2">
              <Trophy className="w-3.5 h-3.5" />
              <span>لوحة الإنجاز الإيماني وسجل الورد الفعلي</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 font-kufi">
              ﴿ وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ ﴾
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              قال رسول الله ﷺ: «أَحَبُّ الأعمالِ إلى اللهِ أَدْوَمُها وإنْ قَلَّ». تُسجل هذه اللوحة وردك القرآني الحقيقي يوماً بيوم لتبني عادة إيمانية راسخة.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {stats.streakDays} {stats.streakDays === 1 ? 'يوم' : 'أيام'}
              </div>
              <div className="text-xs text-slate-400">سلسلة الورد المتصل الحقيقي</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">مجموع الآيات المقروءة</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">{stats.totalAyahs.toLocaleString('ar-SA')}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 tabular-nums">
            <TrendingUp className="w-3 h-3" />
            <span>+{stats.thisWeekAyahs} آية هذا الأسبوع</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">الختمات المكتملة</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {stats.completedKhatmas} {stats.completedKhatmas === 1 ? 'ختمة' : 'ختمات'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
            الختمة الحالية: {khatmaPercentage}% (صفحة {stats.currentKhatmaPage})
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">دقائق التلاوة والاستماع</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">{stats.totalMinutes} دقيقة</div>
          <div className="text-[11px] text-slate-400 mt-1">
            من وقتك المبارك مع كتاب الله
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">خواطر التدبر</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">{journalNotesCount} تدبراً</div>
          <div className="text-[11px] text-purple-300 mt-1">
            مسجلة في مفكرتك الخاصة
          </div>
        </div>
      </div>

      {/* GitHub-style Heatmap */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>سجل النشاط والتلاوة الفعلي (365 يوماً)</span>
            </h3>
            <p className="text-xs text-slate-400">
              كل مربع يمثل يوماً حقيقياً، وتزداد درجة اللون بتزايد عدد الآيات التي قرأتها في ذلك اليوم
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>أقل</span>
            <div className="w-3 h-3 rounded-xs bg-slate-800/80 border border-slate-700"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-950/80 border border-emerald-800"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-700"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-500"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-300"></div>
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

        <div className="mt-3 text-xs text-slate-400 h-5 flex items-center tabular-nums">
          {hoveredDay ? (
            <span className="text-emerald-300 font-medium">
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
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-emerald-400" />
              <span>حفظ المصحف الكامل دون اتصال (IndexedDB)</span>
            </h3>
            <span className="text-xs text-emerald-400 font-mono tabular-nums">
              {cachedSurahsCount} / 114 سورة
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            قم بتنزيل نصوص المصحف الكامل بالرسم العثماني والتجويد والتفسير الميسر محلياً للبحث والقراءة بلا إنترنت.
          </p>

          {downloadProgress && isDownloadingQuran && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(((downloadProgress.completed + downloadProgress.failed) / downloadProgress.total) * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                تم تحميل {downloadProgress.completed} من {downloadProgress.total} سورة...
              </div>
            </div>
          )}

          <button
            onClick={handleDownloadOfflineQuran}
            disabled={isDownloadingQuran}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>
              {isDownloadingQuran
                ? 'جارٍ التنزيل المحلي...'
                : cachedSurahsCount >= 114
                  ? 'تحديث النسخة المحلية الكاملة (114 سورة)'
                  : 'تنزيل المصحف الكامل للعمل دون اتصال'}
            </span>
          </button>
        </div>

        {/* Backup & Restore User Data */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-sky-400" />
            <span>النسخ الاحتياطي والاستعادة لبياناتك</span>
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            احفظ نسخة من مفكرة التدبر، العلامات المرجعية، خطة الحفظ المتباعد، وسجل الختمات في ملف JSON آمن أو استعدها على جهاز آخر.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleExportBackup}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير نسخة (.json)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
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

          {backupMessage && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                backupMessage.type === 'ok'
                  ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-500/30 text-rose-300'
              }`}
            >
              {backupMessage.type === 'ok' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{backupMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
