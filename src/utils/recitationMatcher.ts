import { normalizeArabicText } from './arabicNormalize';
import { getSpokenWordRawIndices } from './tajweedParser';

export interface SpeechRecognitionLikeEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    [index: number]: { transcript: string; confidence?: number };
  }>;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionLikeEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

export type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

// Common Uthmani -> modern Arabic normalization map (keeps matching crisp without false positives)
const UTHMANI_SPECIAL_WORD_MAP: Record<string, string> = {
  الصلوه: 'الصلاه',
  صلوه: 'صلاه',
  الزكوه: 'الزكاه',
  زكوه: 'زكاه',
  الحيوه: 'الحياه',
  حيوه: 'حياه',
  مشكوه: 'مشكاه',
  الربوا: 'الربا',
  الغدوه: 'الغداه',
  النجوه: 'النجاه',
  منوه: 'مناه',
  السموت: 'السماوات',
  سموت: 'سماوات',
  اوليك: 'اولئك',
  هاولا: 'هؤلاء',
  يايها: 'ياايها',
};

/**
 * Strips Quranic pause marks, tashkeel, tatweel, and normalizes Alef/Hamza/Taa/Yaa forms
 * so Uthmani Mushaf words compare reliably against modern Arabic ASR transcripts.
 */
export function normalizeQuranWordForMatch(word: string): string {
  const base = normalizeArabicText(word)
    .replace(/\s+/g, '')
    .replace(/ء/g, '');
  if (!base) return '';
  return UTHMANI_SPECIAL_WORD_MAP[base] || base;
}

/**
 * Computes a skeleton omitting medial/trailing long Alef ('ا') which Uthmani script often
 * writes via dagger alef (dropped by standard diacritic strippers) while ASR writes full Alef.
 * Examples: الرحمٰن (الرحمن) vs الرحمن, مٰلك (ملك) vs مالك, الكتٰب (الكتب) vs الكتاب.
 */
function toDaggerAlefSkeleton(normalizedWord: string): string {
  if (!normalizedWord) return '';
  const first = normalizedWord[0];
  const rest = normalizedWord.slice(1).replace(/ا/g, '');
  return first + rest;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

export function areRecitedWordsEquivalent(expectedWord: string, spokenWord: string): boolean {
  const exp = normalizeQuranWordForMatch(expectedWord);
  const spk = normalizeQuranWordForMatch(spokenWord);
  if (!exp || !spk) return false;
  if (exp === spk) return true;

  // Handle dagger-alef orthographic difference (مٰلك vs مالك, العلمين vs العالمين)
  if (toDaggerAlefSkeleton(exp) === toDaggerAlefSkeleton(spk)) {
    return true;
  }

  // Handle minor ASR consonant approximations on longer Quranic words (e.g. ص/س or ذ/ز)
  const maxLen = Math.max(exp.length, spk.length);
  if (maxLen >= 4) {
    const dist = levenshteinDistance(exp, spk);
    if (dist <= 1) return true;
    const similarity = 1 - dist / maxLen;
    if (maxLen >= 6 && similarity >= 0.72) return true;
  }

  return false;
}

export interface RecitationEvaluationResult {
  matchedRawIndices: number[];
  spokenTokenCount: number;
  totalExpectedSpokenWords: number;
  matchedCount: number;
  accuracyPercent: number;
  nextExpectedRawIndex: number | null;
  isComplete: boolean;
}

/**
 * Progressively aligns a live Arabic spoken transcript against an Ayah's words.
 * Supports small look-ahead windows (up to 2 skipped words) and ignores repeated words
 * without falsely jumping to identical refrain words later in the Ayah.
 */
export function evaluateRecitationAgainstAyah(
  expectedWords: string[],
  spokenTranscript: string
): RecitationEvaluationResult {
  const spokenRawIndices = getSpokenWordRawIndices(expectedWords);
  const totalExpectedSpokenWords = spokenRawIndices.length;

  const spokenTokens = normalizeArabicText(spokenTranscript)
    .split(/\s+/)
    .map((t) => normalizeQuranWordForMatch(t))
    .filter(Boolean);

  if (totalExpectedSpokenWords === 0) {
    return {
      matchedRawIndices: [],
      spokenTokenCount: spokenTokens.length,
      totalExpectedSpokenWords: 0,
      matchedCount: 0,
      accuracyPercent: 0,
      nextExpectedRawIndex: null,
      isComplete: false,
    };
  }

  const matchedPositions = new Set<number>();
  let cursor = 0;

  for (let tIdx = 0; tIdx < spokenTokens.length && cursor < totalExpectedSpokenWords; tIdx++) {
    const spokenToken = spokenTokens[tIdx];
    const maxLookahead = Math.min(totalExpectedSpokenWords - 1, cursor + 2);

    let matchedAt = -1;
    for (let pos = cursor; pos <= maxLookahead; pos++) {
      const rawIdx = spokenRawIndices[pos];
      if (areRecitedWordsEquivalent(expectedWords[rawIdx], spokenToken)) {
        matchedAt = pos;
        break;
      }
    }

    // Handle merged compound tokens (e.g. ASR outputs "ياايها" while Mushaf writes "يـٰٓأَيُّهَا" or vice versa,
    // or ASR splits "يا ايها" -> two tokens matching one Mushaf word "يَـٰٓأَيُّهَا")
    if (matchedAt === -1 && tIdx + 1 < spokenTokens.length) {
      const mergedToken = spokenToken + spokenTokens[tIdx + 1];
      for (let pos = cursor; pos <= maxLookahead; pos++) {
        const rawIdx = spokenRawIndices[pos];
        if (areRecitedWordsEquivalent(expectedWords[rawIdx], mergedToken)) {
          matchedAt = pos;
          tIdx += 1;
          break;
        }
      }
    }

    if (matchedAt !== -1) {
      matchedPositions.add(matchedAt);
      cursor = matchedAt + 1;
    }
  }

  const matchedRawIndices = Array.from(matchedPositions)
    .sort((a, b) => a - b)
    .map((pos) => spokenRawIndices[pos]);

  let nextExpectedRawIndex: number | null = null;
  for (let pos = 0; pos < totalExpectedSpokenWords; pos++) {
    if (!matchedPositions.has(pos)) {
      nextExpectedRawIndex = spokenRawIndices[pos];
      break;
    }
  }

  const matchedCount = matchedRawIndices.length;
  const accuracyPercent = Math.round((matchedCount / totalExpectedSpokenWords) * 100);

  return {
    matchedRawIndices,
    spokenTokenCount: spokenTokens.length,
    totalExpectedSpokenWords,
    matchedCount,
    accuracyPercent,
    nextExpectedRawIndex,
    isComplete: matchedCount >= totalExpectedSpokenWords,
  };
}
