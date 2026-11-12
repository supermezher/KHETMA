import React, { useState, useEffect } from 'react';
import { Flame, BookOpen, CheckCircle, Clock, Calendar, Trophy, TrendingUp } from 'lucide-react';
import {
  loadFaithStats,
  generateRealHeatmapData,
  FaithStats,
  HeatmapDay
} from '../data/faithAnalyticsService';

interface FaithAnalyticsProps {
  onClose?: () => void;
}

export const FaithAnalytics: React.FC<FaithAnalyticsProps> = () => {
  const [stats, setStats] = useState<FaithStats>(() => loadFaithStats());
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>(() =>
    generateRealHeatmapData(stats.history)
  );
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Read actual journal notes count from localStorage
  const [journalNotesCount, setJournalNotesCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bayan_journal_notes');
      return saved ? JSON.parse(saved).length : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const loaded = loadFaithStats();
    setStats(loaded);
    setHeatmapData(generateRealHeatmapData(loaded.history));

    try {
      const saved = localStorage.getItem('bayan_journal_notes');
      setJournalNotesCount(saved ? JSON.parse(saved).length : 0);
    } catch {
      // ignore
    }
  }, []);

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
      {/* Top Banner & Motivation */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/20 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-2">
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

          {/* Real Streak Counter */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {stats.streakDays} {stats.streakDays === 1 ? 'يوم' : 'أيام'}
              </div>
              <div className="text-xs text-slate-400">سلسلة الورد المتصل الحقيقي</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards: Real Genuine Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Ayahs */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">مجموع الآيات المقروءة</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalAyahs.toLocaleString('ar-SA')}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+{stats.thisWeekAyahs} آية هذا الأسبوع</span>
          </div>
        </div>

        {/* Completed Khatmas */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">الختمات المكتملة</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats.completedKhatmas} {stats.completedKhatmas === 1 ? 'ختمة' : 'ختمات'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            الختمة الحالية: {khatmaPercentage}% (صفحة {stats.currentKhatmaPage})
          </div>
        </div>

        {/* Listening Minutes */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">دقائق التلاوة والاستماع</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalMinutes} دقيقة</div>
          <div className="text-[11px] text-slate-400 mt-1">
            من وقتك المبارك مع كتاب الله
          </div>
        </div>

        {/* Journal Notes */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">خواطر التدبر</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{journalNotesCount} تدبراً</div>
          <div className="text-[11px] text-purple-300 mt-1">
            مسجلة في مفكرتك الخاصة
          </div>
        </div>
      </div>

      {/* GitHub-style Heatmap (Strictly from real reading history) */}
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

          {/* Legend */}
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

        {/* The Grid */}
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

        {/* Hover readout */}
        <div className="mt-3 text-xs text-slate-400 h-5 flex items-center">
          {hoveredDay ? (
            <span className="text-emerald-300 font-medium">
              📅 {hoveredDay.date}: قرأت {hoveredDay.ayahCount} آية كريمة ({hoveredDay.minutes} دقيقة)
            </span>
          ) : (
            <span>مرر المؤشر فوق المربعات لعرض نشاطك المسجل في ذلك اليوم</span>
          )}
        </div>
      </div>
    </div>
  );
};
