import { useState, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import type { StickerDef } from "./data";
import { usePeelOffset } from "./usePeelOffset";
import { useAlphaMap } from "./useAlphaMap";
import { registerHitTest } from "./pointerHitTest";

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
  shadowBlurRest: number;
  shadowBlurHover: number;
  shadowBlurLifted: number;
  ease: string;
  durMs: number;
  swayMax: number;
  swayGain: number;
  curlShadowHover: number;
  curlShadowLifted: number;
  curlShadowOffset: number;
  curlShadowBlur: number;
  outlineSmooth: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const layeredShadow = (
  n: number,
  cy: number, cb: number, ca: number,
  ay: number, ab: number, aa: number,
  blurScale: number = 1,
) =>
  `drop-shadow(${n * cy * 0.6}px ${n * cy}px ${n * cb * blurScale}px rgba(60,38,20,${ca})) ` +
  `drop-shadow(${n * ay * 0.6}px ${n * ay}px ${n * ab * blurScale}px rgba(60,38,20,${aa}))`;

// Project a client-space point into the sticker's upright local frame.
// Returns coords relative to the wrap's center, un-rotated by the wrap's
// current rotation — same math both the shine tracker and hit-test need.
const toLocal = (
  el: HTMLElement,
  clientX: number,
  clientY: number,
  rotationDeg: number,
) => {
  const rect = el.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const theta = (-rotationDeg * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { lx: dx * c - dy * s, ly: dx * s + dy * c };
};

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
    const move = (e: PointerEvent) => {
      const { lx: localDx, ly: localDy } = toLocal(el, e.clientX, e.clientY, rotation.get());
      const lx = localDx + knobs.size / 2;
      const ly = localDy + knobs.size / 2;
      const front = (50 * (lx + ly)) / knobs.size;
      // Flap content is scaleY(-1)-flipped, so mirror y for the back band.
      const back = (50 * (lx + (knobs.size - ly))) / knobs.size;
      shineRef.current?.style.setProperty("--shine-pos", `${front}%`);
      flapShineRef.current?.style.setProperty("--shine-pos", `${back}%`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [knobs.size, rotation]);

  // Silhouette-based hit testing — sample the PNG's alpha at the cursor's
  // image-local position and toggle pointer-events so :hover/click only
  // fire when the cursor is actually over the sticker, not the wrap bbox.
  useEffect(() => {
    if (!alphaMap) return;
    const el = wrapRef.current;
    if (!el) return;

    return registerHitTest({
      isLifted: () => liftedRef.current,
      setOver: (over) => {
        el.style.pointerEvents = over ? "auto" : "none";
      },
      test: (clientX, clientY) => {
        const { lx: localDx, ly: localDy } = toLocal(el, clientX, clientY, rotation.get());
        const nx = (localDx + knobs.size / 2) / knobs.size;
        const ny = (localDy + knobs.size / 2) / knobs.size;

        const sample = (x: number, y: number) => {
          if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
          const px = Math.floor(x * alphaMap.w);
          const py = Math.floor(y * alphaMap.h);
          return alphaMap.data[(py * alphaMap.w + px) * 4 + 3];
        };

        // 8-point ring sample at the outline radius approximates the
        // dilated silhouette so the halo is also hit-testable.
        const r = (knobs.outlineRadius + knobs.outlineSmooth) / knobs.size;
        const d = r * 0.7071;
        return (
          sample(nx, ny) > 30 ||
          (r > 0 &&
            (sample(nx + r, ny) > 30 ||
              sample(nx - r, ny) > 30 ||
              sample(nx, ny + r) > 30 ||
              sample(nx, ny - r) > 30 ||
              sample(nx + d, ny + d) > 30 ||
              sample(nx - d, ny + d) > 30 ||
              sample(nx + d, ny - d) > 30 ||
              sample(nx - d, ny - d) > 30))
        );
      },
    });
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
    // Tight contact shadow + soft ambient, tinted cool slate so it reads as scene light, not flat black.
    "--shadow-rest": layeredShadow(knobs.shadowRest, 0.15, 0.35, 0.1, 0.6, 2.2, 0.06, knobs.shadowBlurRest),
    "--shadow-hover": layeredShadow(knobs.shadowHover, 0.18, 0.4, 0.12, 0.7, 2.4, 0.08, knobs.shadowBlurHover),
    "--shadow-lifted": layeredShadow(knobs.shadowLifted, 0.12, 0.28, 0.14, 0.55, 2.0, 0.12, knobs.shadowBlurLifted),
  };

  // Memoize the mask style so the shine layers don't get a new object
  // every render (preserves React's style-diff bail-out).
  const maskStyle = useMemo<CSSProperties>(
    () => ({
      WebkitMaskImage: `url("${def.src}")`,
      maskImage: `url("${def.src}")`,
    }),
    [def.src],
  );

  // Animate curl-shadow opacity between hover/lifted targets so the
  // transition is smooth instead of a hard filter swap.
  const [curlOpacity, setCurlOpacity] = useState(knobs.curlShadowHover);
  useEffect(() => {
    const target = lifted ? knobs.curlShadowLifted : knobs.curlShadowHover;
    const controls = animate(curlOpacity, target, {
      duration: knobs.durMs / 1000,
      ease: "easeOut",
      onUpdate: (v) => setCurlOpacity(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifted, knobs.curlShadowHover, knobs.curlShadowLifted, knobs.durMs]);

  const curlFilterSvg = (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        {/* Outputs ONLY the shadow — no SourceGraphic merge — so the
            source silhouette never paints and the mask can extend past
            the peel area without revealing white. */}
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
          <feFlood floodColor="black" floodOpacity={curlOpacity} />
          <feComposite in2="offset" operator="in" />
        </filter>
      </defs>
    </svg>
  );

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
      {curlFilterSvg}

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
              style={maskStyle}
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
              style={maskStyle}
            >
              <div className="sticker-shine-streak" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
