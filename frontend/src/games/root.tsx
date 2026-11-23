import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Checkbox, Field, Heading, Message, Select } from "../components/ui";
import type { GameDef, GameStep, Session } from "./index";

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
  ["lilypad_diaspora", "Lilypad Diaspora"],
  ["twilight_council", "Twilight Council"],
  ["knaves_of_the_deepwood", "Knaves of the Deepwood"],
];
const MAPS: [string, string][] = [["autumn", "Autumn"], ["winter", "Winter"], ["lake", "Lake"], ["mountain", "Mountain"], ["marsh", "Marsh"], ["gorge", "Gorge"]];
const DECKS: [string, string][] = [["standard", "Standard"], ["exiles_and_partisans", "Exiles and Partisans"], ["squires_and_disciples", "Squires and Disciples"]];
const LANDMARKS: [string, string][] = [["black_market", "Black Market"], ["elder_treetop", "Elder Treetop"], ["legendary_forge", "Legendary Forge"], ["lost_city", "Lost City"], ["mousehold", "Mousehold"], ["foxburrow", "Foxburrow"], ["rabbittown", "Rabbittown"], ["the_ferry", "The Ferry"], ["the_tower", "The Tower"]];
const labelOf = (list: [string, string][], id: string) => list.find(([k]) => k === id)?.[1] ?? id;
const factionName = (id: string) => FACTIONS.find(([k]) => k === id)?.[1] ?? id;

type Row = { name: string; faction: string; score: string; winner: boolean; partner: number | null };

type RootResult = { map: string; deck: string; landmarks: string[]; victory: string; players: Record<string, { faction: string; score: number; winner: boolean; partner: string | null }> };

const VAGABOND = "vagabond";
const nameOf = (r: Row, i: number) => r.name.trim() || `Player ${i + 1}`;

/** Another player holds this faction already (any number of Vagabonds is fine). */
const taken = (rows: Row[], i: number, faction: string) => faction !== VAGABOND && rows.some((r, j) => j !== i && r.faction === faction);

const freeFaction = (rows: Row[]) => FACTIONS.find(([k]) => !taken(rows, -1, k))?.[0] ?? VAGABOND;

/** Only Vagabonds have partners, only in a dominance victory, and a partner is another player who is not a Vagabond. */
function tidy(rows: Row[], dominance: boolean): Row[] {
  return rows.map((r, i) => (r.partner !== null && (!dominance || r.faction !== VAGABOND || r.partner === i || rows[r.partner]?.faction === VAGABOND) ? { ...r, partner: null } : r));
}

/** The first rule the Session breaks, mirroring the server's checks; null when it is fine to save. */
function problem(rows: Row[], dominance: boolean): string | null {
  const names = rows.map((r) => r.name.trim());
  if (names.some((n) => !n)) return "Enter a name for every player.";
  if (new Set(names).size !== names.length) return "Player names must be different.";
  const leaders = rows.filter((r) => r.winner && r.partner === null);
  if (leaders.length !== 1) return "Tick Won for the player who won.";
  if (!dominance && Number(leaders[0].score) < 30) return "A 30 point victory needs at least 30 points; choose Dominance otherwise.";
  if (rows.some((r) => Number(r.score) < 0)) return "Scores cannot be negative.";
  return null;
}

type Value = { players: string[]; result: unknown } | null;

function RootForm({ onChange, step }: { onChange: (v: Value) => void; step?: GameStep }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const first = { name: "", faction: FACTIONS[0][0], score: "", winner: false, partner: null };
    return [first, { ...first, faction: freeFaction([first]) }];
  });
  const [dominance, setDominance] = useState(false);
  const [map, setMap] = useState(MAPS[0][0]);
  const [deck, setDeck] = useState(DECKS[0][0]);
  const [landmarks, setLandmarks] = useState<string[]>([]);

  // A coalition Vagabond wins or loses with their partner.
  const won = (r: Row) => (r.partner !== null ? rows[r.partner].winner : r.winner);
  const error = problem(rows, dominance);

  useEffect(() => {
    if (error) return onChange(null);
    const players: RootResult["players"] = {};
    for (const r of rows) {
      players[r.name.trim()] = { faction: r.faction, score: Number(r.score) || 0, winner: won(r), partner: r.partner !== null ? rows[r.partner].name.trim() : null };
    }
    onChange({ players: rows.map((r) => r.name.trim()), result: { map, deck, landmarks, victory: dominance ? "dominance" : "points", players } });
  }, [rows, dominance, map, deck, landmarks]);

  // Only one player wins in their own right: ticking Won clears everyone else.
  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => tidy(rs.map((r, j) => (j === i ? { ...r, ...patch } : patch.winner ? { ...r, winner: false } : r)), dominance));
  const remove = (i: number) =>
    setRows((rs) => tidy(rs.filter((_, j) => j !== i).map((r) => ({ ...r, partner: r.partner === i ? null : r.partner !== null && r.partner > i ? r.partner - 1 : r.partner })), dominance));
  const toggleDominance = (v: boolean) => {
    setDominance(v);
    setRows((rs) => tidy(rs, v));
  };

  // The form stays mounted between steps so nothing typed is lost; no step given shows everything.
  const show = (s: GameStep) => step === undefined || step === s;
  return (
    <View style={{ gap: 12 }}>
      {show("setup") && (
        <>
      <Heading text="Setup" />
      <Select label="Map" value={map} options={MAPS.map(([value, label]) => ({ value, label }))} onChange={setMap} />
      <Select label="Deck" value={deck} options={DECKS.map(([value, label]) => ({ value, label }))} onChange={setDeck} />
      <Text style={{ fontWeight: "500" }}>Landmarks</Text>
      {LANDMARKS.map(([id, label]) => (
        <Checkbox
          key={id}
          label={label}
          checked={landmarks.includes(id)}
          onChange={(on) => setLandmarks((l) => (on ? [...l, id] : l.filter((x) => x !== id)))}
        />
      ))}
      <Heading text="Win condition" />
      {/* Like radio buttons: one is always ticked, and ticking one unticks the other. */}
      <Checkbox label="30 Points" checked={!dominance} onChange={(on) => on && toggleDominance(false)} />
      <Checkbox label="Dominance" checked={dominance} onChange={(on) => on && toggleDominance(true)} />
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
            options={FACTIONS.map(([value, label]) => ({ value, label: taken(rows, i, value) ? `${label} (taken)` : label, disabled: taken(rows, i, value) }))}
            onChange={(faction) => set(i, { faction })}
          />
          <Field label={`Player ${i + 1} score`} hint="0" keyboardType="number-pad" value={r.score} onChangeText={(score) => set(i, { score })} />
          {dominance && r.faction === VAGABOND && (
            <Select
              label={`Player ${i + 1} coalition with`}
              value={r.partner === null ? "" : String(r.partner)}
              options={[{ value: "", label: "Nobody" }, ...rows.flatMap((o, j) => (j !== i && o.faction !== VAGABOND ? [{ value: String(j), label: nameOf(o, j) }] : []))]}
              onChange={(v) => set(i, { partner: v === "" ? null : Number(v) })}
            />
          )}
          {rows.length > 1 && <Button secondary title={`Remove player ${i + 1}`} onPress={() => remove(i)} />}
        </View>
      ))}
      <Button secondary title="Add player" onPress={() => setRows((rs) => [...rs, { name: "", faction: freeFaction(rs), score: "", winner: false, partner: null }])} />
        </>
      )}
      {(show("players") || step === "save") && <Message text={error} />}
    </View>
  );
}

const winners = (s: Session) => Object.entries((s.result as RootResult).players).filter(([, p]) => p.winner).map(([n]) => n);

function RootDetail({ session }: { session: Session }) {
  const r = session.result as RootResult;
  return (
    <View style={{ gap: 4 }}>
      <Text>{labelOf(MAPS, r.map)} map · {labelOf(DECKS, r.deck)} deck</Text>
      {r.landmarks.length > 0 && <Text>Landmarks: {r.landmarks.map((l) => labelOf(LANDMARKS, l)).join(", ")}</Text>}
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
