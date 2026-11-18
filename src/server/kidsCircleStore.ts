import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  generateCapabilitySecret,
  hashSecret,
  verifySecretHash,
} from './khatmaStore';

export type KidsCircleAvatarId = 'star' | 'sprout' | 'moon' | 'crown' | 'book' | 'sun';
export type KidsCircleDelayMode = 'short' | 'medium' | 'long';
export type KidsCircleRepeatCount = 3 | 5 | 7;

export interface KidsCircleWird {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  reciterId: string;
  repeatCount: KidsCircleRepeatCount;
  repeatDelayMode: KidsCircleDelayMode;
  autoAdvanceAyah: boolean;
}

export interface KidsCircleMemberRecord {
  kidId: string;
  name: string;
  avatarId: KidsCircleAvatarId;
  kidTokenHash: string;
  stars: number;
  masteredAyahKeys: string[];
  completedSurahs: number[];
  ayahRepeatCounts: Record<string, number>;
  retryRequestedKeys: string[];
  dailyWird: KidsCircleWird;
  joinedAt: string;
  lastSeenAt: string;
}

export interface PublicKidsCircleMember {
  kidId: string;
  name: string;
  avatarId: KidsCircleAvatarId;
  stars: number;
  masteredAyahKeys: string[];
  completedSurahs: number[];
  ayahRepeatCounts: Record<string, number>;
  retryRequestedKeys: string[];
  dailyWird: KidsCircleWird;
  joinedAt: string;
  lastSeenAt: string;
}

export interface KidsCircleSubmission {
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

export interface KidsCircleRoom {
  circleCode: string;
  title: string;
  supervisorName: string;
  adminKeyHash: string;
  kids: KidsCircleMemberRecord[];
  submissions: KidsCircleSubmission[];
  createdAt: string;
  updatedAt: string;
}

interface PersistedKidsCirclesFile {
  version: 1;
  circles: Record<string, KidsCircleRoom>;
}

const MAX_CIRCLES = 250;
const MAX_KIDS_PER_CIRCLE = 25;
const MAX_SUBMISSIONS_PER_CIRCLE = 25;
const MAX_AUDIO_DATA_URL_LEN = 1_400_000; // ~1 MB binary audio base64 safe cap
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
  89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
  12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function normalizeCircleCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 6 || RESERVED_KEYS.has(digits)) return null;
  return digits;
}

export function sanitizeWirdInput(raw: Partial<KidsCircleWird> | undefined): KidsCircleWird {
  const surahNum = Math.max(1, Math.min(114, Math.round(Number(raw?.surahNumber) || 112)));
  const maxAyah = SURAH_AYAH_COUNTS[surahNum - 1] || 7;
  const startAyah = Math.max(1, Math.min(maxAyah, Math.round(Number(raw?.startAyah) || 1)));
  const endAyah = Math.max(
    startAyah,
    Math.min(maxAyah, Math.round(Number(raw?.endAyah) || Math.min(maxAyah, 4)))
  );
  const repeatCount: KidsCircleRepeatCount =
    raw?.repeatCount === 5 || raw?.repeatCount === 7 ? raw.repeatCount : 3;
  const repeatDelayMode: KidsCircleDelayMode =
    raw?.repeatDelayMode === 'short' || raw?.repeatDelayMode === 'long'
      ? raw.repeatDelayMode
      : 'medium';

  return {
    surahNumber: surahNum,
    startAyah,
    endAyah,
    reciterId:
      typeof raw?.reciterId === 'string' && raw.reciterId.trim()
        ? raw.reciterId.trim().slice(0, 40)
        : 'husary',
    repeatCount,
    repeatDelayMode,
    autoAdvanceAyah: typeof raw?.autoAdvanceAyah === 'boolean' ? raw.autoAdvanceAyah : true,
  };
}

export function sanitizeMemberForClient(m: KidsCircleMemberRecord): PublicKidsCircleMember {
  return {
    kidId: m.kidId,
    name: m.name,
    avatarId: m.avatarId,
    stars: m.stars,
    masteredAyahKeys: m.masteredAyahKeys,
    completedSurahs: m.completedSurahs,
    ayahRepeatCounts: m.ayahRepeatCounts,
    retryRequestedKeys: m.retryRequestedKeys,
    dailyWird: m.dailyWird,
    joinedAt: m.joinedAt,
    lastSeenAt: m.lastSeenAt,
  };
}

function isValidAvatar(val: unknown): val is KidsCircleAvatarId {
  return (
    val === 'star' ||
    val === 'sprout' ||
    val === 'moon' ||
    val === 'crown' ||
    val === 'book' ||
    val === 'sun'
  );
}

function isSafeAudioDataUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  if (raw.length < 30 || raw.length > MAX_AUDIO_DATA_URL_LEN) return false;
  return /^data:audio\/(webm|ogg|mp4|mpeg|wav|aac)[^,]*;base64,[A-Za-z0-9+/=]+$/.test(raw);
}

export function createKidsCircleDatabase(customFilePath?: string) {
  const dataFilePath =
    customFilePath || path.resolve(process.cwd(), 'data', 'kids_circles.json');
  const dataDir = path.dirname(dataFilePath);

  const circles = new Map<string, KidsCircleRoom>();

  function saveToDisk(): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const obj: Record<string, KidsCircleRoom> = {};
    for (const [code, circle] of circles.entries()) {
      obj[code] = circle;
    }
    const payload: PersistedKidsCirclesFile = {
      version: 1,
      circles: obj,
    };
    const tmpPath = `${dataFilePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, dataFilePath);
  }

  function load(): void {
    if (!fs.existsSync(dataFilePath)) return;
    try {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedKidsCirclesFile>;
      if (!parsed || typeof parsed !== 'object' || !parsed.circles || typeof parsed.circles !== 'object') {
        return;
      }
      for (const [key, val] of Object.entries(parsed.circles)) {
        const code = normalizeCircleCode(key);
        if (code && val && typeof val === 'object' && typeof val.adminKeyHash === 'string') {
          circles.set(code, val as KidsCircleRoom);
        }
      }
    } catch (err) {
      const backupPath = `${dataFilePath}.corrupted.${Date.now()}.json`;
      try {
        fs.renameSync(dataFilePath, backupPath);
      } catch {
        // Ignore quarantine failure
      }
      console.error(`[kidsCircleStore] Corrupted file quarantined to ${backupPath}:`, err);
    }
  }

  load();

  function generateUniqueCircleCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = String(100000 + crypto.randomInt(0, 900000));
      if (!circles.has(code)) return code;
    }
    return String(100000 + (Date.now() % 900000));
  }

  function createCircle(input: {
    title?: string;
    supervisorName?: string;
  }):
    | { ok: true; circle: KidsCircleRoom; adminKey: string }
    | { ok: false; status: number; error: string } {
    if (circles.size >= MAX_CIRCLES) {
      // Evict oldest circle without submissions first
      const sorted = Array.from(circles.values()).sort((a, b) =>
        a.updatedAt.localeCompare(b.updatedAt)
      );
      if (sorted[0]) {
        circles.delete(sorted[0].circleCode);
      }
    }

    const title =
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim().slice(0, 80)
        : 'حلقة تحفيظ الصغار';
    const supervisorName =
      typeof input.supervisorName === 'string' && input.supervisorName.trim()
        ? input.supervisorName.trim().slice(0, 60)
        : 'المشرف';

    const circleCode = generateUniqueCircleCode();
    const adminKey = generateCapabilitySecret(16);
    const now = new Date().toISOString();

    const circle: KidsCircleRoom = {
      circleCode,
      title,
      supervisorName,
      adminKeyHash: hashSecret(adminKey),
      kids: [],
      submissions: [],
      createdAt: now,
      updatedAt: now,
    };

    circles.set(circleCode, circle);
    saveToDisk();
    return { ok: true, circle, adminKey };
  }

  function getCircle(rawCode: unknown): KidsCircleRoom | null {
    const code = normalizeCircleCode(rawCode);
    if (!code) return null;
    return circles.get(code) || null;
  }

  function joinCircle(
    rawCode: unknown,
    input: {
      name?: string;
      avatarId?: unknown;
      initialWird?: Partial<KidsCircleWird>;
    }
  ):
    | { ok: true; circle: KidsCircleRoom; member: PublicKidsCircleMember; kidToken: string }
    | { ok: false; status: number; error: string } {
    const circle = getCircle(rawCode);
    if (!circle) {
      return { ok: false, status: 404, error: 'لم يتم العثور على حلقة بهذا الكود' };
    }
    if (circle.kids.length >= MAX_KIDS_PER_CIRCLE) {
      return { ok: false, status: 400, error: 'وصلت الحلقة إلى الحد الأقصى لعدد الأطفال' };
    }

    const cleanName =
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim().slice(0, 40)
        : 'بطل القرآن';
    const avatarId: KidsCircleAvatarId = isValidAvatar(input.avatarId) ? input.avatarId : 'star';
    const kidToken = generateCapabilitySecret(16);
    const now = new Date().toISOString();

    const member: KidsCircleMemberRecord = {
      kidId: `kid_${crypto.randomBytes(6).toString('hex')}`,
      name: cleanName,
      avatarId,
      kidTokenHash: hashSecret(kidToken),
      stars: 0,
      masteredAyahKeys: [],
      completedSurahs: [],
      ayahRepeatCounts: {},
      retryRequestedKeys: [],
      dailyWird: sanitizeWirdInput(input.initialWird),
      joinedAt: now,
      lastSeenAt: now,
    };

    circle.kids.push(member);
    circle.updatedAt = now;
    saveToDisk();
    return { ok: true, circle, member: sanitizeMemberForClient(member), kidToken };
  }

  function verifyAdmin(rawCode: unknown, adminKey: unknown): boolean {
    const circle = getCircle(rawCode);
    if (!circle) return false;
    return verifySecretHash(adminKey, circle.adminKeyHash);
  }

  function updateKidWird(
    rawCode: unknown,
    adminKey: unknown,
    kidId: string,
    wirdPatch: Partial<KidsCircleWird>
  ):
    | { ok: true; member: PublicKidsCircleMember }
    | { ok: false; status: number; error: string } {
    const circle = getCircle(rawCode);
    if (!circle) return { ok: false, status: 404, error: 'الحلقة غير موجودة' };
    if (!verifySecretHash(adminKey, circle.adminKeyHash)) {
      return { ok: false, status: 403, error: 'غير مصرح: مفتاح المشرف غير صحيح' };
    }
    const member = circle.kids.find((k) => k.kidId === kidId);
    if (!member) return { ok: false, status: 404, error: 'ملف الطفل غير موجود في الحلقة' };

    member.dailyWird = sanitizeWirdInput({ ...member.dailyWird, ...wirdPatch });
    circle.updatedAt = new Date().toISOString();
    saveToDisk();
    return { ok: true, member: sanitizeMemberForClient(member) };
  }

  function syncKidProgress(
    rawCode: unknown,
    kidId: string,
    auth: { kidToken?: unknown; adminKey?: unknown },
    progress: {
      stars?: number;
      masteredAyahKeys?: unknown;
      completedSurahs?: unknown;
      ayahRepeatCounts?: unknown;
    }
  ):
    | { ok: true; member: PublicKidsCircleMember }
    | { ok: false; status: number; error: string } {
    const circle = getCircle(rawCode);
    if (!circle) return { ok: false, status: 404, error: 'الحلقة غير موجودة' };
    const member = circle.kids.find((k) => k.kidId === kidId);
    if (!member) return { ok: false, status: 404, error: 'ملف الطفل غير موجود' };

    const isKidOwner = verifySecretHash(auth.kidToken, member.kidTokenHash);
    const isAdmin = verifySecretHash(auth.adminKey, circle.adminKeyHash);
    if (!isKidOwner && !isAdmin) {
      return { ok: false, status: 403, error: 'غير مصرح بتحديث تقدم هذا الطفل' };
    }

    if (Array.isArray(progress.masteredAyahKeys)) {
      const mergedKeys = new Set(member.masteredAyahKeys);
      for (const k of progress.masteredAyahKeys) {
        if (typeof k === 'string' && /^\d{1,3}:\d{1,3}$/.test(k)) {
          mergedKeys.add(k);
          member.retryRequestedKeys = member.retryRequestedKeys.filter((r) => r !== k);
        }
      }
      member.masteredAyahKeys = Array.from(mergedKeys).slice(0, 6236);
    }

    if (Array.isArray(progress.completedSurahs)) {
      const mergedSurahs = new Set(member.completedSurahs);
      for (const s of progress.completedSurahs) {
        if (typeof s === 'number' && Number.isInteger(s) && s >= 1 && s <= 114) {
          mergedSurahs.add(s);
        }
      }
      member.completedSurahs = Array.from(mergedSurahs);
    }

    if (progress.ayahRepeatCounts && typeof progress.ayahRepeatCounts === 'object') {
      for (const [k, v] of Object.entries(progress.ayahRepeatCounts as Record<string, unknown>)) {
        if (/^\d{1,3}:\d{1,3}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) {
          member.ayahRepeatCounts[k] = Math.max(member.ayahRepeatCounts[k] || 0, Math.floor(v));
        }
      }
    }

    if (typeof progress.stars === 'number' && Number.isFinite(progress.stars)) {
      member.stars = Math.max(member.stars, Math.min(50000, Math.floor(progress.stars)));
    }

    const now = new Date().toISOString();
    member.lastSeenAt = now;
    circle.updatedAt = now;
    saveToDisk();
    return { ok: true, member: sanitizeMemberForClient(member) };
  }

  function addVoiceSubmission(
    rawCode: unknown,
    kidId: string,
    kidToken: unknown,
    payload: {
      surahNumber?: number;
      ayahNumber?: number;
      endAyahNumber?: number;
      audioDataUrl?: unknown;
      mimeType?: unknown;
      durationSec?: number;
    }
  ):
    | { ok: true; submission: KidsCircleSubmission }
    | { ok: false; status: number; error: string } {
    const circle = getCircle(rawCode);
    if (!circle) return { ok: false, status: 404, error: 'الحلقة غير موجودة' };
    const member = circle.kids.find((k) => k.kidId === kidId);
    if (!member) return { ok: false, status: 404, error: 'ملف الطفل غير موجود' };
    if (!verifySecretHash(kidToken, member.kidTokenHash)) {
      return { ok: false, status: 403, error: 'غير مصرح بإرسال تسميع لهذا الطفل' };
    }
    if (!isSafeAudioDataUrl(payload.audioDataUrl)) {
      return { ok: false, status: 400, error: 'تنسيق التسجيل الصوتي غير صالح أو حجمه أكبر من الحد المسموح (١ ميجابايت)' };
    }

    const surahNumber = Math.max(1, Math.min(114, Math.round(Number(payload.surahNumber) || 1)));
    const maxAyah = SURAH_AYAH_COUNTS[surahNumber - 1] || 7;
    const ayahNumber = Math.max(1, Math.min(maxAyah, Math.round(Number(payload.ayahNumber) || 1)));
    const endAyahNumber = payload.endAyahNumber
      ? Math.max(ayahNumber, Math.min(maxAyah, Math.round(Number(payload.endAyahNumber))))
      : ayahNumber;

    const submission: KidsCircleSubmission = {
      id: `sub_${crypto.randomBytes(6).toString('hex')}`,
      kidId: member.kidId,
      kidName: member.name,
      surahNumber,
      ayahNumber,
      endAyahNumber,
      audioDataUrl: payload.audioDataUrl,
      mimeType: typeof payload.mimeType === 'string' ? payload.mimeType.slice(0, 40) : 'audio/webm',
      durationSec: Math.max(1, Math.min(180, Math.round(Number(payload.durationSec) || 5))),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    circle.submissions.unshift(submission);
    if (circle.submissions.length > MAX_SUBMISSIONS_PER_CIRCLE) {
      circle.submissions = circle.submissions.slice(0, MAX_SUBMISSIONS_PER_CIRCLE);
    }

    member.lastSeenAt = submission.createdAt;
    circle.updatedAt = submission.createdAt;
    saveToDisk();
    return { ok: true, submission };
  }

  function reviewSubmission(
    rawCode: unknown,
    adminKey: unknown,
    submissionId: string,
    review: {
      decision: 'approved' | 'retry';
      feedbackText?: string;
      supervisorAudioDataUrl?: unknown;
    }
  ):
    | { ok: true; submission: KidsCircleSubmission; member: PublicKidsCircleMember | null }
    | { ok: false; status: number; error: string } {
    const circle = getCircle(rawCode);
    if (!circle) return { ok: false, status: 404, error: 'الحلقة غير موجودة' };
    if (!verifySecretHash(adminKey, circle.adminKeyHash)) {
      return { ok: false, status: 403, error: 'غير مصرح: مفتاح المشرف غير صحيح' };
    }

    const sub = circle.submissions.find((s) => s.id === submissionId);
    if (!sub) return { ok: false, status: 404, error: 'التسجيل المطلوب غير موجود' };

    if (review.supervisorAudioDataUrl && !isSafeAudioDataUrl(review.supervisorAudioDataUrl)) {
      return { ok: false, status: 400, error: 'تنسيق التوجيه الصوتي للمشرف غير صالح أو كبير جداً' };
    }

    sub.status = review.decision === 'approved' ? 'approved' : 'retry';
    sub.supervisorFeedbackText =
      typeof review.feedbackText === 'string' && review.feedbackText.trim()
        ? review.feedbackText.trim().slice(0, 240)
        : undefined;
    if (typeof review.supervisorAudioDataUrl === 'string') {
      sub.supervisorAudioDataUrl = review.supervisorAudioDataUrl;
    }
    sub.reviewedAt = new Date().toISOString();

    const member = circle.kids.find((k) => k.kidId === sub.kidId) || null;
    if (member) {
      const fromA = sub.ayahNumber;
      const toA = sub.endAyahNumber || sub.ayahNumber;
      for (let a = fromA; a <= toA; a++) {
        const key = `${sub.surahNumber}:${a}`;
        if (sub.status === 'approved') {
          if (!member.masteredAyahKeys.includes(key)) {
            member.masteredAyahKeys.push(key);
            member.stars += 1;
          }
          member.retryRequestedKeys = member.retryRequestedKeys.filter((r) => r !== key);
        } else {
          if (!member.retryRequestedKeys.includes(key)) {
            member.retryRequestedKeys.push(key);
          }
        }
      }

      if (sub.status === 'approved') {
        const totalInSurah = SURAH_AYAH_COUNTS[sub.surahNumber - 1] || 0;
        if (totalInSurah > 0 && !member.completedSurahs.includes(sub.surahNumber)) {
          let allDone = true;
          for (let i = 1; i <= totalInSurah; i++) {
            if (!member.masteredAyahKeys.includes(`${sub.surahNumber}:${i}`)) {
              allDone = false;
              break;
            }
          }
          if (allDone) {
            member.completedSurahs.push(sub.surahNumber);
            member.stars += 5;
          }
        }
      }
    }

    circle.updatedAt = sub.reviewedAt;
    saveToDisk();
    return {
      ok: true,
      submission: sub,
      member: member ? sanitizeMemberForClient(member) : null,
    };
  }

  return {
    createCircle,
    getCircle,
    joinCircle,
    verifyAdmin,
    updateKidWird,
    syncKidProgress,
    addVoiceSubmission,
    reviewSubmission,
  };
}
