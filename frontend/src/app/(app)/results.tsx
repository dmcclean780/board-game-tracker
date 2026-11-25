import { MaterialCommunityIcons } from "@expo/vector-icons";
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
          <Pressable key={x.id} accessibilityRole="link" aria-label={`${x.game_name}, ${x.played_on}${x.winners.length ? `, won by ${x.winners.join(", ")}` : ""}`} onPress={() => router.push(`/sessions/${x.id}`)} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.row}>
              <Text style={s.game}>{x.game_name}</Text>
              <Text style={{ color: c.muted }}>{x.played_on}</Text>
            </View>
            {x.winners.length > 0 && (
              <View style={[s.row, { justifyContent: "flex-start", gap: 6 }]}>
                <MaterialCommunityIcons name="crown" size={18} color={c.gold} />
                <Text>{x.winners.join(", ")}</Text>
              </View>
            )}
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
  card: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  game: { fontWeight: "600" },
  fab: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  plus: { fontSize: 32, lineHeight: 36 },
});
