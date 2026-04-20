import remFloatImg from "@assets/re-zero-cute-blue-hair-rem-sticker_1776671235770.png";
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

export default function RemEffects() {
  const { theme } = useTheme();
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
              filter: `drop-shadow(0 0 ${Math.round(f.size * 0.35)}px rgba(147,197,253,0.65))`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* ── Floating chibi Rem — bottom-right, no box ── */}
      <div
        className="fixed pointer-events-none select-none"
        style={{
          bottom: 0,
          right: "12px",
          zIndex: 40,
          animation: "rem-float 4s ease-in-out infinite",
          filter: "drop-shadow(0 8px 24px rgba(80,140,255,0.45)) drop-shadow(0 0 12px rgba(147,197,253,0.25))",
        }}
      >
        <img
          src={remFloatImg}
          alt="Rem"
          style={{ width: "148px", height: "auto", display: "block" }}
        />
      </div>

      <style>{`
        @keyframes rem-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </>
  );
}
