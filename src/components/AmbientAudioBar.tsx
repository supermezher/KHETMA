import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Wind, Moon, VolumeX, Volume2, Sparkles } from 'lucide-react';
import { ambientAudio } from '../utils/ambientAudio';
import { useLanguage } from '../utils/i18n';

export const AmbientAudioBar: React.FC = () => {
  const { t } = useLanguage();
  const [activeSound, setActiveSound] = useState<'rain' | 'breeze' | 'night' | 'none'>(
    () => ambientAudio.getCurrentMode() || 'none'
  );
  const [volume, setVolume] = useState<number>(() => Math.round(ambientAudio.getVolume() * 100));
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleSound = (mode: 'rain' | 'breeze' | 'night') => {
    if (activeSound === mode) {
      ambientAudio.stop();
      setActiveSound('none');
    } else {
      ambientAudio.play(mode);
      setActiveSound(mode);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    ambientAudio.setVolume(val / 100);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[38px] flex items-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A] ${
          activeSound !== 'none'
            ? 'bg-[#1F3A6E] border-[#648CD4]/60 text-[#D9B45A]'
            : 'bg-white dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 hover:text-[#8A6418] dark:hover:text-white hover:border-[#8A6418]/40 dark:hover:border-slate-700'
        }`}
        title={t('أجواء التدبر والتركيز (أصوات طبيعية هادئة)', 'Ambient focus atmosphere (calm natural sounds)')}
        aria-label={t('أجواء التدبر والتركيز', 'Ambient focus sounds')}
      >
        {activeSound === 'rain' && <CloudRain className="w-3.5 h-3.5" />}
        {activeSound === 'breeze' && <Wind className="w-3.5 h-3.5" />}
        {activeSound === 'night' && <Moon className="w-3.5 h-3.5" />}
        {activeSound === 'none' && <Volume2 className="w-3.5 h-3.5 text-[#8A6418] dark:text-slate-400" />}
        <span className="hidden xl:inline">
          {activeSound !== 'none' ? t('أجواء التدبر', 'Ambient On') : t('أجواء هادئة', 'Ambient')}
        </span>
      </button>

      {isOpen && (
        <div className="absolute end-0 top-full mt-2 z-50 w-64 p-3.5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#D9B45A]/35 shadow-2xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
              {t('أصوات الطبيعة للخشوع', 'Calm Ambient Sounds')}
            </span>
            {activeSound !== 'none' && (
              <button
                type="button"
                onClick={() => {
                  ambientAudio.stop();
                  setActiveSound('none');
                }}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:opacity-80 flex items-center gap-0.5 cursor-pointer"
              >
                <VolumeX className="w-3 h-3" />
                {t('إيقاف', 'Stop')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => toggleSound('rain')}
              className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                activeSound === 'rain'
                  ? 'bg-[#1F3A6E] border-[#648CD4] text-[#D9B45A]'
                  : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D9B45A]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              <CloudRain className="w-4 h-4" />
              <span>{t('مطر خفيف', 'Light Rain')}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('breeze')}
              className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                activeSound === 'breeze'
                  ? 'bg-[#1F3A6E] border-[#648CD4] text-[#D9B45A]'
                  : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D9B45A]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              <Wind className="w-4 h-4" />
              <span>{t('حفيف شجر', 'Forest Breeze')}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('night')}
              className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                activeSound === 'night'
                  ? 'bg-[#1F3A6E] border-[#648CD4] text-[#D9B45A]'
                  : 'bg-[#F6EFDD] dark:bg-slate-950 border-[#D9B45A]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>{t('سكينة الليل', 'Night Calm')}</span>
            </button>
          </div>

          {activeSound !== 'none' && (
            <div className="pt-2 border-t border-[#D9B45A]/20 dark:border-slate-800">
              <div className="flex justify-between text-[11px] text-[#5C5549] dark:text-slate-400 mb-1 tabular-nums">
                <span>{t('مستوى الصوت', 'Volume')}</span>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 accent-[#1F3A6E] dark:accent-[#D9B45A] bg-[#E5DAC0] dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
