import { useState } from "react";
import { X } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const REM_IMAGE = "https://static.wikia.nocookie.net/rezero/images/4/4f/Rem_Anime.png";

const FLAKES = [
  { id: 0,  left: "4%",  size: 12, dur: 8,  delay: 0,    op: 0.4 },
  { id: 1,  left: "11%", size: 8,  dur: 6,  delay: -2.1, op: 0.25 },
  { id: 2,  left: "19%", size: 16, dur: 10, delay: -5,   op: 0.35 },
  { id: 3,  left: "27%", size: 10, dur: 7,  delay: -1.3, op: 0.3  },
  { id: 4,  left: "35%", size: 14, dur: 9,  delay: -3.8, op: 0.45 },
  { id: 5,  left: "43%", size: 9,  dur: 6.5,delay: -0.7, op: 0.2  },
  { id: 6,  left: "51%", size: 18, dur: 11, delay: -4.2, op: 0.4  },
  { id: 7,  left: "59%", size: 11, dur: 7.5,delay: -2.9, op: 0.3  },
  { id: 8,  left: "67%", size: 13, dur: 8.5,delay: -1.5, op: 0.35 },
  { id: 9,  left: "74%", size: 8,  dur: 6,  delay: -3.3, op: 0.25 },
  { id: 10, left: "81%", size: 15, dur: 9.5,delay: -0.4, op: 0.4  },
  { id: 11, left: "88%", size: 10, dur: 7,  delay: -2.6, op: 0.3  },
  { id: 12, left: "94%", size: 12, dur: 8,  delay: -4.7, op: 0.35 },
  { id: 13, left: "7%",  size: 7,  dur: 5.5,delay: -1.8, op: 0.2  },
  { id: 14, left: "48%", size: 20, dur: 12, delay: -6.1, op: 0.5  },
  { id: 15, left: "62%", size: 9,  dur: 6.5,delay: -3.5, op: 0.28 },
];

export default function RemEffects() {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (theme.name !== "Rem") return null;

  return (
    <>
      {/* ── Floating snowflakes ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        {FLAKES.map((f) => (
          <div
            key={f.id}
            className="absolute select-none"
            style={{
              left: f.left,
              top: "-30px",
              fontSize: `${f.size}px`,
              color: "#93c5fd",
              opacity: f.op,
              animation: `rem-snowfall ${f.dur}s linear ${f.delay}s infinite`,
              filter: `drop-shadow(0 0 ${f.size * 0.4}px rgba(147,197,253,0.7))`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* ── Rem portrait card (bottom-right) ── */}
      {!dismissed && (
        <div
          className="fixed bottom-6 right-6 flex flex-col overflow-hidden animate-scale-in"
          style={{
            width: "154px",
            zIndex: 45,
            background: "rgba(4, 12, 30, 0.94)",
            border: "1px solid rgba(100,160,255,0.38)",
            boxShadow: [
              "0 0 0 1px rgba(100,160,255,0.10)",
              "0 0 30px rgba(80,140,255,0.22)",
              "0 0 60px rgba(80,140,255,0.10)",
              "0 10px 40px rgba(0,0,0,0.7)",
              "inset 0 1px 0 rgba(120,180,255,0.12)",
            ].join(", "),
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-1.5 right-1.5 z-20 w-5 h-5 flex items-center justify-center transition-colors"
            style={{ color: "rgba(147,197,253,0.5)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(147,197,253,0.9)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(147,197,253,0.5)")}
          >
            <X className="w-3 h-3" />
          </button>

          {/* Image */}
          <div className="relative overflow-hidden" style={{ height: "190px" }}>
            {!imgError ? (
              <img
                src={REM_IMAGE}
                alt="Rem"
                className="w-full h-full object-cover"
                style={{ objectPosition: "top center" }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(30,58,138,0.6), rgba(29,78,216,0.3))" }}>
                <span className="text-5xl">💙</span>
              </div>
            )}
            {/* Bottom fade */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to bottom, transparent 40%, rgba(4,12,30,0.95) 100%)"
            }} />
            {/* Top Re:Zero label */}
            <div className="absolute top-2 left-0 right-0 flex justify-center">
              <span className="text-[8px] tracking-[0.25em] uppercase px-2 py-0.5 font-semibold"
                style={{ color: "rgba(147,197,253,0.55)", background: "rgba(4,12,30,0.55)", backdropFilter: "blur(4px)" }}>
                Re:Zero
              </span>
            </div>
          </div>

          {/* Info section */}
          <div className="px-3 pb-3 pt-1 text-center space-y-1">
            <p className="text-sm font-black tracking-[0.18em] uppercase"
              style={{ color: "#93c5fd", textShadow: "0 0 12px rgba(147,197,253,0.6)" }}>
              REM
            </p>
            <div className="w-8 h-px mx-auto" style={{ background: "rgba(147,197,253,0.3)" }} />
            <p className="text-[9px] leading-relaxed font-light italic"
              style={{ color: "rgba(147,197,253,0.6)" }}>
              "I love you,<br />Subaru-kun"
            </p>
            <div className="flex justify-center pt-0.5">
              {["💙", "❄", "💙"].map((e, i) => (
                <span key={i} className="text-[9px] mx-0.5"
                  style={{ opacity: 0.45, filter: "drop-shadow(0 0 3px rgba(147,197,253,0.5))" }}>
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
