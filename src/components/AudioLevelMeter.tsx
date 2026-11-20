import React, { useEffect, useState } from 'react';

interface AudioLevelMeterProps {
  /** Whether capture/listening is currently active */
  isActive: boolean;
  /** Optional live MediaStream from an already-running MediaRecorder (avoids double getUserMedia locks) */
  mediaStream?: MediaStream | null;
  /** Incrementing value (e.g. transcript length) to animate speech cadence bars during SpeechRecognition */
  activitySeed?: number;
  /** Accessible status label next to bars */
  label?: string;
  /** Visual variant aligned with Bayan palette */
  tone?: 'gold' | 'rose';
}

const BAR_WEIGHTS = [0.42, 0.72, 1, 0.85, 0.56, 0.9, 0.65];

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({
  isActive,
  mediaStream,
  activitySeed = 0,
  label,
  tone = 'gold',
}) => {
  const [level, setLevel] = useState<number>(0.18);

  useEffect(() => {
    if (!isActive) {
      setLevel(0.12);
      return;
    }

    // Real Web Audio AnalyserNode when an active MediaStream is provided
    if (mediaStream && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        let rafId: number | null = null;
        let ctx: AudioContext | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;

        try {
          ctx = new AudioCtx();
          source = ctx.createMediaStreamSource(mediaStream);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const data = new Uint8Array(analyser.fftSize);
          const sample = () => {
            if (!analyser) return;
            analyser.getByteTimeDomainData(data);
            let sumSq = 0;
            for (let i = 0; i < data.length; i++) {
              const norm = (data[i] - 128) / 128;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / data.length);
            const scaled = Math.min(1, Math.max(0.16, rms * 3.8));
            setLevel(scaled);
            rafId = requestAnimationFrame(sample);
          };

          rafId = requestAnimationFrame(sample);
        } catch {
          // Graceful fallback handled below
        }

        return () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          try {
            source?.disconnect();
            analyser?.disconnect();
            if (ctx && ctx.state !== 'closed') {
              ctx.close().catch(() => {});
            }
          } catch {
            // Ignore cleanup errors
          }
        };
      }
    }

    // Gentle responsive listening pulse when SpeechRecognition is running without duplicate mic stream
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      const base = activitySeed > 0 ? 0.58 : 0.28;
      const wave = Math.abs(Math.sin(step * 0.75 + activitySeed * 0.4)) * (activitySeed > 0 ? 0.4 : 0.28);
      setLevel(Math.min(1, base + wave));
    }, 130);

    return () => window.clearInterval(interval);
  }, [isActive, mediaStream, activitySeed]);

  if (!isActive) return null;

  const barColor =
    tone === 'rose'
      ? 'bg-rose-500 dark:bg-rose-400'
      : 'bg-[#8A6418] dark:bg-[#D9B45A]';

  return (
    <div
      className="inline-flex items-center gap-2 select-none"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-end gap-0.5 h-4" aria-hidden="true">
        {BAR_WEIGHTS.map((weight, idx) => {
          const computed = Math.max(0.22, Math.min(1, level * weight + ((idx % 2) * 0.08)));
          return (
            <span
              key={idx}
              className={`w-1 rounded-full transition-transform duration-150 origin-bottom ${barColor}`}
              style={{
                height: '16px',
                transform: `scaleY(${computed.toFixed(2)})`,
              }}
            />
          );
        })}
      </span>
      {label && (
        <span className="text-[11px] font-semibold text-[#5C5549] dark:text-slate-300">
          {label}
        </span>
      )}
    </div>
  );
};
