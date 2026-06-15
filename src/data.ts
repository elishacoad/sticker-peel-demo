export type StickerDef = {
  id: string;
  src: string;
  x: number;
  y: number;
  rot: number;
};

const NOTO = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/512";

export const STICKERS: StickerDef[] = [
  { id: "dog",    src: `${NOTO}/emoji_u1f436.png`, x: 0.18, y: 0.28, rot: -8 },
  { id: "cat",    src: `${NOTO}/emoji_u1f431.png`, x: 0.42, y: 0.62, rot:  6 },
  { id: "flower", src: `${NOTO}/emoji_u1f338.png`, x: 0.72, y: 0.30, rot: 14 },
  { id: "ghost",  src: `${NOTO}/emoji_u1f47b.png`, x: 0.30, y: 0.72, rot: -3 },
  { id: "star",   src: `${NOTO}/emoji_u2b50.png`,  x: 0.62, y: 0.74, rot: 11 },
  { id: "moon",   src: `${NOTO}/emoji_u1f319.png`, x: 0.82, y: 0.58, rot: -16 },
];
