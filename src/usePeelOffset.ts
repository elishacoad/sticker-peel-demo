import { useEffect, useState } from "react";

/**
 * For a PNG sticker rendered upright inside a square element that is itself
 * rotated by `peelDirectionDeg`, returns the position (as a percentage of
 * the element's height) at which the silhouette first appears in the
 * rotated frame's local-y axis. The clip-path peel should start at this
 * offset so the peel cuts the actual sticker edge rather than empty
 * bounding-box padding.
 *
 * Math: for container rotated by θ, a world point (wx, wy) maps to local-y
 *   local_y_pct = 50 + ((wx/W - 0.5)·(-sinθ) + (wy/W - 0.5)·cosθ)·100
 * Minimise over silhouette pixels to find the silhouette's local-y top.
 */
export function usePeelOffset(
  src: string,
  peelDirectionDeg: number
): number | null {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        return;
      }

      const theta = (peelDirectionDeg * Math.PI) / 180;
      const ax = -Math.sin(theta);
      const ay = Math.cos(theta);

      let minProj = Infinity;
      for (let y = 0; y < h; y++) {
        const yn = y / h - 0.5;
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 40) {
            const xn = x / w - 0.5;
            const proj = xn * ax + yn * ay;
            if (proj < minProj) minProj = proj;
          }
        }
      }

      if (!cancelled) setOffset(50 + minProj * 100);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, peelDirectionDeg]);

  return offset;
}
