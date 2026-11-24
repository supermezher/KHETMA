import React, { useState, useEffect } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import { useLanguage } from '../utils/i18n';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIOSGuide]);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#1F3A6E]/10 hover:bg-[#1F3A6E]/20 dark:bg-[#1F3A6E]/50 dark:hover:bg-[#1F3A6E] border border-[#1F3A6E]/30 dark:border-[#648CD4]/40 text-xs font-bold text-[#1F3A6E] dark:text-[#F6EFDD] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        title={t('تثبيت تطبيق بيان على جهازك للعمل دون اتصال', 'Install Bayan on your device for offline access')}
      >
        <Download className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
        <span className="hidden sm:inline">{t('تثبيت التطبيق', 'Install App')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#8A6418]/25 dark:border-slate-700 text-xs font-semibold text-[#1B1A17] dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title={t('طريقة تثبيت التطبيق على الآيفون والآيباد', 'How to install on iPhone & iPad')}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
          <span className="hidden sm:inline">{t('تثبيت على iOS', 'Install iOS')}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-700 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#8A6418]/15 dark:border-slate-800 pb-3">
                <h3 id="ios-install-title" className="text-sm font-bold text-[#1B1A17] dark:text-white">
                  {t('تثبيت مصحف «بيان» على iPhone / iPad', 'Install Bayan on iPhone / iPad')}
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-[#5C5549] dark:text-slate-300 space-y-2 list-decimal ps-4 leading-relaxed">
                <li>
                  {t(
                    <>اضغط على زر <strong>المشاركة (Share)</strong> أسفل متصفح Safari.</>,
                    <>Tap the <strong>Share</strong> button at the bottom of Safari.</>
                  )}
                </li>
                <li>
                  {t(
                    <>اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</>,
                    <>Select <strong>Add to Home Screen</strong>.</>
                  )}
                </li>
                <li>
                  {t(
                    <>اضغط <strong>إضافة</strong> ليعمل التطبيق كتطبيق مستقل مع قراءة دون اتصال.</>,
                    <>Tap <strong>Add</strong> to use Bayan as a standalone app offline.</>
                  )}
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] text-xs font-bold transition-colors cursor-pointer"
              >
                {t('فهمت', 'Got it')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-20 end-4 z-50 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/95 border border-[#8A6418]/40 dark:border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-[#4A3B12] dark:text-amber-200 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#8A6418] dark:text-amber-400 shrink-0" />
      <span>
        {t(
          'وضع عدم الاتصال: يتم استخدام السور والمحفوظات المخزنة محلياً',
          'Offline mode: using locally cached Surahs & bookmarks'
        )}
      </span>
    </div>
  );
};
