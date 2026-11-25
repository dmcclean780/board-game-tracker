import { useEffect, useState } from "react";
import { View } from "react-native";
import { Checkbox, Field, Heading, Message, Select, Text } from "../components/ui";
import { useTheme } from "../theme";
import { Entry, labelOf, useGameData } from "./data";
import type { GameDef, GameStep, Session } from "./index";

/** backend/games/old-kings-crown/data.json */
type OkcData = { houses: Entry[] };

type Row = { name: string; score: string; winner: boolean; house: string };

type OkcResult = { players: Record<string, { house: string; score: number; winner: boolean }> };

const blank: Row = { name: "", score: "", winner: false, house: "" };

/** The first rule the Session breaks, mirroring the server's checks; null when it is fine to save. */
function problem(rows: Row[]): string | null {
  const names = rows.map((r) => r.name.trim());
  if (names.some((n) => !n)) return "Enter a name for every player.";
  if (new Set(names).size !== names.length) return "Player names must be different.";
  if (rows.some((r) => !r.house)) return "Pick a house for every player.";
  if (rows.some((r) => Number(r.score) < 0)) return "Score cannot be negative.";
  const won = rows.filter((r) => r.winner);
  if (won.length !== 1) return "Tick Won for the player who won.";
  if (rows.some((r) => Number(r.score) > Number(won[0].score))) return "The winner cannot have a lower score than another player.";
  return null;
}

type Value = { players: string[]; result: unknown } | null;
type FormProps = { onChange: (v: Value) => void; step?: GameStep };

// The data arrives from the server, so the form waits for it; once loaded it stays mounted so nothing typed is lost.
function OkcForm(props: FormProps) {
  const data = useGameData<OkcData>("old-kings-crown");
  return data ? <OkcFormBody data={data} {...props} /> : <Text>Loading Old King's Crown options…</Text>;
}

function OkcFormBody({ data: d, onChange, step }: FormProps & { data: OkcData }) {
  const { c } = useTheme();
  // Four rows are kept so lowering the count and raising it again loses nothing.
  const [all, setAll] = useState<Row[]>([blank, blank, blank, blank]);
  const [count, setCount] = useState(2);

  const rows = all.slice(0, count);
  const error = problem(rows);
  const houses = d.houses.filter((h) => !h.retired);

  useEffect(() => {
    if (error) return onChange(null);
    const players: OkcResult["players"] = {};
    for (const r of rows) players[r.name.trim()] = { house: r.house, score: Number(r.score) || 0, winner: r.winner };
    onChange({ players: rows.map((r) => r.name.trim()), result: { players } });
  }, [all, count]);

  // Only one player wins: ticking Won clears everyone else.
  const set = (i: number, patch: Partial<Row>) => setAll((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : patch.winner ? { ...r, winner: false } : r)));
  const taken = (house: string, i: number) => rows.some((r, j) => j !== i && r.house === house);

  // No step given shows everything.
  const show = (s: GameStep) => step === undefined || step === s;
  return (
    <View style={{ gap: 12 }}>
      {show("setup") && (
        <>
          <Heading text="Setup" />
          <Select label="Number of players" value={String(count)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => setCount(Number(v))} />
        </>
      )}
      {show("players") && (
        <>
          <Heading text="Players" />
          {rows.map((r, i) => (
            <View key={i} style={{ gap: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 8, padding: 12 }}>
              <Text style={{ fontWeight: "600" }}>Player {i + 1}</Text>
              <Field label={`Player ${i + 1} name`} hint="e.g. Ada" autoCapitalize="words" value={r.name} onChangeText={(name) => set(i, { name })} />
              <Checkbox label={`Player ${i + 1} won`} checked={r.winner} onChange={(winner) => set(i, { winner })} />
              <Select
                label={`Player ${i + 1} house`}
                value={r.house}
                options={[{ value: "", label: "Choose a house" }, ...houses.map((h) => ({ value: h.id, label: taken(h.id, i) ? `${h.label} (taken)` : h.label, disabled: taken(h.id, i) }))]}
                onChange={(house) => set(i, { house })}
              />
              <Field label={`Player ${i + 1} score`} hint="0" keyboardType="number-pad" value={r.score} onChangeText={(score) => set(i, { score })} />
            </View>
          ))}
        </>
      )}
      {(show("players") || step === "save") && <Message text={error} />}
    </View>
  );
}

const winners = (s: Session) => Object.entries((s.result as OkcResult).players).filter(([, p]) => p.winner).map(([n]) => n);

function OkcDetail({ session }: { session: Session }) {
  const r = session.result as OkcResult;
  const d = useGameData<OkcData>("old-kings-crown");
  return (
    <View style={{ gap: 4 }}>
      {Object.entries(r.players).map(([name, p]) => (
        <Text key={name}>
          {name} · {labelOf(d?.houses, p.house)} · {p.score} points{p.winner ? " · winner" : ""}
        </Text>
      ))}
    </View>
  );
}

export const oldKingsCrown: GameDef = { name: "Old King's Crown", Form: OkcForm, Detail: OkcDetail, summary: (s) => `Won by ${winners(s).join(", ")}` };
