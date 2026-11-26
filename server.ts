import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createKhatmaDatabase,
  DEFAULT_ROOM_ID,
  isValidJuzNumber,
  generateCapabilitySecret,
  hashSecret,
  verifySecretHash,
  SecretRateLimiter,
  normalizeRoomId,
  sanitizePartsForClient,
} from './src/server/khatmaStore';
import {
  createKidsCircleDatabase,
  normalizeCircleCode,
  sanitizeMemberForClient,
} from './src/server/kidsCircleStore';

function getClientIp(req: express.Request): string {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

function resolveRoomId(req: express.Request): string | null {
  const raw = (req.body && req.body.roomId) ?? req.query.roomId ?? DEFAULT_ROOM_ID;
  return normalizeRoomId(raw);
}

function getCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) {
    return eqArg.slice(flag.length + 1);
  }
  return undefined;
}

export const jsonErrorHandler: express.ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err?.status || err?.statusCode || 500);
  const isParseError = err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && status === 400);
  const isTooLarge = err?.type === 'entity.too.large' || status === 413;
  const known = isParseError || isTooLarge || status === 400;
  const httpStatus = isTooLarge ? 413 : isParseError || status === 400 ? 400 : 500;
  if (!known) {
    console.error('[server]', err);
  }
  res.status(httpStatus).json({
    success: false,
    error: isTooLarge
      ? 'حجم الطلب أكبر من المسموح'
      : isParseError || httpStatus === 400
      ? 'صيغة الطلب غير صالحة'
      : 'حدث خطأ داخلي في الخادم',
  });
};

export interface CreateServerAppOptions {
  khatmaDataDir?: string;
  kidsCircleFilePath?: string;
  isProduction?: boolean;
  mountErrorHandler?: boolean;
}

export function createServerApp(options: CreateServerAppOptions = {}) {
  const app = express();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

  const khatmaDb = createKhatmaDatabase(options.khatmaDataDir);
  const kidsCircleDb = createKidsCircleDatabase(options.kidsCircleFilePath);
  const adminRateLimiter = new SecretRateLimiter(5, 5 * 60 * 1000);
  const roomCreateRateLimiter = new SecretRateLimiter(6, 60 * 60 * 1000);
  const claimLimiter = new SecretRateLimiter(10, 10 * 60 * 1000);
  const kidsCircleAdminLimiter = new SecretRateLimiter(6, 5 * 60 * 1000);
  const kidsCircleCreateLimiter = new SecretRateLimiter(8, 60 * 60 * 1000);
  const kidsJoinLimiter = new SecretRateLimiter(10, 60 * 60 * 1000);
  const kidsPreviewLimiter = new SecretRateLimiter(30, 60 * 1000);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const json64kb = express.json({ limit: '64kb' });
  const json2mb = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/kids-circle')) {
      return json2mb(req, res, next);
    }
    return json64kb(req, res, next);
  });

  // Baseline Security Headers (+ strict CSP in production)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    if (isProduction) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob:",
          "media-src 'self' blob: data: https://everyayah.com",
          "connect-src 'self' https://api.alquran.cloud https://api.quran.com https://everyayah.com",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
        ].join('; ')
      );
    }
    next();
  });

  // Never expose server code, .env, or persistent khatma database files
  app.use((req, res, next) => {
    const normalizedPath = path.posix.normalize('/' + req.path).toLowerCase();
    if (
      normalizedPath === '/data' ||
      normalizedPath.startsWith('/data/') ||
      normalizedPath.startsWith('/.env') ||
      normalizedPath === '/server.ts' ||
      normalizedPath === '/src/server' ||
      normalizedPath.startsWith('/src/server/')
    ) {
      return res.status(403).json({ success: false, error: 'غير مصرح بالوصول' });
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // API ROUTES FOR MULTI-ROOM COLLECTIVE KHATMA (CAPABILITY TOKEN SECURITY)
  // ---------------------------------------------------------------------------

  // 0. List ONLY public room summaries (private rooms are strictly unlisted)
  app.get('/api/khatma/rooms', (_req, res) => {
    res.json({
      success: true,
      rooms: khatmaDb.listPublicRoomSummaries(),
    });
  });

  // 0b. Create a new unlisted private/shared Khatma room (issues 128-bit secret adminKey once)
  app.post('/api/khatma/rooms', (req, res) => {
    const clientIp = getClientIp(req);
    const rateKey = `create:${clientIp}`;
    const limitCheck = roomCreateRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز حد إنشاء الغرف مؤقتاً. يرجى المحاولة بعد ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    const { requestedSlug, dedicationTitle, creatorName, deadlineDays, adminSecret } = req.body || {};
    const result = khatmaDb.createRoom({
      requestedSlug,
      dedicationTitle,
      creatorName,
      deadlineDays,
      adminSecret,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    roomCreateRateLimiter.recordAttempt(rateKey);
    const { room, adminKey } = result;
    return res.status(201).json({
      success: true,
      roomId: room.roomId,
      isPublic: room.isPublic,
      dedicationTitle: room.dedicationTitle,
      creatorName: room.creatorName,
      deadlineDays: room.deadlineDays,
      parts: sanitizePartsForClient(room.parts),
      updatedAt: room.updatedAt,
      adminKey, // Returned ONCE upon creation so creator saves/shares the secret supervisor link
    });
  });

  // 1. Get Live Khatma State for a Room
  app.get('/api/khatma', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على الختمة المطلوبة' });
    }

    return res.json({
      success: true,
      roomId: room.roomId,
      isPublic: room.isPublic,
      dedicationTitle: room.dedicationTitle,
      creatorName: room.creatorName,
      deadlineDays: room.deadlineDays,
      parts: sanitizePartsForClient(room.parts),
      updatedAt: room.updatedAt,
    });
  });

  // 2. Claim a Juz (Issues a per-claim 128-bit secret claimToken once)
  app.post('/api/khatma/claim', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const claimRateKey = `claim:${getClientIp(req)}:${room.roomId}`;
    const claimLimit = claimLimiter.check(claimRateKey);
    if (!claimLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز حد محاولات الحجز مؤقتاً. يرجى المحاولة بعد ${claimLimit.retryAfterSec} ثانية`,
      });
    }
    claimLimiter.recordAttempt(claimRateKey);

    const { juzNumber, name } = req.body || {};
    if (!isValidJuzNumber(juzNumber)) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const rawName = typeof name === 'string' ? name.trim() : '';
    const trimmedName = rawName.slice(0, 60) || 'قارئ محب للخير';

    const part = room.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    if (part.claimedBy !== null) {
      return res.status(409).json({
        success: false,
        error: `عذراً، تم حجز الجزء ${juzNumber} بالفعل باسم (${part.claimedBy})`,
        parts: sanitizePartsForClient(room.parts),
      });
    }

    const claimToken = generateCapabilitySecret(16);
    part.claimedBy = trimmedName;
    part.claimedAt = new Date().toISOString();
    part.isCompleted = false;
    part.claimTokenHash = hashSecret(claimToken);

    khatmaDb.saveRoom(room);
    const clientParts = sanitizePartsForClient(room.parts);
    return res.json({
      success: true,
      parts: clientParts,
      claimedPart: clientParts.find((p) => p.juzNumber === juzNumber),
      claimToken, // Returned once to the claimer's browser
    });
  });

  // 3. Toggle Part Completion (Requires matching claimToken OR room adminKey)
  app.post('/api/khatma/complete', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { juzNumber, claimToken, adminKey } = req.body || {};
    if (!isValidJuzNumber(juzNumber)) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const part = room.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }
    if (part.claimedBy === null) {
      return res.status(400).json({
        success: false,
        error: 'لا يمكن إتمام جزء شاغر قبل حجزه',
        parts: sanitizePartsForClient(room.parts),
      });
    }

    const isClaimOwner = verifySecretHash(claimToken, part.claimTokenHash);
    const isAdmin = verifySecretHash(adminKey, room.adminKeyHash);
    if (!isClaimOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح: يمكن لصاحب الحجز (من المتصفح الذي حجز منه) أو مشرف الغرفة فقط تعديل حالة الإتمام',
        parts: sanitizePartsForClient(room.parts),
      });
    }

    part.isCompleted = !part.isCompleted;
    khatmaDb.saveRoom(room);
    const clientParts = sanitizePartsForClient(room.parts);
    return res.json({
      success: true,
      parts: clientParts,
      updatedPart: clientParts.find((p) => p.juzNumber === juzNumber),
    });
  });

  // 4. Release a Part (Requires matching claimToken OR room adminKey)
  app.post('/api/khatma/release', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { juzNumber, claimToken, adminKey } = req.body || {};
    if (!isValidJuzNumber(juzNumber)) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const part = room.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    const isClaimOwner = verifySecretHash(claimToken, part.claimTokenHash);
    const isAdmin = verifySecretHash(adminKey, room.adminKeyHash);
    if (!isClaimOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح: تفريغ الجزء متاح فقط لصاحب الحجز من متصفحه أو لمشرف الغرفة',
        parts: sanitizePartsForClient(room.parts),
      });
    }

    part.claimedBy = null;
    part.claimedAt = undefined;
    part.isCompleted = false;
    part.claimTokenHash = undefined;

    khatmaDb.saveRoom(room);
    return res.json({ success: true, parts: sanitizePartsForClient(room.parts) });
  });

  // 5. Verify Room Supervisor Secret Key (Rate-Limited per real IP + room)
  app.post('/api/khatma/verify-admin', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { adminKey } = req.body || {};
    if (typeof adminKey !== 'string' || !adminKey.trim()) {
      return res.status(400).json({ success: false, error: 'مفتاح المشرف السري مطلوب' });
    }

    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = adminRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (verifySecretHash(adminKey, room.adminKeyHash)) {
      adminRateLimiter.reset(rateKey);
      return res.json({ success: true, verified: true });
    }

    adminRateLimiter.recordFailure(rateKey);
    return res.status(401).json({ success: false, verified: false, error: 'مفتاح المشرف السري غير صحيح' });
  });

  // 6. Rotate Supervisor Secret Key (Generates a fresh 128-bit cryptographic secret key)
  app.post('/api/khatma/rotate-admin-key', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { currentAdminKey } = req.body || {};
    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = adminRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (!verifySecretHash(currentAdminKey, room.adminKeyHash)) {
      adminRateLimiter.recordFailure(rateKey);
      return res.status(401).json({ success: false, error: 'مفتاح المشرف الحالي غير صحيح' });
    }

    adminRateLimiter.reset(rateKey);
    const nextAdminKey = generateCapabilitySecret(16);
    room.adminKeyHash = hashSecret(nextAdminKey);
    khatmaDb.saveRoom(room);
    return res.json({
      success: true,
      adminKey: nextAdminKey,
      message: 'تم تدوير مفتاح المشرف السري بنجاح؛ يُرجى حفظ الرابط الجديد',
    });
  });

  // 7. Administrative Action (Guarded by Rate-Limited 128-bit Secret Key Verification)
  app.post('/api/khatma/admin-action', (req, res) => {
    const roomId = resolveRoomId(req);
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'معرف الغرفة غير صالح' });
    }
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { adminKey, action, targetJuz, newName, dedicationTitle, creatorName, deadlineDays } = req.body || {};
    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = adminRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (!verifySecretHash(adminKey, room.adminKeyHash)) {
      adminRateLimiter.recordFailure(rateKey);
      return res.status(403).json({ success: false, error: 'غير مصرح: مفتاح المشرف غير صحيح' });
    }
    adminRateLimiter.reset(rateKey);

    if (action === 'reset-all') {
      room.parts = room.parts.map((p) => ({
        ...p,
        claimedBy: null,
        claimedAt: undefined,
        isCompleted: false,
        claimTokenHash: undefined,
      }));
      khatmaDb.saveRoom(room);
      return res.json({
        success: true,
        parts: sanitizePartsForClient(room.parts),
        message: 'تمت إعادة ضبط الختمة وبدء دورة جديدة',
      });
    }

    if (action === 'release-part') {
      if (!isValidJuzNumber(targetJuz)) {
        return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
      }
      const part = room.parts.find((p) => p.juzNumber === targetJuz);
      if (!part) {
        return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
      }
      part.claimedBy = null;
      part.claimedAt = undefined;
      part.isCompleted = false;
      part.claimTokenHash = undefined;
      khatmaDb.saveRoom(room);
      return res.json({ success: true, parts: sanitizePartsForClient(room.parts) });
    }

    if (action === 'edit-name') {
      if (!isValidJuzNumber(targetJuz) || typeof newName !== 'string' || !newName.trim()) {
        return res.status(400).json({ success: false, error: 'بيانات تعديل الاسم غير صالحة' });
      }
      const part = room.parts.find((p) => p.juzNumber === targetJuz);
      if (!part) {
        return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
      }
      part.claimedBy = newName.trim().slice(0, 60);
      khatmaDb.saveRoom(room);
      return res.json({ success: true, parts: sanitizePartsForClient(room.parts) });
    }

    if (action === 'update-dedication') {
      if (typeof dedicationTitle === 'string' && dedicationTitle.trim()) {
        room.dedicationTitle = dedicationTitle.trim().slice(0, 160);
      }
      if (typeof creatorName === 'string' && creatorName.trim()) {
        room.creatorName = creatorName.trim().slice(0, 80);
      }
      if (deadlineDays !== undefined) {
        const parsedDays = Number(deadlineDays);
        if (Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 365) {
          room.deadlineDays = Math.round(parsedDays);
        }
      }
      khatmaDb.saveRoom(room);
      return res.json({
        success: true,
        dedicationTitle: room.dedicationTitle,
        creatorName: room.creatorName,
        deadlineDays: room.deadlineDays,
      });
    }

    if (action === 'delete-room') {
      if (room.isPublic || room.roomId === DEFAULT_ROOM_ID) {
        return res.status(400).json({ success: false, error: 'لا يمكن حذف الختمة العامة' });
      }
      khatmaDb.deletePrivateRoom(room.roomId);
      return res.json({ success: true, deleted: true });
    }

    return res.status(400).json({ success: false, error: 'إجراء غير معروف' });
  });

  // ---------------------------------------------------------------------------
  // API ROUTES FOR KIDS HIFZ CIRCLES (REMOTE LINKING & ASYNC VOICE INBOX)
  // ---------------------------------------------------------------------------

  // 1. Create a Kids Hifz Circle (returns 6-digit circleCode & 128-bit adminKey once)
  app.post('/api/kids-circle/create', (req, res) => {
    const clientIp = getClientIp(req);
    const rateKey = `kids-create:${clientIp}`;
    const limitCheck = kidsCircleCreateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز حد إنشاء حلقات الأطفال مؤقتاً. يرجى المحاولة بعد ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    const { title, supervisorName } = req.body || {};
    const result = kidsCircleDb.createCircle({ title, supervisorName });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    kidsCircleCreateLimiter.recordAttempt(rateKey);
    const { circle, adminKey } = result;
    return res.status(201).json({
      success: true,
      circleCode: circle.circleCode,
      title: circle.title,
      supervisorName: circle.supervisorName,
      adminKey,
      kids: [],
      submissions: [],
      updatedAt: circle.updatedAt,
    });
  });

  // 2. Fetch Circle State (Admin sees all kids + voice inbox; authenticated kid sees own profile + own clips)
  app.get('/api/kids-circle/:code', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة يجب أن يتكون من ٦ أرقام' });
    }

    const adminKey = req.get('x-admin-key');
    const kidToken = req.get('x-kid-token');
    const kidId = typeof req.query.kidId === 'string' ? req.query.kidId : '';

    if (!adminKey && !(kidId && kidToken)) {
      const previewKey = `kids-preview:${getClientIp(req)}`;
      const previewLimit = kidsPreviewLimiter.check(previewKey);
      if (!previewLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: `تم تجاوز حد المعاينة المسموح به. يرجى المحاولة بعد ${previewLimit.retryAfterSec} ثانية`,
        });
      }
      kidsPreviewLimiter.recordAttempt(previewKey);
    }

    const circle = kidsCircleDb.getCircle(code);
    if (!circle) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على حلقة بهذا الكود' });
    }

    if (adminKey) {
      const rateKey = `kids-get-admin:${getClientIp(req)}:${circle.circleCode}`;
      const limitCheck = kidsCircleAdminLimiter.check(rateKey);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
        });
      }
      if (verifySecretHash(adminKey, circle.adminKeyHash)) {
        kidsCircleAdminLimiter.reset(rateKey);
        return res.json({
          success: true,
          role: 'admin',
          circleCode: circle.circleCode,
          title: circle.title,
          supervisorName: circle.supervisorName,
          kidsCount: circle.kids.length,
          kids: circle.kids.map(sanitizeMemberForClient),
          submissions: circle.submissions,
          updatedAt: circle.updatedAt,
        });
      }
      kidsCircleAdminLimiter.recordFailure(rateKey);
      return res.status(403).json({ success: false, error: 'مفتاح المشرف غير صحيح' });
    }

    if (kidId && kidToken) {
      const member = circle.kids.find((k) => k.kidId === kidId);
      if (!member || !verifySecretHash(kidToken, member.kidTokenHash)) {
        return res.status(403).json({ success: false, error: 'تعذر التحقق من جلسة الطفل في الحلقة' });
      }
      const mySubmissions = circle.submissions.filter((s) => s.kidId === member.kidId);
      return res.json({
        success: true,
        role: 'kid',
        circleCode: circle.circleCode,
        title: circle.title,
        supervisorName: circle.supervisorName,
        kidsCount: circle.kids.length,
        member: sanitizeMemberForClient(member),
        submissions: mySubmissions,
        updatedAt: circle.updatedAt,
      });
    }

    return res.json({
      success: true,
      role: 'preview',
      circleCode: circle.circleCode,
      title: circle.title,
      supervisorName: circle.supervisorName,
      kidsCount: circle.kids.length,
      updatedAt: circle.updatedAt,
    });
  });

  // 3. Join a Circle as a Child (receives kidId & 128-bit kidToken once)
  app.post('/api/kids-circle/:code/join', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة يجب أن يتكون من ٦ أرقام' });
    }

    const joinRateKey = `join:${getClientIp(req)}:${code}`;
    const joinLimit = kidsJoinLimiter.check(joinRateKey);
    if (!joinLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز حد محاولات الانضمام للحلقة مؤقتاً. يرجى المحاولة بعد ${joinLimit.retryAfterSec} ثانية`,
      });
    }
    kidsJoinLimiter.recordAttempt(joinRateKey);

    const { name, avatarId, initialWird } = req.body || {};
    const result = kidsCircleDb.joinCircle(code, { name, avatarId, initialWird });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.status(201).json({
      success: true,
      circleCode: result.circle.circleCode,
      title: result.circle.title,
      supervisorName: result.circle.supervisorName,
      member: result.member,
      kidToken: result.kidToken,
      updatedAt: result.circle.updatedAt,
    });
  });

  // 4. Verify Circle Supervisor Admin Key
  app.post('/api/kids-circle/:code/verify-admin', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة غير صالح' });
    }
    const circle = kidsCircleDb.getCircle(code);
    if (!circle) {
      return res.status(404).json({ success: false, error: 'الحلقة غير موجودة' });
    }
    const adminKey = req.body?.adminKey ?? req.get('x-admin-key');
    if (typeof adminKey !== 'string' || !adminKey.trim()) {
      return res.status(400).json({ success: false, error: 'مفتاح المشرف مطلوب' });
    }

    const rateKey = `kids-verify:${getClientIp(req)}:${circle.circleCode}`;
    const limitCheck = kidsCircleAdminLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (kidsCircleDb.verifyAdmin(circle.circleCode, adminKey)) {
      kidsCircleAdminLimiter.reset(rateKey);
      return res.json({
        success: true,
        verified: true,
        circleCode: circle.circleCode,
        title: circle.title,
        supervisorName: circle.supervisorName,
      });
    }

    kidsCircleAdminLimiter.recordFailure(rateKey);
    return res.status(401).json({ success: false, verified: false, error: 'مفتاح المشرف غير صحيح' });
  });

  // 5. Update Kid Daily Wird Remotely (Supervisor Admin Key Required)
  app.post('/api/kids-circle/:code/wird', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة غير صالح' });
    }
    const { kidId, wird } = req.body || {};
    const adminKey = req.body?.adminKey ?? req.get('x-admin-key');
    if (typeof kidId !== 'string' || !kidId.trim()) {
      return res.status(400).json({ success: false, error: 'معرف الطفل مطلوب' });
    }

    const rateKey = `kids-wird:${getClientIp(req)}:${code}`;
    const limitCheck = kidsCircleAdminLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    const result = kidsCircleDb.updateKidWird(code, adminKey, kidId, wird || {});
    if (!result.ok) {
      if (result.status === 403) kidsCircleAdminLimiter.recordFailure(rateKey);
      return res.status(result.status).json({ success: false, error: result.error });
    }
    kidsCircleAdminLimiter.reset(rateKey);
    return res.json({ success: true, member: result.member });
  });

  // 6. Sync Kid Progress (Kid Token or Admin Key Required)
  app.post('/api/kids-circle/:code/progress', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة غير صالح' });
    }
    const { kidId, stars, masteredAyahKeys, completedSurahs, ayahRepeatCounts } = req.body || {};
    const kidToken = req.body?.kidToken ?? req.get('x-kid-token');
    const adminKey = req.body?.adminKey ?? req.get('x-admin-key');

    if (typeof kidId !== 'string' || !kidId.trim()) {
      return res.status(400).json({ success: false, error: 'معرف الطفل مطلوب' });
    }

    const result = kidsCircleDb.syncKidProgress(
      code,
      kidId,
      { kidToken, adminKey },
      { stars, masteredAyahKeys, completedSurahs, ayahRepeatCounts }
    );
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.json({ success: true, member: result.member });
  });

  // 7. Submit Async Child Voice Recitation (Kid Token Required)
  app.post('/api/kids-circle/:code/submissions', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة غير صالح' });
    }
    const {
      kidId,
      surahNumber,
      ayahNumber,
      endAyahNumber,
      audioDataUrl,
      mimeType,
      durationSec,
    } = req.body || {};
    const kidToken = req.body?.kidToken ?? req.get('x-kid-token');

    if (typeof kidId !== 'string' || !kidId.trim()) {
      return res.status(400).json({ success: false, error: 'معرف الطفل مطلوب' });
    }

    const result = kidsCircleDb.addVoiceSubmission(code, kidId, kidToken, {
      surahNumber,
      ayahNumber,
      endAyahNumber,
      audioDataUrl,
      mimeType,
      durationSec,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, submission: result.submission });
  });

  // 8. Review Voice Submission (Supervisor Admin Key Required)
  app.post('/api/kids-circle/:code/submissions/:subId/review', (req, res) => {
    const code = normalizeCircleCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'كود الحلقة غير صالح' });
    }
    const subId = req.params.subId;
    const { decision, feedbackText, supervisorAudioDataUrl } = req.body || {};
    const adminKey = req.body?.adminKey ?? req.get('x-admin-key');

    const rateKey = `kids-review:${getClientIp(req)}:${code}`;
    const limitCheck = kidsCircleAdminLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    const result = kidsCircleDb.reviewSubmission(code, adminKey, subId, {
      decision: decision === 'approved' ? 'approved' : 'retry',
      feedbackText,
      supervisorAudioDataUrl,
    });
    if (!result.ok) {
      if (result.status === 403) kidsCircleAdminLimiter.recordFailure(rateKey);
      return res.status(result.status).json({ success: false, error: result.error });
    }
    kidsCircleAdminLimiter.reset(rateKey);
    return res.json({
      success: true,
      submission: result.submission,
      member: result.member,
    });
  });

  // Unknown /api/* routes must return JSON 404 rather than SPA HTML fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ success: false, error: 'مسار API غير موجود' });
  });

  if (options.mountErrorHandler !== false) {
    app.use(jsonErrorHandler);
  }

  return app;
}

export async function startServer() {
  const cliPort = getCliArg('--port');
  const cliHost = getCliArg('--host');
  const parsedPort = cliPort ? parseInt(cliPort, 10) : process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  const HOST = cliHost || process.env.HOST || '0.0.0.0';
  const isProduction = process.env.NODE_ENV === 'production';

  const app = createServerApp({ isProduction, mountErrorHandler: false });

  // ---------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrEnabled,
        ws: hmrEnabled ? undefined : false,
      },
      appType: 'spa',
    });

    if (!hmrEnabled) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const vite = await vitePromise;
          const result = await vite.transformRequest('/@vite/client');
          if (result && typeof result.code === 'string') {
            const safeCode = result.code.replace(
              /transport\.connect\([^;]*\);/g,
              '/* HMR disabled: WebSocket connection skipped */'
            );
            res.setHeader('Cache-Control', 'no-cache');
            res.status(200).type('application/javascript').send(safeCode);
            return;
          }
        } catch {
          // Fall back to default Vite middleware on unexpected errors
        }
        next();
      });
    }

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.use(jsonErrorHandler);

  const server = app.listen(PORT, HOST, () => {
    console.log(`Bayan Quran server running (${isProduction ? 'production' : 'development'}) on http://${HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[server] listen error:', err);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

const isEntrypoint =
  !process.env.VITEST &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  startServer();
}
