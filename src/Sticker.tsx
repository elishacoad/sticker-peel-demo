import { useState, useRef, useEffect, type CSSProperties } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import type { StickerDef } from "./data";
import { usePeelOffset } from "./usePeelOffset";
import { useAlphaMap } from "./useAlphaMap";

type Knobs = {
  size: number;
  outlineRadius: number;
  peelHover: number;
  peelLifted: number;
  liftScale: number;
  hoverScale: number;
  peelDirection: number;
  lighting: number;
  shadowRest: number;
  shadowHover: number;
  shadowLifted: number;
  ease: string;
  durMs: number;
  swayMax: number;
  swayGain: number;
  curlShadow: number;
  curlShadowOffset: number;
  curlShadowBlur: number;
  outlineSmooth: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function Sticker({
  def,
  knobs,
  bringToFront,
  z,
}: {
  def: StickerDef;
  knobs: Knobs;
  bringToFront: () => void;
  z: number;
}) {
  const [lifted, setLifted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const silhouetteOffset = usePeelOffset(def.src, knobs.peelDirection);
  const alphaMap = useAlphaMap(def.src);
  const liftedRef = useRef(lifted);
  liftedRef.current = lifted;
  const shineRef = useRef<HTMLDivElement>(null);
  const flapShineRef = useRef<HTMLDivElement>(null);

  const rotation = useMotionValue(def.rot);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Sway accumulates across the drag instead of mirroring instantaneous
  // velocity, so the sticker holds its tilted orientation when released
  // instead of snapping back. Bounded by swayMax so it can't spin away.
  const swayRef = useRef(0);

  const onDragStart = () => {
    swayRef.current = rotation.get() - def.rot;
  };
  const onDrag = (_: PointerEvent, info: PanInfo) => {
    swayRef.current = clamp(
      swayRef.current + info.delta.x * knobs.swayGain,
      -knobs.swayMax,
      knobs.swayMax
    );
    animate(rotation, def.rot + swayRef.current, {
      duration: 0.09,
      ease: "easeOut",
    });
  };
  const onDragEnd = () => {
    // Lock at the current sway — no momentum, no spring-back. The
    // sticker stays exactly where you let go of it.
    rotation.set(def.rot + swayRef.current);
  };

  // Slide the shine band along the streak's perpendicular axis as the
  // cursor moves. Projecting the cursor onto the 135° gradient direction
  // gives a 0-100% position; the CSS gradient stops use this as a CSS
  // var so the bright band tracks under the cursor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const theta = (-rotation.get() * Math.PI) / 180;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const localDx = dx * c - dy * s;
      const localDy = dx * s + dy * c;
      const lx = localDx + knobs.size / 2;
      const ly = localDy + knobs.size / 2;
      const front = (50 * (lx + ly)) / knobs.size;
      // Flap content is scaleY(-1)-flipped, so its image-local y is
      // mirrored relative to the front. Project with mirrored y so the
      // band on the back tracks the same visual cursor position.
      const back = (50 * (lx + (knobs.size - ly))) / knobs.size;
      shineRef.current?.style.setProperty("--shine-pos", `${front}%`);
      flapShineRef.current?.style.setProperty("--shine-pos", `${back}%`);
    };
    el.addEventListener("mousemove", move);
    return () => el.removeEventListener("mousemove", move);
  }, [knobs.size, rotation]);

  // Silhouette-based hit testing — sample the PNG's alpha at the cursor's
  // image-local position and toggle pointer-events so :hover/click only
  // fire when the cursor is actually over the sticker, not the wrap bbox.
  useEffect(() => {
    if (!alphaMap) return;
    const el = wrapRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      // While dragging, keep events live regardless of cursor position
      // so a flick doesn't cause the wrap to drop the pointer mid-drag.
      if (liftedRef.current) {
        el.style.pointerEvents = "auto";
        return;
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // un-rotate by wrap's current rotation to land in the upright
      // image's local coord frame
      const theta = (-rotation.get() * Math.PI) / 180;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const localDx = dx * c - dy * s;
      const localDy = dx * s + dy * c;

      const nx = (localDx + knobs.size / 2) / knobs.size;
      const ny = (localDy + knobs.size / 2) / knobs.size;

      const sample = (x: number, y: number) => {
        if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
        const px = Math.floor(x * alphaMap.w);
        const py = Math.floor(y * alphaMap.h);
        return alphaMap.data[(py * alphaMap.w + px) * 4 + 3];
      };

      // Hit-test against the silhouette plus the white outline halo. We
      // approximate the dilated alpha by sampling 8 points around the
      // cursor at the outline radius (in normalised image coords) — if
      // ANY of them is opaque, the cursor is over the outline ring.
      const r = (knobs.outlineRadius + knobs.outlineSmooth) / knobs.size;
      const d = r * 0.7071; // sqrt(2)/2 for diagonals
      const over =
        sample(nx, ny) > 30 ||
        (r > 0 &&
          (sample(nx + r, ny) > 30 ||
            sample(nx - r, ny) > 30 ||
            sample(nx, ny + r) > 30 ||
            sample(nx, ny - r) > 30 ||
            sample(nx + d, ny + d) > 30 ||
            sample(nx - d, ny + d) > 30 ||
            sample(nx + d, ny - d) > 30 ||
            sample(nx - d, ny - d) > 30));
      el.style.pointerEvents = over ? "auto" : "none";
    };

    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [
    alphaMap,
    knobs.size,
    knobs.outlineRadius,
    knobs.outlineSmooth,
    rotation,
  ]);

  // Anchor the clip-path at the silhouette top minus the outline width,
  // so at rest the clip touches the outline edge (cuts nothing visible).
  // While silhouetteOffset is still loading, fall back to -10% so peel
  // doesn't snap when it arrives.
  const outlinePct =
    ((knobs.outlineRadius + knobs.outlineSmooth) / knobs.size) * 100;
  const peelAnchor =
    silhouetteOffset != null ? silhouetteOffset - outlinePct : -10;

  // Wrap is larger than the visible sticker so the rotated container +
  // outline halo fit inside the wrap's layout box — otherwise the CSS
  // drop-shadow filter's region clips content that sticks out past the
  // wrap's bbox (manifests as straight-line cuts on the outline).
  const wrapSize = knobs.size * 1.8;
  const pad = (wrapSize - knobs.size) / 2;

  const styleVars: CSSProperties & Record<string, string | number> = {
    left: `calc(${def.x * 100}% - ${wrapSize / 2}px)`,
    top: `calc(${def.y * 100}% - ${wrapSize / 2}px)`,
    width: wrapSize,
    height: wrapSize,
    zIndex: z,
    "--inner-size": `${knobs.size}px`,
    "--inner-pad": `${pad}px`,
    "--peel-direction": `${knobs.peelDirection}deg`,
    "--peel-offset": `${peelAnchor}%`,
    "--peel-hover": `${knobs.peelHover}%`,
    "--peel-lifted": `${knobs.peelLifted}%`,
    "--hover-scale": knobs.hoverScale,
    "--lift-scale": knobs.liftScale,
    "--ease": knobs.ease,
    "--dur": `${knobs.durMs}ms`,
    "--shadow-rest": `drop-shadow(0 ${knobs.shadowRest * 0.4}px ${knobs.shadowRest * 1.8}px rgba(0,0,0,0.08))`,
    "--shadow-hover": `drop-shadow(0 ${knobs.shadowHover * 0.45}px ${knobs.shadowHover * 1.8}px rgba(0,0,0,0.11))`,
    "--shadow-lifted": `drop-shadow(0 ${knobs.shadowLifted * 0.5}px ${knobs.shadowLifted * 1.8}px rgba(0,0,0,0.18))`,
  };

  return (
    <motion.div
      ref={wrapRef}
      className={`sticker-wrap${lifted ? " is-lifted" : ""}`}
      style={{ ...styleVars, x, y, rotate: rotation }}
      drag
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={() => {
        bringToFront();
        setLifted(true);
      }}
      onPointerUp={() => setLifted(false)}
      onPointerCancel={() => setLifted(false)}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <svg
        width="0"
        height="0"
        style={{ position: "absolute", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          {/* Outputs ONLY the shadow — does not merge SourceGraphic, so the
              source's white silhouette never paints. That lets us extend
              the mask past the peel area without revealing white outside
              the visible peel, which is what kills the hard cut edge. */}
          <filter
            id={`curl-shadow-${def.id}`}
            filterUnits="objectBoundingBox"
            x="-1"
            y="-1"
            width="3"
            height="3"
          >
            <feGaussianBlur
              in="SourceAlpha"
              stdDeviation={knobs.curlShadowBlur / 2}
              result="blur"
            />
            <feOffset in="blur" dy={knobs.curlShadowOffset} result="offset" />
            <feFlood floodColor="black" floodOpacity={knobs.curlShadow} />
            <feComposite in2="offset" operator="in" />
          </filter>
        </defs>
      </svg>

      <div className="sticker-container">
        <div className="sticker-main">
          <div className="sticker-light">
            <img
              src={def.src}
              className="sticker-image"
              alt=""
              draggable={false}
            />
            <div
              ref={shineRef}
              className="sticker-shine"
              style={{
                WebkitMaskImage: `url("${def.src}")`,
                maskImage: `url("${def.src}")`,
              }}
            >
              <div className="sticker-shine-streak" />
            </div>
          </div>
        </div>
        <div
          className="curl-shadow-canvas"
          style={{ filter: `url(#curl-shadow-${def.id})` }}
        >
          <div className="curl-shadow-inner">
            <div className="flap-shadow-source">
              <img
                src={def.src}
                className="flap-image-shadow"
                alt=""
                draggable={false}
              />
            </div>
          </div>
        </div>
        <div className="flap">
          <div className="flap-light">
            <img
              src={def.src}
              className="flap-image"
              alt=""
              draggable={false}
            />
            <div
              ref={flapShineRef}
              className="sticker-shine"
              style={{
                WebkitMaskImage: `url("${def.src}")`,
                maskImage: `url("${def.src}")`,
              }}
            >
              <div className="sticker-shine-streak" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
