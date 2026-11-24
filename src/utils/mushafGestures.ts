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

export interface ReciterFollowBehaviorInput {
  isPlayingAudio: boolean;
  scrollMode: 'reciter-sync' | 'manual-speed';
  isManualHighlightMode: boolean;
  hasManualHighlight: boolean;
  isExplicitNavigation: boolean;
}

export interface ReciterFollowBehaviorResult {
  shouldJumpMushafPage: boolean;
  shouldSyncReciterScroll: boolean;
}

export function resolveReciterFollowBehavior(
  input: ReciterFollowBehaviorInput
): ReciterFollowBehaviorResult {
  if (!input.isPlayingAudio) {
    return {
      shouldJumpMushafPage: true,
      shouldSyncReciterScroll: false,
    };
  }

  const isDecoupledForStudy =
    input.isManualHighlightMode ||
    input.hasManualHighlight ||
    input.scrollMode === 'manual-speed';

  if (isDecoupledForStudy) {
    return {
      shouldJumpMushafPage: input.isExplicitNavigation,
      shouldSyncReciterScroll: false,
    };
  }

  return {
    shouldJumpMushafPage: true,
    shouldSyncReciterScroll: true,
  };
}

export function resolveAyahSelectionTarget(
  isPlayingAudio: boolean,
  isManualHighlightMode = false
): 'manual-highlight' | 'active-ayah' {
  return isPlayingAudio || isManualHighlightMode ? 'manual-highlight' : 'active-ayah';
}

export interface ManualHighlightAnchorInput {
  elementTopOffset: number;
  containerHeight: number;
  currentScrollTop: number;
  maxScrollTop: number;
}

export function computeManualHighlightAnchorScrollTop(
  input: ManualHighlightAnchorInput
): number | null {
  if (
    !Number.isFinite(input.elementTopOffset) ||
    !Number.isFinite(input.containerHeight) ||
    input.containerHeight <= 0
  ) {
    return null;
  }
  const relativeY = input.elementTopOffset - input.currentScrollTop;
  const minComfort = input.containerHeight * 0.2;
  const maxComfort = input.containerHeight * 0.68;
  if (relativeY >= minComfort && relativeY <= maxComfort) {
    return null;
  }
  const target = input.elementTopOffset - input.containerHeight * 0.34;
  return Math.max(0, Math.min(Math.max(0, input.maxScrollTop), Math.round(target)));
}

export function resolveAutoScrollStateOnAudioChange(input: {
  wasPlaying: boolean;
  isPlaying: boolean;
  isSmartScrollActive: boolean;
  isManualHighlightActive: boolean;
}): {
  shouldUpdateAutoScroll: boolean;
  nextIsAutoScrolling: boolean;
  nextScrollMode?: 'reciter-sync' | 'manual-speed';
} {
  if (!input.wasPlaying && input.isPlaying) {
    return {
      shouldUpdateAutoScroll: input.isSmartScrollActive,
      nextIsAutoScrolling: true,
      nextScrollMode: input.isManualHighlightActive ? 'manual-speed' : 'reciter-sync',
    };
  }
  if (input.wasPlaying && !input.isPlaying) {
    return {
      shouldUpdateAutoScroll: true,
      nextIsAutoScrolling: false,
    };
  }
  return {
    shouldUpdateAutoScroll: false,
    nextIsAutoScrolling: false,
  };
}

export interface ReciterSyncTargetInput {
  containerTop: number;
  containerHeight: number;
  currentScrollTop: number;
  maxScrollTop: number;
  ayahTop: number;
  ayahHeight: number;
  activeWordTop?: number | null;
  activeWordHeight?: number | null;
  progressRatio: number;
  focalRatio?: number;
}

export function computeReciterSyncTargetScrollTop(input: ReciterSyncTargetInput): number {
  const {
    containerTop,
    containerHeight,
    currentScrollTop,
    maxScrollTop,
    ayahTop,
    ayahHeight,
    activeWordTop,
    activeWordHeight,
    progressRatio,
    focalRatio = 0.34,
  } = input;

  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return 0;
  }

  const safeMax = Math.max(0, Number.isFinite(maxScrollTop) ? maxScrollTop : 0);
  const focalOffset = containerHeight * focalRatio;

  let anchorY: number;
  if (
    typeof activeWordTop === 'number' &&
    Number.isFinite(activeWordTop) &&
    typeof activeWordHeight === 'number' &&
    Number.isFinite(activeWordHeight) &&
    activeWordHeight > 0
  ) {
    anchorY = activeWordTop - containerTop + currentScrollTop + activeWordHeight * 0.45;
  } else {
    const safeProgress = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0;
    const intraOffset = safeProgress * Math.max(0, (Number.isFinite(ayahHeight) ? ayahHeight : 0) - 35);
    anchorY = ayahTop - containerTop + currentScrollTop + intraOffset;
  }

  return Math.max(0, Math.min(safeMax, anchorY - focalOffset));
}

export function computeReciterSyncStepScrollTop(input: {
  currentPreciseTop: number;
  targetScrollTop: number;
  deltaSeconds?: number;
  playbackRate?: number;
  smoothing?: number;
  stopThresholdPx?: number;
}): {
  nextPreciseTop: number;
  shouldScroll: boolean;
} {
  const {
    currentPreciseTop,
    targetScrollTop,
    deltaSeconds,
    playbackRate = 1,
    smoothing,
    stopThresholdPx = 0.4,
  } = input;

  if (!Number.isFinite(currentPreciseTop) || !Number.isFinite(targetScrollTop)) {
    return { nextPreciseTop: 0, shouldScroll: false };
  }

  const diff = targetScrollTop - currentPreciseTop;
  if (Math.abs(diff) <= stopThresholdPx) {
    return { nextPreciseTop: currentPreciseTop, shouldScroll: false };
  }

  let step: number;
  if (typeof smoothing === 'number' && Number.isFinite(smoothing)) {
    step = diff * smoothing;
  } else {
    const safeDt =
      typeof deltaSeconds === 'number' && Number.isFinite(deltaSeconds)
        ? Math.min(0.1, Math.max(0.004, deltaSeconds))
        : 1 / 60;
    const safeRate = Number.isFinite(playbackRate) ? Math.min(3, Math.max(0.5, playbackRate)) : 1;

    // Responsive, frame-rate independent follower that accelerates smoothly when the reciter moves ahead
    const lagBoost = diff > 20 ? Math.min(10, (diff - 20) * 0.08) : 0;
    const followRate = (diff > 0 ? 8.5 + lagBoost : 9.0) * safeRate;
    const alpha = 1 - Math.exp(-followRate * safeDt);
    step = diff * alpha;

    // Guarantee minimum catch-up speed when lagging > 18px behind forward recitation so voice never outruns scroll
    if (diff > 18) {
      const minCatchUpStep = Math.min(diff, 140 * safeRate * safeDt);
      if (step < minCatchUpStep) {
        step = minCatchUpStep;
      }
    }
  }

  // Preserve fractional progress above integer rounding stall threshold without overshooting target
  const minStep = Math.min(Math.abs(diff), 0.35) * Math.sign(diff);
  const clampedStep =
    Math.abs(step) >= Math.abs(minStep)
      ? Math.min(Math.abs(diff), Math.abs(step)) * Math.sign(diff)
      : minStep;

  return {
    nextPreciseTop: currentPreciseTop + clampedStep,
    shouldScroll: true,
  };
}

export interface ReciteStartTargetInput {
  readerMode: 'page' | 'surah';
  currentSurahNumber: number;
  activeAyahNumber: number;
  visiblePageAyahs: Array<{ surahNumber: number; numberInSurah: number }>;
  manualHighlight: { surahNumber: number; ayahNumber: number } | null;
}

export interface ReciteStartTargetResult {
  surahNumber: number;
  ayahNumber: number;
  needsSwitch: boolean;
}

export function resolveReciteStartTarget(
  input: ReciteStartTargetInput
): ReciteStartTargetResult {
  if (input.readerMode !== 'page' || input.visiblePageAyahs.length === 0) {
    return {
      surahNumber: input.currentSurahNumber,
      ayahNumber: input.activeAyahNumber,
      needsSwitch: false,
    };
  }

  const activeIsOnVisiblePage = input.visiblePageAyahs.some(
    (a) =>
      a.surahNumber === input.currentSurahNumber &&
      a.numberInSurah === input.activeAyahNumber
  );
  if (activeIsOnVisiblePage) {
    return {
      surahNumber: input.currentSurahNumber,
      ayahNumber: input.activeAyahNumber,
      needsSwitch: false,
    };
  }

  if (input.manualHighlight) {
    const highlightOnVisiblePage = input.visiblePageAyahs.some(
      (a) =>
        a.surahNumber === input.manualHighlight!.surahNumber &&
        a.numberInSurah === input.manualHighlight!.ayahNumber
    );
    if (highlightOnVisiblePage) {
      return {
        surahNumber: input.manualHighlight.surahNumber,
        ayahNumber: input.manualHighlight.ayahNumber,
        needsSwitch: true,
      };
    }
  }

  const firstVisible = input.visiblePageAyahs[0];
  return {
    surahNumber: firstVisible.surahNumber,
    ayahNumber: firstVisible.numberInSurah,
    needsSwitch:
      firstVisible.surahNumber !== input.currentSurahNumber ||
      firstVisible.numberInSurah !== input.activeAyahNumber,
  };
}

export function shouldJumpMushafPageForAyah(input: {
  readerMode: 'page' | 'surah';
  targetPage: number;
  loadedStreamPages: number[];
  isReaderModeChanged: boolean;
}): boolean {
  if (input.readerMode !== 'page') return true;
  if (input.isReaderModeChanged || input.loadedStreamPages.length === 0) return true;
  return !input.loadedStreamPages.includes(input.targetPage);
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

export const MIN_AUTO_SCROLL_SPEED = 0.4;
export const MAX_AUTO_SCROLL_SPEED = 5.0;
export const DEFAULT_AUTO_SCROLL_SPEED = 1.6;

export const AUTO_SCROLL_PRESETS = [
  { id: 'tahqiq', label: 'تحقيق وتدبّر', speed: 0.6 },
  { id: 'tadwir', label: 'تدوير معتدل', speed: 1.6 },
  { id: 'hadr', label: 'حدر ومراجعة', speed: 3.2 },
] as const;

export function clampAutoScrollSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_AUTO_SCROLL_SPEED;
  const clamped = Math.min(MAX_AUTO_SCROLL_SPEED, Math.max(MIN_AUTO_SCROLL_SPEED, speed));
  return Math.round(clamped * 10) / 10;
}

export function stepAutoScrollSpeed(currentSpeed: number, direction: 1 | -1): number {
  const safe = clampAutoScrollSpeed(currentSpeed);
  // Fine 0.1x precision below 1.0x for calm reading, crisp 0.2x steps from 1.0x to 5.0x
  const useFineStep = direction > 0 ? safe < 1.0 : safe <= 1.0;
  const delta = useFineStep ? 0.1 : 0.2;
  return clampAutoScrollSpeed(safe + direction * delta);
}

export function computeAutoScrollPxPerSec(
  speed: number,
  fontSize = 28,
  adaptiveFontPace = true
): number {
  const s = clampAutoScrollSpeed(speed);
  const basePxPerSec = 3.2 + 10.5 * s + 1.58 * s * s;
  if (!adaptiveFontPace) {
    return Math.round(basePxPerSec * 10) / 10;
  }
  const safeFont = clampMushafFontSize(fontSize);
  const scaleFactor = Math.min(1.55, Math.max(0.75, safeFont / 28));
  return Math.round(basePxPerSec * scaleFactor * 10) / 10;
}

export function computeShortPageDwellMs(speed: number): number {
  const safeSpeed = Number.isFinite(speed)
    ? Math.min(MAX_AUTO_SCROLL_SPEED, Math.max(MIN_AUTO_SCROLL_SPEED, speed))
    : DEFAULT_AUTO_SCROLL_SPEED;
  return Math.max(2500, Math.min(24000, Math.round(12000 / safeSpeed)));
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function formatArabicSpeedLabel(speed: number): string {
  const safe = clampAutoScrollSpeed(speed);
  const localized = safe.toFixed(1).replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);
  return `${localized}×`;
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

