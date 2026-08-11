import {
  siReact,
  siClaude,
  siVite,
  siGithub,
  siTailwindcss,
} from "simple-icons";

export type StickerDef = {
  id: string;
  src: string;
  x: number;
  y: number;
  rot: number;
  /**
   * Set when the source artwork already ships its own die-cut border
   * (a pre-cut sticker PNG, say). Those skip outline generation even
   * when the stage is set to add one, so they don't get a second border
   * stacked outside the one they came with.
   */
  hasOutline?: boolean;
};

type SimpleIcon = { title: string; hex: string; path: string };

// A logo mark in its own coordinate space, as one or more colored paths.
// Multi-path so brands with real color breakdowns (Figma) aren't flattened
// to the single-color silhouettes simple-icons ships.
type Mark = {
  title: string;
  w: number;
  h: number;
  paths: { d: string; fill: string }[];
  // Shapes painted white *under* the art, in the mark's own coordinate
  // space. For knockout logos (GitHub's cat is a hole punched through a
  // disc) this is what stops the stage showing through the mark. The
  // close filter can't help there — the hole is most of the shape.
  backing?: string;
};

// Artwork canvas. Bigger than the on-screen size so the alpha hit-test
// map (useAlphaMap) has enough resolution to trace the die-cut edge.
const SIZE = 512;
// Fraction of the canvas the mark occupies. The rest is headroom for the
// backing below plus the runtime outline filter's dilate, both of which
// grow the silhouette outward.
const MARK_FRAC = 0.7;
// Morphological close radius, in canvas px. Dilating then eroding by
// nearly the same amount seals interior holes and concave notches (the
// gaps between Figma's lobes, GitHub's legs) without inflating the outer
// contour into a blob — the cut still tracks the logo's shape.
const CLOSE = 42;
// How much of the dilate is left un-eroded: a white margin baked into
// the artwork itself. Default 0 — eroding all the way back restores the
// mark's own contour, so the artwork is just the logo (still hole-free)
// and the die-cut border is entirely the stage's job. Raise it per
// sticker to simulate art that arrives with its border already printed.
const MARGIN_DEFAULT = 0;
// GitHub is the demo of exactly that: border baked in, paired with
// `hasOutline` so the stage doesn't stack a second one outside it.
const MARGIN_BAKED_IN = 17;

const fromSimpleIcon = (icon: SimpleIcon, backing?: string): Mark => ({
  title: icon.title,
  w: 24,
  h: 24,
  paths: [{ d: icon.path, fill: `#${icon.hex}` }],
  backing,
});

// GitHub's disc, so the cat reads as white vinyl instead of a hole.
const GITHUB_DISC = '<circle cx="12" cy="12" r="11.6"/>';

// Figma's official five-shape mark, in its native 38x57 space.
const FIGMA: Mark = {
  title: "Figma",
  w: 38,
  h: 57,
  paths: [
    { d: "M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z", fill: "#F24E1E" },
    { d: "M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z", fill: "#FF7262" },
    { d: "M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z", fill: "#A259FF" },
    { d: "M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z", fill: "#0ACF83" },
    { d: "M19 28.5A9.5 9.5 0 1 1 38 28.5 9.5 9.5 0 0 1 19 28.5z", fill: "#1ABCFE" },
  ],
};

/**
 * Builds the sticker artwork as an inline SVG data URI. Data URIs keep
 * it same-origin so the canvas passes never hit a tainted context.
 *
 * At margin 0 this is just the mark — no border of any kind. Enclosed
 * gaps are sealed later by `useSolidArtwork`, which fills only what the
 * outside can't reach; doing it here with a dilate/erode close would
 * also pad the concave notches and leave visible webbing.
 *
 * A non-zero margin bakes a white border into the artwork, standing in
 * for art that arrives with its die-cut already printed.
 */
function logoSticker(mark: Mark, margin: number = MARGIN_DEFAULT): string {
  // Fit the mark inside MARK_FRAC of the canvas, preserving aspect.
  const box = SIZE * MARK_FRAC;
  const scale = Math.min(box / mark.w, box / mark.h);
  const dx = (SIZE - mark.w * scale) / 2;
  const dy = (SIZE - mark.h * scale) / 2;

  const art = mark.paths
    .map((p) => `<path d="${p.d}" fill="${p.fill}"/>`)
    .join("");
  const place = (content: string) =>
    `<g transform="translate(${dx} ${dy}) scale(${scale})">${content}</g>`;
  // The filter goes on an *untransformed* wrapper. On the transformed
  // group itself, feMorphology radii would be read in the mark's 24-unit
  // space rather than canvas px, and the close would do almost nothing.
  const backingArt = mark.backing
    ? `<g fill="#ffffff">${mark.backing}</g>${art}`
    : art;

  if (margin <= 0) {
    const bare = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <title>${mark.title}</title>
  ${place(backingArt)}
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bare)}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <title>${mark.title}</title>
  <defs>
    <filter id="cut" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${CLOSE}" result="grown"/>
      <feMorphology in="grown" operator="erode" radius="${CLOSE - margin}" result="closed"/>
      <feGaussianBlur in="closed" stdDeviation="6" result="soft"/>
      <!-- Threshold the blur at 0.5 (slope*0.5 + intercept = 0) so
           smoothing doesn't also push the edge outward and leave a halo
           the artwork never asked for. -->
      <feComponentTransfer in="soft" result="edge">
        <feFuncA type="linear" slope="10" intercept="-5"/>
      </feComponentTransfer>
      <feFlood flood-color="#ffffff" result="vinyl"/>
      <feComposite in="vinyl" in2="edge" operator="in"/>
    </filter>
  </defs>
  <g filter="url(#cut)">${place(backingArt)}</g>
  ${place(backingArt)}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const STICKERS: StickerDef[] = [
  { id: "react",      src: logoSticker(fromSimpleIcon(siReact)),       x: 0.14, y: 0.22, rot: -8 },
  { id: "claude",     src: logoSticker(fromSimpleIcon(siClaude)),      x: 0.36, y: 0.58, rot: 6 },
  { id: "vite",       src: logoSticker(fromSimpleIcon(siVite)),        x: 0.62, y: 0.20, rot: 14 },
  { id: "figma",      src: logoSticker(FIGMA),                         x: 0.22, y: 0.74, rot: -3 },
  {
    id: "github",
    src: logoSticker(fromSimpleIcon(siGithub, GITHUB_DISC), MARGIN_BAKED_IN),
    x: 0.50, y: 0.82, rot: 11,
    hasOutline: true,
  },
  { id: "tailwind",   src: logoSticker(fromSimpleIcon(siTailwindcss)), x: 0.68, y: 0.44, rot: -16 },
];
