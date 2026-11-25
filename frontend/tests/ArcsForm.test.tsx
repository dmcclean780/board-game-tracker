import { fireEvent, render, screen } from "@testing-library/react-native";
import { games } from "../src/games";

// The real data file, so these tests fail if the form and the file drift apart.
const mockData = require("../../backend/games/arcs/data.json");
jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));
jest.mock("../src/games/data", () => ({ ...jest.requireActual("../src/games/data"), useGameData: () => mockData }));

const Form = games.arcs.Form;
const pick = (label: string, value: string) => fireEvent(screen.getByLabelText(label), "valueChange", value);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const last = (fn: jest.Mock) => fn.mock.calls.at(-1)[0];
const names = async () => {
  await type("Player 1 name", "Ada");
  await type("Player 2 name", "Bo");
};

test("reports the players and a Result once the form is valid", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  expect(last(onChange)).toBeNull();
  await names();
  await type("Player 1 power", "12");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  const { players, result } = last(onChange);
  expect(players).toEqual(["Ada", "Bo"]);
  expect(result.setup).toBe("2p_mix_up_1");
  expect(result.leaders).toBe(false);
  expect(result.players.Ada).toEqual({ power: 12, winner: true, leader: null, lore: [] });
});

test("explains what is wrong, including a winner with less power", async () => {
  await render(<Form onChange={jest.fn()} />);
  expect(screen.getByText("Enter a name for every player.")).toBeTruthy();
  await names();
  expect(screen.getByText("Tick Won for the player who won.")).toBeTruthy();
  await type("Player 2 power", "5");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(screen.getByText("The winner cannot have less power than another player.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Player 2 won"));
  expect(screen.queryByText(/less power/)).toBeNull();
});

test("the setup cards follow the number of players", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await pick("Number of players", "3");
  await type("Player 1 name", "Ada");
  await type("Player 2 name", "Bo");
  await type("Player 3 name", "Cy");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(last(onChange).result.setup).toBe("3p_mix_up");
  expect(last(onChange).players).toEqual(["Ada", "Bo", "Cy"]);
  await pick("Setup card", "3p_core_conflict");
  expect(last(onChange).result.setup).toBe("3p_core_conflict");
  await pick("Number of players", "2");
  expect(last(onChange).result.setup).toBe("2p_mix_up_1");
  expect(screen.queryByLabelText("Player 3 name")).toBeNull();
});

test("leaders are all or none, and one player holds each", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(screen.queryByLabelText("Player 1 leader")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Play with leaders"));
  expect(screen.getByText("Pick a leader for every player.")).toBeTruthy();
  await pick("Player 1 leader", "elder");
  await pick("Player 2 leader", "elder"); // taken: ignored
  expect(last(onChange)).toBeNull();
  await pick("Player 2 leader", "corsair"); // from the Leaders & Lore pack
  expect(last(onChange).result.players.Bo.leader).toBe("corsair");
  await fireEvent.press(screen.getByLabelText("Play with leaders"));
  expect(last(onChange).result.players.Bo.leader).toBeNull();
});

test("a player can add and remove any number of lore cards, and each is held once", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  await fireEvent.press(screen.getByText("Add lore for player 1"));
  await fireEvent.press(screen.getByText("Add lore for player 1"));
  await fireEvent.press(screen.getByText("Add lore for player 2"));
  const { Ada, Bo } = last(onChange).result.players;
  expect(Ada.lore).toHaveLength(2);
  expect(new Set([...Ada.lore, ...Bo.lore]).size).toBe(3); // each card is given out once
  await pick("Player 2 lore 1", Ada.lore[0]); // taken: ignored
  expect(last(onChange).result.players.Bo.lore).toEqual(Bo.lore);
  await fireEvent.press(screen.getByText("Remove player 1 lore 1"));
  expect(last(onChange).result.players.Ada.lore).toEqual([Ada.lore[1]]);
});
