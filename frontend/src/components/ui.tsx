import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.screen}>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.title}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <TextInput aria-label={label} placeholder={label} autoCapitalize="none" style={s.input} {...props} />;
}

export function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[s.button, secondary && s.secondary, disabled && s.disabled]}>
      <Text style={secondary ? s.secondaryText : s.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Message({ text, error }: { text: string | null; error?: boolean }) {
  return text ? <Text accessibilityRole={error ? "alert" : undefined} style={error ? s.error : s.info}>{text}</Text> : null;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 360, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#bbb", borderRadius: 6, padding: 10, fontSize: 16 },
  button: { backgroundColor: "#1a56db", borderRadius: 6, padding: 12, alignItems: "center" },
  secondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#1a56db" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16 },
  secondaryText: { color: "#1a56db", fontSize: 16 },
  error: { color: "#b00020" },
  info: { color: "#1a56db" },
});
