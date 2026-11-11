import React from 'react';

/**
 * Intelligent Tajweed Highlighting & Word-by-Word Synchronizer
 */

export interface TajweedToken {
  text: string;
  rule?: 'ghunnah' | 'ikhfa' | 'idgham' | 'qalqalah' | 'madd-wajib' | 'madd-lazim' | 'tafkheem' | 'silent';
  tooltip?: string;
}

function detectTajweedRule(frag: string): { rule: 'ghunnah' | 'ikhfa' | 'idgham' | 'qalqalah' | 'madd-wajib' | 'madd-lazim' | 'tafkheem'; tooltip: string } | null {
  // Madd Lazim: e.g. الضَّآلِّينَ (Madda + Shaddah)
  if (frag.includes('آلِّ') || frag.includes('آخَّ') || frag.includes('آفَّ') || frag.includes('آمَّ') || ((frag.includes('ٓ') || frag.includes('آ')) && frag.includes('ّ'))) {
    return { rule: 'madd-lazim', tooltip: 'مد لازم كلمي (6 حركات مشبعة)' };
  }
  
  // Madd Wajib / Jaiz: e.g. جَآءَ, سُوٓءَ, بِمَآ, السَّمَاءِ
  if (frag.includes('َآء') || frag.includes('ُوٓء') || frag.includes('ِىٓء') || frag.includes('َآ') || frag.includes('ُوٓ') || frag.includes('ِىٓ') || frag.includes('ٓ') || frag.includes('آ')) {
    return { rule: 'madd-wajib', tooltip: 'مد متصل / منفصل (4 - 5 حركات)' };
  }
  
  // Ghunnah: e.g. إِنَّ, عَمَّ, مِّنَّا, مَّن
  if (frag.includes('نَّ') || frag.includes('مَّ') || frag.includes('نّ') || frag.includes('مّ')) {
    return { rule: 'ghunnah', tooltip: 'غنة مشددة بمقدار حركتين' };
  }
  
  // Qalqalah: words ending with قطب جد sukoon or containing Qalqalah
  if (
    /[قَُِْ]?([قطبجد]ْ|[قطبجد]$)/.test(frag) ||
    /^[قطبجد]ْ/.test(frag) ||
    frag.includes('فَلَقِ') ||
    frag.includes('وَقَبَ') ||
    frag.includes('عَقَدِ') ||
    frag.includes('حَسَدَ') ||
    frag.includes('أَحَدٌ') ||
    frag.includes('ٱلصَّمَدُ') ||
    frag.includes('يَلِدْ') ||
    frag.includes('يُولَدْ') ||
    frag.includes('أَحَدٌۢ')
  ) {
    return { rule: 'qalqalah', tooltip: 'قلقلة صغرى / كبرى في حرف قطب جد' };
  }
  
  // Ikhfa pattern
  if (frag.includes('مِن قَ') || frag.includes('كُنتُمْ') || frag.includes('أَنتُمْ') || frag.includes('عَن صَ') || frag.includes('مِن شَ') || frag.includes('مِن ثَ')) {
    return { rule: 'ikhfa', tooltip: 'إخفاء حقيقي بغنة حركتين' };
  }
  
  // Idgham pattern
  if (frag.includes('مَن يَّ') || frag.includes('مِن رَّ') || frag.includes('مِّن مَّ') || frag.includes('مِّن وَ')) {
    return { rule: 'idgham', tooltip: 'إدغام بغنة / بغير غنة' };
  }

  return null;
}

export function parseWordTajweed(word: string): TajweedToken[] {
  // Regex to isolate silent segments in Quranic Uthmani text:
  // 1. ٱل before a letter with shaddah (Solar Lam + Hamzat Wasl, e.g. ٱلرَّحْمَـٰنِ, ٱلصِّرَٰطَ, ٱلَّذِينَ, وَٱلسَّمَاءِ)
  // 2. ٱلّ (Solar Lam with direct shaddah)
  // 3. Letters with small round zero [اويى]۟ (e.g. كَفَرُوا۟, آمَنُوا۟, أُو۟لَـٰٓئِكَ, مَلَإِي۟هِ) or rectangular zero [اوي]۠
  // 4. Standalone Hamzat Wasl ٱ (e.g. ٱلْحَمْدُ, بِٱلْهُدَىٰ, ٱهْدِنَا)
  const silentRegex = /(ٱل(?=[\u0600-\u06ff]*ّ)|ٱلّ|[اويى][۟۠]|ٱ)/gu;

  // If word does not contain any silent letters:
  if (!silentRegex.test(word)) {
    const directRule = detectTajweedRule(word);
    if (directRule) {
      return [{ text: word, rule: directRule.rule, tooltip: directRule.tooltip }];
    }
    return [{ text: word }];
  }

  // Reset regex index
  silentRegex.lastIndex = 0;
  const tokens: TajweedToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = silentRegex.exec(word)) !== null) {
    const start = match.index;
    const end = silentRegex.lastIndex;

    // Preceding non-silent part
    if (start > lastIndex) {
      const nonSilentPart = word.slice(lastIndex, start);
      const rule = detectTajweedRule(nonSilentPart);
      tokens.push({
        text: nonSilentPart,
        ...(rule ? { rule: rule.rule, tooltip: rule.tooltip } : {})
      });
    }

    // Silent part
    let tooltip = 'حرف لا يُلفظ (يسقط في التلاوة)';
    if (match[0].includes('ٱل')) tooltip = 'حرف لا يُلفظ (همزة وصل ولام شمسية مدغمة)';
    else if (match[0].includes('ٱ')) tooltip = 'حرف لا يُلفظ (همزة وصل تسقط وصلاً)';
    else if (match[0].includes('۟') || match[0].includes('۠')) tooltip = 'حرف لا يُلفظ (حرف زائد رسماً عليه سكون مستدير)';

    tokens.push({
      text: match[0],
      rule: 'silent',
      tooltip
    });

    lastIndex = end;
  }

  // Trailing non-silent part
  if (lastIndex < word.length) {
    const trailingPart = word.slice(lastIndex);
    const rule = detectTajweedRule(trailingPart);
    tokens.push({
      text: trailingPart,
      ...(rule ? { rule: rule.rule, tooltip: rule.tooltip } : {})
    });
  }

  return tokens.length > 0 ? tokens : [{ text: word }];
}

export function renderTajweedText(
  rawText: string,
  isTajweedActive: boolean,
  onWordClick?: (word: string) => void,
  activeWordIndex?: number
): React.ReactNode {
  const words = rawText.trim().split(/\s+/);

  return (
    <span>
      {words.map((word, wIdx) => {
        const isCurrentActiveWord = activeWordIndex !== undefined && activeWordIndex === wIdx;
        const tokens = isTajweedActive ? parseWordTajweed(word) : [{ text: word }];

        return (
          <React.Fragment key={wIdx}>
            <span
              onClick={() => onWordClick?.(word)}
              className={`transition-all duration-150 cursor-pointer rounded px-0.5 inline-block ${
                isCurrentActiveWord
                  ? 'bg-emerald-500/35 text-emerald-100 ring-1 ring-emerald-400 shadow-sm scale-105 font-bold'
                  : 'hover:bg-emerald-500/10'
              }`}
            >
              {tokens.map((token, tIdx) => {
                if (!token.rule) {
                  return <span key={tIdx}>{token.text}</span>;
                }

                let ruleClass = '';
                if (token.rule === 'silent') ruleClass = 'tajweed-silent';
                if (token.rule === 'ghunnah') ruleClass = 'tajweed-ghunnah border-b border-emerald-500/40';
                if (token.rule === 'ikhfa') ruleClass = 'tajweed-ikhfa border-b border-amber-500/40';
                if (token.rule === 'idgham') ruleClass = 'tajweed-idgham border-b border-cyan-500/40';
                if (token.rule === 'qalqalah') ruleClass = 'tajweed-qalqalah border-b border-sky-500/40';
                if (token.rule === 'madd-wajib') ruleClass = 'tajweed-madd-wajib border-b border-rose-500/40';
                if (token.rule === 'madd-lazim') ruleClass = 'tajweed-madd-lazim border-b border-purple-500/40';
                if (token.rule === 'tafkheem') ruleClass = 'tajweed-tafkheem';

                return (
                  <span
                    key={tIdx}
                    className={ruleClass}
                    title={token.tooltip}
                  >
                    {token.text}
                  </span>
                );
              })}
            </span>
            {wIdx < words.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </span>
  );
}
