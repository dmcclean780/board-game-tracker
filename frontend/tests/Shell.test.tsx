import { fireEvent, render, screen } from "@testing-library/react-native";
import { auth, useAuth } from "../src/auth";
import { Footer, Header } from "../src/components/shell";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), auth: { signOut: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => true, back: jest.fn() }, usePathname: () => "/results" }));

beforeEach(() => (useAuth as jest.Mock).mockReturnValue({ me: { display_name: "Ada" } }));

test("the footer marks the current section", async () => {
  await render(<Footer />);
  expect(screen.getByLabelText("Results").props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText("Games").props.accessibilityState.selected).toBe(false);
});

test("the user menu offers Account and Sign out", async () => {
  await render(<Header title="Results" />);
  expect(screen.queryByText("Sign out")).toBeNull();
  await fireEvent.press(screen.getByLabelText("User menu"));
  expect(screen.getByText("Account")).toBeTruthy();
  await fireEvent.press(screen.getByText("Sign out"));
  expect(auth.signOut).toHaveBeenCalled();
});
