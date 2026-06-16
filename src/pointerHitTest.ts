// Single document-level pointer listener shared across all stickers.
// rAF-coalesces moves and short-circuits hit-tests on non-lifted
// stickers whenever any sticker is currently being dragged.

type Entry = {
  test: (clientX: number, clientY: number) => boolean;
  setOver: (over: boolean) => void;
  isLifted: () => boolean;
};

const registry = new Set<Entry>();
let queued = false;
let lastX = 0;
let lastY = 0;

const run = () => {
  queued = false;
  let anyLifted = false;
  for (const r of registry) {
    if (r.isLifted()) { anyLifted = true; break; }
  }
  for (const r of registry) {
    r.setOver(anyLifted ? r.isLifted() : r.test(lastX, lastY));
  }
};

const onMove = (e: PointerEvent) => {
  lastX = e.clientX;
  lastY = e.clientY;
  if (queued) return;
  queued = true;
  requestAnimationFrame(run);
};

export function registerHitTest(entry: Entry) {
  if (registry.size === 0) document.addEventListener("pointermove", onMove);
  registry.add(entry);
  return () => {
    registry.delete(entry);
    if (registry.size === 0) document.removeEventListener("pointermove", onMove);
  };
}
