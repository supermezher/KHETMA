import { SURAHS_LIST } from '../data/quranMetadata';
import { WordSegment } from '../data/quranService';
import { safeLocalStorage } from './safeStorage';
import type { AppLanguage } from './i18n';

export type KidsAvatarId = 'star' | 'sprout' | 'moon' | 'crown' | 'book' | 'sun';
export type KidsDelayMode = 'short' | 'medium' | 'long';
export type KidsRepeatCount = 3 | 5 | 7;

export interface KidsDailyWird {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  reciterId: string;
  repeatCount: KidsRepeatCount;
  repeatDelayMode: KidsDelayMode;
  autoAdvanceAyah: boolean;
}

export interface KidsRemoteLink {
  circleCode: string;
  kidId: string;
  kidToken: string;
  circleTitle?: string;
  supervisorName?: string;
}

export interface KidsProfile {
  id: string;
  name: string;
  avatarId: KidsAvatarId;
  stars: number;
  masteredAyahKeys: string[]; // "surah:ayah"
  completedSurahs: number[];
  ayahRepeatCounts: Record<string, number>; // "surah:ayah" -> total completed cycles
  retryRequestedKeys: string[]; // "surah:ayah" flagged by supervisor for gentle review
  dailyWird: KidsDailyWird;
  soundEffectsEnabled: boolean;
  createdAt: string;
  remoteLink?: KidsRemoteLink;
}

export interface KidsHifzState {
  activeProfileId: string;
  profiles: KidsProfile[];
}

export interface ParentGateChallenge {
  a: number;
  b: number;
  answer: number;
  questionText: string;
}

export const KIDS_HIFZ_STORAGE_KEY = 'bayan_kids_hifz_v1';

export const KIDS_AVATARS: { id: KidsAvatarId; label: string }[] = [
  { id: 'star', label: 'نجمة مضيئة' },
  { id: 'sprout', label: 'برعم الحفظ' },
  { id: 'moon', label: 'هلال النور' },
  { id: 'crown', label: 'تاج القرآن' },
  { id: 'book', label: 'رفيق المصحف' },
  { id: 'sun', label: 'شمس الفجر' },
];

const KIDS_AVATARS_EN: Record<KidsAvatarId, string> = {
  star: 'Shining Star',
  sprout: 'Hifz Sprout',
  moon: 'Crescent Light',
  crown: "Qur'an Crown",
  book: "Mus'haf Companion",
  sun: 'Dawn Sun',
};

export function getKidAvatarDisplayLabel(avatarId: KidsAvatarId, lang: AppLanguage): string {
  if (lang === 'en') return KIDS_AVATARS_EN[avatarId] || 'Shining Star';
  return KIDS_AVATARS.find((a) => a.id === avatarId)?.label || 'نجمة مضيئة';
}

export const RECOMMENDED_KIDS_SURAH_NUMBERS: number[] = [
  1, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 103, 97, 94, 93,
];

export function makeAyahKey(surahNumber: number, ayahNumber: number): string {
  return `${surahNumber}:${ayahNumber}`;
}

export function clampWirdRange(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): { surahNumber: number; startAyah: number; endAyah: number } {
  const meta = SURAHS_LIST.find((s) => s.number === surahNumber) || SURAHS_LIST[0];
  const maxAyah = meta.numberOfAyahs;
  const safeStart = Math.max(1, Math.min(maxAyah, Math.round(startAyah || 1)));
  const safeEnd = Math.max(safeStart, Math.min(maxAyah, Math.round(endAyah || safeStart)));
  return {
    surahNumber: meta.number,
    startAyah: safeStart,
    endAyah: safeEnd,
  };
}

export function createDefaultWird(): KidsDailyWird {
  return {
    surahNumber: 112, // سورة الإخلاص كبداية ميسرة للأطفال
    startAyah: 1,
    endAyah: 4,
    reciterId: 'husary',
    repeatCount: 3,
    repeatDelayMode: 'medium',
    autoAdvanceAyah: true,
  };
}

export function createKidProfile(
  name: string,
  avatarId: KidsAvatarId = 'star',
  idOverride?: string
): KidsProfile {
  const cleanName = name.trim() || 'بطل القرآن';
  return {
    id: idOverride || `kid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    avatarId,
    stars: 0,
    masteredAyahKeys: [],
    completedSurahs: [],
    ayahRepeatCounts: {},
    retryRequestedKeys: [],
    dailyWird: createDefaultWird(),
    soundEffectsEnabled: true,
    createdAt: new Date().toISOString(),
  };
}

export function sanitizeKidsHifzState(raw: unknown): KidsHifzState {
  if (!raw || typeof raw !== 'object') {
    const def = createKidProfile('بطل القرآن', 'star', 'kid_default');
    return { activeProfileId: def.id, profiles: [def] };
  }

  const candidate = raw as Partial<KidsHifzState>;
  const rawProfiles = Array.isArray(candidate.profiles) ? candidate.profiles : [];
  const validAvatars = new Set<KidsAvatarId>(['star', 'sprout', 'moon', 'crown', 'book', 'sun']);

  const profiles: KidsProfile[] = rawProfiles
    .filter((p): p is KidsProfile => Boolean(p && typeof p === 'object' && typeof p.id === 'string'))
    .map((p) => {
      const fallbackWird = createDefaultWird();
      const rawWird = p.dailyWird || fallbackWird;
      const clamped = clampWirdRange(
        Number(rawWird.surahNumber) || fallbackWird.surahNumber,
        Number(rawWird.startAyah) || 1,
        Number(rawWird.endAyah) || 4
      );
      const repeatCount: KidsRepeatCount =
        rawWird.repeatCount === 5 || rawWird.repeatCount === 7 ? rawWird.repeatCount : 3;
      const repeatDelayMode: KidsDelayMode =
        rawWird.repeatDelayMode === 'short' || rawWird.repeatDelayMode === 'long'
          ? rawWird.repeatDelayMode
          : 'medium';

      return {
        id: p.id,
        name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'بطل القرآن',
        avatarId: validAvatars.has(p.avatarId) ? p.avatarId : 'star',
        stars: typeof p.stars === 'number' && Number.isFinite(p.stars) ? Math.max(0, Math.floor(p.stars)) : 0,
        masteredAyahKeys: Array.isArray(p.masteredAyahKeys)
          ? p.masteredAyahKeys.filter((k): k is string => typeof k === 'string')
          : [],
        completedSurahs: Array.isArray(p.completedSurahs)
          ? p.completedSurahs.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 114)
          : [],
        ayahRepeatCounts:
          p.ayahRepeatCounts && typeof p.ayahRepeatCounts === 'object' ? p.ayahRepeatCounts : {},
        retryRequestedKeys: Array.isArray(p.retryRequestedKeys)
          ? p.retryRequestedKeys.filter((k): k is string => typeof k === 'string')
          : [],
        dailyWird: {
          ...clamped,
          reciterId:
            typeof rawWird.reciterId === 'string' && rawWird.reciterId
              ? rawWird.reciterId
              : 'husary',
          repeatCount,
          repeatDelayMode,
          autoAdvanceAyah: typeof rawWird.autoAdvanceAyah === 'boolean' ? rawWird.autoAdvanceAyah : true,
        },
        soundEffectsEnabled: typeof p.soundEffectsEnabled === 'boolean' ? p.soundEffectsEnabled : true,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        remoteLink:
          p.remoteLink &&
          typeof p.remoteLink === 'object' &&
          typeof p.remoteLink.circleCode === 'string' &&
          /^\d{6}$/.test(p.remoteLink.circleCode) &&
          typeof p.remoteLink.kidId === 'string' &&
          typeof p.remoteLink.kidToken === 'string' &&
          p.remoteLink.kidToken.length > 0
            ? {
                circleCode: p.remoteLink.circleCode,
                kidId: p.remoteLink.kidId,
                kidToken: p.remoteLink.kidToken,
                circleTitle:
                  typeof p.remoteLink.circleTitle === 'string'
                    ? p.remoteLink.circleTitle
                    : undefined,
                supervisorName:
                  typeof p.remoteLink.supervisorName === 'string'
                    ? p.remoteLink.supervisorName
                    : undefined,
              }
            : undefined,
      };
    });

  if (profiles.length === 0) {
    const def = createKidProfile('بطل القرآن', 'star', 'kid_default');
    return { activeProfileId: def.id, profiles: [def] };
  }

  const activeProfileId = profiles.some((p) => p.id === candidate.activeProfileId)
    ? (candidate.activeProfileId as string)
    : profiles[0].id;

  return { activeProfileId, profiles };
}

export function loadKidsHifzState(): KidsHifzState {
  const stored = safeLocalStorage.getJSON<unknown>(KIDS_HIFZ_STORAGE_KEY, null);
  return sanitizeKidsHifzState(stored);
}

export function saveKidsHifzState(state: KidsHifzState): KidsHifzState {
  const sanitized = sanitizeKidsHifzState(state);
  safeLocalStorage.setJSON(KIDS_HIFZ_STORAGE_KEY, sanitized);
  return sanitized;
}

export function recordKidAyahCycle(
  profile: KidsProfile,
  surahNumber: number,
  ayahNumber: number,
  completedFullTarget: boolean
): KidsProfile {
  const key = makeAyahKey(surahNumber, ayahNumber);
  const prevCount = profile.ayahRepeatCounts[key] || 0;
  const nextCounts = { ...profile.ayahRepeatCounts, [key]: prevCount + 1 };

  let nextMastered = profile.masteredAyahKeys;
  let nextStars = profile.stars;
  let nextRetry = profile.retryRequestedKeys;

  if (completedFullTarget) {
    if (!profile.masteredAyahKeys.includes(key)) {
      nextMastered = [...profile.masteredAyahKeys, key];
      nextStars += 1;
    }
    nextRetry = profile.retryRequestedKeys.filter((k) => k !== key);
  }

  const meta = SURAHS_LIST.find((s) => s.number === surahNumber);
  let nextCompletedSurahs = profile.completedSurahs;
  if (meta && !nextCompletedSurahs.includes(surahNumber)) {
    let allMastered = true;
    for (let i = 1; i <= meta.numberOfAyahs; i++) {
      if (!nextMastered.includes(makeAyahKey(surahNumber, i))) {
        allMastered = false;
        break;
      }
    }
    if (allMastered) {
      nextCompletedSurahs = [...nextCompletedSurahs, surahNumber];
      nextStars += 5; // مكافأة إتمام السورة كاملة
    }
  }

  return {
    ...profile,
    stars: nextStars,
    masteredAyahKeys: nextMastered,
    completedSurahs: nextCompletedSurahs,
    ayahRepeatCounts: nextCounts,
    retryRequestedKeys: nextRetry,
  };
}

export function approveSurahWirdForKid(
  profile: KidsProfile,
  surahNumber: number,
  startAyah: number,
  endAyah: number
): KidsProfile {
  let updated = { ...profile };
  const clamped = clampWirdRange(surahNumber, startAyah, endAyah);
  const newKeys: string[] = [];
  for (let a = clamped.startAyah; a <= clamped.endAyah; a++) {
    const key = makeAyahKey(clamped.surahNumber, a);
    if (!updated.masteredAyahKeys.includes(key)) {
      newKeys.push(key);
    }
  }

  updated.masteredAyahKeys = [...updated.masteredAyahKeys, ...newKeys];
  updated.stars += newKeys.length;
  updated.retryRequestedKeys = updated.retryRequestedKeys.filter(
    (k) => !newKeys.includes(k)
  );

  const meta = SURAHS_LIST.find((s) => s.number === clamped.surahNumber);
  if (meta && !updated.completedSurahs.includes(clamped.surahNumber)) {
    let allMastered = true;
    for (let i = 1; i <= meta.numberOfAyahs; i++) {
      if (!updated.masteredAyahKeys.includes(makeAyahKey(clamped.surahNumber, i))) {
        allMastered = false;
        break;
      }
    }
    if (allMastered) {
      updated.completedSurahs = [...updated.completedSurahs, clamped.surahNumber];
      updated.stars += 5;
    }
  }

  return updated;
}

export function applyRemoteMemberToProfile(
  profile: KidsProfile,
  remoteMember: {
    stars: number;
    masteredAyahKeys: string[];
    completedSurahs: number[];
    ayahRepeatCounts: Record<string, number>;
    retryRequestedKeys: string[];
    dailyWird: KidsDailyWird;
  },
  meta?: { circleTitle?: string; supervisorName?: string }
): KidsProfile {
  const clampedWird = clampWirdRange(
    remoteMember.dailyWird.surahNumber,
    remoteMember.dailyWird.startAyah,
    remoteMember.dailyWird.endAyah
  );
  const mergedMastered = Array.from(
    new Set([...profile.masteredAyahKeys, ...remoteMember.masteredAyahKeys])
  );
  const mergedCompleted = Array.from(
    new Set([...profile.completedSurahs, ...remoteMember.completedSurahs])
  );
  const mergedCounts: Record<string, number> = { ...profile.ayahRepeatCounts };
  for (const [k, v] of Object.entries(remoteMember.ayahRepeatCounts || {})) {
    mergedCounts[k] = Math.max(mergedCounts[k] || 0, v);
  }

  return {
    ...profile,
    stars: Math.max(profile.stars, remoteMember.stars),
    masteredAyahKeys: mergedMastered,
    completedSurahs: mergedCompleted,
    ayahRepeatCounts: mergedCounts,
    retryRequestedKeys: Array.isArray(remoteMember.retryRequestedKeys)
      ? remoteMember.retryRequestedKeys
      : profile.retryRequestedKeys,
    dailyWird: {
      ...remoteMember.dailyWird,
      ...clampedWird,
    },
    remoteLink: profile.remoteLink
      ? {
          ...profile.remoteLink,
          circleTitle: meta?.circleTitle || profile.remoteLink.circleTitle,
          supervisorName: meta?.supervisorName || profile.remoteLink.supervisorName,
        }
      : undefined,
  };
}

export function computeChildRepeatPauseMs(
  audioDurationSeconds: number,
  delayMode: KidsDelayMode
): number {
  const safeDuration = Number.isFinite(audioDurationSeconds) && audioDurationSeconds > 0
    ? Math.min(35, Math.max(1.5, audioDurationSeconds))
    : 3.5;

  if (delayMode === 'short') {
    return Math.round(Math.max(2500, safeDuration * 950));
  }
  if (delayMode === 'long') {
    return Math.round(Math.max(4500, safeDuration * 1700));
  }
  return Math.round(Math.max(3500, safeDuration * 1300));
}

export function resolveActiveWordIndex(
  segments: WordSegment[] | undefined,
  currentTimeMs: number,
  durationMs: number,
  totalWords: number,
  wordWeights?: number[]
): number {
  if (totalWords <= 0) return -1;

  if (Array.isArray(segments) && segments.length > 0) {
    if (currentTimeMs <= 0) return -1;

    let exactWordPos = -1;
    let lastStartedPos = -1;
    let lastStartedStartMs = -1;

    for (const seg of segments) {
      const wordPos = seg[0];
      const startMs = seg[2];
      const endMs = seg[3];
      if (currentTimeMs >= startMs && currentTimeMs <= endMs) {
        exactWordPos = wordPos;
        break;
      }
      if (currentTimeMs >= startMs && startMs >= lastStartedStartMs) {
        lastStartedStartMs = startMs;
        lastStartedPos = wordPos;
      }
    }

    if (exactWordPos >= 1) {
      return Math.max(0, Math.min(totalWords - 1, exactWordPos - 1));
    }
    if (lastStartedPos >= 1) {
      return Math.max(0, Math.min(totalWords - 1, lastStartedPos - 1));
    }
    // Leading silence before the reciter begins the first word
    return -1;
  }

  if (durationMs > 0 && currentTimeMs > 0) {
    if (Array.isArray(wordWeights) && wordWeights.length === totalWords) {
      // Account for typical ~8% trailing silence at the end of ayah audio and weight by syllable/letter length
      const activeSpeechDurationMs = durationMs * 0.92;
      const ratio = Math.max(0, Math.min(0.9999, currentTimeMs / activeSpeechDurationMs));
      const weighted = wordWeights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1) + 1.5);
      const totalWeight = weighted.reduce((acc, v) => acc + v, 0);
      const targetWeight = ratio * totalWeight;
      let cumulative = 0;
      for (let i = 0; i < weighted.length; i += 1) {
        cumulative += weighted[i];
        if (targetWeight < cumulative) {
          return i;
        }
      }
      return totalWords - 1;
    }

    const ratio = Math.max(0, Math.min(0.999, currentTimeMs / durationMs));
    return Math.floor(ratio * totalWords);
  }

  return -1;
}

export function generateParentGateChallenge(): ParentGateChallenge {
  const a = 3 + Math.floor(Math.random() * 6); // 3..8
  const b = 2 + Math.floor(Math.random() * 6); // 2..7
  return {
    a,
    b,
    answer: a * b,
    questionText: `كم ناتج ضرب ${a} × ${b} ؟`,
  };
}

export function formatParentGateQuestion(
  challenge: ParentGateChallenge,
  lang: AppLanguage
): string {
  if (lang === 'en') {
    return `What is ${challenge.a} × ${challenge.b}?`;
  }
  return challenge.questionText;
}

export function computeGardenStage(stars: number): {
  stageName: string;
  level: number;
  nextMilestone: number;
  progressPercent: number;
} {
  if (stars < 5) {
    return { stageName: 'بذرة طيبة', level: 1, nextMilestone: 5, progressPercent: Math.round((stars / 5) * 100) };
  }
  if (stars < 15) {
    return { stageName: 'برعم أخضر', level: 2, nextMilestone: 15, progressPercent: Math.round(((stars - 5) / 10) * 100) };
  }
  if (stars < 35) {
    return { stageName: 'شجيرة مثمرة', level: 3, nextMilestone: 35, progressPercent: Math.round(((stars - 15) / 20) * 100) };
  }
  if (stars < 70) {
    return { stageName: 'نخلة مباركة', level: 4, nextMilestone: 70, progressPercent: Math.round(((stars - 35) / 35) * 100) };
  }
  return { stageName: 'بستان الحفاظ', level: 5, nextMilestone: stars, progressPercent: 100 };
}

export function getGardenStageDisplayName(level: number, lang: AppLanguage): string {
  if (lang === 'en') {
    switch (level) {
      case 1:
        return 'Good Seed';
      case 2:
        return 'Green Sprout';
      case 3:
        return 'Fruitful Sapling';
      case 4:
        return 'Blessed Palm';
      default:
        return 'Huffaz Garden';
    }
  }
  switch (level) {
    case 1:
      return 'بذرة طيبة';
    case 2:
      return 'برعم أخضر';
    case 3:
      return 'شجيرة مثمرة';
    case 4:
      return 'نخلة مباركة';
    default:
      return 'بستان الحفاظ';
  }
}

export function playKidEncouragementSound(kind: 'prompt' | 'star' | 'surah'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, gainPeak = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (kind === 'prompt') {
      playTone(587.33, 0, 0.16, 0.05); // D5 soft cue for child turn
    } else if (kind === 'star') {
      playTone(523.25, 0, 0.14, 0.07); // C5
      playTone(659.25, 0.11, 0.18, 0.08); // E5
      playTone(783.99, 0.22, 0.26, 0.08); // G5
    } else {
      playTone(523.25, 0, 0.14, 0.08);
      playTone(659.25, 0.12, 0.14, 0.08);
      playTone(783.99, 0.24, 0.16, 0.08);
      playTone(1046.5, 0.36, 0.36, 0.09);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // AudioContext blocked or unsupported
  }
}
