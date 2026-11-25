export type Session = {
  id: string;
  game: string;
  played_on: string;
  notes: string | null;
  duration_minutes: number | null;
  players: string[];
  result: unknown;
  /** Written by the server, so the app has no Game-specific code: the Game's name, the Results-list winners and the Session screen's setup items and Player lines. */
  game_name: string;
  winners: string[];
  details: { setup: { title: string; value: string }[]; players: { name: string; summary: string }[] };
};

/** The parts of a Game's form shown one screen at a time; "none" shows nothing but keeps the form's state. */
export type GameStep = "setup" | "players" | "save" | "none";
