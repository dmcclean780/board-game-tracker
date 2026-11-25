import { fireEvent, render, screen } from "@testing-library/react-native";
import { games } from "../src/games";

// The real data file, so these tests fail if the form and the file drift apart.
const mockData = require("../../backend/games/old-kings-crown/data.json");
jest.mock("../src/auth", () => ({ useAuth: jest.fn(), api: jest.fn() }));
jest.mock("../src/games/data", () => ({ ...jest.requireActual("../src/games/data"), useGameData: () => mockData }));

const Form = games["old-kings-crown"].Form;
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
  await pick("Player 1 house", "clans");
  await pick("Player 2 house", "nobility");
  await type("Player 1 score", "12");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  const { players, result } = last(onChange);
  expect(players).toEqual(["Ada", "Bo"]);
  expect(result.players.Ada).toEqual({ house: "clans", score: 12, winner: true });
});

test("explains what is wrong, including a winner with a lower score", async () => {
  await render(<Form onChange={jest.fn()} />);
  expect(screen.getByText("Enter a name for every player.")).toBeTruthy();
  await names();
  expect(screen.getByText("Pick a house for every player.")).toBeTruthy();
  await pick("Player 1 house", "clans");
  await pick("Player 2 house", "nobility");
  expect(screen.getByText("Tick Won for the player who won.")).toBeTruthy();
  await type("Player 2 score", "5");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(screen.getByText("The winner cannot have a lower score than another player.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Player 2 won"));
  expect(screen.queryByText(/lower score/)).toBeNull();
});

test("a house another player holds cannot be picked", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await names();
  await pick("Player 1 house", "clans");
  await pick("Player 2 house", "clans"); // taken: ignored
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(last(onChange)).toBeNull();
  await pick("Player 2 house", "nobility");
  expect(last(onChange).result.players.Bo.house).toBe("nobility");
});

test("one player is enough, and the player count follows the dropdown", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await pick("Number of players", "1");
  expect(screen.queryByLabelText("Player 2 name")).toBeNull();
  await type("Player 1 name", "Ada");
  await pick("Player 1 house", "uprising");
  await fireEvent.press(screen.getByLabelText("Player 1 won"));
  expect(last(onChange).players).toEqual(["Ada"]);
});
