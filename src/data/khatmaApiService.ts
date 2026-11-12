export interface PartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
}

export interface KhatmaApiResponse {
  success: boolean;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  parts: PartClaim[];
  updatedAt: string;
  isDefaultPin: boolean;
  error?: string;
}

export async function fetchKhatmaState(): Promise<KhatmaApiResponse> {
  const res = await fetch('/api/khatma');
  if (!res.ok) {
    throw new Error(`Failed to fetch khatma: ${res.statusText}`);
  }
  return res.json();
}

export async function claimJuzApi(juzNumber: number, name: string): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juzNumber, name }),
  });
  return res.json();
}

export async function completeJuzApi(juzNumber: number): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juzNumber }),
  });
  return res.json();
}

export async function releaseJuzApi(juzNumber: number): Promise<{ success: boolean; parts: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juzNumber }),
  });
  return res.json();
}

export async function verifyAdminPinApi(pin: string): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const res = await fetch('/api/khatma/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return res.json();
}

export async function changeAdminPinApi(currentPin: string, newPin: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/khatma/change-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPin, newPin }),
  });
  return res.json();
}

export async function executeAdminActionApi(
  pin: string,
  action: 'reset-all' | 'release-part' | 'edit-name' | 'update-dedication',
  payload?: { targetJuz?: number; newName?: string; dedicationTitle?: string; creatorName?: string; deadlineDays?: number }
): Promise<{ success: boolean; parts?: PartClaim[]; error?: string }> {
  const res = await fetch('/api/khatma/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin,
      action,
      ...payload,
    }),
  });
  return res.json();
}
