import { useState } from "react";
import { useControls, folder } from "leva";
import { Sticker } from "./Sticker";
import { PresetPanel } from "./PresetPanel";
import { STICKERS } from "./data";
import { House } from "./House";
import "./App.css";

function App() {
  if (window.location.pathname === "/house") return <House />;
  return <Demo />;
}

function Demo() {
  const [values, set] = useControls(() => ({
    Sticker: folder({
      size: { value: 170, min: 80, max: 300, step: 2 },
      outlineRadius: { value: 5, min: 1, max: 14, step: 0.5 },
      outlineSmooth: { value: 3, min: 0, max: 8, step: 0.25 },
    }),
    Peel: folder({
      peelDirection: { value: -45, min: -180, max: 180, step: 1 },
      peelHover: { value: 12, min: 0, max: 80, step: 0.5 },
      peelLifted: { value: 24, min: 0, max: 80, step: 0.5 },
    }),
    Lift: folder({
      hoverScale: { value: 1, min: 1, max: 1.2, step: 0.005 },
      liftScale: { value: 1.04, min: 1, max: 1.4, step: 0.005 },
    }),
    Shadow: folder({
      shadowRest: { value: 2, min: 0, max: 40, step: 0.5 },
      shadowHover: { value: 2, min: 0, max: 60, step: 0.5 },
      shadowLifted: { value: 16, min: 0, max: 80, step: 0.5 },
    }),
    Lighting: folder({
      lighting: { value: 0.18, min: 0, max: 1, step: 0.01 },
      curlShadow: { value: 0.4, min: 0, max: 1, step: 0.01 },
      curlShadowOffset: { value: 8, min: -20, max: 20, step: 0.5 },
      curlShadowBlur: { value: 30, min: 0, max: 100, step: 0.5 },
    }),
    Motion: folder({
      ease: {
        value: "cubic-bezier(0.22, 1, 0.36, 1)",
        options: {
          "out-expo": "cubic-bezier(0.22, 1, 0.36, 1)",
          "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
          "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
          "out-cubic": "cubic-bezier(0.33, 1, 0.68, 1)",
          "linear": "linear",
        },
      },
      durMs: { value: 360, min: 80, max: 1200, step: 10 },
      swayMax: { value: 18, min: 0, max: 60, step: 1 },
      swayGain: { value: 0.18, min: 0, max: 1, step: 0.01 },
    }),
  }));

  const [order, setOrder] = useState<string[]>(STICKERS.map((s) => s.id));
  const bringToFront = (id: string) =>
    setOrder((prev) => [...prev.filter((x) => x !== id), id]);

  return (
    <div className="stage">
      <svg className="svg-defs" aria-hidden>
        <defs>
          <filter id="sticker-outline" x="-25%" y="-25%" width="150%" height="150%">
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={values.outlineRadius}
              result="dilated"
            />
            <feGaussianBlur in="dilated" stdDeviation={values.outlineSmooth} result="soft" />
            <feComponentTransfer in="soft" result="rounded">
              <feFuncA type="linear" slope="8" intercept="-2.5" />
            </feComponentTransfer>
            <feFlood floodColor="#ffffff" result="white" />
            <feComposite in="white" in2="rounded" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sticker-back" x="-25%" y="-25%" width="150%" height="150%">
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={values.outlineRadius}
              result="dilated"
            />
            <feGaussianBlur in="dilated" stdDeviation={values.outlineSmooth} result="soft" />
            <feComponentTransfer in="soft" result="rounded">
              <feFuncA type="linear" slope="8" intercept="-2.5" />
            </feComponentTransfer>
            <feFlood floodColor="#ffffff" result="paper" />
            <feComposite in="paper" in2="rounded" operator="in" />
          </filter>
        </defs>
      </svg>

      <div className="title">peel · pick up · re-stick</div>

      {STICKERS.map((s) => (
        <Sticker
          key={s.id}
          def={s}
          knobs={values}
          z={order.indexOf(s.id) + 1}
          bringToFront={() => bringToFront(s.id)}
        />
      ))}

      <PresetPanel values={values} onLoad={(v) => set(v as never)} />
    </div>
  );
}

export default App;
