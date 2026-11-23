import { fireEvent, render, screen } from "@testing-library/react-native";
import { games } from "../src/games";

const Form = games.root.Form;

test("reports players and Root result as they are typed", async () => {
  const onChange = jest.fn();
  await render(<Form onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText("Player 1 name"), "Ada");
  await fireEvent.changeText(screen.getByLabelText("Player 1 score"), "30");
  await fireEvent.press(screen.getAllByText("Winner?")[0]);
  const { players, result } = onChange.mock.calls.at(-1)[0];
  expect(players).toEqual(["Ada", ""]);
  expect(result.victory).toBe("points");
  expect(result.players.Ada).toEqual({ faction: "marquise_de_cat", score: 30, winner: true, partner: null });
});

test("only a Vagabond can pick a coalition partner", async () => {
  await render(<Form onChange={jest.fn()} />);
  expect(screen.queryByText(/Coalition with/)).toBeNull();
  for (let i = 0; i < 3; i++) await fireEvent.press(screen.getAllByText(/^Faction:/)[0]); // marquise -> eyrie -> woodland -> vagabond
  expect(screen.getByText("Coalition with: nobody")).toBeTruthy();
});
