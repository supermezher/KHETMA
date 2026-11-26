import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface PublicPartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
}

export interface ServerPartClaim extends PublicPartClaim {
  claimTokenHash?: string;
}

export interface KhatmaRoom {
  roomId: string;
  isPublic: boolean;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  adminKeyHash: string;
  parts: ServerPartClaim[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_ROOM_ID = 'public';
const MAX_TOTAL_ROOMS = 400;
const STALE_PRIVATE_ROOM_MS = 90 * 24 * 60 * 60 * 1000;
const RESERVED_ROOM_IDS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
]);

export const DEFAULT_JUZ_SURAS: Record<number, string> = {
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

export function generateCapabilitySecret(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret.trim(), salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecretHash(providedSecret: unknown, storedHash?: string): boolean {
  if (typeof providedSecret !== 'string' || !providedSecret.trim() || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    // Reject unsalted legacy hashes (e.g. old SHA-256 defaults)
    return false;
  }
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(providedSecret.trim(), salt, 32);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function isValidJuzNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 30;
}

/**
 * Normalizes a room ID and rejects prototype-pollution or reserved property keys.
 * Returns null if an explicit invalid/reserved value was supplied.
 */
export function normalizeRoomId(raw?: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_ROOM_ID;
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleaned || cleaned.length < 2 || RESERVED_ROOM_IDS.has(cleaned)) {
    return null;
  }
  return cleaned.slice(0, 64);
}

export function generateInitialParts(): ServerPartClaim[] {
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
}

export function sanitizePartsForClient(parts: ServerPartClaim[]): PublicPartClaim[] {
  return parts.map((p) => ({
    juzNumber: p.juzNumber,
    juzName: p.juzName,
    claimedBy: p.claimedBy,
    claimedAt: p.claimedAt,
    isCompleted: p.isCompleted,
    surahsCovered: p.surahsCovered,
  }));
}

export function createDefaultPublicRoom(): KhatmaRoom {
  const now = new Date().toISOString();
  const envSecret =
    typeof process.env.KHATMA_ADMIN_SECRET === 'string' && process.env.KHATMA_ADMIN_SECRET.trim().length >= 8
      ? process.env.KHATMA_ADMIN_SECRET.trim()
      : generateCapabilitySecret(16);

  return {
    roomId: DEFAULT_ROOM_ID,
    isPublic: true,
    dedicationTitle: 'ختمة البر والصدقة الجارية لجميع موتى المسلمين',
    creatorName: 'فاعل خير',
    deadlineDays: 3,
    adminKeyHash: hashSecret(envSecret),
    parts: generateInitialParts(),
    createdAt: now,
    updatedAt: now,
  };
}

export class SecretRateLimiter {
  private attempts = new Map<string, { count: number; blockedUntil: number; lastSeen: number }>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;

  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1000, maxEntries = 5000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  private cleanupExpired(now: number): void {
    for (const [k, entry] of this.attempts.entries()) {
      const expiredBlock = entry.blockedUntil > 0 && entry.blockedUntil <= now;
      const staleUnblocked = entry.blockedUntil === 0 && now - entry.lastSeen > this.windowMs;
      if (expiredBlock || staleUnblocked) {
        this.attempts.delete(k);
      }
    }
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    if (this.attempts.size > this.maxEntries) {
      this.cleanupExpired(now);
    }
    const entry = this.attempts.get(key);
    if (!entry) return { allowed: true, retryAfterSec: 0 };
    if (entry.blockedUntil > now) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000) };
    }
    if (entry.blockedUntil > 0 && entry.blockedUntil <= now) {
      this.attempts.delete(key);
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  recordAttempt(key: string, now = Date.now()): void {
    const existing = this.attempts.get(key);
    const isExpired =
      !existing ||
      (existing.blockedUntil > 0 && existing.blockedUntil <= now) ||
      (existing.blockedUntil === 0 && now - existing.lastSeen > this.windowMs);
    const entry = isExpired ? { count: 0, blockedUntil: 0, lastSeen: now } : existing;
    const nextCount = entry.count + 1;
    const blockedUntil = nextCount >= this.maxAttempts ? now + this.windowMs : 0;
    this.attempts.set(key, { count: nextCount, blockedUntil, lastSeen: now });
  }

  recordFailure(key: string, now = Date.now()): void {
    this.recordAttempt(key, now);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export function createKhatmaDatabase(dataDir = path.resolve(process.cwd(), 'data')) {
  const roomsFile = path.join(dataDir, 'collective_khatmas.json');

  const roomsMap = new Map<string, KhatmaRoom>();

  const save = (): void => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const serializedObj: Record<string, KhatmaRoom> = Object.create(null);
    for (const [id, room] of roomsMap.entries()) {
      if (!RESERVED_ROOM_IDS.has(id)) {
        serializedObj[id] = room;
      }
    }
    const payload = JSON.stringify({ rooms: serializedObj }, null, 2);
    const tmpFile = path.join(dataDir, `.collective_khatmas.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmpFile, payload, 'utf-8');
    fs.renameSync(tmpFile, roomsFile);
  };

  const pruneStalePrivateRooms = (): void => {
    const now = Date.now();
    for (const [id, room] of roomsMap.entries()) {
      if (room.isPublic || id === DEFAULT_ROOM_ID) continue;
      const updatedMs = new Date(room.updatedAt).getTime();
      const anyClaimed = room.parts.some((p) => p.claimedBy !== null);
      if (!anyClaimed && Number.isFinite(updatedMs) && now - updatedMs > STALE_PRIVATE_ROOM_MS) {
        roomsMap.delete(id);
      }
    }
  };

  const load = (): void => {
    if (fs.existsSync(roomsFile)) {
      try {
        const raw = fs.readFileSync(roomsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.rooms || typeof parsed.rooms !== 'object') {
          throw new Error('Malformed rooms database root');
        }

        let needsResave = false;
        for (const [key, value] of Object.entries(parsed.rooms as Record<string, unknown>)) {
          if (RESERVED_ROOM_IDS.has(key.toLowerCase()) || !value || typeof value !== 'object') continue;
          const r = value as Partial<KhatmaRoom> & { adminPinHash?: string };
          const roomId = normalizeRoomId(r.roomId || key);
          if (!roomId || !Array.isArray(r.parts) || r.parts.length !== 30) continue;

          // Upgrade legacy SHA-256 / unsalted hashes so default '1234' can never be accepted
          let adminKeyHash = typeof r.adminKeyHash === 'string' && r.adminKeyHash.includes(':')
            ? r.adminKeyHash
            : '';
          if (!adminKeyHash) {
            const replacement =
              roomId === DEFAULT_ROOM_ID &&
              typeof process.env.KHATMA_ADMIN_SECRET === 'string' &&
              process.env.KHATMA_ADMIN_SECRET.trim().length >= 8
                ? process.env.KHATMA_ADMIN_SECRET.trim()
                : generateCapabilitySecret(16);
            adminKeyHash = hashSecret(replacement);
            needsResave = true;
          }

          roomsMap.set(roomId, {
            roomId,
            isPublic: typeof r.isPublic === 'boolean' ? r.isPublic : roomId === DEFAULT_ROOM_ID,
            dedicationTitle: typeof r.dedicationTitle === 'string' ? r.dedicationTitle : 'ختمة جماعية مباركة',
            creatorName: typeof r.creatorName === 'string' ? r.creatorName : 'فاعل خير',
            deadlineDays: typeof r.deadlineDays === 'number' ? r.deadlineDays : 7,
            adminKeyHash,
            parts: r.parts,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
            updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
          });
        }

        if (!roomsMap.has(DEFAULT_ROOM_ID)) {
          roomsMap.set(DEFAULT_ROOM_ID, createDefaultPublicRoom());
          needsResave = true;
        }
        if (needsResave) {
          save();
        }
        return;
      } catch (err) {
        // Quarantine corrupted file cleanly instead of silently discarding user data
        const quarantinePath = path.join(
          dataDir,
          `collective_khatmas.corrupted.${Date.now()}.json`
        );
        try {
          fs.renameSync(roomsFile, quarantinePath);
          console.error(
            `[khatmaStore] Corrupted database quarantined to ${quarantinePath}:`,
            err
          );
        } catch (quarantineErr) {
          console.error('[khatmaStore] Failed to quarantine corrupted database:', quarantineErr);
        }
      }
    }

    roomsMap.set(DEFAULT_ROOM_ID, createDefaultPublicRoom());
    save();
  };

  load();

  return {
    getRoom(roomId?: string): KhatmaRoom | null {
      const normalized = normalizeRoomId(roomId);
      if (!normalized) return null;
      return roomsMap.get(normalized) || null;
    },
    /** Lists ONLY public rooms; private rooms are strictly hidden from enumeration */
    listPublicRoomSummaries() {
      const result = [];
      for (const r of roomsMap.values()) {
        if (!r.isPublic) continue;
        result.push({
          roomId: r.roomId,
          dedicationTitle: r.dedicationTitle,
          creatorName: r.creatorName,
          deadlineDays: r.deadlineDays,
          claimedCount: r.parts.filter((p) => p.claimedBy !== null).length,
          completedCount: r.parts.filter((p) => p.isCompleted).length,
          updatedAt: r.updatedAt,
        });
      }
      return result;
    },
    createRoom(params: {
      requestedSlug?: string;
      dedicationTitle: string;
      creatorName: string;
      deadlineDays?: number;
      adminSecret?: string;
    }): { ok: true; room: KhatmaRoom; adminKey: string } | { ok: false; status: number; error: string } {
      pruneStalePrivateRooms();
      if (roomsMap.size >= MAX_TOTAL_ROOMS) {
        return {
          ok: false,
          status: 429,
          error: 'تم بلوغ الحد الأقصى للغرف النشطة حالياً، يرجى المحاولة لاحقاً.',
        };
      }

      const title = typeof params.dedicationTitle === 'string' ? params.dedicationTitle.trim().slice(0, 160) : '';
      const creator = typeof params.creatorName === 'string' ? params.creatorName.trim().slice(0, 80) : '';

      if (!title || title.length < 3) {
        return { ok: false, status: 400, error: 'يرجى كتابة عنوان واضح للختمة (3 أحرف على الأقل)' };
      }
      if (!creator) {
        return { ok: false, status: 400, error: 'يرجى كتابة اسم منشئ الختمة' };
      }

      let roomId = '';
      if (params.requestedSlug && params.requestedSlug.trim()) {
        const normalizedSlug = normalizeRoomId(params.requestedSlug);
        if (!normalizedSlug || normalizedSlug.length < 6) {
          return {
            ok: false,
            status: 400,
            error: 'معرف الرابط المخصص يجب أن يحتوي على 6 أحرف أو أرقام إنجليزية على الأقل',
          };
        }
        if (normalizedSlug === DEFAULT_ROOM_ID || roomsMap.has(normalizedSlug)) {
          return { ok: false, status: 409, error: 'هذا المعرف غير متاح، يرجى اختيار معرف آخر' };
        }
        roomId = normalizedSlug;
      } else {
        // High-entropy unguessable room ID (12 bytes = 24 hex chars)
        roomId = `k-${crypto.randomBytes(12).toString('hex')}`;
        while (roomsMap.has(roomId)) {
          roomId = `k-${crypto.randomBytes(12).toString('hex')}`;
        }
      }

      const parsedDays = Number(params.deadlineDays);
      const deadlineDays = Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 365
        ? Math.round(parsedDays)
        : 7;

      // Always issue a 128-bit cryptographic secret key for room administration (no weak 4-digit PINs)
      const adminKey =
        typeof params.adminSecret === 'string' && params.adminSecret.trim().length >= 12
          ? params.adminSecret.trim()
          : generateCapabilitySecret(16);

      const now = new Date().toISOString();
      const room: KhatmaRoom = {
        roomId,
        isPublic: false,
        dedicationTitle: title,
        creatorName: creator,
        deadlineDays,
        adminKeyHash: hashSecret(adminKey),
        parts: generateInitialParts(),
        createdAt: now,
        updatedAt: now,
      };
      roomsMap.set(roomId, room);
      save();
      return { ok: true, room, adminKey };
    },
    saveRoom(room: KhatmaRoom): void {
      room.updatedAt = new Date().toISOString();
      roomsMap.set(room.roomId, room);
      save();
    },
    deletePrivateRoom(roomId: string): boolean {
      if (roomId === DEFAULT_ROOM_ID) return false;
      const room = roomsMap.get(roomId);
      if (!room || room.isPublic) return false;
      const deleted = roomsMap.delete(roomId);
      if (deleted) save();
      return deleted;
    },
  };
}
