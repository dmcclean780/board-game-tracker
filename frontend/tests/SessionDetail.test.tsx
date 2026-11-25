import { render, screen } from "@testing-library/react-native";
import SessionDetail from "../src/app/(app)/sessions/[id]";
import { api, useAuth } from "../src/auth";

jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ id: "s1" }) }));

const root = {
  id: "s1", game: "root", played_on: "2026-11-20", notes: "Close game", duration_minutes: 45, players: ["Ada", "Bo"], result: {},
  game_name: "Root", winners: ["Ada"],
  details: {
    setup: [{ title: "Map", value: "Autumn" }, { title: "Victory", value: "Points" }],
    players: [{ name: "Ada", summary: "Vagabond · 3" }, { name: "Bo", summary: "Eyrie Dynasties · 20" }],
  },
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: "t" } });
  (api as jest.Mock).mockResolvedValue({ ok: true, json: async () => root });
});

test("shows the game and date, then titled setup, then a line per player", async () => {
  await render(<SessionDetail />);
  expect(await screen.findByText("Root")).toBeTruthy();
  expect(screen.getByText("2026-11-20 · 45 minutes")).toBeTruthy();
  expect(screen.getByText("Map")).toBeTruthy();
  expect(screen.getByText("Autumn")).toBeTruthy();
  expect(screen.getByText("Victory")).toBeTruthy();
  expect(screen.getByText("Close game")).toBeTruthy();
});

test("marks the winners, and only the winners", async () => {
  await render(<SessionDetail />);
  expect(await screen.findByLabelText("Ada, winner, Vagabond · 3")).toBeTruthy();
  expect(screen.getByLabelText("Bo, Eyrie Dynasties · 20")).toBeTruthy();
  expect(screen.queryByLabelText(/Bo, winner/)).toBeNull();
});
