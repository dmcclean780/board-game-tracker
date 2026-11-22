import { fireEvent, render, screen } from "@testing-library/react-native";
import Home from "../src/app/index";
import { useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn(), auth: { signOut: jest.fn() } }));

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" }, me: { display_name: "Ada" } });
});

test("greets the user and shows the empty state", async () => {
  await render(<Home />);
  expect(screen.getByText("Hi, Ada")).toBeTruthy();
  expect(screen.getByText("No games yet.")).toBeTruthy();
});

test("deleting the account asks for confirmation first", async () => {
  await render(<Home />);
  await fireEvent.press(screen.getByText("Delete account"));
  expect(screen.getByText("Confirm delete")).toBeTruthy();
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Confirm delete")).toBeNull();
});
