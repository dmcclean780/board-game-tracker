import { fireEvent, render, screen } from "@testing-library/react-native";
import Account from "../src/app/(app)/account";
import { api, auth, useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({
  useAuth: jest.fn(), api: jest.fn(), appOrigin: () => "http://app",
  auth: { signOut: jest.fn(), updateUser: jest.fn() },
}));

const refreshMe = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" }, me: { display_name: "Ada", email: "ada@x.com" }, refreshMe });
});

test("deleting the account asks for confirmation first", async () => {
  await render(<Account />);
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(screen.getByText("Confirm delete")).toBeTruthy();
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Confirm delete")).toBeNull();
});

test("saves a new display name and refreshes the user", async () => {
  (api as jest.Mock).mockResolvedValue({ ok: true });
  await render(<Account />);
  await fireEvent.changeText(screen.getByLabelText("Display name"), "Grace");
  await fireEvent.press(screen.getByText("Save display name"));
  expect(api).toHaveBeenCalledWith("/me", "t", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ display_name: "Grace" }) }));
  expect(refreshMe).toHaveBeenCalled();
  expect(await screen.findByText("Display name saved.")).toBeTruthy();
});

test("asks the user to confirm a new email by mail", async () => {
  (auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
  await render(<Account />);
  await fireEvent.changeText(screen.getByLabelText("New email"), "new@x.com");
  await fireEvent.press(screen.getByText("Change email"));
  expect(auth.updateUser).toHaveBeenCalledWith({ email: "new@x.com" }, { emailRedirectTo: "http://app" });
  expect(await screen.findByText("Check new@x.com to confirm the change.")).toBeTruthy();
});
