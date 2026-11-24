import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export type Mode = "system" | "light" | "dark";

const light = { bg: "#fff", text: "#111", muted: "#666", line: "#ddd", border: "#bbb", primary: "#1a56db", onPrimary: "#fff", error: "#b00020", placeholder: "#999" };
const dark: typeof light = { bg: "#121212", text: "#eee", muted: "#aaa", line: "#333", border: "#555", primary: "#6ea0ff", onPrimary: "#0b1220", error: "#ff6b6b", placeholder: "#888" };
export type Colors = typeof light;

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
