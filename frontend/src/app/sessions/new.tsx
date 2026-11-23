import { router } from "expo-router";
import { useEffect, useState } from "react";
import { api, useAuth } from "../../auth";
import { Button, DateField, Field, Heading, Message, Screen, Select } from "../../components/ui";
import { games } from "../../games";

export default function NewSession() {
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
  return (
    <Screen title="Record session">
      <Heading text="Session" />
      <Select label="Game" value={game} options={ids.map((id) => ({ value: id, label: games[id].name }))} onChange={setGame} />
      <DateField label="Play date" value={date} onChange={setDate} />
      <Field label="Duration in minutes (optional)" hint="e.g. 90" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
      <Form key={game} onChange={setValue} />
      <Heading text="Notes" />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} />
      <Message error text={error} />
      <Button title="Save session" onPress={save} disabled={!value} />
      <Button secondary title="Cancel" onPress={() => router.back()} />
    </Screen>
  );
}
