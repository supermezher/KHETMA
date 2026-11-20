import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { TAJWEED_RULES } from '../data/tajweedRules';

interface TajweedLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TajweedLegendModal: React.FC<TajweedLegendModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tajweed-legend-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/30 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#E3D9C3] dark:border-slate-800">
          <div className="flex items-center gap-2.5 text-[#8A6418] dark:text-[#D9B45A] font-bold">
            <Sparkles className="w-5 h-5" />
            <h3 id="tajweed-legend-title" className="text-base sm:text-lg text-[#1B1A17] dark:text-[#F6EFDD]">دليل ألوان التجويد القياسي</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الدليل"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#5E584E] dark:text-slate-300 leading-relaxed">
          نظام التلوين المعتمد في مصحف «بيان» يطابق المصاحف الشريفة الملونة لتعليم الترتيل وتطبيق الأحكام دون عناء — اللون الأخضر مخصص لأحكام الغنة والإدغام والإخفاء فقط:
        </p>

        <div className="space-y-2.5">
          {TAJWEED_RULES.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-xl bg-[#F6EFDD] dark:bg-slate-950/70 border border-[#E3D9C3] dark:border-slate-800 flex items-start gap-3"
            >
              <span
                className="w-4 h-4 rounded-full mt-1 shrink-0 shadow-sm ring-1 ring-black/15 dark:ring-white/15"
                style={{ backgroundColor: rule.colorHex }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-xs sm:text-sm">{rule.name}</span>
                  <span className="text-[11px] text-[#8A6418] dark:text-[#D9B45A] font-mono">{rule.mizan}</span>
                </div>
                <p className="text-xs text-[#5E584E] dark:text-slate-300 mt-0.5">{rule.definition}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#10161f] text-sm text-[#F6EFDD] font-quran border border-[#8A6418]/25 dark:border-slate-800">
                  <span className="text-[11px] font-sans text-slate-400">مثال:</span>
                  <span style={{ color: rule.colorHex }}>{rule.exampleQuran}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#2E5499] dark:border-[#648CD4]/40 text-[#FBF7EE] dark:text-[#F6EFDD] font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            فهمت، العودة للمصحف
          </button>
        </div>
      </div>
    </div>
  );
};
