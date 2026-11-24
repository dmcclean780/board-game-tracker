import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { Text as ThemedText } from "../src/components/ui";
import Appearance from "../src/app/(app)/settings/appearance";
import { ThemeProvider, useTheme } from "../src/theme";

function Probe() {
  return <Text>{useTheme().dark ? "dark" : "light"}</Text>;
}

function ThemeText() {
  return <ThemedText style={{ fontWeight: "600" }}>Bold</ThemedText>;
}

test("choosing Dark switches the theme and marks the choice", async () => {
  await render(<ThemeProvider><Appearance /><Probe /></ThemeProvider>);
  expect(screen.getByLabelText("System").props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByLabelText("Dark"));
  expect(screen.getByLabelText("Dark").props.accessibilityState.checked).toBe(true);
  expect(screen.getByText("dark")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Light"));
  expect(screen.getByText("light")).toBeTruthy();
});

test("Text maps font weight to the matching Inter face", async () => {
  await render(<ThemeText />);
  const style = StyleSheet.flatten(screen.getByText("Bold").props.style);
  expect(style.fontFamily).toBe("Inter_600SemiBold");
  expect(style.fontWeight).toBeUndefined();
});
