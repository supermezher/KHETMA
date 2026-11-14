import React from 'react';

/**
 * Verified Authentic Tajweed Highlighting & Uthmani Text Synchronizer
 *
 * Guarantees 100% spelling & orthographic fidelity to the verified Medina Mus'haf (quran-uthmani)
 * by projecting annotated Tajweed tags onto exact Uthmani grapheme clusters — eliminating
 * encoding artifacts such as `ٲ` (U+0672 in `ٱلصَّلَوٲةَ`), dropped hamza alifs (`وَبِٱلْأَخِرَةِ`),
 * or artificial tatweel splits while preserving intact Arabic cursive ligatures.
 */

export type TajweedRuleType =
  | 'ghunnah'
  | 'ikhfa'
  | 'idgham'
  | 'iqlab'
  | 'qalqalah'
  | 'madd-wajib'
  | 'madd-lazim'
  | 'madd-badal'
  | 'madd-arid'
  | 'madd-tabeei'
  | 'tafkheem'
  | 'silent';

export interface TajweedToken {
  text: string;
  rule?: TajweedRuleType;
  tooltip?: string;
}

// Complete verified mapping for all 17 AlQuran.cloud / Tanzil Tajweed annotation tags
export const TANZIL_RULE_MAP: Record<string, { rule: TajweedRuleType; tooltip: string }> = {
  h: { rule: 'silent', tooltip: 'همزة وصل تسقط في درج الكلام' },
  s: { rule: 'silent', tooltip: 'حرف زائد رسماً لا يُلفظ' },
  l: { rule: 'silent', tooltip: 'لام شمسية مدغمة لا تُلفظ' },
  d: { rule: 'silent', tooltip: 'حرف مُدغَم إدغاماً متجانساً لا يُلفظ' },
  b: { rule: 'silent', tooltip: 'حرف مُدغَم إدغاماً متقارباً بلا غنة لا يُلفظ' },
  u: { rule: 'silent', tooltip: 'إدغام كامل بغير غنة (تسقط النون أو التنوين في النطق)' },
  g: { rule: 'ghunnah', tooltip: 'غنة مشددة بمقدار حركتين' },
  c: { rule: 'ikhfa', tooltip: 'إخفاء شفوي بغنة حركتين' },
  f: { rule: 'ikhfa', tooltip: 'إخفاء حقيقي بغنة حركتين' },
  a: { rule: 'idgham', tooltip: 'إدغام بغنة بمقدار حركتين (حروف ينمو)' },
  w: { rule: 'idgham', tooltip: 'إدغام شفوي (مثلين صغير) بغنة حركتين' },
  i: { rule: 'iqlab', tooltip: 'إقلاب النون الساكنة أو التنوين ميماً مخفاة بغنة حركتين' },
  q: { rule: 'qalqalah', tooltip: 'قلقلة في حروف (قطب جد)' },
  o: { rule: 'madd-wajib', tooltip: 'مد واجب متصل أو جائز منفصل (4 - 5 حركات)' },
  m: { rule: 'madd-lazim', tooltip: 'مد لازم كلمي أو حرفي مشبع (6 حركات وجوباً)' },
  p: { rule: 'madd-arid', tooltip: 'مد عارض للسكون (2 - 4 - 6 حركات عند الوقف)' },
  n: { rule: 'madd-tabeei', tooltip: 'مد طبيعي بمقدار حركتين' },
  k: { rule: 'tafkheem', tooltip: 'حرف مفخم مستعلٍ (خص ضغط قظ) أو راء/لام مفخمة' },
};

const COMBINING_MARK_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u200C]/;
const WAQF_ONLY_RE = /^[\u06D6-\u06ED]+$/;

/**
 * Splits a single Arabic word into atomic grapheme clusters (base letter + combining diacritics)
 * so no <span> ever starts with a bare combining mark (preventing dotted-circle rendering bugs).
 */
export function splitArabicGraphemeClusters(word: string): string[] {
  const clusters: string[] = [];
  for (const ch of word) {
    if (COMBINING_MARK_RE.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1] += ch;
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}

function normalizeBaseArabicChar(ch: string): string {
  if (!ch) return '';
  if ('ٱأإآاٲ'.includes(ch)) return 'ا';
  if ('ىٮيئ'.includes(ch)) return 'ي';
  if ('ؤو'.includes(ch)) return 'و';
  if ('ةه'.includes(ch)) return 'ه';
  return ch;
}

/**
 * Stack-based parser for authentic Tanzil / AlQuran Cloud Tajweed annotations.
 * Accurately handles nested tags (e.g. `تَعْتَد[o[ُوٓ[s[اْ]‌ۚ]`) and word segmentation.
 */
export function parseAnnotatedTajweedAyah(tajweedStr: string): TajweedToken[][] {
  const cleanedStr = tajweedStr.replace(/\u200C/g, '');
  const stack: string[] = [];
  const words: TajweedToken[][] = [[]];
  let i = 0;
  let buffer = '';

  const flushBuffer = () => {
    if (!buffer) return;
    const topTag = stack.length > 0 ? stack[stack.length - 1] : undefined;
    const ruleInfo = topTag ? TANZIL_RULE_MAP[topTag] : undefined;
    const currentWord = words[words.length - 1];
    currentWord.push({
      text: buffer,
      rule: ruleInfo ? ruleInfo.rule : undefined,
      tooltip: ruleInfo ? ruleInfo.tooltip : undefined,
    });
    buffer = '';
  };

  while (i < cleanedStr.length) {
    if (cleanedStr[i] === '[') {
      const nextOpen = cleanedStr.indexOf('[', i + 1);
      const nextClose = cleanedStr.indexOf(']', i + 1);
      if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
        flushBuffer();
        const tagSpec = cleanedStr.slice(i + 1, nextOpen);
        const tagLetter = tagSpec.split(':')[0];
        stack.push(tagLetter);
        i = nextOpen + 1;
        continue;
      }
    } else if (cleanedStr[i] === ']') {
      flushBuffer();
      stack.pop();
      i++;
      continue;
    } else if (/\s/.test(cleanedStr[i])) {
      flushBuffer();
      if (words[words.length - 1].length > 0) {
        words.push([]);
      }
      i++;
      continue;
    }

    buffer += cleanedStr[i];
    i++;
  }
  flushBuffer();

  return words.filter((w) => w.length > 0);
}

/**
 * Merges consecutive grapheme tokens in a word that share the same rule and tooltip
 * to minimize <span> boundaries and keep Arabic cursive shaping clean.
 */
function mergeWordTokens(tokens: TajweedToken[]): TajweedToken[] {
  const merged: TajweedToken[] = [];
  for (const tok of tokens) {
    const prev = merged[merged.length - 1];
    if (prev && prev.rule === tok.rule && prev.tooltip === tok.tooltip) {
      prev.text += tok.text;
    } else {
      merged.push({ ...tok });
    }
  }
  return merged;
}

/**
 * Aligns 100% spelling-verified Uthmani words with parsed Tajweed annotations.
 * Rendered output text is guaranteed to equal rawUthmaniText character-for-character.
 */
export function alignUthmaniWithTajweed(
  rawUthmaniText: string,
  tajweedText: string
): TajweedToken[][] {
  const uWords = rawUthmaniText.trim().split(/\s+/).filter(Boolean);
  const tWords = parseAnnotatedTajweedAyah(tajweedText);
  let twIdx = 0;

  return uWords.map((uWord) => {
    if (WAQF_ONLY_RE.test(uWord)) {
      return [{ text: uWord }];
    }

    const tWord = tWords[twIdx++] || [];
    const tStream: { ch: string; rule?: TajweedRuleType; tooltip?: string }[] = [];
    for (const tok of tWord) {
      for (const ch of tok.text) {
        if (/[\u06D6-\u06ED]/.test(ch)) continue;
        tStream.push({ ch, rule: tok.rule, tooltip: tok.tooltip });
      }
    }

    let ti = 0;
    const clusters = splitArabicGraphemeClusters(uWord);
    const alignedClusters: TajweedToken[] = clusters.map((cluster) => {
      const base = cluster[0];
      if (/[\u06D6-\u06ED]/.test(base)) {
        return { text: cluster };
      }

      const uNorm = normalizeBaseArabicChar(base);

      // Handle Uthmani ء + ا vs Tajweed أ (e.g. وَبِٱلْءَاخِرَةِ vs وَبِٱلْأَخِرَةِ)
      if (base === 'ء' && tStream[ti] && 'أإآ'.includes(tStream[ti].ch)) {
        return {
          text: cluster,
          ...(tStream[ti].rule ? { rule: tStream[ti].rule, tooltip: tStream[ti].tooltip } : {}),
        };
      }

      for (let look = 0; look < 4 && ti + look < tStream.length; look++) {
        const tch = tStream[ti + look].ch;
        if (/[\u064B-\u065F\u0670ـ]/.test(tch)) continue;

        if (normalizeBaseArabicChar(tch) === uNorm || (tch === 'ـ' && cluster.includes('\u0670'))) {
          let rule = tStream[ti + look].rule;
          let tooltip = tStream[ti + look].tooltip;

          let k = ti + look + 1;
          while (k < tStream.length && /[\u064B-\u065F\u0670ـٲ]/.test(tStream[k].ch)) {
            const mark = tStream[k];
            // Only superscript dagger alef (ٰ / ٲ) or madda sign (ٓ) promotes the Madd highlight onto the seat cluster
            if (mark.rule && (mark.ch === 'ٲ' || mark.ch === '\u0670' || mark.ch === '\u0653')) {
              rule = mark.rule;
              tooltip =
                base === 'و' && cluster.includes('\u0670')
                  ? 'واو زائدة رسماً وألف خنجرية تُمد حركتين (مد طبيعي)'
                  : mark.tooltip;
            }
            k++;
          }
          ti = k;
          return {
            text: cluster,
            ...(rule ? { rule, tooltip } : {}),
          };
        }
      }

      return { text: cluster };
    });

    return mergeWordTokens(alignedClusters);
  });
}

/**
 * Fallback rule detection when annotated Tajweed text is unavailable.
 */
function detectFallbackTajweedRule(
  frag: string,
  isLastWordInAyah = false
): { rule: TajweedRuleType; tooltip: string } | null {
  const hasHamzaAfterMadd =
    /[آٓ][\u064B-\u065F]*[ءئؤ]/.test(frag) ||
    frag.includes('َآء') ||
    frag.includes('ُوٓء') ||
    frag.includes('ِىٓء') ||
    frag.includes('َآء');

  if (!hasHamzaAfterMadd) {
    if (
      frag.includes('آلِّ') ||
      frag.includes('آخَّ') ||
      frag.includes('آفَّ') ||
      frag.includes('آمَّ') ||
      /[آٓ][\u064B-\u065F]*[ّ]/.test(frag) ||
      /ٓ[^\sءئؤ]*ّ/.test(frag)
    ) {
      return { rule: 'madd-lazim', tooltip: 'مد لازم كلمي مشبع (6 حركات وجوباً)' };
    }
  }

  if (
    /^آ[^\sّءئؤ]/.test(frag) ||
    frag.includes('آمَنُ') ||
    frag.includes('آتَيْ') ||
    frag.includes('آدَمَ') ||
    frag.includes('ءَامَنَ')
  ) {
    return { rule: 'madd-badal', tooltip: 'مد بدل بمقدار حركتين' };
  }

  if (hasHamzaAfterMadd || frag.includes('ٓ')) {
    return { rule: 'madd-wajib', tooltip: 'مد واجب متصل أو جائز منفصل (4 - 5 حركات)' };
  }

  if (frag.includes('نَّ') || frag.includes('مَّ') || frag.includes('نّ') || frag.includes('مّ')) {
    return { rule: 'ghunnah', tooltip: 'غنة مشددة في النون أو الميم بمقدار حركتين' };
  }

  if (frag.includes('ۢ')) {
    return { rule: 'iqlab', tooltip: 'إقلاب النون إلى ميم مخفاة بغنة حركتين' };
  }

  if (/[قطبجد]ْ/.test(frag) || (isLastWordInAyah && /[قطبجد][\u064B-\u065F]*$/.test(frag))) {
    return { rule: 'qalqalah', tooltip: 'قلقلة في حرف من حروف (قطب جد)' };
  }

  return null;
}

const wordTajweedCache = new Map<string, TajweedToken[]>();

export function parseWordTajweed(
  word: string,
  isFirstWordInAyah = false,
  isLastWordInAyah = false
): TajweedToken[] {
  const cacheKey = `${word}_${isFirstWordInAyah ? '1' : '0'}_${isLastWordInAyah ? '1' : '0'}`;
  const cached = wordTajweedCache.get(cacheKey);
  if (cached) return cached;

  // At start of ayah, initial ٱ is pronounced (only solar ل is silent when followed by shaddah)
  const silentRegex = isFirstWordInAyah
    ? /(?:(?<=^ٱ)ل(?=[\u0600-\u06ff]*ّ)|[اويى][۟۠]|(?<!^)ٱ)/gu
    : /(ٱل(?=[\u0600-\u06ff]*ّ)|[اويى][۟۠]|(?<!^)ٱ|^[وفبلت]ٱ)/gu;

  if (!silentRegex.test(word)) {
    const directRule = detectFallbackTajweedRule(word, isLastWordInAyah);
    const result: TajweedToken[] = directRule
      ? [{ text: word, rule: directRule.rule, tooltip: directRule.tooltip }]
      : [{ text: word }];
    wordTajweedCache.set(cacheKey, result);
    return result;
  }

  silentRegex.lastIndex = 0;
  const tokens: TajweedToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = silentRegex.exec(word)) !== null) {
    const start = match.index;
    const end = silentRegex.lastIndex;

    if (start > lastIndex) {
      const nonSilentPart = word.slice(lastIndex, start);
      const rule = detectFallbackTajweedRule(nonSilentPart, isLastWordInAyah);
      tokens.push({
        text: nonSilentPart,
        ...(rule ? { rule: rule.rule, tooltip: rule.tooltip } : {}),
      });
    }

    let tooltip = 'حرف لا يُلفظ (يسقط في درج التلاوة)';
    if (match[0] === 'ل' || match[0].includes('ٱل')) tooltip = 'لام شمسية مدغمة لا تُلفظ';
    else if (match[0].includes('ٱ')) tooltip = 'همزة وصل تسقط وصلاً';
    else if (match[0].includes('۟') || match[0].includes('۠')) tooltip = 'حرف زائد رسماً عليه سكون مستدير (لا يُلفظ)';

    tokens.push({
      text: match[0],
      rule: 'silent',
      tooltip,
    });

    lastIndex = end;
  }

  if (lastIndex < word.length) {
    const trailingPart = word.slice(lastIndex);
    const rule = detectFallbackTajweedRule(trailingPart, isLastWordInAyah);
    tokens.push({
      text: trailingPart,
      ...(rule ? { rule: rule.rule, tooltip: rule.tooltip } : {}),
    });
  }

  const result = mergeWordTokens(tokens.length > 0 ? tokens : [{ text: word }]);
  wordTajweedCache.set(cacheKey, result);
  return result;
}

function getRuleClass(rule?: TajweedRuleType): string {
  switch (rule) {
    case 'silent':
      return 'tajweed-silent';
    case 'ghunnah':
      return 'tajweed-ghunnah';
    case 'ikhfa':
      return 'tajweed-ikhfa';
    case 'idgham':
      return 'tajweed-idgham';
    case 'iqlab':
      return 'tajweed-iqlab';
    case 'qalqalah':
      return 'tajweed-qalqalah';
    case 'madd-wajib':
      return 'tajweed-madd-wajib';
    case 'madd-lazim':
      return 'tajweed-madd-lazim';
    case 'madd-badal':
      return 'tajweed-madd-badal';
    case 'madd-arid':
      return 'tajweed-madd-arid';
    case 'madd-tabeei':
      return 'tajweed-madd-tabeei';
    case 'tafkheem':
      return 'tajweed-tafkheem';
    default:
      return '';
  }
}

/**
 * Main Tajweed renderer supporting 100% spelling-exact Uthmani script + approved Tajweed colors
 * and synchronized word-by-word active highlighting.
 */
export function renderTajweedText(
  rawText: string,
  isTajweedActive: boolean,
  onWordClick?: (word: string) => void,
  activeWordIndex?: number,
  tajweedText?: string
): React.ReactNode {
  if (!isTajweedActive) {
    const words = rawText.trim().split(/\s+/);
    return (
      <span>
        {words.map((word, wIdx) => {
          const isCurrentActiveWord = activeWordIndex !== undefined && activeWordIndex === wIdx;
          return (
            <React.Fragment key={wIdx}>
              <span
                onClick={() => onWordClick?.(word)}
                className={`transition-colors duration-150 cursor-pointer rounded px-0.5 ${
                  isCurrentActiveWord
                    ? 'bg-emerald-500/35 text-emerald-100 ring-1 ring-emerald-400 shadow-sm'
                    : 'hover:bg-emerald-500/10'
                }`}
              >
                {word}
              </span>
              {wIdx < words.length - 1 && ' '}
            </React.Fragment>
          );
        })}
      </span>
    );
  }

  let parsedWords: TajweedToken[][];
  if (tajweedText && tajweedText.includes('[')) {
    parsedWords = alignUthmaniWithTajweed(rawText, tajweedText);
  } else {
    const rawWords = rawText.trim().split(/\s+/);
    parsedWords = rawWords.map((word, idx) =>
      parseWordTajweed(word, idx === 0, idx === rawWords.length - 1)
    );
  }

  return (
    <span>
      {parsedWords.map((wordTokens, wIdx) => {
        const isCurrentActiveWord = activeWordIndex !== undefined && activeWordIndex === wIdx;
        const wholeWordText = wordTokens.map((t) => t.text).join('');

        return (
          <React.Fragment key={wIdx}>
            <span
              onClick={() => onWordClick?.(wholeWordText)}
              className={`transition-colors duration-150 cursor-pointer rounded px-0.5 ${
                isCurrentActiveWord
                  ? 'bg-emerald-500/35 text-emerald-100 ring-1 ring-emerald-400 shadow-sm'
                  : 'hover:bg-emerald-500/10'
              }`}
            >
              {wordTokens.map((token, tIdx) => {
                const ruleClass = getRuleClass(token.rule);
                if (!ruleClass) {
                  return <React.Fragment key={tIdx}>{token.text}</React.Fragment>;
                }

                return (
                  <span key={tIdx} className={ruleClass} title={token.tooltip}>
                    {token.text}
                  </span>
                );
              })}
            </span>
            {wIdx < parsedWords.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </span>
  );
}
