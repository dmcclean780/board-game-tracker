# Live updates

Status: implemented, web only. Decision: [ADR 0020](../adr/0020-live-updates-websocket-listen-notify.md). Terms: User, Friend, Friend code ([glossary](../../GLOSSARY.md)).

## Purpose

An open tab learns by itself that something it shows has changed (for example someone added the User as a Friend), so the User does not reload. The backend pushes a short signal over a WebSocket; the tab then asks for the data again over the ordinary routes.

## Behaviour

- **LIVE-1** `GET /ws` upgrades to a WebSocket. A browser WebSocket cannot send an `Authorization` header, so the route needs no header; the User proves who they are with the first message (LIVE-2).
  Tests: integration `ws_pushes_friend_changes_to_both_users`
- **LIVE-2** The first text message must be a valid access token ([AUTH-14](authentication.md)). If it is invalid, not text, or does not arrive within 5 seconds, the server closes the socket.
  Tests: integration `ws_closes_without_a_valid_token` (invalid token; silence for 5 s); not text: none
- **LIVE-3** After a valid token the server sends `{"type":"ready"}` once it is listening for that User. A change made after `ready` is always pushed.
  Tests: integration, every `ws_*` test waits for it
- **LIVE-4** Adding or ending a friendship ([FRI-2](friends.md), [FRI-7](friends.md)) sends `{"type":"friends"}` to every open socket of both Users.
  Tests: integration `ws_pushes_friend_changes_to_both_users`
- **LIVE-5** Changing a display name sends `{"type":"friends"}` to every open socket of each of the User's Friends, and `{"type":"me"}` to the User's own.
  Tests: integration `ws_pushes_renames_to_friends_and_me_to_the_user`
- **LIVE-6** Replacing the friend code ([FRI-8](friends.md)) sends `{"type":"me"}` to the User's own sockets and to nobody else.
  Tests: integration `ws_pushes_renames_to_friends_and_me_to_the_user`
- **LIVE-7** Deleting a User (the purge, [ACC-8](accounts.md)) ends their friendships, so their Friends get `{"type":"friends"}` (LIVE-4).
  Tests: integration `purge_notifies_friends`
- **LIVE-8** The server closes the socket when the token expires; the app then reconnects with its refreshed token (LIVE-11).
  Tests: integration `ws_closes_when_the_token_expires`
- **LIVE-9** Messages carry only a `type` (`ready`, `friends` or `me`), never data. The tab refetches over the ordinary routes, which check the token as usual, so a socket that outlives its User's rights shows nothing.
  Tests: integration (the tests above compare the exact text)
- **LIVE-10** The changes are announced by the database (`NOTIFY bgt_events`, from triggers in `0005_live_events.sql`), and every backend instance relays them to its own sockets, so it does not matter which instance a User is connected to. Every writer is covered, including the purge's cascade.
  Tests: integration `purge_notifies_friends` (a plain SQL delete); several instances: none
- **LIVE-11** The app opens one socket per signed-in tab, after sign-in and for as long as the User stays signed in, and sends the current access token as the first message of each connection.
  Tests: jest `Live.test.tsx` `sends the access token first, then tells listeners what changed`, `reconnects with a growing wait that 'ready' resets, using the latest token`; opening it after sign-in: none (provider wiring is covered by e2e `two users become friends by friend code, and see each other's changes without reloading`)
- **LIVE-12** When the socket drops, the app reconnects silently after 1 second, doubling the wait up to 30 seconds. `ready` resets the wait to 1 second. No banner is shown.
  Tests: jest `reconnects with a growing wait that 'ready' resets, using the latest token`, `the wait stops growing at 30 s`
- **LIVE-13** On `friends` or `me` every screen listening for that type refetches. On `ready`, which also follows every reconnect, every listening screen refetches, so changes missed while disconnected show up.
  Tests: jest `Live.test.tsx` `'ready' makes every listener refetch, and an unmounted listener hears nothing`, `sends the access token first, then tells listeners what changed`; the Friends screen: jest `Friends.test.tsx` `the list refetches when the server says friends changed`
- **LIVE-14** A `me` message makes the app reload the signed-in User (`GET /me`), so a new friend code or name made in another tab shows here.
  Tests: none (the same call as sign-in; checked by hand)
- **LIVE-15** Stopping (signing out) closes the socket and does not reconnect.
  Tests: jest `stopping closes the socket and does not reconnect`; signing out closing it: none

## Interfaces

`GET /ws`, upgrade to WebSocket. Client to server: one text message, the access token. Server to client: `{"type":"ready"}`, `{"type":"friends"}`, `{"type":"me"}`. It is not in `/openapi.json`, which cannot describe a WebSocket. Database: channel `bgt_events` with payload `{"user": <uuid>, "type": "friends"|"me"}`; triggers `friendships_changed` and `users_changed`.

## Not yet

Only the Friends screen and the signed-in User listen; Results and other screens do not. A change made while a backend instance's database listener is reconnecting is not pushed (the tab still catches up at its next `ready` or when it is opened). No "reconnecting" banner. Native iOS and Android.

## Code

`backend/src/live.rs` (hub, listener, `/ws`), `backend/src/auth.rs` (`verify`), `db/migrations/0005_live_events.sql`, `frontend/src/live.ts` (`openLive`, `useLive`), `frontend/src/auth.tsx` (opens the socket), `frontend/src/app/(app)/friends.tsx`.
