export type StickerDef = {
  id: string;
  src: string;
  x: number;
  y: number;
  rot: number;
};

const NOTO = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/512";

export const STICKERS: StickerDef[] = [
  { id: "dog",        src: `${NOTO}/emoji_u1f436.png`, x: 0.14, y: 0.22, rot: -8 },
  { id: "cat",        src: `${NOTO}/emoji_u1f431.png`, x: 0.36, y: 0.58, rot:  6 },
  { id: "flower",     src: `${NOTO}/emoji_u1f338.png`, x: 0.62, y: 0.20, rot: 14 },
  { id: "ghost",      src: `${NOTO}/emoji_u1f47b.png`, x: 0.22, y: 0.74, rot: -3 },
  { id: "star",       src: `${NOTO}/emoji_u2b50.png`,  x: 0.50, y: 0.82, rot: 11 },
  { id: "moon",       src: `${NOTO}/emoji_u1f319.png`, x: 0.80, y: 0.46, rot: -16 },
  { id: "nunu-happy", src: "/nunu/happy.png",          x: 0.86, y: 0.78, rot:   4 },
  { id: "nunu-adm",   src: "/nunu/admiring.png",       x: 0.74, y: 0.70, rot: -12 },
  { id: "nunu-down",  src: "/nunu/down.png",           x: 0.46, y: 0.32, rot:   8 },
  { id: "nunu-sp",    src: "/nunu/speechless.png",     x: 0.66, y: 0.46, rot:  -5 },
];
