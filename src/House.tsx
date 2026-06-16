import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { usePeelOffset } from "./usePeelOffset";
import { useAlphaMap } from "./useAlphaMap";
import { useImageSize } from "./useImageSize";
import "./House.css";

const ITEMS = Array.from({ length: 12 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return { id: num, src: `/house/${num}.png` };
});

const TRAY_HEIGHT_PX = 56;
const WRAP_PAD = 50;
const PEEL_DIRECTION = -45;
const OUTLINE_RADIUS = 4;
const OUTLINE_SMOOTH = 2;
const SETTLE_SPRING = { type: "spring" as const, stiffness: 320, damping: 28 };

type ItemState = {
  id: string;
  src: string;
  zone: "tray" | "canvas";
  x: number;
  y: number;
  rot: number;
  z: number;
};

export function House() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const zCounter = useRef(20);

  useEffect(() => {
    const tray = trayRef.current;
    if (!tray) return;
    const rect = tray.getBoundingClientRect();
    const slotW = rect.width / ITEMS.length;
    setItems(
      ITEMS.map((it, i) => ({
        ...it,
        zone: "tray" as const,
        x: rect.left + slotW * (i + 0.5),
        y: rect.top + rect.height / 2,
        rot: 0,
        z: 10 + i,
      }))
    );
  }, []);

  const bringToFront = (id: string) => {
    zCounter.current += 1;
    const next = zCounter.current;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, z: next } : it)));
  };

  const handleDrop = (id: string, clientX: number, clientY: number) => {
    const tray = trayRef.current?.getBoundingClientRect();
    if (!tray) return;
    const overTray = clientY >= tray.top - 12;

    setItems((prev) => {
      if (overTray) {
        const slotW = tray.width / ITEMS.length;
        const idx = ITEMS.findIndex((it) => it.id === id);
        return prev.map((it) =>
          it.id === id
            ? {
                ...it,
                zone: "tray",
                x: tray.left + slotW * (idx + 0.5),
                y: tray.top + tray.height / 2,
                rot: 0,
              }
            : it
        );
      }
      return prev.map((it) =>
        it.id === id
          ? { ...it, zone: "canvas", x: clientX, y: clientY }
          : it
      );
    });
  };

  return (
    <div className="house-stage" ref={stageRef}>
      <a className="house-back-link" href="/">
        ← demo
      </a>

      <HouseDefs />

      <img src="/house/house-bg.png" className="house-bg" alt="" />

      {items.map((it) => (
        <HouseSticker
          key={it.id}
          item={it}
          onDrop={handleDrop}
          bringToFront={bringToFront}
        />
      ))}

      <div className="house-tray" ref={trayRef}>
        <div className="house-tray-rail" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HouseDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <filter
          id="house-outline"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
        >
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={OUTLINE_RADIUS}
            result="dilated"
          />
          <feGaussianBlur
            in="dilated"
            stdDeviation={OUTLINE_SMOOTH}
            result="soft"
          />
          <feComponentTransfer in="soft" result="rounded">
            <feFuncA type="linear" slope="8" intercept="-2.5" />
          </feComponentTransfer>
          <feFlood floodColor="#ffffff" result="white" />
          <feComposite
            in="white"
            in2="rounded"
            operator="in"
            result="outline"
          />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="house-back" x="-25%" y="-25%" width="150%" height="150%">
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={OUTLINE_RADIUS}
            result="dilated"
          />
          <feGaussianBlur
            in="dilated"
            stdDeviation={OUTLINE_SMOOTH}
            result="soft"
          />
          <feComponentTransfer in="soft" result="rounded">
            <feFuncA type="linear" slope="8" intercept="-2.5" />
          </feComponentTransfer>
          <feFlood floodColor="#ffffff" result="paper" />
          <feComposite in="paper" in2="rounded" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function HouseSticker({
  item,
  onDrop,
  bringToFront,
}: {
  item: ItemState;
  onDrop: (id: string, clientX: number, clientY: number) => void;
  bringToFront: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState(false);
  const liftedRef = useRef(lifted);
  liftedRef.current = lifted;
  const silhouetteOffset = usePeelOffset(item.src, PEEL_DIRECTION);
  const alphaMap = useAlphaMap(item.src);
  const natural = useImageSize(item.src);

  // World-space position motion values — directly drive translate.
  const posX = useMotionValue(item.x);
  const posY = useMotionValue(item.y);
  const rotation = useMotionValue(item.rot);

  const cursorOffset = useRef({ x: 0, y: 0 });
  const swayRef = useRef(0);

  // Animate to the canonical position whenever state updates and we're
  // not actively dragging.
  useEffect(() => {
    if (liftedRef.current) return;
    animate(posX, item.x, SETTLE_SPRING);
    animate(posY, item.y, SETTLE_SPRING);
    animate(rotation, item.rot, SETTLE_SPRING);
  }, [item.x, item.y, item.rot, posX, posY, rotation]);

  // Alpha hit-test against the silhouette + outline.
  useEffect(() => {
    if (!alphaMap) return;
    const el = wrapRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      if (liftedRef.current) {
        el.style.pointerEvents = "auto";
        return;
      }
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const theta = (-rotation.get() * Math.PI) / 180;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      const baseW = natural?.w ?? 100;
      const baseH = natural?.h ?? 100;
      const scale =
        item.zone === "canvas" ? 1 : TRAY_HEIGHT_PX / baseH;
      const w = baseW * scale;
      const h = baseH * scale;
      const nx = (lx + w / 2) / w;
      const ny = (ly + h / 2) / h;
      const sample = (px: number, py: number) => {
        if (px < 0 || px > 1 || py < 0 || py > 1) return 0;
        const ix = Math.floor(px * alphaMap.w);
        const iy = Math.floor(py * alphaMap.h);
        return alphaMap.data[(iy * alphaMap.w + ix) * 4 + 3];
      };
      const r = (OUTLINE_RADIUS + OUTLINE_SMOOTH) / Math.min(w, h);
      const d = r * 0.7071;
      const over =
        sample(nx, ny) > 30 ||
        sample(nx + r, ny) > 30 ||
        sample(nx - r, ny) > 30 ||
        sample(nx, ny + r) > 30 ||
        sample(nx, ny - r) > 30 ||
        sample(nx + d, ny + d) > 30 ||
        sample(nx - d, ny + d) > 30 ||
        sample(nx + d, ny - d) > 30 ||
        sample(nx - d, ny - d) > 30;
      el.style.pointerEvents = over ? "auto" : "none";
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [alphaMap, item.zone, rotation, natural]);

  const onPointerDown = (e: React.PointerEvent) => {
    bringToFront(item.id);
    cursorOffset.current = {
      x: e.clientX - posX.get(),
      y: e.clientY - posY.get(),
    };
    swayRef.current = rotation.get() - item.rot;
    setLifted(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!liftedRef.current) return;
    posX.set(e.clientX - cursorOffset.current.x);
    posY.set(e.clientY - cursorOffset.current.y);
    swayRef.current = Math.max(
      -14,
      Math.min(14, swayRef.current + e.movementX * 0.18)
    );
    animate(rotation, item.rot + swayRef.current, {
      duration: 0.08,
      ease: "easeOut",
    });
  };

  const finishDrag = (clientX: number, clientY: number) => {
    if (!liftedRef.current) return;
    setLifted(false);
    onDrop(item.id, clientX, clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    finishDrag(e.clientX, e.clientY);
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    finishDrag(e.clientX, e.clientY);
  };

  // Each item renders at its PNG's natural dimensions (canvas zone) or
  // scaled to a fixed tray height while preserving aspect ratio (tray
  // zone). Picking up a tray sticker (lifted=true) pops it to full size
  // before the cursor moves, regardless of zone.
  const atCanvasSize = lifted || item.zone === "canvas";
  const baseW = natural?.w ?? 100;
  const baseH = natural?.h ?? 100;
  const scale = atCanvasSize ? 1 : TRAY_HEIGHT_PX / baseH;
  const innerW = baseW * scale;
  const innerH = baseH * scale;
  const wrapW = innerW + WRAP_PAD * 2;
  const wrapH = innerH + WRAP_PAD * 2;
  const outlinePct =
    ((OUTLINE_RADIUS + OUTLINE_SMOOTH) / Math.min(innerW, innerH)) * 100;
  const peelAnchor =
    silhouetteOffset != null ? silhouetteOffset - outlinePct : -10;

  const styleVars: CSSProperties & Record<string, string | number> = {
    width: wrapW,
    height: wrapH,
    left: -wrapW / 2,
    top: -wrapH / 2,
    "--inner-w": `${innerW}px`,
    "--inner-h": `${innerH}px`,
    "--inner-pad-x": `${WRAP_PAD}px`,
    "--inner-pad-y": `${WRAP_PAD}px`,
    "--peel-direction": `${PEEL_DIRECTION}deg`,
    "--peel-offset": `${peelAnchor}%`,
    "--peel-hover": "16%",
    "--peel-lifted": "28%",
    "--dur": "320ms",
    "--ease": "cubic-bezier(0.22, 1, 0.36, 1)",
    "--shadow-rest": "drop-shadow(0 1px 3px rgba(0,0,0,0.12))",
    "--shadow-hover": "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
    "--shadow-lifted": "drop-shadow(0 8px 18px rgba(0,0,0,0.2))",
  };

  return (
    <motion.div
      ref={wrapRef}
      className={`house-sticker-wrap${lifted ? " is-lifted" : ""}`}
      style={{
        ...styleVars,
        zIndex: lifted ? 9999 : item.z,
        x: posX,
        y: posY,
        rotate: rotation,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="house-sticker-container">
        <div className="house-sticker-main">
          <img
            src={item.src}
            className="house-sticker-image"
            alt=""
            draggable={false}
          />
        </div>
        <div className="house-flap">
          <img
            src={item.src}
            className="house-flap-image"
            alt=""
            draggable={false}
          />
        </div>
      </div>
    </motion.div>
  );
}
