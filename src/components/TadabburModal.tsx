import React, { useState, useEffect } from 'react';
import { X, BookOpen, Sparkles, Compass, Lightbulb, PenLine, Check, Share2, Volume2, Loader2 } from 'lucide-react';
import {
  Ayah,
  TAFSIR_EDITIONS,
  getAyahTafsirByEdition,
  getTafsirEditionDescription,
  getTafsirEditionName,
} from '../data/quranService';
import { SURAHS_LIST, getSurahFullTitle } from '../data/quranMetadata';
import { formatLocalizedDigits, useLanguage } from '../utils/i18n';

export interface JournalNotePayload {
  ayahId: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  note: string;
  date: string;
}

interface TadabburModalProps {
  isOpen: boolean;
  onClose: () => void;
  ayah: Ayah | null;
  surahNumber: number;
  surahName: string;
  onSaveJournalNote: (payload: JournalNotePayload) => void;
  savedNote?: string;
  onPlayAyah?: (ayahNumber: number) => void;
  onOpenShareModal?: (ayah: Ayah) => void;
}

export const TadabburModal: React.FC<TadabburModalProps> = ({
  isOpen,
  onClose,
  ayah,
  surahNumber,
  surahName,
  onSaveJournalNote,
  savedNote = '',
  onPlayAyah,
  onOpenShareModal,
}) => {
  const { lang, isEnglish, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'tafsir' | 'tadabbur' | 'irab' | 'journal'>('tadabbur');
  const [journalInput, setJournalInput] = useState(savedNote);
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  // Multi-tafsir edition state
  const [selectedEdition, setSelectedEdition] = useState<string>('ar.muyassar');
  const [editionTafsirText, setEditionTafsirText] = useState<string>('');
  const [isLoadingTafsir, setIsLoadingTafsir] = useState<boolean>(false);
  const [tafsirError, setTafsirError] = useState<string | null>(null);

  useEffect(() => {
    setJournalInput(savedNote);
  }, [savedNote, ayah]);

  useEffect(() => {
    if (!isOpen || !ayah) return;
    if (selectedEdition === 'ar.muyassar') {
      setEditionTafsirText(ayah.tafsir);
      setTafsirError(null);
      setIsLoadingTafsir(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTafsir(true);
    setTafsirError(null);

    getAyahTafsirByEdition(surahNumber, ayah.numberInSurah, selectedEdition)
      .then((text) => {
        if (!cancelled) {
          setEditionTafsirText(text);
          setIsLoadingTafsir(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTafsirError(err.message || t('تعذر تحميل هذا التفسير', 'Could not load this tafsir'));
          setIsLoadingTafsir(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ayah, surahNumber, selectedEdition, t]);

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

  if (!isOpen || !ayah) return null;

  const activeEditionMeta = TAFSIR_EDITIONS.find((e) => e.id === selectedEdition) || TAFSIR_EDITIONS[0];
  const surahMeta = SURAHS_LIST[surahNumber - 1];
  const displaySurahTitle = surahMeta
    ? getSurahFullTitle(surahMeta, lang)
    : t(`سورة ${surahName}`, `Surah ${surahName}`);

  const handleSaveNote = () => {
    onSaveJournalNote({
      ayahId: ayah.overallNumber,
      surahNumber,
      surahName,
      ayahNumber: ayah.numberInSurah,
      text: ayah.text,
      note: journalInput,
      date: new Date().toLocaleDateString(isEnglish ? 'en-US' : 'ar-SA'),
    });
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tadabbur-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b border-[#E3D9C3] dark:border-slate-800 ${
            isEnglish ? 'bg-gradient-to-r' : 'bg-gradient-to-l'
          } from-[#EFE6D1] via-[#FBF7EE] to-[#F6EFDD] dark:from-[#142038] dark:via-[#10161f] dark:to-[#0c1118] flex items-center justify-between gap-2`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/50 border border-[#1F3A6E]/25 dark:border-[#648CD4]/40 flex items-center justify-center text-[#8A6418] dark:text-[#D9B45A] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="tadabbur-modal-title" className="font-bold text-[#1B1A17] dark:text-[#F6EFDD] text-base sm:text-lg flex items-center gap-2 truncate tabular-nums">
                <span>{displaySurahTitle}</span>
                <span className="text-xs text-[#8A6418] dark:text-[#D9B45A] font-normal">
                  · {t('الآية', 'Ayah')} {formatLocalizedDigits(ayah.numberInSurah, lang)}
                </span>
              </h3>
              <p className="text-xs text-[#5E584E] dark:text-slate-400 truncate">
                {t('مساعد الفهم العميق والتدبر والتفاسير المعتمدة', 'Deep Reflection, Tadabbur & Classical Tafsir Companion')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onPlayAyah && (
              <button
                type="button"
                onClick={() => onPlayAyah(ayah.numberInSurah)}
                aria-label={t('استماع للآية', 'Listen to Ayah')}
                title={t('استماع للآية', 'Listen to Ayah')}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#5E584E] dark:text-slate-300 hover:text-[#1F3A6E] dark:hover:text-[#D9B45A] hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}
            {onOpenShareModal && (
              <button
                type="button"
                onClick={() => onOpenShareModal(ayah)}
                aria-label={t('مشاركة كبطاقة', 'Share as Card')}
                title={t('مشاركة كبطاقة', 'Share as Card')}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#5E584E] dark:text-slate-300 hover:text-[#1F3A6E] dark:hover:text-[#D9B45A] hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('إغلاق النافذة', 'Close modal')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#5E584E] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Highlighted Ayah Banner */}
        <div className="p-4 sm:p-5 bg-[#F6EFDD] dark:bg-[#0b1018] border-b border-[#E3D9C3] dark:border-slate-800 text-center">
          <p dir="rtl" lang="ar" className="font-quran text-xl sm:text-2xl text-[#1B1A17] dark:text-[#F6EFDD] leading-loose">
            ﴿ {ayah.text} ﴾
          </p>
          <div className="mt-2 text-xs text-[#5E584E] dark:text-slate-400 flex justify-center gap-3 tabular-nums">
            <span>{t('الجزء', 'Juz')} {formatLocalizedDigits(ayah.juz, lang)}</span>
            <span aria-hidden="true">·</span>
            <span>{t('الصفحة', 'Page')} {formatLocalizedDigits(ayah.page, lang)}</span>
            <span aria-hidden="true">·</span>
            <span>{t('الحزب', 'Hizb')} {formatLocalizedDigits(Math.ceil(ayah.hizbQuarter / 4), lang)}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E3D9C3] dark:border-slate-800 bg-[#EFE6D1]/70 dark:bg-slate-950/40 px-3 pt-2 gap-1 overflow-x-auto">
          {[
            { id: 'tadabbur', label: t('التدبر والعمل', 'Tadabbur & Action'), icon: Sparkles },
            { id: 'tafsir', label: t('التفاسير المعتمدة', 'Classical Tafsir'), icon: BookOpen },
            { id: 'irab', label: t('الإعراب والغريب', 'Grammar & Lexicon'), icon: Compass },
            { id: 'journal', label: t('مفكرتي الخاصة', 'Personal Notes'), icon: PenLine },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'tafsir' | 'tadabbur' | 'irab' | 'journal')}
                className={`min-h-[42px] flex items-center gap-2 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#FBF7EE] dark:bg-[#10161f] text-[#1F3A6E] dark:text-[#D9B45A] border-t-2 border-[#8A6418] dark:border-[#D9B45A] shadow-sm dark:shadow-lg'
                    : 'text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200 hover:bg-[#FBF7EE]/60 dark:hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'tadabbur' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#8A6418]/10 to-[#F6EFDD] dark:from-[#D9B45A]/10 dark:to-[#0b1018] border border-[#8A6418]/25 dark:border-[#D9B45A]/25">
                <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] text-xs font-bold mb-2">
                  <Lightbulb className="w-4 h-4" />
                  <span>{t('سؤال التدبر واللمحة الإيمانية', 'Reflection Prompt & Heart Insight')}</span>
                </div>
                {ayah.reflectionQuestion ? (
                  <p dir="rtl" lang="ar" className="font-naskh text-[#1B1A17] dark:text-[#F6EFDD] text-[17px] leading-[1.85]">
                    {ayah.reflectionQuestion}
                  </p>
                ) : (
                  <p className={`${isEnglish ? 'text-sm leading-relaxed' : 'font-naskh text-[17px] leading-[1.85]'} text-[#1B1A17] dark:text-[#F6EFDD]`}>
                    {t(
                      'تأمل في دلالات هذه الآية الكريمة العظيمة: كيف تخاطب واقعك اليوم، وما الهداية القلبية التي تستنبطها من هذا البيان الإلهي؟',
                      'Pause to reflect on this noble verse: how does its guidance speak to your life today, and what spiritual lesson can your heart carry from it?'
                    )}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1F3A6E]/10 to-[#F6EFDD] dark:from-[#1F3A6E]/35 dark:to-[#0b1018] border border-[#1F3A6E]/25 dark:border-[#648CD4]/30">
                <div className="flex items-center gap-2 text-[#1F3A6E] dark:text-[#648CD4] text-xs font-bold mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{t('الواجب العملي المعاش (كيف أطبق الآية اليوم؟)', 'Practical Step (How to Live This Ayah Today)')}</span>
                </div>
                {ayah.practicalAction ? (
                  <p dir="rtl" lang="ar" className="font-naskh text-[#1B1A17] dark:text-[#F6EFDD] text-[17px] leading-[1.85]">
                    {ayah.practicalAction}
                  </p>
                ) : (
                  <p className={`${isEnglish ? 'text-sm leading-relaxed' : 'font-naskh text-[17px] leading-[1.85]'} text-[#1B1A17] dark:text-[#F6EFDD]`}>
                    {t(
                      'اعمل بمقتضى التفسير الميسر للآية، وحوّل فهمك لها إلى نية صالحة أو خلق حميد تطبقه في تعاملك مع نفسك والناس اليوم.',
                      'Turn your understanding of this verse into a sincere intention, an act of worship, or a noble character trait to practice with yourself and others today.'
                    )}
                  </p>
                )}
              </div>

              {ayah.asbabNuzul && (
                <div className="p-4 rounded-xl bg-[#EFE6D1]/70 dark:bg-slate-950/80 border border-[#E3D9C3] dark:border-slate-800">
                  <span className="text-xs font-bold text-[#8A6418] dark:text-[#D9B45A] block mb-1">
                    {t('سبب النزول ومقصد السورة:', 'Occasion of Revelation & Surah Context:')}
                  </span>
                  <p dir="rtl" lang="ar" className="font-naskh text-[#2E2A24] dark:text-slate-200 text-base leading-[1.85]">
                    {ayah.asbabNuzul}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tafsir' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-1.5 bg-[#EFE6D1] dark:bg-slate-950 p-1.5 rounded-xl border border-[#E3D9C3] dark:border-slate-800">
                {TAFSIR_EDITIONS.map((ed) => {
                  const isSel = selectedEdition === ed.id;
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      onClick={() => setSelectedEdition(ed.id)}
                      className={`min-h-[36px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isSel
                          ? 'bg-[#1F3A6E] text-[#FBF7EE] dark:text-[#F6EFDD] border border-[#2E5499] dark:border-[#648CD4]/50 shadow-sm'
                          : 'text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#FBF7EE] dark:hover:bg-slate-800'
                      }`}
                    >
                      {getTafsirEditionName(ed, lang)}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-[#F6EFDD] dark:bg-slate-950/70 border border-[#E3D9C3] dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-2 border-b border-[#E3D9C3] dark:border-slate-800/80">
                  <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] font-bold">
                    <BookOpen className="w-4 h-4" />
                    <span>{getTafsirEditionName(activeEditionMeta, lang)}</span>
                  </div>
                  <span className="text-[11px] text-[#5E584E] dark:text-slate-400">
                    {getTafsirEditionDescription(activeEditionMeta, lang)}
                  </span>
                </div>

                {isLoadingTafsir ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#5E584E] dark:text-slate-300">
                    <Loader2 className="w-4 h-4 animate-spin text-[#8A6418] dark:text-[#D9B45A]" />
                    <span>
                      {t(
                        `جارٍ جلب ${getTafsirEditionName(activeEditionMeta, lang)}...`,
                        `Fetching ${getTafsirEditionName(activeEditionMeta, lang)}...`
                      )}
                    </span>
                  </div>
                ) : tafsirError ? (
                  <p className="text-xs text-rose-700 dark:text-rose-300 py-3">{tafsirError}</p>
                ) : (
                  <p dir="rtl" lang="ar" className="font-naskh text-[#1B1A17] dark:text-[#F6EFDD]/95 text-[17px] leading-[1.9] pt-1 text-right">
                    {editionTafsirText || ayah.tafsir}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'irab' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-[#F6EFDD] dark:bg-slate-950/70 border border-[#E3D9C3] dark:border-slate-800">
                <div className="flex items-center gap-2 text-[#1F3A6E] dark:text-[#648CD4] text-xs font-bold mb-2">
                  <Compass className="w-4 h-4" />
                  <span>{t('اللمحة النحوية والإعراب', 'Arabic Syntax & Linguistic Note')}</span>
                </div>
                {ayah.irabHint ? (
                  <p dir="rtl" lang="ar" className="font-naskh text-[#1B1A17] dark:text-[#F6EFDD]/95 text-[17px] leading-[1.85]">
                    {ayah.irabHint}
                  </p>
                ) : (
                  <p className={`${isEnglish ? 'text-sm leading-relaxed' : 'font-naskh text-[17px] leading-[1.85]'} text-[#1B1A17] dark:text-[#F6EFDD]/95`}>
                    {t(
                      'الإعراب التفصيلي الكامل لكلمات هذه الآية الكريمة متاح في طبعة المصحف الإعرابي. يمكنك الاسترشاد بالتفسير الميسر لاستجلاء وجوه الإعراب والمعاني.',
                      'Detailed word-by-word Arabic grammatical parsing (I‘rab) works alongside classical commentaries in the Tafsir tab to clarify exact syntax and subtle meanings.'
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label htmlFor="tadabbur-journal-input" className="block text-xs font-semibold text-[#5E584E] dark:text-slate-300 mb-2">
                  {t(
                    'خواطري وتأملاتي الخاصة حول هذه الآية (محفوظة محلياً في متصفحك):',
                    'My personal reflections on this Ayah (saved locally in your browser):'
                  )}
                </label>
                <textarea
                  id="tadabbur-journal-input"
                  rows={5}
                  value={journalInput}
                  onChange={(e) => setJournalInput(e.target.value)}
                  placeholder={t(
                    'سجل هنا ما لامس قلبك من معانٍ، موقفاً حياتياً ذكرتك به الآية، أو عهداً تقطعه على نفسك...',
                    'Write what touched your heart, a real-life reminder, or a promise you wish to keep...'
                  )}
                  className={`${isEnglish ? 'text-sm leading-relaxed' : 'font-naskh text-base leading-[1.8]'} w-full p-3.5 rounded-xl bg-[#F6EFDD] dark:bg-slate-950 border border-[#D4C7AE] dark:border-slate-700 focus:border-[#8A6418] dark:focus:border-[#D9B45A] focus:ring-1 focus:ring-[#8A6418] dark:focus:ring-[#D9B45A] text-[#1B1A17] dark:text-[#F6EFDD] placeholder:text-[#8E8677] dark:placeholder:text-slate-500 resize-none outline-none`}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="min-h-[42px] py-2.5 px-5 bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#2E5499] dark:border-[#648CD4]/40 text-[#FBF7EE] dark:text-[#F6EFDD] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <PenLine className="w-4 h-4 text-[#D9B45A]" />
                  <span>{t('حفظ في مفكرتي', 'Save to Journal')}</span>
                </button>

                {isSavedAlert && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    {t('تم الحفظ بنجاح في المفكرة', 'Saved successfully to your journal')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-[#E3D9C3] dark:border-slate-800 bg-[#EFE6D1]/70 dark:bg-slate-950/90 flex items-center justify-between text-xs text-[#5E584E] dark:text-slate-400">
          <span>{t('بيان · مصحف وقف لوجه الله تعالى', "Bayan · Charitable Digital Mus'haf")}</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-4 py-1.5 rounded-lg bg-[#FBF7EE] dark:bg-slate-800 hover:bg-[#E3D9C3] dark:hover:bg-slate-700 border border-[#D4C7AE] dark:border-transparent text-[#1B1A17] dark:text-[#F6EFDD] font-medium transition-colors cursor-pointer"
          >
            {t('إغلاق', 'Close')}
          </button>
        </div>

      </div>
    </div>
  );
};
