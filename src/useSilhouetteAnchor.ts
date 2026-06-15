import { useEffect, useState } from "react";

export function useSilhouetteAnchor(src: string) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

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

      // Diagonal scan from top-left: find the first opaque pixel along
      // each anti-diagonal x+y=d, stop at the first hit.
      for (let d = 0; d < w + h; d++) {
        const xMin = Math.max(0, d - h + 1);
        const xMax = Math.min(w - 1, d);
        for (let x = xMin; x <= xMax; x++) {
          const y = d - x;
          if (data[(y * w + x) * 4 + 3] > 40) {
            setAnchor({ x: x / w, y: y / h });
            return;
          }
        }
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return anchor;
}
