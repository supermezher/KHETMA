export const MUSHAF_MIN_FONT_SIZE = 20;
export const MUSHAF_MAX_FONT_SIZE = 48;

const ARABIC_JUZ_NAMES = [
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
  'الحادي عشر',
  'الثاني عشر',
  'الثالث عشر',
  'الرابع عشر',
  'الخامس عشر',
  'السادس عشر',
  'السابع عشر',
  'الثامن عشر',
  'التاسع عشر',
  'العشرون',
  'الحادي والعشرون',
  'الثاني والعشرون',
  'الثالث والعشرون',
  'الرابع والعشرون',
  'الخامس والعشرون',
  'السادس والعشرون',
  'السابع والعشرون',
  'الثامن والعشرون',
  'التاسع والعشرون',
  'الثلاثون',
] as const;

export function getArabicJuzLabel(juzNumber: number): string {
  const idx = Math.min(30, Math.max(1, Math.round(Number.isFinite(juzNumber) ? juzNumber : 1))) - 1;
  return `الجزء ${ARABIC_JUZ_NAMES[idx]}`;
}

export function clampMushafFontSize(size: number): number {
  if (!Number.isFinite(size)) return 28;
  return Math.min(MUSHAF_MAX_FONT_SIZE, Math.max(MUSHAF_MIN_FONT_SIZE, Math.round(size)));
}

export function computePinchFontSize(
  initialSize: number,
  startDist: number,
  currentDist: number
): number {
  if (!Number.isFinite(startDist) || startDist <= 4 || !Number.isFinite(currentDist) || currentDist <= 0) {
    return clampMushafFontSize(initialSize);
  }
  const ratio = currentDist / startDist;
  return clampMushafFontSize(initialSize * ratio);
}

/**
 * Resolves RTL Arabic Mushaf page swipe direction:
 * - Swiping left-to-right (dx >= threshold) advances to the next page (+1), matching Arabic book turn.
 * - Swiping right-to-left (dx <= -threshold) returns to the previous page (-1).
 */
export function resolveRtlPageSwipeDelta(
  dx: number,
  dy: number,
  thresholdPx = 56
): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < thresholdPx) return 0;
  if (Math.abs(dx) <= Math.abs(dy) * 1.35) return 0;
  return dx > 0 ? 1 : -1;
}

export function isInteractiveTapTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean(
    (target as Element).closest(
      'button, a, input, select, textarea, label, [role="button"], [data-no-tap-toggle="true"]'
    )
  );
}

export interface ImmersiveTapCheckInput {
  dx: number;
  dy: number;
  durationMs: number;
  didPinch: boolean;
  didLongPress: boolean;
  didSwipe: boolean;
  hasSelection: boolean;
  isInteractiveTarget: boolean;
}

export function shouldToggleImmersiveTap(input: ImmersiveTapCheckInput): boolean {
  if (
    input.didPinch ||
    input.didLongPress ||
    input.didSwipe ||
    input.hasSelection ||
    input.isInteractiveTarget
  ) {
    return false;
  }
  const distance = Math.hypot(input.dx, input.dy);
  return distance < 10 && input.durationMs >= 0 && input.durationMs <= 360;
}

export function computeRuledLineMetrics(fontSize: number): {
  lineHeightPx: number;
} {
  const safeSize = clampMushafFontSize(fontSize);
  return {
    lineHeightPx: Math.round(safeSize * 2.25),
  };
}

export interface AutoScrollEndInput {
  readerMode: 'page' | 'surah';
  currentPage: number;
  currentSurah: number;
  autoAdvancePage: boolean;
  isLoadingPage: boolean;
  isAdvancingPage: boolean;
  canNavigateSurah: boolean;
}

export type AutoScrollEndDecision =
  | { action: 'wait' }
  | { action: 'advance-page'; nextPage: number }
  | { action: 'advance-surah'; nextSurah: number }
  | { action: 'stop' };

export function computeShortPageDwellMs(speed: number): number {
  const safeSpeed = Number.isFinite(speed) ? Math.min(5, Math.max(1, speed)) : 2;
  return Math.max(2500, Math.round(12000 / safeSpeed));
}

export function resolveAutoScrollEndAction(input: AutoScrollEndInput): AutoScrollEndDecision {
  if (input.isLoadingPage || input.isAdvancingPage) {
    return { action: 'wait' };
  }
  if (!input.autoAdvancePage) {
    return { action: 'stop' };
  }
  if (input.readerMode === 'page') {
    if (input.currentPage < 604) {
      return { action: 'advance-page', nextPage: Math.max(1, input.currentPage + 1) };
    }
    return { action: 'stop' };
  }
  if (input.canNavigateSurah && input.currentSurah < 114) {
    return { action: 'advance-surah', nextSurah: Math.max(1, input.currentSurah + 1) };
  }
  return { action: 'stop' };
}

export function appendUniquePageItem<T extends { pageNumber: number }>(stream: T[], nextItem: T): T[] {
  if (stream.some((item) => item.pageNumber === nextItem.pageNumber)) {
    return stream;
  }
  return [...stream, nextItem].sort((a, b) => a.pageNumber - b.pageNumber);
}

export interface PageViewportEntry {
  pageNumber: number;
  top: number;
  bottom: number;
}

export function resolveVisiblePageFromOffsets(
  entries: PageViewportEntry[],
  readingLineY: number,
  fallbackPage: number
): number {
  if (entries.length === 0) return fallbackPage;
  for (const entry of entries) {
    if (entry.top <= readingLineY && entry.bottom >= readingLineY) {
      return entry.pageNumber;
    }
  }
  let bestAbove: PageViewportEntry | null = null;
  for (const entry of entries) {
    if (entry.top <= readingLineY) {
      bestAbove = entry;
    }
  }
  if (bestAbove) return bestAbove.pageNumber;
  return entries[0].pageNumber;
}

export function computeTrimmedPageStream<T extends { pageNumber: number }>(
  stream: T[],
  activePage: number,
  maxPages = 6
): { kept: T[]; trimmedPageNumbers: number[] } {
  if (stream.length <= maxPages) {
    return { kept: stream, trimmedPageNumbers: [] };
  }
  const minKeepPage = activePage - 2;
  const trimmedPageNumbers: number[] = [];
  const kept: T[] = [];

  for (let i = 0; i < stream.length; i++) {
    const item = stream[i];
    const remainingCount = stream.length - trimmedPageNumbers.length;
    if (remainingCount > maxPages && item.pageNumber < minKeepPage) {
      trimmedPageNumbers.push(item.pageNumber);
    } else {
      kept.push(item);
    }
  }

  return { kept, trimmedPageNumbers };
}

export type MushafPaperTheme = 'parchment' | 'sepia' | 'dark' | 'emerald';

export function resolvePairedPaperTheme(
  currentPaper: MushafPaperTheme,
  nextAppTheme: 'light' | 'dark'
): MushafPaperTheme {
  if (nextAppTheme === 'light' && (currentPaper === 'dark' || currentPaper === 'emerald')) {
    return 'parchment';
  }
  if (nextAppTheme === 'dark' && (currentPaper === 'parchment' || currentPaper === 'sepia')) {
    return 'dark';
  }
  return currentPaper;
}

export function wrapCircularIndex(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const rounded = Math.round(index);
  return ((rounded % count) + count) % count;
}

export function clampCircularMomentumSlots(velocitySlotsPerSec: number, maxExtraSlots = 2.5): number {
  if (!Number.isFinite(velocitySlotsPerSec)) return 0;
  // Convert release velocity into an intuitive throw distance (~160ms glide)
  const projected = velocitySlotsPerSec * 0.16;
  return Math.max(-maxExtraSlots, Math.min(maxExtraSlots, projected));
}

export interface CircularDialSlot {
  virtualSlot: number;
  itemIndex: number;
  slotPosition: number;
  opacity: number;
  scale: number;
  isInteractive: boolean;
}

/**
 * Computes rendered slots for an infinite RTL circular dock.
 * - `slotPosition = 0` sits at the rightmost visible slot next to the anchored CTA,
 *   and `visibleSlots - 1` sits at the leftmost visible edge.
 * - Increasing `virtualOffset` shifts items rightward (`slotPosition` decreases),
 *   so slot `0` fades off behind the right divider while new wrapped items enter from the left.
 */
export function computeCircularDialSlots(
  virtualOffset: number,
  itemCount: number,
  visibleSlots = 4
): CircularDialSlot[] {
  if (!Number.isFinite(itemCount) || itemCount <= 0 || visibleSlots <= 0) {
    return [];
  }
  const safeOffset = Number.isFinite(virtualOffset) ? virtualOffset : 0;
  const baseIndex = Math.floor(safeOffset);
  const fraction = safeOffset - baseIndex;
  const slots: CircularDialSlot[] = [];

  for (let s = -1; s <= visibleSlots; s += 1) {
    const virtualSlot = baseIndex + s;
    const slotPosition = s - fraction;
    let overshoot = 0;
    if (slotPosition < 0) {
      overshoot = -slotPosition;
    } else if (slotPosition > visibleSlots - 1) {
      overshoot = slotPosition - (visibleSlots - 1);
    }

    const opacity = overshoot <= 0 ? 1 : Math.max(0, Number((1 - overshoot * 1.18).toFixed(3)));
    const scale = overshoot <= 0 ? 1 : Math.max(0.84, Number((1 - overshoot * 0.16).toFixed(3)));

    slots.push({
      virtualSlot,
      itemIndex: wrapCircularIndex(virtualSlot, itemCount),
      slotPosition: Number(slotPosition.toFixed(4)),
      opacity,
      scale,
      isInteractive: opacity > 0.35,
    });
  }

  return slots;
}

