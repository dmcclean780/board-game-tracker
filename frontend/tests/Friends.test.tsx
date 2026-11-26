import { fireEvent, render, screen } from "@testing-library/react-native";
import Friends from "../src/app/(app)/friends";
import { api, useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));

const refreshMe = jest.fn();
const reply = (ok: boolean, body: unknown, status = ok ? 200 : 422) => ({ ok, status, json: async () => body, text: async () => String(body) });

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" }, me: { display_name: "Ada", friend_code: "K7QM3XPA" }, refreshMe });
});

test("shows your code and, with no friends yet, a hint", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  expect(screen.getByText("K7QM-3XPA")).toBeTruthy();
  expect(await screen.findByText("No friends yet. Share your friend code or enter a friend's code above.")).toBeTruthy();
});

test("adds a friend by code and lists them, or shows the server's reason", async () => {
  (api as jest.Mock).mockImplementation(async (path: string, _t: string, init?: RequestInit) => {
    if (path === "/friends" && init?.method === "POST") {
      return JSON.parse(String(init.body)).code === "bad" ? reply(false, "No user has that friend code.") : reply(true, { id: "b", display_name: "Bo" }, 201);
    }
    return reply(true, added ? [{ id: "b", display_name: "Bo" }] : []);
  });
  let added = false;
  await render(<Friends />);
  await fireEvent.changeText(screen.getByLabelText("Friend code"), "bad");
  await fireEvent.press(screen.getByText("Add friend"));
  expect(await screen.findByText("No user has that friend code.")).toBeTruthy();
  added = true;
  await fireEvent.changeText(screen.getByLabelText("Friend code"), "good");
  await fireEvent.press(screen.getByText("Add friend"));
  expect(await screen.findByText("Bo")).toBeTruthy();
  expect(screen.queryByText("No user has that friend code.")).toBeNull();
});

test("removing a friend asks for confirmation first", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, [{ id: "b", display_name: "Bo" }]));
  await render(<Friends />);
  await fireEvent.press(await screen.findByText("Remove"));
  expect(api).not.toHaveBeenCalledWith("/friends/b", "t", expect.anything());
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Confirm remove")).toBeNull();
  await fireEvent.press(screen.getByText("Remove"));
  (api as jest.Mock).mockResolvedValue(reply(true, [], 204));
  await fireEvent.press(screen.getByText("Confirm remove"));
  expect(api).toHaveBeenCalledWith("/friends/b", "t", { method: "DELETE" });
  expect(await screen.findByText(/No friends yet/)).toBeTruthy();
});

test("a new code asks for confirmation, then refreshes the user", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  await fireEvent.press(screen.getByText("New code"));
  expect(api).not.toHaveBeenCalledWith("/me/friend-code", "t", expect.anything());
  await fireEvent.press(screen.getByText("Confirm new code"));
  expect(api).toHaveBeenCalledWith("/me/friend-code", "t", { method: "POST" });
  expect(refreshMe).toHaveBeenCalled();
});
