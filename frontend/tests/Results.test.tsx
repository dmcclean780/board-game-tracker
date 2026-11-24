import { render, screen } from "@testing-library/react-native";
import Results from "../src/app/(app)/results";
import { api, useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn(), auth: { signOut: jest.fn() } }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, []),
}));

const root = { id: "s1", game: "root", played_on: "2026-11-20", notes: null, duration_minutes: null, players: ["Ada", "Bo"],
  result: { map: "autumn", deck: "standard", landmarks: [], victory: "points", players: { Ada: { faction: "lizard_cult", score: 30, winner: true, partner: null }, Bo: { faction: "vagabond", score: 3, winner: false, partner: null } } } };

function sessions(list: unknown[]) {
  (api as jest.Mock).mockResolvedValue({ ok: true, json: async () => list });
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" }, me: { display_name: "Ada" } });
  sessions([]);
});

test("shows the empty state", async () => {
  await render(<Results />);
  expect(await screen.findByText("No sessions yet.")).toBeTruthy();
});

test("lists recorded sessions with their winners", async () => {
  sessions([root]);
  await render(<Results />);
  expect(await screen.findByText("2026-11-20 · Root · Won by Ada")).toBeTruthy();
});
