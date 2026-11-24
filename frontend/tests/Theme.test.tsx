import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import Appearance from "../src/app/(app)/settings/appearance";
import { ThemeProvider, useTheme } from "../src/theme";

function Probe() {
  return <Text>{useTheme().dark ? "dark" : "light"}</Text>;
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
