export interface PartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
}

export function sanitizeLocalKhatmaParts(rawParts: unknown, fallbackParts: PartClaim[]): PartClaim[] {
  if (!Array.isArray(rawParts)) return fallbackParts;
  const byJuz = new Map<number, PartClaim>();

  for (const item of rawParts) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const juzNumber = rec.juzNumber;
    if (typeof juzNumber !== 'number' || !Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
      continue;
    }
    if (rec.claimedBy !== null && typeof rec.claimedBy !== 'string') {
      continue;
    }
    const base = fallbackParts.find((p) => p.juzNumber === juzNumber);
    const cleanedClaimedBy =
      rec.claimedBy === null ? null : rec.claimedBy.trim().slice(0, 60) || null;

    byJuz.set(juzNumber, {
      juzNumber,
      juzName:
        typeof rec.juzName === 'string' && rec.juzName.trim()
          ? rec.juzName.trim().slice(0, 60)
          : base?.juzName || `الجزء ${juzNumber}`,
      claimedBy: cleanedClaimedBy,
      claimedAt:
        cleanedClaimedBy && typeof rec.claimedAt === 'string' && rec.claimedAt.trim()
          ? rec.claimedAt.trim().slice(0, 40)
          : undefined,
      isCompleted: cleanedClaimedBy !== null && Boolean(rec.isCompleted),
      surahsCovered:
        typeof rec.surahsCovered === 'string' && rec.surahsCovered.trim()
          ? rec.surahsCovered.trim().slice(0, 120)
          : base?.surahsCovered,
    });
  }

  if (byJuz.size === 0) return fallbackParts;
  return fallbackParts.map((base) => byJuz.get(base.juzNumber) || base);
}

export interface KhatmaRoomSummary {
  roomId: string;
  isPublic: boolean;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  claimedCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface KhatmaStateResponse {
  success: boolean;
  roomId?: string;
  isPublic?: boolean;
  dedicationTitle?: string;
  creatorName?: string;
  deadlineDays?: number;
  parts?: PartClaim[];
  updatedAt?: string;
  error?: string;
}

export interface KhatmaMutationResponse {
  success: boolean;
  parts?: PartClaim[];
  claimedPart?: PartClaim;
  updatedPart?: PartClaim;
  claimToken?: string;
  dedicationTitle?: string;
  creatorName?: string;
  deadlineDays?: number;
  deleted?: boolean;
  message?: string;
  error?: string;
}

export async function fetchKhatmaRooms(): Promise<{
  success: boolean;
  rooms?: KhatmaRoomSummary[];
  error?: string;
}> {
  const res = await fetch('/api/khatma/rooms');
  return res.json();
}

export async function fetchKhatmaState(roomId = 'public'): Promise<KhatmaStateResponse> {
  const res = await fetch(`/api/khatma?roomId=${encodeURIComponent(roomId)}`);
  const data = (await res.json()) as KhatmaStateResponse;
  if (!res.ok && !data.error) {
    return { ...data, success: false, error: 'تعذر تحميل بيانات الختمة' };
  }
  return data;
}

export async function createKhatmaRoomApi(input: {
  requestedSlug?: string;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  adminSecret?: string;
}): Promise<{
  success: boolean;
  roomId?: string;
  isPublic?: boolean;
  dedicationTitle: string;
  creatorName?: string;
  deadlineDays?: number;
  parts?: PartClaim[];
  adminKey?: string;
  error?: string;
}> {
  const res = await fetch('/api/khatma/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function claimJuzApi(
  juzNumber: number,
  name: string,
  roomId = 'public'
): Promise<KhatmaMutationResponse> {
  const res = await fetch('/api/khatma/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juzNumber, name, roomId }),
  });
  return res.json();
}

export async function completeJuzApi(
  juzNumber: number,
  roomId = 'public',
  auth?: { claimToken?: string; adminKey?: string }
): Promise<KhatmaMutationResponse> {
  const res = await fetch('/api/khatma/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      juzNumber,
      roomId,
      claimToken: auth?.claimToken,
      adminKey: auth?.adminKey,
    }),
  });
  return res.json();
}

export async function releaseJuzApi(
  juzNumber: number,
  roomId = 'public',
  auth?: { claimToken?: string; adminKey?: string }
): Promise<KhatmaMutationResponse> {
  const res = await fetch('/api/khatma/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      juzNumber,
      roomId,
      claimToken: auth?.claimToken,
      adminKey: auth?.adminKey,
    }),
  });
  return res.json();
}

export async function verifyAdminKeyApi(
  adminKey: string,
  roomId = 'public'
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const res = await fetch('/api/khatma/verify-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey, roomId }),
  });
  return res.json();
}

export async function rotateAdminKeyApi(
  currentAdminKey: string,
  roomId = 'public'
): Promise<{ success: boolean; adminKey?: string; message?: string; error?: string }> {
  const res = await fetch('/api/khatma/rotate-admin-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentAdminKey, roomId }),
  });
  return res.json();
}

export async function executeAdminActionApi(
  adminKey: string,
  action: 'reset-all' | 'release-part' | 'edit-name' | 'update-dedication' | 'delete-room',
  payload?: {
    targetJuz?: number;
    newName?: string;
    dedicationTitle?: string;
    creatorName?: string;
    deadlineDays?: number;
  },
  roomId = 'public'
): Promise<KhatmaMutationResponse> {
  const res = await fetch('/api/khatma/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminKey,
      action,
      roomId,
      ...payload,
    }),
  });
  return res.json();
}
