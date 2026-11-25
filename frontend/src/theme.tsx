import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export type Mode = "system" | "light" | "dark";

const light = { bg: "#F3F4F6", surface: "#FFFFFF", text: "#111827", muted: "#6B7280", line: "#E5E7EB", border: "#D1D5DB", primary: "#0F9488", onPrimary: "#FFFFFF", error: "#B00020", placeholder: "#9CA3AF", gold: "#B8860B" };
const dark: typeof light = { bg: "#1F2125", surface: "#2A2D32", text: "#E5E7EB", muted: "#9CA3AF", line: "#33363C", border: "#4B5058", primary: "#25D086", onPrimary: "#0B1F1C", error: "#FF6B6B", placeholder: "#6B7280", gold: "#F5C542" };
export type Colors = typeof light;

/** Inter has one font family per weight, so pick the family instead of setting fontWeight. */
export function font(weight?: string | number) {
  const w = Number(weight === "bold" ? 700 : weight) || 400;
  return w >= 600 ? "Inter_600SemiBold" : w >= 500 ? "Inter_500Medium" : "Inter_400Regular";
}

const KEY = "theme-mode";
type Ctx = { c: Colors; dark: boolean; mode: Mode; setMode: (m: Mode) => void };
// The default (no provider) is light, so components render in tests without a wrapper.
const Theme = createContext<Ctx>({ c: light, dark: false, mode: "light", setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, set] = useState<Mode>("system");
  // shortcut: read after mount (static export has no localStorage), so a dark User sees one light frame; upgrade with a blocking inline script if it bothers.
  useEffect(() => {
    try {
      const m = localStorage.getItem(KEY);
      if (m === "light" || m === "dark" || m === "system") set(m);
    } catch {}
  }, []);
  const value = useMemo(() => {
    const isDark = mode === "dark" || (mode === "system" && system === "dark");
    return {
      c: isDark ? dark : light,
      dark: isDark,
      mode,
      setMode: (m: Mode) => {
        set(m);
        try { localStorage.setItem(KEY, m); } catch {}
      },
    };
  }, [mode, system]);
  return <Theme.Provider value={value}>{children}</Theme.Provider>;
}

export const useTheme = () => useContext(Theme);
