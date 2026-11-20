import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, Download, Share2, Copy, Sparkles, Check,
  Volume2, Pause, Video, Image as ImageIcon, Upload,
  QrCode, Palette, Type, Loader2, AlertCircle, Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import { Ayah } from '../data/quranService';
import { Reciter, RECITERS_LIST, getAyahAudioUrl } from '../data/reciters';
import {
  CardAspectRatio,
  getCanvasDimensions,
  getVideoExportDimensions,
  buildAyahDeepLink,
  isAllahWord,
  wrapArabicLines,
  computeAutoFitFontSize,
  drawCoverImage,
  detectSupportedVideoFormat,
} from '../utils/ayahCardHelpers';

// Static ES imports for Vite bundling without CORS taint
import dawnSkyImg from '../assets/images/nature_dawn_sky_1794694801473.jpg';
import nightStarsImg from '../assets/images/nature_night_stars_1794694801646.jpg';
import calmOceanImg from '../assets/images/nature_calm_ocean_1794694801737.jpg';
import mistyForestImg from '../assets/images/nature_misty_forest_1794694802806.jpg';

export interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  ayah: Ayah | null;
  surahName: string;
  surahNumber?: number;
  selectedReciter?: Reciter;
}

type CardBackdropTheme =
  | 'dawn'
  | 'night'
  | 'ocean'
  | 'forest'
  | 'custom'
  | 'emerald'
  | 'midnight'
  | 'parchment'
  | 'ivory-day';

interface ThemePreset {
  id: CardBackdropTheme;
  label: string;
  category: 'nature' | 'studio';
  previewBg: string;
  previewImage?: string;
  isLight?: boolean;
}

const THEME_PRESETS: ThemePreset[] = [
  { id: 'dawn', label: 'الفجر الهادئ', category: 'nature', previewBg: 'bg-amber-950', previewImage: dawnSkyImg },
  { id: 'night', label: 'ليل الصحراء', category: 'nature', previewBg: 'bg-slate-950', previewImage: nightStarsImg },
  { id: 'ocean', label: 'البحر الساكن', category: 'nature', previewBg: 'bg-cyan-950', previewImage: calmOceanImg },
  { id: 'forest', label: 'ضباب الغابة', category: 'nature', previewBg: 'bg-emerald-950', previewImage: mistyForestImg },
  { id: 'emerald', label: 'زمردي ملكي', category: 'studio', previewBg: 'bg-[#06281e]' },
  { id: 'midnight', label: 'كحلي ليلي', category: 'studio', previewBg: 'bg-[#0f172a]' },
  { id: 'parchment', label: 'مخطوطة', category: 'studio', previewBg: 'bg-[#fbf6ea] text-stone-900', isLight: true },
  { id: 'ivory-day', label: 'صباحي ناصع', category: 'studio', previewBg: 'bg-[#f8fafc] text-slate-900', isLight: true },
];

const NATURE_IMAGE_SOURCES: Record<string, string> = {
  dawn: dawnSkyImg,
  night: nightStarsImg,
  ocean: calmOceanImg,
  forest: mistyForestImg,
};

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawAndalusianCorner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dirX: 1 | -1,
  dirY: 1 | -1,
  armLen: number,
  goldColor: string
): void {
  ctx.save();
  ctx.strokeStyle = goldColor;
  ctx.fillStyle = goldColor;
  ctx.lineWidth = Math.max(2, armLen * 0.065);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer L bracket
  ctx.beginPath();
  ctx.moveTo(cx, cy + dirY * armLen);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + dirX * armLen, cy);
  ctx.stroke();

  // Inner stepped notch bracket
  const inset = armLen * 0.24;
  const innerArm = armLen * 0.56;
  ctx.lineWidth = Math.max(1.5, armLen * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx + dirX * inset, cy + dirY * innerArm);
  ctx.lineTo(cx + dirX * inset, cy + dirY * inset);
  ctx.lineTo(cx + dirX * innerArm, cy + dirY * inset);
  ctx.stroke();

  // Corner geometric diamond rosette
  const dSize = armLen * 0.11;
  const dx = cx + dirX * (inset * 0.5);
  const dy = cy + dirY * (inset * 0.5);
  ctx.beginPath();
  ctx.moveTo(dx, dy - dSize);
  ctx.lineTo(dx + dSize, dy);
  ctx.lineTo(dx, dy + dSize);
  ctx.lineTo(dx - dSize, dy);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  ayah,
  surahName,
  surahNumber = 1,
  selectedReciter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const customImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio preview & video export cleanup refs
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const exportRafRef = useRef<number | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const activeAudioCtxRef = useRef<AudioContext | null>(null);

  // Design state
  const [aspectRatio, setAspectRatio] = useState<CardAspectRatio>('post');
  const [theme, setTheme] = useState<CardBackdropTheme>('dawn');
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(50);
  const [showGlassPanel, setShowGlassPanel] = useState<boolean>(true);
  const [showOrnament, setShowOrnament] = useState<boolean>(true);

  // Typography & content state
  const [autoFitFont, setAutoFitFont] = useState<boolean>(true);
  const [manualFontSize, setManualFontSize] = useState<number>(42);
  const [highlightAllah, setHighlightAllah] = useState<boolean>(true);
  const [includeTafsir, setIncludeTafsir] = useState<boolean>(true);
  const [customReflection, setCustomReflection] = useState<string>('');
  const [showQr, setShowQr] = useState<boolean>(true);
  const [showReciterCredit, setShowReciterCredit] = useState<boolean>(true);
  const [reciterId, setReciterId] = useState<string>(selectedReciter?.id || RECITERS_LIST[0].id);

  // Reactive triggers & export/audio states
  const [assetLoadTick, setAssetLoadTick] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  const activeReciter = RECITERS_LIST.find((r) => r.id === reciterId) || selectedReciter || RECITERS_LIST[0];

  // Keep reciter synced with main reader selection when modal opens
  useEffect(() => {
    if (isOpen && selectedReciter?.id) {
      setReciterId(selectedReciter.id);
    }
  }, [isOpen, selectedReciter?.id]);

  // Sync reflection text whenever ayah switches
  useEffect(() => {
    if (ayah) {
      setCustomReflection(ayah.tafsir || '');
    }
  }, [ayah?.overallNumber]);

  // Preload nature image assets once cleanly
  useEffect(() => {
    Object.entries(NATURE_IMAGE_SOURCES).forEach(([key, src]) => {
      if (imageCacheRef.current[key]) return;
      const img = new Image();
      img.onload = () => {
        imageCacheRef.current[key] = img;
        setAssetLoadTick((t) => t + 1);
      };
      img.src = src;
    });
  }, []);

  // Pre-generate crisp QR code canvas whenever Ayah/Surah/QR toggle changes
  useEffect(() => {
    if (!isOpen || !ayah || !showQr) {
      qrCanvasRef.current = null;
      return;
    }

    let cancelled = false;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bayan-quran.app';
    const url = buildAyahDeepLink(origin, surahNumber, ayah.numberInSurah);
    const offscreen = document.createElement('canvas');

    QRCode.toCanvas(offscreen, url, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(() => {
        if (!cancelled) {
          qrCanvasRef.current = offscreen;
          setAssetLoadTick((t) => t + 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          qrCanvasRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ayah?.numberInSurah, surahNumber, showQr]);

  // Stop any audio preview & video export helper
  const stopAudioPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    setIsLoadingPreview(false);
  }, []);

  const cancelVideoExport = useCallback(() => {
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
      exportAbortRef.current = null;
    }
    if (exportRafRef.current !== null) {
      cancelAnimationFrame(exportRafRef.current);
      exportRafRef.current = null;
    }
    if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
      try {
        activeRecorderRef.current.stop();
      } catch {
        // ignore stop errors during cleanup
      }
      activeRecorderRef.current = null;
    }
    if (activeAudioCtxRef.current) {
      activeAudioCtxRef.current.close().catch(() => {});
      activeAudioCtxRef.current = null;
    }
    setIsExportingVideo(false);
    setVideoProgress(0);
  }, []);

  // Cleanup when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopAudioPreview();
      cancelVideoExport();
      setPreviewError(null);
      setVideoError(null);
    }
    return () => {
      stopAudioPreview();
      cancelVideoExport();
    };
  }, [isOpen, stopAudioPreview, cancelVideoExport]);

  // Stop audio preview if reciter or ayah changes
  useEffect(() => {
    stopAudioPreview();
    setPreviewError(null);
  }, [reciterId, ayah?.overallNumber, surahNumber, stopAudioPreview]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const drawCardFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      options?: { zoomFactor?: number; playbackProgress?: number; isVideoMode?: boolean }
    ) => {
      if (!ayah) return;

      const scale = width / (aspectRatio === 'landscape' ? 1920 : 1080);
      const isNature = theme === 'dawn' || theme === 'night' || theme === 'ocean' || theme === 'forest' || theme === 'custom';
      const isLight = theme === 'parchment' || theme === 'ivory-day';

      const goldColor = isLight ? '#b45309' : '#fbbf24';
      const accentColor = isLight ? '#047857' : theme === 'ocean' || theme === 'midnight' ? '#38bdf8' : '#34d399';
      const primaryTextColor = isLight ? '#1c1917' : '#f8fafc';
      const secondaryTextColor = isLight ? '#44403c' : '#e2e8f0';
      const mutedFooterColor = isLight ? '#57534e' : '#cbd5e1';

      // 1. Background Layer
      if (isNature) {
        const bgImg = theme === 'custom' ? customImageRef.current : imageCacheRef.current[theme];
        if (bgImg) {
          drawCoverImage(ctx, bgImg, 0, 0, width, height, options?.zoomFactor ?? 1);
        } else {
          const fallbackGrad = ctx.createLinearGradient(0, 0, width, height);
          fallbackGrad.addColorStop(0, '#0b1d1b');
          fallbackGrad.addColorStop(1, '#050b0e');
          ctx.fillStyle = fallbackGrad;
          ctx.fillRect(0, 0, width, height);
        }

        // Adjustable Dark Contrast Scrim + Atmospheric Radial Vignette
        const alpha = Math.max(0.08, Math.min(0.88, overlayOpacity / 100));
        ctx.fillStyle = `rgba(4, 10, 16, ${alpha})`;
        ctx.fillRect(0, 0, width, height);

        const vignette = ctx.createRadialGradient(
          width / 2,
          height / 2,
          Math.min(width, height) * 0.25,
          width / 2,
          height / 2,
          Math.max(width, height) * 0.78
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(2, 6, 12, 0.55)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
      } else {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        if (theme === 'emerald') {
          grad.addColorStop(0, '#073124');
          grad.addColorStop(0.5, '#041f17');
          grad.addColorStop(1, '#02120d');
        } else if (theme === 'midnight') {
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(0.55, '#090f1d');
          grad.addColorStop(1, '#020617');
        } else if (theme === 'parchment') {
          grad.addColorStop(0, '#fcf7eb');
          grad.addColorStop(1, '#ede1c6');
        } else {
          // ivory-day
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(1, '#eef2f6');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Ambient glow behind calligraphy
        const glow = ctx.createRadialGradient(
          width / 2,
          height * 0.48,
          10,
          width / 2,
          height * 0.48,
          Math.min(width, height) * 0.55
        );
        glow.addColorStop(
          0,
          isLight ? 'rgba(255, 255, 255, 0.55)' : theme === 'emerald' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(56, 189, 248, 0.12)'
        );
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        // Apply subtle dimming if user dragged scrim on studio theme
        if (overlayOpacity > 10) {
          const subtleAlpha = Math.max(0, (overlayOpacity - 10) / 220);
          ctx.fillStyle = isLight ? `rgba(28, 25, 23, ${subtleAlpha * 0.4})` : `rgba(2, 6, 12, ${subtleAlpha})`;
          ctx.fillRect(0, 0, width, height);
        }
      }

      // 2. Ornamental Frame & Borders
      const pad = Math.round(Math.min(width, height) * 0.048);
      const innerPad = pad + Math.round(14 * scale);

      if (showOrnament) {
        ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.25)' : 'rgba(251, 191, 36, 0.28)';
        ctx.lineWidth = Math.max(1.5, 2.5 * scale);
        ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

        ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.14)' : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        ctx.strokeRect(innerPad, innerPad, width - innerPad * 2, height - innerPad * 2);

        const cornerArm = Math.round(Math.min(width, height) * 0.055);
        const cornerColor = isLight ? 'rgba(180, 83, 9, 0.72)' : 'rgba(251, 191, 36, 0.85)';
        drawAndalusianCorner(ctx, pad, pad, 1, 1, cornerArm, cornerColor);
        drawAndalusianCorner(ctx, width - pad, pad, -1, 1, cornerArm, cornerColor);
        drawAndalusianCorner(ctx, pad, height - pad, 1, -1, cornerArm, cornerColor);
        drawAndalusianCorner(ctx, width - pad, height - pad, -1, -1, cornerArm, cornerColor);
      }

      // 3. Top Header: Bismillah + Surah Pill
      const topAnchorY = innerPad + Math.round(62 * scale);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillStyle = goldColor;
      ctx.font = `bold ${Math.round(30 * scale)}px "Amiri", serif`;
      ctx.fillText('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', width / 2, topAnchorY);

      const pillText = `سورة ${surahName}  •  الآية ${ayah.numberInSurah}`;
      ctx.font = `600 ${Math.round(22 * scale)}px "Cairo", sans-serif`;
      const pillMetrics = ctx.measureText(pillText);
      const pillW = Math.max(Math.round(270 * scale), pillMetrics.width + Math.round(64 * scale));
      const pillH = Math.round(46 * scale);
      const pillX = width / 2 - pillW / 2;
      const pillY = topAnchorY + Math.round(32 * scale);

      traceRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = isLight ? 'rgba(180, 83, 9, 0.08)' : 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.28)' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.fillText(pillText, width / 2, pillY + pillH / 2 + Math.round(1 * scale));
      ctx.restore();

      // 4. Layout Vertical Zones (Header bottom -> Footer top)
      const headerBottomY = pillY + pillH + Math.round(34 * scale);
      const qrBoxSize = showQr && qrCanvasRef.current ? Math.round((aspectRatio === 'landscape' ? 116 : 124) * scale) : 0;
      const footerReserve = Math.max(Math.round(118 * scale), qrBoxSize + Math.round(54 * scale));
      const footerTopY = height - innerPad - footerReserve;

      const hasReflection = includeTafsir && customReflection.trim().length > 0;
      const reflectionFontPx = Math.round(23 * scale);
      const reflectionLineH = Math.round(36 * scale);
      const maxTextWidth = width - innerPad * 2 - Math.round(120 * scale);

      // Compute reflection lines ahead of time so Ayah box height adapts accurately
      let reflectionLines: string[] = [];
      if (hasReflection) {
        ctx.save();
        ctx.font = `500 ${reflectionFontPx}px "Cairo", sans-serif`;
        ctx.direction = 'rtl';
        const wrapped = wrapArabicLines(customReflection.trim(), maxTextWidth - Math.round(40 * scale), (s) => ctx.measureText(s).width);
        const maxRefLines = aspectRatio === 'story' ? 4 : 3;
        if (wrapped.length > maxRefLines) {
          reflectionLines = wrapped.slice(0, maxRefLines);
          reflectionLines[maxRefLines - 1] = `${reflectionLines[maxRefLines - 1].replace(/\s+[^\s]*$/, '')} …`;
        } else {
          reflectionLines = wrapped;
        }
        ctx.restore();
      }

      const reflectionBlockH =
        reflectionLines.length > 0 ? Math.round(48 * scale) + reflectionLines.length * reflectionLineH : 0;

      const availableCenterH = Math.max(180 * scale, footerTopY - headerBottomY);
      const availableAyahH = Math.max(120 * scale, availableCenterH - reflectionBlockH - Math.round(28 * scale));

      // 5. Measure & Auto-Fit Ayah Text
      const fullAyahText = `﴿ ${ayah.text} ﴾`;
      const ayahFontFamily = `"Amiri Quran", "Amiri", serif`;
      const lineHeightMult = 2.05;

      let resolvedFontPx = Math.round(manualFontSize * scale);
      let ayahLines: string[] = [];

      if (autoFitFont) {
        const fitted = computeAutoFitFontSize(
          fullAyahText,
          maxTextWidth - Math.round(32 * scale),
          availableAyahH,
          (str, px) => {
            ctx.font = `bold ${px}px ${ayahFontFamily}`;
            return ctx.measureText(str).width;
          },
          {
            minSize: Math.round(24 * scale),
            maxSize: Math.round((aspectRatio === 'story' ? 62 : 58) * scale),
            lineHeightMultiplier: lineHeightMult,
          }
        );
        resolvedFontPx = fitted.fontSize;
        ayahLines = fitted.lines;
      } else {
        ctx.font = `bold ${resolvedFontPx}px ${ayahFontFamily}`;
        ayahLines = wrapArabicLines(fullAyahText, maxTextWidth - Math.round(32 * scale), (s) => ctx.measureText(s).width);
      }

      const ayahLineHeight = resolvedFontPx * lineHeightMult;
      const totalAyahTextH = ayahLines.length * ayahLineHeight;
      const totalContentBlockH = totalAyahTextH + reflectionBlockH;

      // Vertical centering inside available area
      const blockStartY = headerBottomY + Math.max(0, (availableCenterH - totalContentBlockH) / 2);

      // 6. Optional Frosted Glass Container behind central Ayah + Reflection
      if (showGlassPanel) {
        const glassPadX = Math.round(48 * scale);
        const glassPadY = Math.round(34 * scale);
        const glassX = innerPad + glassPadX;
        const glassW = width - (innerPad + glassPadX) * 2;
        const glassY = Math.max(headerBottomY - Math.round(8 * scale), blockStartY - glassPadY);
        const glassH = Math.min(
          footerTopY - glassY + Math.round(8 * scale),
          totalContentBlockH + glassPadY * 2
        );

        ctx.save();
        traceRoundedRect(ctx, glassX, glassY, glassW, glassH, Math.round(28 * scale));
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.56)' : 'rgba(6, 14, 20, 0.44)';
        ctx.fill();
        ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.2)' : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.stroke();
        ctx.restore();
      }

      // 7. Render Ayah Calligraphy Lines (with RTL word-preserving gold highlight for لفظ الجلالة)
      ctx.save();
      ctx.font = `bold ${resolvedFontPx}px ${ayahFontFamily}`;
      ctx.direction = 'rtl';
      ctx.textBaseline = 'middle';

      if (!isLight) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = Math.round(12 * scale);
        ctx.shadowOffsetY = Math.round(2 * scale);
      }

      const firstBaselineY = blockStartY + ayahLineHeight / 2;
      ayahLines.forEach((line, lineIdx) => {
        const y = firstBaselineY + lineIdx * ayahLineHeight;
        const words = line.trim().split(/\s+/).filter(Boolean);
        const hasAllah = highlightAllah && words.some((w) => isAllahWord(w));

        if (!hasAllah) {
          ctx.textAlign = 'center';
          ctx.fillStyle = primaryTextColor;
          ctx.fillText(line.trim(), width / 2, y);
        } else {
          // Measure words individually & place strictly right-to-left preserving ligatures inside each word
          const spaceW = ctx.measureText(' ').width;
          const wordWidths = words.map((w) => ctx.measureText(w).width);
          const totalW =
            wordWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, words.length - 1) * spaceW;
          let cursorRightX = width / 2 + totalW / 2;
          ctx.textAlign = 'right';

          words.forEach((word, wIdx) => {
            ctx.fillStyle = isAllahWord(word) ? goldColor : primaryTextColor;
            ctx.fillText(word, cursorRightX, y);
            cursorRightX -= wordWidths[wIdx] + spaceW;
          });
        }
      });
      ctx.restore();

      // 8. Render Reflection / Tafsir Block
      if (reflectionLines.length > 0) {
        const dividerY = blockStartY + totalAyahTextH + Math.round(18 * scale);
        ctx.save();
        ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.28)' : 'rgba(251, 191, 36, 0.35)';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.beginPath();
        ctx.moveTo(width / 2 - Math.round(90 * scale), dividerY);
        ctx.lineTo(width / 2 + Math.round(90 * scale), dividerY);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.fillStyle = secondaryTextColor;
        ctx.font = `500 ${reflectionFontPx}px "Cairo", sans-serif`;

        const refStartY = dividerY + Math.round(34 * scale);
        reflectionLines.forEach((rl, idx) => {
          ctx.fillText(rl.trim(), width / 2, refStartY + idx * reflectionLineH);
        });
        ctx.restore();
      }

      // 9. Footer: QR Badge + Reciter Signature + Bayan Waqf Seal
      ctx.save();
      const footerAnchorY = height - innerPad - Math.round(40 * scale);
      const hasQrReady = Boolean(showQr && qrCanvasRef.current);

      if (hasQrReady && qrCanvasRef.current) {
        const qrX = innerPad + Math.round(28 * scale);
        const qrY = height - innerPad - qrBoxSize - Math.round(22 * scale);

        // Rounded white card behind QR
        traceRoundedRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, Math.round(14 * scale));
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.25)' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.stroke();

        const qrInnerMargin = Math.round(8 * scale);
        ctx.drawImage(
          qrCanvasRef.current,
          qrX + qrInnerMargin,
          qrY + qrInnerMargin,
          qrBoxSize - qrInnerMargin * 2,
          qrBoxSize - qrInnerMargin * 2
        );

        // Micro caption next to QR on left side
        ctx.textAlign = 'left';
        ctx.direction = 'rtl';
        ctx.fillStyle = goldColor;
        ctx.font = `600 ${Math.round(18 * scale)}px "Cairo", sans-serif`;
        ctx.fillText('امسح للاستماع والقراءة', qrX + qrBoxSize + Math.round(16 * scale), qrY + qrBoxSize * 0.42);
        ctx.fillStyle = mutedFooterColor;
        ctx.font = `500 ${Math.round(16 * scale)}px "Cairo", sans-serif`;
        ctx.fillText(`سورة ${surahName} (${ayah.numberInSurah})`, qrX + qrBoxSize + Math.round(16 * scale), qrY + qrBoxSize * 0.72);

        // Right-aligned Reciter & Brand Signature
        const rightEdgeX = width - innerPad - Math.round(30 * scale);
        ctx.textAlign = 'right';
        if (showReciterCredit) {
          ctx.fillStyle = primaryTextColor;
          ctx.font = `600 ${Math.round(20 * scale)}px "Cairo", sans-serif`;
          ctx.fillText(`بصوت القارئ: ${activeReciter.name}`, rightEdgeX, qrY + qrBoxSize * 0.4);
        }
        ctx.fillStyle = mutedFooterColor;
        ctx.font = `500 ${Math.round(18 * scale)}px "Cairo", sans-serif`;
        ctx.fillText(
          'تطبيق بيان | مصحف رقمي متكامل',
          rightEdgeX,
          showReciterCredit ? qrY + qrBoxSize * 0.72 : qrY + qrBoxSize * 0.54
        );
      } else {
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        if (showReciterCredit) {
          ctx.fillStyle = primaryTextColor;
          ctx.font = `600 ${Math.round(21 * scale)}px "Cairo", sans-serif`;
          ctx.fillText(`بصوت القارئ: ${activeReciter.name}`, width / 2, footerAnchorY - Math.round(26 * scale));
        }
        ctx.fillStyle = mutedFooterColor;
        ctx.font = `500 ${Math.round(19 * scale)}px "Cairo", sans-serif`;
        ctx.fillText('تطبيق بيان | مصحف رقمي متكامل', width / 2, footerAnchorY + Math.round(4 * scale));
      }
      ctx.restore();

      // 10. Animated Video Playback Progress Indicator (only in Spoken Video Export)
      if (options?.isVideoMode && typeof options.playbackProgress === 'number') {
        const barX = innerPad + Math.round(28 * scale);
        const barW = width - (innerPad + Math.round(28 * scale)) * 2;
        const barY = height - innerPad - Math.round(10 * scale);
        const barH = Math.max(3, Math.round(5 * scale));

        ctx.save();
        traceRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fill();

        const filledW = Math.max(barH, barW * Math.min(1, Math.max(0, options.playbackProgress)));
        traceRoundedRect(ctx, barX, barY, filledW, barH, barH / 2);
        ctx.fillStyle = goldColor;
        ctx.fill();
        ctx.restore();
      }
    },
    [
      ayah,
      aspectRatio,
      theme,
      overlayOpacity,
      showGlassPanel,
      showOrnament,
      surahName,
      includeTafsir,
      customReflection,
      autoFitFont,
      manualFontSize,
      highlightAllah,
      showQr,
      showReciterCredit,
      activeReciter.name,
    ]
  );

  // Trigger live canvas redraw when any dependency or asset updates
  useEffect(() => {
    if (!isOpen || !ayah) return;
    let cancelled = false;

    const paint = async () => {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore if fonts API unavailable
        }
      }
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = getCanvasDimensions(aspectRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      drawCardFrame(ctx, width, height);
    };

    paint();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ayah, aspectRatio, assetLoadTick, drawCardFrame]);

  if (!isOpen || !ayah) return null;

  const handleUploadCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        customImageRef.current = img;
        setCustomImageDataUrl(dataUrl);
        setTheme('custom');
        setOverlayOpacity((prev) => (prev < 35 ? 50 : prev));
        setAssetLoadTick((t) => t + 1);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearCustomImage = () => {
    customImageRef.current = null;
    setCustomImageDataUrl(null);
    if (theme === 'custom') {
      setTheme('dawn');
    }
    setAssetLoadTick((t) => t + 1);
  };

  const handleToggleAudioPreview = async () => {
    setPreviewError(null);
    if (isPreviewPlaying && previewAudioRef.current) {
      stopAudioPreview();
      return;
    }

    stopAudioPreview();
    setIsLoadingPreview(true);
    const audioUrl = getAyahAudioUrl(activeReciter.serverKey, surahNumber, ayah.numberInSurah);
    const audio = new Audio(audioUrl);
    previewAudioRef.current = audio;

    audio.onplaying = () => {
      setIsLoadingPreview(false);
      setIsPreviewPlaying(true);
    };
    audio.onended = () => {
      setIsPreviewPlaying(false);
      setIsLoadingPreview(false);
    };
    audio.onerror = () => {
      setIsLoadingPreview(false);
      setIsPreviewPlaying(false);
      setPreviewError('تعذر تشغيل التلاوة الآن، تحقق من الاتصال بالإنترنت.');
    };

    try {
      await audio.play();
    } catch {
      setIsLoadingPreview(false);
      setIsPreviewPlaying(false);
      setPreviewError('تعذر بدء الصوت، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDownloadingPng(true);
    const link = document.createElement('a');
    link.download = `Bayan_Ayah_${surahName}_${ayah.numberInSurah}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsDownloadingPng(false);
  };

  const handleCopyPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      });
    } catch {
      handleDownloadPng();
    }
  };

  const handleSharePng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (navigator.share) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Ayah_${surahName}_${ayah.numberInSurah}.png`, { type: 'image/png' });
        try {
          await navigator.share({
            title: `آية من سورة ${surahName}`,
            text: `﴿ ${ayah.text} ﴾ [سورة ${surahName}: ${ayah.numberInSurah}]`,
            files: [file],
          });
        } catch {
          // user cancelled native share
        }
      });
    } else {
      handleDownloadPng();
    }
  };

  const handleExportVideo = async () => {
    setVideoError(null);
    stopAudioPreview();

    const format = detectSupportedVideoFormat();
    if (!format) {
      setVideoError('متصفحك الحالي لا يدعم تصدير الفيديو المباشر؛ يمكنك تحميل البطاقة كصورة عالية الدقة.');
      return;
    }

    const abortController = new AbortController();
    exportAbortRef.current = abortController;
    setIsExportingVideo(true);
    setVideoProgress(2);

    try {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        await document.fonts.ready;
      }

      const audioUrl = getAyahAudioUrl(activeReciter.serverKey, surahNumber, ayah.numberInSurah);
      const response = await fetch(audioUrl, { mode: 'cors', signal: abortController.signal });
      if (!response.ok) {
        throw new Error('HTTP audio fetch failed');
      }

      const arrayBuffer = await response.arrayBuffer();
      if (abortController.signal.aborted) return;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      activeAudioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (abortController.signal.aborted) return;

      const { width, height } = getVideoExportDimensions(aspectRatio);
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) {
        throw new Error('Canvas 2D unavailable');
      }
      if (typeof exportCanvas.captureStream !== 'function') {
        throw new Error('captureStream unsupported');
      }

      // Draw initial frame before capture starts
      drawCardFrame(exportCtx, width, height, { zoomFactor: 1, playbackProgress: 0, isVideoMode: true });

      const videoStream = exportCanvas.captureStream(30);
      const audioDest = audioCtx.createMediaStreamDestination();
      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioDest);

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: format.mimeType,
        videoBitsPerSecond: 4_500_000,
      });
      activeRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      const totalDurationSec = Math.max(2.2, audioBuffer.duration + 0.55);

      recorder.onstop = () => {
        videoStream.getTracks().forEach((t) => t.stop());
        audioDest.stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
        activeAudioCtxRef.current = null;
        activeRecorderRef.current = null;

        if (!abortController.signal.aborted && chunks.length > 0) {
          const blob = new Blob(chunks, { type: format.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Bayan_Video_${surahName}_${ayah.numberInSurah}.${format.extension}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
        setIsExportingVideo(false);
        setVideoProgress(0);
      };

      recorder.start(200);
      sourceNode.start(0);
      const startPerf = performance.now();

      const stepAnimation = () => {
        if (abortController.signal.aborted) return;
        const elapsedSec = (performance.now() - startPerf) / 1000;
        const progress = Math.min(1, elapsedSec / totalDurationSec);
        const zoomFactor = 1 + 0.065 * progress;

        drawCardFrame(exportCtx, width, height, {
          zoomFactor,
          playbackProgress: progress,
          isVideoMode: true,
        });
        setVideoProgress(Math.min(99, Math.max(5, Math.round(progress * 100))));

        if (elapsedSec < totalDurationSec) {
          exportRafRef.current = requestAnimationFrame(stepAnimation);
        } else {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      };

      exportRafRef.current = requestAnimationFrame(stepAnimation);
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error('Spoken video export error:', err);
      cancelVideoExport();
      setVideoError(
        'تعذر سحب صوت القارئ لتوليد الفيديو (قد يتطلب اتصالاً مباشراً بخادم التلاوات). يمكنك تحميل البطاقة كصورة فائقة الدقة الآن.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-share-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/55 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-[#FBF7EE] dark:bg-[#10161f] border border-[#8A6418]/30 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Controls Studio Sidebar */}
        <div className="w-full md:w-[370px] shrink-0 p-4 sm:p-5 border-b md:border-b-0 md:border-l border-[#E3D9C3] dark:border-slate-800 bg-[#FBF7EE] dark:bg-[#10161f] flex flex-col gap-4 overflow-y-auto max-h-[52vh] md:max-h-[94vh]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E3D9C3] dark:border-slate-800/80">
            <div id="social-share-title" className="flex items-center gap-2 text-[#1F3A6E] dark:text-[#D9B45A] font-bold text-sm">
              <Sparkles className="w-4 h-4 shrink-0 text-[#8A6418] dark:text-[#D9B45A]" />
              <span>استوديو بطاقات الآيات</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق استوديو البطاقات"
              className="p-1.5 rounded-lg text-[#5E584E] dark:text-slate-400 hover:text-[#1B1A17] dark:hover:text-white hover:bg-[#EFE6D1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#5E584E] dark:text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
              <span>أبعاد المنصة</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'post', label: 'منشور 1:1' },
                { id: 'story', label: 'ستوري 9:16' },
                { id: 'landscape', label: 'عريض 16:9' },
              ].map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => setAspectRatio(ratio.id as CardAspectRatio)}
                  className={`py-2 px-2 text-[11px] rounded-xl font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                    aspectRatio === ratio.id
                      ? 'bg-[#1F3A6E] border-[#8A6418] dark:border-[#D9B45A] text-[#FBF7EE] dark:text-[#F6EFDD]'
                      : 'border-[#D4C7AE] dark:border-slate-800 bg-[#F6EFDD] dark:bg-slate-900 text-[#5E584E] dark:text-slate-400 hover:border-[#8A6418]/50 dark:hover:border-slate-700 hover:text-[#1B1A17] dark:hover:text-slate-200'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Nature & Studio Backdrops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#5E584E] dark:text-slate-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#8A6418] dark:text-[#D9B45A]" />
                <span>الخلفيات الطبيعية والطابع</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-[#1F3A6E] dark:text-[#D9B45A] hover:underline font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3 h-3" />
                <span>صورة مخصصة</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadCustomImage}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {THEME_PRESETS.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`relative h-14 rounded-xl border overflow-hidden transition-all cursor-pointer group ${
                      isSelected
                        ? 'ring-2 ring-[#8A6418] dark:ring-[#D9B45A] border-[#1F3A6E] dark:border-white/60'
                        : 'border-[#D4C7AE] dark:border-slate-800 hover:border-[#8A6418]/60 dark:hover:border-slate-600'
                    }`}
                  >
                    {t.previewImage ? (
                      <img
                        src={t.previewImage}
                        alt={t.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`absolute inset-0 ${t.previewBg}`} />
                    )}
                    <div
                      className={`absolute inset-x-0 bottom-0 py-0.5 px-1 text-[10px] font-semibold truncate text-center ${
                        t.isLight ? 'bg-white/85 text-stone-900' : 'bg-black/65 text-white'
                      }`}
                    >
                      {t.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {customImageDataUrl && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#1F3A6E]/10 dark:bg-[#1F3A6E]/35 border border-[#1F3A6E]/30 dark:border-[#648CD4]/35 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTheme('custom')}
                  className="text-[#1F3A6E] dark:text-[#D9B45A] font-semibold hover:underline cursor-pointer"
                >
                  {theme === 'custom' ? '✓ الخلفية المرفوعة مفعلة' : 'تفعيل الصورة المرفوعة'}
                </button>
                <button
                  type="button"
                  onClick={handleClearCustomImage}
                  aria-label="إزالة الصورة المخصصة"
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-500 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Contrast Scrim Slider */}
            <div className="pt-1">
              <div className="flex justify-between text-[11px] text-[#5E584E] dark:text-slate-400 mb-1">
                <span>تعتيم الخلفية لوضوح الخط</span>
                <span className="tabular-nums text-[#1B1A17] dark:text-slate-300">{overlayOpacity}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={85}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-full accent-[#1F3A6E] dark:accent-[#D9B45A] h-1.5 bg-[#E3D9C3] dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Calligraphy & Design Toggles */}
          <div className="space-y-2 pt-1 border-t border-[#E3D9C3] dark:border-slate-800/80">
            <label className="text-[11px] font-semibold text-[#5E584E] dark:text-slate-400 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#648CD4]" />
              <span>التصميم والخط القرآني</span>
            </label>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setAutoFitFont((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium text-right flex items-center justify-between cursor-pointer transition-colors ${
                  autoFitFont
                    ? 'bg-[#1F3A6E] border-[#1F3A6E] dark:bg-[#1F3A6E]/55 dark:border-[#648CD4]/55 text-[#FBF7EE] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span>ملاءمة تلقائية</span>
                <span className={`w-2 h-2 rounded-full ${autoFitFont ? 'bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>

              <button
                type="button"
                onClick={() => setHighlightAllah((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium text-right flex items-center justify-between cursor-pointer transition-colors ${
                  highlightAllah
                    ? 'bg-[#8A6418]/15 border-[#8A6418]/60 dark:bg-[#D9B45A]/15 dark:border-[#D9B45A]/50 text-[#6F4E0E] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span>تذهيب لفظ الجلالة</span>
                <span className={`w-2 h-2 rounded-full ${highlightAllah ? 'bg-[#8A6418] dark:bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowGlassPanel((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium text-right flex items-center justify-between cursor-pointer transition-colors ${
                  showGlassPanel
                    ? 'bg-[#1F3A6E] border-[#1F3A6E] dark:bg-[#1F3A6E]/55 dark:border-[#648CD4]/55 text-[#FBF7EE] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span>إطار زجاجي ناعم</span>
                <span className={`w-2 h-2 rounded-full ${showGlassPanel ? 'bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowOrnament((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium text-right flex items-center justify-between cursor-pointer transition-colors ${
                  showOrnament
                    ? 'bg-[#1F3A6E] border-[#1F3A6E] dark:bg-[#1F3A6E]/55 dark:border-[#648CD4]/55 text-[#FBF7EE] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span>زخرفة أندلسية</span>
                <span className={`w-2 h-2 rounded-full ${showOrnament ? 'bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>
            </div>

            {!autoFitFont && (
              <div className="pt-1">
                <div className="flex justify-between text-[11px] text-[#5E584E] dark:text-slate-400 mb-1">
                  <span>حجم الخط اليدوي</span>
                  <span className="tabular-nums text-[#1B1A17] dark:text-slate-300">{manualFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={64}
                  value={manualFontSize}
                  onChange={(e) => setManualFontSize(Number(e.target.value))}
                  className="w-full accent-[#1F3A6E] dark:accent-[#D9B45A] h-1.5 bg-[#E3D9C3] dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* 4. Tadabbur Reflection & QR Deep Link */}
          <div className="space-y-2 pt-1 border-t border-[#E3D9C3] dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#1B1A17] dark:text-slate-300">ومضة تدبرية / تفسير</label>
              <input
                type="checkbox"
                checked={includeTafsir}
                onChange={(e) => setIncludeTafsir(e.target.checked)}
                className="accent-[#1F3A6E] dark:accent-[#D9B45A] w-4 h-4 rounded cursor-pointer"
              />
            </div>

            {includeTafsir && (
              <textarea
                rows={2}
                value={customReflection}
                onChange={(e) => setCustomReflection(e.target.value)}
                placeholder="اكتب ومضة تدبرية قصيرة أو اترك التفسير الميسر..."
                className="w-full rounded-xl bg-[#F6EFDD] dark:bg-slate-900 border border-[#D4C7AE] dark:border-slate-800 focus:border-[#8A6418] dark:focus:border-[#D9B45A] outline-none p-2 text-xs text-[#1B1A17] dark:text-slate-200 leading-relaxed resize-none"
              />
            )}

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium flex items-center justify-between cursor-pointer transition-colors ${
                  showQr
                    ? 'bg-[#1F3A6E] border-[#1F3A6E] dark:bg-[#1F3A6E]/55 dark:border-[#648CD4]/55 text-[#FBF7EE] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>رمز QR</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${showQr ? 'bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowReciterCredit((v) => !v)}
                className={`py-2 px-2.5 rounded-xl border font-medium flex items-center justify-between cursor-pointer transition-colors ${
                  showReciterCredit
                    ? 'bg-[#1F3A6E] border-[#1F3A6E] dark:bg-[#1F3A6E]/55 dark:border-[#648CD4]/55 text-[#FBF7EE] dark:text-[#F6EFDD]'
                    : 'bg-[#F6EFDD] dark:bg-slate-900 border-[#D4C7AE] dark:border-slate-800 text-[#5E584E] dark:text-slate-400'
                }`}
              >
                <span>توقيع القارئ</span>
                <span className={`w-2 h-2 rounded-full ${showReciterCredit ? 'bg-[#D9B45A]' : 'bg-[#C4B59A] dark:bg-slate-700'}`} />
              </button>
            </div>
          </div>

          {/* 5. Reciter Audio Preview & Spoken Video Card */}
          <div className="space-y-2 pt-2 border-t border-[#E3D9C3] dark:border-slate-800/80">
            <label className="text-[11px] font-semibold text-[#5E584E] dark:text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#D9B45A]" />
              <span>صوت التلاوة والبطاقة الناطقة</span>
            </label>

            <div className="flex items-center gap-2">
              <select
                value={activeReciter.id}
                onChange={(e) => setReciterId(e.target.value)}
                disabled={isExportingVideo}
                className="flex-1 py-2 px-2.5 rounded-xl bg-[#F6EFDD] dark:bg-slate-900 border border-[#D4C7AE] dark:border-slate-800 text-xs text-[#1B1A17] dark:text-slate-200 outline-none focus:border-[#8A6418] dark:focus:border-[#D9B45A]"
              >
                {RECITERS_LIST.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleToggleAudioPreview}
                disabled={isExportingVideo || isLoadingPreview}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                  isPreviewPlaying
                    ? 'bg-[#8A6418]/15 border-[#8A6418] text-[#6F4E0E] dark:bg-[#D9B45A]/20 dark:border-[#D9B45A]/50 dark:text-[#D9B45A]'
                    : 'bg-[#F6EFDD] hover:bg-[#EFE6D1] dark:bg-slate-900 dark:hover:bg-slate-800 border-[#D4C7AE] dark:border-slate-700 text-[#1B1A17] dark:text-slate-200'
                }`}
              >
                {isLoadingPreview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPreviewPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#1F3A6E] dark:text-[#D9B45A]" />
                )}
                <span>{isPreviewPlaying ? 'إيقاف' : 'استماع'}</span>
              </button>
            </div>

            {previewError && (
              <p className="text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{previewError}</span>
              </p>
            )}
          </div>

          {/* 6. Export Actions */}
          <div className="mt-auto pt-3 border-t border-[#E3D9C3] dark:border-slate-800 flex flex-col gap-2">
            {/* Spoken Video Card Export Button */}
            {isExportingVideo ? (
              <div className="p-2.5 rounded-xl bg-[#EFE6D1] dark:bg-[#D9B45A]/15 border border-[#8A6418]/40 dark:border-[#D9B45A]/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6F4E0E] dark:text-[#D9B45A] font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ دمج الصوت والصورة ({videoProgress}%)</span>
                  </span>
                  <button
                    type="button"
                    onClick={cancelVideoExport}
                    className="text-rose-700 dark:text-rose-400 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#D4C7AE] dark:bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-[#8A6418] dark:bg-[#D9B45A] transition-all duration-150"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleExportVideo}
                className="w-full py-2.5 px-4 bg-[#D9B45A] hover:bg-[#e4c370] text-[#10161f] rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all text-xs cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>تصدير بطاقة فيديو ناطقة بصوت القارئ</span>
              </button>
            )}

            {videoError && (
              <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed flex items-start gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-500/20 rounded-xl p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{videoError}</span>
              </p>
            )}

            {/* PNG Download */}
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloadingPng || isExportingVideo}
              className="w-full py-2.5 px-4 bg-[#1F3A6E] hover:bg-[#2E5499] disabled:opacity-50 text-[#FBF7EE] rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all text-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>حفظ صورة عالية الدقة (PNG)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyPng}
                disabled={isExportingVideo}
                className="py-2 px-3 bg-[#F6EFDD] hover:bg-[#EFE6D1] dark:bg-slate-900 dark:hover:bg-slate-800 text-[#1B1A17] dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#D4C7AE] dark:border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'تم النسخ' : 'نسخ للحافظة'}</span>
              </button>

              <button
                type="button"
                onClick={handleSharePng}
                disabled={isExportingVideo}
                className="py-2 px-3 bg-[#F6EFDD] hover:bg-[#EFE6D1] dark:bg-slate-900 dark:hover:bg-slate-800 text-[#1B1A17] dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#D4C7AE] dark:border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة فورية</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Studio Canvas Preview */}
        <div className="flex-1 bg-[#EFE6D1] dark:bg-[#06090f] p-4 sm:p-6 flex flex-col items-center justify-center overflow-auto relative">
          <div className="mb-2.5 flex items-center gap-2 text-[11px] text-[#5E584E] dark:text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-[#FBF7EE] dark:bg-slate-900 border border-[#D4C7AE] dark:border-slate-800 text-[#1B1A17] dark:text-slate-300 font-medium tabular-nums">
              {aspectRatio === 'post' ? '1080 × 1080' : aspectRatio === 'story' ? '1080 × 1920' : '1920 × 1080'}
            </span>
            <span>معاينة حية بدقة الاستوديو</span>
          </div>

          <div className="relative max-w-full max-h-full flex items-center justify-center rounded-xl overflow-hidden shadow-2xl border border-[#D4C7AE] dark:border-slate-800/80">
            <canvas
              ref={canvasRef}
              className="max-h-[38vh] md:max-h-[78vh] w-auto max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
