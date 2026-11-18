import { describe, it, expect } from 'vitest';
import { normalizeQuranComSegments } from '../data/quranService';
import { resolveActiveWordIndex } from '../utils/kidsHifzStore';
import { getSpokenWordRawIndices } from '../utils/tajweedParser';

describe('wordSync synchronization pipeline', () => {
  it('normalizes Quran.com by_chapter tuples including stringified numbers and multi-word spans', () => {
    const raw = [
      ['0', '1', '120', '640'],
      [1, 3, 650, 1450], // spans spoken words 2 & 3 -> split evenly across [650, 1050] and [1050, 1450]
      ['3', '4', '1460', '2100'],
    ];

    expect(normalizeQuranComSegments(raw)).toEqual([
      [1, 1, 120, 640],
      [2, 2, 650, 1050],
      [3, 3, 1050, 1450],
      [4, 4, 1460, 2100],
    ]);
  });

  it('ignores malformed negative or inverted segment tuples', () => {
    const raw = [
      [-1, 1, 0, 500],
      [0, 1, 800, 400], // inverted endMs < startMs
      ['0', '1', '200', '700'],
    ];
    expect(normalizeQuranComSegments(raw)).toEqual([[1, 1, 200, 700]]);
  });

  it('handles leading silence, inter-word gaps, and trailing silence without proportional drift', () => {
    const segs: [number, number, number, number][] = [
      [1, 1, 350, 900],
      [2, 2, 950, 1500],
      [3, 3, 1580, 2200],
    ];

    // Leading silence before first spoken word (0..349ms) must NOT highlight word 0
    expect(resolveActiveWordIndex(segs, 100, 2600, 3)).toBe(-1);
    expect(resolveActiveWordIndex(segs, 0, 2600, 3)).toBe(-1);

    // Exact match on first word (returns 0-based index 0)
    expect(resolveActiveWordIndex(segs, 500, 2600, 3)).toBe(0);

    // Inter-word silence gap (901..949ms) holds the most recently started word (0), NOT proportional jump
    expect(resolveActiveWordIndex(segs, 920, 2600, 3)).toBe(0);

    // Trailing silence after final word (2201..2600ms) holds the final word (2)
    expect(resolveActiveWordIndex(segs, 2450, 2600, 3)).toBe(2);
  });

  it('skips standalone Quranic waqf stop marks when mapping spoken segments to rendered words', () => {
    // Pattern mirroring Al-Baqarah 2:2 with twin mu'anaqah waqf marks (ۛ)
    const tokens = ['ذَٰلِكَ', 'ٱلْكِتَٰبُ', 'لَا', 'رَيْبَ', 'ۛ', 'فِيهِ', 'ۛ', 'هُدًى', 'لِّلْمُتَّقِينَ'];
    const spokenIndices = getSpokenWordRawIndices(tokens);

    // 7 actual spoken words map cleanly to rendered token indices, skipping indices 4 and 6 (ۛ)
    expect(spokenIndices).toEqual([0, 1, 2, 3, 5, 7, 8]);

    const segs = normalizeQuranComSegments([
      [0, 1, 100, 500],
      [1, 2, 510, 1000],
      [2, 3, 1010, 1300],
      [3, 4, 1310, 1700],
      [4, 5, 1710, 2100], // "فِيهِ" -> raw index 5
      [5, 6, 2110, 2500], // "هُدًى" -> raw index 7
      [6, 7, 2510, 3100], // "لِّلْمُتَّقِينَ" -> raw index 8
    ]);

    const spokenIdx5 = resolveActiveWordIndex(segs, 1850, 3200, spokenIndices.length);
    expect(spokenIdx5).toBe(4);
    expect(spokenIndices[spokenIdx5]).toBe(5);
    expect(tokens[spokenIndices[spokenIdx5]]).toBe('فِيهِ');

    const spokenIdx6 = resolveActiveWordIndex(segs, 2250, 3200, spokenIndices.length);
    expect(spokenIdx6).toBe(5);
    expect(spokenIndices[spokenIdx6]).toBe(7);
    expect(tokens[spokenIndices[spokenIdx6]]).toBe('هُدًى');
  });
});
