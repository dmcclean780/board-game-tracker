import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { api, auth, useAuth } from "../auth";
import { Button, Message, Screen } from "../components/ui";
import { games, Session } from "../games";

export default function Home() {
  const { session, me } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api("/sessions", session!.access_token)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setSessions)
        .catch(() => setError("Could not load your sessions."));
    }, [session?.access_token]),
  );

  async function deleteAccount() {
    const res = await api("/me", session!.access_token, { method: "DELETE" });
    if (res.ok) await auth.signOut();
    else setError("Could not delete the account. Try again.");
  }

  return (
    <Screen title={`Hi, ${me?.display_name}`}>
      <Button title="Record session" onPress={() => router.push("/sessions/new")} />
      {sessions?.length === 0 && <Message text="No sessions yet." />}
      {sessions?.map((x) => (
        <Pressable key={x.id} accessibilityRole="link" onPress={() => router.push(`/sessions/${x.id}`)}>
          <Text>{x.played_on} · {games[x.game]?.name ?? x.game} · {games[x.game]?.summary(x)}</Text>
        </Pressable>
      ))}
      <Button secondary title="Sign out" onPress={() => auth.signOut()} />
      {confirming ? (
        <>
          <Message text="Your account will be deleted in 30 days. Sign in before then to restore it." />
          <Button title="Confirm delete" onPress={deleteAccount} />
          <Button secondary title="Cancel" onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button secondary title="Delete account" onPress={() => setConfirming(true)} />
      )}
      <Message error text={error} />
    </Screen>
  );
}
