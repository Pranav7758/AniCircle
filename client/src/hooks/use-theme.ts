import { useEffect, useState } from "react";

export interface ThemePreset {
  name: string;
  h: number;
  s: number;
  l: number;
  fg: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Gold",    h: 45,  s: 64, l: 52, fg: "0 0% 4%" },
  { name: "Blue",    h: 215, s: 90, l: 60, fg: "0 0% 100%" },
  { name: "Purple",  h: 268, s: 88, l: 64, fg: "0 0% 100%" },
  { name: "Rose",    h: 330, s: 85, l: 62, fg: "0 0% 100%" },
  { name: "Emerald", h: 142, s: 70, l: 50, fg: "0 0% 4%" },
  { name: "Orange",  h: 25,  s: 90, l: 55, fg: "0 0% 4%" },
  { name: "Cyan",    h: 185, s: 80, l: 48, fg: "0 0% 4%" },
  { name: "Red",     h: 0,   s: 84, l: 60, fg: "0 0% 100%" },
  { name: "Rem",     h: 210, s: 80, l: 56, fg: "0 0% 100%" },
];

const STORAGE_KEY = "anicircle-theme";
const listeners = new Set<(theme: ThemePreset) => void>();

function getInitialTheme(): ThemePreset {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore malformed storage values and fall back
  }
  return THEME_PRESETS[0];
}

let currentTheme: ThemePreset | null = null;

function getThemeSnapshot(): ThemePreset {
  if (!currentTheme) {
    currentTheme = getInitialTheme();
  }
  return currentTheme;
}

function persistAndBroadcast(theme: ThemePreset) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // ignore storage failures
  }
  listeners.forEach((listener) => listener(theme));
}

function applyTheme(themeName: string, h: number, s: number, l: number, fg: string) {
  const root = document.documentElement;
  root.setAttribute("data-theme-name", themeName);

  const main  = `${h} ${s}% ${l}%`;
  const light = `${h} ${s}% ${Math.min(l + 10, 92)}%`;
  const dark  = `${h} ${s}% ${Math.max(l - 12, 10)}%`;
  const dim   = `${h} ${Math.round(s * 0.7)}% ${Math.max(l - 18, 8)}%`;
  const surface = `${h} ${Math.max(Math.round(s * 0.22), 8)}% 9%`;
  const muted = `${h} ${Math.max(Math.round(s * 0.18), 7)}% 14%`;
  const border = `${h} ${Math.max(Math.round(s * 0.42), 20)}% ${Math.max(l - 12, 20)}%`;
  const input = `${h} ${Math.max(Math.round(s * 0.38), 18)}% ${Math.max(l - 14, 18)}%`;

  root.style.setProperty("--primary", main);
  root.style.setProperty("--primary-light", light);
  root.style.setProperty("--primary-dark", dark);
  root.style.setProperty("--primary-dim", dim);
  root.style.setProperty("--primary-foreground", fg);

  root.style.setProperty("--accent", main);
  root.style.setProperty("--accent-foreground", fg);
  root.style.setProperty("--ring", main);
  root.style.setProperty("--border", border);
  root.style.setProperty("--input", input);
  root.style.setProperty("--secondary", dim);
  root.style.setProperty("--muted", muted);
  root.style.setProperty("--sidebar-accent", surface);

  root.style.setProperty("--sidebar-primary", main);
  root.style.setProperty("--sidebar-primary-foreground", fg);
  root.style.setProperty("--sidebar-border", border);
  root.style.setProperty("--sidebar-ring", main);

  root.style.setProperty("--neon-purple", main);
  root.style.setProperty("--neon-pink", main);
  root.style.setProperty("--neon-cyan", main);
  root.style.setProperty("--neon-green", main);
  root.style.setProperty("--neon-amber", main);
}

function hexToHsl(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreset>(() => getThemeSnapshot());

  useEffect(() => {
    const listener = (nextTheme: ThemePreset) => {
      setThemeState(nextTheme);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme.name, theme.h, theme.s, theme.l, theme.fg);
  }, [theme]);

  const setTheme = (preset: ThemePreset) => {
    persistAndBroadcast(preset);
  };

  const setCustomColor = (hex: string) => {
    const hsl = hexToHsl(hex);
    if (!hsl) return;
    const [h, s, l] = hsl;
    const fg = l > 55 ? "0 0% 4%" : "0 0% 100%";
    const custom: ThemePreset = { name: "Custom", h, s, l, fg };
    setTheme(custom);
  };

  return { theme, setTheme, setCustomColor };
}
