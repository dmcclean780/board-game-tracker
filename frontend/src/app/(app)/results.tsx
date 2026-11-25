import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, useAuth } from "../../auth";
import { Message, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { Session } from "../../games";

export default function Results() {
  const { session } = useAuth();
  const { c } = useTheme();
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
            <Text>{x.played_on} · {x.game_name} · {x.summary}</Text>
          </Pressable>
        ))}
        <Message error text={error} />
      </Screen>
      <Pressable accessibilityRole="button" aria-label="Record session" onPress={() => router.push("/sessions/new")} style={[s.fab, { backgroundColor: c.primary }]}>
        <Text style={[s.plus, { color: c.onPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fab: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  plus: { fontSize: 32, lineHeight: 36 },
});
