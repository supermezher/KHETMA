import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import {
  createKhatmaDatabase,
  DEFAULT_ROOM_ID,
  isValidJuzNumber,
  hashPin,
  verifyPinHash,
  PinRateLimiter,
  normalizeRoomId,
} from './src/server/khatmaStore';

const khatmaDb = createKhatmaDatabase();
const pinRateLimiter = new PinRateLimiter(5, 5 * 60 * 1000);

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'local';
}

function resolveRoomId(req: express.Request): string {
  return normalizeRoomId((req.body && req.body.roomId) || req.query.roomId || DEFAULT_ROOM_ID);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // API ROUTES FOR MULTI-ROOM SHARED COLLECTIVE KHATMA
  // ---------------------------------------------------------------------------

  // 0. List active Khatma rooms (public metadata only, never returns PIN hashes)
  app.get('/api/khatma/rooms', (req, res) => {
    res.json({
      success: true,
      rooms: khatmaDb.listRoomSummaries(),
    });
  });

  // 0b. Create a new private/shared Khatma room with mandatory custom PIN
  app.post('/api/khatma/rooms', (req, res) => {
    const { requestedSlug, dedicationTitle, creatorName, deadlineDays, pin } = req.body || {};
    const result = khatmaDb.createRoom({
      requestedSlug,
      dedicationTitle,
      creatorName,
      deadlineDays,
      pin,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    const room = result.room;
    return res.status(201).json({
      success: true,
      roomId: room.roomId,
      dedicationTitle: room.dedicationTitle,
      creatorName: room.creatorName,
      deadlineDays: room.deadlineDays,
      parts: room.parts,
      updatedAt: room.updatedAt,
      isDefaultPin: false,
    });
  });

  // 1. Get Live Khatma State for a Room
  app.get('/api/khatma', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على الختمة المطلوبة' });
    }

    res.json({
      success: true,
      roomId: room.roomId,
      dedicationTitle: room.dedicationTitle,
      creatorName: room.creatorName,
      deadlineDays: room.deadlineDays,
      parts: room.parts,
      updatedAt: room.updatedAt,
      isDefaultPin: room.roomId === DEFAULT_ROOM_ID && verifyPinHash('1234', room.adminPinHash),
    });
  });

  // 2. Claim a Juz
  app.post('/api/khatma/claim', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

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
        parts: room.parts,
      });
    }

    part.claimedBy = trimmedName;
    part.claimedAt = new Date().toISOString();
    part.isCompleted = false;

    khatmaDb.saveRoom(room);
    return res.json({ success: true, parts: room.parts, claimedPart: part });
  });

  // 3. Toggle Part Completion
  app.post('/api/khatma/complete', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { juzNumber } = req.body || {};
    if (!isValidJuzNumber(juzNumber)) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const part = room.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }
    if (part.claimedBy === null) {
      return res.status(400).json({ success: false, error: 'لا يمكن إتمام جزء شاغر قبل حجزه', parts: room.parts });
    }

    part.isCompleted = !part.isCompleted;
    khatmaDb.saveRoom(room);
    return res.json({ success: true, parts: room.parts, updatedPart: part });
  });

  // 4. Release a Part (Volunteer withdrawal)
  app.post('/api/khatma/release', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { juzNumber } = req.body || {};
    if (!isValidJuzNumber(juzNumber)) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const part = room.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    part.claimedBy = null;
    part.claimedAt = undefined;
    part.isCompleted = false;

    khatmaDb.saveRoom(room);
    return res.json({ success: true, parts: room.parts });
  });

  // 5. Verify Supervisor PIN (Rate-Limited Server-side Hash Verification)
  app.post('/api/khatma/verify-pin', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { pin } = req.body || {};
    if (typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ success: false, error: 'الرمز مطلوب' });
    }

    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = pinRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية ثم المحاولة مجدداً`,
      });
    }

    if (verifyPinHash(pin, room.adminPinHash)) {
      pinRateLimiter.reset(rateKey);
      return res.json({ success: true, verified: true });
    } else {
      pinRateLimiter.recordFailure(rateKey);
      return res.status(401).json({ success: false, verified: false, error: 'رمز المشرف غير صحيح' });
    }
  });

  // 6. Change Supervisor PIN (Requires Old PIN, Rate-Limited)
  app.post('/api/khatma/change-pin', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { currentPin, newPin } = req.body || {};
    if (typeof currentPin !== 'string' || typeof newPin !== 'string' || !currentPin.trim() || newPin.trim().length < 4) {
      return res.status(400).json({ success: false, error: 'الرمز الجديد يجب أن يكون 4 أحرف/أرقام على الأقل' });
    }

    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = pinRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (!verifyPinHash(currentPin, room.adminPinHash)) {
      pinRateLimiter.recordFailure(rateKey);
      return res.status(401).json({ success: false, error: 'رمز المشرف الحالي غير صحيح' });
    }

    pinRateLimiter.reset(rateKey);
    room.adminPinHash = hashPin(newPin);
    khatmaDb.saveRoom(room);
    return res.json({ success: true, message: 'تم تغيير رمز المشرف بنجاح' });
  });

  // 7. Administrative Action (Guarded strictly by Rate-Limited PIN verification)
  app.post('/api/khatma/admin-action', (req, res) => {
    const roomId = resolveRoomId(req);
    const room = khatmaDb.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'الختمة غير موجودة' });
    }

    const { pin, action, targetJuz, newName, dedicationTitle, creatorName, deadlineDays } = req.body || {};
    const rateKey = `${getClientIp(req)}:${room.roomId}`;
    const limitCheck = pinRateLimiter.check(rateKey);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${limitCheck.retryAfterSec} ثانية`,
      });
    }

    if (typeof pin !== 'string' || !pin.trim() || !verifyPinHash(pin, room.adminPinHash)) {
      pinRateLimiter.recordFailure(rateKey);
      return res.status(403).json({ success: false, error: 'غير مصرح: رمز المشرف غير صحيح' });
    }
    pinRateLimiter.reset(rateKey);

    if (action === 'reset-all') {
      room.parts = room.parts.map((p) => ({
        ...p,
        claimedBy: null,
        claimedAt: undefined,
        isCompleted: false,
      }));
      khatmaDb.saveRoom(room);
      return res.json({ success: true, parts: room.parts, message: 'تمت إعادة ضبط الختمة وبدء دورة جديدة' });
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
      khatmaDb.saveRoom(room);
      return res.json({ success: true, parts: room.parts });
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
      return res.json({ success: true, parts: room.parts });
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

    return res.status(400).json({ success: false, error: 'إجراء غير معروف' });
  });

  // ---------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrEnabled,
        ws: hmrEnabled ? undefined : false,
      },
      appType: 'spa',
    });

    if (!hmrEnabled) {
      // When HMR is disabled (e.g. DISABLE_HMR=true), prevent @vite/client from opening a failing WebSocket to port 24678
      app.get('/@vite/client', async (_req, res, next) => {
        try {
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

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bayan Quran Full-Stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
