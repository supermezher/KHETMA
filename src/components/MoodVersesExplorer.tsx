import React, { useState } from 'react';
import { MOOD_CATEGORIES, MoodVerseCategory } from '../data/moodVerses';
import { HeartHandshake, ShieldAlert, Activity, Sparkles, Sun, BookOpen } from 'lucide-react';

interface MoodVersesExplorerProps {
  onNavigateToAyah: (surahNumber: number, ayahNumber: number) => void;
}

export const MoodVersesExplorer: React.FC<MoodVersesExplorerProps> = ({
  onNavigateToAyah,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MoodVerseCategory>(MOOD_CATEGORIES[0]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'HeartHandshake':
        return <HeartHandshake className="w-5 h-5" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5" />;
      case 'Activity':
        return <Activity className="w-5 h-5" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      default:
        return <Sun className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-l from-[#EFE6D1] via-[#FBF7EE] to-white dark:from-[#142038] dark:via-[#10161f] dark:to-[#10161f] border border-[#D9B45A]/30 shadow-xl space-y-1.5">
        <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] text-xs font-bold">
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>القرآن حياتي · صيدلية القلوب</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
          آيات بحسب حالتك النفسية والشعورية
        </h2>
        <p className="text-xs sm:text-sm text-[#5C5549] dark:text-slate-300 max-w-2xl leading-relaxed">
          أينما كنت، وما كانت مشاعرك اليوم، ستجد في كتاب الله بلسماً يداوي جراحك، ويثبت فؤادك، وينير دربك.
        </p>
      </div>

      {/* Mood Filter Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {MOOD_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory.id === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[44px] flex items-center gap-2 py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#1F3A6E] text-[#F6EFDD] border-[#648CD4]/60 shadow-md'
                  : 'bg-white dark:bg-[#131c28] text-[#3F3A32] dark:text-slate-300 border-[#D9B45A]/25 dark:border-slate-800 hover:border-[#8A6418]/45 dark:hover:border-slate-700'
              }`}
            >
              {getIcon(cat.iconName)}
              <span>{cat.title}</span>
            </button>
          );
        })}
      </div>

      {/* Verses Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#5C5549] dark:text-slate-400 px-1 tabular-nums">
          <span>{selectedCategory.description}</span>
          <span>{selectedCategory.verses.length} آيات مختارة</span>
        </div>

        {selectedCategory.verses.map((v, idx) => (
          <div
            key={idx}
            className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131c28] border border-[#D9B45A]/25 dark:border-slate-800 shadow-lg space-y-4 transition-colors"
          >
            {/* Header with clean unboxed Surah metadata */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#D9B45A]/15 dark:border-slate-800">
              <div className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] tabular-nums">
                <span>سورة {v.surahName}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>الآية {v.ayahNumber}</span>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToAyah(v.surahNumber, v.ayahNumber)}
                className="min-h-[38px] py-1.5 px-3 rounded-xl bg-[#F6EFDD] dark:bg-slate-900 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 border border-[#D9B45A]/30 dark:border-slate-700 text-[#1B1A17] dark:text-[#F6EFDD] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                <span>فتح في المصحف</span>
              </button>
            </div>

            {/* Quran Ayah Text */}
            <div className="p-4 rounded-xl bg-[#FBF7EE] dark:bg-[#0b1018] border border-[#D9B45A]/20 dark:border-slate-800/80 text-center">
              <p className="font-quran text-2xl sm:text-3xl text-[#1B1A17] dark:text-[#F6EFDD] leading-loose">
                {v.arabicText}
              </p>
            </div>

            {/* Tafsir & Reflection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F6EFDD]/70 dark:bg-[#0b1018]/70 border border-[#D9B45A]/15 dark:border-slate-800">
                <strong className="text-[#5C5549] dark:text-slate-400 block mb-1">دلالة التفسير:</strong>
                <p className="text-[#1B1A17] dark:text-slate-200 leading-relaxed">{v.tafsirHint}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#1F3A6E]/5 dark:bg-[#1F3A6E]/25 border border-[#1F3A6E]/20 dark:border-[#648CD4]/30">
                <strong className="text-[#1F3A6E] dark:text-[#D9B45A] block mb-1">لمسة بلسم لقلبك:</strong>
                <p className="text-[#1B1A17] dark:text-[#F6EFDD] leading-relaxed">{v.reflection}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
