import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Checkbox, Field, Heading, Message, Select, Text } from "../components/ui";
import { useTheme } from "../theme";
import { Entry, labelOf, useGameData } from "./data";
import type { GameDef, GameStep, Session } from "./index";

/** backend/games/arcs/data.json; a setup card's `players` is the player count it is for. */
type ArcsData = { setups: (Entry & { players: number })[]; leaders: Entry[]; lore: Entry[] };

type Row = { name: string; power: string; winner: boolean; leader: string; lore: string[] };

type ArcsResult = { setup: string; leaders: boolean; players: Record<string, { power: number; winner: boolean; leader: string | null; lore: string[] }> };

const blank: Row = { name: "", power: "", winner: false, leader: "", lore: [] };
const offered = <T extends Entry>(list: T[]) => list.filter((e) => !e.retired);

/** Another player (or another slot of this one) already holds this card. */
const heldElsewhere = (rows: Row[], pick: (r: Row) => string[], card: string, except: [number, number]) =>
  rows.some((r, i) => pick(r).some((c, j) => c === card && !(i === except[0] && j === except[1])));

/** The first rule the Session breaks, mirroring the server's checks; null when it is fine to save. */
function problem(rows: Row[], leaders: boolean): string | null {
  const names = rows.map((r) => r.name.trim());
  if (names.some((n) => !n)) return "Enter a name for every player.";
  if (new Set(names).size !== names.length) return "Player names must be different.";
  if (rows.some((r) => Number(r.power) < 0)) return "Power cannot be negative.";
  if (leaders && rows.some((r) => !r.leader)) return "Pick a leader for every player.";
  const won = rows.filter((r) => r.winner);
  if (won.length !== 1) return "Tick Won for the player who won.";
  if (rows.some((r) => Number(r.power) > Number(won[0].power))) return "The winner cannot have less power than another player.";
  return null;
}

type Value = { players: string[]; result: unknown } | null;
type FormProps = { onChange: (v: Value) => void; step?: GameStep };

// The data arrives from the server, so the form waits for it; once loaded it stays mounted so nothing typed is lost.
function ArcsForm(props: FormProps) {
  const data = useGameData<ArcsData>("arcs");
  return data ? <ArcsFormBody data={data} {...props} /> : <Text>Loading Arcs options…</Text>;
}

function ArcsFormBody({ data: d, onChange, step }: FormProps & { data: ArcsData }) {
  const { c } = useTheme();
  // Four rows are kept so lowering the count and raising it again loses nothing.
  const [all, setAll] = useState<Row[]>([blank, blank, blank, blank]);
  const [count, setCount] = useState(2);
  const [setupId, setSetupId] = useState("");
  const [leaders, setLeaders] = useState(false);

  const rows = all.slice(0, count);
  const setups = offered(d.setups).filter((s) => s.players === count);
  // A setup card chosen for another player count no longer applies.
  const setup = setups.some((s) => s.id === setupId) ? setupId : setups[0].id;
  const error = problem(rows, leaders);

  useEffect(() => {
    if (error) return onChange(null);
    const players: ArcsResult["players"] = {};
    for (const r of rows) players[r.name.trim()] = { power: Number(r.power) || 0, winner: r.winner, leader: leaders ? r.leader : null, lore: r.lore };
    onChange({ players: rows.map((r) => r.name.trim()), result: { setup, leaders, players } });
  }, [all, count, setup, leaders]);

  // Only one player wins: ticking Won clears everyone else.
  const set = (i: number, patch: Partial<Row>) => setAll((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : patch.winner ? { ...r, winner: false } : r)));
  const heldLeader = (card: string, i: number) => heldElsewhere(rows, (r) => [r.leader], card, [i, 0]);
  const heldLore = (card: string, i: number, j: number) => heldElsewhere(rows, (r) => r.lore, card, [i, j]);
  const loreOptions = (i: number, j: number) => offered(d.lore).map((l) => ({ value: l.id, label: heldLore(l.id, i, j) ? `${l.label} (taken)` : l.label, disabled: heldLore(l.id, i, j) }));
  const nextLore = (i: number) => offered(d.lore).find((l) => !heldLore(l.id, i, -1));

  // No step given shows everything.
  const show = (s: GameStep) => step === undefined || step === s;
  return (
    <View style={{ gap: 12 }}>
      {show("setup") && (
        <>
          <Heading text="Setup" />
          <Select label="Number of players" value={String(count)} options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => setCount(Number(v))} />
          <Select label="Setup card" value={setup} options={setups.map((s) => ({ value: s.id, label: s.label }))} onChange={setSetupId} />
          <Checkbox label="Play with leaders" checked={leaders} onChange={setLeaders} />
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
              <Field label={`Player ${i + 1} power`} hint="0" keyboardType="number-pad" value={r.power} onChangeText={(power) => set(i, { power })} />
              {leaders && (
                <Select
                  label={`Player ${i + 1} leader`}
                  value={r.leader}
                  options={[{ value: "", label: "Choose a leader" }, ...offered(d.leaders).map((l) => ({ value: l.id, label: heldLeader(l.id, i) ? `${l.label} (taken)` : l.label, disabled: heldLeader(l.id, i) }))]}
                  onChange={(leader) => set(i, { leader })}
                />
              )}
              {r.lore.map((card, j) => (
                <View key={j} style={{ gap: 8 }}>
                  <Select label={`Player ${i + 1} lore ${j + 1}`} value={card} options={loreOptions(i, j)} onChange={(v) => set(i, { lore: r.lore.map((x, k) => (k === j ? v : x)) })} />
                  <Button secondary title={`Remove player ${i + 1} lore ${j + 1}`} onPress={() => set(i, { lore: r.lore.filter((_, k) => k !== j) })} />
                </View>
              ))}
              <Button secondary title={`Add lore for player ${i + 1}`} disabled={!nextLore(i)} onPress={() => set(i, { lore: [...r.lore, nextLore(i)!.id] })} />
            </View>
          ))}
        </>
      )}
      {(show("players") || step === "save") && <Message text={error} />}
    </View>
  );
}

const winners = (s: Session) => Object.entries((s.result as ArcsResult).players).filter(([, p]) => p.winner).map(([n]) => n);

function ArcsDetail({ session }: { session: Session }) {
  const r = session.result as ArcsResult;
  const d = useGameData<ArcsData>("arcs");
  return (
    <View style={{ gap: 4 }}>
      <Text>{labelOf(d?.setups, r.setup)} setup · {Object.keys(r.players).length} players{r.leaders ? " · with leaders" : ""}</Text>
      {Object.entries(r.players).map(([name, p]) => (
        <Text key={name}>
          {name} · {p.power} power
          {p.leader ? ` · ${labelOf(d?.leaders, p.leader)}` : ""}
          {p.lore.length > 0 ? ` · Lore: ${p.lore.map((l) => labelOf(d?.lore, l)).join(", ")}` : ""}
          {p.winner ? " · winner" : ""}
        </Text>
      ))}
    </View>
  );
}

export const arcs: GameDef = { name: "Arcs", Form: ArcsForm, Detail: ArcsDetail, summary: (s) => `Won by ${winners(s).join(", ")}` };
