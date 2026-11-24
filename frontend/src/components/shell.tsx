import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { auth, useAuth } from "../auth";

export const SECTIONS = [
  { path: "/games", label: "Games", icon: "dice-outline" },
  { path: "/results", label: "Results", icon: "trophy-outline" },
  { path: "/groups", label: "Groups", icon: "people-outline" },
  { path: "/account", label: "Account", icon: "person-circle-outline" },
] as const;

/** Top bar: optional back arrow and the screen title on the left, the user menu on the right. */
export function Header({ title, back }: { title: string; back?: boolean }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const go = (path: "/account") => { setOpen(false); router.push(path); };
  return (
    <View style={s.header}>
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
          <Pressable accessibilityRole="link" onPress={() => go("/account")} style={s.item}><Text>Account</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => auth.signOut()} style={s.item}><Text>Sign out</Text></Pressable>
        </View>
      )}
    </View>
  );
}

/** Bottom bar with one button per section; the current one is highlighted. */
export function Footer() {
  const path = usePathname();
  return (
    <View style={s.footer}>
      {SECTIONS.map((x) => {
        const on = path === x.path;
        return (
          <Pressable key={x.path} accessibilityRole="link" accessibilityState={{ selected: on }} aria-label={x.label} onPress={() => router.replace(x.path)} style={s.tab}>
            <Ionicons name={x.icon} size={22} color={on ? "#1a56db" : "#666"} />
            <Text style={[s.tabText, on && s.tabOn]}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ddd", zIndex: 10 },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  back: { fontSize: 22 },
  title: { fontSize: 20, fontWeight: "600" },
  user: { fontSize: 16, color: "#1a56db" },
  menu: { position: "absolute", top: "100%", right: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 6, minWidth: 140 },
  item: { padding: 12 },
  footer: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ddd" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, gap: 2 },
  tabText: { fontSize: 12, color: "#666" },
  tabOn: { color: "#1a56db", fontWeight: "600" },
});
