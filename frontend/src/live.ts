import { useEffect } from "react";

/** What the server can say changed. The message carries no data; the screen refetches. */
export type LiveType = "friends" | "me";

const listeners: Record<LiveType, Set<() => void>> = { friends: new Set(), me: new Set() };
const fire = (types: LiveType[]) => types.forEach((t) => listeners[t].forEach((cb) => cb()));

/** Calls `cb` whenever the server says `type` changed, and again each time the socket (re)connects. Keep `cb` stable (useCallback). */
export function useLive(type: LiveType, cb: () => void) {
  useEffect(() => {
    listeners[type].add(cb);
    return () => void listeners[type].delete(cb);
  }, [type, cb]);
}

const MIN_WAIT = 1000;
const MAX_WAIT = 30_000;

/**
 * Keeps a socket to `url` open until the returned function is called, authenticating with `token()`
 * as its first message and reconnecting with a growing wait (1 s up to 30 s) when it drops.
 */
export function openLive(url: string, token: () => string | undefined): () => void {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wait = MIN_WAIT;
  let stopped = false;

  const connect = () => {
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      const t = token();
      if (t) ws.send(t);
    };
    ws.onmessage = (e) => {
      const { type } = JSON.parse(String(e.data));
      if (type === "ready") {
        // Subscribed: refetch everything, in case something changed while we were away.
        wait = MIN_WAIT;
        fire(Object.keys(listeners) as LiveType[]);
      } else if (type in listeners) fire([type]);
    };
    ws.onclose = () => {
      if (stopped) return;
      timer = setTimeout(connect, wait);
      wait = Math.min(wait * 2, MAX_WAIT);
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
