import React, { useState, useEffect } from 'react';
import {
  Users, Heart, Share2, CheckCircle2, BookOpen, Plus, Sparkles,
  Check, Copy, Edit2, UserMinus, ShieldCheck, Clock, MessageCircle,
  AlertCircle, RotateCcw, UserCheck, Calendar, X, AlertTriangle, ExternalLink,
  Lock, Key, Eye, EyeOff, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import {
  PartClaim,
  fetchKhatmaState,
  claimJuzApi,
  completeJuzApi,
  releaseJuzApi,
  verifyAdminPinApi,
  changeAdminPinApi,
  executeAdminActionApi
} from '../data/khatmaApiService';
import { safeLocalStorage } from '../utils/safeStorage';

const DEFAULT_JUZ_SURAS: Record<number, string> = {
  1: 'من الفاتحة 1 إلى البقرة 141',
  2: 'من البقرة 142 إلى البقرة 252',
  3: 'من البقرة 253 إلى آل عمران 92',
  4: 'من آل عمران 93 إلى النساء 23',
  5: 'من النساء 24 إلى النساء 147',
  6: 'من النساء 148 إلى المائدة 81',
  7: 'من المائدة 82 إلى الأنعام 110',
  8: 'من الأنعام 111 إلى الأعراف 87',
  9: 'من الأعراف 88 إلى الأنفال 40',
  10: 'من الأنفال 41 إلى التوبة 92',
  11: 'من التوبة 93 إلى هود 5',
  12: 'من هود 6 إلى يوسف 52',
  13: 'من يوسف 53 إلى إبراهيم 52',
  14: 'من الحجر 1 إلى النحل 128',
  15: 'من الإسراء 1 إلى الكهف 74',
  16: 'من الكهف 75 إلى طه 135',
  17: 'من الأنبياء 1 إلى الحج 78',
  18: 'من المؤمنون 1 إلى الفرقان 20',
  19: 'من الفرقان 21 إلى النمل 55',
  20: 'من النمل 56 إلى العنكبوت 45',
  21: 'من العنكبوت 46 إلى الأحزاب 30',
  22: 'من الأحزاب 31 إلى يس 27',
  23: 'من يس 28 إلى الزمر 31',
  24: 'من الزمر 32 إلى فصلت 46',
  25: 'من فصلت 47 إلى الجاثية 37',
  26: 'من الأحقاف 1 إلى الذاريات 30',
  27: 'من الذاريات 31 إلى الحديد 29',
  28: 'من المجادلة 1 إلى التحريم 12',
  29: 'من الملك 1 إلى المرسلات 50',
  30: 'من النبأ 1 إلى الناس 6 (جزء عم)',
};

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'الآن';
  if (diffMinutes < 60) return `منذ ${diffMinutes} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوم`;
}

interface CollectiveKhatmaProps {
  onNavigateToJuz?: (juzNumber: number) => void;
}

export const CollectiveKhatma: React.FC<CollectiveKhatmaProps> = ({ onNavigateToJuz }) => {
  const STORAGE_KEY = 'bayan_collective_khatma_v2';

  const [dedicationTitle, setDedicationTitle] = useState('ختمة البر والصدقة الجارية لجميع موتى المسلمين');
  const [creatorName, setCreatorName] = useState('فاعل خير');
  const [deadlineDays, setDeadlineDays] = useState<number>(3);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminSessionPin, setAdminSessionPin] = useState<string>(''); // Kept only in memory
  const [isDefaultPin, setIsDefaultPin] = useState<boolean>(false);

  // Live Cloud Synchronization State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Supervisor PIN Security State
  const [isPinUnlockModalOpen, setIsPinUnlockModalOpen] = useState<boolean>(false);
  const [pinUnlockInput, setPinUnlockInput] = useState<string>('');
  const [pinUnlockError, setPinUnlockError] = useState<string | null>(null);
  const [showPinUnlockPassword, setShowPinUnlockPassword] = useState<boolean>(false);

  // Change PIN modal state
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState<boolean>(false);
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available' | 'claimed' | 'completed'>('all');
  
  // Inline edit state
  const [editingJuz, setEditingJuz] = useState<number | null>(null);
  const [editingNameInput, setEditingNameInput] = useState<string>('');

  // In-App Modals state
  const [claimModalJuz, setClaimModalJuz] = useState<number | null>(null);
  const [claimNameInput, setClaimNameInput] = useState<string>('');

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'withdraw' | 'admin-release' | 'reset-all';
    targetJuz?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'withdraw'
  });

  const [isDedicationModalOpen, setIsDedicationModalOpen] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(dedicationTitle);
  const [tempCreatorInput, setTempCreatorInput] = useState(creatorName);

  const [whatsAppModalConfig, setWhatsAppModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    whatsAppUrl: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    whatsAppUrl: ''
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Keyboard accessibility: close open modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (claimModalJuz !== null) setClaimModalJuz(null);
        if (confirmModalConfig.isOpen) setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (isDedicationModalOpen) setIsDedicationModalOpen(false);
        if (whatsAppModalConfig.isOpen) setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (isPinUnlockModalOpen) setIsPinUnlockModalOpen(false);
        if (isChangePinModalOpen) setIsChangePinModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    claimModalJuz,
    confirmModalConfig.isOpen,
    isDedicationModalOpen,
    whatsAppModalConfig.isOpen,
    isPinUnlockModalOpen,
    isChangePinModalOpen
  ]);

  // Generate initial fallback parts
  const generateInitialParts = (): PartClaim[] => {
    return Array.from({ length: 30 }, (_, i) => {
      const num = i + 1;
      return {
        juzNumber: num,
        juzName: `الجزء ${num}`,
        claimedBy: null,
        claimedAt: undefined,
        isCompleted: false,
        surahsCovered: DEFAULT_JUZ_SURAS[num],
      };
    });
  };

  const [parts, setParts] = useState<PartClaim[]>(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.parts && Array.isArray(parsed.parts)) {
          return parsed.parts;
        }
      } catch {
        // fallback
      }
    }
    return generateInitialParts();
  });

  // Real Backend Synchronization Engine
  const syncWithServer = async (silent = true) => {
    try {
      if (!silent) setIsSyncing(true);
      const data = await fetchKhatmaState();
      if (data.success && Array.isArray(data.parts)) {
        setParts(data.parts);
        if (data.dedicationTitle) setDedicationTitle(data.dedicationTitle);
        if (data.creatorName) setCreatorName(data.creatorName);
        if (data.deadlineDays) setDeadlineDays(data.deadlineDays);
        setIsDefaultPin(data.isDefaultPin);
        setIsOnline(true);
        setLastSyncTime(new Date());

        // Cache locally for offline resilience safely
        safeLocalStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            parts: data.parts,
            dedicationTitle: data.dedicationTitle,
            creatorName: data.creatorName,
            deadlineDays: data.deadlineDays,
            updatedAt: data.updatedAt,
          })
        );
      }
    } catch (err) {
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncWithServer(false);
    // Poll every 4 seconds to synchronize live claims from other users in real time
    const pollTimer = setInterval(() => {
      syncWithServer(true);
    }, 4000);

    return () => clearInterval(pollTimer);
  }, []);

  const completedCount = parts.filter(p => p.isCompleted).length;
  const claimedCount = parts.filter(p => p.claimedBy !== null).length;
  const progressPercent = Math.round((completedCount / 30) * 100);

  // Safe clipboard helper
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  };

  // Open Claim in-app modal
  const handleOpenClaimModal = (juzNum: number) => {
    setClaimModalJuz(juzNum);
    setClaimNameInput('');
  };

  // Confirm Claim (Synchronized to Server)
  const handleConfirmClaim = async () => {
    if (!claimModalJuz) return;
    const trimmed = claimNameInput.trim() || 'قارئ محب للخير';

    // Optimistic update
    setParts(prev =>
      prev.map(p =>
        p.juzNumber === claimModalJuz
          ? { ...p, claimedBy: trimmed, claimedAt: new Date().toISOString(), isCompleted: false }
          : p
      )
    );
    setClaimModalJuz(null);

    try {
      const res = await claimJuzApi(claimModalJuz, trimmed);
      if (res.success && res.parts) {
        setParts(res.parts);
        showToast(`تم حجز الجزء ${claimModalJuz} بنجاح ومزامنته سحابياً باسم: ${trimmed} 🌿`);
      } else {
        showToast(res.error || `تم حجز الجزء ${claimModalJuz}`);
      }
    } catch {
      showToast(`تم حفظ الحجز محلياً للجزء ${claimModalJuz}`);
    }
  };

  // Toggle completion (Synchronized to Server)
  const handleToggleComplete = async (juzNumber: number) => {
    // Optimistic update
    setParts(prev =>
      prev.map(p => (p.juzNumber === juzNumber ? { ...p, isCompleted: !p.isCompleted } : p))
    );

    try {
      const res = await completeJuzApi(juzNumber);
      if (res.success && res.parts) {
        setParts(res.parts);
        const part = res.parts.find(p => p.juzNumber === juzNumber);
        if (part?.isCompleted) {
          showToast(`هنيئاً لك! تم إتمام قراءة الجزء ${juzNumber} وتحديثه لجميع المشاركين ✨`);
        }
      }
    } catch {
      showToast(`تم تحديث الجزء ${juzNumber}`);
    }
  };

  // Inline edit name (Supervisor only, guarded by PIN)
  const handleStartEditName = (juzNumber: number, currentName: string) => {
    setEditingJuz(juzNumber);
    setEditingNameInput(currentName);
  };

  const handleSaveEditName = async (juzNumber: number) => {
    const trimmed = editingNameInput.trim();
    if (!trimmed) return;

    setEditingJuz(null);

    // Optimistic
    setParts(prev =>
      prev.map(p => (p.juzNumber === juzNumber ? { ...p, claimedBy: trimmed } : p))
    );

    try {
      const res = await executeAdminActionApi(adminSessionPin, 'edit-name', {
        targetJuz: juzNumber,
        newName: trimmed,
      });
      if (res.success && res.parts) {
        setParts(res.parts);
        showToast(`تم تحديث اسم القارئ للجزء ${juzNumber} إلى: ${trimmed}`);
      }
    } catch {
      showToast(`تم تحديث الاسم`);
    }
  };

  // Supervisor PIN Authentication Handlers (Secure)
  const handleOpenAdminToggle = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      setAdminSessionPin('');
      showToast('تم الخروج من وضع المشرف وإغلاق الصلاحيات بنجاح');
    } else {
      setPinUnlockInput('');
      setPinUnlockError(null);
      setIsPinUnlockModalOpen(true);
    }
  };

  const handleVerifyPin = async () => {
    const pin = pinUnlockInput.trim();
    if (!pin) {
      setPinUnlockError('يرجى إدخال رمز المشرف السري');
      return;
    }

    try {
      const res = await verifyAdminPinApi(pin);
      if (res.success && res.verified) {
        setIsAdminMode(true);
        setAdminSessionPin(pin);
        setIsPinUnlockModalOpen(false);
        setPinUnlockError(null);
        showToast('تم التحقق بنجاح! تم تفعيل وضع المشرف 🛡️');
      } else {
        setPinUnlockError('رمز المشرف السري غير صحيح. يرجى التأكد وإعادة المحاولة');
      }
    } catch {
      setPinUnlockError('تعذر الاتصال بالخادم للتحقق من الرمز');
    }
  };

  const handleSaveNewPin = async () => {
    const trimmed = newPinInput.trim();
    if (!trimmed || trimmed.length < 3) {
      setChangePinError('يجب أن يتكون الرمز السري من 3 أرقام أو حروف على الأقل');
      return;
    }
    if (trimmed !== confirmNewPinInput.trim()) {
      setChangePinError('الرمزان غير متطابقين، يرجى كتابة الرمز وتأكيده بشكل مطابق');
      return;
    }

    const currentPin = currentPinInput.trim() || adminSessionPin;
    if (!currentPin) {
      setChangePinError('يرجى كتابة رمز المشرف الحالي للتأكيد');
      return;
    }

    try {
      const res = await changeAdminPinApi(currentPin, trimmed);
      if (res.success) {
        setAdminSessionPin(trimmed);
        setIsDefaultPin(false);
        setIsChangePinModalOpen(false);
        setChangePinError(null);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmNewPinInput('');
        showToast('تم تعيين رمز المشرف الجديد بنجاح وتأمينه سحابياً 🔑');
      } else {
        setChangePinError(res.error || 'تعذر تغيير الرمز السري، تأكد من الرمز الحالي');
      }
    } catch {
      setChangePinError('تعذر الاتصال بالخادم لتحديث الرمز');
    }
  };

  // Open in-app Confirm Modal (Withdraw / Admin release / Reset)
  const handleOpenConfirmModal = (actionType: 'withdraw' | 'admin-release' | 'reset-all', targetJuz?: number) => {
    if (actionType === 'withdraw') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'الاعتذار والانسحاب من القراءة',
        message: `هل ترغب في الاعتذار عن قراءة الجزء ${targetJuz}؟ سيتم إخلاء الجزء فوراً ليتمكن مشارك آخر من حجز وتلاوة هذا الورد ونيل الأجر.`,
        actionType,
        targetJuz
      });
    } else if (actionType === 'admin-release') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'إخلاء الجزء (إجراء المشرف)',
        message: `هل تريد بصفتك مشرف الختمة تحرير الجزء ${targetJuz} وإعادة طرحه شاغراً للمشاركين؟`,
        actionType,
        targetJuz
      });
    } else {
      setConfirmModalConfig({
        isOpen: true,
        title: 'إعادة ضبط وبدء ختمة جديدة',
        message: 'سيتم تفريغ كافة حجوزات الأجزاء الـ 30 وإعادة الختمة إلى نقطة البداية لجميع المشاركين. هل أنت متأكد؟',
        actionType
      });
    }
  };

  // Execute confirmed action (Synchronized with backend)
  const handleExecuteConfirm = async () => {
    const { actionType, targetJuz } = confirmModalConfig;
    setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));

    if (actionType === 'withdraw' && targetJuz) {
      // User self withdrawal
      setParts(prev =>
        prev.map(p =>
          p.juzNumber === targetJuz
            ? { ...p, claimedBy: null, claimedAt: undefined, isCompleted: false }
            : p
        )
      );
      try {
        const res = await releaseJuzApi(targetJuz);
        if (res.success && res.parts) setParts(res.parts);
        showToast(`تم الاعتذار عن الجزء ${targetJuz} وإتاحته للجميع`);
      } catch {
        showToast(`تم تحرير الجزء`);
      }
    } else if (actionType === 'admin-release' && targetJuz) {
      // Supervisor release
      try {
        const res = await executeAdminActionApi(adminSessionPin, 'release-part', { targetJuz });
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast(`تم تحرير الجزء ${targetJuz} من قبل المشرف`);
        }
      } catch {
        showToast(`تم تحرير الجزء`);
      }
    } else if (actionType === 'reset-all') {
      // Supervisor reset
      try {
        const res = await executeAdminActionApi(adminSessionPin, 'reset-all');
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast('تمت إعادة ضبط الختمة بنجاح وبدء دورة جديدة لجميع المشاركين 🌟');
        }
      } catch {
        showToast(`فشلت إعادة الضبط، تحقق من صلاحيات المشرف`);
      }
    }
  };

  // Real Collective Share URL (direct to khatma tab)
  const getKhatmaShareUrl = () => {
    return `${window.location.origin}/?tab=khatma`;
  };

  // Open WhatsApp Reminder in-app modal
  const handleOpenWhatsAppReminderModal = (part: PartClaim) => {
    const shareUrl = getKhatmaShareUrl();
    const msg = `السلام عليكم ورحمة الله وبركاته 🌸\nنذكركم بلطف بوردكم المبارك في الختمة الجماعية (${part.juzName}: ${part.surahsCovered}) بنية: "${dedicationTitle}".\n\nتقبل الله طاعاتكم وبارك في وقتكم!\nيمكنكم تأكيد إتمام القراءة عبر الرابط المباشر للختمة:\n${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    setWhatsAppModalConfig({
      isOpen: true,
      title: `تذكير عبر واتساب - ${part.juzName}`,
      message: msg,
      whatsAppUrl: url,
    });
  };

  // Open WhatsApp Broadcast in-app modal
  const handleOpenWhatsAppBroadcastModal = () => {
    const remainingCount = 30 - claimedCount;
    const shareUrl = getKhatmaShareUrl();
    const msg = `قال تعالى: ﴿وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ﴾ 📖\n\nندعوكم للمشاركة في الختمة الجماعية المباركة:\n✨ "${dedicationTitle}" ✨\n\n📊 نسبة الإنجاز الحالية: ${progressPercent}% (${completedCount} أجزاء مكتملة).\n📌 متبقي ${remainingCount} جزء شاغر للحجز.\n\nسارع بحجز جزئك والظفر بالأجر عبر الرابط المباشر:\n${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    setWhatsAppModalConfig({
      isOpen: true,
      title: 'دعوة ومتابعة الختمة الجماعية عبر واتساب',
      message: msg,
      whatsAppUrl: url,
    });
  };

  // Copy standard link
  const handleCopyLink = async () => {
    const shareUrl = getKhatmaShareUrl();
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      showToast('تم نسخ الرابط المباشر للختمة الجماعية إلى الحافظة 📋');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Save Dedication changes (Synchronized to backend)
  const handleSaveDedication = async () => {
    const trimmedTitle = tempTitleInput.trim() || dedicationTitle;
    const trimmedCreator = tempCreatorInput.trim() || creatorName;
    setDedicationTitle(trimmedTitle);
    setCreatorName(trimmedCreator);
    setIsDedicationModalOpen(false);

    try {
      const res = await executeAdminActionApi(adminSessionPin, 'update-dedication', {
        dedicationTitle: trimmedTitle,
        creatorName: trimmedCreator,
        deadlineDays,
      });
      if (res.success) {
        showToast('تم تحديث نية الختمة واسم المنشئ ومزامنتها لجميع المشاركين ✨');
      }
    } catch {
      showToast('تم حفظ التعديل محلياً');
    }
  };

  const filteredParts = parts.filter(p => {
    if (filter === 'available') return p.claimedBy === null;
    if (filter === 'claimed') return p.claimedBy !== null && !p.isCompleted;
    if (filter === 'completed') return p.isCompleted;
    return true;
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Hero Banner & Dedication Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Users className="w-3.5 h-3.5" />
                <span>ختمة جماعية تشاركية</span>
              </span>

              {/* Real Cloud Sync Status Indicator */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 text-emerald-300 text-xs font-medium border border-slate-800">
                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{isSyncing ? 'جارٍ المزامنة السحابية...' : isOnline ? 'مُتزامن حياً مع المشاركين 🌐' : 'وضع الاتصال المحلي'}</span>
              </span>

              {isAdminMode && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40 animate-pulse">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>وضع المشرف مُفعّل</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white font-kufi">
                {dedicationTitle}
              </h1>
              {isAdminMode && (
                <button
                  onClick={() => setIsDedicationModalOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="تعديل نية الختمة واسم المنشئ"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>المنشئ: {creatorName}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>المدة المستهدفة: {deadlineDays} أيام</span>
              </span>
            </div>
          </div>

          {/* Quick Actions (Share, WhatsApp, Admin PIN) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenWhatsAppBroadcastModal}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              title="مشاركة الختمة الجماعية عبر واتساب"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>نشر بالواتساب</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="نسخ رابط الختمة للمشاركة"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>

            {/* Supervisor PIN Toggle */}
            <button
              onClick={handleOpenAdminToggle}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isAdminMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-900/30'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={isAdminMode ? 'الخروج من وضع المشرف' : 'الدخول برمز المشرف لتعديل الأسماء والختمة'}
            >
              {isAdminMode ? <Lock className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
              <span>{isAdminMode ? 'خروج المشرف' : 'صلاحيات المشرف'}</span>
            </button>

            {isAdminMode && (
              <button
                onClick={() => {
                  setNewPinInput('');
                  setConfirmNewPinInput('');
                  setCurrentPinInput('');
                  setChangePinError(null);
                  setIsChangePinModalOpen(true);
                }}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 transition-colors cursor-pointer"
                title="تغيير رمز المشرف السري"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}

            {isAdminMode && (
              <button
                onClick={() => handleOpenConfirmModal('reset-all')}
                className="py-2 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="إعادة ضبط وتفريغ كل الأجزاء"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Progress & Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Progress Bar Card */}
        <div className="sm:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>نسبة إنجاز الختمة المباركة</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold text-base">
              {progressPercent}%
            </span>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>{completedCount} من 30 جزءاً تم إتمام قراءتها</span>
            <span>متبقي {30 - completedCount} أجزاء لاكتمال الختمة</span>
          </div>
        </div>

        {/* Quick Summary Counts */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-around">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-emerald-400">{30 - claimedCount}</div>
            <div className="text-xs text-slate-400 mt-1">شاغر للحجز</div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-amber-400">{claimedCount - completedCount}</div>
            <div className="text-xs text-slate-400 mt-1">قيد القراءة</div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-teal-400">{completedCount}</div>
            <div className="text-xs text-slate-400 mt-1">مكتمل بحمد الله</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
          {[
            { id: 'all', label: 'كافة الأجزاء (30)' },
            { id: 'available', label: `المتاحة (${30 - claimedCount})` },
            { id: 'claimed', label: `قيد القراءة (${claimedCount - completedCount})` },
            { id: 'completed', label: `المكتملة (${completedCount})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as any)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === t.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>احجز جزئك الآن، وانوِ الأجر لك ولوالديك وأحبابك</span>
        </div>
      </div>

      {/* 30 Juz Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredParts.map(part => {
          const isClaimed = part.claimedBy !== null;
          const isDone = part.isCompleted;

          return (
            <div
              key={part.juzNumber}
              className={`p-4 rounded-2xl border transition-all relative ${
                isDone
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : isClaimed
                  ? 'bg-slate-900/90 border-amber-500/40'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header: Juz name & Surahs */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center font-mono">
                      {part.juzNumber}
                    </span>
                    <h3 className="font-bold text-sm text-white">{part.juzName}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {part.surahsCovered}
                  </p>
                </div>

                {/* Status Badge */}
                {isDone ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>مكتمل</span>
                  </span>
                ) : isClaimed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                    <Clock className="w-3 h-3" />
                    <span>محجوز</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                    <span>شاغر</span>
                  </span>
                )}
              </div>

              {/* Reader claim info */}
              <div className="my-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {isClaimed ? (
                  <div className="flex items-center gap-1.5 w-full">
                    {editingJuz === part.juzNumber ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editingNameInput}
                          onChange={e => setEditingNameInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEditName(part.juzNumber);
                          }}
                          className="w-full px-2 py-1 bg-slate-950 border border-emerald-500 rounded-lg text-xs text-white outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditName(part.juzNumber)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-slate-200">{part.claimedBy}</span>
                          {part.claimedAt && (
                            <span className="text-[10px] text-slate-500">({formatRelativeTime(part.claimedAt)})</span>
                          )}
                        </div>

                        {isAdminMode && (
                          <button
                            onClick={() => handleStartEditName(part.juzNumber, part.claimedBy || '')}
                            className="p-1 text-slate-500 hover:text-amber-400"
                            title="تعديل اسم القارئ"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px]">لا يوجد قارئ مسجل بعد</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
                {!isClaimed ? (
                  <button
                    onClick={() => handleOpenClaimModal(part.juzNumber)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>احجز هذا الجزء</span>
                  </button>
                ) : (
                  <>
                    {/* Toggle complete */}
                    <button
                      onClick={() => handleToggleComplete(part.juzNumber)}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isDone
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isDone ? 'إلغاء الإتمام' : 'تمت القراءة ✓'}</span>
                    </button>

                    {/* Volunteer Withdraw */}
                    <button
                      onClick={() => handleOpenConfirmModal('withdraw', part.juzNumber)}
                      className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                      title="الاعتذار والانسحاب من قراءة الجزء"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>

                    {/* WhatsApp Reminder */}
                    <button
                      onClick={() => handleOpenWhatsAppReminderModal(part)}
                      className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                      title="تذكير القارئ عبر واتساب"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    {/* Admin release */}
                    {isAdminMode && (
                      <button
                        onClick={() => handleOpenConfirmModal('admin-release', part.juzNumber)}
                        className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors"
                        title="إخلاء الجزء بالقوة (المشرف)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}

                {/* Read Juz Button in Mushaf */}
                {onNavigateToJuz && (
                  <button
                    onClick={() => onNavigateToJuz(part.juzNumber)}
                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                    title="قراءة هذا الجزء في المصحف الشريف"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* IN-APP MODALS (NO window.prompt / window.confirm)                         */}
      {/* ========================================================================= */}

      {/* 1. Claim Part Modal */}
      {claimModalJuz !== null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <BookOpen className="w-4 h-4" />
                <h3 className="text-base text-white">حجز قراءة الجزء {claimModalJuz}</h3>
              </div>
              <button
                onClick={() => setClaimModalJuz(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              بارك الله فيك وتقبل طاعتك. يرجى كتابة اسمك الكريم أو اللقب لتسجيل حجز هذا الجزء في الختمة الجماعية:
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                اسم القارئ / فاعل خير:
              </label>
              <input
                type="text"
                value={claimNameInput}
                onChange={e => setClaimNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmClaim();
                }}
                placeholder="مثال: محمد، أم أحمد، فاعل خير..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-white outline-none"
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setClaimModalJuz(null)}
                className="py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmClaim}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد الحجز ونيل الأجر</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Generic Confirmation Modal (Withdraw / Admin Release / Reset All) */}
      {confirmModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{confirmModalConfig.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">يرجى التأكيد للمتابعة</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              {confirmModalConfig.message}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                تراجع
              </button>
              <button
                onClick={handleExecuteConfirm}
                className="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
              >
                نعم، تأكيد الإجراء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. WhatsApp In-App Share Modal */}
      {whatsAppModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <MessageCircle className="w-5 h-5" />
                <h3 className="text-base text-white">{whatsAppModalConfig.title}</h3>
              </div>
              <button
                onClick={() => setWhatsAppModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-bold">
                نص الرسالة التي سيتم إرسالها مع الرابط المباشر للمزامنة الحية:
              </label>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                {whatsAppModalConfig.message}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  copyToClipboard(whatsAppModalConfig.message);
                  showToast('تم نسخ نص الرسالة إلى الحافظة');
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ النص فقط</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWhatsAppModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="py-2 px-3 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  إغلاق
                </button>
                <a
                  href={whatsAppModalConfig.whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsAppModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح تطبيق واتساب</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Dedication Modal */}
      {isDedicationModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">تعديل نية الختمة الجماعية</h3>
              <button
                onClick={() => setIsDedicationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  عنوان ونية الختمة المباركة:
                </label>
                <input
                  type="text"
                  value={tempTitleInput}
                  onChange={e => setTempTitleInput(e.target.value)}
                  placeholder="مثال: ختمة ثواب للمرحوم الوالد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  اسم المنشئ / المنسق:
                </label>
                <input
                  type="text"
                  value={tempCreatorInput}
                  onChange={e => setTempCreatorInput(e.target.value)}
                  placeholder="مثال: عائلة فلان، فاعل خير..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-white outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsDedicationModalOpen(false)}
                className="py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveDedication}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Supervisor PIN Unlock Modal (Secure - NEVER shows PIN) */}
      {isPinUnlockModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base text-white">التحقق من هوية المشرف</h3>
              </div>
              <button
                onClick={() => {
                  setIsPinUnlockModalOpen(false);
                  setPinUnlockError(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              يرجى إدخال الرمز السري للمشرف لتمكين صلاحيات تعديل أسماء المشاركين، وإخلاء الأجزاء، أو إعادة ضبط الختمة.
            </p>

            {/* Error notice */}
            {pinUnlockError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{pinUnlockError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                رمز المشرف السري (PIN):
              </label>
              <div className="relative">
                <input
                  type={showPinUnlockPassword ? 'text' : 'password'}
                  value={pinUnlockInput}
                  onChange={(e) => {
                    setPinUnlockInput(e.target.value);
                    if (pinUnlockError) setPinUnlockError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyPin();
                  }}
                  placeholder="أدخل الرمز السري هنا..."
                  className="w-full pr-4 pl-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-sm text-white outline-none font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPinUnlockPassword(!showPinUnlockPassword)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                  title={showPinUnlockPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showPinUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Secure information notice (NEVER discloses current PIN) */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>هذا الإجراء محمي سحابياً لضمان نزاهة حجوزات القراء وتفادي التعديل غير المصرح به.</span>
            </div>

            {/* Initial deployment hint only if server confirms default state */}
            {isDefaultPin && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between">
                <span>تنبيه أولي: الرمز الافتراضي لتهيئة المشرف هو 1234. يرجى تغييره بعد الدخول لحماية الختمة.</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsPinUnlockModalOpen(false);
                  setPinUnlockError(null);
                }}
                className="py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={handleVerifyPin}
                className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد ودخول المشرف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Change Supervisor PIN Modal (Secure) */}
      {isChangePinModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-base text-white">تعيين رمز سري جديد للمشرف</h3>
              </div>
              <button
                onClick={() => {
                  setIsChangePinModalOpen(false);
                  setChangePinError(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              اختر رمزاً سرياً خاصاً بك (مثلاً: 4 أرقام أو حروف) لحماية إدارة الختمة ومنع غيرك من تغيير الأسماء.
            </p>

            {/* Error message */}
            {changePinError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{changePinError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  الرمز السري الحالي:
                </label>
                <input
                  type="password"
                  value={currentPinInput}
                  onChange={(e) => {
                    setCurrentPinInput(e.target.value);
                    if (changePinError) setChangePinError(null);
                  }}
                  placeholder="أدخل الرمز الحالي للتأكيد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-sm text-white font-mono outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  الرمز السري الجديد:
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    if (changePinError) setChangePinError(null);
                  }}
                  placeholder="أدخل الرمز الجديد (3 خانات فأكثر)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-sm text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  تأكيد الرمز السري الجديد:
                </label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => {
                    setConfirmNewPinInput(e.target.value);
                    if (changePinError) setChangePinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewPin();
                  }}
                  placeholder="أعد كتابة الرمز الجديد لتأكيده..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-sm text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsChangePinModalOpen(false);
                  setChangePinError(null);
                }}
                className="py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveNewPin}
                className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ الرمز وتأمينه سحابياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
