import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, useAuth } from "../auth";
import { Button, Checkbox, Field, Heading, Message, Select, Text } from "../components/ui";
import { useTheme } from "../theme";
import { Entry, useGameData } from "./data";
import type { GameStep } from "./index";

/** A field of the `form` in a Game's data file; see backend/games/core (`Field`) and docs/adr/0018. */
type FieldDef = {
  key: string;
  label: string;
  type: "select" | "multi" | "repeat" | "checkbox" | "number" | "winner" | "choice" | "player";
  options?: string;
  filter_by_players?: boolean;
  unique?: boolean;
  blank?: string;
  when?: string;
  via?: string;
  when_flag?: string;
  shares?: string;
};
type FormDef = { min_players: number; max_players: number; default_players: number; setup?: FieldDef[]; player: FieldDef[] };
type Data = Record<string, Entry[]> & { form: FormDef };
type Row = Record<string, any>;
type Value = { players: string[]; result: unknown } | null;
type Props = { gameId: string; onChange: (v: Value) => void; step?: GameStep };

// The data arrives from the server, so the form waits for it; once loaded it stays mounted so nothing typed is lost.
export function GameForm(props: Props) {
  const data = useGameData<Data>(props.gameId);
  return data ? <Body data={data} {...props} /> : <Text>Loading options…</Text>;
}

function Body({ data: d, gameId, onChange, step }: Props & { data: Data }) {
  const { c } = useTheme();
  const { session } = useAuth();
  const { form } = d;
  const [count, setCount] = useState(form.default_players);
  const [setup, setSetup] = useState<Record<string, any>>(() => Object.fromEntries((form.setup ?? []).map((f) => [f.key, f.type === "choice" ? offered(d, f, 0)[0].id : empty(f)])));
  // All the rows are kept so lowering the count and raising it again loses nothing.
  const [all, setAll] = useState<Row[]>(() => {
    const rows: Row[] = [];
    for (let i = 0; i < form.max_players; i++) {
      rows.push({ name: "", ...Object.fromEntries(form.player.map((f) => [f.key, f.type === "select" && !f.blank ? offered(d, f, 0).find((e) => !held(d, f, rows, -1, e)) ?.id ?? "" : empty(f)])) });
    }
    return rows;
  });
  const [error, setError] = useState<string | null>(null);

  const rows = all.slice(0, count);
  const on = (f: FieldDef) => !f.when || !!setup[f.when];
  /** The other player a player field points at, when the link is still valid. */
  const partner = (i: number, f: FieldDef) => (validLink(d, form, rows, i, f) ? (rows[i][f.key] as number) : null);
  const flagged = (i: number, f: FieldDef) => hasFlag(d, form, rows[i], f);
  const links = form.player.filter((f) => f.type === "player");
  /** A key another player's value stands in for (a coalition shares its partner's win). */
  const sharer = (i: number, key: string) => {
    for (const f of links) if (f.shares === key && partner(i, f) !== null) return partner(i, f);
    return null;
  };
  // Follows the chain of partners (the step limit stops a loop).
  const val = (i: number, f: FieldDef, n = 0): any => (sharer(i, f.key) !== null && n <= count ? val(sharer(i, f.key)!, f, n + 1) : rows[i][f.key]);
  /** Following partners from `from` reaches `to`. */
  const reaches = (f: FieldDef, from: number, to: number) => {
    let at: number | null = from;
    for (let n = 0; at !== null && n <= count; n++) {
      if (at === to) return true;
      at = partner(at, f);
    }
    return false;
  };
  const setupValue = (f: FieldDef) => (f.type === "select" ? (offered(d, f, count).some((e) => e.id === setup[f.key]) ? setup[f.key] : offered(d, f, count)[0].id) : setup[f.key]);
  const nameOf = (i: number) => rows[i].name.trim() || `Player ${i + 1}`;

  const players = rows.map((r) => r.name.trim());
  const result: Record<string, any> = Object.fromEntries((form.setup ?? []).map((f) => [f.key, setupValue(f)]));
  result.players = Object.fromEntries(
    rows.map((r, i) => [
      players[i],
      Object.fromEntries(
        form.player.map((f) => [f.key, !on(f) ? null : f.type === "player" ? (partner(i, f) === null ? null : players[partner(i, f)!]) : f.type === "number" ? Number(r[f.key]) || 0 : val(i, f)]),
      ),
    ]),
  );

  // Ask the server whether the Session is acceptable; the form only reports a value once it says yes.
  const body = JSON.stringify({ players, result });
  useEffect(() => {
    onChange(null);
    let live = true;
    const t = setTimeout(async () => {
      const failed = "Could not check the session. Try again.";
      try {
        const res = await api(`/games/${gameId}/check`, session!.access_token, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (!live) return;
        if (res.status === 204) {
          setError(null);
          onChange({ players, result });
        } else setError(res.status === 422 ? await res.text() : failed);
      } catch {
        if (live) setError(failed);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [body]);

  const set = (i: number, patch: Row) =>
    setAll((rs) => {
      const next = rs.map((r, j) => {
        let n = j === i ? { ...r, ...patch } : r;
        // Only one player wins: ticking Won clears everyone else.
        for (const f of form.player) if (f.type === "winner" && patch[f.key] && j !== i) n = { ...n, [f.key]: false };
        return n;
      });
      // A link that is no longer valid (the faction changed) is dropped.
      return next.map((r, j) => ({ ...r, ...Object.fromEntries(links.map((f) => [f.key, !validLink(d, form, next.slice(0, count), j, f) ? null : r[f.key]])) }));
    });

  // No step given shows everything.
  const show = (s: GameStep) => step === undefined || step === s;
  const label = (i: number, f: FieldDef) => `Player ${i + 1} ${f.label}`;
  const opts = (f: FieldDef, i: number, k = -1) => offered(d, f, count).map((e) => {
    const taken = !!f.unique && held(d, f, rows, i, e, k);
    return { value: e.id, label: taken ? `${e.label} (taken)` : e.label, disabled: taken };
  });

  const playerField = (r: Row, i: number, f: FieldDef) => {
    if (!on(f)) return null;
    switch (f.type) {
      case "winner": {
        const p = sharer(i, f.key);
        return <Checkbox key={f.key} label={p !== null ? `${label(i, f)} (with ${nameOf(p)})` : label(i, f)} checked={!!val(i, f)} disabled={p !== null} onChange={(v) => set(i, { [f.key]: v })} />;
      }
      case "number":
        return <Field key={f.key} label={label(i, f)} hint="0" keyboardType="number-pad" value={r[f.key]} onChangeText={(v) => set(i, { [f.key]: v })} />;
      case "checkbox":
        return <Checkbox key={f.key} label={label(i, f)} checked={!!r[f.key]} onChange={(v) => set(i, { [f.key]: v })} />;
      case "select":
        return <Select key={f.key} label={label(i, f)} value={r[f.key]} options={[...(f.blank ? [{ value: "", label: f.blank }] : []), ...opts(f, i)]} onChange={(v) => set(i, { [f.key]: v })} />;
      case "repeat": {
        const next = offered(d, f, count).find((e) => !held(d, f, rows, i, e, -1));
        return (
          <View key={f.key} style={{ gap: 8 }}>
            {(r[f.key] as string[]).map((card, k) => (
              <View key={k} style={{ gap: 8 }}>
                <Select label={`${label(i, f)} ${k + 1}`} value={card} options={opts(f, i, k)} onChange={(v) => set(i, { [f.key]: r[f.key].map((x: string, m: number) => (m === k ? v : x)) })} />
                <Button secondary title={`Remove ${label(i, f).toLowerCase()} ${k + 1}`} onPress={() => set(i, { [f.key]: r[f.key].filter((_: string, m: number) => m !== k) })} />
              </View>
            ))}
            <Button secondary title={`Add ${f.label} for player ${i + 1}`} disabled={!next} onPress={() => set(i, { [f.key]: [...r[f.key], next!.id] })} />
          </View>
        );
      }
      case "player":
        return flagged(i, f) ? (
          <Select
            key={f.key}
            label={label(i, f)}
            value={r[f.key] === null ? "" : String(r[f.key])}
            options={[{ value: "", label: "Nobody" }, ...rows.flatMap((_, j) => (j !== i && !rows.some((_, k) => k !== i && partner(k, f) === j) && !reaches(f, j, i) ? [{ value: String(j), label: nameOf(j) }] : []))]}
            onChange={(v) => set(i, { [f.key]: v === "" ? null : Number(v) })}
          />
        ) : null;
      default:
        return null;
    }
  };

  const setupField = (f: FieldDef) => {
    const put = (v: any) => setSetup((s) => ({ ...s, [f.key]: v }));
    const list = offered(d, f, count);
    switch (f.type) {
      case "select":
        return <Select key={f.key} label={f.label} value={setupValue(f)} options={list.map((e) => ({ value: e.id, label: e.label }))} onChange={put} />;
      case "checkbox":
        return <Checkbox key={f.key} label={f.label} checked={!!setup[f.key]} onChange={put} />;
      case "multi":
        return (
          <View key={f.key} style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>{f.label}</Text>
            {list.map((e) => (
              <Checkbox key={e.id} label={e.label} checked={setup[f.key].includes(e.id)} onChange={(on) => put(on ? [...setup[f.key], e.id] : setup[f.key].filter((x: string) => x !== e.id))} />
            ))}
          </View>
        );
      case "choice":
        return (
          <View key={f.key} style={{ gap: 8 }}>
            <Heading text={f.label} />
            {/* Like radio buttons: one is always ticked, and ticking one unticks the others. */}
            {list.map((e) => (
              <Checkbox key={e.id} label={e.label} checked={setup[f.key] === e.id} onChange={(on) => on && put(e.id)} />
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {show("setup") && (
        <>
          <Heading text="Setup" />
          <Select
            label="Number of players"
            value={String(count)}
            options={Array.from({ length: form.max_players - form.min_players + 1 }, (_, n) => String(form.min_players + n)).map((n) => ({ value: n, label: n }))}
            onChange={(v) => setCount(Number(v))}
          />
          {(form.setup ?? []).map(setupField)}
        </>
      )}
      {show("players") && (
        <>
          <Heading text="Players" />
          {rows.map((r, i) => (
            <View key={i} style={{ gap: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 8, padding: 12 }}>
              <Text style={{ fontWeight: "600" }}>Player {i + 1}</Text>
              <Field label={`Player ${i + 1} name`} hint="e.g. Ada" autoCapitalize="words" value={r.name} onChangeText={(name) => set(i, { name })} />
              {form.player.map((f) => playerField(r, i, f))}
            </View>
          ))}
        </>
      )}
      {(show("players") || step === "save") && <Message text={error} />}
    </View>
  );
}

const empty = (f: FieldDef) => (f.type === "multi" || f.type === "repeat" ? [] : f.type === "checkbox" || f.type === "winner" ? false : f.type === "player" ? null : "");

/** The list's entries a new Session may use: not retired, and for the player count when the field says so. */
const offered = (d: Data, f: FieldDef, count: number) => (d[f.options!] ?? []).filter((e) => !e.retired && (!f.filter_by_players || count === 0 || e.players === count));

/** Another player (or another slot of this one) already holds the entry; a shareable entry is never held. */
function held(d: Data, f: FieldDef, rows: Row[], i: number, e: Entry, slot = -1) {
  if (e.shareable) return false;
  return rows.some((r, j) => (f.type === "repeat" ? (r[f.key] as string[]).some((c, k) => c === e.id && !(j === i && k === slot)) : j !== i && r[f.key] === e.id));
}

/** Whether the player's option in the field's `via` select carries the field's `when_flag`. */
function hasFlag(d: Data, form: FormDef, r: Row, f: FieldDef) {
  const via = form.player.find((x) => x.key === f.via)!;
  return !!(d[via.options!].find((e) => e.id === r[via.key]) as Record<string, any> | undefined)?.[f.when_flag!];
}

/** A player field's link holds only to another player, from a player whose option has the flag. */
function validLink(d: Data, form: FormDef, rows: Row[], i: number, f: FieldDef) {
  const p = rows[i]?.[f.key];
  return typeof p === "number" && p < rows.length && p !== i && hasFlag(d, form, rows[i], f);
}
