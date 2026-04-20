import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { THEME_PRESETS, useTheme } from "@/hooks/use-theme";
import { Check, Palette } from "lucide-react";
import { toast } from "sonner";
import remStickerImg from "@assets/re-zero-sad-kawaii-rem-sticker_1776671137105.webp";
import remEyesImg from "@assets/rem-eyes-default.png";
import RemEyes from "@/components/RemEyes";

export default function ThemePicker() {
  const { theme, setTheme, setCustomColor } = useTheme();
  const colorInputRef = useRef<HTMLInputElement>(null);

  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const currentHex = hslToHex(theme.h, theme.s, theme.l);

  const handleSetTheme = (preset: typeof THEME_PRESETS[0]) => {
    setTheme(preset);
    if (preset.name === "Rem") {
      toast("💙 Rem theme activated", {
        description: '"I love you, Subaru-kun" — Rem, Re:Zero',
        duration: 5000,
        style: {
          background: "rgba(4,12,30,0.97)",
          border: "1px solid rgba(100,160,255,0.45)",
          color: "#93c5fd",
          boxShadow: "0 0 24px rgba(80,140,255,0.2)",
        },
      });
    }
  };

  const regularPresets = THEME_PRESETS.filter(p => p.name !== "Rem");
  const remPreset = THEME_PRESETS.find(p => p.name === "Rem")!;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="button-theme-picker"
          title="Change Theme Color"
          className="relative h-8 w-8 rounded-lg border border-transparent hover:border-primary/40 hover:bg-primary/10 flex items-center justify-center transition-all duration-200 group"
          aria-label="Open theme picker"
        >
          {theme.name === "Rem" ? (
            <span className="text-base" style={{ filter: "drop-shadow(0 0 6px rgba(147,197,253,0.8))" }}>❄</span>
          ) : (
            <div
              className="w-5 h-5 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
              style={{
                background: "conic-gradient(from 0deg, hsl(0 85% 60%), hsl(40 90% 55%), hsl(80 70% 50%), hsl(150 70% 48%), hsl(200 90% 58%), hsl(268 88% 62%), hsl(330 85% 62%), hsl(0 85% 60%))",
                boxShadow: `0 0 8px hsl(${theme.h} ${theme.s}% ${theme.l}% / 0.5)`,
              }}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-4 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-[0_8px_32px_hsl(0_0%_0%/0.6)]"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 flex items-center gap-2">
              <Palette className="w-3 h-3" /> Accent Color
            </p>

            {/* Regular preset swatches */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {regularPresets.map((preset) => {
                const isActive = theme.name === preset.name && theme.h === preset.h;
                return (
                  <button
                    key={preset.name}
                    data-testid={`theme-preset-${preset.name.toLowerCase()}`}
                    onClick={() => handleSetTheme(preset)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={preset.name}
                  >
                    <div
                      className={`relative w-10 h-10 rounded-lg border-2 transition-all duration-150 flex items-center justify-center
                        ${isActive ? "border-white/80 scale-110" : "border-transparent hover:border-white/30 hover:scale-105"}`}
                      style={{
                        background: `hsl(${preset.h} ${preset.s}% ${preset.l}%)`,
                        boxShadow: isActive ? `0 0 14px hsl(${preset.h} ${preset.s}% ${preset.l}% / 0.7)` : undefined,
                      }}
                    >
                      {isActive && <Check className="w-4 h-4" style={{ color: `hsl(${preset.fg})` }} />}
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider leading-none">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Rem special preset ── */}
            <div className="rounded-xl overflow-hidden" style={{
              border: theme.name === "Rem"
                ? "1px solid rgba(100,160,255,0.6)"
                : "1px solid rgba(100,160,255,0.18)",
              boxShadow: theme.name === "Rem"
                ? "0 0 20px rgba(80,140,255,0.25), inset 0 0 20px rgba(80,140,255,0.05)"
                : "none",
              background: "rgba(4,12,30,0.8)",
              transition: "all 0.3s ease",
            }}>
              <button
                data-testid="theme-preset-rem"
                onClick={() => handleSetTheme(remPreset)}
                className="w-full flex items-center gap-3 p-2.5 transition-all duration-200 group"
                style={{ background: theme.name === "Rem" ? "rgba(30,58,138,0.2)" : undefined }}
              >
                {/* Rem portrait thumbnail */}
                <div className="relative shrink-0 overflow-hidden rounded-lg"
                  style={{
                    width: "44px", height: "54px",
                    border: "1px solid rgba(100,160,255,0.3)",
                    boxShadow: "0 0 10px rgba(80,140,255,0.3)",
                  }}>
                  <img
                    src={remStickerImg}
                    alt="Rem"
                    className="w-full h-full object-contain"
                    style={{ objectPosition: "center bottom" }}
                  />
                  {theme.name === "Rem" && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(4,12,30,0.4)" }}>
                      <Check className="w-4 h-4" style={{ color: "#93c5fd" }} />
                    </div>
                  )}
                </div>

                {/* Rem info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold tracking-wider" style={{ color: "#93c5fd" }}>
                      REM
                    </span>
                    <span className="text-[9px]" style={{ color: "rgba(147,197,253,0.5)" }}>
                      ❄ Re:Zero
                    </span>
                  </div>
                  <p className="text-[9px] leading-relaxed italic" style={{ color: "rgba(147,197,253,0.5)" }}>
                    "I love you, Subaru-kun"
                  </p>
                  <div className="flex gap-1 mt-1">
                    {["❄", "💙", "❄"].map((e, i) => (
                      <span key={i} className="text-[9px]" style={{ opacity: 0.4 }}>{e}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 w-[96px]">
                    <RemEyes imageSrc={remEyesImg} maxOffset={1.4} />
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40">Custom</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          {/* Custom color picker */}
          <div className="flex items-center gap-3">
            <div
              className="relative w-10 h-10 rounded-lg border border-white/20 overflow-hidden cursor-pointer shrink-0 hover:border-white/40 transition-colors"
              style={{ background: currentHex }}
              onClick={() => colorInputRef.current?.click()}
              title="Pick custom color"
            >
              <input
                ref={colorInputRef}
                type="color"
                value={currentHex}
                onChange={(e) => setCustomColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                data-testid="input-custom-color"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground/80">
                {theme.name === "Custom" ? "Custom color" : theme.name}
              </p>
              <p className="text-[10px] text-muted-foreground/50 font-mono">{currentHex.toUpperCase()}</p>
            </div>
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: `hsl(${theme.h} ${theme.s}% ${theme.l}%)`,
                boxShadow: `0 0 6px hsl(${theme.h} ${theme.s}% ${theme.l}% / 0.8)`,
              }}
            />
          </div>

          <p className="text-[9px] text-muted-foreground/30 text-center tracking-wider uppercase">
            Theme saves automatically
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
