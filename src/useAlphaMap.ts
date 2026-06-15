import { useEffect, useState } from "react";

/**
 * Loads a PNG and returns its raw alpha grid so callers can hit-test
 * cursor positions against the silhouette instead of the bbox.
 */
export function useAlphaMap(src: string) {
  const [map, setMap] = useState<
    { w: number; h: number; data: Uint8ClampedArray } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (!cancelled)
          setMap({ w: canvas.width, h: canvas.height, data: imgData.data });
      } catch {
        /* CORS-tainted canvas; leave map null and fall back to bbox hit-test */
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return map;
}
