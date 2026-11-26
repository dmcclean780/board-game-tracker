# Friends

Status: implemented, web only. Decision: [ADR 0019](../adr/0019-symmetric-friends-without-consent.md). Terms: Friend, Friend code, User ([glossary](../../GLOSSARY.md)).

## Purpose

A User can become Friends with another User by entering that User's friend code. The Friends screen shows their own code, lets them add and remove Friends, and replaces the former Games screen.

## Behaviour

All routes need a valid bearer token ([AUTH-14](authentication.md)); otherwise `401`.

- **FRI-1** Every User has a friend code: 8 characters from `A-Z` and `2-9` without `I`, `L`, `O`, `0`, `1`, random, unique, made when the User row is created (existing Users got one in migration `0004_friends.sql`). `GET /me` returns it as `friend_code` ([ACC-1](accounts.md)).
  Tests: integration `add_friend_by_code_is_shared_and_removable` (format); uniqueness and the random source: none
- **FRI-2** `POST /friends` with `{ "code": "<code>" }` makes the caller and the code's owner Friends at once and returns `201` with `{ id, display_name }` of the owner. The owner is not asked and is not told.
  Tests: integration `add_friend_by_code_is_shared_and_removable`
- **FRI-3** The code is matched ignoring case, dashes and spaces.
  Tests: integration `add_friend_by_code_is_shared_and_removable` (lower case, dash, spaces)
- **FRI-4** `POST /friends` returns `422` with a plain-text reason and stores nothing: "No user has that friend code." for an unknown or empty code, "That is your own friend code." for the caller's own, and "<name> is already your friend." when they are already Friends (from either side).
  Tests: integration `add_friend_rejects_bad_codes`
- **FRI-5** A User with a Scheduled deletion cannot be added (FRI-4's "No user has that friend code."), but stays in their existing Friends' lists until they are purged.
  Tests: integration `add_friend_rejects_bad_codes`
- **FRI-6** `GET /friends` returns the caller's Friends as `[{ id, display_name }]`, sorted by display name ignoring case. The friendship is shared: each of the two sees the other.
  Tests: integration `add_friend_by_code_is_shared_and_removable`
- **FRI-7** `DELETE /friends/{id}` ends the friendship for both Users and returns `204`; `404` when they are not Friends.
  Tests: integration `add_friend_by_code_is_shared_and_removable`
- **FRI-8** `POST /me/friend-code` gives the caller a new friend code and returns `200` with `Me`. The old code stops working at once and existing Friends are kept. `404` if the User has no row yet.
  Tests: integration `regenerating_friend_code_keeps_friends`
- **FRI-9** Deleting a User (the purge, [ACC-8](accounts.md)) deletes their friendships.
  Tests: integration `purging_a_user_removes_their_friendships`
- **FRI-10** The Friends screen (`/friends`) shows, top to bottom: "Your friend code" as `XXXX-XXXX` with "Copy" and "New code" buttons; a "Friend code" box with "Add friend"; the Friends list, each with "Remove".
  Tests: jest `shows your code and, with no friends yet, a hint`; e2e `two users become friends by friend code`; Copy: none
- **FRI-11** "Add friend" sends the box's text. On success the box is cleared and the list reloads; on failure the server's reason (FRI-4) is shown as an error.
  Tests: jest `adds a friend by code and lists them, or shows the server's reason`; e2e `two users become friends by friend code`
- **FRI-12** "Remove" asks first ("Remove <name>? You will no longer be friends with each other."); "Confirm remove" calls `DELETE /friends/{id}`, "Cancel" backs out.
  Tests: jest `removing a friend asks for confirmation first`; e2e `two users become friends by friend code`
- **FRI-13** "New code" asks first ("Your old code will stop working. Your friends stay."); "Confirm new code" calls `POST /me/friend-code` and shows the new code.
  Tests: jest `a new code asks for confirmation, then refreshes the user`
- **FRI-14** With no Friends the list says "No friends yet. Share your friend code or enter a friend's code above."
  Tests: jest `shows your code and, with no friends yet, a hint`; e2e `two users become friends by friend code`

## Interfaces

| Route | Success | Other |
|---|---|---|
| `GET /friends` | `200` `[Friend]` | `401`, `500` |
| `POST /friends` | `201` `Friend` | `401`, `422`, `500` |
| `DELETE /friends/{id}` | `204` | `401`, `404`, `500` |
| `POST /me/friend-code` | `200` `Me` | `401`, `404`, `500` |

Table `friendships(user_a, user_b, created_at)`, one row per pair with `user_a < user_b`, both ending with the User on delete. Column `users.friend_code`. Migration `0004_friends.sql`.

## Not yet

Linking a Friend to a Player on a Session; friend requests or consent; profiles, search by name or email, or any detail of a Friend beyond their display name; telling a User they were added.

## Code

`backend/src/friends.rs`, `backend/src/users.rs` (`new_friend_code`), `db/migrations/0004_friends.sql`, `frontend/src/app/(app)/friends.tsx`, `frontend/src/components/shell.tsx` (footer).
