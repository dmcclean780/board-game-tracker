import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { api, useAuth } from "../../auth";
import { Button, DateField, Field, Heading, Message, Screen, Select } from "../../components/ui";
import { games, GameStep } from "../../games";

const STEPS = ["Session", "Setup", "Players", "Notes", "Save"] as const;

export default function NewSession() {
  const [step, setStep] = useState(0);
  const { session } = useAuth();
  const [game, setGame] = useState(Object.keys(games)[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState("");
  const [value, setValue] = useState<{ players: string[]; result: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<string[] | null>(null);

  useEffect(() => {
    api("/games", session!.access_token)
      .then((r) => r.json())
      .then((l: { id: string }[]) => setAvailable(l.map((g) => g.id).filter((id) => id in games)))
      .catch(() => setAvailable(Object.keys(games)));
  }, []);

  const Form = games[game].Form;

  async function save() {
    const res = await api("/sessions", session!.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, played_on: date, notes, duration_minutes: minutes ? Number(minutes) : null, ...value }),
    });
    if (res.status === 201) return router.dismissTo("/");
    setError(res.status === 422 ? await res.text() : "Could not save the session. Try again.");
  }

  const ids = available ?? Object.keys(games);
  const name = STEPS[step];
  const gameStep: GameStep = name === "Setup" ? "setup" : name === "Players" ? "players" : name === "Save" ? "save" : "none";
  return (
    <Screen title="Record session">
      <Text>Step {step + 1} of {STEPS.length}</Text>
      {name === "Session" && (
        <>
          <Heading text="Session" />
          <Select label="Game" value={game} options={ids.map((id) => ({ value: id, label: games[id].name }))} onChange={setGame} />
          <DateField label="Play date" value={date} onChange={setDate} />
          <Field label="Duration in minutes (optional)" hint="e.g. 90" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
        </>
      )}
      <Form key={game} onChange={setValue} step={gameStep} />
      {name === "Notes" && (
        <>
          <Heading text="Notes" />
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} />
        </>
      )}
      {name === "Save" && (
        <>
          <Heading text="Save" />
          <Text>{games[game].name} on {date}{minutes ? ` · ${minutes} minutes` : ""}</Text>
          {value && <Text>Players: {value.players.join(", ")}</Text>}
          {notes ? <Text>Notes: {notes}</Text> : null}
          <Message error text={error} />
          <Button title="Save session" onPress={save} disabled={!value} />
        </>
      )}
      {name !== "Save" && <Button title="Next" onPress={() => setStep(step + 1)} disabled={name === "Players" && !value} />}
      <Button secondary title={step === 0 ? "Cancel" : "Back"} onPress={() => (step === 0 ? router.back() : setStep(step - 1))} />
    </Screen>
  );
}
