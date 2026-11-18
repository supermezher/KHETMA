import { safeLocalStorage } from '../utils/safeStorage';
import type { KidsAvatarId, KidsDailyWird } from '../utils/kidsHifzStore';

export interface RemoteKidsMember {
  kidId: string;
  name: string;
  avatarId: KidsAvatarId;
  stars: number;
  masteredAyahKeys: string[];
  completedSurahs: number[];
  ayahRepeatCounts: Record<string, number>;
  retryRequestedKeys: string[];
  dailyWird: KidsDailyWird;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RemoteVoiceSubmission {
  id: string;
  kidId: string;
  kidName: string;
  surahNumber: number;
  ayahNumber: number;
  endAyahNumber?: number;
  audioDataUrl: string;
  mimeType: string;
  durationSec: number;
  status: 'pending' | 'approved' | 'retry';
  supervisorFeedbackText?: string;
  supervisorAudioDataUrl?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface RemoteCircleSupervisorSession {
  circleCode: string;
  adminKey: string;
  title: string;
  supervisorName: string;
}

export const KIDS_SUPERVISOR_SESSION_KEY = 'bayan_kids_supervisor_circle_v1';

export function loadSupervisorCircleSession(): RemoteCircleSupervisorSession | null {
  const raw = safeLocalStorage.getJSON<Partial<RemoteCircleSupervisorSession> | null>(
    KIDS_SUPERVISOR_SESSION_KEY,
    null
  );
  if (
    !raw ||
    typeof raw.circleCode !== 'string' ||
    typeof raw.adminKey !== 'string' ||
    !/^\d{6}$/.test(raw.circleCode) ||
    !raw.adminKey.trim()
  ) {
    return null;
  }
  return {
    circleCode: raw.circleCode,
    adminKey: raw.adminKey,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'حلقة تحفيظ الصغار',
    supervisorName:
      typeof raw.supervisorName === 'string' && raw.supervisorName.trim()
        ? raw.supervisorName
        : 'المشرف',
  };
}

export function saveSupervisorCircleSession(
  session: RemoteCircleSupervisorSession | null
): void {
  if (!session) {
    safeLocalStorage.removeItem(KIDS_SUPERVISOR_SESSION_KEY);
    return;
  }
  safeLocalStorage.setJSON(KIDS_SUPERVISOR_SESSION_KEY, session);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('تعذر تحويل التسجيل الصوتي'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة التسجيل الصوتي'));
    reader.readAsDataURL(blob);
  });
}

async function parseApiJson<T>(res: Response, fallbackError: string): Promise<T> {
  let data: (T & { success?: boolean; error?: string }) | null = null;
  try {
    data = (await res.json()) as T & { success?: boolean; error?: string };
  } catch {
    throw new Error(fallbackError);
  }
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

export async function createRemoteKidsCircleApi(input: {
  title: string;
  supervisorName: string;
}): Promise<{
  success: boolean;
  circleCode: string;
  title: string;
  supervisorName: string;
  adminKey: string;
  kids: RemoteKidsMember[];
  submissions: RemoteVoiceSubmission[];
  updatedAt: string;
}> {
  const res = await fetch('/api/kids-circle/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseApiJson(res, 'تعذر إنشاء حلقة تحفيظ الصغار');
}

export async function verifyRemoteCircleAdminApi(
  circleCode: string,
  adminKey: string
): Promise<{
  success: boolean;
  verified: boolean;
  circleCode: string;
  title: string;
  supervisorName: string;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}/verify-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify({ adminKey }),
  });
  return parseApiJson(res, 'مفتاح المشرف غير صحيح');
}

export async function fetchRemoteCircleAsAdminApi(
  circleCode: string,
  adminKey: string
): Promise<{
  success: boolean;
  role: 'admin';
  circleCode: string;
  title: string;
  supervisorName: string;
  kidsCount: number;
  kids: RemoteKidsMember[];
  submissions: RemoteVoiceSubmission[];
  updatedAt: string;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}`, {
    method: 'GET',
    headers: {
      'x-admin-key': adminKey,
    },
  });
  return parseApiJson(res, 'تعذر جلب بيانات الحلقة للمشرف');
}

export async function fetchRemoteCircleAsKidApi(
  circleCode: string,
  kidId: string,
  kidToken: string
): Promise<{
  success: boolean;
  role: 'kid';
  circleCode: string;
  title: string;
  supervisorName: string;
  kidsCount: number;
  member: RemoteKidsMember;
  submissions: RemoteVoiceSubmission[];
  updatedAt: string;
}> {
  const res = await fetch(
    `/api/kids-circle/${encodeURIComponent(circleCode)}?kidId=${encodeURIComponent(kidId)}`,
    {
      method: 'GET',
      headers: {
        'x-kid-token': kidToken,
      },
    }
  );
  return parseApiJson(res, 'تعذر مزامنة ورد الطفل مع الحلقة');
}

export async function joinRemoteKidsCircleApi(
  circleCode: string,
  payload: {
    name: string;
    avatarId: KidsAvatarId;
    initialWird: KidsDailyWird;
  }
): Promise<{
  success: boolean;
  circleCode: string;
  title: string;
  supervisorName: string;
  member: RemoteKidsMember;
  kidToken: string;
  updatedAt: string;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(res, 'تعذر الانضمام إلى الحلقة');
}

export async function updateRemoteKidWirdApi(
  circleCode: string,
  adminKey: string,
  kidId: string,
  wird: Partial<KidsDailyWird>
): Promise<{
  success: boolean;
  member: RemoteKidsMember;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}/wird`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify({ adminKey, kidId, wird }),
  });
  return parseApiJson(res, 'تعذر إرسال الورد الجديد للطفل');
}

export async function syncRemoteKidProgressApi(
  circleCode: string,
  kidId: string,
  kidToken: string,
  progress: {
    stars: number;
    masteredAyahKeys: string[];
    completedSurahs: number[];
    ayahRepeatCounts: Record<string, number>;
  }
): Promise<{
  success: boolean;
  member: RemoteKidsMember;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kid-token': kidToken,
    },
    body: JSON.stringify({
      kidId,
      kidToken,
      ...progress,
    }),
  });
  return parseApiJson(res, 'تعذر رفع تقدم الطفل للحلقة');
}

export async function submitKidVoiceRecitationApi(
  circleCode: string,
  kidId: string,
  kidToken: string,
  payload: {
    surahNumber: number;
    ayahNumber: number;
    endAyahNumber?: number;
    audioDataUrl: string;
    mimeType: string;
    durationSec: number;
  }
): Promise<{
  success: boolean;
  submission: RemoteVoiceSubmission;
}> {
  const res = await fetch(`/api/kids-circle/${encodeURIComponent(circleCode)}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kid-token': kidToken,
    },
    body: JSON.stringify({
      kidId,
      kidToken,
      ...payload,
    }),
  });
  return parseApiJson(res, 'تعذر إرسال التسجيل الصوتي للمشرف');
}

export async function reviewKidVoiceSubmissionApi(
  circleCode: string,
  adminKey: string,
  submissionId: string,
  review: {
    decision: 'approved' | 'retry';
    feedbackText?: string;
    supervisorAudioDataUrl?: string;
  }
): Promise<{
  success: boolean;
  submission: RemoteVoiceSubmission;
  member?: RemoteKidsMember;
}> {
  const res = await fetch(
    `/api/kids-circle/${encodeURIComponent(circleCode)}/submissions/${encodeURIComponent(submissionId)}/review`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({
        adminKey,
        ...review,
      }),
    }
  );
  return parseApiJson(res, 'تعذر حفظ تقييم التسميع');
}
