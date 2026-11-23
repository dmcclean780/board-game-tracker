# Accounts

Status: implemented. Decision: [ADR 0014](../adr/0014-supabase-auth.md). Terms: User, Scheduled deletion ([glossary](../../GLOSSARY.md)).

## Purpose

The backend keeps its own record of each User, created from the verified token, and lets a User delete their account with a 30-day chance to change their mind.

## Behaviour

All routes need a valid bearer token ([AUTH-14](authentication.md)); otherwise `401`.

- **ACC-1** `GET /me` creates the User row on first call and returns `{ id, email, display_name, deletion_scheduled_for }`. `id` is the token's `sub`.
  Tests: integration `me_creates_user_on_first_call_and_keeps_it`
- **ACC-2** Later `GET /me` calls refresh the stored email but never overwrite the stored display name.
  Tests: integration `me_creates_user_on_first_call_and_keeps_it`
- **ACC-3** `deletion_scheduled_for` is `null` normally, and the request time plus 30 days when deletion was requested.
  Tests: integration `delete_then_restore` (null and non-null; the 30-day value itself: none)
- **ACC-4** `DELETE /me` schedules deletion and returns `204`. Repeating it keeps the original request time, so the date does not move.
  Tests: integration `delete_then_restore` (first call); repeat keeps the time: none
- **ACC-5** `DELETE /me` and `POST /me/restore` return `404` if the User has no row yet (no `GET /me` call has happened).
  Tests: integration `delete_then_restore` (DELETE before first `GET /me`); restore: none
- **ACC-6** `POST /me/restore` cancels a scheduled deletion and returns `204`.
  Tests: integration `delete_then_restore`
- **ACC-7** A User must have a non-blank display name (database check).
  Tests: none
- **ACC-8** A background task runs when the backend starts and then once every 24 hours. It permanently deletes every User whose deletion was requested more than 30 days ago: first the provider account (`DELETE {AUTH_URL}/admin/users/{id}` with the service key), then the row.
  Tests: integration `purge_removes_only_users_past_grace_period` (cut-off); schedule: none
- **ACC-9** The provider answering "not found" counts as already deleted. Any other provider failure keeps the row, logs it, and retries on the next run.
  Tests: integration `purge_removes_only_users_past_grace_period` (provider unreachable); "not found": none
- **ACC-10** Users who are active or still inside the 30 days are never purged.
  Tests: integration `purge_removes_only_users_past_grace_period`

## Interfaces

| Route | Success | Other |
|---|---|---|
| `GET /me` | `200` `Me` | `401`, `500` |
| `DELETE /me` | `204` | `401`, `404`, `500` |
| `POST /me/restore` | `204` | `401`, `404`, `500` |

Table `users(id, email, display_name, created_at, deletion_requested_at)`, migration `0002_users.sql`. Deleting a User row also deletes their Sessions ([SES-8](sessions.md)).

## Not yet

Changing display name or email; linking a User to a Player; immediate hard delete; a way to trigger the purge manually.

## Code

`backend/src/users.rs`, `backend/src/main.rs` (purge loop), `db/migrations/0002_users.sql`, `frontend/src/app/{index,restore}.tsx`.
