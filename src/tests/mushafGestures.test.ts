import { describe, expect, it } from 'vitest';
import {
  appendUniquePageItem,
  clampAutoScrollSpeed,
  clampCircularMomentumSlots,
  clampMushafFontSize,
  computeAutoScrollPxPerSec,
  computeCircularDialSlots,
  computePinchFontSize,
  computeRuledLineMetrics,
  computeShortPageDwellMs,
  computeTrimmedPageStream,
  formatArabicSpeedLabel,
  getArabicJuzLabel,
  resolveAutoScrollEndAction,
  resolvePairedPaperTheme,
  resolveRtlPageSwipeDelta,
  resolveVisiblePageFromOffsets,
  shouldToggleImmersiveTap,
  stepAutoScrollSpeed,
  wrapCircularIndex,
} from '../utils/mushafGestures';

describe('mushafGestures helpers', () => {
  it('formats all 30 classical Arabic Juz ordinal labels accurately', () => {
    expect(getArabicJuzLabel(1)).toBe('الجزء الأول');
    expect(getArabicJuzLabel(15)).toBe('الجزء الخامس عشر');
    expect(getArabicJuzLabel(30)).toBe('الجزء الثلاثون');
    expect(getArabicJuzLabel(0)).toBe('الجزء الأول');
    expect(getArabicJuzLabel(99)).toBe('الجزء الثلاثون');
  });

  it('clamps font size cleanly between 20 and 48 and handles two-finger pinch scaling', () => {
    expect(clampMushafFontSize(14)).toBe(20);
    expect(clampMushafFontSize(60)).toBe(48);
    expect(clampMushafFontSize(30.4)).toBe(30);

    expect(computePinchFontSize(28, 100, 125)).toBe(35);
    expect(computePinchFontSize(28, 100, 50)).toBe(20);
    expect(computePinchFontSize(36, 100, 180)).toBe(48);
    expect(computePinchFontSize(28, 0, 120)).toBe(28);
  });

  it('resolves RTL Mushaf page swipes without triggering on vertical scroll', () => {
    // Swiping rightward advances to next Arabic Mushaf page (+1)
    expect(resolveRtlPageSwipeDelta(90, 10)).toBe(1);
    // Swiping leftward goes back to previous Arabic Mushaf page (-1)
    expect(resolveRtlPageSwipeDelta(-95, 15)).toBe(-1);
    // Short jitter or vertical scroll is ignored
    expect(resolveRtlPageSwipeDelta(35, 5)).toBe(0);
    expect(resolveRtlPageSwipeDelta(80, 75)).toBe(0);
  });

  it('toggles immersive mode only on clean short single taps', () => {
    expect(
      shouldToggleImmersiveTap({
        dx: 2,
        dy: -3,
        durationMs: 140,
        didPinch: false,
        didLongPress: false,
        didSwipe: false,
        hasSelection: false,
        isInteractiveTarget: false,
      })
    ).toBe(true);

    // Rejects taps on buttons/links, drags, long-presses, text selections, pinches, or swipes
    expect(
      shouldToggleImmersiveTap({
        dx: 0,
        dy: 0,
        durationMs: 120,
        didPinch: false,
        didLongPress: false,
        didSwipe: false,
        hasSelection: false,
        isInteractiveTarget: true,
      })
    ).toBe(false);

    expect(
      shouldToggleImmersiveTap({
        dx: 1,
        dy: 1,
        durationMs: 150,
        didPinch: false,
        didLongPress: true,
        didSwipe: false,
        hasSelection: false,
        isInteractiveTarget: false,
      })
    ).toBe(false);

    expect(
      shouldToggleImmersiveTap({
        dx: 14,
        dy: 2,
        durationMs: 150,
        didPinch: false,
        didLongPress: false,
        didSwipe: false,
        hasSelection: false,
        isInteractiveTarget: false,
      })
    ).toBe(false);

    expect(
      shouldToggleImmersiveTap({
        dx: 0,
        dy: 0,
        durationMs: 120,
        didPinch: false,
        didLongPress: false,
        didSwipe: false,
        hasSelection: true,
        isInteractiveTarget: false,
      })
    ).toBe(false);
  });

  it('computes consistent ruled line spacing metrics scaled to font size', () => {
    expect(computeRuledLineMetrics(28).lineHeightPx).toBe(63);
    expect(computeRuledLineMetrics(20).lineHeightPx).toBe(45);
    expect(computeRuledLineMetrics(48).lineHeightPx).toBe(108);
  });

  it('resolves auto-scroll end action across page and surah modes without skipping while loading', () => {
    expect(
      resolveAutoScrollEndAction({
        readerMode: 'page',
        currentPage: 12,
        currentSurah: 2,
        autoAdvancePage: true,
        isLoadingPage: false,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'advance-page', nextPage: 13 });

    // Never skips page 604
    expect(
      resolveAutoScrollEndAction({
        readerMode: 'page',
        currentPage: 604,
        currentSurah: 114,
        autoAdvancePage: true,
        isLoadingPage: false,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'stop' });

    // Waits cleanly while loading or mid-transition
    expect(
      resolveAutoScrollEndAction({
        readerMode: 'page',
        currentPage: 12,
        currentSurah: 2,
        autoAdvancePage: true,
        isLoadingPage: true,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'wait' });

    expect(
      resolveAutoScrollEndAction({
        readerMode: 'page',
        currentPage: 12,
        currentSurah: 2,
        autoAdvancePage: true,
        isLoadingPage: false,
        isAdvancingPage: true,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'wait' });

    // Stops when user disables autoAdvancePage
    expect(
      resolveAutoScrollEndAction({
        readerMode: 'page',
        currentPage: 12,
        currentSurah: 2,
        autoAdvancePage: false,
        isLoadingPage: false,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'stop' });

    // Advances Surah in full-surah mode up to 114
    expect(
      resolveAutoScrollEndAction({
        readerMode: 'surah',
        currentPage: 590,
        currentSurah: 87,
        autoAdvancePage: true,
        isLoadingPage: false,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'advance-surah', nextSurah: 88 });

    expect(
      resolveAutoScrollEndAction({
        readerMode: 'surah',
        currentPage: 604,
        currentSurah: 114,
        autoAdvancePage: true,
        isLoadingPage: false,
        isAdvancingPage: false,
        canNavigateSurah: true,
      })
    ).toEqual({ action: 'stop' });
  });

  it('computes calm dwell time for short pages that fit on screen without scrolling', () => {
    expect(computeShortPageDwellMs(1)).toBe(12000);
    expect(computeShortPageDwellMs(2)).toBe(6000);
    expect(computeShortPageDwellMs(5)).toBe(2500);
    expect(computeShortPageDwellMs(99)).toBe(2500);
  });

  it('manages continuous Mushaf page stream without duplicates and resolves visible page cleanly', () => {
    const initial = [{ pageNumber: 10 }, { pageNumber: 11 }];
    expect(appendUniquePageItem(initial, { pageNumber: 11 })).toBe(initial);
    expect(appendUniquePageItem(initial, { pageNumber: 12 })).toEqual([
      { pageNumber: 10 },
      { pageNumber: 11 },
      { pageNumber: 12 },
    ]);

    const offsets = [
      { pageNumber: 10, top: -450, bottom: 210 },
      { pageNumber: 11, top: 218, bottom: 900 },
      { pageNumber: 12, top: 908, bottom: 1600 },
    ];
    expect(resolveVisiblePageFromOffsets(offsets, 200, 10)).toBe(10);
    expect(resolveVisiblePageFromOffsets(offsets, 260, 10)).toBe(11);
    expect(resolveVisiblePageFromOffsets(offsets, 920, 11)).toBe(12);

    const longStream = [10, 11, 12, 13, 14, 15, 16, 17].map((p) => ({ pageNumber: p }));
    const trimmed = computeTrimmedPageStream(longStream, 16, 6);
    expect(trimmed.trimmedPageNumbers).toEqual([10, 11]);
    expect(trimmed.kept.map((p) => p.pageNumber)).toEqual([12, 13, 14, 15, 16, 17]);
  });

  it('pairs all 4 Mushaf paper themes (including sepia and emerald) when switching global Day/Night mode', () => {
    expect(resolvePairedPaperTheme('dark', 'light')).toBe('parchment');
    expect(resolvePairedPaperTheme('emerald', 'light')).toBe('parchment');
    expect(resolvePairedPaperTheme('parchment', 'dark')).toBe('dark');
    expect(resolvePairedPaperTheme('sepia', 'dark')).toBe('dark');

    // Keeps user's preferred shade when global theme matches brightness polarity
    expect(resolvePairedPaperTheme('sepia', 'light')).toBe('sepia');
    expect(resolvePairedPaperTheme('emerald', 'dark')).toBe('emerald');
  });

  it('wraps positive and negative circular dock indices seamlessly without gaps', () => {
    expect(wrapCircularIndex(0, 9)).toBe(0);
    expect(wrapCircularIndex(9, 9)).toBe(0);
    expect(wrapCircularIndex(11, 9)).toBe(2);
    expect(wrapCircularIndex(-1, 9)).toBe(8);
    expect(wrapCircularIndex(-10, 9)).toBe(8);
    expect(wrapCircularIndex(3, 0)).toBe(0);

    expect(clampCircularMomentumSlots(50)).toBe(2.5);
    expect(clampCircularMomentumSlots(-50)).toBe(-2.5);
    expect(clampCircularMomentumSlots(5)).toBeCloseTo(0.8);
  });

  it('computes RTL circular dial visible slots with smooth right-exit and left-entry edge taper', () => {
    // At rest (offset 0), 4 center slots (0..3) are crisp and interactive while edge buffers are hidden
    const restSlots = computeCircularDialSlots(0, 9, 4);
    expect(restSlots).toHaveLength(6);
    const interactiveRest = restSlots.filter((s) => s.slotPosition >= 0 && s.slotPosition <= 3);
    expect(interactiveRest.map((s) => s.itemIndex)).toEqual([0, 1, 2, 3]);
    expect(interactiveRest.every((s) => s.opacity === 1 && s.scale === 1 && s.isInteractive)).toBe(true);

    // Dragging rightward (virtualOffset = 0.5): slot 0 shifts right behind divider (opacity < 1),
    // while item 4 enters from the left edge with balanced taper
    const midDragSlots = computeCircularDialSlots(0.5, 9, 4);
    const exitingSlot = midDragSlots.find((s) => s.virtualSlot === 0);
    const enteringSlot = midDragSlots.find((s) => s.virtualSlot === 4);
    expect(exitingSlot?.slotPosition).toBe(-0.5);
    expect(exitingSlot?.opacity).toBeLessThan(1);
    expect(exitingSlot?.scale).toBeLessThan(1);
    expect(enteringSlot?.itemIndex).toBe(4);
    expect(enteringSlot?.slotPosition).toBe(3.5);
    expect(enteringSlot?.opacity).toBeLessThan(1);

    // Negative offset wraps end items cleanly from right divider
    const reverseSlots = computeCircularDialSlots(-1, 9, 4);
    const activeReverse = reverseSlots.filter((s) => s.slotPosition >= 0 && s.slotPosition <= 3);
    expect(activeReverse.map((s) => s.itemIndex)).toEqual([8, 0, 1, 2]);
  });

  it('supports fine fractional auto-scroll speeds (0.4x-5.0x), +/- stepping, and font-size calibration', () => {
    expect(clampAutoScrollSpeed(0.1)).toBe(0.4);
    expect(clampAutoScrollSpeed(7.5)).toBe(5.0);
    expect(clampAutoScrollSpeed(Number.NaN)).toBe(1.6);

    // Fine 0.1x precision below 1.0x and symmetric 0.2x steps above 1.0x
    expect(stepAutoScrollSpeed(0.4, -1)).toBe(0.4);
    expect(stepAutoScrollSpeed(0.4, 1)).toBe(0.5);
    expect(stepAutoScrollSpeed(0.9, 1)).toBe(1.0);
    expect(stepAutoScrollSpeed(1.0, -1)).toBe(0.9);
    expect(stepAutoScrollSpeed(1.0, 1)).toBe(1.2);
    expect(stepAutoScrollSpeed(1.2, -1)).toBe(1.0);
    expect(stepAutoScrollSpeed(5.0, 1)).toBe(5.0);

    // Monotonic velocity curve slower below 1x and faster with larger font when adaptive pace is enabled
    const slowPx = computeAutoScrollPxPerSec(0.4, 28, true);
    const basePx = computeAutoScrollPxPerSec(1.6, 28, true);
    const fastPx = computeAutoScrollPxPerSec(5.0, 28, true);
    expect(slowPx).toBeLessThan(10);
    expect(basePx).toBeGreaterThan(20);
    expect(fastPx).toBeGreaterThan(90);

    expect(computeAutoScrollPxPerSec(1.6, 42, true)).toBeGreaterThan(basePx);
    expect(computeAutoScrollPxPerSec(1.6, 42, false)).toBe(basePx);
    expect(computeShortPageDwellMs(0.4)).toBe(24000);
    expect(formatArabicSpeedLabel(0.4)).toBe('٠.٤×');
    expect(formatArabicSpeedLabel(1.6)).toBe('١.٦×');
    expect(formatArabicSpeedLabel(5.0)).toBe('٥.٠×');
  });
});
