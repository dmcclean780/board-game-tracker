import { fireEvent, render, screen } from "@testing-library/react-native";
import { games } from "../src/games";

const Form = games.root.Form;
const pick = (label: string, value: string) => fireEvent(screen.getByLabelText(label), "valueChange", value);
const last = (fn: jest.Mock) => fn.mock.calls.at(-1)[0];

test("reports players and a points Result as they are typed", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada");
  await fireEvent.changeText(screen.getByLabelText("Player 1 score"), "30");
  await fireEvent.press(screen.getByLabelText("Player 1 winner"));
  const { players, result } = last(onChange);
  expect(players).toEqual(["Ada", ""]);
  expect(result.victory).toBe("points");
  expect(result.players.Ada).toEqual({ faction: "marquise_de_cat", score: 30, winner: true, partner: null });
});

test("a faction held by another player cannot be picked, except Vagabond", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada");
  await fireEvent.changeText(screen.getByLabelText("Player 2 name"), "Bo");
  expect(last(onChange).result.players.Bo.faction).toBe("eyrie_dynasties"); // a new player starts on a free faction
  await pick("Player 2 faction", "marquise_de_cat"); // taken: ignored
  expect(last(onChange).result.players.Bo.faction).toBe("eyrie_dynasties");
  await pick("Player 1 faction", "vagabond");
  await pick("Player 2 faction", "vagabond"); // two Vagabonds are fine
  expect(last(onChange).result.players.Bo.faction).toBe("vagabond");
});

test("a coalition Vagabond wins with their partner, and keeps them when renamed", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  expect(screen.queryByLabelText("Player 2 coalition with")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada");
  await fireEvent.changeText(screen.getByLabelText("Player 2 name"), "Bo");
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  await fireEvent.press(screen.getByLabelText("Player 1 winner"));
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada L");
  const { Bo, "Ada L": ada } = last(onChange).result.players;
  expect(ada.winner).toBe(true);
  expect(Bo).toMatchObject({ winner: true, partner: "Ada L" });
  expect(screen.getByLabelText("Player 2 winner (with Ada L)")).toBeTruthy();
});

test("leaving Vagabond drops the coalition", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada");
  await fireEvent.changeText(screen.getByLabelText("Player 2 name"), "Bo");
  await pick("Player 2 faction", "vagabond");
  await pick("Player 2 coalition with", "0");
  await pick("Player 2 faction", "lizard_cult");
  expect(last(onChange).result.players.Bo.partner).toBeNull();
});

test("'Won by dominance' sets the victory type", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText("Won by dominance"));
  expect(last(onChange).result.victory).toBe("dominance");
});
