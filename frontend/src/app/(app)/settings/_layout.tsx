import { router, Slot, usePathname } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/ui";
import { useTheme } from "../../../theme";

const TABS = [
  { path: "/settings/account", label: "Account" },
  { path: "/settings/appearance", label: "Appearance" },
] as const;

/** Internal header for Settings: one tab per sub page. */
export default function SettingsLayout() {
  const path = usePathname();
  const { c } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.tabs, { borderBottomColor: c.line }]}>
        {TABS.map((t) => {
          const on = path === t.path;
          return (
            <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(t.path)} style={[s.tab, on && { borderBottomColor: c.primary }]}>
              <Text style={on ? { color: c.primary, fontWeight: "600" } : { color: c.muted }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }}><Slot /></View>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
});
