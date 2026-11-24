import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, useAuth } from "../../auth";
import { Message, Screen } from "../../components/ui";
import { games, Session } from "../../games";

export default function Results() {
  const { session } = useAuth();
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

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {sessions?.length === 0 && <Message text="No sessions yet." />}
        {sessions?.map((x) => (
          <Pressable key={x.id} accessibilityRole="link" onPress={() => router.push(`/sessions/${x.id}`)}>
            <Text>{x.played_on} · {games[x.game]?.name ?? x.game} · {games[x.game]?.summary(x)}</Text>
          </Pressable>
        ))}
        <Message error text={error} />
      </Screen>
      <Pressable accessibilityRole="button" aria-label="Record session" onPress={() => router.push("/sessions/new")} style={s.fab}>
        <Text style={s.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fab: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: "#1a56db", alignItems: "center", justifyContent: "center" },
  plus: { color: "#fff", fontSize: 32, lineHeight: 36 },
});
