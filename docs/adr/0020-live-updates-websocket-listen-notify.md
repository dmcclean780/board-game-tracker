# 0020. Live updates: WebSocket signals, sent by the database with NOTIFY

- Status: accepted
- Date: 2026-11-26

## Context and problem statement

A User who has the Friends screen open should see it change when someone adds or removes them, without reloading. Webhooks cannot reach a browser, so the backend has to push, or the browser has to ask again and again.

## Considered options

- Polling `GET /friends` every few seconds: no backend change, but it is never instant and costs a request per open tab per interval.
- Server-Sent Events: one-way and simple, but `EventSource` cannot send headers, so the token would go in the URL (and into logs).
- WebSocket, the token as its first message, and messages that carry only a type, announced by the database with Postgres `LISTEN/NOTIFY`.

## Decision

The last option.
- **WebSocket.** `GET /ws` needs no header. The first message is the access token, checked by the same `auth::verify` as any request, within 5 seconds; the socket closes when the token expires. The token never appears in a URL.
- **Signals, not data.** A message is `ready`, `friends` or `me`. The tab then calls the ordinary routes, so there is one source of truth, nothing private travels on the socket, and a missed message is repaired by refetching. `ready`, sent once the socket is subscribed, makes every listening screen refetch, which closes the gap between connecting and subscribing and repairs a reconnect.
- **Triggers and NOTIFY.** Triggers on `friendships` and `users` call `pg_notify('bgt_events', …)`, and each backend instance relays that to its own sockets. This works with one instance or many, which matters while deployment ([ADR 0009](0009-deployment.md)) is undecided, and it covers every writer: routes, the purge cascade, manual SQL.
- **One socket per tab**, opened by the auth provider, so any screen can listen with `useLive(type, callback)`.

## Consequences

- Updates are instant, and a screen that wants live data adds a trigger event and a `useLive` call, not a new socket.
- Each open tab holds a connection to a backend instance and, in the database, one shared listener per instance.
- A NOTIFY sent while an instance's listener is reconnecting is lost; tabs catch up at their next `ready`. Upgrade to a durable outbox only if that gap matters.
- `/ws` is not in OpenAPI and needs a WebSocket-capable host and proxy settings once deployment is chosen.
- Without a socket (blocked, or the backend is down), screens still work; they just do not update until reloaded or revisited.
