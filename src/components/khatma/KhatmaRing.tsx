import React from 'react';
import { PartClaim } from '../../data/khatmaApiService';

interface KhatmaRingProps {
  parts: PartClaim[];
  size?: number;
  onSelectJuz?: (juzNumber: number) => void;
}

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicIndic(num: number): string {
  return String(Math.max(0, Math.floor(num))).replace(/\d/g, (d) => ARABIC_INDIC[Number(d)] || d);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildRingArcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', outerStart.x.toFixed(2), outerStart.y.toFixed(2),
    'A', outerR, outerR, 0, largeArcFlag, 0, outerEnd.x.toFixed(2), outerEnd.y.toFixed(2),
    'L', innerEnd.x.toFixed(2), innerEnd.y.toFixed(2),
    'A', innerR, innerR, 0, largeArcFlag, 1, innerStart.x.toFixed(2), innerStart.y.toFixed(2),
    'Z',
  ].join(' ');
}

/**
 * Khatma Ring (خاتم الختمة): 30 radial Juz sectors showing:
 * - Gold: completed Juz
 * - Lapis: claimed / reading in progress (with reader initial)
 * - Outline: available Juz
 */
export const KhatmaRing: React.FC<KhatmaRingProps> = ({ parts, size = 252, onSelectJuz }) => {
  const cx = 140;
  const cy = 140;
  const innerR = 74;
  const outerR = 122;
  const gapDeg = 2.2;
  const sliceDeg = 360 / 30;

  const completedCount = parts.filter((p) => p.isCompleted).length;
  const claimedCount = parts.filter((p) => p.claimedBy !== null).length;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 280 280"
        role="img"
        aria-label={`خاتم الختمة: مكتمل ${completedCount} من 30 جزءاً`}
        className="overflow-visible text-[#1B1A17] dark:text-[#F6EFDD]"
      >
        {/* Subtle inner compass hairline */}
        <circle
          cx={cx}
          cy={cy}
          r={innerR - 7}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {Array.from({ length: 30 }, (_, idx) => {
          const juzNumber = idx + 1;
          const part = parts.find((p) => p.juzNumber === juzNumber);
          const isCompleted = Boolean(part?.isCompleted);
          const isClaimed = Boolean(part?.claimedBy);

          const startAngle = idx * sliceDeg + gapDeg / 2;
          const endAngle = (idx + 1) * sliceDeg - gapDeg / 2;
          const midAngle = (startAngle + endAngle) / 2;
          const labelPos = polarToCartesian(cx, cy, (innerR + outerR) / 2, midAngle);
          const pathData = buildRingArcPath(cx, cy, innerR, outerR, startAngle, endAngle);

          const initial = part?.claimedBy ? part.claimedBy.trim().charAt(0) : '';

          const fillColor = isCompleted
            ? '#D9B45A'
            : isClaimed
            ? '#2E5499'
            : 'rgba(138, 100, 24, 0.08)';

          const strokeColor = isCompleted
            ? '#8A6418'
            : isClaimed
            ? '#648CD4'
            : 'rgba(138, 100, 24, 0.35)';

          return (
            <g
              key={juzNumber}
              onClick={onSelectJuz ? () => onSelectJuz(juzNumber) : undefined}
              className={onSelectJuz ? 'cursor-pointer transition-opacity duration-200 hover:opacity-90' : ''}
            >
              <title>
                {part
                  ? `${part.juzName}${
                      isCompleted
                        ? ` — مكتمل (${part.claimedBy || ''})`
                        : isClaimed
                        ? ` — محجوز (${part.claimedBy})`
                        : ' — شاغر'
                    }`
                  : `الجزء ${juzNumber}`}
              </title>
              <path
                d={pathData}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1"
                className="transition-colors duration-500"
              />
              {isClaimed && initial && (
                <text
                  x={labelPos.x}
                  y={labelPos.y + 3.5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={isCompleted ? '#1B1A17' : '#F6EFDD'}
                >
                  {initial}
                </text>
              )}
            </g>
          );
        })}

        {/* Center medallion readout */}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fontSize="13"
          fill="#8A6418"
          className="dark:fill-[#D9B45A]"
        >
          ۞
        </text>
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill="currentColor"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {toArabicIndic(completedCount)} من ٣٠
        </text>
        <text
          x={cx}
          y={cy + 27}
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
          fillOpacity="0.68"
        >
          {claimedCount - completedCount > 0
            ? `قيد القراءة: ${toArabicIndic(claimedCount - completedCount)}`
            : `متاح: ${toArabicIndic(30 - claimedCount)}`}
        </text>
      </svg>

      {/* Quiet typographic legend (zero pill clutter) */}
      <div className="flex items-center justify-center gap-4 text-xs text-[#5C5549] dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#D9B45A] inline-block" aria-hidden="true" />
          <span>مكتمل</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#2E5499] inline-block" aria-hidden="true" />
          <span>محجوز</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs border border-[#8A6418]/50 dark:border-slate-500 inline-block" aria-hidden="true" />
          <span>متاح</span>
        </span>
      </div>
    </div>
  );
};
