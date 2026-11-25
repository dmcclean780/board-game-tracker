import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, useAuth } from "../auth";
import { Colors, useTheme } from "../theme";
import { Text } from "./ui";

export const SECTIONS = [
  { path: "/games", label: "Games", icon: "dice-outline" },
  { path: "/results", label: "Results", icon: "trophy-outline" },
  { path: "/groups", label: "Groups", icon: "people-outline" },
  { path: "/settings", label: "Settings", icon: "settings-outline" },
] as const;

/** Whether `path` is the section's screen or one of its sub pages. */
export const inSection = (path: string, x: { path: string }) => path === x.path || path.startsWith(x.path + "/");

function useS() {
  const { c } = useTheme();
  return useMemo(() => styles(c), [c]);
}

/** Top bar: optional back arrow and the screen title on the left, the user menu on the right. */
export function Header({ title, back }: { title: string; back?: boolean }) {
  const s = useS();
  const { top } = useSafeAreaInsets();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const go = (path: "/settings/account") => { setOpen(false); router.push(path); };
  return (
    <View style={[s.header, { paddingTop: top + 12 }]}>
      <View style={s.left}>
        {back && (
          <Pressable accessibilityRole="button" aria-label="Previous screen" onPress={() => (router.canGoBack() ? router.back() : router.replace("/results"))}>
            <Text style={s.back}>←</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={s.title}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" aria-label="User menu" onPress={() => setOpen(!open)}>
        <Text style={s.user}>{me?.display_name} ▾</Text>
      </Pressable>
      {open && (
        <View style={s.menu}>
          <Pressable accessibilityRole="link" onPress={() => go("/settings/account")} style={s.item}><Text>Account</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => auth.signOut()} style={s.item}><Text>Sign out</Text></Pressable>
        </View>
      )}
    </View>
  );
}

/** Bottom bar with one button per section; the current one is highlighted. */
export function Footer() {
  const s = useS();
  const { c } = useTheme();
  const path = usePathname();
  return (
    <View style={s.footer}>
      {SECTIONS.map((x) => {
        const on = inSection(path, x);
        return (
          <Pressable key={x.path} accessibilityRole="link" accessibilityState={{ selected: on }} aria-label={x.label} onPress={() => router.replace(x.path)} style={s.tab}>
            <Ionicons name={x.icon} size={22} color={on ? c.primary : c.muted} />
            <Text style={[s.tabText, on && s.tabOn]}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = (c: Colors) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line, zIndex: 10 },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  back: { fontSize: 22 },
  title: { fontSize: 20, fontWeight: "600" },
  user: { fontSize: 16, color: c.primary },
  menu: { position: "absolute", top: "100%", right: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 6, minWidth: 140 },
  item: { padding: 12 },
  footer: { flexDirection: "row", backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, gap: 2 },
  tabText: { fontSize: 12, color: c.muted },
  tabOn: { color: c.primary, fontWeight: "600" },
});
