import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Heart, CheckCircle2, BookOpen, Plus,
  Check, Copy, Edit2, UserMinus, ShieldCheck, Clock, MessageCircle,
  AlertCircle, AlertTriangle, RotateCcw, UserCheck, Calendar, X, ExternalLink,
  Lock, Key, Trash2
} from 'lucide-react';
import {
  PartClaim,
  KhatmaRoomSummary,
  fetchKhatmaState,
  fetchKhatmaRooms,
  createKhatmaRoomApi,
  claimJuzApi,
  completeJuzApi,
  releaseJuzApi,
  verifyAdminKeyApi,
  rotateAdminKeyApi,
  executeAdminActionApi
} from '../data/khatmaApiService';
import { safeLocalStorage } from '../utils/safeStorage';
import { KhatmaRing, toArabicIndic } from './khatma/KhatmaRing';

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
  if (isNaN(date.getTime())) return dateStr;
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
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

function extractAdminKeyInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('adminKey=')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://bayan.app/${trimmed.replace(/^\/+/, '')}`);
      const fromQuery = url.searchParams.get('adminKey');
      if (fromQuery) return fromQuery.trim();
    }
  } catch {
    // fallback to raw token
  }
  return trimmed;
}

interface CollectiveKhatmaProps {
  onNavigateToJuz?: (juzNumber: number) => void;
}

export const CollectiveKhatma: React.FC<CollectiveKhatmaProps> = ({ onNavigateToJuz }) => {
  const [activeRoomId, setActiveRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('khatma');
      if (r && /^[a-zA-Z0-9_-]{2,64}$/.test(r)) return r.toLowerCase();
    }
    return 'public';
  });

  const STORAGE_KEY = `bayan_collective_khatma_v2_${activeRoomId}`;
  const CLAIM_TOKENS_KEY = `bayan_khatma_claim_tokens_${activeRoomId}`;
  const ADMIN_KEY_STORAGE = `bayan_khatma_admin_key_${activeRoomId}`;

  const [roomsList, setRoomsList] = useState<KhatmaRoomSummary[]>([]);
  const [isPublicRoom, setIsPublicRoom] = useState<boolean>(activeRoomId === 'public');

  // Create private room modal
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState<boolean>(false);
  const [newRoomTitle, setNewRoomTitle] = useState<string>('');
  const [newRoomCreator, setNewRoomCreator] = useState<string>('');
  const [newRoomDays, setNewRoomDays] = useState<number>(7);
  const [newRoomSlug, setNewRoomSlug] = useState<string>('');
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);

  // Secret Admin Links created modal
  const [createdAdminInfo, setCreatedAdminInfo] = useState<{
    roomId: string;
    adminKey: string;
    title: string;
  } | null>(null);

  const [dedicationTitle, setDedicationTitle] = useState('ختمة البر والصدقة الجارية لجميع موتى المسلمين');
  const [creatorName, setCreatorName] = useState('فاعل خير');
  const [deadlineDays, setDeadlineDays] = useState<number>(3);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminSessionKey, setAdminSessionKey] = useState<string>('');

  // Per-claim ownership tokens stored on claimer's browser
  const [claimTokens, setClaimTokens] = useState<Record<string, string>>(() =>
    safeLocalStorage.getJSON<Record<string, string>>(CLAIM_TOKENS_KEY, {})
  );

  // Sync & connection status
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);

  // Admin Secret Key Unlock Modal
  const [isAdminUnlockOpen, setIsAdminUnlockOpen] = useState<boolean>(false);
  const [adminKeyInput, setAdminKeyInput] = useState<string>('');
  const [adminUnlockError, setAdminUnlockError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available' | 'claimed' | 'completed'>('all');

  // Inline edit name (Admin only)
  const [editingJuz, setEditingJuz] = useState<number | null>(null);
  const [editingNameInput, setEditingNameInput] = useState<string>('');

  // Claim Modal
  const [claimModalJuz, setClaimModalJuz] = useState<number | null>(null);
  const [claimNameInput, setClaimNameInput] = useState<string>('');

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'withdraw' | 'admin-release' | 'reset-all' | 'delete-room';
    targetJuz?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'withdraw',
  });

  const [isDedicationModalOpen, setIsDedicationModalOpen] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(dedicationTitle);
  const [tempCreatorInput, setTempCreatorInput] = useState(creatorName);
  const [tempDeadlineInput, setTempDeadlineInput] = useState<number>(deadlineDays);

  const [whatsAppModalConfig, setWhatsAppModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    whatsAppUrl: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    whatsAppUrl: '',
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToastMessage({ type, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load claimTokens when room changes + check URL for ?adminKey= once & scrub URL bar
  useEffect(() => {
    setClaimTokens(safeLocalStorage.getJSON<Record<string, string>>(`bayan_khatma_claim_tokens_${activeRoomId}`, {}));
    const savedAdminKey = safeLocalStorage.getItem(`bayan_khatma_admin_key_${activeRoomId}`) || '';

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const urlAdminKey = url.searchParams.get('adminKey');
      if (urlAdminKey && urlAdminKey.trim().length >= 8) {
        const cleanKey = urlAdminKey.trim();
        safeLocalStorage.setItem(`bayan_khatma_admin_key_${activeRoomId}`, cleanKey);
        url.searchParams.delete('adminKey');
        window.history.replaceState({}, '', url.toString());

        verifyAdminKeyApi(cleanKey, activeRoomId)
          .then((res) => {
            if (res.success && res.verified) {
              setAdminSessionKey(cleanKey);
              setIsAdminMode(true);
              showToast('تم تفعيل صلاحيات مشرف الغرفة عبر الرابط السري');
            }
          })
          .catch(() => {});
        return;
      }
    }

    setAdminSessionKey(savedAdminKey);
    setIsAdminMode(false);
  }, [activeRoomId]);

  // Close dialogs on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (claimModalJuz !== null) setClaimModalJuz(null);
      if (confirmModalConfig.isOpen) setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      if (isDedicationModalOpen) setIsDedicationModalOpen(false);
      if (whatsAppModalConfig.isOpen) setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }));
      if (isAdminUnlockOpen) setIsAdminUnlockOpen(false);
      if (isCreateRoomOpen) setIsCreateRoomOpen(false);
      if (createdAdminInfo) setCreatedAdminInfo(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    claimModalJuz,
    confirmModalConfig.isOpen,
    isDedicationModalOpen,
    whatsAppModalConfig.isOpen,
    isAdminUnlockOpen,
    isCreateRoomOpen,
    createdAdminInfo,
  ]);

  const generateInitialParts = (): PartClaim[] =>
    Array.from({ length: 30 }, (_, i) => {
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

  const [parts, setParts] = useState<PartClaim[]>(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.parts && Array.isArray(parsed.parts)) return parsed.parts;
      } catch {
        // fallback
      }
    }
    return generateInitialParts();
  });

  const syncWithServer = useCallback(async (silent = true, targetRoom = activeRoomId) => {
    try {
      if (!silent) setIsSyncing(true);
      setRoomLoadError(null);
      const data = await fetchKhatmaState(targetRoom);
      if (data.success && Array.isArray(data.parts)) {
        setParts(data.parts);
        setIsPublicRoom(Boolean(data.isPublic ?? targetRoom === 'public'));
        if (data.dedicationTitle) setDedicationTitle(data.dedicationTitle);
        if (data.creatorName) setCreatorName(data.creatorName);
        if (data.deadlineDays) setDeadlineDays(data.deadlineDays);
        setIsOnline(true);

        safeLocalStorage.setItem(
          `bayan_collective_khatma_v2_${targetRoom}`,
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
      if (!silent) {
        setRoomLoadError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الغرفة');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [activeRoomId]);

  // Load public rooms list once on mount & pause polling when tab is hidden (F6)
  useEffect(() => {
    fetchKhatmaRooms()
      .then((res) => {
        if (res.success && Array.isArray(res.rooms)) {
          setRoomsList(res.rooms);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    syncWithServer(false, activeRoomId);

    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      syncWithServer(true, activeRoomId);
    }, 6000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer(true, activeRoomId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeRoomId, syncWithServer]);

  const handleSelectRoom = (nextRoomId: string) => {
    setActiveRoomId(nextRoomId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'khatma');
      if (nextRoomId === 'public') url.searchParams.delete('khatma');
      else url.searchParams.set('khatma', nextRoomId);
      url.searchParams.delete('adminKey');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCreateRoom = async () => {
    setCreateRoomError(null);
    setIsCreatingRoom(true);
    try {
      const res = await createKhatmaRoomApi({
        requestedSlug: newRoomSlug.trim() || undefined,
        dedicationTitle: newRoomTitle.trim(),
        creatorName: newRoomCreator.trim(),
        deadlineDays: newRoomDays,
      });
      if (!res.success || !res.roomId || !res.adminKey) {
        setCreateRoomError(res.error || 'تعذر إنشاء الختمة الخاصة');
        return;
      }

      // Persist secret adminKey locally on creator's browser
      safeLocalStorage.setItem(`bayan_khatma_admin_key_${res.roomId}`, res.adminKey);
      setIsCreateRoomOpen(false);
      setNewRoomTitle('');
      setNewRoomCreator('');
      setNewRoomSlug('');
      handleSelectRoom(res.roomId);
      setAdminSessionKey(res.adminKey);
      setIsAdminMode(true);
      setCreatedAdminInfo({
        roomId: res.roomId,
        adminKey: res.adminKey,
        title: res.dedicationTitle,
      });
    } catch {
      setCreateRoomError('تعذر الاتصال بالخادم لإنشاء الختمة');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const completedCount = parts.filter((p) => p.isCompleted).length;
  const claimedCount = parts.filter((p) => p.claimedBy !== null).length;
  const progressPercent = Math.round((completedCount / 30) * 100);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleConfirmClaim = async () => {
    if (!claimModalJuz) return;
    const targetJuz = claimModalJuz;
    const trimmed = claimNameInput.trim() || 'قارئ محب للخير';
    setClaimModalJuz(null);

    try {
      const res = await claimJuzApi(targetJuz, trimmed, activeRoomId);
      if (res.success && res.parts) {
        setParts(res.parts);
        if (res.claimToken) {
          const updated = { ...claimTokens, [String(targetJuz)]: res.claimToken };
          setClaimTokens(updated);
          safeLocalStorage.setJSON(CLAIM_TOKENS_KEY, updated);
        }
        showToast(`حُجز الجزء ${targetJuz} باسم ${trimmed}`);
      } else {
        if (res.parts) setParts(res.parts);
        showToast(res.error || `تعذر حجز الجزء ${targetJuz}`, 'err');
      }
    } catch {
      showToast('تعذر الاتصال بالخادم لتسجيل الحجز', 'err');
    }
  };

  const handleToggleComplete = async (juzNumber: number) => {
    const previousParts = parts;
    const token = claimTokens[String(juzNumber)];
    const adminAuth = isAdminMode ? adminSessionKey : undefined;

    setParts((prev) =>
      prev.map((p) => (p.juzNumber === juzNumber ? { ...p, isCompleted: !p.isCompleted } : p))
    );

    try {
      const res = await completeJuzApi(juzNumber, activeRoomId, {
        claimToken: token,
        adminKey: adminAuth,
      });
      if (res.success && res.parts) {
        setParts(res.parts);
        const updatedPart = res.parts.find((p) => p.juzNumber === juzNumber);
        if (updatedPart?.isCompleted) {
          showToast(`هنيئاً لك! تم إتمام قراءة الجزء ${juzNumber}`);
        }
      } else {
        setParts(res.parts || previousParts);
        showToast(res.error || 'غير مصرح بتحديث حالة هذا الجزء', 'err');
      }
    } catch {
      setParts(previousParts);
      showToast('تعذر الاتصال بالخادم لتحديث الجزء', 'err');
    }
  };

  const handleSaveEditName = async (juzNumber: number) => {
    const trimmed = editingNameInput.trim();
    if (!trimmed) return;
    const previousParts = parts;
    setEditingJuz(null);

    setParts((prev) =>
      prev.map((p) => (p.juzNumber === juzNumber ? { ...p, claimedBy: trimmed } : p))
    );

    try {
      const res = await executeAdminActionApi(
        adminSessionKey,
        'edit-name',
        { targetJuz: juzNumber, newName: trimmed },
        activeRoomId
      );
      if (res.success && res.parts) {
        setParts(res.parts);
        showToast(`تم تحديث اسم القارئ للجزء ${juzNumber} إلى: ${trimmed}`);
      } else {
        setParts(res.parts || previousParts);
        showToast(res.error || 'تعذر تعديل الاسم — تحقق من صلاحية المشرف', 'err');
      }
    } catch {
      setParts(previousParts);
      showToast('تعذر الاتصال بالخادم لتعديل الاسم', 'err');
    }
  };

  const handleOpenAdminToggle = async () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      showToast('تم الخروج من وضع المشرف');
      return;
    }

    // If browser already holds saved secret adminKey for this room, verify automatically
    if (adminSessionKey) {
      try {
        const res = await verifyAdminKeyApi(adminSessionKey, activeRoomId);
        if (res.success && res.verified) {
          setIsAdminMode(true);
          showToast('تم تفعيل وضع المشرف');
          return;
        }
      } catch {
        // fall through to unlock dialog
      }
    }

    setAdminKeyInput('');
    setAdminUnlockError(null);
    setIsAdminUnlockOpen(true);
  };

  const handleVerifyAdminKey = async () => {
    const extracted = extractAdminKeyInput(adminKeyInput);
    if (!extracted) {
      setAdminUnlockError('يرجى لصق مفتاح أو رابط المشرف السري');
      return;
    }

    try {
      const res = await verifyAdminKeyApi(extracted, activeRoomId);
      if (res.success && res.verified) {
        safeLocalStorage.setItem(ADMIN_KEY_STORAGE, extracted);
        setAdminSessionKey(extracted);
        setIsAdminMode(true);
        setIsAdminUnlockOpen(false);
        setAdminUnlockError(null);
        showToast('تم التحقق وتفعيل صلاحيات المشرف');
      } else {
        setAdminUnlockError(res.error || 'مفتاح المشرف السري غير صحيح');
      }
    } catch {
      setAdminUnlockError('تعذر الاتصال بالخادم للتحقق من المفتاح');
    }
  };

  const handleRotateAdminKey = async () => {
    if (!adminSessionKey) return;
    try {
      const res = await rotateAdminKeyApi(adminSessionKey, activeRoomId);
      if (res.success && res.adminKey) {
        safeLocalStorage.setItem(ADMIN_KEY_STORAGE, res.adminKey);
        setAdminSessionKey(res.adminKey);
        setCreatedAdminInfo({
          roomId: activeRoomId,
          adminKey: res.adminKey,
          title: dedicationTitle,
        });
      } else {
        showToast(res.error || 'تعذر تجديد مفتاح المشرف', 'err');
      }
    } catch {
      showToast('تعذر الاتصال بالخادم لتدوير المفتاح', 'err');
    }
  };

  const handleOpenConfirmModal = (
    actionType: 'withdraw' | 'admin-release' | 'reset-all' | 'delete-room',
    targetJuz?: number
  ) => {
    if (actionType === 'withdraw') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'الاعتذار والانسحاب من القراءة',
        message: `هل ترغب في الاعتذار عن قراءة الجزء ${targetJuz}؟ سيتم إخلاء الجزء فوراً ليتمكن مشارك آخر من حجزه.`,
        actionType,
        targetJuz,
      });
    } else if (actionType === 'admin-release') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'إخلاء الجزء (إجراء المشرف)',
        message: `هل تريد تحرير الجزء ${targetJuz} وإعادة طرحه شاغراً للمشاركين؟`,
        actionType,
        targetJuz,
      });
    } else if (actionType === 'delete-room') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'حذف هذه الغرفة الخاصة نهائياً',
        message: 'سيتم حذف غرفة الختمة الخاصة وجميع بياناتها من الخادم نهائياً. هل أنت متأكد؟',
        actionType,
      });
    } else {
      setConfirmModalConfig({
        isOpen: true,
        title: 'إعادة ضبط وبدء ختمة جديدة',
        message: 'سيتم تفريغ كافة حجوزات الأجزاء الـ 30 وإعادة الختمة إلى نقطة البداية لجميع المشاركين.',
        actionType,
      });
    }
  };

  const handleExecuteConfirm = async () => {
    const { actionType, targetJuz } = confirmModalConfig;
    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));

    if (actionType === 'withdraw' && targetJuz) {
      const previousParts = parts;
      const token = claimTokens[String(targetJuz)];
      setParts((prev) =>
        prev.map((p) =>
          p.juzNumber === targetJuz
            ? { ...p, claimedBy: null, claimedAt: undefined, isCompleted: false }
            : p
        )
      );
      try {
        const res = await releaseJuzApi(targetJuz, activeRoomId, {
          claimToken: token,
          adminKey: isAdminMode ? adminSessionKey : undefined,
        });
        if (res.success && res.parts) {
          setParts(res.parts);
          const nextTokens = { ...claimTokens };
          delete nextTokens[String(targetJuz)];
          setClaimTokens(nextTokens);
          safeLocalStorage.setJSON(CLAIM_TOKENS_KEY, nextTokens);
          showToast(`تم إخلاء الجزء ${targetJuz} وإتاحته للجميع`);
        } else {
          setParts(res.parts || previousParts);
          showToast(res.error || 'تفريغ الجزء متاح لصاحب الحجز أو المشرف فقط', 'err');
        }
      } catch {
        setParts(previousParts);
        showToast('تعذر الاتصال بالخادم لتحرير الجزء', 'err');
      }
    } else if (actionType === 'admin-release' && targetJuz) {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'release-part', { targetJuz }, activeRoomId);
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast(`تم تحرير الجزء ${targetJuz} من قبل المشرف`);
        } else {
          showToast(res.error || 'تعذر تحرير الجزء', 'err');
        }
      } catch {
        showToast('تعذر الاتصال بالخادم لتنفيذ إجراء المشرف', 'err');
      }
    } else if (actionType === 'reset-all') {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'reset-all', undefined, activeRoomId);
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast('تمت إعادة ضبط الختمة وبدء دورة جديدة');
        } else {
          showToast(res.error || 'تعذر إعادة الضبط، تحقق من صلاحية المشرف', 'err');
        }
      } catch {
        showToast('تعذر الاتصال بالخادم لإعادة الضبط', 'err');
      }
    } else if (actionType === 'delete-room') {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'delete-room', undefined, activeRoomId);
        if (res.success && res.deleted) {
          safeLocalStorage.removeItem(ADMIN_KEY_STORAGE);
          safeLocalStorage.removeItem(CLAIM_TOKENS_KEY);
          showToast('تم حذف الغرفة الخاصة بنجاح');
          handleSelectRoom('public');
        } else {
          showToast(res.error || 'تعذر حذف الغرفة', 'err');
        }
      } catch {
        showToast('تعذر الاتصال بالخادم لحذف الغرفة', 'err');
      }
    }
  };

  const getKhatmaShareUrl = () => {
    const base = `${window.location.origin}/?tab=khatma`;
    return activeRoomId === 'public' ? base : `${base}&khatma=${encodeURIComponent(activeRoomId)}`;
  };

  const getKhatmaAdminSecretUrl = (roomId: string, adminKey: string) =>
    `${window.location.origin}/?tab=khatma&khatma=${encodeURIComponent(roomId)}&adminKey=${encodeURIComponent(adminKey)}`;

  const handleOpenWhatsAppReminderModal = (part: PartClaim) => {
    const shareUrl = getKhatmaShareUrl();
    const msg = `السلام عليكم ورحمة الله وبركاته 🌸\nنذكركم بوردكم في الختمة الجماعية (${part.juzName}: ${part.surahsCovered}) بنية: "${dedicationTitle}".\n\nيمكنكم تأكيد إتمام القراءة عبر الرابط المباشر:\n${shareUrl}`;
    setWhatsAppModalConfig({
      isOpen: true,
      title: `تذكير عبر واتساب — ${part.juzName}`,
      message: msg,
      whatsAppUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
    });
  };

  const handleOpenWhatsAppBroadcastModal = () => {
    const remainingCount = 30 - claimedCount;
    const shareUrl = getKhatmaShareUrl();
    const msg = `قال تعالى: ﴿وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ﴾ 📖\n\nندعوكم للمشاركة في الختمة الجماعية:\n"${dedicationTitle}"\n\nنسبة الإنجاز: ${progressPercent}% (${completedCount} أجزاء مكتملة) · متبقي ${remainingCount} جزءاً متاحاً.\n\nالرابط المباشر للختمة:\n${shareUrl}`;
    setWhatsAppModalConfig({
      isOpen: true,
      title: 'دعوة ومتابعة الختمة عبر واتساب',
      message: msg,
      whatsAppUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
    });
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(getKhatmaShareUrl());
    if (ok) {
      setCopiedLink(true);
      showToast('تم نسخ رابط الغرفة المباشر');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSaveDedication = async () => {
    const prevTitle = dedicationTitle;
    const prevCreator = creatorName;
    const prevDays = deadlineDays;
    const trimmedTitle = tempTitleInput.trim() || dedicationTitle;
    const trimmedCreator = tempCreatorInput.trim() || creatorName;
    const safeDays = Math.min(365, Math.max(1, Math.round(Number(tempDeadlineInput) || deadlineDays)));

    setDedicationTitle(trimmedTitle);
    setCreatorName(trimmedCreator);
    setDeadlineDays(safeDays);
    setIsDedicationModalOpen(false);

    try {
      const res = await executeAdminActionApi(
        adminSessionKey,
        'update-dedication',
        { dedicationTitle: trimmedTitle, creatorName: trimmedCreator, deadlineDays: safeDays },
        activeRoomId
      );
      if (res.success) {
        showToast('تم تحديث بيانات الختمة ومزامنتها');
      } else {
        setDedicationTitle(prevTitle);
        setCreatorName(prevCreator);
        setDeadlineDays(prevDays);
        showToast(res.error || 'تعذر حفظ التعديلات', 'err');
      }
    } catch {
      setDedicationTitle(prevTitle);
      setCreatorName(prevCreator);
      setDeadlineDays(prevDays);
      showToast('تعذر الاتصال بالخادم لحفظ التعديل', 'err');
    }
  };

  const filteredParts = parts.filter((p) => {
    if (filter === 'available') return p.claimedBy === null;
    if (filter === 'claimed') return p.claimedBy !== null && !p.isCompleted;
    if (filter === 'completed') return p.isCompleted;
    return true;
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm border ${
            toastMessage.type === 'err'
              ? 'bg-rose-950 border-rose-500/50 text-rose-100'
              : 'bg-[#10161f] border-[#d9b45a]/50 text-[#f6efdd]'
          }`}
        >
          {toastMessage.type === 'err' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-[#d9b45a] shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Room Switcher & Create Unlisted Private Khatma */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-300">المجلس الحالي:</span>
          <select
            aria-label="اختيار غرفة الختمة"
            value={activeRoomId}
            onChange={(e) => handleSelectRoom(e.target.value)}
            className="min-h-[40px] py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-[#e9e3d3] outline-none focus:border-[#d9b45a] cursor-pointer"
          >
            {roomsList.map((r) => (
              <option key={r.roomId} value={r.roomId}>
                الختمة العامة — {r.dedicationTitle.slice(0, 36)} ({toArabicIndic(r.completedCount)}/٣٠)
              </option>
            ))}
            {activeRoomId !== 'public' && (
              <option value={activeRoomId}>ختمة خاصة غير مدرجة ({activeRoomId.slice(0, 12)})</option>
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateRoomError(null);
            setIsCreateRoomOpen(true);
          }}
          className="min-h-[40px] py-2 px-4 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إنشاء ختمة عائلية خاصة</span>
        </button>
      </div>

      {roomLoadError && (
        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{roomLoadError}</span>
          </div>
          {activeRoomId !== 'public' && (
            <button
              type="button"
              onClick={() => handleSelectRoom('public')}
              className="py-1.5 px-3 rounded-lg bg-slate-900 text-white text-xs hover:bg-slate-800 cursor-pointer"
            >
              العودة للختمة العامة
            </button>
          )}
        </div>
      )}

      {/* Hero Dedication Card */}
      <div className="rounded-3xl bg-[#151e2b] border border-slate-800 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="font-medium text-[#d9b45a]">
                {isPublicRoom ? 'ختمة جماعية عامة' : 'ختمة خاصة (رابط سري غير مدرج)'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300">
                {isSyncing ? 'جارٍ التحديث...' : isOnline ? 'متصل بالمزامنة' : 'محفوظ محلياً'}
              </span>
              {isAdminMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#d9b45a] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>وضع المشرف</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#f6efdd] font-kufi">
                {dedicationTitle}
              </h1>
              {isAdminMode && (
                <button
                  type="button"
                  onClick={() => {
                    setTempTitleInput(dedicationTitle);
                    setTempCreatorInput(creatorName);
                    setTempDeadlineInput(deadlineDays);
                    setIsDedicationModalOpen(true);
                  }}
                  aria-label="تعديل نية الختمة"
                  className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>المنشئ: {creatorName}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-[#d9b45a]" />
                <span>المدة المستهدفة: {deadlineDays} أيام</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsAppBroadcastModal}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span>دعوة عبر واتساب</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#d9b45a]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ' : 'نسخ رابط الغرفة'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdminToggle}
              className={`min-h-[40px] py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                isAdminMode
                  ? 'bg-[#d9b45a] text-[#1b1a17] border-[#d9b45a]'
                  : 'bg-slate-950/70 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
            >
              {isAdminMode ? <Lock className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
              <span>{isAdminMode ? 'خروج المشرف' : 'مفتاح المشرف'}</span>
            </button>

            {isAdminMode && (
              <>
                <button
                  type="button"
                  onClick={handleRotateAdminKey}
                  aria-label="تجديد مفتاح المشرف السري"
                  title="تجديد الرابط السري للمشرف"
                  className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#d9b45a]/40 text-[#d9b45a] transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenConfirmModal('reset-all')}
                  className="min-h-[40px] py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط</span>
                </button>
                {!isPublicRoom && (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirmModal('delete-room')}
                    aria-label="حذف الغرفة الخاصة"
                    className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Khatma Ring Visual Emblem + Summary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div className="flex justify-center">
          <KhatmaRing
            parts={parts}
            onSelectJuz={(juzNum) => {
              const target = parts.find((p) => p.juzNumber === juzNum);
              if (!target) return;
              if (target.claimedBy === null) {
                setClaimModalJuz(juzNum);
                setClaimNameInput('');
              } else if (onNavigateToJuz) {
                onNavigateToJuz(juzNum);
              }
            }}
          />
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-200 font-semibold">تقدم الختمة الجماعية</span>
              <span className="font-mono tabular-nums text-[#d9b45a] font-bold text-base">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-[#d9b45a] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-300">
              يتم تأمين كل حجز بمفتاح سري يُحفظ في متصفحك لإتمام القراءة أو الاعتذار لاحقاً.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
            <div className="text-center p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-200">{30 - claimedCount}</div>
              <div className="text-xs text-slate-400 mt-1">شاغر للحجز</div>
            </div>
            <div className="text-center p-3 rounded-2xl bg-slate-950/60 border border-[#2e5499]/40">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#648cd4]">{claimedCount - completedCount}</div>
              <div className="text-xs text-slate-300 mt-1">قيد القراءة</div>
            </div>
            <div className="text-center p-3 rounded-2xl bg-slate-950/60 border border-[#d9b45a]/40">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#d9b45a]">{completedCount}</div>
              <div className="text-xs text-slate-300 mt-1">مكتمل</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
          {[
            { id: 'all', label: 'كافة الأجزاء (30)' },
            { id: 'available', label: `المتاحة (${30 - claimedCount})` },
            { id: 'claimed', label: `قيد القراءة (${claimedCount - completedCount})` },
            { id: 'completed', label: `المكتملة (${completedCount})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id as typeof filter)}
              className={`min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === t.id
                  ? 'bg-[#1f3a6e] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 30 Juz Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredParts.map((part) => {
          const isClaimed = part.claimedBy !== null;
          const isDone = part.isCompleted;
          const canManageThisPart = Boolean(claimTokens[String(part.juzNumber)] || isAdminMode);

          return (
            <div
              key={part.juzNumber}
              className={`p-4 rounded-2xl border transition-colors ${
                isDone
                  ? 'bg-[#1b1a14] border-[#d9b45a]/45'
                  : isClaimed
                  ? 'bg-slate-900/95 border-[#2e5499]/50'
                  : 'bg-slate-900/75 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#1f3a6e]/40 text-[#f6efdd] font-semibold text-xs flex items-center justify-center font-mono tabular-nums border border-[#2e5499]/50">
                      {toArabicIndic(part.juzNumber)}
                    </span>
                    <h3 className="font-bold text-sm text-white">{part.juzName}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{part.surahsCovered}</p>
                </div>

                {/* Unboxed typographic status label */}
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    isDone ? 'text-[#d9b45a]' : isClaimed ? 'text-[#648cd4]' : 'text-slate-400'
                  }`}
                >
                  {isDone ? 'مكتمل ✓' : isClaimed ? 'محجوز' : 'شاغر'}
                </span>
              </div>

              <div className="my-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs min-h-[32px]">
                {isClaimed ? (
                  editingJuz === part.juzNumber ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editingNameInput}
                        onChange={(e) => setEditingNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditName(part.juzNumber);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-[#d9b45a] rounded-lg text-xs text-white outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label="حفظ اسم القارئ"
                        onClick={() => handleSaveEditName(part.juzNumber)}
                        className="min-h-[34px] min-w-[34px] p-1.5 bg-[#1f3a6e] hover:bg-[#274888] text-white rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserCheck className="w-3.5 h-3.5 text-[#d9b45a] shrink-0" />
                        <span className="font-semibold text-slate-100 truncate">{part.claimedBy}</span>
                        {part.claimedAt && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            · {formatRelativeTime(part.claimedAt)}
                          </span>
                        )}
                      </div>

                      {isAdminMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingJuz(part.juzNumber);
                            setEditingNameInput(part.claimedBy || '');
                          }}
                          aria-label="تعديل اسم القارئ"
                          className="min-h-[32px] min-w-[32px] p-1 text-slate-400 hover:text-[#d9b45a] flex items-center justify-center cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <span className="text-slate-400 text-xs">لا يوجد قارئ مسجل بعد</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
                {!isClaimed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setClaimModalJuz(part.juzNumber);
                      setClaimNameInput('');
                    }}
                    className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>احجز هذا الجزء</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(part.juzNumber)}
                      disabled={!canManageThisPart}
                      title={
                        canManageThisPart
                          ? 'تحديث حالة الإتمام'
                          : 'متاح لصاحب الحجز (من متصفحه) أو المشرف'
                      }
                      className={`flex-1 min-h-[40px] py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        !canManageThisPart
                          ? 'bg-slate-800/60 text-slate-400 cursor-not-allowed'
                          : isDone
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                          : 'bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] cursor-pointer'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isDone ? 'إلغاء الإتمام' : 'تمت القراءة'}</span>
                    </button>

                    {canManageThisPart && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenConfirmModal(isAdminMode ? 'admin-release' : 'withdraw', part.juzNumber)
                        }
                        aria-label={`إخلاء الجزء ${part.juzNumber}`}
                        title={isAdminMode ? 'إخلاء الجزء (المشرف)' : 'الاعتذار والانسحاب'}
                        className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        {isAdminMode ? <X className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppReminderModal(part)}
                      aria-label={`تذكير قارئ الجزء ${part.juzNumber} عبر واتساب`}
                      className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </>
                )}

                {onNavigateToJuz && (
                  <button
                    type="button"
                    onClick={() => onNavigateToJuz(part.juzNumber)}
                    aria-label={`قراءة الجزء ${part.juzNumber} في المصحف`}
                    className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim Modal */}
      {claimModalJuz !== null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-[#d9b45a] font-bold">
                <BookOpen className="w-4 h-4" />
                <h3 className="text-base text-white">حجز قراءة الجزء {claimModalJuz}</h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setClaimModalJuz(null)}
                className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              اكتب اسمك لحجز هذا الجزء. سيحفظ هذا المتصفح مفتاحاً خاصاً لتمكينك وحدك من تأكيد إتمام القراءة أو الاعتذار لاحقاً.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-200 block mb-1.5">اسم القارئ:</label>
              <input
                type="text"
                value={claimNameInput}
                onChange={(e) => setClaimNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmClaim();
                }}
                placeholder="مثال: محمد، أم أحمد، فاعل خير..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-sm text-white outline-none"
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClaimModalJuz(null)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmClaim}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد الحجز</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              {confirmModalConfig.message}
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs cursor-pointer"
              >
                تأكيد الإجراء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Share Modal */}
      {whatsAppModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-[#d9b45a] font-bold">
                <MessageCircle className="w-5 h-5" />
                <h3 className="text-base text-white">{whatsAppModalConfig.title}</h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
              {whatsAppModalConfig.message}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(whatsAppModalConfig.message);
                  showToast('تم نسخ نص الرسالة');
                }}
                className="min-h-[40px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ النص</span>
              </button>
              <a
                href={whatsAppModalConfig.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>فتح واتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dedication Modal */}
      {isDedicationModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">تعديل نية الختمة</h3>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setIsDedicationModalOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">عنوان ونية الختمة:</label>
                <input
                  type="text"
                  value={tempTitleInput}
                  onChange={(e) => setTempTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">اسم المنشئ:</label>
                <input
                  type="text"
                  value={tempCreatorInput}
                  onChange={(e) => setTempCreatorInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">المدة المستهدفة (أيام):</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={tempDeadlineInput}
                  onChange={(e) => setTempDeadlineInput(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-sm text-white outline-none font-mono"
                />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDedicationModalOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveDedication}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Admin Key Unlock Modal (Replaces insecure PIN 1234 prompt) */}
      {isAdminUnlockOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-[#d9b45a]/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-[#d9b45a] font-bold">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base text-white">صلاحية مشرف الغرفة</h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setIsAdminUnlockOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ألصق مفتاح المشرف السري (128-bit) أو رابط المشرف الكامل لفتح صلاحيات تعديل الأسماء وإدارة الأجزاء.
            </p>

            {adminUnlockError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{adminUnlockError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-200 block mb-1.5">المفتاح السري أو رابط المشرف:</label>
              <input
                type="password"
                dir="ltr"
                value={adminKeyInput}
                onChange={(e) => {
                  setAdminKeyInput(e.target.value);
                  if (adminUnlockError) setAdminUnlockError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyAdminKey();
                }}
                placeholder="ألصق المفتاح أو الرابط السري هنا..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-sm text-white outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdminUnlockOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleVerifyAdminKey}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تفعيل صلاحية المشرف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Supervisor Link Created / Rotated Notice Modal */}
      {createdAdminInfo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-[#d9b45a]/50 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-[#d9b45a] font-bold">
                <Key className="w-5 h-5" />
                <h3 className="text-base text-white">احفظ رابط المشرف السري للختمة</h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setCreatedAdminInfo(null)}
                className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              تم إنشاء الغرفة «{createdAdminInfo.title}» وتأمينها بمفتاح سري عشوائي. يُحفظ هذا الرابط في متصفحك تلقائياً، ولكن يُنصح بنسخه وحفظه لإدارة الغرفة من أي جهاز آخر دون مشاركته مع القراء.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-300">١. رابط المشاركة العام للقراء:</div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 text-[11px] text-slate-300 truncate bg-slate-900 px-2.5 py-2 rounded-lg">
                    {getKhatmaShareUrl()}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold cursor-pointer shrink-0"
                  >
                    نسخ
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-[#d9b45a]/40 space-y-2">
                <div className="font-semibold text-[#d9b45a]">٢. رابط المشرف السري (لك فقط):</div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 text-[11px] text-[#f6efdd] truncate bg-slate-900 px-2.5 py-2 rounded-lg">
                    {getKhatmaAdminSecretUrl(createdAdminInfo.roomId, createdAdminInfo.adminKey)}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(
                        getKhatmaAdminSecretUrl(createdAdminInfo.roomId, createdAdminInfo.adminKey)
                      );
                      if (ok) showToast('تم نسخ رابط المشرف السري');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] font-bold cursor-pointer shrink-0"
                  >
                    نسخ السري
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedAdminInfo(null)}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                تم الحفظ والمتابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Unlisted Private Khatma Modal (No weak PIN input required — 128-bit link issued cleanly) */}
      {isCreateRoomOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-[#d9b45a] font-bold text-sm">
                <Users className="w-4 h-4" />
                <span>إنشاء ختمة خاصة غير مدرجة</span>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setIsCreateRoomOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              لن تظهر الغرفة الخاصة في القوائم العامة، ولا يمكن الوصول إليها إلا عبر رابطها العشوائي الآمن، مع توليد مفتاح مشرف سري تلقائياً.
            </p>

            {createRoomError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createRoomError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">نية وعنوان الختمة:</label>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="مثال: ختمة عائلة آل فلان"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">اسم المنشئ:</label>
                  <input
                    type="text"
                    value={newRoomCreator}
                    onChange={(e) => setNewRoomCreator(e.target.value)}
                    placeholder="أبو عبد الله"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-white outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">المدة (أيام):</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={newRoomDays}
                    onChange={(e) => setNewRoomDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">معرّف مخصص (اختياري بالإنجليزية، 6+ أحرف):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newRoomSlug}
                  onChange={(e) => setNewRoomSlug(e.target.value)}
                  placeholder="يترك فارغاً لتوليد رابط عشوائي سري (موصى به)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#d9b45a] text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreatingRoom}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingRoom ? 'جارٍ الإنشاء...' : 'إنشاء الغرفة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
