import { render, screen } from "@testing-library/react-native";
import App from "../App";

test("renders the starter text", async () => {
  await render(<App />);
  expect(screen.getByText(/Open up App.tsx/)).toBeTruthy();
});
