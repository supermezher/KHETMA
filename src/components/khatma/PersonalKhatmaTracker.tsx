import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  Edit2,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Trophy,
} from 'lucide-react';
import { KhatmaRing, toArabicIndic } from './KhatmaRing';
import {
  buildPersonalRingParts,
  clearPersonalKhatmaPlan,
  computePersonalKhatmaStats,
  formatLocalDateISO,
  getSurahAtMushafPage,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  PERSONAL_KHATMA_EVENT,
  PRAYER_LABELS,
  savePersonalKhatmaPlan,
} from '../../utils/personalKhatma';

interface PersonalKhatmaTrackerProps {
  onOpenPlanner: () => void;
  onNavigateToJuz?: (juzNumber: number) => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
}

export const PersonalKhatmaTracker: React.FC<PersonalKhatmaTrackerProps> = ({
  onOpenPlanner,
  onNavigateToJuz,
  onNavigateToAyah,
}) => {
  const [plan, setPlan] = useState<KhatmaPlan | null>(() => loadPersonalKhatmaPlan());
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const syncPlan = () => {
      setPlan(loadPersonalKhatmaPlan());
    };
    window.addEventListener(PERSONAL_KHATMA_EVENT, syncPlan);
    window.addEventListener('storage', syncPlan);
    return () => {
      window.removeEventListener(PERSONAL_KHATMA_EVENT, syncPlan);
      window.removeEventListener('storage', syncPlan);
    };
  }, []);

  const flashFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  if (!plan) {
    return (
      <section className="p-6 sm:p-10 rounded-2xl bg-[#10161f] border border-[#2e5499]/40 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1f3a6e]/50 border border-[#D9B45A]/40 flex items-center justify-center text-[#D9B45A]">
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="max-w-xl mx-auto space-y-2.5">
          <h3 className="text-lg sm:text-xl font-bold text-[#F6EFDD]" style={{ textWrap: 'balance' }}>
            خطط لختمتك الفردية ووزّع وِردك بدقة
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            حدد عدد الختمات أو الأجزاء والمدة التي تناسبك (مثلاً ٣ ختمات في رمضان خلال ٣٠ أو ٢٩ يوماً)، وسيحسب التطبيق وِردك اليومي وتوزيعه بعد كل صلاة مع متابعة مرئية للتقدم.
          </p>
        </div>

        <div className="max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90">
            <span className="text-xs font-bold text-[#D9B45A] block">ختمة في شهر</span>
            <span className="text-[11px] text-slate-400 block mt-1 tabular-nums">
              جزء يومياً · ٢٠ صفحة · ٤ صفحات/صلاة
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90">
            <span className="text-xs font-bold text-[#D9B45A] block">ختمتان في شهر</span>
            <span className="text-[11px] text-slate-400 block mt-1 tabular-nums">
              جزآن يومياً · ٤١ صفحة · ~٨ صفحات/صلاة
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90">
            <span className="text-xs font-bold text-[#D9B45A] block">٣ ختمات في رمضان</span>
            <span className="text-[11px] text-slate-400 block mt-1 tabular-nums">
              ٣ أجزاء يومياً · ٦١ صفحة · ~١٢ صفحة/صلاة
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={onOpenPlanner}
            className="min-h-[46px] px-7 py-3 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#10161f] text-sm font-bold shadow-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إعداد خطة ختمتي الفردية</span>
          </button>
        </div>
      </section>
    );
  }

  const stats = computePersonalKhatmaStats(plan);
  const ringParts = buildPersonalRingParts(stats);
  const resumeSurah = getSurahAtMushafPage(stats.currentPageInCycle);

  const handleTogglePrayerSlot = (idx: number) => {
    const currentSlots = [...stats.todayPrayers] as [boolean, boolean, boolean, boolean, boolean];
    const nextDone = !currentSlots[idx];
    currentSlots[idx] = nextDone;

    const delta = stats.prayerSplit[idx] || 0;
    const nextCompleted = nextDone
      ? Math.min(stats.totalPages, stats.completedPages + delta)
      : Math.max(0, stats.completedPages - delta);

    const updated = savePersonalKhatmaPlan({
      ...plan,
      completedPages: nextCompleted,
      dailyPrayersDone: {
        date: formatLocalDateISO(),
        slots: currentSlots,
      },
    });
    setPlan(updated);
  };

  const handleAdjustPages = (delta: number) => {
    const nextCompleted = Math.min(stats.totalPages, Math.max(0, stats.completedPages + delta));
    const updated = savePersonalKhatmaPlan({
      ...plan,
      completedPages: nextCompleted,
    });
    setPlan(updated);
  };

  const handleSpreadGentleCatchUp = () => {
    const nextDaily = Math.max(1, stats.gentleSpreadPagesPerDay);
    const updated = savePersonalKhatmaPlan({
      ...plan,
      pagesPerDay: nextDaily,
      pagesPerPrayer: Math.ceil(nextDaily / 5),
    });
    setPlan(updated);
    flashFeedback(`تم توزيع الفائت بلطف: وِردك الجديد ${toArabicIndic(nextDaily)} صفحة يومياً`);
  };

  const handleExtendDeadline = () => {
    const nextDays = Math.min(365, plan.targetDays + stats.extraDaysNeeded);
    const updated = savePersonalKhatmaPlan({
      ...plan,
      targetDays: nextDays,
    });
    setPlan(updated);
    flashFeedback(`تم تمديد المدة ${toArabicIndic(stats.extraDaysNeeded)} يوم ليظل الوِرد مريحاً`);
  };

  const handleResetPlan = () => {
    clearPersonalKhatmaPlan();
    setPlan(null);
    setConfirmReset(false);
  };

  const handleOpenReadingNow = () => {
    if (onNavigateToAyah) {
      onNavigateToAyah(resumeSurah.surahNumber, 1);
    } else if (onNavigateToJuz) {
      onNavigateToJuz(resumeSurah.juzNumber);
    }
  };

  const goalSummaryLabel =
    stats.goalMode === 'juz'
      ? `ختمة ${toArabicIndic(stats.targetJuzCount)} جزءاً خلال ${toArabicIndic(stats.targetDays)} يوماً`
      : stats.targetKhatmas === 1
      ? `ختمة كاملة خلال ${toArabicIndic(stats.targetDays)} يوماً`
      : `${toArabicIndic(stats.targetKhatmas)} ختمات خلال ${toArabicIndic(stats.targetDays)} يوماً`;

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#10161f] border border-[#D9B45A]/50 text-[#F6EFDD] text-xs font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-[#D9B45A] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Plan Summary Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#10161f] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-[#F6EFDD]">{goalSummaryLabel}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 tabular-nums">
            <span>
              {stats.goalMode === 'khatmas'
                ? `الختمة ${toArabicIndic(stats.currentKhatmaNumber)} من ${toArabicIndic(stats.targetKhatmas)}`
                : `الهدف: ${toArabicIndic(stats.totalJuz)} جزءاً`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              اليوم {toArabicIndic(stats.currentDayIndex)} من {toArabicIndic(stats.targetDays)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              أنجزت {toArabicIndic(stats.completedPages)} من {toArabicIndic(stats.totalPages)} صفحة ({toArabicIndic(stats.progressPercent)}٪)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenPlanner}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل الخطة</span>
          </button>

          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetPlan}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إنهاء الخطة</span>
            </button>
          )}
        </div>
      </div>

      {/* Completion Celebration */}
      {stats.isFinished && (
        <div className="p-5 rounded-2xl bg-[#10161f] border border-[#D9B45A]/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D9B45A]/20 border border-[#D9B45A]/50 flex items-center justify-center text-[#D9B45A] shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#F6EFDD]">
                تقبل الله ختمتك المباركة! أتممت خطتك بالكامل
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
                قرأت {toArabicIndic(stats.totalPages)} صفحة ({toArabicIndic(stats.totalJuz)} جزءاً). نسأل الله أن يجعل القرآن ربيع قلبك.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const updated = savePersonalKhatmaPlan({
                ...plan,
                completedPages: 0,
                startDate: formatLocalDateISO(),
                dailyPrayersDone: { date: formatLocalDateISO(), slots: [false, false, false, false, false] },
              });
              setPlan(updated);
              flashFeedback('تم بدء دورة جديدة للخطة بحمد الله');
            }}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#10161f] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            بدء دورة جديدة
          </button>
        </div>
      )}

      {/* Gentle Smart Catch-Up Banner (only when user is behind schedule & not finished) */}
      {!stats.isFinished && stats.lagPages > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-[#D9B45A]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#D9B45A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-[#F6EFDD]">
                إعادة توازن لطيفة — متبقي عن جدول اليوم {toArabicIndic(stats.lagPages)} صفحة
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                لا تجعل الفائت يشقّ عليك؛ يمكنك توزيعه بهدوء على الأيام المتبقية ({toArabicIndic(stats.gentleSpreadPagesPerDay)} صفحة/يوم) أو تمديد موعد الختم {toArabicIndic(stats.extraDaysNeeded)} يوم.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleSpreadGentleCatchUp}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              توزيع على الأيام المتبقية
            </button>
            <button
              type="button"
              onClick={handleExtendDeadline}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#D9B45A]" />
              <span>تمديد المدة +{toArabicIndic(stats.extraDaysNeeded)} يوم</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Balanced Tracker Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Ring Column */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#10161f] border border-slate-800 flex flex-col items-center justify-center space-y-4">
          <div className="text-center space-y-0.5">
            <h4 className="text-sm font-bold text-[#F6EFDD]">خاتم التقدم في المصحف</h4>
            <p className="text-xs text-slate-400 tabular-nums">
              {stats.goalMode === 'khatmas'
                ? `الختمة الحالية (${toArabicIndic(stats.currentKhatmaNumber)} / ${toArabicIndic(stats.targetKhatmas)}) · اضغط أي جزء للقراءة`
                : 'اضغط على أي قطاع لفتح الجزء في المصحف'}
            </p>
          </div>

          <KhatmaRing
            parts={ringParts}
            size={240}
            onSelectJuz={onNavigateToJuz}
          />
        </div>

        {/* Daily Wird & Interactive Controls Column */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#10161f] border border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-semibold text-[#D9B45A] block">وِرد اليوم الموصى به</span>
                <h4 className="text-base sm:text-lg font-bold text-[#F6EFDD] mt-0.5 tabular-nums">
                  من الصفحة {toArabicIndic(stats.todayRangeStartPage)} إلى {toArabicIndic(stats.todayRangeEndPage)}
                </h4>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">
                  {stats.todayStartJuz === stats.todayEndJuz
                    ? `ضمن الجزء ${toArabicIndic(stats.todayStartJuz)}`
                    : `يمتد من الجزء ${toArabicIndic(stats.todayStartJuz)} إلى الجزء ${toArabicIndic(stats.todayEndJuz)}`}
                  {' · '}
                  تبدأ الآن من سورة {resumeSurah.surahName}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-lg sm:text-xl font-bold text-[#F6EFDD] tabular-nums block">
                  {toArabicIndic(stats.pagesPerDay)} صفحة
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  ≈ {stats.juzPerDay.toLocaleString('ar-EG')} جزء / يوم
                </span>
              </div>
            </div>

            {/* 5-Prayer Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">تقسيم الوِرد على الصلوات الخمس:</span>
                <span className="text-slate-400 tabular-nums">
                  {toArabicIndic(stats.todayPrayers.filter(Boolean).length)} من ٥ مكتملة اليوم
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRAYER_LABELS.map((prayer, idx) => {
                  const done = stats.todayPrayers[idx];
                  const prayerPages = stats.prayerSplit[idx] || 0;
                  return (
                    <button
                      key={prayer}
                      type="button"
                      onClick={() => handleTogglePrayerSlot(idx)}
                      aria-pressed={done}
                      className={`min-h-[56px] p-2.5 rounded-xl border text-center transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        done
                          ? 'bg-[#1f3a6e]/70 border-[#D9B45A] text-[#F6EFDD]'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        {done && <Check className="w-3.5 h-3.5 text-[#D9B45A]" />}
                        <span>{prayer}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {toArabicIndic(prayerPages)} ص
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flexible Page Progress Steppers */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                تسجيل سريع للصفحات المقروءة:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustPages(1)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  +١ صفحة
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(5)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  +٥ صفحات
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(10)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  +١٠ صفحات
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(20)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-[#D9B45A] tabular-nums transition-colors cursor-pointer"
                >
                  +جزء (٢٠ ص)
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(-1)}
                  disabled={stats.completedPages === 0}
                  aria-label="إنقاص صفحة واحدة"
                  className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 disabled:opacity-40 border border-slate-800 text-xs text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                <span>التقدم الكلي</span>
                <span>{toArabicIndic(stats.progressPercent)}٪</span>
              </div>
              <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-[#D9B45A] transition-all duration-300"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenReadingNow}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#10161f] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>افتح المصحف لمتابعة وِردك</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
