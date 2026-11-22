# App shell: routing and home screen

Status: implemented, web only. Navigation: Expo Router.

## Purpose

Decide which screen a visitor sees from their sign-in state, and give signed-in Users a minimal home screen.

## Behaviour

- **SHELL-1** A visitor who is not signed in who opens any app route sees the login screen. Only `/login`, `/sign-up`, `/forgot-password` and `/reset-password` are available to them.
  Tests: e2e `signed-out visitors land on the login screen`
- **SHELL-2** Nothing is rendered until the stored session has been read and, for a signed-in User, `/me` has answered.
  Tests: none
- **SHELL-3** A signed-in User without a scheduled deletion sees the home screen at `/`.
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **SHELL-4** The home screen shows "Hi, <display name>", the text "No games yet.", and the buttons "Sign out" and "Delete account".
  Tests: jest `greets the user and shows the empty state`
- **SHELL-5** "Delete account" first asks for confirmation ("Your account will be deleted in 30 days. Sign in before then to restore it."). "Cancel" backs out; "Confirm delete" calls `DELETE /me` and signs the User out. If the call fails, "Could not delete the account. Try again." is shown and the User stays signed in.
  Tests: jest `deleting the account asks for confirmation first`; e2e `delete the account, then restore it on next sign-in`; failure message: none
- **SHELL-6** A signed-in User with a scheduled deletion sees only the restore screen: "Your account will be permanently deleted on <date>." with "Restore account" and "Sign out". Restoring returns them to the home screen.
  Tests: e2e `delete the account, then restore it on next sign-in`
- **SHELL-7** If a signed-in User's `/me` call fails, a "Something went wrong" screen explains the server cannot be reached and offers "Sign out".
  Tests: none
- **SHELL-8** `/reset-password` is reachable whether or not the User is signed in, because the reset link signs them in.
  Tests: e2e `reset a forgotten password`

## Interfaces

Routes in `frontend/src/app/`: `login`, `sign-up`, `forgot-password`, `reset-password`, `index` (home), `restore`. Static web export (`web.output: static`), so each route is its own HTML file.

## Not yet

Any board-game content on the home screen; native iOS and Android; account settings.

## Code

`frontend/src/app/_layout.tsx` (gate), `frontend/src/app/index.tsx`, `frontend/src/app/restore.tsx`, `frontend/src/components/ui.tsx`.
