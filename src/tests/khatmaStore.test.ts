import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_ID,
  PinRateLimiter,
  createKhatmaDatabase,
  hashPin,
  normalizeRoomId,
  verifyPinHash,
} from '../server/khatmaStore';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bayan-khatma-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('khatmaStore multi-room persistence & security', () => {
  it('initializes default public room with 30 parts', () => {
    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);

    const pub = store.getRoom(DEFAULT_ROOM_ID);
    expect(pub).not.toBeNull();
    expect(pub?.roomId).toBe('public');
    expect(pub?.parts).toHaveLength(30);
    expect(verifyPinHash('1234', pub!.adminPinHash)).toBe(true);
    expect(store.listRoomSummaries()).toHaveLength(1);
  });

  it('migrates legacy collective_khatma.json into public room', () => {
    const dir = createTempDir();
    const legacyParts = Array.from({ length: 30 }, (_, i) => ({
      juzNumber: i + 1,
      juzName: `الجزء ${i + 1}`,
      claimedBy: i === 0 ? 'أحمد' : null,
      isCompleted: i === 0,
    }));
    fs.writeFileSync(
      path.join(dir, 'collective_khatma.json'),
      JSON.stringify({
        dedicationTitle: 'ختمة الوالدة رحمها الله',
        creatorName: 'خالد',
        deadlineDays: 5,
        adminPinHash: hashPin('9876'),
        parts: legacyParts,
      }),
      'utf-8'
    );

    const store = createKhatmaDatabase(dir);
    const pub = store.getRoom('public');
    expect(pub?.dedicationTitle).toBe('ختمة الوالدة رحمها الله');
    expect(pub?.parts[0].claimedBy).toBe('أحمد');
    expect(pub?.parts[0].isCompleted).toBe(true);
    expect(verifyPinHash('9876', pub!.adminPinHash)).toBe(true);
    expect(fs.existsSync(path.join(dir, 'collective_khatmas.json'))).toBe(true);
  });

  it('enforces custom PIN >= 4 chars, validates unique slugs, and rejects duplicates with 409', () => {
    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);

    const weakPinRes = store.createRoom({
      dedicationTitle: 'ختمة العائلة',
      creatorName: 'فهد',
      deadlineDays: 7,
      pin: '123',
    });
    expect(weakPinRes.ok).toBe(false);
    if (!weakPinRes.ok) {
      expect(weakPinRes.status).toBe(400);
    }

    const okRes = store.createRoom({
      requestedSlug: 'Family_Room-1',
      dedicationTitle: 'ختمة العائلة المباركة',
      creatorName: 'فهد',
      deadlineDays: 10,
      pin: '4321',
    });
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.room.roomId).toBe('family_room-1');
      expect(verifyPinHash('4321', okRes.room.adminPinHash)).toBe(true);
      expect(okRes.room.adminPinHash).not.toBe('4321');
    }

    const dupRes = store.createRoom({
      requestedSlug: 'family_room-1',
      dedicationTitle: 'ختمة مكررة',
      creatorName: 'سعد',
      pin: '5555',
    });
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.status).toBe(409);
    }

    expect(store.listRoomSummaries()).toHaveLength(2);
  });

  it('normalizes room IDs safely', () => {
    expect(normalizeRoomId('  My_Room-99!! ')).toBe('my_room-99');
    expect(normalizeRoomId('x')).toBe('public');
    expect(normalizeRoomId(undefined)).toBe('public');
  });

  it('rate-limits repeated invalid PIN attempts and resets on success or timeout', () => {
    const limiter = new PinRateLimiter(5, 300_000);
    const key = '127.0.0.1:public';
    const t0 = 1_000_000;

    for (let i = 0; i < 4; i++) {
      expect(limiter.check(key, t0).allowed).toBe(true);
      limiter.recordFailure(key, t0);
    }
    expect(limiter.check(key, t0).allowed).toBe(true);

    // 5th failure triggers lock
    limiter.recordFailure(key, t0);
    const blocked = limiter.check(key, t0 + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(290);

    // Unblocked after cooldown expires
    expect(limiter.check(key, t0 + 300_001).allowed).toBe(true);

    // Manual reset clears attempts immediately
    for (let i = 0; i < 5; i++) limiter.recordFailure(key, t0);
    expect(limiter.check(key, t0).allowed).toBe(false);
    limiter.reset(key);
    expect(limiter.check(key, t0).allowed).toBe(true);
  });
});
