export type CardAspectRatio = 'post' | 'story' | 'landscape';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export function getCanvasDimensions(aspect: CardAspectRatio): CanvasDimensions {
  switch (aspect) {
    case 'story':
      return { width: 1080, height: 1920 };
    case 'landscape':
      return { width: 1920, height: 1080 };
    case 'post':
    default:
      return { width: 1080, height: 1080 };
  }
}

export function getVideoExportDimensions(aspect: CardAspectRatio): CanvasDimensions {
  switch (aspect) {
    case 'story':
      return { width: 720, height: 1280 };
    case 'landscape':
      return { width: 1280, height: 720 };
    case 'post':
    default:
      return { width: 900, height: 900 };
  }
}

/**
 * Builds the canonical deep-link URL to open a specific Surah & Ayah directly in Bayan.
 */
export function buildAyahDeepLink(origin: string, surahNumber: number, ayahNumber: number): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const safeSurah = Math.max(1, Math.min(114, Math.floor(surahNumber) || 1));
  const safeAyah = Math.max(1, Math.floor(ayahNumber) || 1);
  return `${cleanOrigin}/?surah=${safeSurah}&ayah=${safeAyah}`;
}

const ALLAH_BARE_FORMS = new Set([
  'الله',
  'لله',
  'بالله',
  'والله',
  'فالله',
  'تالله',
  'ابالله',
  'ءالله',
  'أالله',
]);

/**
 * Strips Quranic diacritics/signs and checks whether a token is لفظ الجلالة.
 */
export function isAllahWord(word: string): boolean {
  if (!word) return false;
  // Normalize alef wasla (\u0671) to plain alef, remove tashkeel/Quranic marks & punctuation
  const normalized = word
    .replace(/\u0671/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[﴿﴾()[\].,،؛:؟!«»"']/g, '')
    .trim();

  return ALLAH_BARE_FORMS.has(normalized);
}

/**
 * Wraps text into lines that fit within maxWidth using the supplied measurement function.
 */
export function wrapArabicLines(
  text: string,
  maxWidth: number,
  measureWidth: (str: string) => number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && measureWidth(candidate) > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Auto-fits Quranic font size so short ayahs feel monumental and long ayahs fit gracefully.
 */
export function computeAutoFitFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  measureWithFont: (str: string, fontSizePx: number) => number,
  options?: { minSize?: number; maxSize?: number; lineHeightMultiplier?: number }
): { fontSize: number; lines: string[] } {
  const minSize = options?.minSize ?? 24;
  const maxSize = options?.maxSize ?? 64;
  const lineMult = options?.lineHeightMultiplier ?? 2.05;

  // Pick a smart upper ceiling based on character length to keep short ayahs balanced
  const charLen = text.length;
  const initialCeiling =
    charLen < 45 ? maxSize :
    charLen < 95 ? Math.min(maxSize, 52) :
    charLen < 170 ? Math.min(maxSize, 44) :
    Math.min(maxSize, 36);

  for (let size = initialCeiling; size >= minSize; size -= 2) {
    const lines = wrapArabicLines(text, maxWidth, (s) => measureWithFont(s, size));
    const totalH = lines.length * size * lineMult;
    if (totalH <= maxHeight) {
      return { fontSize: size, lines };
    }
  }

  const fallbackLines = wrapArabicLines(text, maxWidth, (s) => measureWithFont(s, minSize));
  return { fontSize: minSize, lines: fallbackLines };
}

/**
 * Draws an image cleanly scaled to cover a target rectangle (aspect-fill) with optional slow-zoom.
 */
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
  zoomFactor = 1
): void {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return;

  const baseScale = Math.max(dWidth / imgW, dHeight / imgH);
  const scale = baseScale * Math.max(1, zoomFactor);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = dx + (dWidth - drawW) / 2;
  const offsetY = dy + (dHeight - drawH) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dWidth, dHeight);
  ctx.clip();
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

export interface SupportedVideoFormat {
  mimeType: string;
  extension: 'mp4' | 'webm';
}

/**
 * Detects the best supported video+audio recording MIME type in the current browser.
 */
export function detectSupportedVideoFormat(): SupportedVideoFormat | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidates: SupportedVideoFormat[] = [
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];

  for (const c of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }

  return null;
}
