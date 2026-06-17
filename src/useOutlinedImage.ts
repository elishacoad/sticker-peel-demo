import { useEffect, useState } from "react";

// Pad fraction baked into the outlined image — matches the existing
// CSS clip-path overhang (-15%/115%) so the baked image can slot into
// the same layout without changing geometry. Outline halo extending
// past 15% past the artwork's bbox would still get clipped, same as
// the original SVG filter region (x=-25% width=150%).
export const OUTLINE_PAD_FRAC = 0.15;

type Mode = "outline" | "back";

// Build the same filter chain the runtime SVG uses, so the baked
// bitmap is a pixel-exact replacement.
const filterPrimitives = (
  mode: Mode,
  outlineRadius: number,
  outlineSmooth: number,
) => {
  const common = `
    <feMorphology in="SourceAlpha" operator="dilate" radius="${outlineRadius}" result="dilated"/>
    <feGaussianBlur in="dilated" stdDeviation="${outlineSmooth}" result="soft"/>
    <feComponentTransfer in="soft" result="rounded">
      <feFuncA type="linear" slope="8" intercept="-2.5"/>
    </feComponentTransfer>
    <feFlood flood-color="#ffffff" result="white"/>
    <feComposite in="white" in2="rounded" operator="in" result="outline"/>`;

  if (mode === "outline") {
    return `${common}
      <feMerge>
        <feMergeNode in="outline"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>`;
  }
  // back: just the outline silhouette, no SourceGraphic
  return common;
};

const dataUrlCache = new Map<string, Promise<string>>();

const fetchAsDataUrl = (src: string): Promise<string> => {
  let p = dataUrlCache.get(src);
  if (p) return p;
  p = (async () => {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  })();
  dataUrlCache.set(src, p);
  return p;
};

const loadImageSize = (url: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("img load failed"));
    img.src = url;
  });

// Bake the runtime SVG outline/back filter into a one-shot bitmap so
// the per-frame filter cost (feMorphology + Gaussian + componentTransfer
// + composite + merge) collapses to a single rasterization at mount.
//
// `displaySize` is the CSS px size the sticker is rendered at. The
// SVG canvas is sized to match so that `outlineRadius=5` produces the
// same 5-CSS-px outline the runtime filter did. Without this, baking
// at the source PNG's resolution (often 512px) would shrink the
// outline to ~1/3 its intended thickness when the bitmap is scaled
// down for display.
export function useOutlinedImage(
  src: string,
  mode: Mode,
  outlineRadius: number,
  outlineSmooth: number,
  displaySize: number,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    const bake = async () => {
      const dataUrl = await fetchAsDataUrl(src);
      // Source dimensions only matter for aspect-ratio; the SVG canvas
      // is sized in display units so filter coords line up with runtime.
      const { w: srcW, h: srcH } = await loadImageSize(dataUrl);
      const aspect = srcW / srcH;
      const imgW = aspect >= 1 ? displaySize : displaySize * aspect;
      const imgH = aspect >= 1 ? displaySize / aspect : displaySize;
      const padW = Math.round(displaySize * OUTLINE_PAD_FRAC);
      const padH = Math.round(displaySize * OUTLINE_PAD_FRAC);
      const totalW = Math.round(displaySize + padW * 2);
      const totalH = Math.round(displaySize + padH * 2);
      // Center the (possibly non-square) image inside the padded box.
      const imgX = padW + (displaySize - imgW) / 2;
      const imgY = padH + (displaySize - imgH) / 2;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
        <defs>
          <filter id="f" x="-25%" y="-25%" width="150%" height="150%">
            ${filterPrimitives(mode, outlineRadius, outlineSmooth)}
          </filter>
        </defs>
        <image href="${dataUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" filter="url(#f)"/>
      </svg>`;

      const blob = new Blob([svg], { type: "image/svg+xml" });
      createdUrl = URL.createObjectURL(blob);

      if (cancelled) {
        URL.revokeObjectURL(createdUrl);
        return;
      }
      setUrl(createdUrl);
    };

    bake().catch(() => {});

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, mode, outlineRadius, outlineSmooth, displaySize]);

  return url;
}
