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
  sanitizeLocalKhatmaParts,
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
import { KhatmaRing } from './khatma/KhatmaRing';
import { PersonalKhatmaTracker } from './khatma/PersonalKhatmaTracker';
import { loadPersonalKhatmaPlan, PERSONAL_KHATMA_EVENT } from '../utils/personalKhatma';
import { AppLanguage, formatLocalizedDigits, getJuzLabel, useLanguage } from '../utils/i18n';

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

const DEFAULT_JUZ_SURAS_EN: Record<number, string> = {
  1: 'Al-Fatihah 1 – Al-Baqarah 141',
  2: 'Al-Baqarah 142 – Al-Baqarah 252',
  3: 'Al-Baqarah 253 – Aal-Imran 92',
  4: 'Aal-Imran 93 – An-Nisa 23',
  5: 'An-Nisa 24 – An-Nisa 147',
  6: "An-Nisa 148 – Al-Ma'idah 81",
  7: "Al-Ma'idah 82 – Al-An'am 110",
  8: "Al-An'am 111 – Al-A'raf 87",
  9: "Al-A'raf 88 – Al-Anfal 40",
  10: 'Al-Anfal 41 – At-Tawbah 92',
  11: 'At-Tawbah 93 – Hud 5',
  12: 'Hud 6 – Yusuf 52',
  13: 'Yusuf 53 – Ibrahim 52',
  14: 'Al-Hijr 1 – An-Nahl 128',
  15: 'Al-Isra 1 – Al-Kahf 74',
  16: 'Al-Kahf 75 – Ta-Ha 135',
  17: 'Al-Anbiya 1 – Al-Hajj 78',
  18: "Al-Mu'minun 1 – Al-Furqan 20",
  19: 'Al-Furqan 21 – An-Naml 55',
  20: 'An-Naml 56 – Al-Ankabut 45',
  21: 'Al-Ankabut 46 – Al-Ahzab 30',
  22: 'Al-Ahzab 31 – Ya-Sin 27',
  23: 'Ya-Sin 28 – Az-Zumar 31',
  24: 'Az-Zumar 32 – Fussilat 46',
  25: 'Fussilat 47 – Al-Jathiyah 37',
  26: 'Al-Ahqaf 1 – Adh-Dhariyat 30',
  27: 'Adh-Dhariyat 31 – Al-Hadid 29',
  28: 'Al-Mujadila 1 – At-Tahrim 12',
  29: 'Al-Mulk 1 – Al-Mursalat 50',
  30: "An-Naba' 1 – An-Nas 6 (Juz 'Amma)",
};

function formatRelativeTime(dateStr?: string, lang: AppLanguage = 'ar'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (lang === 'en') {
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  }

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
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => void;
  onOpenPersonalPlanner?: () => void;
}

export const CollectiveKhatma: React.FC<CollectiveKhatmaProps> = ({
  onNavigateToJuz,
  onNavigateToAyah,
  onOpenPersonalPlanner,
}) => {
  const { lang, isEnglish, t } = useLanguage();
  const [khatmaSubTab, setKhatmaSubTab] = useState<'personal' | 'collective'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('khatma')) return 'collective';
    }
    return loadPersonalKhatmaPlan() ? 'personal' : 'collective';
  });

  useEffect(() => {
    const onPlanEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        setKhatmaSubTab('personal');
      }
    };
    window.addEventListener(PERSONAL_KHATMA_EVENT, onPlanEvent);
    return () => window.removeEventListener(PERSONAL_KHATMA_EVENT, onPlanEvent);
  }, []);

  const [activeRoomId, setActiveRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('khatma');
      if (r && /^[a-zA-Z0-9_-]{2,64}$/.test(r)) return r.toLowerCase();
    }
    return 'public';
  });
  const activeRoomIdRef = useRef<string>(activeRoomId);
  activeRoomIdRef.current = activeRoomId;

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

  // Load claimTokens, reset cached room parts, & verify adminKey when switching rooms
  useEffect(() => {
    let cancelled = false;
    setClaimTokens(safeLocalStorage.getJSON<Record<string, string>>(`bayan_khatma_claim_tokens_${activeRoomId}`, {}));
    const savedAdminKey = safeLocalStorage.getItem(`bayan_khatma_admin_key_${activeRoomId}`) || '';

    const cachedRoom = safeLocalStorage.getJSON<{ parts?: PartClaim[]; dedicationTitle?: string; creatorName?: string; deadlineDays?: number } | null>(
      `bayan_collective_khatma_v2_${activeRoomId}`,
      null
    );
    const fallbackParts: PartClaim[] = Array.from({ length: 30 }, (_, i) => {
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
    if (cachedRoom?.parts && Array.isArray(cachedRoom.parts)) {
      setParts(sanitizeLocalKhatmaParts(cachedRoom.parts, fallbackParts));
      if (typeof cachedRoom.dedicationTitle === 'string' && cachedRoom.dedicationTitle.trim()) {
        setDedicationTitle(cachedRoom.dedicationTitle);
      }
      if (typeof cachedRoom.creatorName === 'string' && cachedRoom.creatorName.trim()) {
        setCreatorName(cachedRoom.creatorName);
      }
      if (typeof cachedRoom.deadlineDays === 'number' && Number.isFinite(cachedRoom.deadlineDays)) {
        setDeadlineDays(cachedRoom.deadlineDays);
      }
    } else {
      setParts(fallbackParts);
    }

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
            if (!cancelled && res.success && res.verified) {
              setAdminSessionKey(cleanKey);
              setIsAdminMode(true);
              showToast(
                t(
                  'تم تفعيل صلاحيات مشرف الغرفة عبر الرابط السري',
                  'Room admin permissions activated via secret link'
                )
              );
            }
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }
    }

    setAdminSessionKey(savedAdminKey);
    if (savedAdminKey && savedAdminKey.trim().length >= 8) {
      verifyAdminKeyApi(savedAdminKey, activeRoomId)
        .then((res) => {
          if (!cancelled) {
            setIsAdminMode(Boolean(res.success && res.verified));
          }
        })
        .catch(() => {});
    } else {
      setIsAdminMode(false);
    }

    return () => {
      cancelled = true;
    };
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
    const fallback = generateInitialParts();
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.parts)) {
          return sanitizeLocalKhatmaParts(parsed.parts, fallback);
        }
      } catch {
        // fallback
      }
    }
    return fallback;
  });

  const syncWithServer = useCallback(async (silent = true, targetRoom = activeRoomId) => {
    try {
      if (!silent) setIsSyncing(true);
      setRoomLoadError(null);
      const data = await fetchKhatmaState(targetRoom);
      if (targetRoom !== activeRoomIdRef.current) return;
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
      if (targetRoom !== activeRoomIdRef.current) return;
      setIsOnline(false);
      if (!silent) {
        setRoomLoadError(
          err instanceof Error
            ? err.message
            : t('تعذر تحميل بيانات الغرفة', 'Unable to load room data')
        );
      }
    } finally {
      if (targetRoom === activeRoomIdRef.current) {
        setIsSyncing(false);
      }
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
        setCreateRoomError(
          res.error || t('تعذر إنشاء الختمة الخاصة', 'Unable to create private Khatma')
        );
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
      setCreateRoomError(
        t('تعذر الاتصال بالخادم لإنشاء الختمة', 'Could not reach server to create the Khatma')
      );
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
    const trimmed = claimNameInput.trim() || t('قارئ محب للخير', 'Kind Reader');
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
        showToast(
          t(
            `حُجز الجزء ${targetJuz} باسم ${trimmed}`,
            `Juz ${targetJuz} reserved for ${trimmed}`
          )
        );
      } else {
        if (res.parts) setParts(res.parts);
        showToast(
          res.error || t(`تعذر حجز الجزء ${targetJuz}`, `Could not reserve Juz ${targetJuz}`),
          'err'
        );
      }
    } catch {
      showToast(
        t('تعذر الاتصال بالخادم لتسجيل الحجز', 'Could not connect to server to save reservation'),
        'err'
      );
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
          showToast(
            t(
              `هنيئاً لك! تم إتمام قراءة الجزء ${juzNumber}`,
              `MashaAllah! Completed reading Juz ${juzNumber}`
            )
          );
        }
      } else {
        setParts(res.parts || previousParts);
        showToast(
          res.error ||
            t('غير مصرح بتحديث حالة هذا الجزء', 'Not authorized to update this Juz'),
          'err'
        );
      }
    } catch {
      setParts(previousParts);
      showToast(
        t('تعذر الاتصال بالخادم لتحديث الجزء', 'Could not connect to server to update Juz'),
        'err'
      );
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
        showToast(
          t(
            `تم تحديث اسم القارئ للجزء ${juzNumber} إلى: ${trimmed}`,
            `Updated Juz ${juzNumber} reader to: ${trimmed}`
          )
        );
      } else {
        setParts(res.parts || previousParts);
        showToast(
          res.error ||
            t('تعذر تعديل الاسم — تحقق من صلاحية المشرف', 'Could not update name — check admin key'),
          'err'
        );
      }
    } catch {
      setParts(previousParts);
      showToast(
        t('تعذر الاتصال بالخادم لتعديل الاسم', 'Could not connect to server to update name'),
        'err'
      );
    }
  };

  const handleOpenAdminToggle = async () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      showToast(t('تم الخروج من وضع المشرف', 'Exited admin mode'));
      return;
    }

    // If browser already holds saved secret adminKey for this room, verify automatically
    if (adminSessionKey) {
      try {
        const res = await verifyAdminKeyApi(adminSessionKey, activeRoomId);
        if (res.success && res.verified) {
          setIsAdminMode(true);
          showToast(t('تم تفعيل وضع المشرف', 'Admin mode activated'));
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
      setAdminUnlockError(
        t('يرجى لصق مفتاح أو رابط المشرف السري', 'Please paste the secret admin key or link')
      );
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
        showToast(t('تم التحقق وتفعيل صلاحيات المشرف', 'Verified and enabled admin permissions'));
      } else {
        setAdminUnlockError(
          res.error || t('مفتاح المشرف السري غير صحيح', 'Invalid secret admin key')
        );
      }
    } catch {
      setAdminUnlockError(
        t('تعذر الاتصال بالخادم للتحقق من المفتاح', 'Could not connect to server to verify key')
      );
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
        showToast(res.error || t('تعذر تجديد مفتاح المشرف', 'Could not rotate admin key'), 'err');
      }
    } catch {
      showToast(
        t('تعذر الاتصال بالخادم لتدوير المفتاح', 'Could not connect to server to rotate key'),
        'err'
      );
    }
  };

  const handleOpenConfirmModal = (
    actionType: 'withdraw' | 'admin-release' | 'reset-all' | 'delete-room',
    targetJuz?: number
  ) => {
    if (actionType === 'withdraw') {
      setConfirmModalConfig({
        isOpen: true,
        title: t('الاعتذار والانسحاب من القراءة', 'Release & Withdraw'),
        message: t(
          `هل ترغب في الاعتذار عن قراءة الجزء ${targetJuz}؟ سيتم إخلاء الجزء فوراً ليتمكن مشارك آخر من حجزه.`,
          `Release Juz ${targetJuz}? It will become immediately available for another participant to claim.`
        ),
        actionType,
        targetJuz,
      });
    } else if (actionType === 'admin-release') {
      setConfirmModalConfig({
        isOpen: true,
        title: t('إخلاء الجزء (إجراء المشرف)', 'Release Juz (Admin Action)'),
        message: t(
          `هل تريد تحرير الجزء ${targetJuz} وإعادة طرحه شاغراً للمشاركين؟`,
          `Make Juz ${targetJuz} available for participants again?`
        ),
        actionType,
        targetJuz,
      });
    } else if (actionType === 'delete-room') {
      setConfirmModalConfig({
        isOpen: true,
        title: t('حذف هذه الغرفة الخاصة نهائياً', 'Permanently Delete Private Room'),
        message: t(
          'سيتم حذف غرفة الختمة الخاصة وجميع بياناتها من الخادم نهائياً. هل أنت متأكد؟',
          'This private Khatma room and all its data will be permanently deleted. Are you sure?'
        ),
        actionType,
      });
    } else {
      setConfirmModalConfig({
        isOpen: true,
        title: t('إعادة ضبط وبدء ختمة جديدة', 'Reset & Start a New Khatma'),
        message: t(
          'سيتم تفريغ كافة حجوزات الأجزاء الـ 30 وإعادة الختمة إلى نقطة البداية لجميع المشاركين.',
          'All 30 Juz reservations will be cleared and the Khatma will reset to the start for everyone.'
        ),
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
          showToast(
            t(`تم إخلاء الجزء ${targetJuz} وإتاحته للجميع`, `Juz ${targetJuz} released and now available`)
          );
        } else {
          setParts(res.parts || previousParts);
          showToast(
            res.error ||
              t(
                'تفريغ الجزء متاح لصاحب الحجز أو المشرف فقط',
                'Only the claimer or room admin can release this Juz'
              ),
            'err'
          );
        }
      } catch {
        setParts(previousParts);
        showToast(
          t('تعذر الاتصال بالخادم لتحرير الجزء', 'Could not connect to server to release Juz'),
          'err'
        );
      }
    } else if (actionType === 'admin-release' && targetJuz) {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'release-part', { targetJuz }, activeRoomId);
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast(
            t(`تم تحرير الجزء ${targetJuz} من قبل المشرف`, `Juz ${targetJuz} released by admin`)
          );
        } else {
          showToast(res.error || t('تعذر تحرير الجزء', 'Could not release Juz'), 'err');
        }
      } catch {
        showToast(
          t('تعذر الاتصال بالخادم لتنفيذ إجراء المشرف', 'Could not connect to server for admin action'),
          'err'
        );
      }
    } else if (actionType === 'reset-all') {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'reset-all', undefined, activeRoomId);
        if (res.success && res.parts) {
          setParts(res.parts);
          showToast(t('تمت إعادة ضبط الختمة وبدء دورة جديدة', 'Khatma reset for a new cycle'));
        } else {
          showToast(
            res.error ||
              t('تعذر إعادة الضبط، تحقق من صلاحية المشرف', 'Could not reset — check admin key'),
            'err'
          );
        }
      } catch {
        showToast(
          t('تعذر الاتصال بالخادم لإعادة الضبط', 'Could not connect to server to reset'),
          'err'
        );
      }
    } else if (actionType === 'delete-room') {
      try {
        const res = await executeAdminActionApi(adminSessionKey, 'delete-room', undefined, activeRoomId);
        if (res.success && res.deleted) {
          safeLocalStorage.removeItem(ADMIN_KEY_STORAGE);
          safeLocalStorage.removeItem(CLAIM_TOKENS_KEY);
          showToast(t('تم حذف الغرفة الخاصة بنجاح', 'Private room deleted'));
          handleSelectRoom('public');
        } else {
          showToast(res.error || t('تعذر حذف الغرفة', 'Could not delete room'), 'err');
        }
      } catch {
        showToast(
          t('تعذر الاتصال بالخادم لحذف الغرفة', 'Could not connect to server to delete room'),
          'err'
        );
      }
    }
  };

  const getKhatmaShareUrl = () => {
    const base = `${window.location.origin}/?tab=khatma`;
    return activeRoomId === 'public' ? base : `${base}&khatma=${encodeURIComponent(activeRoomId)}`;
  };

  const getKhatmaAdminSecretUrl = (roomId: string, adminKey: string) =>
    `${window.location.origin}/?tab=khatma&khatma=${encodeURIComponent(roomId)}&adminKey=${encodeURIComponent(adminKey)}`;

  const displayDedicationTitle =
    isEnglish && dedicationTitle === 'ختمة البر والصدقة الجارية لجميع موتى المسلمين'
      ? 'Charitable Collective Khatma (Sadaqah Jariyah)'
      : dedicationTitle;

  const displayCreatorName =
    isEnglish && creatorName === 'فاعل خير' ? 'Well-Wisher' : creatorName;

  const handleOpenWhatsAppReminderModal = (part: PartClaim) => {
    const shareUrl = getKhatmaShareUrl();
    const juzTitle = getJuzLabel(part.juzNumber, lang);
    const surahsLabel = isEnglish
      ? DEFAULT_JUZ_SURAS_EN[part.juzNumber] || part.surahsCovered
      : part.surahsCovered;
    const msg = isEnglish
      ? `As-salamu alaykum 🌸\nFriendly reminder for your Wird in the Collective Khatma (${juzTitle}: ${surahsLabel}) dedicated to: "${displayDedicationTitle}".\n\nConfirm completion directly here:\n${shareUrl}`
      : `السلام عليكم ورحمة الله وبركاته 🌸\nنذكركم بوردكم في الختمة الجماعية (${part.juzName}: ${part.surahsCovered}) بنية: "${dedicationTitle}".\n\nيمكنكم تأكيد إتمام القراءة عبر الرابط المباشر:\n${shareUrl}`;
    setWhatsAppModalConfig({
      isOpen: true,
      title: t(`تذكير عبر واتساب — ${part.juzName}`, `WhatsApp Reminder — ${juzTitle}`),
      message: msg,
      whatsAppUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
    });
  };

  const handleOpenWhatsAppBroadcastModal = () => {
    const remainingCount = 30 - claimedCount;
    const shareUrl = getKhatmaShareUrl();
    const msg = isEnglish
      ? `“And for this let the competitors compete.” (Qur'an 83:26) 📖\n\nJoin our Collective Khatma:\n"${displayDedicationTitle}"\n\nProgress: ${progressPercent}% (${completedCount} Juz completed) · ${remainingCount} Juz still available.\n\nDirect link:\n${shareUrl}`
      : `قال تعالى: ﴿وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ﴾ 📖\n\nندعوكم للمشاركة في الختمة الجماعية:\n"${dedicationTitle}"\n\nنسبة الإنجاز: ${progressPercent}% (${completedCount} أجزاء مكتملة) · متبقي ${remainingCount} جزءاً متاحاً.\n\nالرابط المباشر للختمة:\n${shareUrl}`;
    setWhatsAppModalConfig({
      isOpen: true,
      title: t('دعوة ومتابعة الختمة عبر واتساب', 'Invite & Share Khatma on WhatsApp'),
      message: msg,
      whatsAppUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
    });
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(getKhatmaShareUrl());
    if (ok) {
      setCopiedLink(true);
      showToast(t('تم نسخ رابط الغرفة المباشر', 'Room link copied'));
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
        showToast(t('تم تحديث بيانات الختمة ومزامنتها', 'Khatma details updated and synced'));
      } else {
        setDedicationTitle(prevTitle);
        setCreatorName(prevCreator);
        setDeadlineDays(prevDays);
        showToast(res.error || t('تعذر حفظ التعديلات', 'Could not save changes'), 'err');
      }
    } catch {
      setDedicationTitle(prevTitle);
      setCreatorName(prevCreator);
      setDeadlineDays(prevDays);
      showToast(
        t('تعذر الاتصال بالخادم لحفظ التعديل', 'Could not connect to server to save changes'),
        'err'
      );
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
              ? 'bg-rose-50 border-rose-500/50 text-rose-900 dark:bg-rose-950 dark:text-rose-100'
              : 'bg-[#FBF7EE] border-[#8A6418]/45 text-[#1B1A17] dark:bg-[#10161f] dark:border-[#d9b45a]/50 dark:text-[#f6efdd]'
          }`}
        >
          {toastMessage.type === 'err' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-[#8A6418] dark:text-[#d9b45a] shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Sub-view Switcher: Personal Khatma (Local) vs Collective Khatma (Rooms) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div
          role="tablist"
          aria-label={t('نوع الختمة', 'Khatma Type')}
          className="inline-flex items-center p-1 rounded-2xl bg-[#EFE6D1] dark:bg-[#10161f] border border-[#8A6418]/25 dark:border-slate-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={khatmaSubTab === 'personal'}
            onClick={() => setKhatmaSubTab('personal')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              khatmaSubTab === 'personal'
                ? 'bg-[#1f3a6e] text-white border border-[#D9B45A]/50'
                : 'text-[#5C5549] hover:text-[#1B1A17] dark:text-slate-300 dark:hover:text-white border border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#D9B45A]" />
            <span>{t('ختمتي الفردية', 'My Personal Khatma')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={khatmaSubTab === 'collective'}
            onClick={() => setKhatmaSubTab('collective')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              khatmaSubTab === 'collective'
                ? 'bg-[#1f3a6e] text-white border border-[#D9B45A]/50'
                : 'text-[#5C5549] hover:text-[#1B1A17] dark:text-slate-300 dark:hover:text-white border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-[#1F3A6E] dark:text-[#648cd4]" />
            <span>{t('الختمات الجماعية', 'Collective Khatmas')}</span>
          </button>
        </div>
      </div>

      {khatmaSubTab === 'personal' ? (
        <PersonalKhatmaTracker
          onOpenPlanner={() => onOpenPersonalPlanner?.()}
          onNavigateToJuz={onNavigateToJuz}
          onNavigateToAyah={onNavigateToAyah}
        />
      ) : (
        <>
      {/* Room Switcher & Create Unlisted Private Khatma */}
      <div className="p-3.5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900/90 border border-[#8A6418]/25 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#5C5549] dark:text-slate-300">
            {t('المجلس الحالي:', 'Current Room:')}
          </span>
          <select
            aria-label={t('اختيار غرفة الختمة', 'Select Khatma room')}
            value={activeRoomId}
            onChange={(e) => handleSelectRoom(e.target.value)}
            className="min-h-[40px] py-1.5 px-3 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-700 text-xs font-semibold text-[#1B1A17] dark:text-[#e9e3d3] outline-none focus:border-[#8A6418] dark:focus:border-[#d9b45a] cursor-pointer"
          >
            {roomsList.map((r) => {
              const roomTitle =
                isEnglish && r.dedicationTitle === 'ختمة البر والصدقة الجارية لجميع موتى المسلمين'
                  ? 'Charitable Collective Khatma'
                  : r.dedicationTitle.slice(0, 36);
              return (
                <option key={r.roomId} value={r.roomId} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                  {t('الختمة العامة', 'Public Khatma')} — {roomTitle} ({formatLocalizedDigits(r.completedCount, lang)}/{formatLocalizedDigits(30, lang)})
                </option>
              );
            })}
            {activeRoomId !== 'public' && (
              <option value={activeRoomId} className="bg-white text-[#1B1A17] dark:bg-slate-900 dark:text-[#F6EFDD]">
                {t('ختمة خاصة غير مدرجة', 'Unlisted Private Khatma')} ({activeRoomId.slice(0, 12)})
              </option>
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
          <Plus className="w-3.5 h-3.5 text-[#D9B45A]" />
          <span>{t('إنشاء ختمة عائلية خاصة', 'Create Private Family Khatma')}</span>
        </button>
      </div>

      {roomLoadError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/40 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>{roomLoadError}</span>
          </div>
          {activeRoomId !== 'public' && (
            <button
              type="button"
              onClick={() => handleSelectRoom('public')}
              className="py-1.5 px-3 rounded-lg bg-[#1F3A6E] text-white text-xs hover:bg-[#2E5499] cursor-pointer"
            >
              {t('العودة للختمة العامة', 'Back to Public Khatma')}
            </button>
          )}
        </div>
      )}

      {/* Hero Dedication Card */}
      <div className="rounded-3xl bg-[#FBF7EE] dark:bg-[#151e2b] border border-[#8A6418]/25 dark:border-slate-800 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C5549] dark:text-slate-300">
              <span className="font-medium text-[#8A6418] dark:text-[#d9b45a]">
                {isPublicRoom
                  ? t('ختمة جماعية عامة', 'Public Collective Khatma')
                  : t('ختمة خاصة (رابط سري غير مدرج)', 'Private Khatma (Unlisted Secret Link)')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#5C5549] dark:text-slate-300">
                {isSyncing
                  ? t('جارٍ التحديث...', 'Syncing...')
                  : isOnline
                  ? t('متصل بالمزامنة', 'Live synced')
                  : t('محفوظ محلياً', 'Saved locally')}
              </span>
              {isAdminMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#8A6418] dark:text-[#d9b45a] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('وضع المشرف', 'Admin Mode')}</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B1A17] dark:text-[#f6efdd] font-kufi">
                {displayDedicationTitle}
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
                  aria-label={t('تعديل نية الختمة', 'Edit Khatma dedication')}
                  className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-[#EFE6D1] dark:bg-slate-800 hover:bg-[#E4D7BA] dark:hover:bg-slate-700 text-[#1B1A17] dark:text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C5549] dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>
                  {t('المنشئ:', 'Organizer:')} {displayCreatorName}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#d9b45a]" />
                <span>
                  {t('المدة المستهدفة:', 'Target duration:')} {formatLocalizedDigits(deadlineDays, lang)}{' '}
                  {t('أيام', deadlineDays === 1 ? 'day' : 'days')}
                </span>
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
              <span>{t('دعوة عبر واتساب', 'Invite on WhatsApp')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#8A6418]/25 dark:border-slate-700 text-[#1B1A17] dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#8A6418] dark:text-[#d9b45a]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? t('تم النسخ', 'Copied') : t('نسخ رابط الغرفة', 'Copy Room Link')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdminToggle}
              className={`min-h-[40px] py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                isAdminMode
                  ? 'bg-[#d9b45a] text-[#1b1a17] border-[#d9b45a]'
                  : 'bg-[#EFE6D1] dark:bg-slate-950/70 border-[#8A6418]/25 dark:border-slate-700 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white'
              }`}
            >
              {isAdminMode ? <Lock className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
              <span>{isAdminMode ? t('خروج المشرف', 'Exit Admin') : t('مفتاح المشرف', 'Admin Key')}</span>
            </button>

            {isAdminMode && (
              <>
                <button
                  type="button"
                  onClick={handleRotateAdminKey}
                  aria-label={t('تجديد مفتاح المشرف السري', 'Rotate secret admin key')}
                  title={t('تجديد الرابط السري للمشرف', 'Rotate secret admin link')}
                  className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#8A6418]/35 dark:border-[#d9b45a]/40 text-[#8A6418] dark:text-[#d9b45a] transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenConfirmModal('reset-all')}
                  className="min-h-[40px] py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('إعادة ضبط', 'Reset')}</span>
                </button>
                {!isPublicRoom && (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirmModal('delete-room')}
                    aria-label={t('حذف الغرفة الخاصة', 'Delete private room')}
                    className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-500/40 text-rose-700 dark:text-rose-300 transition-colors cursor-pointer flex items-center justify-center"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center p-5 sm:p-6 rounded-3xl bg-[#FBF7EE] dark:bg-slate-900/90 border border-[#8A6418]/25 dark:border-slate-800">
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
              <span className="text-[#1B1A17] dark:text-slate-200 font-semibold">
                {t('تقدم الختمة الجماعية', 'Collective Khatma Progress')}
              </span>
              <span className="font-mono tabular-nums text-[#8A6418] dark:text-[#d9b45a] font-bold text-base">
                {formatLocalizedDigits(progressPercent, lang)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#E5DBBF] dark:bg-slate-950 rounded-full overflow-hidden border border-[#8A6418]/20 dark:border-slate-800">
              <div
                className="h-full bg-[#d9b45a] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-[#5C5549] dark:text-slate-300">
              {t(
                'يتم تأمين كل حجز بمفتاح سري يُحفظ في متصفحك لإتمام القراءة أو الاعتذار لاحقاً.',
                'Each reservation is secured with a private token saved in your browser so you can mark it complete or release it later.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#8A6418]/15 dark:border-slate-800/80">
            <div className="text-center p-3 rounded-2xl bg-[#EFE6D1] dark:bg-slate-950/60 border border-[#8A6418]/20 dark:border-slate-800/80">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#1B1A17] dark:text-slate-200">
                {formatLocalizedDigits(30 - claimedCount, lang)}
              </div>
              <div className="text-xs text-[#5C5549] dark:text-slate-400 mt-1">
                {t('شاغر للحجز', 'Available')}
              </div>
            </div>
            <div className="text-center p-3 rounded-2xl bg-[#EFE6D1] dark:bg-slate-950/60 border border-[#1F3A6E]/25 dark:border-[#2e5499]/40">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#1F3A6E] dark:text-[#648cd4]">
                {formatLocalizedDigits(claimedCount - completedCount, lang)}
              </div>
              <div className="text-xs text-[#5C5549] dark:text-slate-300 mt-1">
                {t('قيد القراءة', 'Reading')}
              </div>
            </div>
            <div className="text-center p-3 rounded-2xl bg-[#EFE6D1] dark:bg-slate-950/60 border border-[#8A6418]/30 dark:border-[#d9b45a]/40">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#8A6418] dark:text-[#d9b45a]">
                {formatLocalizedDigits(completedCount, lang)}
              </div>
              <div className="text-xs text-[#5C5549] dark:text-slate-300 mt-1">
                {t('مكتمل', 'Completed')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-[#EFE6D1] dark:bg-slate-900/90 p-1 rounded-2xl border border-[#8A6418]/20 dark:border-slate-800 overflow-x-auto max-w-full">
          {[
            { id: 'all', label: t('كافة الأجزاء (30)', 'All Parts (30)') },
            {
              id: 'available',
              label: t(
                `المتاحة (${30 - claimedCount})`,
                `Available (${30 - claimedCount})`
              ),
            },
            {
              id: 'claimed',
              label: t(
                `قيد القراءة (${claimedCount - completedCount})`,
                `Reading (${claimedCount - completedCount})`
              ),
            },
            {
              id: 'completed',
              label: t(`المكتملة (${completedCount})`, `Completed (${completedCount})`),
            },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setFilter(tabItem.id as typeof filter)}
              className={`min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === tabItem.id
                  ? 'bg-[#1f3a6e] text-white'
                  : 'text-[#5C5549] hover:text-[#1B1A17] hover:bg-[#E4D7BA] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              {tabItem.label}
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
          const displayJuzTitle = getJuzLabel(part.juzNumber, lang);
          const displaySurahsCovered = isEnglish
            ? DEFAULT_JUZ_SURAS_EN[part.juzNumber] || part.surahsCovered
            : part.surahsCovered;

          return (
            <div
              key={part.juzNumber}
              className={`p-4 rounded-2xl border transition-colors ${
                isDone
                  ? 'bg-[#EFE6D1] dark:bg-[#1b1a14] border-[#8A6418]/45 dark:border-[#d9b45a]/45'
                  : isClaimed
                  ? 'bg-[#FBF7EE] dark:bg-slate-900/95 border-[#1F3A6E]/35 dark:border-[#2e5499]/50'
                  : 'bg-[#FBF7EE] dark:bg-slate-900/75 border-[#8A6418]/20 dark:border-slate-800 hover:border-[#8A6418]/45 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#1F3A6E]/10 dark:bg-[#1f3a6e]/40 text-[#1F3A6E] dark:text-[#f6efdd] font-semibold text-xs flex items-center justify-center font-mono tabular-nums border border-[#1F3A6E]/25 dark:border-[#2e5499]/50">
                      {formatLocalizedDigits(part.juzNumber, lang)}
                    </span>
                    <h3 className="font-bold text-sm text-[#1B1A17] dark:text-white">{displayJuzTitle}</h3>
                  </div>
                  <p className="text-xs text-[#5C5549] dark:text-slate-400 mt-1 line-clamp-1">
                    {displaySurahsCovered}
                  </p>
                </div>

                {/* Unboxed typographic status label */}
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    isDone ? 'text-[#8A6418] dark:text-[#d9b45a]' : isClaimed ? 'text-[#1F3A6E] dark:text-[#648cd4]' : 'text-[#5C5549] dark:text-slate-400'
                  }`}
                >
                  {isDone
                    ? t('مكتمل ✓', 'Completed ✓')
                    : isClaimed
                    ? t('محجوز', 'Claimed')
                    : t('شاغر', 'Available')}
                </span>
              </div>

              <div className="my-3 pt-2.5 border-t border-[#8A6418]/15 dark:border-slate-800/80 flex items-center justify-between text-xs min-h-[32px]">
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
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-[#8A6418] dark:border-[#d9b45a] rounded-lg text-xs text-[#1B1A17] dark:text-white outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label={t('حفظ اسم القارئ', 'Save reader name')}
                        onClick={() => handleSaveEditName(part.juzNumber)}
                        className="min-h-[34px] min-w-[34px] p-1.5 bg-[#1f3a6e] hover:bg-[#274888] text-white rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserCheck className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#d9b45a] shrink-0" />
                        <span className="font-semibold text-[#1B1A17] dark:text-slate-100 truncate">{part.claimedBy}</span>
                        {part.claimedAt && (
                          <span className="text-[11px] text-[#5C5549] dark:text-slate-400 shrink-0">
                            · {formatRelativeTime(part.claimedAt, lang)}
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
                          aria-label={t('تعديل اسم القارئ', 'Edit reader name')}
                          className="min-h-[32px] min-w-[32px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#8A6418] dark:hover:text-[#d9b45a] flex items-center justify-center cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <span className="text-[#5C5549] dark:text-slate-400 text-xs">
                    {t('لا يوجد قارئ مسجل بعد', 'No reader registered yet')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-[#8A6418]/15 dark:border-slate-800/60">
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
                    <span>{t('احجز هذا الجزء', 'Claim This Juz')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(part.juzNumber)}
                      disabled={!canManageThisPart}
                      title={
                        canManageThisPart
                          ? t('تحديث حالة الإتمام', 'Toggle completion status')
                          : t(
                              'متاح لصاحب الحجز (من متصفحه) أو المشرف',
                              'Only available to the claimer (same browser) or admin'
                            )
                      }
                      className={`flex-1 min-h-[40px] py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        !canManageThisPart
                          ? 'bg-[#EFE6D1] dark:bg-slate-800/60 text-[#5C5549] dark:text-slate-400 cursor-not-allowed'
                          : isDone
                          ? 'bg-[#E4D7BA] hover:bg-[#d8c7a3] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1B1A17] dark:text-slate-200 cursor-pointer'
                          : 'bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] cursor-pointer'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isDone ? t('إلغاء الإتمام', 'Undo Done') : t('تمت القراءة', 'Mark Read')}</span>
                    </button>

                    {canManageThisPart && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenConfirmModal(isAdminMode ? 'admin-release' : 'withdraw', part.juzNumber)
                        }
                        aria-label={t(`إخلاء الجزء ${part.juzNumber}`, `Release Juz ${part.juzNumber}`)}
                        title={
                          isAdminMode
                            ? t('إخلاء الجزء (المشرف)', 'Release Juz (Admin)')
                            : t('الاعتذار والانسحاب', 'Release Reservation')
                        }
                        className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/40 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        {isAdminMode ? <X className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppReminderModal(part)}
                      aria-label={t(
                        `تذكير قارئ الجزء ${part.juzNumber} عبر واتساب`,
                        `Remind Juz ${part.juzNumber} reader on WhatsApp`
                      )}
                      className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:border-[#8A6418]/45 dark:hover:border-slate-600 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </>
                )}

                {onNavigateToJuz && (
                  <button
                    type="button"
                    onClick={() => onNavigateToJuz(part.juzNumber)}
                    aria-label={t(
                      `قراءة الجزء ${part.juzNumber} في المصحف`,
                      `Read Juz ${part.juzNumber} in the Mus'haf`
                    )}
                    className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white hover:border-[#8A6418]/45 dark:hover:border-slate-600 transition-colors flex items-center justify-center cursor-pointer"
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#d9b45a] font-bold">
                <BookOpen className="w-4 h-4" />
                <h3 className="text-base text-[#1B1A17] dark:text-white">
                  {t(`حجز قراءة الجزء ${claimModalJuz}`, `Reserve ${getJuzLabel(claimModalJuz, lang)}`)}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setClaimModalJuz(null)}
                className="min-h-[36px] min-w-[36px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white rounded-lg hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
              {t(
                'اكتب اسمك لحجز هذا الجزء. سيحفظ هذا المتصفح مفتاحاً خاصاً لتمكينك وحدك من تأكيد إتمام القراءة أو الاعتذار لاحقاً.',
                'Enter your name to reserve this Juz. Your browser saves a private token so only you can mark it complete or release it later.'
              )}
            </p>

            <div>
              <label className="text-xs font-semibold text-[#1B1A17] dark:text-slate-200 block mb-1.5">
                {t('اسم القارئ:', 'Reader Name:')}
              </label>
              <input
                type="text"
                value={claimNameInput}
                onChange={(e) => setClaimNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmClaim();
                }}
                placeholder={t('مثال: محمد، أم أحمد، فاعل خير...', 'e.g. Muhammad, Umm Ahmad, Well-Wisher...')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-sm text-[#1B1A17] dark:text-white outline-none"
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClaimModalJuz(null)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmClaim}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{t('تأكيد الحجز', 'Confirm Reservation')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B1A17] dark:text-white">{confirmModalConfig.title}</h3>
                <p className="text-xs text-[#5C5549] dark:text-slate-400 mt-0.5">
                  {t('يرجى التأكيد للمتابعة', 'Please confirm to continue')}
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#1B1A17] dark:text-slate-200 leading-relaxed bg-[#EFE6D1] dark:bg-slate-950 p-3.5 rounded-xl border border-[#8A6418]/20 dark:border-slate-800">
              {confirmModalConfig.message}
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {t('تراجع', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs cursor-pointer"
              >
                {t('تأكيد الإجراء', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Share Modal */}
      {whatsAppModalConfig.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#d9b45a] font-bold">
                <MessageCircle className="w-5 h-5" />
                <h3 className="text-base text-[#1B1A17] dark:text-white">{whatsAppModalConfig.title}</h3>
              </div>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[36px] min-w-[36px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white rounded-lg hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 text-xs sm:text-sm text-[#1B1A17] dark:text-slate-200 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
              {whatsAppModalConfig.message}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(whatsAppModalConfig.message);
                  showToast(t('تم نسخ نص الرسالة', 'Message copied'));
                }}
                className="min-h-[40px] py-2 px-3 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1B1A17] dark:text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('نسخ النص', 'Copy Text')}</span>
              </button>
              <a
                href={whatsAppModalConfig.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsAppModalConfig((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('فتح واتساب', 'Open WhatsApp')}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dedication Modal */}
      {isDedicationModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <h3 className="text-base font-bold text-[#1B1A17] dark:text-white">
                {t('تعديل نية الختمة', 'Edit Khatma Dedication')}
              </h3>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setIsDedicationModalOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white rounded-lg hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1B1A17] dark:text-slate-300 block mb-1">
                  {t('عنوان ونية الختمة:', 'Khatma Title & Dedication:')}
                </label>
                <input
                  type="text"
                  value={tempTitleInput}
                  onChange={(e) => setTempTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-sm text-[#1B1A17] dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1B1A17] dark:text-slate-300 block mb-1">
                  {t('اسم المنشئ:', 'Organizer Name:')}
                </label>
                <input
                  type="text"
                  value={tempCreatorInput}
                  onChange={(e) => setTempCreatorInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-sm text-[#1B1A17] dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1B1A17] dark:text-slate-300 block mb-1">
                  {t('المدة المستهدفة (أيام):', 'Target Duration (Days):')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={tempDeadlineInput}
                  onChange={(e) => setTempDeadlineInput(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-sm text-[#1B1A17] dark:text-white outline-none font-mono"
                />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDedicationModalOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveDedication}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{t('حفظ التعديلات', 'Save Changes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Admin Key Unlock Modal (Replaces insecure PIN 1234 prompt) */}
      {isAdminUnlockOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/40 dark:border-[#d9b45a]/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#d9b45a] font-bold">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base text-[#1B1A17] dark:text-white">
                  {t('صلاحية مشرف الغرفة', 'Room Admin Access')}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setIsAdminUnlockOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white rounded-lg hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
              {t(
                'ألصق مفتاح المشرف السري (128-bit) أو رابط المشرف الكامل لفتح صلاحيات تعديل الأسماء وإدارة الأجزاء.',
                'Paste the 128-bit secret admin key or full admin link to unlock reader editing and room management.'
              )}
            </p>

            {adminUnlockError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{adminUnlockError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#1B1A17] dark:text-slate-200 block mb-1.5">
                {t('المفتاح السري أو رابط المشرف:', 'Secret Key or Admin Link:')}
              </label>
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
                placeholder={t('ألصق المفتاح أو الرابط السري هنا...', 'Paste secret key or admin URL here...')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-sm text-[#1B1A17] dark:text-white outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdminUnlockOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleVerifyAdminKey}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{t('تفعيل صلاحية المشرف', 'Enable Admin Mode')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Supervisor Link Created / Rotated Notice Modal */}
      {createdAdminInfo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/45 dark:border-[#d9b45a]/50 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#8A6418]/15 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#d9b45a] font-bold">
                <Key className="w-5 h-5" />
                <h3 className="text-base text-[#1B1A17] dark:text-white">
                  {t('احفظ رابط المشرف السري للختمة', 'Save Your Secret Khatma Admin Link')}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setCreatedAdminInfo(null)}
                className="min-h-[36px] min-w-[36px] p-1 text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white rounded-lg hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#1B1A17] dark:text-slate-200 leading-relaxed">
              {t(
                `تم إنشاء الغرفة «${createdAdminInfo.title}» وتأمينها بمفتاح سري عشوائي. يُحفظ هذا الرابط في متصفحك تلقائياً، ولكن يُنصح بنسخه وحفظه لإدارة الغرفة من أي جهاز آخر دون مشاركته مع القراء.`,
                `Room "${createdAdminInfo.title}" has been created and secured with a random secret key. It is saved in this browser automatically, and you should copy it to manage the room from another device without sharing it with readers.`
              )}
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/20 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-[#5C5549] dark:text-slate-300">
                  {t('١. رابط المشاركة العام للقراء:', '1. Public Share Link for Readers:')}
                </div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 text-[11px] text-[#1B1A17] dark:text-slate-300 truncate bg-white dark:bg-slate-900 px-2.5 py-2 rounded-lg">
                    {getKhatmaShareUrl()}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1f3a6e] hover:bg-[#274888] text-white font-semibold cursor-pointer shrink-0"
                  >
                    {t('نسخ', 'Copy')}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#EFE6D1] dark:bg-slate-950 border border-[#8A6418]/40 dark:border-[#d9b45a]/40 space-y-2">
                <div className="font-semibold text-[#8A6418] dark:text-[#d9b45a]">
                  {t('٢. رابط المشرف السري (لك فقط):', '2. Secret Admin Link (Private — Keep Safe):')}
                </div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 text-[11px] text-[#1B1A17] dark:text-[#f6efdd] truncate bg-white dark:bg-slate-900 px-2.5 py-2 rounded-lg">
                    {getKhatmaAdminSecretUrl(createdAdminInfo.roomId, createdAdminInfo.adminKey)}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(
                        getKhatmaAdminSecretUrl(createdAdminInfo.roomId, createdAdminInfo.adminKey)
                      );
                      if (ok) showToast(t('تم نسخ رابط المشرف السري', 'Secret admin link copied'));
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#d9b45a] hover:bg-[#e3c270] text-[#1b1a17] font-bold cursor-pointer shrink-0"
                  >
                    {t('نسخ السري', 'Copy Secret')}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedAdminInfo(null)}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#EFE6D1] hover:bg-[#E4D7BA] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1B1A17] dark:text-white text-xs font-semibold cursor-pointer"
              >
                {t('تم الحفظ والمتابعة', 'Saved & Continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Unlisted Private Khatma Modal (No weak PIN input required — 128-bit link issued cleanly) */}
      {isCreateRoomOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#8A6418]/30 dark:border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#8A6418]/15 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-[#8A6418] dark:text-[#d9b45a] font-bold text-sm">
                <Users className="w-4 h-4" />
                <span>{t('إنشاء ختمة خاصة غير مدرجة', 'Create Unlisted Private Khatma')}</span>
              </div>
              <button
                type="button"
                aria-label={t('إغلاق', 'Close')}
                onClick={() => setIsCreateRoomOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1 rounded-lg text-[#5C5549] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C5549] dark:text-slate-300 leading-relaxed">
              {t(
                'لن تظهر الغرفة الخاصة في القوائم العامة، ولا يمكن الوصول إليها إلا عبر رابطها العشوائي الآمن، مع توليد مفتاح مشرف سري تلقائياً.',
                'Private rooms do not appear in public directories and are only accessible via their random secure link, with an automatic secret admin key.'
              )}
            </p>

            {createRoomError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-500/40 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createRoomError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1B1A17] dark:text-slate-200 block mb-1">
                  {t('نية وعنوان الختمة:', 'Khatma Title & Dedication:')}
                </label>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder={t('مثال: ختمة عائلة آل فلان', 'e.g. Family Weekly Khatma')}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-[#1B1A17] dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#1B1A17] dark:text-slate-200 block mb-1">
                    {t('اسم المنشئ:', 'Organizer Name:')}
                  </label>
                  <input
                    type="text"
                    value={newRoomCreator}
                    onChange={(e) => setNewRoomCreator(e.target.value)}
                    placeholder={t('أبو عبد الله', 'Abu Abdullah')}
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-[#1B1A17] dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#1B1A17] dark:text-slate-200 block mb-1">
                    {t('المدة (أيام):', 'Duration (Days):')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={newRoomDays}
                    onChange={(e) => setNewRoomDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-[#1B1A17] dark:text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#5C5549] dark:text-slate-300 block mb-1">
                  {t('معرّف مخصص (اختياري بالإنجليزية، 6+ أحرف):', 'Custom Slug (optional, 6+ alphanumeric chars):')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={newRoomSlug}
                  onChange={(e) => setNewRoomSlug(e.target.value)}
                  placeholder={t('يترك فارغاً لتوليد رابط عشوائي سري (موصى به)', 'Leave blank for a random secret slug (recommended)')}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-[#8A6418]/25 dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#d9b45a] text-[#1B1A17] dark:text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="min-h-[40px] py-2 px-4 rounded-xl text-xs text-[#5C5549] dark:text-slate-300 hover:text-[#1B1A17] dark:hover:text-white cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreatingRoom}
                className="min-h-[40px] py-2 px-5 rounded-xl bg-[#1f3a6e] hover:bg-[#274888] disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isCreatingRoom
                    ? t('جارٍ الإنشاء...', 'Creating...')
                    : t('إنشاء الغرفة', 'Create Room')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
