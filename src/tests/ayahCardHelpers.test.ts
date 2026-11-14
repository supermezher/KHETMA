import { describe, it, expect } from 'vitest';
import {
  getCanvasDimensions,
  getVideoExportDimensions,
  buildAyahDeepLink,
  isAllahWord,
  wrapArabicLines,
  computeAutoFitFontSize,
} from '../utils/ayahCardHelpers';

describe('ayahCardHelpers', () => {
  it('returns crisp target dimensions for all 3 social aspect ratios', () => {
    expect(getCanvasDimensions('post')).toEqual({ width: 1080, height: 1080 });
    expect(getCanvasDimensions('story')).toEqual({ width: 1080, height: 1920 });
    expect(getCanvasDimensions('landscape')).toEqual({ width: 1920, height: 1080 });

    expect(getVideoExportDimensions('post')).toEqual({ width: 900, height: 900 });
    expect(getVideoExportDimensions('story')).toEqual({ width: 720, height: 1280 });
    expect(getVideoExportDimensions('landscape')).toEqual({ width: 1280, height: 720 });
  });

  it('builds safe canonical QR deep links for Surah & Ayah navigation', () => {
    expect(buildAyahDeepLink('https://bayan.app/', 2, 255)).toBe('https://bayan.app/?surah=2&ayah=255');
    expect(buildAyahDeepLink('http://localhost:3000', 114, 6)).toBe('http://localhost:3000/?surah=114&ayah=6');
    expect(buildAyahDeepLink('https://bayan.app', 999, -3)).toBe('https://bayan.app/?surah=114&ayah=1');
  });

  it('accurately identifies Uthmani and standard forms of لفظ الجلالة without false positives', () => {
    expect(isAllahWord('ٱللَّهِ')).toBe(true);
    expect(isAllahWord('ٱللَّهُ')).toBe(true);
    expect(isAllahWord('لِلَّهِ')).toBe(true);
    expect(isAllahWord('بِٱللَّهِ')).toBe(true);
    expect(isAllahWord('وَٱللَّهُ')).toBe(true);
    expect(isAllahWord('فَٱللَّهُ')).toBe(true);
    expect(isAllahWord('ٱلْحَمْدُ')).toBe(false);
    expect(isAllahWord('ٱلرَّحْمَٰنِ')).toBe(false);
    expect(isAllahWord('رَبِّ')).toBe(false);
  });

  it('wraps Arabic text into lines respecting maxWidth', () => {
    const fakeMeasure = (str: string) => str.length * 10;
    const lines = wrapArabicLines('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 160, fakeMeasure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
  });

  it('auto-fits long ayahs cleanly inside vertical bounds', () => {
    const longAyah = Array.from({ length: 40 }, () => 'كَلِمَةٌ').join(' ');
    const measureWithFont = (str: string, fontPx: number) => str.length * (fontPx * 0.45);
    const result = computeAutoFitFontSize(longAyah, 760, 420, measureWithFont, {
      minSize: 24,
      maxSize: 58,
      lineHeightMultiplier: 2.0,
    });
    expect(result.fontSize).toBeGreaterThanOrEqual(24);
    expect(result.fontSize).toBeLessThanOrEqual(36);
    expect(result.lines.length).toBeGreaterThan(2);
  });
});
