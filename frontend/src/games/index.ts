import type { ComponentType } from "react";
import { root } from "./root";

export type Session = {
  id: string;
  game: string;
  played_on: string;
  notes: string | null;
  duration_minutes: number | null;
  players: string[];
  result: unknown;
};

/** What the app needs per Game. To add a Game: write its screens in `src/games/<id>.tsx` and list it here. */
export type GameDef = {
  name: string;
  /** Reports the players and Result as they are typed, or null while the form breaks a rule (it shows why itself). The server checks again. */
  Form: ComponentType<{ onChange: (v: { players: string[]; result: unknown } | null) => void }>;
  Detail: ComponentType<{ session: Session }>;
  /** One line for the home list. */
  summary: (s: Session) => string;
};

export const games: Record<string, GameDef> = { root };
