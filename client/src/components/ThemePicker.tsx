import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { THEME_PRESETS, useTheme } from "@/hooks/use-theme";
import { Check, Palette } from "lucide-react";

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="button-theme-picker"
          title="Change Theme Color"
          className="relative h-8 w-8 rounded-none border border-transparent hover:border-primary/40 hover:bg-primary/10 flex items-center justify-center transition-all duration-200 group"
          aria-label="Open theme picker"
        >
          {/* Rainbow circle */}
          <div
            className="w-5 h-5 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
            style={{
              background: "conic-gradient(from 0deg, hsl(0 85% 60%), hsl(40 90% 55%), hsl(80 70% 50%), hsl(150 70% 48%), hsl(200 90% 58%), hsl(268 88% 62%), hsl(330 85% 62%), hsl(0 85% 60%))",
              boxShadow: `0 0 8px hsl(${theme.h} ${theme.s}% ${theme.l}% / 0.5)`,
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 p-4 rounded-none border border-primary/30 bg-card/95 backdrop-blur-xl shadow-[0_8px_32px_hsl(0_0%_0%/0.6)]"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 flex items-center gap-2">
              <Palette className="w-3 h-3" /> Accent Color
            </p>

            {/* Preset swatches */}
            <div className="grid grid-cols-4 gap-2">
              {THEME_PRESETS.map((preset) => {
                const isActive = theme.name === preset.name && theme.h === preset.h;
                return (
                  <button
                    key={preset.name}
                    data-testid={`theme-preset-${preset.name.toLowerCase()}`}
                    onClick={() => setTheme(preset)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={preset.name}
                  >
                    <div
                      className={`relative w-10 h-10 rounded-none border-2 transition-all duration-150 flex items-center justify-center
                        ${isActive ? "border-white/80 scale-110" : "border-transparent hover:border-white/30 hover:scale-105"}`}
                      style={{
                        background: `hsl(${preset.h} ${preset.s}% ${preset.l}%)`,
                        boxShadow: isActive
                          ? `0 0 14px hsl(${preset.h} ${preset.s}% ${preset.l}% / 0.7)`
                          : `0 0 0px transparent`,
                      }}
                    >
                      {isActive && (
                        <Check
                          className="w-4 h-4"
                          style={{ color: `hsl(${preset.fg})` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider leading-none">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
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
              className="relative w-10 h-10 rounded-none border border-white/20 overflow-hidden cursor-pointer shrink-0 hover:border-white/40 transition-colors"
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
