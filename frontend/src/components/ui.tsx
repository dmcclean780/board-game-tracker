import { ReactNode, useMemo } from "react";
import { Picker } from "@react-native-picker/picker";
import { Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, TextInputProps, TextProps, View } from "react-native";
import { Link, LinkProps } from "expo-router";
import { Colors, font, useTheme } from "../theme";

/** Text in the theme's text colour; use this instead of react-native's Text. */
export function Text({ style, ...props }: TextProps) {
  const { c } = useTheme();
  const { fontWeight, ...flat } = StyleSheet.flatten(style) ?? {};
  return <RNText {...props} style={[{ color: c.text, fontFamily: font(fontWeight) }, flat]} />;
}

/** A link in the accent colour. */
export function TextLink(props: LinkProps) {
  const { c } = useTheme();
  return <Link {...props} style={[{ color: c.primary, fontFamily: font() }, props.style]} />;
}

const useS = () => {
  const { c } = useTheme();
  return useMemo(() => styles(c), [c]);
};

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  const s = useS();
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.screen}>
      <View style={s.card}>
        {title && <Text accessibilityRole="header" style={s.title}>{title}</Text>}
        {children}
      </View>
    </ScrollView>
  );
}

/** A text box with its label shown above it; `hint` is grey example text, never a value. */
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const s = useS();
  const { c } = useTheme();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput aria-label={label} placeholder={hint} placeholderTextColor={c.placeholder} autoCapitalize="none" style={s.input} {...props} />
    </View>
  );
}

/** A heading that starts a section of a form. */
export function Heading({ text }: { text: string }) {
  const s = useS();
  return <Text accessibilityRole="header" style={s.heading}>{text}</Text>;
}

export type Option = { value: string; label: string; disabled?: boolean };

/** A dropdown for choosing one of several options. Disabled options cannot be picked. */
export function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  const s = useS();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Picker
        aria-label={label}
        accessibilityLabel={label}
        selectedValue={value}
        onValueChange={(v: string) => !options.find((o) => o.value === v)?.disabled && onChange(v)}
        style={s.input}
      >
        {options.map((o) => <Picker.Item key={o.value} label={o.label} value={o.value} enabled={!o.disabled} />)}
      </Picker>
    </View>
  );
}

/** A tick box for a yes/no choice. */
export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const s = useS();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !!disabled }} aria-label={label} disabled={disabled} onPress={() => onChange(!checked)} style={[s.checkRow, disabled && s.disabled]}>
      <View style={[s.box, checked && s.boxOn]}>{checked && <Text style={s.tick}>✓</Text>}</View>
      <Text>{label}</Text>
    </Pressable>
  );
}

/** A date as YYYY-MM-DD: the browser's date picker on web, a text box elsewhere. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useS();
  const { c, dark } = useTheme();
  if (Platform.OS !== "web") return <Field label={label} hint="YYYY-MM-DD" value={value} onChangeText={onChange} />;
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <input type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 10, fontSize: 16, fontFamily: font(), borderStyle: "solid", color: c.text, backgroundColor: c.surface, colorScheme: dark ? "dark" : "light" }} />
    </View>
  );
}

export function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const s = useS();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[s.button, secondary && s.secondary, disabled && s.disabled]}>
      <Text style={secondary ? s.secondaryText : s.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Message({ text, error }: { text: string | null; error?: boolean }) {
  const s = useS();
  return text ? <Text accessibilityRole={error ? "alert" : undefined} style={error ? s.error : s.info}>{text}</Text> : null;
}

const styles = (c: Colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: c.bg },
  screen: { flexGrow: 1, alignItems: "center", padding: 16 },
  card: { width: "100%", maxWidth: 560, gap: 12, paddingVertical: 16 },
  field: { gap: 4 },
  heading: { fontSize: 18, fontWeight: "600", marginTop: 8, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 4 },
  label: { fontSize: 14, fontWeight: "500" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: { width: 22, height: 22, borderWidth: 1, borderColor: c.primary, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: c.primary },
  tick: { color: c.onPrimary, fontSize: 14 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 10, fontSize: 16, fontFamily: font(), color: c.text, backgroundColor: c.surface },
  button: { backgroundColor: c.primary, borderRadius: 6, padding: 12, alignItems: "center" },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: c.primary },
  disabled: { opacity: 0.5 },
  buttonText: { color: c.onPrimary, fontSize: 16 },
  secondaryText: { color: c.primary, fontSize: 16 },
  error: { color: c.error },
  info: { color: c.primary },
});
