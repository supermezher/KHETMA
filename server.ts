import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface PartClaim {
  juzNumber: number;
  juzName: string;
  claimedBy: string | null;
  claimedAt?: string;
  isCompleted: boolean;
  surahsCovered?: string;
}

interface KhatmaData {
  dedicationTitle: string;
  creatorName: string;
  deadlineDays: number;
  adminPinHash: string;
  parts: PartClaim[];
  updatedAt: string;
}

const DEFAULT_JUZ_SURAS: Record<number, string> = {
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

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin.trim()).digest('hex');
}

function generateInitialParts(): PartClaim[] {
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'collective_khatma.json');

function loadKhatmaData(): KhatmaData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.parts) && parsed.parts.length === 30) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading khatma database file:', err);
  }

  // Initial default state
  const initialData: KhatmaData = {
    dedicationTitle: 'ختمة البر والصدقة الجارية لجميع موتى المسلمين',
    creatorName: 'فاعل خير',
    deadlineDays: 3,
    adminPinHash: hashPin('1234'), // Default PIN 1234 securely hashed
    parts: generateInitialParts(),
    updatedAt: new Date().toISOString(),
  };

  saveKhatmaData(initialData);
  return initialData;
}

function saveKhatmaData(data: KhatmaData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving khatma database file:', err);
  }
}

let khatmaState: KhatmaData = loadKhatmaData();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // API ROUTES FOR REAL SHARED COLLECTIVE KHATMA
  // ---------------------------------------------------------------------------

  // 1. Get Live Khatma State (Public, sanitized - never returns adminPinHash)
  app.get('/api/khatma', (req, res) => {
    res.json({
      success: true,
      dedicationTitle: khatmaState.dedicationTitle,
      creatorName: khatmaState.creatorName,
      deadlineDays: khatmaState.deadlineDays,
      parts: khatmaState.parts,
      updatedAt: khatmaState.updatedAt,
      isDefaultPin: khatmaState.adminPinHash === hashPin('1234'),
    });
  });

  // 2. Claim a Juz
  app.post('/api/khatma/claim', (req, res) => {
    const { juzNumber, name } = req.body;
    if (!juzNumber || juzNumber < 1 || juzNumber > 30) {
      return res.status(400).json({ success: false, error: 'رقم الجزء غير صالح' });
    }
    const trimmedName = (name || '').trim() || 'قارئ محب للخير';

    const part = khatmaState.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    part.claimedBy = trimmedName;
    part.claimedAt = new Date().toISOString();
    part.isCompleted = false;

    saveKhatmaData(khatmaState);
    return res.json({ success: true, parts: khatmaState.parts, claimedPart: part });
  });

  // 3. Toggle Part Completion
  app.post('/api/khatma/complete', (req, res) => {
    const { juzNumber } = req.body;
    const part = khatmaState.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    part.isCompleted = !part.isCompleted;
    saveKhatmaData(khatmaState);
    return res.json({ success: true, parts: khatmaState.parts, updatedPart: part });
  });

  // 4. Release a Part (Volunteer withdrawal)
  app.post('/api/khatma/release', (req, res) => {
    const { juzNumber } = req.body;
    const part = khatmaState.parts.find((p) => p.juzNumber === juzNumber);
    if (!part) {
      return res.status(404).json({ success: false, error: 'الجزء غير موجود' });
    }

    part.claimedBy = null;
    part.claimedAt = undefined;
    part.isCompleted = false;

    saveKhatmaData(khatmaState);
    return res.json({ success: true, parts: khatmaState.parts });
  });

  // 5. Verify Supervisor PIN (Secure Server-side Hash Verification)
  app.post('/api/khatma/verify-pin', (req, res) => {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'الرمز مطلوب' });
    }

    const providedHash = hashPin(pin);
    if (providedHash === khatmaState.adminPinHash) {
      return res.json({ success: true, verified: true });
    } else {
      return res.status(401).json({ success: false, verified: false, error: 'رمز المشرف غير صحيح' });
    }
  });

  // 6. Change Supervisor PIN (Requires Old PIN)
  app.post('/api/khatma/change-pin', (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin || newPin.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'الرمز الجديد يجب أن يكون 3 أحرف/أرقام على الأقل' });
    }

    if (hashPin(currentPin) !== khatmaState.adminPinHash) {
      return res.status(401).json({ success: false, error: 'رمز المشرف الحالي غير صحيح' });
    }

    khatmaState.adminPinHash = hashPin(newPin);
    saveKhatmaData(khatmaState);
    return res.json({ success: true, message: 'تم تغيير رمز المشرف بنجاح' });
  });

  // 7. Administrative Action (Guarded strictly by PIN hash verification)
  app.post('/api/khatma/admin-action', (req, res) => {
    const { pin, action, targetJuz, newName, dedicationTitle, creatorName, deadlineDays } = req.body;

    if (!pin || hashPin(pin) !== khatmaState.adminPinHash) {
      return res.status(403).json({ success: false, error: 'غير مصرح: رمز المشرف غير صحيح' });
    }

    if (action === 'reset-all') {
      khatmaState.parts = khatmaState.parts.map((p) => ({
        ...p,
        claimedBy: null,
        claimedAt: undefined,
        isCompleted: false,
      }));
      saveKhatmaData(khatmaState);
      return res.json({ success: true, parts: khatmaState.parts, message: 'تمت إعادة ضبط الختمة وبدء دورة جديدة' });
    }

    if (action === 'release-part' && targetJuz) {
      const part = khatmaState.parts.find((p) => p.juzNumber === targetJuz);
      if (part) {
        part.claimedBy = null;
        part.claimedAt = undefined;
        part.isCompleted = false;
        saveKhatmaData(khatmaState);
      }
      return res.json({ success: true, parts: khatmaState.parts });
    }

    if (action === 'edit-name' && targetJuz && newName) {
      const part = khatmaState.parts.find((p) => p.juzNumber === targetJuz);
      if (part) {
        part.claimedBy = newName.trim();
        saveKhatmaData(khatmaState);
      }
      return res.json({ success: true, parts: khatmaState.parts });
    }

    if (action === 'update-dedication') {
      if (dedicationTitle) khatmaState.dedicationTitle = dedicationTitle.trim();
      if (creatorName) khatmaState.creatorName = creatorName.trim();
      if (deadlineDays) khatmaState.deadlineDays = Number(deadlineDays);
      saveKhatmaData(khatmaState);
      return res.json({
        success: true,
        dedicationTitle: khatmaState.dedicationTitle,
        creatorName: khatmaState.creatorName,
        deadlineDays: khatmaState.deadlineDays,
      });
    }

    return res.status(400).json({ success: false, error: 'إجراء غير معروف' });
  });

  // ---------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
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
