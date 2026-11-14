import React, { useMemo, useState } from 'react';
import {
  ARABIC_LETTERS_MAKHARIJ,
  ArabicLetterMakhraj,
  MAKHARIJ_REGIONS,
  MakhrajRegionId,
  SIMILAR_LETTER_PAIRS,
} from '../../data/tajweedRules';
import { Check, Volume2, ArrowLeftRight } from 'lucide-react';

export const MakharijAtlas: React.FC = () => {
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
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">أطلس مخارج الحروف التشريحي</h3>
              <p className="text-xs text-slate-400">اضغط على أي مخرج رئيسي أو اختر حرفاً لموضعه الدقيق</p>
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-300">
              {activeRegionInfo.name}
            </span>
          </div>

          {/* Clean Vocal Tract SVG Cross-Section */}
          <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-2xl bg-slate-950/90 border border-slate-800/80 p-3 flex items-center justify-center">
            <svg
              viewBox="0 0 320 320"
              className="w-full h-full select-none"
              role="img"
              aria-label="خريطة تفاعلية لمخارج الحروف الخمسة"
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
                      fontSize="11"
                      fontWeight={isActive ? '700' : '500'}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {region.name}
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
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">{activeRegionInfo.name}</span>
              <span className="text-slate-400">{activeRegionInfo.subtitle}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{activeRegionInfo.description}</p>
          </div>
        </div>

        {/* Right/Bottom Control & Letter Deck (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 flex flex-col justify-between">
          {/* Region Filter Segmented Control */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleSelectRegion('all')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedRegion === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                كل المخارج (٢٩)
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
                        ? 'bg-slate-800 text-white ring-1 ring-emerald-500/60'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {region.name}
                  </button>
                );
              })}
            </div>

            {/* Interactive Arabic Letters Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-2">
              {filteredLetters.map((item) => {
                const isSelected = item.id === activeLetter.id;
                const regionColor =
                  MAKHARIJ_REGIONS.find((r) => r.id === item.region)?.colorHex || '#10b981';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLetterId(item.id)}
                    className={`min-h-[44px] py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-md scale-[1.03]'
                        : 'bg-slate-950/70 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <span
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
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center font-quran text-3xl font-bold shrink-0"
                  style={{ color: activeRegionInfo.colorHex }}
                >
                  {activeLetter.letter}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{activeLetter.name}</h4>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span>{activeRegionInfo.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-200 font-medium">{activeLetter.subMakhraj}</span>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-400 block">مثال قرآني</span>
                <span className="font-quran text-2xl text-emerald-300">{activeLetter.exampleWord}</span>
              </div>
            </div>

            {/* Qualities List */}
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-2">الصفات الصوتية للحرف:</span>
              <div className="flex flex-wrap gap-2">
                {activeLetter.qualities.map((q) => (
                  <span
                    key={q}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{q}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Practical Articulation Tip */}
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-2.5">
              <Volume2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-emerald-300 block">توجيه النطق العملي:</span>
                <p className="text-xs text-slate-200 leading-relaxed">{activeLetter.practicalTip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confusable Letter Pairs Practical Comparison */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-white">مقارنة الحروف المتقاربة في المخرج</h3>
          </div>
          <span className="text-xs text-slate-400">أشهر الحروف التي يقع فيها الخلط أثناء التلاوة</span>
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
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                {pair.title.split(' (')[0]}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="md:col-span-8 space-y-2">
            <h4 className="text-sm font-bold text-amber-300">{activeComparison.title}</h4>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {activeComparison.differenceSummary}
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
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    عرض {l.name} ({l.letter}) على الخريطة
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-4 text-center p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">أمثلة قرآنية للمقارنة</span>
            <p className="font-quran text-xl text-emerald-200 leading-loose">{activeComparison.quranExample}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
