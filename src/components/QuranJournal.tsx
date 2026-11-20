import React, { useEffect, useMemo, useState } from 'react';
import {
  PenLine,
  Search,
  Trash2,
  Download,
  ShieldCheck,
  Calendar,
  BookOpen,
  Bookmark,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { SURAHS_LIST } from '../data/quranMetadata';
import { buildUserBackupPayload } from '../utils/userBackup';
import { toArabicIndic } from './khatma/KhatmaRing';
import {
  BOOKMARKS_UPDATED_EVENT,
  BOOKMARK_LABELS,
  BookmarkCategoryLabel,
  loadAllBookmarks,
  removeSurahBookmark,
  SavedBookmarkEntry,
  updateBookmarkLabel,
} from '../utils/bookmarksStore';

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
  onUpdateNote?: (ayahId: number, newText: string) => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
}

export const QuranJournal: React.FC<QuranJournalProps> = ({
  notes,
  onDeleteNote,
  onUpdateNote,
  onNavigateToAyah,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'bookmarks'>('notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAyahId, setEditingAyahId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<string>('');

  const [bookmarks, setBookmarks] = useState<SavedBookmarkEntry[]>(() => loadAllBookmarks());
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkCategoryLabel | 'all'>('all');

  useEffect(() => {
    const syncBookmarks = () => setBookmarks(loadAllBookmarks());
    syncBookmarks();
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
    window.addEventListener('storage', syncBookmarks);
    return () => {
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
      window.removeEventListener('storage', syncBookmarks);
    };
  }, []);

  const filteredNotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.text.toLowerCase().includes(q) ||
        (n.surahName && n.surahName.includes(searchTerm.trim()))
    );
  }, [notes, searchTerm]);

  const filteredBookmarks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookmarks.filter((b) => {
      if (bookmarkFilter !== 'all' && b.label !== bookmarkFilter) return false;
      if (!q) return true;
      return (
        b.surahName.includes(searchTerm.trim()) ||
        (b.ayahSnippet && b.ayahSnippet.includes(searchTerm.trim())) ||
        b.label.includes(searchTerm.trim()) ||
        String(b.surahNumber) === q
      );
    });
  }, [bookmarks, bookmarkFilter, searchTerm]);

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

  const handleStartEdit = (note: JournalNote) => {
    setEditingAyahId(note.ayahId);
    setEditingDraft(note.text);
  };

  const handleConfirmEdit = (ayahId: number) => {
    const trimmed = editingDraft.trim();
    if (!trimmed || !onUpdateNote) {
      setEditingAyahId(null);
      return;
    }
    onUpdateNote(ayahId, trimmed);
    setEditingAyahId(null);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-l from-[#FBF7EE] via-[#F6EFDD] to-[#EFE6D1] dark:from-[#142038] dark:via-[#10161f] dark:to-[#10161f] border border-[#8A6418]/30 dark:border-[#D9B45A]/25 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#D9B45A] text-xs font-bold">
              <PenLine className="w-4 h-4 shrink-0" />
              <span>مفكرة التدبر والعلامات المرجعية الشخصية</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1B1A17] dark:text-[#F6EFDD] font-kufi">
              خواطرك ومواضع وقوفك في كتاب الله
            </h2>
            <div className="flex items-start sm:items-center gap-2 text-xs text-[#5C5549] dark:text-slate-300 mt-1">
              <ShieldCheck className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0 mt-0.5 sm:mt-0" />
              <span>
                محفوظة محلياً في جهازك فقط دون إرسال لأي خادم — نوصي بتصدير نسخة احتياطية دورياً.
              </span>
            </div>
          </div>

          {(notes.length > 0 || bookmarks.length > 0) && (
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

        {/* Segmented Workspace Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#EFE6D1] dark:bg-slate-950/80 p-1.5 rounded-xl border border-[#8A6418]/20 dark:border-slate-800 max-w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`min-h-[38px] py-1.5 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
              activeTab === 'notes'
                ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50 shadow-sm'
                : 'text-[#5C5549] hover:text-[#1B1A17] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <PenLine className="w-3.5 h-3.5 text-[#D9B45A]" />
            <span>الخواطر والتدبر ({toArabicIndic(notes.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`min-h-[38px] py-1.5 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
              activeTab === 'bookmarks'
                ? 'bg-[#1F3A6E] text-[#F6EFDD] border border-[#648CD4]/50 shadow-sm'
                : 'text-[#5C5549] hover:text-[#1B1A17] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#D9B45A]" />
            <span>العلامات المرجعية ({toArabicIndic(bookmarks.length)})</span>
          </button>
        </div>
      </div>

      {/* Search & Label Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-[#5C5549] dark:text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'notes'
                ? 'ابحث في خواطرك أو باسم السورة...'
                : 'ابحث في العلامات المرجعية باسم السورة أو نص الآية...'
            }
            aria-label="بحث في المفكرة والعلامات المرجعية"
            className="w-full min-h-[44px] pr-10 pl-4 py-3 rounded-xl bg-white dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-700/80 focus:border-[#8A6418] dark:focus:border-[#D9B45A] focus:ring-1 focus:ring-[#D9B45A] text-sm text-[#1B1A17] dark:text-[#F6EFDD] placeholder:text-[#5C5549]/70 dark:placeholder:text-slate-400 outline-none"
          />
        </div>

        {activeTab === 'bookmarks' && bookmarks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBookmarkFilter('all')}
              className={`min-h-[38px] py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                bookmarkFilter === 'all'
                  ? 'bg-[#1F3A6E] border-[#648CD4] text-[#F6EFDD]'
                  : 'bg-[#FBF7EE] dark:bg-[#10161f] border-[#8A6418]/25 dark:border-slate-800 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              الكل
            </button>
            {BOOKMARK_LABELS.map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setBookmarkFilter(lbl)}
                className={`min-h-[38px] py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  bookmarkFilter === lbl
                    ? 'bg-[#D9B45A]/20 border-[#8A6418] dark:border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A]'
                    : 'bg-[#FBF7EE] dark:bg-[#10161f] border-[#8A6418]/25 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: JOURNAL NOTES */}
      {activeTab === 'notes' && (
        filteredNotes.length === 0 ? (
          <div className="p-10 sm:p-12 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/70 border border-[#8A6418]/25 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EFE6D1] dark:bg-slate-800/80 border border-[#8A6418]/30 dark:border-slate-700 flex items-center justify-center mx-auto text-[#8A6418] dark:text-[#D9B45A]">
              <PenLine className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
              {searchTerm.trim() ? 'لا توجد خواطر مطابقة لبحثك' : 'لا توجد خواطر مسجلة بعد'}
            </h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              أثناء قراءتك في المصحف، انقر على أي آية واختر «مفكرتي الخاصة» لتسجيل ما يفتح الله به عليك من تدبر.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes.map((note) => {
              const isEditing = editingAyahId === note.ayahId;
              return (
                <div
                  key={note.ayahId}
                  className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800 shadow-lg flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#8A6418]/15 dark:border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[#8A6418] dark:text-[#D9B45A] font-bold">
                          {note.surahName
                            ? `سورة ${note.surahName}${note.ayahNumber ? ` · آية ${toArabicIndic(note.ayahNumber)}` : ''}`
                            : `الآية ${toArabicIndic(note.ayahId)}`}
                        </span>
                        <span aria-hidden="true" className="text-[#5C5549]/50 dark:text-slate-600">·</span>
                        <span className="text-[11px] text-[#5C5549] dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {note.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onUpdateNote && !isEditing && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(note)}
                            aria-label="تعديل الخاطرة"
                            title="تعديل الخاطرة"
                            className="min-w-[34px] min-h-[34px] p-1.5 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#8A6418] dark:hover:text-[#D9B45A] hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.ayahId)}
                          aria-label="حذف الخاطرة"
                          title="حذف الخاطرة"
                          className="min-w-[34px] min-h-[34px] p-1.5 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2.5">
                        <textarea
                          rows={4}
                          value={editingDraft}
                          onChange={(e) => setEditingDraft(e.target.value)}
                          aria-label="تعديل نص الخاطرة"
                          className="font-naskh w-full p-3 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/50 dark:border-[#D9B45A]/50 text-[#1B1A17] dark:text-[#F6EFDD] text-base leading-[1.8] resize-none outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingAyahId(null)}
                            className="min-h-[34px] py-1 px-3 rounded-lg bg-[#EFE6D1] dark:bg-slate-800 hover:bg-[#E4D7BA] dark:hover:bg-slate-700 text-xs text-[#1B1A17] dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmEdit(note.ayahId)}
                            className="min-h-[34px] py-1 px-3.5 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] text-xs font-bold text-[#F6EFDD] flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-[#D9B45A]" />
                            <span>حفظ التعديل</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-naskh text-[#1B1A17] dark:text-[#F6EFDD]/95 text-base sm:text-[17px] leading-[1.85] whitespace-pre-wrap">
                        {note.text}
                      </p>
                    )}
                  </div>

                  {(note.surahNumber || note.surahName) && onNavigateToAyah && (
                    <div className="pt-2.5 border-t border-[#8A6418]/15 dark:border-slate-800/80 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const resolvedSurah =
                            note.surahNumber ||
                            SURAHS_LIST.find((s) => s.name === note.surahName)?.number ||
                            1;
                          onNavigateToAyah(resolvedSurah, note.ayahNumber || 1);
                        }}
                        className="min-h-[36px] px-2.5 rounded-lg text-xs text-[#1F3A6E] dark:text-[#648CD4] hover:text-[#8A6418] dark:hover:text-[#D9B45A] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>مراجعة الآية في المصحف</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB 2: UNIFIED BOOKMARKS ACROSS ALL 114 SURAHS */}
      {activeTab === 'bookmarks' && (
        filteredBookmarks.length === 0 ? (
          <div className="p-10 sm:p-12 text-center rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f]/70 border border-[#8A6418]/25 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EFE6D1] dark:bg-slate-800/80 border border-[#8A6418]/30 dark:border-slate-700 flex items-center justify-center mx-auto text-[#8A6418] dark:text-[#D9B45A]">
              <Bookmark className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#1B1A17] dark:text-[#F6EFDD]">
              {bookmarks.length === 0 ? 'لا توجد علامات مرجعية محفوظة بعد' : 'لا توجد علامات مطابقة للفلتر'}
            </h3>
            <p className="text-xs text-[#5C5549] dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              من صفحة المصحف، انقر على أيقونة العلامة المرجعية بجانب أي آية لحفظ موضع توقفك والوصول إليه هنا في أي وقت.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBookmarks.map((b) => (
              <div
                key={b.surahNumber}
                className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800 shadow-lg flex flex-col justify-between space-y-3.5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#8A6418]/15 dark:border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                      <span className="text-[#8A6418] dark:text-[#D9B45A] font-bold">
                        سورة {b.surahName} · آية {toArabicIndic(b.ayahNumber)}
                      </span>
                      {b.page && (
                        <>
                          <span aria-hidden="true" className="text-[#5C5549]/50 dark:text-slate-600">·</span>
                          <span className="text-[#5C5549] dark:text-slate-400">ص {toArabicIndic(b.page)}</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = removeSurahBookmark(b.surahNumber);
                        setBookmarks(next);
                      }}
                      aria-label={`إزالة العلامة المرجعية من سورة ${b.surahName}`}
                      title="حذف العلامة المرجعية"
                      className="min-w-[34px] min-h-[34px] p-1.5 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {b.ayahSnippet && (
                    <p className="font-quran text-[#1B1A17] dark:text-[#F6EFDD]/95 text-lg sm:text-xl leading-loose line-clamp-2">
                      ﴿ {b.ayahSnippet} ﴾
                    </p>
                  )}

                  {/* Quick Category Label Selector */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {BOOKMARK_LABELS.map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          const updated = updateBookmarkLabel(b.surahNumber, lbl);
                          setBookmarks(updated);
                        }}
                        className={`py-1 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          b.label === lbl
                            ? 'bg-[#D9B45A]/20 border-[#8A6418] dark:border-[#D9B45A]/60 text-[#8A6418] dark:text-[#D9B45A]'
                            : 'bg-[#EFE6D1] dark:bg-slate-950 border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-slate-200'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {onNavigateToAyah && (
                  <div className="pt-2.5 border-t border-[#8A6418]/15 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#5C5549] dark:text-slate-500">
                      حُفظت في {b.savedAt.slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateToAyah(b.surahNumber, b.ayahNumber)}
                      className="min-h-[36px] px-3 rounded-lg bg-[#1F3A6E] hover:bg-[#2E5499] border border-[#648CD4]/40 text-[#F6EFDD] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#D9B45A]" />
                      <span>متابعة من هذه الآية</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
