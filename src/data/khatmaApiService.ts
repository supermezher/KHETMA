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
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  claimedCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface KhatmaApiResponse {
  success: boolean;
  roomId: string;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  parts: PartClaim[];
  updatedAt: string;
  isDefaultPin: boolean;
  error?: string;
}

export async function fetchKhatmaRooms(): Promise<{ success: boolean; rooms: KhatmaRoomSummary[] }> {
  const res = await fetch('/api/khatma/rooms');
  if (!res.ok) {
    throw new Error(`Failed to fetch rooms: ${res.statusText}`);
  }
  return res.json();
}

export async function createKhatmaRoomApi(payload: {
  requestedSlug?: string;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  pin: string;
}): Promise<KhatmaApiResponse> {
  const res = await fetch('/api/khatma/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchKhatmaState(roomId = 'public'): Promise<KhatmaApiResponse> {
  const res = await fetch(`/api/khatma?roomId=${encodeURIComponent(roomId)}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to fetch khatma: ${res.statusText}`);
  }
  return res.json();
}

export async function claimJuzApi(juzNumber: number, name: string, roomId = 'public'): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, juzNumber, name }),
  });
  return res.json();
}

export async function completeJuzApi(juzNumber: number, roomId = 'public'): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, juzNumber }),
  });
  return res.json();
}

export async function releaseJuzApi(juzNumber: number, roomId = 'public'): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, juzNumber }),
  });
  return res.json();
}

export async function verifyAdminPinApi(pin: string, roomId = 'public'): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const res = await fetch('/api/khatma/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, pin }),
  });
  return res.json();
}

export async function changeAdminPinApi(currentPin: string, newPin: string, roomId = 'public'): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/khatma/change-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, currentPin, newPin }),
  });
  return res.json();
}

export async function executeAdminActionApi(
  pin: string,
  action: 'reset-all' | 'release-part' | 'edit-name' | 'update-dedication',
  payload?: { targetJuz?: number; newName?: string; dedicationTitle?: string; creatorName?: string; deadlineDays?: number },
  roomId = 'public'
): Promise<{ success: boolean; parts?: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      pin,
      action,
      ...payload,
    }),
  });
  return res.json();
}
