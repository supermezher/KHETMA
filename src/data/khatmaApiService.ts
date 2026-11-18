export interface PartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
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
