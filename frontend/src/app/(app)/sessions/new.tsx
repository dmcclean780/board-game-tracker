import { router } from "expo-router";
import { useEffect, useState } from "react";
import { api, useAuth } from "../../../auth";
import { Button, DateField, Field, Heading, Message, Screen, Select, Text } from "../../../components/ui";
import { GameForm } from "../../../games/GameForm";
import type { GameStep } from "../../../games";

const STEPS = ["Session", "Setup", "Players", "Save"] as const;

export default function NewSession() {
  const [step, setStep] = useState(0);
  const { session } = useAuth();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  const [game, setGame] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState("");
  const [value, setValue] = useState<{ players: string[]; result: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api("/games", session!.access_token)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((l: { id: string; name: string }[]) => {
        setList(l);
        setGame(l[0].id);
      })
      .catch(() => setLoadError(true));
  }, []);

  async function save() {
    const res = await api("/sessions", session!.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, played_on: date, notes, duration_minutes: minutes ? Number(minutes) : null, ...value }),
    });
    if (res.status === 201) return router.dismissTo("/results");
    setError(res.status === 422 ? await res.text() : "Could not save the session. Try again.");
  }

  const gameName = list?.find((g) => g.id === game)?.name ?? "";
  const name = STEPS[step];
  const gameStep: GameStep = name === "Setup" ? "setup" : name === "Players" ? "players" : name === "Save" ? "save" : "none";
  if (loadError) return <Screen><Message error text="Could not load the games." /></Screen>;
  return (
    <Screen>
      <Text>Step {step + 1} of {STEPS.length}</Text>
      {name === "Session" && (
        <>
          <Heading text="Session" />
          <Select label="Game" value={game} options={(list ?? []).map((g) => ({ value: g.id, label: g.name }))} onChange={setGame} />
          <DateField label="Play date" value={date} onChange={setDate} />
          <Field label="Duration in minutes (optional)" hint="e.g. 90" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
        </>
      )}
      {game && <GameForm key={game} gameId={game} onChange={setValue} step={gameStep} />}
      {name === "Save" && (
        <>
          <Heading text="Save" />
          <Text>{gameName} on {date}{minutes ? ` · ${minutes} minutes` : ""}</Text>
          {value && <Text>Players: {value.players.join(", ")}</Text>}
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} />
          <Message error text={error} />
          <Button title="Save session" onPress={save} disabled={!value} />
        </>
      )}
      {name !== "Save" && <Button title="Next" onPress={() => setStep(step + 1)} disabled={name === "Players" && !value} />}
      <Button secondary title={step === 0 ? "Cancel" : "Back"} onPress={() => (step === 0 ? router.back() : setStep(step - 1))} />
    </Screen>
  );
}
