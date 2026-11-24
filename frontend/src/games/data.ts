import { useEffect, useState } from "react";
import { api, useAuth } from "../auth";

/** An option in a Game's data file (backend/games/<game>/data.json). */
export type Entry = { id: string; label: string; expansion?: string; retired?: boolean; shareable?: boolean; coalition?: boolean };

const cache: Record<string, unknown> = {};

/** A Game's data file, fetched once per app load; null until it arrives. */
export function useGameData<T>(gameId: string): T | null {
  const { session } = useAuth();
  const [data, setData] = useState<T | null>((cache[gameId] as T) ?? null);
  useEffect(() => {
    if (cache[gameId] || !session) return;
    api(`/games/${gameId}`, session.access_token)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        cache[gameId] = d;
        setData(d);
      })
      .catch(() => {});
  }, [gameId]);
  return data;
}

/** The label for an id; an id no longer in the data (or data not loaded yet) shows as is. */
export const labelOf = (list: Entry[] | undefined, id: string) => list?.find((e) => e.id === id)?.label ?? id;
