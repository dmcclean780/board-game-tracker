import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Field } from "../components/ui";
import type { GameDef, Session } from "./index";

const FACTIONS: [string, string][] = [
  ["marquise_de_cat", "Marquise de Cat"],
  ["eyrie_dynasties", "Eyrie Dynasties"],
  ["woodland_alliance", "Woodland Alliance"],
  ["vagabond", "Vagabond"],
  ["riverfolk_company", "Riverfolk Company"],
  ["lizard_cult", "Lizard Cult"],
  ["underground_duchy", "Underground Duchy"],
  ["corvid_conspiracy", "Corvid Conspiracy"],
  ["keepers_in_iron", "Keepers in Iron"],
  ["lord_of_the_hundreds", "Lord of the Hundreds"],
];
const factionName = (id: string) => FACTIONS.find(([k]) => k === id)?.[1] ?? id;

type Row = { name: string; faction: string; score: string; winner: boolean; partner: string };
const blank = (): Row => ({ name: "", faction: FACTIONS[0][0], score: "", winner: false, partner: "" });

type RootResult = { victory: string; players: Record<string, { faction: string; score: number; winner: boolean; partner: string | null }> };

function RootForm({ onChange }: { onChange: (v: { players: string[]; result: unknown }) => void }) {
  const [rows, setRows] = useState<Row[]>([blank(), blank()]);
  const [victory, setVictory] = useState("points");

  useEffect(() => {
    const players: RootResult["players"] = {};
    for (const r of rows) {
      players[r.name.trim()] = { faction: r.faction, score: Number(r.score) || 0, winner: r.winner, partner: r.faction === "vagabond" && r.partner ? r.partner : null };
    }
    onChange({ players: rows.map((r) => r.name.trim()), result: { victory, players } });
  }, [rows, victory]);

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cycle = <T,>(list: T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length];

  return (
    <View style={{ gap: 12 }}>
      <Button secondary title={`Victory: ${victory === "points" ? "30 points" : "Dominance"}`} onPress={() => setVictory(victory === "points" ? "dominance" : "points")} />
      {rows.map((r, i) => {
        const partners = ["", ...rows.filter((o, j) => j !== i && o.faction !== "vagabond" && o.name.trim()).map((o) => o.name.trim())];
        return (
          <View key={i} style={{ gap: 8 }}>
            <Field label={`Player ${i + 1} name`} autoCapitalize="words" value={r.name} onChangeText={(name) => set(i, { name })} />
            <Button secondary title={`Faction: ${factionName(r.faction)}`} onPress={() => set(i, { faction: cycle(FACTIONS.map(([k]) => k), r.faction), partner: "" })} />
            <Field label={`Player ${i + 1} score`} keyboardType="number-pad" value={r.score} onChangeText={(score) => set(i, { score })} />
            {r.faction === "vagabond" && (
              <Button secondary title={`Coalition with: ${r.partner || "nobody"}`} onPress={() => set(i, { partner: cycle(partners, partners.includes(r.partner) ? r.partner : "") })} />
            )}
            <Button secondary title={r.winner ? "Winner ✓" : "Winner?"} onPress={() => set(i, { winner: !r.winner })} />
          </View>
        );
      })}
      <Button secondary title="Add player" onPress={() => setRows([...rows, blank()])} />
      {rows.length > 1 && <Button secondary title="Remove last player" onPress={() => setRows(rows.slice(0, -1))} />}
    </View>
  );
}

const winners = (s: Session) => Object.entries((s.result as RootResult).players).filter(([, p]) => p.winner).map(([n]) => n);

function RootDetail({ session }: { session: Session }) {
  const r = session.result as RootResult;
  return (
    <View style={{ gap: 4 }}>
      <Text>{r.victory === "points" ? "30 point victory" : "Dominance victory"}</Text>
      {Object.entries(r.players).map(([name, p]) => (
        <Text key={name}>
          {name} · {factionName(p.faction)} · {p.score}
          {p.partner ? ` · coalition with ${p.partner}` : ""}
          {p.winner ? " · winner" : ""}
        </Text>
      ))}
    </View>
  );
}

export const root: GameDef = { name: "Root", Form: RootForm, Detail: RootDetail, summary: (s) => `Won by ${winners(s).join(", ")}` };
