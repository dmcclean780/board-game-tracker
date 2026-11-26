import { renderHook } from "@testing-library/react-native";
import { openLive, useLive } from "../src/live";

class FakeSocket {
  static all: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(m: string) {
    this.sent.push(m);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  say(type: string) {
    this.onmessage?.({ data: JSON.stringify({ type }) });
  }
}
const last = () => FakeSocket.all[FakeSocket.all.length - 1];

beforeEach(() => {
  FakeSocket.all = [];
  (globalThis as any).WebSocket = FakeSocket;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("sends the access token first, then tells listeners what changed", async () => {
  const friends = jest.fn();
  const me = jest.fn();
  await renderHook(() => { useLive("friends", friends); useLive("me", me); });
  openLive("ws://api/ws", () => "tok");
  last().onopen?.();
  expect(last().sent).toEqual(["tok"]);
  last().say("friends");
  expect(friends).toHaveBeenCalledTimes(1);
  expect(me).not.toHaveBeenCalled();
  last().say("me");
  expect(me).toHaveBeenCalledTimes(1);
  expect(friends).toHaveBeenCalledTimes(1);
});

test("'ready' makes every listener refetch, and an unmounted listener hears nothing", async () => {
  const friends = jest.fn();
  const me = jest.fn();
  const a = await renderHook(() => useLive("friends", friends));
  await renderHook(() => useLive("me", me));
  openLive("ws://api/ws", () => "tok");
  last().say("ready");
  expect(friends).toHaveBeenCalledTimes(1);
  expect(me).toHaveBeenCalledTimes(1);
  await a.unmount();
  last().say("friends");
  expect(friends).toHaveBeenCalledTimes(1);
});

test("reconnects with a growing wait that 'ready' resets, using the latest token", async () => {
  let token = "old";
  openLive("ws://api/ws", () => token);
  expect(FakeSocket.all).toHaveLength(1);
  last().close();
  jest.advanceTimersByTime(999);
  expect(FakeSocket.all).toHaveLength(1);
  jest.advanceTimersByTime(1);
  expect(FakeSocket.all).toHaveLength(2);
  token = "new";
  last().onopen?.();
  expect(last().sent).toEqual(["new"]);
  last().close(); // no 'ready' in between: wait 2 s
  jest.advanceTimersByTime(1999);
  expect(FakeSocket.all).toHaveLength(2);
  jest.advanceTimersByTime(1);
  expect(FakeSocket.all).toHaveLength(3);
  last().say("ready");
  last().close(); // 'ready' resets the wait to 1 s
  jest.advanceTimersByTime(1000);
  expect(FakeSocket.all).toHaveLength(4);
});

test("the wait stops growing at 30 s", async () => {
  openLive("ws://api/ws", () => "tok");
  for (let i = 0; i < 8; i++) {
    last().close();
    jest.advanceTimersByTime(30_000);
  }
  const n = FakeSocket.all.length;
  last().close();
  jest.advanceTimersByTime(30_000);
  expect(FakeSocket.all).toHaveLength(n + 1);
});

test("stopping closes the socket and does not reconnect", async () => {
  const stop = openLive("ws://api/ws", () => "tok");
  stop();
  expect(last().closed).toBe(true);
  jest.advanceTimersByTime(60_000);
  expect(FakeSocket.all).toHaveLength(1);
});
