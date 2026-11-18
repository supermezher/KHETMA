import { describe, it, expect } from 'vitest';
import {
  applyRemoteMemberToProfile,
  approveSurahWirdForKid,
  clampWirdRange,
  computeChildRepeatPauseMs,
  computeGardenStage,
  createKidProfile,
  generateParentGateChallenge,
  makeAyahKey,
  recordKidAyahCycle,
  resolveActiveWordIndex,
  sanitizeKidsHifzState,
} from '../utils/kidsHifzStore';

describe('kidsHifzStore', () => {
  it('sanitizes corrupt or empty storage into a valid default kid profile', () => {
    const empty = sanitizeKidsHifzState(null);
    expect(empty.profiles).toHaveLength(1);
    expect(empty.activeProfileId).toBe(empty.profiles[0].id);
    expect(empty.profiles[0].dailyWird.surahNumber).toBe(112);

    const invalid = sanitizeKidsHifzState({
      activeProfileId: 'missing',
      profiles: [{ id: 'p1', name: '  زينب  ', avatarId: 'invalid_avatar', stars: -5 }],
    });
    expect(invalid.activeProfileId).toBe('p1');
    expect(invalid.profiles[0].name).toBe('زينب');
    expect(invalid.profiles[0].avatarId).toBe('star');
    expect(invalid.profiles[0].stars).toBe(0);
  });

  it('clamps daily wird ayah bounds to actual surah ayah count', () => {
    // Al-Ikhlas (112) has 4 ayahs
    const clamped = clampWirdRange(112, 0, 99);
    expect(clamped).toEqual({ surahNumber: 112, startAyah: 1, endAyah: 4 });

    // End before start corrects end to start
    const reversed = clampWirdRange(114, 5, 2);
    expect(reversed).toEqual({ surahNumber: 114, startAyah: 5, endAyah: 5 });
  });

  it('awards stars per mastered ayah and bonus badge stars when completing full surah', () => {
    let profile = createKidProfile('عمر', 'sprout', 'kid_omar');
    // Surah Al-Kawthar (108) has 3 ayahs
    profile = recordKidAyahCycle(profile, 108, 1, true);
    profile = recordKidAyahCycle(profile, 108, 2, true);
    expect(profile.stars).toBe(2);
    expect(profile.completedSurahs).toEqual([]);

    // Completing ayah 3 completes surah 108 (+1 ayah star + 5 surah bonus = 8)
    profile = recordKidAyahCycle(profile, 108, 3, true);
    expect(profile.stars).toBe(8);
    expect(profile.completedSurahs).toContain(108);

    // Repeating an already mastered ayah increments count without duplicating star
    profile = recordKidAyahCycle(profile, 108, 3, true);
    expect(profile.stars).toBe(8);
    expect(profile.ayahRepeatCounts[makeAyahKey(108, 3)]).toBe(2);
  });

  it('approves entire wird range without double-counting already mastered ayahs', () => {
    let profile = createKidProfile('مريم', 'moon', 'kid_maryam');
    profile = recordKidAyahCycle(profile, 112, 1, true); // 1 star
    profile = approveSurahWirdForKid(profile, 112, 1, 4); // +3 remaining ayahs + 5 surah bonus = 9
    expect(profile.stars).toBe(9);
    expect(profile.completedSurahs).toContain(112);
  });

  it('computes adaptive repeat pause durations and active word highlighting indices', () => {
    expect(computeChildRepeatPauseMs(4, 'short')).toBe(3800);
    expect(computeChildRepeatPauseMs(4, 'medium')).toBe(5200);
    expect(computeChildRepeatPauseMs(4, 'long')).toBe(6800);

    // Using Quran.com word segments
    const segments: [number, number, number, number][] = [
      [1, 1, 0, 600],
      [2, 2, 610, 1400],
      [3, 3, 1410, 2200],
    ];
    expect(resolveActiveWordIndex(segments, 900, 2200, 3)).toBe(1);
    // Fallback proportional calculation when segments are absent
    expect(resolveActiveWordIndex(undefined, 1500, 3000, 4)).toBe(2);
  });

  it('generates valid parent gate multiplication questions and garden stages', () => {
    const challenge = generateParentGateChallenge();
    expect(challenge.answer).toBe(challenge.a * challenge.b);
    expect(challenge.a).toBeGreaterThanOrEqual(3);
    expect(challenge.b).toBeGreaterThanOrEqual(2);

    expect(computeGardenStage(2).level).toBe(1);
    expect(computeGardenStage(10).level).toBe(2);
    expect(computeGardenStage(25).level).toBe(3);
    expect(computeGardenStage(50).level).toBe(4);
    expect(computeGardenStage(80).level).toBe(5);
  });

  it('preserves valid 6-digit remoteLink and merges synced remote supervisor updates', () => {
    const profile = {
      ...createKidProfile('بلال', 'star', 'kid_bilal'),
      remoteLink: {
        circleCode: '482910',
        kidId: 'kid_remote_1',
        kidToken: 'tok_secret_123',
      },
    };
    const sanitized = sanitizeKidsHifzState({ activeProfileId: profile.id, profiles: [profile] });
    expect(sanitized.profiles[0].remoteLink?.circleCode).toBe('482910');

    const synced = applyRemoteMemberToProfile(
      sanitized.profiles[0],
      {
        stars: 12,
        masteredAyahKeys: ['114:1', '114:2'],
        completedSurahs: [112],
        ayahRepeatCounts: { '114:1': 4 },
        retryRequestedKeys: ['114:3'],
        dailyWird: {
          surahNumber: 114,
          startAyah: 1,
          endAyah: 6,
          reciterId: 'husary',
          repeatCount: 5,
          repeatDelayMode: 'long',
          autoAdvanceAyah: true,
        },
      },
      { circleTitle: 'حلقة النور', supervisorName: 'المعلمة سلمى' }
    );
    expect(synced.stars).toBe(12);
    expect(synced.dailyWird.surahNumber).toBe(114);
    expect(synced.dailyWird.repeatCount).toBe(5);
    expect(synced.retryRequestedKeys).toEqual(['114:3']);
    expect(synced.remoteLink?.circleTitle).toBe('حلقة النور');
  });
});
