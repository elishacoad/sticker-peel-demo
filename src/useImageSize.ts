import { useEffect, useState } from "react";

/** Returns the PNG's natural pixel dimensions once it loads. */
export function useImageSize(src: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return size;
}
