import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import { createServerApp } from '../../server';

const tempDirs: string[] = [];
const activeServers: http.Server[] = [];

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bayan-server-test-'));
  tempDirs.push(dir);
  return {
    khatmaDataDir: path.join(dir, 'khatma'),
    kidsCircleFilePath: path.join(dir, 'kids_circles.json'),
  };
}

async function startTestApp(isProduction = false) {
  const paths = createTempPaths();
  const app = createServerApp({ ...paths, isProduction });
  const server = http.createServer(app);
  activeServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { baseUrl: `http://127.0.0.1:${port}`, server };
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const s = activeServers.pop();
    if (s) {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('Server hardening: JSON error handler, path normalization, CSP & rate limits', () => {
  it('returns structured JSON 400 for malformed JSON and 413 for oversized payloads instead of HTML', async () => {
    const { baseUrl } = await startTestApp(false);

    const badJsonRes = await fetch(`${baseUrl}/api/khatma/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"juzNumber": 1, invalid',
    });
    expect(badJsonRes.status).toBe(400);
    expect(badJsonRes.headers.get('content-type')).toContain('application/json');
    const badJsonData = (await badJsonRes.json()) as { success: boolean; error: string };
    expect(badJsonData.success).toBe(false);
    expect(badJsonData.error).toBe('صيغة الطلب غير صالحة');

    const hugeName = 'أ'.repeat(70_000);
    const tooLargeRes = await fetch(`${baseUrl}/api/khatma/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ juzNumber: 1, name: hugeName }),
    });
    expect(tooLargeRes.status).toBe(413);
    expect(tooLargeRes.headers.get('content-type')).toContain('application/json');
    const tooLargeData = (await tooLargeRes.json()) as { success: boolean; error: string };
    expect(tooLargeData.success).toBe(false);
    expect(tooLargeData.error).toBe('حجم الطلب أكبر من المسموح');
  });

  it('blocks duplicate slashes and normalized server/data/env paths with 403', async () => {
    const { baseUrl } = await startTestApp(false);

    for (const target of ['//src/server/khatmaStore.ts', '//data/collective_khatmas.json', '/foo/../.env']) {
      const res = await fetch(`${baseUrl}${target}`);
      expect(res.status).toBe(403);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(false);
    }
  });

  it('sets strict production Content-Security-Policy header only in production mode', async () => {
    const dev = await startTestApp(false);
    const devRes = await fetch(`${dev.baseUrl}/api/khatma/rooms`);
    expect(devRes.headers.get('content-security-policy')).toBeNull();

    const prod = await startTestApp(true);
    const prodRes = await fetch(`${prod.baseUrl}/api/khatma/rooms`);
    const csp = prodRes.headers.get('content-security-policy') || '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('https://api.alquran.cloud');
    expect(csp).toContain('https://api.quran.com');
    expect(csp).toContain('https://everyayah.com');
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it('rate-limits public POST /api/khatma/claim attempts per IP and room', async () => {
    const { baseUrl } = await startTestApp(false);

    for (let i = 1; i <= 10; i++) {
      const res = await fetch(`${baseUrl}/api/khatma/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ juzNumber: i, name: `قارئ ${i}` }),
      });
      expect(res.status).toBe(200);
    }

    const blockedRes = await fetch(`${baseUrl}/api/khatma/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ juzNumber: 11, name: 'قارئ 11' }),
    });
    expect(blockedRes.status).toBe(429);
    const blockedData = (await blockedRes.json()) as { success: boolean };
    expect(blockedData.success).toBe(false);
  });

  it('rate-limits kids circle join attempts and 6-digit preview enumeration', async () => {
    const { baseUrl } = await startTestApp(false);

    const createRes = await fetch(`${baseUrl}/api/kids-circle/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'حلقة الفجر', supervisorName: 'المعلم' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { circleCode: string; adminKey: string };

    // 10 join requests allowed, 11th rate-limited
    for (let i = 1; i <= 10; i++) {
      const res = await fetch(`${baseUrl}/api/kids-circle/${created.circleCode}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `طفل ${i}`, avatarId: 'star' }),
      });
      expect(res.status).toBe(201);
    }

    const joinBlocked = await fetch(`${baseUrl}/api/kids-circle/${created.circleCode}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'طفل 11', avatarId: 'star' }),
    });
    expect(joinBlocked.status).toBe(429);

    // 30 unauthenticated preview lookups allowed, 31st rate-limited (even on missing codes)
    for (let i = 0; i < 30; i++) {
      const probeCode = String(100000 + i);
      const res = await fetch(`${baseUrl}/api/kids-circle/${probeCode}`);
      expect([200, 404]).toContain(res.status);
    }
    const previewBlocked = await fetch(`${baseUrl}/api/kids-circle/${created.circleCode}`);
    expect(previewBlocked.status).toBe(429);

    // Authenticated supervisor lookup still succeeds independently
    const adminRes = await fetch(`${baseUrl}/api/kids-circle/${created.circleCode}`, {
      headers: { 'x-admin-key': created.adminKey },
    });
    expect(adminRes.status).toBe(200);
  });
});
