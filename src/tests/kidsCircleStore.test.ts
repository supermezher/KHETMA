import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createKidsCircleDatabase } from '../server/kidsCircleStore';

const SAMPLE_WEBM_DATA_URL = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFh4EEQoWBAhhTgGcB';

describe('kidsCircleStore remote circle & async voice submission security', () => {
  let tmpFile: string;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bayan-kids-circle-'));
    tmpFile = path.join(dir, 'kids_circles.json');
  });

  it('creates a circle with 6-digit code, joins a kid, and verifies supervisor key', () => {
    const db = createKidsCircleDatabase(tmpFile);
    const created = db.createCircle({ title: 'حلقة الفجر', supervisorName: 'أم عمر' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.circle.circleCode).toMatch(/^\d{6}$/);
    expect(created.adminKey.length).toBeGreaterThanOrEqual(16);

    expect(db.verifyAdmin(created.circle.circleCode, created.adminKey)).toBe(true);
    expect(db.verifyAdmin(created.circle.circleCode, 'wrong-key')).toBe(false);

    const joined = db.joinCircle(created.circle.circleCode, { name: 'يوسف', avatarId: 'sprout' });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(joined.member.name).toBe('يوسف');
    expect(joined.kidToken.length).toBeGreaterThanOrEqual(16);

    // Reload from disk to confirm persistence
    const db2 = createKidsCircleDatabase(tmpFile);
    const loaded = db2.getCircle(created.circle.circleCode);
    expect(loaded?.kids).toHaveLength(1);
    expect(loaded?.kids[0].name).toBe('يوسف');
  });

  it('updates kid daily wird only when authenticated with supervisor adminKey', () => {
    const db = createKidsCircleDatabase(tmpFile);
    const created = db.createCircle({ title: 'حلقة النور' });
    if (!created.ok) throw new Error('failed');

    const joined = db.joinCircle(created.circle.circleCode, { name: 'مريم', avatarId: 'moon' });
    if (!joined.ok) throw new Error('failed');

    const denied = db.updateKidWird(created.circle.circleCode, 'bad-key', joined.member.kidId, {
      surahNumber: 114,
      startAyah: 1,
      endAyah: 6,
    });
    expect(denied.ok).toBe(false);

    const allowed = db.updateKidWird(created.circle.circleCode, created.adminKey, joined.member.kidId, {
      surahNumber: 114,
      startAyah: 1,
      endAyah: 6,
      repeatCount: 5,
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.member.dailyWird.surahNumber).toBe(114);
      expect(allowed.member.dailyWird.endAyah).toBe(6);
      expect(allowed.member.dailyWird.repeatCount).toBe(5);
    }
  });

  it('handles async voice submissions, supervisor approval with stars, and retry feedback', () => {
    const db = createKidsCircleDatabase(tmpFile);
    const created = db.createCircle({ title: 'حلقة الإتقان' });
    if (!created.ok) throw new Error('failed');

    const joined = db.joinCircle(created.circle.circleCode, { name: 'سارة', avatarId: 'star' });
    if (!joined.ok) throw new Error('failed');

    // Reject forged kid token
    const badSub = db.addVoiceSubmission(created.circle.circleCode, joined.member.kidId, 'forged', {
      surahNumber: 108,
      ayahNumber: 1,
      endAyahNumber: 3,
      audioDataUrl: SAMPLE_WEBM_DATA_URL,
    });
    expect(badSub.ok).toBe(false);

    // Valid voice submission for Surah Al-Kawthar (108, 3 ayahs)
    const subRes = db.addVoiceSubmission(created.circle.circleCode, joined.member.kidId, joined.kidToken, {
      surahNumber: 108,
      ayahNumber: 1,
      endAyahNumber: 3,
      audioDataUrl: SAMPLE_WEBM_DATA_URL,
      durationSec: 12,
    });
    expect(subRes.ok).toBe(true);
    if (!subRes.ok) return;

    // Supervisor approves with encouragement text & audio note -> awards 3 ayah stars + 5 surah badge stars = 8
    const reviewRes = db.reviewSubmission(created.circle.circleCode, created.adminKey, subRes.submission.id, {
      decision: 'approved',
      feedbackText: 'ما شاء الله تلاوة متقنة يا بطلة!',
      supervisorAudioDataUrl: SAMPLE_WEBM_DATA_URL,
    });
    expect(reviewRes.ok).toBe(true);
    if (reviewRes.ok) {
      expect(reviewRes.submission.status).toBe('approved');
      expect(reviewRes.member?.stars).toBe(8);
      expect(reviewRes.member?.completedSurahs).toContain(108);
    }
  });
});
