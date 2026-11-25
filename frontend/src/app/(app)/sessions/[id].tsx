import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, useAuth } from "../../../auth";
import { Button, Message, Screen, Text } from "../../../components/ui";
import type { Session } from "../../../games";
import { useTheme } from "../../../theme";

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  game: { fontWeight: "600" },
  setup: { flexDirection: "row", gap: 12 },
  title: { width: 96 },
  value: { flex: 1 },
  player: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 12 },
});

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session: auth } = useAuth();
  const { c } = useTheme();
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

  return (
    <Screen>
      {s && (
        <>
          <View style={st.row}>
            <Text style={st.game}>{s.game_name}</Text>
            <Text style={{ color: c.muted }}>{s.played_on}{s.duration_minutes ? ` · ${s.duration_minutes} minutes` : ""}</Text>
          </View>
          {s.details.setup.map((x) => (
            <View key={x.title} style={st.setup}>
              <Text style={[st.title, { color: c.muted }]}>{x.title}</Text>
              <Text style={st.value}>{x.value}</Text>
            </View>
          ))}
          {s.details.players.map((p) => {
            const won = s.winners.includes(p.name);
            return (
              <View key={p.name} accessible aria-label={`${p.name}, ${won ? "winner, " : ""}${p.summary}`} style={[st.player, { borderColor: won ? c.gold + "66" : c.border, backgroundColor: c.surface }]}>
                {won && <MaterialCommunityIcons name="crown" size={18} color={c.gold} />}
                <Text style={st.game}>{p.name}</Text>
                <Text style={{ color: c.muted, flexShrink: 1 }}>{p.summary}</Text>
              </View>
            );
          })}
        </>
      )}
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
