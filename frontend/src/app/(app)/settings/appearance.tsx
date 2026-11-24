import { Pressable, StyleSheet } from "react-native";
import { Heading, Screen, Text } from "../../../components/ui";
import { Mode, useTheme } from "../../../theme";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

export default function Appearance() {
  const { c, mode, setMode } = useTheme();
  return (
    <Screen>
      <Heading text="Theme" />
      {MODES.map((m) => (
        <Pressable key={m.mode} accessibilityRole="radio" accessibilityState={{ checked: mode === m.mode }} aria-checked={mode === m.mode} aria-label={m.label} onPress={() => setMode(m.mode)} style={s.row}>
          <Text style={[s.dot, { borderColor: c.primary }, mode === m.mode && { backgroundColor: c.primary }]}> </Text>
          <Text>{m.label}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
});
