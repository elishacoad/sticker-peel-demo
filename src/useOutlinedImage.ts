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
export function useOutlinedImage(
  src: string,
  mode: Mode,
  outlineRadius: number,
  outlineSmooth: number,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    const bake = async () => {
      const dataUrl = await fetchAsDataUrl(src);
      const { w, h } = await loadImageSize(dataUrl);
      const padW = Math.round(w * OUTLINE_PAD_FRAC);
      const padH = Math.round(h * OUTLINE_PAD_FRAC);
      const totalW = w + padW * 2;
      const totalH = h + padH * 2;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
        <defs>
          <filter id="f" x="-25%" y="-25%" width="150%" height="150%">
            ${filterPrimitives(mode, outlineRadius, outlineSmooth)}
          </filter>
        </defs>
        <image href="${dataUrl}" x="${padW}" y="${padH}" width="${w}" height="${h}" filter="url(#f)"/>
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
  }, [src, mode, outlineRadius, outlineSmooth]);

  return url;
}
