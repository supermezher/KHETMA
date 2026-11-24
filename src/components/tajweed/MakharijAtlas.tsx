import React, { useMemo, useState } from 'react';
import {
  ARABIC_LETTERS_MAKHARIJ,
  ArabicLetterMakhraj,
  MAKHARIJ_REGIONS,
  MakhrajRegionId,
  SIMILAR_LETTER_PAIRS,
  getLetterMakhrajName,
  getLetterPracticalTip,
  getLetterQualities,
  getLetterSubMakhraj,
  getMakhrajRegionDescription,
  getMakhrajRegionName,
  getMakhrajRegionSubtitle,
  getSimilarPairSummary,
  getSimilarPairTitle,
} from '../../data/tajweedRules';
import { formatLocalizedDigits, useLanguage } from '../../utils/i18n';
import { Check, Volume2, ArrowLeftRight } from 'lucide-react';

export const MakharijAtlas: React.FC = () => {
  const { lang, isEnglish } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState<MakhrajRegionId | 'all'>('all');
  const [selectedLetterId, setSelectedLetterId] = useState<string>('dad');
  const [activeComparisonId, setActiveComparisonId] = useState<string>(SIMILAR_LETTER_PAIRS[0].id);

  const activeLetter: ArabicLetterMakhraj = useMemo(
    () => ARABIC_LETTERS_MAKHARIJ.find((l) => l.id === selectedLetterId) || ARABIC_LETTERS_MAKHARIJ[0],
    [selectedLetterId]
  );

  const activeRegionInfo = useMemo(
    () => MAKHARIJ_REGIONS.find((r) => r.id === activeLetter.region) || MAKHARIJ_REGIONS[0],
    [activeLetter.region]
  );

  const filteredLetters = useMemo(() => {
    if (selectedRegion === 'all') return ARABIC_LETTERS_MAKHARIJ;
    return ARABIC_LETTERS_MAKHARIJ.filter((l) => l.region === selectedRegion);
  }, [selectedRegion]);

  const activeComparison = useMemo(
    () => SIMILAR_LETTER_PAIRS.find((p) => p.id === activeComparisonId) || SIMILAR_LETTER_PAIRS[0],
    [activeComparisonId]
  );

  const handleSelectRegion = (regionId: MakhrajRegionId | 'all') => {
    setSelectedRegion(regionId);
    if (regionId !== 'all') {
      const firstInRegion = ARABIC_LETTERS_MAKHARIJ.find((l) => l.region === regionId);
      if (firstInRegion) {
        setSelectedLetterId(firstInRegion.id);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Two-Zone Interactive Atlas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Top Stage (5 cols): Interactive Vocal Tract SVG Diagram */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#D9B45A]/20 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-[#1B1A17] dark:text-white">
                {isEnglish ? 'Anatomical Makharij Atlas' : 'أطلس مخارج الحروف التشريحي'}
              </h3>
              <p className="text-xs text-[#6B6251] dark:text-slate-400">
                {isEnglish
                  ? 'Tap any main region or pick a letter to inspect its exact spot'
                  : 'اضغط على أي مخرج رئيسي أو اختر حرفاً لموضعه الدقيق'}
              </p>
            </div>
            <span className="text-xs font-bold tabular-nums text-[#8A6418] dark:text-[#D9B45A]">
              {getMakhrajRegionName(activeRegionInfo, lang)}
            </span>
          </div>

          {/* Clean Vocal Tract SVG Cross-Section (kept dark internally for bright SVG diagram contrast) */}
          <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-2xl bg-[#0d1420] border border-[#1F3A6E]/35 dark:border-slate-800/80 p-3 flex items-center justify-center shadow-inner">
            <svg
              viewBox="0 0 320 320"
              className="w-full h-full select-none"
              role="img"
              aria-label={
                isEnglish
                  ? 'Interactive map of the five Arabic articulation regions'
                  : 'خريطة تفاعلية لمخارج الحروف الخمسة'
              }
            >
              {/* Soft Facial Profile Outline */}
              <path
                d="M 80 42 C 138 35, 222 50, 248 118 C 260 150, 255 215, 248 298 L 190 298 L 190 238 C 165 245, 118 242, 88 228 C 72 220, 68 202, 72 192 C 58 190, 56 178, 70 174 C 66 164, 52 152, 48 138 C 44 126, 62 110, 74 96 C 72 72, 74 54, 80 42 Z"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Palate & Nasal Chamber Divider */}
              <path
                d="M 74 148 Q 138 138 194 164"
                fill="none"
                stroke="#475569"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Tongue Base Curve */}
              <path
                d="M 86 202 Q 136 168 188 196 Q 198 206 196 226"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Throat Wall */}
              <path
                d="M 232 198 L 232 298 M 196 226 L 196 298"
                stroke="#475569"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Interactive Region Highlights */}
              {MAKHARIJ_REGIONS.map((region) => {
                const isActive = activeLetter.region === region.id;
                const { cx, cy, rx, ry, labelX, labelY } = region.svgHighlightArea;
                return (
                  <g
                    key={region.id}
                    onClick={() => handleSelectRegion(region.id)}
                    className="cursor-pointer"
                  >
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      fill={region.colorHex}
                      fillOpacity={isActive ? 0.24 : 0.06}
                      stroke={region.colorHex}
                      strokeWidth={isActive ? 2 : 1}
                      strokeDasharray={isActive ? undefined : '4 3'}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isActive ? '#ffffff' : '#94a3b8'}
                      fontSize={isEnglish ? '10' : '11'}
                      fontWeight={isActive ? '700' : '500'}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {getMakhrajRegionName(region, lang)}
                    </text>
                  </g>
                );
              })}

              {/* Pinpoint Ring on Exact Selected Letter Location */}
              <g>
                <circle
                  cx={activeLetter.point.x}
                  cy={activeLetter.point.y}
                  r="14"
                  fill={activeRegionInfo.colorHex}
                  fillOpacity="0.22"
                />
                <circle
                  cx={activeLetter.point.x}
                  cy={activeLetter.point.y}
                  r="7"
                  fill={activeRegionInfo.colorHex}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            </svg>
          </div>

          {/* Selected Region Overview */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#1B1A17] dark:text-white">
                {getMakhrajRegionName(activeRegionInfo, lang)}
              </span>
              <span className="text-[#6B6251] dark:text-slate-400">
                {getMakhrajRegionSubtitle(activeRegionInfo, lang)}
              </span>
            </div>
            <p className="text-xs text-[#4B4539] dark:text-slate-300 leading-relaxed">
              {getMakhrajRegionDescription(activeRegionInfo, lang)}
            </p>
          </div>
        </div>

        {/* Right/Bottom Control & Letter Deck (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 space-y-5 flex flex-col justify-between">
          {/* Region Filter Segmented Control */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-[#D9B45A]/25 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelectRegion('all')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedRegion === 'all'
                    ? 'bg-[#1F3A6E] text-[#F6EFDD]'
                    : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                {isEnglish
                  ? `All Regions (${formatLocalizedDigits(ARABIC_LETTERS_MAKHARIJ.length, lang)})`
                  : `كل المخارج (${formatLocalizedDigits(ARABIC_LETTERS_MAKHARIJ.length, lang)})`}
              </button>
              {MAKHARIJ_REGIONS.map((region) => {
                const isSelected = selectedRegion === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => handleSelectRegion(region.id)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#F3E9D2] dark:bg-slate-800 text-[#1F3A6E] dark:text-white ring-1 ring-[#D9B45A]/60'
                        : 'text-[#6B6251] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white'
                    }`}
                  >
                    {getMakhrajRegionName(region, lang)}
                  </button>
                );
              })}
            </div>

            {/* Interactive Arabic Letters Grid */}
            <div dir="rtl" className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-2">
              {filteredLetters.map((item) => {
                const isSelected = item.id === activeLetter.id;
                const regionColor =
                  MAKHARIJ_REGIONS.find((r) => r.id === item.region)?.colorHex || '#D9B45A';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLetterId(item.id)}
                    className={`min-h-[44px] py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[#1F3A6E] dark:bg-[#1F3A6E]/85 border-[#D9B45A] text-white shadow-md scale-[1.03]'
                        : 'bg-white dark:bg-slate-950/70 border-[#D9B45A]/20 dark:border-slate-800 text-[#1B1A17] dark:text-slate-200 hover:border-[#D9B45A]/60 dark:hover:border-slate-700 hover:bg-[#F3E9D2]/50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span
                      lang="ar"
                      className="font-quran text-lg leading-tight font-bold"
                      style={{ color: isSelected ? regionColor : undefined }}
                    >
                      {item.letter}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Letter Detailed Inspection Panel */}
          <div className="pt-4 border-t border-[#D9B45A]/20 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  dir="rtl"
                  lang="ar"
                  className="w-14 h-14 rounded-2xl bg-[#10161f] dark:bg-slate-950 border border-[#D9B45A]/40 dark:border-slate-700 flex items-center justify-center font-quran text-3xl font-bold shrink-0"
                  style={{ color: activeRegionInfo.colorHex }}
                >
                  {activeLetter.letter}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#1B1A17] dark:text-white">
                    {getLetterMakhrajName(activeLetter, lang)}
                  </h4>
                  <div className="text-xs text-[#6B6251] dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span>{getMakhrajRegionName(activeRegionInfo, lang)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#1F3A6E] dark:text-slate-200 font-medium">
                      {getLetterSubMakhraj(activeLetter, lang)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-start sm:text-end">
                <span className="text-[11px] text-[#6B6251] dark:text-slate-400 block">
                  {isEnglish ? 'Quranic Example' : 'مثال قرآني'}
                </span>
                <span dir="rtl" lang="ar" className="font-quran text-2xl text-[#8A6418] dark:text-[#D9B45A] inline-block">
                  {activeLetter.exampleWord}
                </span>
              </div>
            </div>

            {/* Qualities List */}
            <div>
              <span className="text-xs font-bold text-[#6B6251] dark:text-slate-400 block mb-2">
                {isEnglish ? 'Acoustic Qualities (Sifat):' : 'الصفات الصوتية للحرف:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {getLetterQualities(activeLetter, lang).map((q) => (
                  <span
                    key={q}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800 text-xs text-[#1B1A17] dark:text-slate-200 font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
                    <span>{q}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Practical Articulation Tip */}
            <div className="p-3.5 rounded-xl bg-[#1F3A6E]/5 dark:bg-[#1F3A6E]/25 border border-[#1F3A6E]/20 dark:border-[#648CD4]/30 flex items-start gap-2.5">
              <Volume2 className="w-4 h-4 text-[#1F3A6E] dark:text-[#D9B45A] mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#1F3A6E] dark:text-[#D9B45A] block">
                  {isEnglish ? 'Practical Articulation Tip:' : 'توجيه النطق العملي:'}
                </span>
                <p className="text-xs text-[#4B4539] dark:text-slate-200 leading-relaxed">
                  {getLetterPracticalTip(activeLetter, lang)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confusable Letter Pairs Practical Comparison */}
      <div className="p-5 rounded-2xl bg-[#FBF7EE] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D9B45A]/20 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#8A6418] dark:text-[#D9B45A] shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-[#1B1A17] dark:text-white">
              {isEnglish ? 'Close-Makhraj Letter Comparisons' : 'مقارنة الحروف المتقاربة في المخرج'}
            </h3>
          </div>
          <span className="text-xs text-[#6B6251] dark:text-slate-400">
            {isEnglish ? 'Commonly confused letters during recitation' : 'أشهر الحروف التي يقع فيها الخلط أثناء التلاوة'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIMILAR_LETTER_PAIRS.map((pair) => {
            const isSelected = pair.id === activeComparison.id;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => {
                  setActiveComparisonId(pair.id);
                  setSelectedRegion('all');
                  if (pair.letterIds[0]) setSelectedLetterId(pair.letterIds[0]);
                }}
                className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#D9B45A]/20 border-[#D9B45A] text-[#8A6418] dark:text-[#D9B45A]'
                    : 'bg-white dark:bg-slate-950 border-[#D9B45A]/25 dark:border-slate-800 text-[#4B4539] dark:text-slate-300 hover:border-[#D9B45A]/50 dark:hover:border-slate-700 hover:text-[#1B1A17] dark:hover:text-white'
                }`}
              >
                {getSimilarPairTitle(pair, lang).split(' (')[0]}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-white dark:bg-slate-950 border border-[#D9B45A]/25 dark:border-slate-800">
          <div className="md:col-span-8 space-y-2">
            <h4 className="text-sm font-bold text-[#8A6418] dark:text-[#D9B45A]">
              {getSimilarPairTitle(activeComparison, lang)}
            </h4>
            <p className="text-xs sm:text-sm text-[#4B4539] dark:text-slate-200 leading-relaxed">
              {getSimilarPairSummary(activeComparison, lang)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {activeComparison.letterIds.map((id) => {
                const l = ARABIC_LETTERS_MAKHARIJ.find((x) => x.id === id);
                if (!l) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedLetterId(id)}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedLetterId === id
                        ? 'bg-[#1F3A6E] border-[#648CD4]/50 text-[#F6EFDD]'
                        : 'bg-[#FBF7EE] dark:bg-slate-900 border-[#D9B45A]/25 dark:border-slate-700 text-[#4B4539] dark:text-slate-200 hover:border-[#D9B45A]/60 dark:hover:border-slate-600'
                    }`}
                  >
                    {isEnglish
                      ? `Locate ${getLetterMakhrajName(l, lang)} (${l.letter})`
                      : `عرض ${l.name} (${l.letter}) على الخريطة`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-4 text-center p-3.5 rounded-xl bg-[#F6EFDD] dark:bg-slate-900 border border-[#D9B45A]/30 dark:border-slate-800">
            <span className="text-[11px] text-[#6B6251] dark:text-slate-400 block mb-1">
              {isEnglish ? 'Quranic Comparison Examples' : 'أمثلة قرآنية للمقارنة'}
            </span>
            <p dir="rtl" lang="ar" className="font-quran text-xl text-[#1F3A6E] dark:text-[#D9B45A] leading-loose">
              {activeComparison.quranExample}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
