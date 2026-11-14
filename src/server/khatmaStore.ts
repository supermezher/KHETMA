import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface PartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
}

export interface KhatmaRoom {
  roomId: string;
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  adminPinHash: string;
  parts: PartClaim[];
  createdAt: string;
  updatedAt: string;
}

export interface KhatmaRoomsDatabase {
  rooms: Record<string, KhatmaRoom>;
}

export const DEFAULT_ROOM_ID = 'public';

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

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin.trim()).digest('hex');
}

export function verifyPinHash(providedPin: string, storedHash: string): boolean {
  const providedBuf = Buffer.from(hashPin(providedPin), 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');
  if (providedBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, storedBuf);
}

export function isValidJuzNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 30;
}

export function normalizeRoomId(raw?: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_ROOM_ID;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleaned || cleaned.length < 2) return DEFAULT_ROOM_ID;
  return cleaned.slice(0, 40);
}

export function generateInitialParts(): PartClaim[] {
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

export function createDefaultPublicRoom(): KhatmaRoom {
  const now = new Date().toISOString();
  return {
    roomId: DEFAULT_ROOM_ID,
    dedicationTitle: 'ختمة البر والصدقة الجارية لجميع موتى المسلمين',
    creatorName: 'فاعل خير',
    deadlineDays: 3,
    adminPinHash: hashPin('1234'),
    parts: generateInitialParts(),
    createdAt: now,
    updatedAt: now,
  };
}

export class PinRateLimiter {
  private attempts = new Map<string, { count: number; blockedUntil: number }>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
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

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.attempts.get(key) || { count: 0, blockedUntil: 0 };
    const nextCount = entry.count + 1;
    const blockedUntil = nextCount >= this.maxAttempts ? now + this.windowMs : 0;
    this.attempts.set(key, { count: nextCount, blockedUntil });
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export function createKhatmaDatabase(dataDir = path.resolve(process.cwd(), 'data')) {
  const legacyFile = path.join(dataDir, 'collective_khatma.json');
  const roomsFile = path.join(dataDir, 'collective_khatmas.json');

  const save = (db: KhatmaRoomsDatabase): void => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(roomsFile, JSON.stringify(db, null, 2), 'utf-8');
  };

  const load = (): KhatmaRoomsDatabase => {
    try {
      if (fs.existsSync(roomsFile)) {
        const raw = fs.readFileSync(roomsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.rooms && parsed.rooms[DEFAULT_ROOM_ID]) {
          return parsed as KhatmaRoomsDatabase;
        }
      }
      // Migrate legacy single-room file if it exists
      if (fs.existsSync(legacyFile)) {
        const rawLegacy = fs.readFileSync(legacyFile, 'utf-8');
        const legacy = JSON.parse(rawLegacy);
        if (legacy && Array.isArray(legacy.parts) && legacy.parts.length === 30) {
          const migrated: KhatmaRoomsDatabase = {
            rooms: {
              [DEFAULT_ROOM_ID]: {
                roomId: DEFAULT_ROOM_ID,
                dedicationTitle: legacy.dedicationTitle || 'ختمة البر والصدقة الجارية لجميع موتى المسلمين',
                creatorName: legacy.creatorName || 'فاعل خير',
                deadlineDays: typeof legacy.deadlineDays === 'number' ? legacy.deadlineDays : 3,
                adminPinHash: legacy.adminPinHash || hashPin('1234'),
                parts: legacy.parts,
                createdAt: legacy.updatedAt || new Date().toISOString(),
                updatedAt: legacy.updatedAt || new Date().toISOString(),
              },
            },
          };
          save(migrated);
          return migrated;
        }
      }
    } catch (err) {
      console.error('Error loading khatma rooms database:', err);
    }

    const fresh: KhatmaRoomsDatabase = {
      rooms: {
        [DEFAULT_ROOM_ID]: createDefaultPublicRoom(),
      },
    };
    save(fresh);
    return fresh;
  };

  const db = load();

  return {
    getRoom(roomId?: string): KhatmaRoom | null {
      const normalized = normalizeRoomId(roomId);
      return db.rooms[normalized] || null;
    },
    listRoomSummaries() {
      return Object.values(db.rooms).map((r) => ({
        roomId: r.roomId,
        dedicationTitle: r.dedicationTitle,
        creatorName: r.creatorName,
        deadlineDays: r.deadlineDays,
        claimedCount: r.parts.filter((p) => p.claimedBy !== null).length,
        completedCount: r.parts.filter((p) => p.isCompleted).length,
        updatedAt: r.updatedAt,
      }));
    },
    createRoom(params: {
      requestedSlug?: string;
      dedicationTitle: string;
      creatorName: string;
      deadlineDays?: number;
      pin: string;
    }): { ok: true; room: KhatmaRoom } | { ok: false; status: number; error: string } {
      const title = typeof params.dedicationTitle === 'string' ? params.dedicationTitle.trim().slice(0, 160) : '';
      const creator = typeof params.creatorName === 'string' ? params.creatorName.trim().slice(0, 80) : '';
      const pin = typeof params.pin === 'string' ? params.pin.trim() : '';

      if (!title || title.length < 3) {
        return { ok: false, status: 400, error: 'يرجى كتابة عنوان واضح للختمة (3 أحرف على الأقل)' };
      }
      if (!creator) {
        return { ok: false, status: 400, error: 'يرجى كتابة اسم منشئ الختمة' };
      }
      if (pin.length < 4) {
        return { ok: false, status: 400, error: 'يجب أن لا يقل رمز المشرف للختمة الخاصة عن 4 أحرف أو أرقام' };
      }

      let roomId = '';
      if (params.requestedSlug && params.requestedSlug.trim()) {
        const cleaned = params.requestedSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (cleaned.length < 3) {
          return { ok: false, status: 400, error: 'معرف الرابط المخصص يجب أن يحتوي على 3 أحرف أو أرقام إنجليزية على الأقل' };
        }
        if (cleaned === DEFAULT_ROOM_ID || db.rooms[cleaned]) {
          return { ok: false, status: 409, error: 'هذا المعرف مستخدم بالفعل، يرجى اختيار معرف آخر' };
        }
        roomId = cleaned.slice(0, 40);
      } else {
        roomId = `k-${crypto.randomBytes(3).toString('hex')}`;
        while (db.rooms[roomId]) {
          roomId = `k-${crypto.randomBytes(3).toString('hex')}`;
        }
      }

      const parsedDays = Number(params.deadlineDays);
      const deadlineDays = Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 365
        ? Math.round(parsedDays)
        : 7;

      const now = new Date().toISOString();
      const room: KhatmaRoom = {
        roomId,
        dedicationTitle: title,
        creatorName: creator,
        deadlineDays,
        adminPinHash: hashPin(pin),
        parts: generateInitialParts(),
        createdAt: now,
        updatedAt: now,
      };
      db.rooms[roomId] = room;
      save(db);
      return { ok: true, room };
    },
    saveRoom(room: KhatmaRoom): void {
      room.updatedAt = new Date().toISOString();
      db.rooms[room.roomId] = room;
      save(db);
    },
  };
}
