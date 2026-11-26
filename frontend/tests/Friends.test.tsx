import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Friends from "../src/app/(app)/friends";
import { api, useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));
jest.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => require("react").useEffect(cb, []) }));
const mockLive: Record<string, () => void> = {};
jest.mock("../src/live", () => ({ useLive: (type: string, cb: () => void) => { mockLive[type] = cb; } }));

const refreshMe = jest.fn();
const reply = (ok: boolean, body: unknown, status = ok ? 200 : 422) => ({ ok, status, json: async () => body, text: async () => String(body) });
const writeText = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText } });
  writeText.mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" }, me: { display_name: "Ada", friend_code: "K7QM3XPA" }, refreshMe });
});

test("with no friends yet the screen says so, and your code stays hidden until asked for", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  expect(await screen.findByText("No friends yet. Share your friend code or enter a friend's code above.")).toBeTruthy();
  expect(screen.queryByText("K7QM-3XPA")).toBeNull();
  await fireEvent.press(screen.getByText("Show code"));
  expect(screen.getByText("K7QM-3XPA")).toBeTruthy();
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.queryByText("K7QM-3XPA")).toBeNull();
});

test("the code popup copies the code", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  await fireEvent.press(screen.getByText("Show code"));
  await fireEvent.press(screen.getByText("Copy"));
  expect(writeText).toHaveBeenCalledWith("K7QM-3XPA");
  expect(await screen.findByText("Copied.")).toBeTruthy();
});

test("a new code asks for confirmation inside the popup, then refreshes the user", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  await fireEvent.press(screen.getByText("Show code"));
  await fireEvent.press(screen.getByText("New code"));
  expect(api).not.toHaveBeenCalledWith("/me/friend-code", "t", expect.anything());
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Confirm new code")).toBeNull();
  await fireEvent.press(screen.getByText("New code"));
  await fireEvent.press(screen.getByText("Confirm new code"));
  expect(api).toHaveBeenCalledWith("/me/friend-code", "t", { method: "POST" });
  expect(refreshMe).toHaveBeenCalled();
});

test("an add error stays in the popup; a success closes it and lists the friend", async () => {
  let added = false;
  (api as jest.Mock).mockImplementation(async (path: string, _t: string, init?: RequestInit) => {
    if (path === "/friends" && init?.method === "POST") {
      if (JSON.parse(String(init.body)).code === "bad") return reply(false, "No user has that friend code.");
      added = true;
      return reply(true, { id: "b", display_name: "Bo" }, 201);
    }
    return reply(true, added ? [{ id: "b", display_name: "Bo" }] : []);
  });
  await render(<Friends />);
  expect(screen.queryByLabelText("Friend code")).toBeNull();
  await fireEvent.press(screen.getByText("Add friend"));
  await fireEvent.changeText(screen.getByLabelText("Friend code"), "bad");
  await fireEvent.press(screen.getByText("Add"));
  expect(await screen.findByText("No user has that friend code.")).toBeTruthy();
  expect(screen.getByLabelText("Friend code")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Friend code"), "good");
  await fireEvent.press(screen.getByText("Add"));
  expect(await screen.findByText("Bo")).toBeTruthy();
  expect(screen.queryByLabelText("Friend code")).toBeNull();
});

test("cancelling the add popup clears the box and the error", async () => {
  (api as jest.Mock).mockImplementation(async (_p: string, _t: string, init?: RequestInit) => init?.method === "POST" ? reply(false, "No user has that friend code.") : reply(true, []));
  await render(<Friends />);
  await fireEvent.press(screen.getByText("Add friend"));
  await fireEvent.changeText(screen.getByLabelText("Friend code"), "bad");
  await fireEvent.press(screen.getByText("Add"));
  await screen.findByText("No user has that friend code.");
  await fireEvent.press(screen.getByText("Cancel"));
  await fireEvent.press(screen.getByText("Add friend"));
  expect(screen.getByLabelText("Friend code").props.value).toBe("");
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

test("the list refetches when the server says friends changed", async () => {
  (api as jest.Mock).mockResolvedValue(reply(true, []));
  await render(<Friends />);
  await screen.findByText(/No friends yet/);
  (api as jest.Mock).mockResolvedValue(reply(true, [{ id: "b", display_name: "Bo" }]));
  await act(async () => mockLive.friends());
  expect(await screen.findByText("Bo")).toBeTruthy();
});
