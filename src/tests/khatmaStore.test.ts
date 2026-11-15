import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_ID,
  SecretRateLimiter,
  createKhatmaDatabase,
  hashSecret,
  normalizeRoomId,
  sanitizePartsForClient,
  verifySecretHash,
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

describe('khatmaStore hardened persistence & capability security', () => {
  it('initializes default public room with 30 parts and NEVER accepts default PIN 1234', () => {
    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);

    const pub = store.getRoom(DEFAULT_ROOM_ID);
    expect(pub).not.toBeNull();
    expect(pub?.roomId).toBe('public');
    expect(pub?.isPublic).toBe(true);
    expect(pub?.parts).toHaveLength(30);
    expect(verifySecretHash('1234', pub!.adminKeyHash)).toBe(false);
    expect(store.listPublicRoomSummaries()).toHaveLength(1);
  });

  it('creates unlisted private rooms with 128-bit salted secret adminKey and hides them from public listing', () => {
    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);

    const res = store.createRoom({
      dedicationTitle: 'ختمة العائلة المباركة',
      creatorName: 'فهد',
      deadlineDays: 10,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.room.isPublic).toBe(false);
      expect(res.room.roomId).toMatch(/^k-[0-9a-f]{24}$/);
      expect(res.adminKey).toMatch(/^[0-9a-f]{32}$/);
      expect(verifySecretHash(res.adminKey, res.room.adminKeyHash)).toBe(true);
      expect(verifySecretHash('wrong-secret', res.room.adminKeyHash)).toBe(false);
      // Unlisted: public summaries only include the public room
      expect(store.listPublicRoomSummaries()).toHaveLength(1);
      expect(store.listPublicRoomSummaries()[0].roomId).toBe('public');
      // Direct access by secret roomId works
      expect(store.getRoom(res.room.roomId)?.dedicationTitle).toBe('ختمة العائلة المباركة');
    }
  });

  it('rejects prototype-pollution room IDs (__proto__, constructor, prototype)', () => {
    expect(normalizeRoomId('__proto__')).toBeNull();
    expect(normalizeRoomId('constructor')).toBeNull();
    expect(normalizeRoomId('prototype')).toBeNull();
    expect(normalizeRoomId('  My_Room-99!! ')).toBe('my_room-99');
    expect(normalizeRoomId(undefined)).toBe('public');

    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);
    expect(store.getRoom('__proto__')).toBeNull();
    expect(store.getRoom('constructor')).toBeNull();
  });

  it('quarantines corrupted database JSON instead of silently erasing user rooms', () => {
    const dir = createTempDir();
    fs.writeFileSync(path.join(dir, 'collective_khatmas.json'), '{ corrupted-json', 'utf-8');

    const store = createKhatmaDatabase(dir);
    expect(store.getRoom('public')).not.toBeNull();

    const files = fs.readdirSync(dir);
    const quarantined = files.filter((f) => f.startsWith('collective_khatmas.corrupted.'));
    expect(quarantined.length).toBe(1);
    expect(fs.readFileSync(path.join(dir, quarantined[0]), 'utf-8')).toBe('{ corrupted-json');
  });

  it('never leaks server claimTokenHash when sanitizing parts for clients', () => {
    const dir = createTempDir();
    const store = createKhatmaDatabase(dir);
    const pub = store.getRoom('public')!;
    pub.parts[0].claimedBy = 'أحمد';
    pub.parts[0].claimTokenHash = hashSecret('secret-token-xyz');

    const safeParts = sanitizePartsForClient(pub.parts);
    expect((safeParts[0] as unknown as Record<string, unknown>).claimTokenHash).toBeUndefined();
    expect(safeParts[0].claimedBy).toBe('أحمد');
  });

  it('rate-limits repeated invalid admin attempts and resets cleanly', () => {
    const limiter = new SecretRateLimiter(5, 300_000);
    const key = '127.0.0.1:public';
    const t0 = 1_000_000;

    for (let i = 0; i < 4; i++) {
      expect(limiter.check(key, t0).allowed).toBe(true);
      limiter.recordFailure(key, t0);
    }
    limiter.recordFailure(key, t0);
    expect(limiter.check(key, t0 + 10_000).allowed).toBe(false);
    expect(limiter.check(key, t0 + 300_001).allowed).toBe(true);

    limiter.reset(key);
    expect(limiter.check(key, t0).allowed).toBe(true);
  });
});
