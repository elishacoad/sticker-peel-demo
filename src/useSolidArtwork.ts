import { useEffect, useState } from "react";

// Alpha at or above this counts as ink when deciding what's a hole.
const OPAQUE = 128;

const cache = new Map<string, Promise<string>>();

/**
 * Fills a mark's *enclosed* transparent regions with white, leaving the
 * outside untouched — React's petals and GitHub's cat become vinyl, and
 * the outer contour stays exactly the logo's.
 *
 * A morphological close (dilate then erode) can't do this: it pads every
 * concave notch on the outside too, which shows up as webbing between
 * the ring lobes. Reachability is the actual question being asked, so
 * this floods inward from the border and fills whatever it never reached.
 */
const solidify = (src: string): Promise<string> => {
  let p = cache.get(src);
  if (p) return p;

  p = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0);

      let pixels: ImageData;
      try {
        pixels = ctx.getImageData(0, 0, w, h);
      } catch {
        // CORS-tainted; hand back the original rather than failing.
        return resolve(src);
      }
      const data = pixels.data;

      // Flood from the border across transparent pixels. Explicit stack
      // of packed indices — a recursive fill would blow the call stack
      // on a 512px canvas.
      const outside = new Uint8Array(w * h);
      const stack: number[] = [];
      const push = (i: number) => {
        if (outside[i] || data[i * 4 + 3] >= OPAQUE) return;
        outside[i] = 1;
        stack.push(i);
      };
      for (let x = 0; x < w; x++) {
        push(x);
        push((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        push(y * w);
        push(y * w + w - 1);
      }
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % w;
        const y = (i - x) / w;
        if (x > 0) push(i - 1);
        if (x < w - 1) push(i + 1);
        if (y > 0) push(i - w);
        if (y < h - 1) push(i + w);
      }

      // Anything transparent the flood never reached is enclosed.
      for (let i = 0; i < w * h; i++) {
        if (!outside[i] && data[i * 4 + 3] < OPAQUE) {
          data[i * 4] = 255;
          data[i * 4 + 1] = 255;
          data[i * 4 + 2] = 255;
          data[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });

  cache.set(src, p);
  return p;
};

export function useSolidArtwork(src: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    solidify(src)
      .then((out) => {
        if (!cancelled) setUrl(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  return url;
}
