/**
 * Normalizes Arabic Quranic text by removing diacritics (tashkeel), tatweel,
 * BOM characters, and unifying alef/hamza/taa-marbuta forms for reliable search.
 */
export function normalizeArabicText(input: string): string {
  if (!input) return '';
  return input
    .replace(/\uFEFF/g, '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u064A0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
