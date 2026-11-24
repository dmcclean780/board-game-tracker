import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Checkbox, Field, Heading, Message, Select } from "../components/ui";
import { Entry, labelOf, useGameData } from "./data";
import type { GameDef, GameStep, Session } from "./index";

/** backend/games/root/data.json */
type RootData = { rules: { points_to_win: number }; victories: Entry[]; factions: Entry[]; maps: Entry[]; decks: Entry[]; landmarks: Entry[] };

type Row = { name: string; faction: string; score: string; winner: boolean; partner: number | null };

type RootResult = { map: string; deck: string; landmarks: string[]; victory: string; players: Record<string, { faction: string; score: number; winner: boolean; partner: string | null }> };

// The rules below depend on these two victory ids; everything else is data.
const POINTS = "points";
const DOMINANCE = "dominance";

const nameOf = (r: Row, i: number) => r.name.trim() || `Player ${i + 1}`;
const offered = (list: Entry[]) => list.filter((e) => !e.retired);

/** What the data says about a faction. */
const flags = (d: RootData, faction: string) => d.factions.find((f) => f.id === faction);

/** Another player holds this faction already (unless it is shareable, like the Vagabond). */
const taken = (d: RootData, rows: Row[], i: number, faction: string) => !flags(d, faction)?.shareable && rows.some((r, j) => j !== i && r.faction === faction);

const freeFaction = (d: RootData, rows: Row[]) => (offered(d.factions).find((f) => !taken(d, rows, -1, f.id)) ?? d.factions[0]).id;

/** Only coalition factions have partners, only in a dominance victory, and a partner is another player whose faction cannot form a coalition. */
function tidy(d: RootData, rows: Row[], dominance: boolean): Row[] {
  const can = (faction: string) => !!flags(d, faction)?.coalition;
  return rows.map((r, i) => (r.partner !== null && (!dominance || !can(r.faction) || r.partner === i || can(rows[r.partner]?.faction)) ? { ...r, partner: null } : r));
}

/** The first rule the Session breaks, mirroring the server's checks; null when it is fine to save. */
function problem(d: RootData, rows: Row[], dominance: boolean): string | null {
  const names = rows.map((r) => r.name.trim());
  if (names.some((n) => !n)) return "Enter a name for every player.";
  if (new Set(names).size !== names.length) return "Player names must be different.";
  const leaders = rows.filter((r) => r.winner && r.partner === null);
  if (leaders.length !== 1) return "Tick Won for the player who won.";
  const target = d.rules.points_to_win;
  if (!dominance && Number(leaders[0].score) < target) return `A ${target} point victory needs at least ${target} points; choose Dominance otherwise.`;
  if (rows.some((r) => Number(r.score) < 0)) return "Scores cannot be negative.";
  return null;
}

type Value = { players: string[]; result: unknown } | null;
type FormProps = { onChange: (v: Value) => void; step?: GameStep };

// The data arrives from the server, so the form waits for it; once loaded it stays mounted so nothing typed is lost.
function RootForm(props: FormProps) {
  const data = useGameData<RootData>("root");
  return data ? <RootFormBody data={data} {...props} /> : <Text>Loading Root options…</Text>;
}

function RootFormBody({ data: d, onChange, step }: FormProps & { data: RootData }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const first = { name: "", faction: offered(d.factions)[0].id, score: "", winner: false, partner: null };
    return [first, { ...first, faction: freeFaction(d, [first]) }];
  });
  const [dominance, setDominance] = useState(false);
  const [map, setMap] = useState(offered(d.maps)[0].id);
  const [deck, setDeck] = useState(offered(d.decks)[0].id);
  const [landmarks, setLandmarks] = useState<string[]>([]);

  const can = (faction: string) => !!flags(d, faction)?.coalition;
  // A coalition faction wins or loses with its partner.
  const won = (r: Row) => (r.partner !== null ? rows[r.partner].winner : r.winner);
  const error = problem(d, rows, dominance);

  useEffect(() => {
    if (error) return onChange(null);
    const players: RootResult["players"] = {};
    for (const r of rows) {
      players[r.name.trim()] = { faction: r.faction, score: Number(r.score) || 0, winner: won(r), partner: r.partner !== null ? rows[r.partner].name.trim() : null };
    }
    onChange({ players: rows.map((r) => r.name.trim()), result: { map, deck, landmarks, victory: dominance ? DOMINANCE : POINTS, players } });
  }, [rows, dominance, map, deck, landmarks]);

  // Only one player wins in their own right: ticking Won clears everyone else.
  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => tidy(d, rs.map((r, j) => (j === i ? { ...r, ...patch } : patch.winner ? { ...r, winner: false } : r)), dominance));
  const remove = (i: number) =>
    setRows((rs) => tidy(d, rs.filter((_, j) => j !== i).map((r) => ({ ...r, partner: r.partner === i ? null : r.partner !== null && r.partner > i ? r.partner - 1 : r.partner })), dominance));
  const toggleDominance = (v: boolean) => {
    setDominance(v);
    setRows((rs) => tidy(d, rs, v));
  };
  const options = (list: Entry[]) => offered(list).map((e) => ({ value: e.id, label: e.label }));

  // No step given shows everything.
  const show = (s: GameStep) => step === undefined || step === s;
  return (
    <View style={{ gap: 12 }}>
      {show("setup") && (
        <>
          <Heading text="Setup" />
          <Select label="Map" value={map} options={options(d.maps)} onChange={setMap} />
          <Select label="Deck" value={deck} options={options(d.decks)} onChange={setDeck} />
          <Text style={{ fontWeight: "500" }}>Landmarks</Text>
          {offered(d.landmarks).map((l) => (
            <Checkbox key={l.id} label={l.label} checked={landmarks.includes(l.id)} onChange={(on) => setLandmarks((ls) => (on ? [...ls, l.id] : ls.filter((x) => x !== l.id)))} />
          ))}
          <Heading text="Win condition" />
          {/* Like radio buttons: one is always ticked, and ticking one unticks the other. */}
          <Checkbox label={labelOf(d.victories, POINTS)} checked={!dominance} onChange={(on) => on && toggleDominance(false)} />
          <Checkbox label={labelOf(d.victories, DOMINANCE)} checked={dominance} onChange={(on) => on && toggleDominance(true)} />
        </>
      )}
      {show("players") && (
        <>
          <Heading text="Players" />
          {rows.map((r, i) => (
            <View key={i} style={{ gap: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12 }}>
              <Text style={{ fontWeight: "600" }}>Player {i + 1}</Text>
              <Field label={`Player ${i + 1} name`} hint="e.g. Ada" autoCapitalize="words" value={r.name} onChangeText={(name) => set(i, { name })} />
              <Checkbox
                label={r.partner !== null ? `Player ${i + 1} won (with ${nameOf(rows[r.partner], r.partner)})` : `Player ${i + 1} won`}
                checked={won(r)}
                disabled={r.partner !== null}
                onChange={(winner) => set(i, { winner })}
              />
              <Select
                label={`Player ${i + 1} faction`}
                value={r.faction}
                options={offered(d.factions).map((f) => ({ value: f.id, label: taken(d, rows, i, f.id) ? `${f.label} (taken)` : f.label, disabled: taken(d, rows, i, f.id) }))}
                onChange={(faction) => set(i, { faction })}
              />
              <Field label={`Player ${i + 1} score`} hint="0" keyboardType="number-pad" value={r.score} onChangeText={(score) => set(i, { score })} />
              {dominance && can(r.faction) && (
                <Select
                  label={`Player ${i + 1} coalition with`}
                  value={r.partner === null ? "" : String(r.partner)}
                  options={[{ value: "", label: "Nobody" }, ...rows.flatMap((o, j) => (j !== i && !can(o.faction) ? [{ value: String(j), label: nameOf(o, j) }] : []))]}
                  onChange={(v) => set(i, { partner: v === "" ? null : Number(v) })}
                />
              )}
              {rows.length > 1 && <Button secondary title={`Remove player ${i + 1}`} onPress={() => remove(i)} />}
            </View>
          ))}
          <Button secondary title="Add player" onPress={() => setRows((rs) => [...rs, { name: "", faction: freeFaction(d, rs), score: "", winner: false, partner: null }])} />
        </>
      )}
      {(show("players") || step === "save") && <Message text={error} />}
    </View>
  );
}

const winners = (s: Session) => Object.entries((s.result as RootResult).players).filter(([, p]) => p.winner).map(([n]) => n);

function RootDetail({ session }: { session: Session }) {
  const r = session.result as RootResult;
  const d = useGameData<RootData>("root");
  return (
    <View style={{ gap: 4 }}>
      <Text>{labelOf(d?.maps, r.map)} map · {labelOf(d?.decks, r.deck)} deck</Text>
      {r.landmarks.length > 0 && <Text>Landmarks: {r.landmarks.map((l) => labelOf(d?.landmarks, l)).join(", ")}</Text>}
      <Text>{labelOf(d?.victories, r.victory)} victory</Text>
      {Object.entries(r.players).map(([name, p]) => (
        <Text key={name}>
          {name} · {labelOf(d?.factions, p.faction)} · {p.score}
          {p.partner ? ` · coalition with ${p.partner}` : ""}
          {p.winner ? " · winner" : ""}
        </Text>
      ))}
    </View>
  );
}

export const root: GameDef = { name: "Root", Form: RootForm, Detail: RootDetail, summary: (s) => `Won by ${winners(s).join(", ")}` };
