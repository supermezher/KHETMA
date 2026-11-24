import React, { useEffect, useState } from 'react';
import { X, Sparkles, Check, BookOpen, Clock, AlertCircle } from 'lucide-react';
import {
  calculateKhatmaPlanMetrics,
  formatLocalDateISO,
  KhatmaGoalMode,
  KhatmaPlan,
} from '../utils/personalKhatma';
import { formatLocalizedDigits, useLanguage } from '../utils/i18n';

export type { KhatmaPlan };

interface KhatmaPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (plan: KhatmaPlan) => void;
  initialPlan?: KhatmaPlan | null;
}

const QUICK_TEMPLATES: Array<{
  id: string;
  label: string;
  labelEn: string;
  sub: string;
  subEn: string;
  goalMode: KhatmaGoalMode;
  targetKhatmas: number;
  targetDays: number;
  mins: number;
}> = [
  {
    id: 'one-month',
    label: 'ختمة في شهر',
    labelEn: '1 Khatma in 1 Month',
    sub: 'جزء يومياً · ٣٠ يوماً',
    subEn: '1 Juz/day · 30 days',
    goalMode: 'khatmas',
    targetKhatmas: 1,
    targetDays: 30,
    mins: 30,
  },
  {
    id: 'two-month',
    label: 'ختمتان في شهر',
    labelEn: '2 Khatmas in 1 Month',
    sub: 'جزآن يومياً · ٣٠ يوماً',
    subEn: '2 Juz/day · 30 days',
    goalMode: 'khatmas',
    targetKhatmas: 2,
    targetDays: 30,
    mins: 60,
  },
  {
    id: 'ramadan-3',
    label: '٣ ختمات في رمضان',
    labelEn: '3 Khatmas in Ramadan',
    sub: '٣ أجزاء يومياً · ٣٠ يوماً',
    subEn: '3 Juz/day · 30 days',
    goalMode: 'khatmas',
    targetKhatmas: 3,
    targetDays: 30,
    mins: 90,
  },
  {
    id: 'ramadan-3-29',
    label: '٣ ختمات (احتياط ٢٩ يوماً)',
    labelEn: '3 Khatmas (29-Day Buffer)',
    sub: '٦٣ صفحة/يوم · ٢٩ يوماً',
    subEn: '63 pages/day · 29 days',
    goalMode: 'khatmas',
    targetKhatmas: 3,
    targetDays: 29,
    mins: 90,
  },
];

export const KhatmaPlannerModal: React.FC<KhatmaPlannerModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
  initialPlan,
}) => {
  const { lang, isEnglish, t } = useLanguage();
  const [goalMode, setGoalMode] = useState<KhatmaGoalMode>(initialPlan?.goalMode || 'khatmas');
  const [targetKhatmas, setTargetKhatmas] = useState<number>(initialPlan?.targetKhatmas || 1);
  const [targetJuzCount, setTargetJuzCount] = useState<number>(initialPlan?.targetJuzCount || 10);
  const [selectedDays, setSelectedDays] = useState<number>(initialPlan?.targetDays || 30);
  const [availableTime, setAvailableTime] = useState<number>(initialPlan?.availableMinutesPerDay || 30);

  // Sync state whenever modal opens with an existing plan
  useEffect(() => {
    if (!isOpen) return;
    setGoalMode(initialPlan?.goalMode || 'khatmas');
    setTargetKhatmas(initialPlan?.targetKhatmas || 1);
    setTargetJuzCount(initialPlan?.targetJuzCount || 10);
    setSelectedDays(initialPlan?.targetDays || 30);
    setAvailableTime(initialPlan?.availableMinutesPerDay || 30);
  }, [isOpen, initialPlan]);

  // Keyboard accessibility: close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const preview = calculateKhatmaPlanMetrics({
    goalMode,
    targetKhatmas,
    targetJuzCount,
    targetDays: selectedDays,
  });

  const isTimeAdequate = availableTime >= preview.estimatedMinutesNeeded;

  const handleApplyTemplate = (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    setGoalMode(tpl.goalMode);
    setTargetKhatmas(tpl.targetKhatmas);
    setSelectedDays(tpl.targetDays);
    setAvailableTime(tpl.mins);
  };

  const handleSave = () => {
    const todayIso = formatLocalDateISO();
    const preservedCompleted =
      initialPlan && typeof initialPlan.completedPages === 'number'
        ? Math.min(preview.totalPages, Math.max(0, initialPlan.completedPages))
        : 0;

    onApplyPlan({
      targetDays: preview.targetDays,
      availableMinutesPerDay: availableTime,
      pagesPerDay: preview.pagesPerDay,
      pagesPerPrayer: preview.pagesPerPrayer,
      createdAt: initialPlan?.createdAt || new Date().toISOString(),
      goalMode: preview.goalMode,
      targetKhatmas: preview.targetKhatmas,
      targetJuzCount: preview.targetJuzCount,
      startDate: initialPlan?.startDate || todayIso,
      completedPages: preservedCompleted,
      dailyPrayersDone: initialPlan?.dailyPrayersDone,
      lastUpdatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="khatma-planner-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/35 dark:border-[#2e5499]/50 rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E3D9C3] dark:border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
            <h3 id="khatma-planner-title" className="text-base sm:text-lg font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
              {t('مخطط الورد والختمة الفردية الذكية', 'Smart Personal Khatma & Wird Planner')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق مخطط الورد', 'Close Wird planner')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ready Templates */}
        <div>
          <span className="text-xs font-bold text-[#5E584E] dark:text-slate-300 block mb-2">
            {t('قوالب جاهزة بضغطة واحدة (مثل ختمات رمضان):', 'One-Tap Presets (such as Ramadan Khatmas):')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TEMPLATES.map((tpl) => {
              const isSelected =
                goalMode === tpl.goalMode &&
                targetKhatmas === tpl.targetKhatmas &&
                selectedDays === tpl.targetDays;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className={`min-h-[48px] p-2.5 rounded-xl border ${isEnglish ? 'text-left' : 'text-right'} transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1F3A6E] border-[#8A6418] dark:bg-[#1f3a6e]/60 dark:border-[#D9B45A]/70 text-[#FBF7EE] dark:text-[#F6EFDD]'
                      : 'bg-[#F6EFDD] dark:bg-slate-950/80 border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/50 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold block">{isEnglish ? tpl.labelEn : tpl.label}</span>
                  <span className={`text-[11px] block mt-0.5 tabular-nums ${isSelected ? 'text-[#F6EFDD]/85 dark:text-slate-300' : 'text-[#5E584E] dark:text-slate-400'}`}>
                    {isEnglish ? tpl.subEn : tpl.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 1: Goal Mode & Target Amount */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#5E584E] dark:text-slate-300">
              {t('١. حدد هدفك من القراءة:', '1. Set your reading goal:')}
            </label>
            <div className="inline-flex items-center p-1 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#D4C7AE] dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGoalMode('khatmas')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  goalMode === 'khatmas'
                    ? 'bg-[#1f3a6e] text-white'
                    : 'text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                }`}
              >
                {t('عدد ختمات كاملة', 'Full Khatmas')}
              </button>
              <button
                type="button"
                onClick={() => setGoalMode('juz')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  goalMode === 'juz'
                    ? 'bg-[#1f3a6e] text-white'
                    : 'text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                }`}
              >
                {t('عدد أجزاء محدد', 'Specific Juz Count')}
              </button>
            </div>
          </div>

          {goalMode === 'khatmas' ? (
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTargetKhatmas(count)}
                  className={`min-h-[40px] flex-1 min-w-[78px] px-3 py-2 text-xs rounded-xl font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                    targetKhatmas === count
                      ? 'bg-[#1f3a6e] border-[#8A6418] dark:border-[#D9B45A] text-white'
                      : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/50'
                  }`}
                >
                  {isEnglish
                    ? `${count} ${count === 1 ? 'Khatma' : 'Khatmas'}`
                    : count === 1
                    ? 'ختمة ١'
                    : count === 2
                    ? 'ختمتان'
                    : `${formatLocalizedDigits(count, lang)} ختمات`}
                </button>
              ))}
              <div className="flex items-center gap-1.5 bg-[#F6EFDD] dark:bg-slate-950 border border-[#D4C7AE] dark:border-slate-800 rounded-xl px-2.5 min-h-[40px]">
                <label htmlFor="custom-khatmas-input" className="text-[11px] text-[#5E584E] dark:text-slate-400 whitespace-nowrap">
                  {t('مخصص:', 'Custom:')}
                </label>
                <input
                  id="custom-khatmas-input"
                  type="number"
                  min={1}
                  max={12}
                  value={targetKhatmas}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setTargetKhatmas(Math.min(12, Math.max(1, Math.round(v))));
                  }}
                  className="w-12 bg-transparent text-center text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] outline-none tabular-nums"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 20].map((juz) => (
                <button
                  key={juz}
                  type="button"
                  onClick={() => setTargetJuzCount(juz)}
                  className={`min-h-[40px] flex-1 min-w-[72px] px-3 py-2 text-xs rounded-xl font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                    targetJuzCount === juz
                      ? 'bg-[#1f3a6e] border-[#8A6418] dark:border-[#D9B45A] text-white'
                      : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/50'
                  }`}
                >
                  {formatLocalizedDigits(juz, lang)} {t('أجزاء', 'Juz')}
                </button>
              ))}
              <div className="flex items-center gap-1.5 bg-[#F6EFDD] dark:bg-slate-950 border border-[#D4C7AE] dark:border-slate-800 rounded-xl px-2.5 min-h-[40px]">
                <label htmlFor="custom-juz-input" className="text-[11px] text-[#5E584E] dark:text-slate-400 whitespace-nowrap">
                  {t('أجزاء:', 'Juz:')}
                </label>
                <input
                  id="custom-juz-input"
                  type="number"
                  min={1}
                  max={30}
                  value={targetJuzCount}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setTargetJuzCount(Math.min(30, Math.max(1, Math.round(v))));
                  }}
                  className="w-12 bg-transparent text-center text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] outline-none tabular-nums"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Target Duration */}
        <div>
          <label className="text-xs font-bold text-[#5E584E] dark:text-slate-300 block mb-2">
            {t('٢. المدة الزمنية بالأيام (مثلاً ٢٩ أو ٣٠ يوماً لرمضان):', '2. Duration in days (e.g., 29 or 30 days for Ramadan):')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { days: 10, label: '١٠ أيام', labelEn: '10 Days' },
              { days: 29, label: '٢٩ يوماً', labelEn: '29 Days' },
              { days: 30, label: 'شهر (٣٠)', labelEn: '1 Month (30)' },
              { days: 60, label: 'شهران (٦٠)', labelEn: '2 Months (60)' },
              { days: 90, label: '٣ أشهر (٩٠)', labelEn: '3 Months (90)' },
            ].map((d) => (
              <button
                key={d.days}
                type="button"
                onClick={() => setSelectedDays(d.days)}
                className={`min-h-[40px] py-2 px-3 text-xs rounded-xl font-bold border transition-colors text-center cursor-pointer whitespace-nowrap ${
                  selectedDays === d.days
                    ? 'bg-[#1f3a6e] border-[#8A6418] dark:border-[#D9B45A] text-white'
                    : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/50'
                }`}
              >
                {isEnglish ? d.labelEn : d.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 bg-[#F6EFDD] dark:bg-slate-950 border border-[#D4C7AE] dark:border-slate-800 rounded-xl px-2.5 min-h-[40px]">
              <label htmlFor="custom-days-input" className="text-[11px] text-[#5E584E] dark:text-slate-400 whitespace-nowrap">
                {t('يوم:', 'Days:')}
              </label>
              <input
                id="custom-days-input"
                type="number"
                min={1}
                max={365}
                value={selectedDays}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setSelectedDays(Math.min(365, Math.max(1, Math.round(v))));
                }}
                className="w-14 bg-transparent text-center text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Available Daily Time */}
        <div>
          <label className="text-xs font-bold text-[#5E584E] dark:text-slate-300 block mb-2">
            {t('٣. الوقت المتاح يومياً للقراءة والتدبر:', '3. Daily time available for reading & reflection:')}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[15, 20, 30, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setAvailableTime(mins)}
                className={`min-h-[40px] py-2 px-2 text-xs rounded-xl font-bold border transition-colors text-center cursor-pointer whitespace-nowrap ${
                  availableTime === mins
                    ? 'bg-[#2e5499] border-[#1F3A6E] dark:border-[#648cd4] text-white'
                    : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:border-[#8A6418]/50'
                }`}
              >
                {formatLocalizedDigits(mins, lang)} {t('د', 'm')}
              </button>
            ))}
          </div>
        </div>

        {/* Live Calculated Preview Card */}
        <div className="p-4 rounded-xl bg-[#F6EFDD] dark:bg-slate-950/90 border border-[#8A6418]/35 dark:border-[#D9B45A]/35 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-bold flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>{t('ملخص وِردك اليومي المحسوب', 'Calculated Daily Wird Summary')}</span>
            </span>
            <span className="text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums">
              {t(
                `${formatLocalizedDigits(preview.pagesPerDay, lang)} صفحة يومياً · ${preview.juzPerDay.toLocaleString('ar-EG')} جزء/يوم`,
                `${preview.pagesPerDay} pages/day · ${preview.juzPerDay.toLocaleString('en-US')} Juz/day`
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-lg bg-[#FBF7EE] dark:bg-[#10161f] border border-[#E3D9C3] dark:border-slate-800 text-center">
              <span className="text-[11px] text-[#5E584E] dark:text-slate-400 block mb-0.5">{t('الإجمالي المطلوب', 'Total Target')}</span>
              <strong className="text-sm sm:text-base text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums">
                {formatLocalizedDigits(preview.totalJuz, lang)} {t('جزءاً', 'Juz')}
              </strong>
              <span className="text-[10px] text-[#5E584E] dark:text-slate-400 block tabular-nums">
                ({formatLocalizedDigits(preview.totalPages, lang)} {t('صفحة', 'pages')})
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#FBF7EE] dark:bg-[#10161f] border border-[#E3D9C3] dark:border-slate-800 text-center">
              <span className="text-[11px] text-[#5E584E] dark:text-slate-400 block mb-0.5">{t('بعد كل فريضة', 'Per Prayer')}</span>
              <strong className="text-sm sm:text-base text-[#8A6418] dark:text-[#D9B45A] tabular-nums">
                ~{formatLocalizedDigits(preview.pagesPerPrayer, lang)} {t('صفحة', 'pages')}
              </strong>
              <span className="text-[10px] text-[#5E584E] dark:text-slate-400 block">{t('(٥ صلوات يومياً)', '(5 daily prayers)')}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#FBF7EE] dark:bg-[#10161f] border border-[#E3D9C3] dark:border-slate-800 text-center">
              <span className="text-[11px] text-[#5E584E] dark:text-slate-400 block mb-0.5">{t('الوقت التقديري', 'Est. Time')}</span>
              <strong className="text-sm sm:text-base text-[#1B1A17] dark:text-[#F6EFDD] tabular-nums flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648cd4]" />
                <span>~{formatLocalizedDigits(preview.estimatedMinutesNeeded, lang)} {t('د', 'min')}</span>
              </strong>
              <span className="text-[10px] text-[#5E584E] dark:text-slate-400 block">
                {isTimeAdequate ? (
                  <span className="text-[#8A6418] dark:text-[#D9B45A]">{t('مناسب لوقتك ✓', 'Fits your time ✓')}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3 h-3" />
                    {t('يحتاج وقتاً أكثر', 'Needs more time')}
                  </span>
                )}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#5E584E] dark:text-slate-400 leading-relaxed text-center pt-1">
            {t(
              'قال النبي ﷺ: «قاربوا وسددوا، واعلموا أنه لن ينجو أحد منكم بعمله، وأن أحب الأعمال إلى الله أدومها وإن قل».',
              'The Prophet ﷺ said: “Be moderate and steadfast; know that the most beloved deeds to Allah are those done consistently, even if small.”'
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="pt-1 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] py-2 px-4 rounded-xl text-xs font-medium text-[#5E584E] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            {t('إلغاء', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[42px] py-2.5 px-6 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] dark:bg-[#D9B45A] dark:hover:bg-[#e4c370] text-[#FBF7EE] dark:text-[#10161f] text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>
              {initialPlan
                ? t('حفظ وتحديث خطة الختمة', 'Update Khatma Plan')
                : t('اعتماد خطة الختمة الفردية', 'Activate Personal Khatma')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
