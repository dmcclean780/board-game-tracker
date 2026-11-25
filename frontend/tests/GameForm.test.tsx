import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { GameForm } from "../src/games/GameForm";
import { api } from "../src/auth";

// A made-up Game that uses every kind of field, so the generic form is tested without any real Game.
const mockData = {
  form: {
    min_players: 1, max_players: 3, default_players: 2,
    setup: [
      { key: "board", label: "Board", type: "select", options: "boards", filter_by_players: true },
      { key: "extras", label: "Extras", type: "multi", options: "extras" },
      { key: "mode", label: "Mode", type: "choice", options: "modes" },
      { key: "titles", label: "Play with titles", type: "checkbox" },
    ],
    player: [
      { key: "winner", label: "won", type: "winner" },
      { key: "colour", label: "colour", type: "select", options: "colours", unique: true },
      { key: "points", label: "points", type: "number" },
      { key: "title", label: "title", type: "select", options: "titles", blank: "Choose a title", when: "titles" },
      { key: "gems", label: "gem", type: "repeat", options: "gems", unique: true },
      { key: "ally", label: "ally", type: "player", via: "colour", when_flag: "solo", shares: "winner" },
    ],
  },
  boards: [{ id: "b2", label: "Small", players: 2 }, { id: "b3", label: "Big", players: 3 }, { id: "old", label: "Old", players: 2, retired: true }],
  extras: [{ id: "x1", label: "Extra one" }, { id: "x2", label: "Extra two" }],
  modes: [{ id: "short", label: "Short" }, { id: "long", label: "Long" }],
  colours: [{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }, { id: "grey", label: "Grey", shareable: true, solo: true }],
  titles: [{ id: "king", label: "King" }],
  gems: [{ id: "g1", label: "Ruby" }, { id: "g2", label: "Opal" }],
};

jest.mock("../src/auth", () => ({ useAuth: () => ({ session: { access_token: "t" } }), api: jest.fn() }));
jest.mock("../src/games/data", () => ({ ...jest.requireActual("../src/games/data"), useGameData: () => mockData }));

const pick = (label: string, value: string) => fireEvent(screen.getByLabelText(label), "valueChange", value);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const sent = () => JSON.parse((api as jest.Mock).mock.calls.at(-1)[2].body);
const check = (status: number, text = "") => (api as jest.Mock).mockResolvedValue({ status, text: async () => text });

beforeEach(() => {
  (api as jest.Mock).mockReset();
  check(204);
});

async function fill(onChange = jest.fn()) {
  await render(<GameForm gameId="fake" onChange={onChange} />);
  await type("Player 1 name", "Ada");
  await type("Player 2 name", "Bo");
  return onChange;
}

test("builds the players and Result from the schema, and reports them once the server accepts", async () => {
  const onChange = await fill();
  await type("Player 1 points", "12");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ players: ["Ada", "Bo"] })));
  expect((api as jest.Mock).mock.calls.at(-1)[0]).toBe("/games/fake/check");
  expect(sent().result).toEqual({
    board: "b2", extras: [], mode: "short", titles: false,
    players: {
      Ada: { winner: true, colour: "red", points: 12, title: null, gems: [], ally: null },
      Bo: { winner: false, colour: "blue", points: 0, title: null, gems: [], ally: null },
    },
  });
});

test("reports nothing and shows the server's reason while the server says no", async () => {
  check(422, "exactly one player must win");
  const onChange = await fill();
  expect(await screen.findByText("exactly one player must win")).toBeTruthy();
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test("lists come from the data: boards follow the player count, retired entries are hidden", async () => {
  await fill();
  await waitFor(() => expect(sent().result.board).toBe("b2"));
  await pick("Number of players", "3");
  await waitFor(() => expect(sent().result.board).toBe("b3"));
  expect(sent().players).toEqual(["Ada", "Bo", ""]);
  expect(screen.queryByText("Old")).toBeNull();
});

test("setup: multi boxes, one-of-many choice and a checkbox that reveals a player field", async () => {
  await fill();
  await fireEvent.press(screen.getByLabelText("Extra two"));
  await fireEvent.press(screen.getByLabelText("Long"));
  expect(screen.queryByLabelText("Player 1 title")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Play with titles"));
  await pick("Player 1 title", "king");
  await waitFor(() => expect(sent().result.players.Ada.title).toBe("king"));
  expect(sent().result.extras).toEqual(["x2"]);
  expect(sent().result.mode).toBe("long");
  expect(sent().result.players.Bo.title).toBe(""); // nothing chosen yet
});

test("a unique option held by another player is marked taken, but a shareable one is not", async () => {
  await fill();
  await pick("Player 2 colour", "red"); // taken: ignored
  await waitFor(() => expect(sent().result.players.Bo.colour).toBe("blue"));
  await pick("Player 1 colour", "grey");
  await pick("Player 2 colour", "grey"); // shareable: both may hold it
  await waitFor(() => expect(sent().result.players).toMatchObject({ Ada: { colour: "grey" }, Bo: { colour: "grey" } }));
});

test("repeat adds the first free entry, never one another player holds, and removes", async () => {
  await fill();
  await fireEvent.press(screen.getByText("Add gem for player 1"));
  await fireEvent.press(screen.getByText("Add gem for player 2"));
  await waitFor(() => expect(sent().result.players.Bo.gems).toEqual(["g2"]));
  expect(sent().result.players.Ada.gems).toEqual(["g1"]);
  expect(screen.getByText("Add gem for player 1").props.accessibilityState?.disabled ?? true).toBeTruthy();
  await fireEvent.press(screen.getByText("Remove player 1 gem 1"));
  await waitFor(() => expect(sent().result.players.Ada.gems).toEqual([]));
});

test("only one player wins", async () => {
  await fill();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByLabelText("Player 2 won"));
  await waitFor(() => expect(sent().result.players).toMatchObject({ Ada: { winner: false }, Bo: { winner: true } }));
});

test("a linked player shares the partner's win, and the link drops when it stops being valid", async () => {
  await fill();
  await pick("Player 2 colour", "grey");
  await pick("Player 2 ally", "0");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(screen.getByLabelText("Player 2 won (with Ada)")).toBeTruthy();
  await waitFor(() => expect(sent().result.players).toMatchObject({ Ada: { winner: true }, Bo: { winner: true, ally: "Ada" } }));
  await pick("Player 2 colour", "blue");
  await waitFor(() => expect(sent().result.players.Bo).toMatchObject({ winner: false, ally: null }));
  expect(screen.queryByLabelText("Player 2 ally")).toBeNull();
});

test("a partner may itself be linked, and the whole chain wins together", async () => {
  await fill();
  await pick("Number of players", "3");
  await type("Player 3 name", "Cy");
  await pick("Player 2 colour", "grey");
  await pick("Player 3 colour", "grey");
  await pick("Player 2 ally", "0");
  await pick("Player 3 ally", "1");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await waitFor(() => expect(sent().result.players).toMatchObject({ Ada: { winner: true }, Bo: { winner: true, ally: "Ada" }, Cy: { winner: true, ally: "Bo" } }));
});
