import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api, useAuth } from "../../../auth";
import { Button, Message, Screen, Text } from "../../../components/ui";
import { games, Session } from "../../../games";

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session: auth } = useAuth();
  const [s, setS] = useState<Session | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/sessions/${id}`, auth!.access_token)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError("Could not load this session."));
  }, [id]);

  async function remove() {
    const res = await api(`/sessions/${id}`, auth!.access_token, { method: "DELETE" });
    if (res.ok) router.dismissTo("/results");
    else setError("Could not delete the session. Try again.");
  }

  const def = s && games[s.game];
  return (
    <Screen>
      {s && <Text>{def?.name ?? s.game} · {s.played_on}</Text>}
      {s && def && <def.Detail session={s} />}
      {s?.duration_minutes ? <Text>{s.duration_minutes} minutes</Text> : null}
      {s?.notes ? <Text>{s.notes}</Text> : null}
      <Message error text={error} />
      {s && (confirming ? (
        <>
          <Button title="Confirm delete" onPress={remove} />
          <Button secondary title="Cancel" onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button secondary title="Delete session" onPress={() => setConfirming(true)} />
      ))}
      <Button secondary title="Back" onPress={() => router.back()} />
    </Screen>
  );
}
