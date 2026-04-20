import { useEffect, useRef, useState, type PointerEventHandler } from "react";
import remFloatImg from "@assets/rem-main-fullbody.png";
import remGifImg from "@assets/rem-rezero.gif";
import remEyesImg from "@assets/rem-eyes-default.png";
import RemEyes from "@/components/RemEyes";
import { useTheme } from "@/hooks/use-theme";

const FLAKES = [
  { id: 0,  left: "4%",  size: 11, dur: 8,  delay: 0,    op: 0.35 },
  { id: 1,  left: "11%", size: 7,  dur: 6,  delay: -2.1, op: 0.2  },
  { id: 2,  left: "19%", size: 15, dur: 10, delay: -5,   op: 0.3  },
  { id: 3,  left: "27%", size: 9,  dur: 7,  delay: -1.3, op: 0.25 },
  { id: 4,  left: "35%", size: 13, dur: 9,  delay: -3.8, op: 0.4  },
  { id: 5,  left: "43%", size: 8,  dur: 6.5,delay: -0.7, op: 0.18 },
  { id: 6,  left: "51%", size: 17, dur: 11, delay: -4.2, op: 0.35 },
  { id: 7,  left: "59%", size: 10, dur: 7.5,delay: -2.9, op: 0.25 },
  { id: 8,  left: "67%", size: 12, dur: 8.5,delay: -1.5, op: 0.3  },
  { id: 9,  left: "74%", size: 7,  dur: 6,  delay: -3.3, op: 0.2  },
  { id: 10, left: "81%", size: 14, dur: 9.5,delay: -0.4, op: 0.35 },
  { id: 11, left: "88%", size: 9,  dur: 7,  delay: -2.6, op: 0.25 },
  { id: 12, left: "94%", size: 11, dur: 8,  delay: -4.7, op: 0.3  },
  { id: 13, left: "7%",  size: 6,  dur: 5.5,delay: -1.8, op: 0.18 },
  { id: 14, left: "48%", size: 19, dur: 12, delay: -6.1, op: 0.45 },
  { id: 15, left: "62%", size: 8,  dur: 6.5,delay: -3.5, op: 0.22 },
];

type WidgetKey = "rem-gif" | "rem-eyes" | "rem-main" | "rem-customize-panel";
type RemSizeMode = "small" | "normal";

interface RemCustomization {
  showGif: boolean;
  showEyes: boolean;
  showCharacter: boolean;
  showSnow: boolean;
  draggable: boolean;
  sizeMode: RemSizeMode;
}

const REM_CUSTOMIZE_KEY = "anicircle-rem-customization";
const DEFAULT_REM_CUSTOMIZATION: RemCustomization = {
  showGif: true,
  showEyes: true,
  showCharacter: true,
  showSnow: true,
  draggable: true,
  sizeMode: "normal",
};

function getDefaultPosition(key: WidgetKey, width: number, height: number) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  switch (key) {
    case "rem-gif":
      return { x: vw - width - 20, y: 92 };
    case "rem-eyes":
      return { x: 20, y: vh - height - 28 };
    case "rem-main":
      return { x: vw - width - 14, y: vh - height - 8 };
    case "rem-customize-panel":
      return { x: 20, y: 18 };
    default:
      return { x: 20, y: 20 };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readRemCustomization(): RemCustomization {
  try {
    const raw = localStorage.getItem(REM_CUSTOMIZE_KEY);
    if (!raw) return DEFAULT_REM_CUSTOMIZATION;
    const parsed = JSON.parse(raw) as Partial<RemCustomization>;
    return {
      showGif: parsed.showGif ?? true,
      showEyes: parsed.showEyes ?? true,
      showCharacter: parsed.showCharacter ?? true,
      showSnow: parsed.showSnow ?? true,
      draggable: parsed.draggable ?? true,
      sizeMode: parsed.sizeMode === "small" ? "small" : "normal",
    };
  } catch {
    return DEFAULT_REM_CUSTOMIZATION;
  }
}

function useDraggablePosition(
  key: WidgetKey,
  width: number,
  height: number,
) {
  const storageKey = `anicircle-rem-pos-${key}`;
  const getInitial = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        return {
          x: clamp(parsed.x, 0, Math.max(window.innerWidth - width, 0)),
          y: clamp(parsed.y, 0, Math.max(window.innerHeight - height, 0)),
        };
      }
    } catch {
      // ignore invalid cache and fall through
    }
    const def = getDefaultPosition(key, width, height);
    return {
      x: clamp(def.x, 0, Math.max(window.innerWidth - width, 0)),
      y: clamp(def.y, 0, Math.max(window.innerHeight - height, 0)),
    };
  };

  const [pos, setPos] = useState(getInitial);
  const resetToDefault = () => {
    const def = getDefaultPosition(key, width, height);
    const next = {
      x: clamp(def.x, 0, Math.max(window.innerWidth - width, 0)),
      y: clamp(def.y, 0, Math.max(window.innerHeight - height, 0)),
    };
    setPos(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const onReset = () => resetToDefault();
    window.addEventListener("rem-reset-layout", onReset);
    return () => window.removeEventListener("rem-reset-layout", onReset);
  }, [key, width, height]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      // ignore write failures
    }
  }, [pos, storageKey]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => ({
        x: clamp(current.x, 0, Math.max(window.innerWidth - width, 0)),
        y: clamp(current.y, 0, Math.max(window.innerHeight - height, 0)),
      }));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width, height]);

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    dragStart.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
    if (!dragStart.current) return;
    const x = clamp(event.clientX - dragStart.current.dx, 0, Math.max(window.innerWidth - width, 0));
    const y = clamp(event.clientY - dragStart.current.dy, 0, Math.max(window.innerHeight - height, 0));
    setPos({ x, y });
  };

  const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    dragStart.current = null;
  };

  const onPointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    dragStart.current = null;
  };

  return { pos, isDragging, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, resetToDefault };
}

function saveRemCustomization(next: RemCustomization) {
  localStorage.setItem(REM_CUSTOMIZE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("rem-customize-change"));
}

export default function RemEffects() {
  const { theme } = useTheme();
  const [customize, setCustomize] = useState<RemCustomization>(() => readRemCustomization());
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const gifWidget = useDraggablePosition("rem-gif", 122, 96);
  const eyesWidget = useDraggablePosition("rem-eyes", 124, 88);
  const mainWidget = useDraggablePosition("rem-main", 180, 220);
  const customizeButton = useDraggablePosition("rem-customize-panel", 44, 44);

  useEffect(() => {
    const refresh = () => setCustomize(readRemCustomization());
    window.addEventListener("rem-customize-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rem-customize-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (theme.name !== "Rem") return null;
  const scale = customize.sizeMode === "small" ? 0.82 : 1;
  const mainWidth = 180 * scale;
  const gifWidth = 122 * scale;
  const eyesWidth = 124 * scale;

  return (
    <>
      {/* ── Floating snowflakes ── */}
      {customize.showSnow && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
          {FLAKES.map((f) => (
            <div
              key={f.id}
              className="absolute select-none"
              style={{
                left: f.left,
                top: "-30px",
                fontSize: `${Math.round(f.size * scale)}px`,
                color: "#93c5fd",
                opacity: f.op,
                animation: `rem-snowfall ${f.dur}s linear ${f.delay}s infinite`,
                filter: `drop-shadow(0 0 ${Math.round(f.size * 0.35)}px rgba(147,197,253,0.65))`,
              }}
            >
              ❄
            </div>
          ))}
        </div>
      )}

      {/* On-screen rem customize: small draggable button + popup */}
      <div
        className="fixed select-none"
        style={{
          top: `${customizeButton.pos.y}px`,
          left: `${customizeButton.pos.x}px`,
          zIndex: 60,
        }}
      >
        <button
          type="button"
          title="Customize Rem"
          onPointerDown={customizeButton.onPointerDown}
          onPointerMove={customizeButton.onPointerMove}
          onPointerUp={customizeButton.onPointerUp}
          onPointerCancel={customizeButton.onPointerCancel}
          onClick={() => setIsCustomizeOpen((v) => !v)}
          className="w-11 h-11 rounded-full border border-sky-200/45 bg-slate-900/75 text-sky-100 text-lg shadow-[0_0_16px_rgba(80,140,255,0.3)] cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          ❄
        </button>

        {isCustomizeOpen && (
          <div
            className="absolute top-0 left-12 w-[220px] p-2 border border-sky-200/35 bg-slate-950/85 shadow-[0_0_16px_rgba(80,140,255,0.25)]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-sky-200/90">Customize Rem</div>
              <button
                type="button"
                className="text-[10px] text-sky-100/80 border border-sky-200/25 px-1.5 py-0.5"
                onClick={() => setIsCustomizeOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className="text-[10px] py-1 border border-sky-200/30 text-sky-100/90"
                onClick={() => {
                  saveRemCustomization(DEFAULT_REM_CUSTOMIZATION);
                  window.dispatchEvent(new Event("rem-reset-layout"));
                }}
              >
                Default
              </button>
              <button
                type="button"
                className="text-[10px] py-1 border border-sky-200/30 text-sky-100/90"
                onClick={() => {
                  saveRemCustomization({
                    ...DEFAULT_REM_CUSTOMIZATION,
                    showGif: false,
                    showEyes: false,
                    sizeMode: "small",
                  });
                  window.dispatchEvent(new Event("rem-reset-layout"));
                }}
              >
                Minimal
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px] text-sky-100/90">
              {[
                { key: "showCharacter", label: "Rem" },
                { key: "showGif", label: "GIF" },
                { key: "showEyes", label: "Eyes" },
                { key: "showSnow", label: "Snow" },
                { key: "draggable", label: "Draggable" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={customize[item.key as keyof RemCustomization] as boolean}
                    onChange={(event) => {
                      saveRemCustomization({
                        ...customize,
                        [item.key]: event.target.checked,
                      } as RemCustomization);
                    }}
                  />
                  {item.label}
                </label>
              ))}
              <label className="flex items-center gap-1.5 col-span-2">
                <span>Small Size</span>
                <input
                  type="checkbox"
                  checked={customize.sizeMode === "small"}
                  onChange={(event) => {
                    saveRemCustomization({
                      ...customize,
                      sizeMode: event.target.checked ? "small" : "normal",
                    });
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating full-body Rem — draggable ── */}
      {customize.showCharacter && (
        <div
          className="fixed select-none"
          onPointerDown={customize.draggable ? mainWidget.onPointerDown : undefined}
          onPointerMove={customize.draggable ? mainWidget.onPointerMove : undefined}
          onPointerUp={customize.draggable ? mainWidget.onPointerUp : undefined}
          onPointerCancel={customize.draggable ? mainWidget.onPointerCancel : undefined}
          style={{
            top: `${mainWidget.pos.y}px`,
            left: `${mainWidget.pos.x}px`,
            zIndex: 34,
            animation: mainWidget.isDragging ? undefined : "rem-float 4.8s ease-in-out infinite",
            opacity: 0.9,
            touchAction: "none",
            filter: "drop-shadow(0 8px 24px rgba(80,140,255,0.45)) drop-shadow(0 0 12px rgba(147,197,253,0.25))",
          }}
        >
          <img
            src={remFloatImg}
            alt="Rem"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{
              width: `${mainWidth}px`,
              height: "auto",
              display: "block",
              cursor: customize.draggable ? "grab" : "default",
              userSelect: "none",
            }}
          />
        </div>
      )}

      {/* Animated Rem bubble — draggable */}
      {customize.showGif && (
        <div
          className="fixed select-none"
          onPointerDown={customize.draggable ? gifWidget.onPointerDown : undefined}
          onPointerMove={customize.draggable ? gifWidget.onPointerMove : undefined}
          onPointerUp={customize.draggable ? gifWidget.onPointerUp : undefined}
          onPointerCancel={customize.draggable ? gifWidget.onPointerCancel : undefined}
          style={{
            top: `${gifWidget.pos.y}px`,
            left: `${gifWidget.pos.x}px`,
            zIndex: 22,
            width: `${gifWidth}px`,
            padding: "6px",
            border: "1px solid rgba(147,197,253,0.32)",
            background: "rgba(8,20,46,0.55)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 16px rgba(80,140,255,0.22)",
            touchAction: "none",
          }}
        >
          <img
            src={remGifImg}
            alt="Rem animation"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              border: "1px solid rgba(147,197,253,0.2)",
              opacity: 1,
              filter: "contrast(1.02) saturate(1.02)",
              cursor: customize.draggable ? "grab" : "default",
              userSelect: "none",
            }}
          />
        </div>
      )}

      {/* Cursor-follow eyes badge — draggable */}
      {customize.showEyes && (
        <div
          className="fixed select-none"
          onPointerDown={customize.draggable ? eyesWidget.onPointerDown : undefined}
          onPointerMove={customize.draggable ? eyesWidget.onPointerMove : undefined}
          onPointerUp={customize.draggable ? eyesWidget.onPointerUp : undefined}
          onPointerCancel={customize.draggable ? eyesWidget.onPointerCancel : undefined}
          style={{
            top: `${eyesWidget.pos.y}px`,
            left: `${eyesWidget.pos.x}px`,
            zIndex: 24,
            width: `${eyesWidth}px`,
            padding: "6px",
            border: "1px solid rgba(147,197,253,0.3)",
            background: "rgba(6,18,40,0.5)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 14px rgba(80,140,255,0.18)",
            touchAction: "none",
            cursor: customize.draggable ? "grab" : "default",
          }}
        >
          <RemEyes imageSrc={remEyesImg} maxOffset={2.2} />
        </div>
      )}

      <style>{`
        @keyframes rem-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </>
  );
}
