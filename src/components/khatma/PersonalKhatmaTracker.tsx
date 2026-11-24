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
import { KhatmaRing } from './KhatmaRing';
import {
  buildPersonalRingParts,
  clearPersonalKhatmaPlan,
  computePersonalKhatmaStats,
  formatLocalDateISO,
  getPrayerDisplayLabel,
  getSurahAtMushafPage,
  KhatmaPlan,
  loadPersonalKhatmaPlan,
  PERSONAL_KHATMA_EVENT,
  PRAYER_LABELS,
  savePersonalKhatmaPlan,
} from '../../utils/personalKhatma';
import { SURAHS_LIST, getSurahDisplayName } from '../../data/quranMetadata';
import { formatLocalizedDigits, useLanguage } from '../../utils/i18n';

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
  const { lang, isEnglish, t } = useLanguage();
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
      <section className="p-6 sm:p-10 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-[#2e5499]/40 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1F3A6E]/10 dark:bg-[#1f3a6e]/50 border border-[#8A6418]/35 dark:border-[#D9B45A]/40 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A]">
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="max-w-xl mx-auto space-y-2.5">
          <h3 className="text-lg sm:text-xl font-bold text-[#1B1A17] dark:text-[#F6EFDD]" style={{ textWrap: 'balance' }}>
            {t('خطط لختمتك الفردية ووزّع وِردك بدقة', 'Plan Your Personal Khatma & Daily Wird')}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C5549] dark:text-slate-300 leading-relaxed">
            {t(
              'حدد عدد الختمات أو الأجزاء والمدة التي تناسبك (مثلاً ٣ ختمات في رمضان خلال ٣٠ أو ٢٩ يوماً)، وسيحسب التطبيق وِردك اليومي وتوزيعه بعد كل صلاة مع متابعة مرئية للتقدم.',
              'Choose your target Khatmas or Juz and preferred timeframe (such as 3 Khatmas in Ramadan over 29 or 30 days), and Bayan will distribute your daily pages across the five prayers with visual progress tracking.'
            )}
          </p>
        </div>

        <div className={`max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 ${isEnglish ? 'text-left' : 'text-right'}`}>
          <div className="p-3.5 rounded-xl bg-[#EFE6D1] dark:bg-slate-950/70 border border-[#8A6418]/20 dark:border-slate-800/90">
            <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] block">
              {t('ختمة في شهر', '1 Khatma in 1 Month')}
            </span>
            <span className="text-[11px] text-[#5C5549] dark:text-slate-400 block mt-1 tabular-nums">
              {t('جزء يومياً · ٢٠ صفحة · ٤ صفحات/صلاة', '1 Juz/day · 20 pages · 4 pages/prayer')}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#EFE6D1] dark:bg-slate-950/70 border border-[#8A6418]/20 dark:border-slate-800/90">
            <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] block">
              {t('ختمتان في شهر', '2 Khatmas in 1 Month')}
            </span>
            <span className="text-[11px] text-[#5C5549] dark:text-slate-400 block mt-1 tabular-nums">
              {t('جزآن يومياً · ٤١ صفحة · ~٨ صفحات/صلاة', '2 Juz/day · 41 pages · ~8 pages/prayer')}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#EFE6D1] dark:bg-slate-950/70 border border-[#8A6418]/20 dark:border-slate-800/90">
            <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] block">
              {t('٣ ختمات في رمضان', '3 Khatmas in Ramadan')}
            </span>
            <span className="text-[11px] text-[#5C5549] dark:text-slate-400 block mt-1 tabular-nums">
              {t('٣ أجزاء يومياً · ٦١ صفحة · ~١٢ صفحة/صلاة', '3 Juz/day · 61 pages · ~12 pages/prayer')}
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={onOpenPlanner}
            className="min-h-[46px] px-7 py-3 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#1B1A17] text-sm font-bold shadow-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إعداد خطة ختمتي الفردية', 'Setup Personal Khatma Plan')}</span>
          </button>
        </div>
      </section>
    );
  }

  const stats = computePersonalKhatmaStats(plan);
  const ringParts = buildPersonalRingParts(stats);
  const resumeSurah = getSurahAtMushafPage(stats.currentPageInCycle);
  const resumeSurahMeta = SURAHS_LIST.find((s) => s.number === resumeSurah.surahNumber);
  const resumeSurahDisplay = resumeSurahMeta
    ? getSurahDisplayName(resumeSurahMeta, lang)
    : resumeSurah.surahName;

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
    flashFeedback(
      t(
        `تم توزيع الفائت بلطف: وِردك الجديد ${formatLocalizedDigits(nextDaily, lang)} صفحة يومياً`,
        `Rescheduled gently: your new daily Wird is ${nextDaily} pages/day`
      )
    );
  };

  const handleExtendDeadline = () => {
    const nextDays = Math.min(365, plan.targetDays + stats.extraDaysNeeded);
    const updated = savePersonalKhatmaPlan({
      ...plan,
      targetDays: nextDays,
    });
    setPlan(updated);
    flashFeedback(
      t(
        `تم تمديد المدة ${formatLocalizedDigits(stats.extraDaysNeeded, lang)} يوم ليظل الوِرد مريحاً`,
        `Extended plan by ${stats.extraDaysNeeded} days to keep your Wird comfortable`
      )
    );
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
      ? t(
          `ختمة ${formatLocalizedDigits(stats.targetJuzCount, lang)} جزءاً خلال ${formatLocalizedDigits(stats.targetDays, lang)} يوماً`,
          `${stats.targetJuzCount} Juz Goal in ${stats.targetDays} Days`
        )
      : stats.targetKhatmas === 1
      ? t(
          `ختمة كاملة خلال ${formatLocalizedDigits(stats.targetDays, lang)} يوماً`,
          `1 Full Khatma in ${stats.targetDays} Days`
        )
      : t(
          `${formatLocalizedDigits(stats.targetKhatmas, lang)} ختمات خلال ${formatLocalizedDigits(stats.targetDays, lang)} يوماً`,
          `${stats.targetKhatmas} Khatmas in ${stats.targetDays} Days`
        );

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/40 dark:border-[#D9B45A]/50 text-[#1B1A17] dark:text-[#F6EFDD] text-xs font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Plan Summary Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-[#F6EFDD]">{goalSummaryLabel}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5549] dark:text-slate-300 tabular-nums">
            <span>
              {stats.goalMode === 'khatmas'
                ? t(
                    `الختمة ${formatLocalizedDigits(stats.currentKhatmaNumber, lang)} من ${formatLocalizedDigits(stats.targetKhatmas, lang)}`,
                    `Khatma ${stats.currentKhatmaNumber} of ${stats.targetKhatmas}`
                  )
                : t(
                    `الهدف: ${formatLocalizedDigits(stats.totalJuz, lang)} جزءاً`,
                    `Goal: ${stats.totalJuz} Juz`
                  )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t(
                `اليوم ${formatLocalizedDigits(stats.currentDayIndex, lang)} من ${formatLocalizedDigits(stats.targetDays, lang)}`,
                `Day ${stats.currentDayIndex} of ${stats.targetDays}`
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t(
                `أنجزت ${formatLocalizedDigits(stats.completedPages, lang)} من ${formatLocalizedDigits(stats.totalPages, lang)} صفحة (${formatLocalizedDigits(stats.progressPercent, lang)}٪)`,
                `${stats.completedPages} / ${stats.totalPages} pages read (${stats.progressPercent}%)`
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenPlanner}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t('تعديل الخطة', 'Edit Plan')}</span>
          </button>

          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetPlan}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {t('تأكيد الإلغاء', 'Confirm Reset')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1B1A17] dark:text-slate-200 text-xs transition-colors cursor-pointer"
              >
                {t('تراجع', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#8A6418]/25 dark:border-slate-700 text-[#5C5549] dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('إنهاء الخطة', 'Reset Plan')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Completion Celebration */}
      {stats.isFinished && (
        <div className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/50 dark:border-[#D9B45A]/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D9B45A]/20 border border-[#8A6418]/40 dark:border-[#D9B45A]/50 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A] shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                {t('تقبل الله ختمتك المباركة! أتممت خطتك بالكامل', 'May Allah accept your blessed Khatma! Plan Completed')}
              </h4>
              <p className="text-xs text-[#5C5549] dark:text-slate-300 mt-0.5 tabular-nums">
                {t(
                  `قرأت ${formatLocalizedDigits(stats.totalPages, lang)} صفحة (${formatLocalizedDigits(stats.totalJuz, lang)} جزءاً). نسأل الله أن يجعل القرآن ربيع قلبك.`,
                  `You read ${stats.totalPages} pages (${stats.totalJuz} Juz). May Allah make the Qur'an the spring of your heart.`
                )}
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
              flashFeedback(t('تم بدء دورة جديدة للخطة بحمد الله', 'Started a new Khatma cycle, Alhamdulillah'));
            }}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#1B1A17] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('بدء دورة جديدة', 'Start New Cycle')}
          </button>
        </div>
      )}

      {/* Gentle Smart Catch-Up Banner (only when user is behind schedule & not finished) */}
      {!stats.isFinished && stats.lagPages > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#EFE6D1] dark:bg-slate-950/90 border border-[#8A6418]/35 dark:border-[#D9B45A]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
                {t(
                  `إعادة توازن لطيفة — متبقي عن جدول اليوم ${formatLocalizedDigits(stats.lagPages, lang)} صفحة`,
                  `Gentle Rebalance — ${stats.lagPages} pages behind today's pace`
                )}
              </p>
              <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
                {t(
                  `لا تجعل الفائت يشقّ عليك؛ يمكنك توزيعه بهدوء على الأيام المتبقية (${formatLocalizedDigits(stats.gentleSpreadPagesPerDay, lang)} صفحة/يوم) أو تمديد موعد الختم ${formatLocalizedDigits(stats.extraDaysNeeded, lang)} يوم.`,
                  `No stress — spread the remaining pages across upcoming days (${stats.gentleSpreadPagesPerDay} pages/day) or extend your completion date by ${stats.extraDaysNeeded} days.`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleSpreadGentleCatchUp}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('توزيع على الأيام المتبقية', 'Spread Across Remaining Days')}
            </button>
            <button
              type="button"
              onClick={handleExtendDeadline}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FBF7EE] hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#8A6418]/25 dark:border-slate-700 text-[#1B1A17] dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>
                {t(
                  `تمديد المدة +${formatLocalizedDigits(stats.extraDaysNeeded, lang)} يوم`,
                  `Extend +${stats.extraDaysNeeded} Days`
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Balanced Tracker Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Ring Column */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800 flex flex-col items-center justify-center space-y-4">
          <div className="text-center space-y-0.5">
            <h4 className="text-sm font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
              {t('خاتم التقدم في المصحف', "Mus'haf Progress Ring")}
            </h4>
            <p className="text-xs text-[#5C5549] dark:text-slate-400 tabular-nums">
              {stats.goalMode === 'khatmas'
                ? t(
                    `الختمة الحالية (${formatLocalizedDigits(stats.currentKhatmaNumber, lang)} / ${formatLocalizedDigits(stats.targetKhatmas, lang)}) · اضغط أي جزء للقراءة`,
                    `Current Khatma (${stats.currentKhatmaNumber} / ${stats.targetKhatmas}) · Tap any Juz to read`
                  )
                : t('اضغط على أي قطاع لفتح الجزء في المصحف', 'Tap any sector to open that Juz')}
            </p>
          </div>

          <KhatmaRing
            parts={ringParts}
            size={240}
            onSelectJuz={onNavigateToJuz}
          />
        </div>

        {/* Daily Wird & Interactive Controls Column */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#8A6418]/15 dark:border-slate-800/80">
              <div>
                <span className="text-xs font-semibold text-[#8A6418] dark:text-[#D9B45A] block">
                  {t('وِرد اليوم الموصى به', "Today's Recommended Wird")}
                </span>
                <h4 className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-[#F6EFDD] mt-0.5 tabular-nums">
                  {t(
                    `من الصفحة ${formatLocalizedDigits(stats.todayRangeStartPage, lang)} إلى ${formatLocalizedDigits(stats.todayRangeEndPage, lang)}`,
                    `Pages ${stats.todayRangeStartPage} to ${stats.todayRangeEndPage}`
                  )}
                </h4>
                <p className="text-xs text-[#5C5549] dark:text-slate-400 mt-1 tabular-nums">
                  {stats.todayStartJuz === stats.todayEndJuz
                    ? t(`ضمن الجزء ${formatLocalizedDigits(stats.todayStartJuz, lang)}`, `Within Juz ${stats.todayStartJuz}`)
                    : t(
                        `يمتد من الجزء ${formatLocalizedDigits(stats.todayStartJuz, lang)} إلى الجزء ${formatLocalizedDigits(stats.todayEndJuz, lang)}`,
                        `Spans Juz ${stats.todayStartJuz} to Juz ${stats.todayEndJuz}`
                      )}
                  {' · '}
                  {t(`تبدأ الآن من سورة ${resumeSurahDisplay}`, `Resume at Surah ${resumeSurahDisplay}`)}
                </p>
              </div>

              <div className={isEnglish ? 'text-right sm:text-left' : 'text-left sm:text-right'}>
                <span className="text-lg sm:text-xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums block">
                  {formatLocalizedDigits(stats.pagesPerDay, lang)} {t('صفحة', 'pages')}
                </span>
                <span className="text-[11px] text-[#5C5549] dark:text-slate-400 tabular-nums">
                  ≈ {stats.juzPerDay.toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG')} {t('جزء / يوم', 'Juz / day')}
                </span>
              </div>
            </div>

            {/* 5-Prayer Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1B1A17] dark:text-slate-300">
                  {t('تقسيم الوِرد على الصلوات الخمس:', 'Split Across Five Daily Prayers:')}
                </span>
                <span className="text-[#5C5549] dark:text-slate-400 tabular-nums">
                  {t(
                    `${formatLocalizedDigits(stats.todayPrayers.filter(Boolean).length, lang)} من ٥ مكتملة اليوم`,
                    `${stats.todayPrayers.filter(Boolean).length} / 5 completed today`
                  )}
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
                          ? 'bg-[#1F3A6E] dark:bg-[#1f3a6e]/70 border-[#D9B45A] text-[#F6EFDD]'
                          : 'bg-[#EFE6D1] dark:bg-slate-950/80 border-[#8A6418]/20 dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/45 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        {done && <Check className="w-3.5 h-3.5 text-[#D9B45A]" />}
                        <span>{getPrayerDisplayLabel(idx, lang)}</span>
                      </span>
                      <span className={`text-[11px] tabular-nums ${done ? 'text-[#E9E3D3]' : 'text-[#5C5549] dark:text-slate-400'}`}>
                        {formatLocalizedDigits(prayerPages, lang)} {t('ص', 'p.')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flexible Page Progress Steppers */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1B1A17] dark:text-slate-300 block">
                {t('تسجيل سريع للصفحات المقروءة:', 'Quick Page Progress Log:')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustPages(1)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-950 dark:hover:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-800 text-xs font-semibold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  {t('+١ صفحة', '+1 Page')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(5)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-950 dark:hover:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-800 text-xs font-semibold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  {t('+٥ صفحات', '+5 Pages')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(10)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-950 dark:hover:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-800 text-xs font-semibold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums transition-colors cursor-pointer"
                >
                  {t('+١٠ صفحات', '+10 Pages')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(20)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-950 dark:hover:bg-slate-900 border border-[#8A6418]/25 dark:border-slate-800 text-xs font-semibold text-[#8A6418] dark:text-[#D9B45A] tabular-nums transition-colors cursor-pointer"
                >
                  {t('+جزء (٢٠ ص)', '+1 Juz (20p)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPages(-1)}
                  disabled={stats.completedPages === 0}
                  aria-label={t('إنقاص صفحة واحدة', 'Decrease by 1 page')}
                  className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-950 dark:hover:bg-slate-900 disabled:opacity-40 border border-[#8A6418]/25 dark:border-slate-800 text-xs text-[#5C5549] dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="pt-3 border-t border-[#8A6418]/15 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#5C5549] dark:text-slate-400 tabular-nums">
                <span>{t('التقدم الكلي', 'Overall Progress')}</span>
                <span>{formatLocalizedDigits(stats.progressPercent, lang)}{isEnglish ? '%' : '٪'}</span>
              </div>
              <div className="h-2 rounded-full bg-[#E5DBBF] dark:bg-slate-950 overflow-hidden border border-[#8A6418]/20 dark:border-slate-800">
                <div
                  className="h-full bg-[#D9B45A] transition-all duration-300"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenReadingNow}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D9B45A] hover:bg-[#e5c470] text-[#1B1A17] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('افتح المصحف لمتابعة وِردك', "Open Mus'haf to Continue Wird")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
