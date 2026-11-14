import { describe, expect, it } from 'vitest';
import { TAJWEED_RULES, TAJWEED_QUIZ } from '../data/tajweedRules';
import {
  TANZIL_RULE_MAP,
  alignUthmaniWithTajweed,
  splitArabicGraphemeClusters,
} from '../utils/tajweedParser';

describe('Tajweed alignment & Uthmani script fidelity', () => {
  it('preserves 100% pure Uthmani spelling for ٱلصَّلَوٰةَ and eliminates U+0672 (ٲ)', () => {
    const uthmani = 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ';
    const tajweed =
      'ٱلَّذِينَ يُؤْمِنُونَ بِ[h:13[ٱ]لْغَيْبِ وَيُقِيمُونَ [h:14[ٱ][l[ل]صَّلَ[s[و][n[ٲ]ةَ وَمِ[g[مّ]َا رَزَ[q:15[قْ]نَ[n[ـٰ]هُمْ يُ[f:16[نف]ِق[p[ُو]نَ';

    const aligned = alignUthmaniWithTajweed(uthmani, tajweed);
    const renderedText = aligned.map((w) => w.map((t) => t.text).join('')).join(' ');

    expect(renderedText).toBe(uthmani);
    expect(renderedText).not.toContain('ٲ');
    expect(renderedText).not.toContain('ـٰ');

    const salahWord = aligned[4];
    expect(salahWord.map((t) => t.text).join('')).toBe('ٱلصَّلَوٰةَ');
    expect(salahWord.some((t) => t.rule === 'silent' && t.text.includes('ٱ'))).toBe(true);
    expect(salahWord.some((t) => t.rule === 'silent' && t.text.includes('ل'))).toBe(true);
    expect(salahWord.some((t) => t.rule === 'madd-tabeei' && t.text === 'وٰ')).toBe(true);
  });

  it('preserves 100% authentic Uthmani spelling on وَبِٱلْءَاخِرَةِ where tajweed edition dropped ءَا', () => {
    const uthmani = 'وَبِٱلْءَاخِرَةِ هُمْ يُوقِنُونَ';
    const tajweed = 'وَبِ[h:20[ٱ]لْأَخِرَةِ هُمْ يُوقِن[p[ُو]نَ';

    const aligned = alignUthmaniWithTajweed(uthmani, tajweed);
    const renderedText = aligned.map((w) => w.map((t) => t.text).join('')).join(' ');

    expect(renderedText).toBe(uthmani);
    expect(aligned[0][1].rule).toBe('silent');
    expect(aligned[2].some((t) => t.rule === 'madd-arid' && t.text === 'و')).toBe(true);
  });

  it('correctly classifies [a] as idgham (not madd-badal) and [m] as madd-lazim on ٱلضَّآلِّينَ', () => {
    expect(TANZIL_RULE_MAP.a.rule).toBe('idgham');
    expect(TANZIL_RULE_MAP.w.rule).toBe('idgham');
    expect(TANZIL_RULE_MAP.m.rule).toBe('madd-lazim');
    expect(TANZIL_RULE_MAP.d.rule).toBe('silent');
    expect(TANZIL_RULE_MAP.b.rule).toBe('silent');
    expect(TANZIL_RULE_MAP.u.rule).toBe('silent');

    const uthmani = 'وَلَا ٱلضَّآلِّينَ';
    const tajweed = 'وَلَا [h:10[ٱ][l[ل]ضّ[m[َا]ٓلّ[p[ِي]نَ';
    const aligned = alignUthmaniWithTajweed(uthmani, tajweed);

    const dalleen = aligned[1];
    expect(dalleen.map((t) => t.text).join('')).toBe('ٱلضَّآلِّينَ');
    // Only آ should be marked madd-lazim (6 counts), not ضّ
    const maddLazimTokens = dalleen.filter((t) => t.rule === 'madd-lazim');
    expect(maddLazimTokens.map((t) => t.text)).toEqual(['آ']);
    // Only ي should be marked madd-arid, not لِّ
    const maddAridTokens = dalleen.filter((t) => t.rule === 'madd-arid');
    expect(maddAridTokens.map((t) => t.text)).toEqual(['ي']);
  });

  it('never starts a token span with a bare combining diacritic', () => {
    const clusters = splitArabicGraphemeClusters('ٱلصَّلَوٰةَ');
    expect(clusters.every((cl) => !/^[\u064B-\u065F\u0670]/.test(cl))).toBe(true);
  });

  it('aligns every TajweedEncyclopedia rule example cleanly with authentic Uthmani text and target rules', () => {
    for (const rule of TAJWEED_RULES) {
      expect(rule.examples.length).toBeGreaterThanOrEqual(2);
      for (const ex of rule.examples) {
        const aligned = alignUthmaniWithTajweed(ex.uthmani, ex.tajweedText);
        const reconstructed = aligned.map((w) => w.map((t) => t.text).join('')).join(' ');
        expect(reconstructed).toBe(ex.uthmani);

        if (rule.ruleTypes.length > 0) {
          const hasExpectedRule = aligned.some((w) =>
            w.some((tok) => tok.rule && rule.ruleTypes.includes(tok.rule))
          );
          expect(hasExpectedRule).toBe(true);
        }
      }
    }
  });

  it('validates all interactive quiz spot-word examples and target word indices', () => {
    const spotQuestions = TAJWEED_QUIZ.filter((q) => q.type === 'spot-word');
    expect(spotQuestions.length).toBeGreaterThanOrEqual(3);
    for (const q of spotQuestions) {
      expect(q.spotAyah).toBeDefined();
      if (q.spotAyah) {
        const aligned = alignUthmaniWithTajweed(q.spotAyah.uthmani, q.spotAyah.tajweedText);
        const reconstructed = aligned.map((w) => w.map((t) => t.text).join('')).join(' ');
        expect(reconstructed).toBe(q.spotAyah.uthmani);
        for (const targetIdx of q.spotAyah.targetWordIndices) {
          expect(targetIdx).toBeGreaterThanOrEqual(0);
          expect(targetIdx).toBeLessThan(aligned.length);
        }
      }
    }
  });
});
