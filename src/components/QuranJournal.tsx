import React, { useState } from 'react';
import { PenLine, Search, Trash2, Download, ShieldCheck, Calendar, BookOpen } from 'lucide-react';
import { SURAHS_LIST } from '../data/quranMetadata';
import { buildUserBackupPayload } from '../utils/userBackup';
import { toArabicIndic } from './khatma/KhatmaRing';

export interface JournalNote {
  ayahId: number;
  surahNumber?: number;
  surahName?: string;
  ayahNumber?: number;
  text: string;
  date: string;
}

interface QuranJournalProps {
  notes: JournalNote[];
  onDeleteNote: (ayahId: number) => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
}

export const QuranJournal: React.FC<QuranJournalProps> = ({
  notes,
  onDeleteNote,
  onNavigateToAyah,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNotes = notes.filter(n =>
    n.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.surahName && n.surahName.includes(searchTerm))
  );

  const handleExportJournal = () => {
    const payload = buildUserBackupPayload(notes);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `bayan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-l from-[#142038] via-[#10161f] to-[#10161f] border border-[#D9B45A]/25 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[#D9B45A] text-xs font-bold">
            <PenLine className="w-4 h-4 shrink-0" />
            <span>مفكرة التدبر الشخصية والخواطر</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F6EFDD] font-kufi">
            خواطرك وتأملاتك مع كتاب الله
          </h2>
          <div className="flex items-start sm:items-center gap-2 text-xs text-slate-300 mt-1">
            <ShieldCheck className="w-4 h-4 text-[#D9B45A] shrink-0 mt-0.5 sm:mt-0" />
            <span>
              محفوظة محلياً في متصفحك فقط (IndexedDB وذاكرة الجهاز) دون إرسال لأي خادم — نوصي بتصدير نسخة احتياطية دورياً.
            </span>
          </div>
        </div>

        {notes.length > 0 && (
          <button
            type="button"
            onClick={handleExportJournal}
            className="min-h-[42px] py-2.5 px-4 bg-[#1F3A6E] hover:bg-[#2E5499] text-[#F6EFDD] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-[#648CD4]/40 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B45A]"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية (.json)</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث في خواطرك أو باسم السورة..."
          aria-label="ابحث في خواطرك أو باسم السورة"
          className="w-full min-h-[44px] pr-10 pl-4 py-3 rounded-xl bg-[#10161f] border border-slate-700/80 focus:border-[#D9B45A] focus:ring-1 focus:ring-[#D9B45A] text-sm text-[#F6EFDD] placeholder:text-slate-400 outline-none"
        />
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="p-10 sm:p-12 text-center rounded-2xl bg-[#10161f]/70 border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-[#D9B45A]">
            <PenLine className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F6EFDD]">لا توجد خواطر مسجلة بعد</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            أثناء قراءتك في المصحف، انقر على أي آية واختر «مفكرتي الخاصة» لتسجيل ما يفتح الله به عليك من تدبر.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.ayahId}
              className="p-5 rounded-2xl bg-[#10161f] border border-slate-800 shadow-lg flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[#D9B45A] font-bold">
                      {note.surahName
                        ? `سورة ${note.surahName}${note.ayahNumber ? ` · آية ${toArabicIndic(note.ayahNumber)}` : ''}`
                        : `الآية ${toArabicIndic(note.ayahId)}`}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {note.date}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.ayahId)}
                    aria-label="حذف الخاطرة"
                    title="حذف الخاطرة"
                    className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="font-naskh text-[#F6EFDD]/95 text-base sm:text-[17px] leading-[1.85] whitespace-pre-wrap">
                  {note.text}
                </p>
              </div>

              {(note.surahNumber || note.surahName) && onNavigateToAyah && (
                <div className="pt-2.5 border-t border-slate-800/80 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const resolvedSurah =
                        note.surahNumber ||
                        SURAHS_LIST.find((s) => s.name === note.surahName)?.number ||
                        1;
                      onNavigateToAyah(resolvedSurah, note.ayahNumber || 1);
                    }}
                    className="min-h-[36px] px-2.5 rounded-lg text-xs text-[#648CD4] hover:text-[#D9B45A] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>مراجعة الآية في المصحف</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
