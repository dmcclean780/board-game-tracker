import { fireEvent, render, screen } from "@testing-library/react-native";
import { games } from "../src/games";

// The real data file, so these tests fail if the form and the file drift apart.
const realData = require("../../backend/games/root/data.json");
let mockData: unknown = realData;
jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));
jest.mock("../src/games/data", () => ({ ...jest.requireActual("../src/games/data"), useGameData: () => mockData }));
beforeEach(() => {
  mockData = realData;
});

const Form = games.root.Form;
const pick = (label: string, value: string) => fireEvent(screen.getByLabelText(label), "valueChange", value);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const last = (fn: jest.Mock) => fn.mock.calls.at(-1)[0];
const names = async () => {
  await type("Player 1 name", "Ada");
  await type("Player 2 name", "Bo");
};

test("reports players and a points Result once the form is valid", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  expect(last(onChange)).toBeNull();
  await names();
  await type("Player 1 score", "30");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  const { players, result } = last(onChange);
  expect(players).toEqual(["Ada", "Bo"]);
  expect(result.victory).toBe("points");
  expect(result.players.Ada).toEqual({ faction: "marquise_de_cat", score: 30, winner: true, partner: null });
});

test("explains what is wrong and reports nothing until it is fixed", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  expect(screen.getByText("Enter a name for every player.")).toBeTruthy();
  await names();
  expect(screen.getByText("Tick Won for the player who won.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(screen.getByText(/at least 30 points/)).toBeTruthy();
  expect(last(onChange)).toBeNull();
  await type("Player 1 score", "30");
  expect(last(onChange)).not.toBeNull();
  await type("Player 2 name", "Ada");
  expect(screen.getByText("Player names must be different.")).toBeTruthy();
});

test("only one player can be marked as having won", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Player 2 won"));
  expect(screen.getByLabelText("Player 1 won").props.accessibilityState.checked).toBe(false);
  expect(screen.getByLabelText("Player 2 won").props.accessibilityState.checked).toBe(true);
});

test("a dominance victory needs no points", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(last(onChange)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Dominance"));
  expect(last(onChange).result.victory).toBe("dominance");
});

test("a faction held by another player cannot be picked, except Vagabond", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Dominance"));
  expect(last(onChange).result.players.Bo.faction).toBe("eyrie_dynasties"); // a new player starts on a free faction
  await pick("Player 2 faction", "marquise_de_cat"); // taken: ignored
  expect(last(onChange).result.players.Bo.faction).toBe("eyrie_dynasties");
  await pick("Player 1 faction", "vagabond");
  await pick("Player 2 faction", "vagabond"); // two Vagabonds are fine
  expect(last(onChange).result.players.Bo.faction).toBe("vagabond");
});

test("coalitions exist only for a Vagabond, in either win condition", async () => {
  await render(<Form onChange={jest.fn()} />);
  await pick("Player 2 faction", "vagabond");
  expect(screen.getByLabelText("Player 2 coalition with")).toBeTruthy(); // 30 Points
  await fireEvent.press(screen.getByLabelText("Dominance"));
  expect(screen.getByLabelText("Player 2 coalition with")).toBeTruthy();
  expect(screen.queryByLabelText("Player 1 coalition with")).toBeNull(); // not a Vagabond
});

test("a Vagabond coalition wins a points victory with a partner on 30", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  await type("Player 1 score", "30");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  const { result } = last(onChange);
  expect(result.victory).toBe("points");
  expect(result.players.Bo).toMatchObject({ winner: true, partner: "Ada" });
});

test("a coalition Vagabond wins with their partner, and keeps them when renamed", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Dominance"));
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await type("Player 1 name", "Ada L");
  const { Bo, "Ada L": ada } = last(onChange).result.players;
  expect(ada.winner).toBe(true);
  expect(Bo).toMatchObject({ winner: true, partner: "Ada L" });
  expect(screen.getByLabelText("Player 2 won (with Ada L)")).toBeTruthy();
});

test("leaving Vagabond drops the coalition, switching win condition keeps it", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Dominance"));
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  expect(last(onChange).result.players.Bo.partner).toBe("Ada");
  await pick("Player 2 faction", "lizard_cult");
  expect(last(onChange).result.players.Bo.partner).toBeNull();
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  await fireEvent.press(screen.getByLabelText("30 Points"));
  expect(last(onChange)).toBeNull(); // Ada has no 30 points, but the coalition is kept
  await type("Player 1 score", "30");
  expect(last(onChange).result.players.Bo.partner).toBe("Ada");
});

test("reports the map, deck and any number of landmarks", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Dominance"));
  expect(last(onChange).result).toMatchObject({ map: "autumn", deck: "standard", landmarks: [] });
  await pick("Map", "lake");
  for (const l of ["Black Market", "Lost City", "Elder Treetop", "The Ferry", "The Tower"]) await fireEvent.press(screen.getByLabelText(l));
  expect(last(onChange).result).toMatchObject({ map: "lake", landmarks: ["black_market", "lost_city", "elder_treetop", "the_ferry", "the_tower"] });
  await fireEvent.press(screen.getByLabelText("Lost City")); // unticking removes it
  expect(last(onChange).result.landmarks).not.toContain("lost_city");
});

test("30 Points and Dominance exclude each other, and one is always chosen", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  const checked = (l: string) => screen.getByLabelText(l).props.accessibilityState.checked;
  expect([checked("30 Points"), checked("Dominance")]).toEqual([true, false]);
  await fireEvent.press(screen.getByLabelText("Dominance"));
  expect([checked("30 Points"), checked("Dominance")]).toEqual([false, true]);
  await fireEvent.press(screen.getByLabelText("Dominance")); // ticking the chosen one again changes nothing
  expect([checked("30 Points"), checked("Dominance")]).toEqual([false, true]);
  await fireEvent.press(screen.getByLabelText("30 Points"));
  expect([checked("30 Points"), checked("Dominance")]).toEqual([true, false]);
});

test("offers the Exiles and Partisans deck and the Homeland options", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Dominance"));
  await pick("Deck", "exiles_and_partisans");
  await pick("Map", "gorge");
  await pick("Player 2 faction", "twilight_council");
  await fireEvent.press(screen.getByLabelText("Mousehold"));
  expect(last(onChange).result).toMatchObject({ deck: "exiles_and_partisans", map: "gorge", landmarks: ["mousehold"] });
  expect(last(onChange).result.players.Bo.faction).toBe("twilight_council");
});

test("shows one step at a time and keeps what was typed between steps", async () => {
  const onChange = jest.fn();
  const { rerender } = await render(<Form onChange={onChange} step="players" />);
  expect(screen.queryByLabelText("Map")).toBeNull();
  await type("Player 1 name", "Ada");
  await rerender(<Form onChange={onChange} step="setup" />);
  expect(screen.getByLabelText("Map")).toBeTruthy();
  expect(screen.queryByLabelText("Player 1 name")).toBeNull();
  await rerender(<Form onChange={onChange} step="none" />);
  expect(screen.queryByLabelText("Map")).toBeNull();
  await rerender(<Form onChange={onChange} step="players" />);
  expect(screen.getByLabelText("Player 1 name").props.value).toBe("Ada");
});

test("waits for the game's data before showing the form", async () => {
  mockData = null;
  await render(<Form onChange={jest.fn()} />);
  expect(screen.getByText("Loading Root options…")).toBeTruthy();
  expect(screen.queryByLabelText("Map")).toBeNull();
});

test("options come from the data file: a new entry appears and a retired one does not", async () => {
  mockData = { ...realData, landmarks: [...realData.landmarks.filter((l: { id: string }) => !["mousehold", "foxburrow"].includes(l.id)), { id: "moon_base", label: "Moon Base", expansion: "future" }, { id: "foxburrow", label: "Foxburrow", expansion: "homeland", retired: true }] };
  await render(<Form onChange={jest.fn()} step="setup" />);
  expect(screen.getByLabelText("Moon Base")).toBeTruthy();
  expect(screen.queryByLabelText("Foxburrow")).toBeNull(); // retired
  expect(screen.queryByLabelText("Mousehold")).toBeNull(); // removed
});

test("the points target and the faction flags come from the data", async () => {
  mockData = { ...realData, rules: { points_to_win: 40 } };
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await type("Player 1 score", "35");
  expect(screen.getByText(/A 40 point victory needs at least 40 points/)).toBeTruthy();
  await type("Player 1 score", "40");
  expect(last(onChange)).not.toBeNull();
});
