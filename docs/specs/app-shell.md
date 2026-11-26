# App shell: routing, header, footer and sections

Status: implemented, web only. Navigation: Expo Router.

## Purpose

Decide which screen a visitor sees from their sign-in state, and give signed-in Users a header, a footer to move between sections, and the section screens.

## Behaviour

- **SHELL-1** A visitor who is not signed in who opens any app route sees the login screen. Only `/login`, `/sign-up`, `/forgot-password` and `/reset-password` are available to them.
  Tests: e2e `signed-out visitors land on the login screen`
- **SHELL-2** Nothing is rendered until the stored session has been read, the Inter font has loaded (or failed to, in which case the system font is used) and, for a signed-in User, `/me` has answered.
  Tests: none
- **SHELL-3** *(removed: replaced by SHELL-11 and SHELL-12)*
- **SHELL-4** *(removed: the greeting is gone; see SHELL-12, SHELL-14 and [SES-9](sessions.md))*
- **SHELL-5** *(removed: moved to the Account tab, SHELL-19)*
- **SHELL-6** A signed-in User with a scheduled deletion sees only the restore screen: "Your account will be permanently deleted on <date>." with "Restore account" and "Sign out". Restoring returns them to the Results screen.
  Tests: e2e `delete the account, then restore it on next sign-in`
- **SHELL-7** If a signed-in User's `/me` call fails, a "Something went wrong" screen explains the server cannot be reached and offers "Sign out".
  Tests: none
- **SHELL-8** `/reset-password` is reachable whether or not the User is signed in, because the reset link signs them in.
  Tests: e2e `reset a forgotten password`

- **SHELL-9** Every screen scrolls when its content is taller than the window, and its content is at most 560 px wide.
  Tests: none (checked by hand at desktop and phone widths)
- **SHELL-10** Every text box shows its label above it; grey hint text (never the label) appears only when it is empty.
  Tests: e2e (all flows locate boxes by label)

- **SHELL-11** A signed-in User without a scheduled deletion who opens `/` is sent to `/results`.
  Tests: e2e `sign up, verify email, sign out and sign back in` (lands on Results after sign-in)
- **SHELL-12** Every signed-in screen has a header bar. Its top left shows the screen's title: Results, Friends, Groups, Settings, "Record session" or "Session".
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **SHELL-13** The header's top right shows the User's display name. Pressing it opens a menu with "Account" (goes to `/settings/account`) and "Sign out".
  Tests: jest `the user menu offers Account and Sign out`; e2e `sign up, verify email, sign out and sign back in` (sign out)
- **SHELL-14** The four sections (`/friends`, `/results`, `/groups`, `/settings` and its sub pages) have a footer bar with one button each: an icon and a label. The current section is highlighted and marked selected.
  Tests: jest `the footer marks the current section`; e2e `change the display name on the account screen` (footer to Settings)
- **SHELL-15** "Record session" and the Session detail screen show the header with a back arrow instead of the footer. The arrow goes back, or to `/results` when there is nothing to go back to.
  Tests: none
- **SHELL-16** Groups shows "Coming soon." The Friends section is described in [friends.md](friends.md); it replaced the former Games placeholder.
  Tests: none
- **SHELL-17** The Results screen lists Sessions ([SES-9](sessions.md)) and has a round "+" button in the lower right (named "Record session") that opens the Session form.
  Tests: jest `shows the empty state`; e2e `record a Root session, view it and delete it`
- **SHELL-18** Settings has an internal header of tabs, Account and Appearance. Each tab is its own screen (`/settings/account`, `/settings/appearance`), the current one is marked selected, and `/settings` opens Account.
  Tests: e2e `the theme choice on the appearance tab is kept after reload`, `change the display name on the account screen`
- **SHELL-19** The Account tab has three parts. "Display name": a box and "Save display name", which calls `PATCH /me` ([ACC-11](accounts.md)) and shows "Display name saved.", or an error. "Email": the current email, a "New email" box and "Change email", which asks the auth provider to send a confirmation link to the new address and shows "Check <email> to confirm the change.", or the provider's error. "Delete account": asks for confirmation ("Your account will be deleted in 30 days. Sign in before then to restore it."); "Cancel" backs out; "Confirm delete" calls `DELETE /me` and signs the User out; if the call fails, "Could not delete the account. Try again." is shown and the User stays signed in.
  Tests: jest `saves a new display name and refreshes the user`, `asks the user to confirm a new email by mail`, `deleting the account asks for confirmation first`; e2e `change the display name on the account screen`, `delete the account, then restore it on next sign-in`; delete failure message and the email change completing: none
- **SHELL-20** The Appearance tab offers System, Light and Dark. System follows the device setting and is the default. The choice applies to every screen, signed in or not, at once, and is kept in this browser's local storage, so it is per device and not tied to the account.
  Tests: jest `choosing Dark switches the theme and marks the choice`; e2e `the theme choice on the appearance tab is kept after reload`; colours actually changing, and following the device setting: none (checked by hand)
- **SHELL-21** The saved choice is applied after the page loads, so a visitor who chose a different theme than the device's can see one frame of the other theme.
  Tests: none
- **SHELL-22** The accent is teal green, the page background is light grey in light mode and dark grey in dark mode, and headers, footers, inputs and cards sit a shade apart from the page. The text font is Inter, in regular, medium and semibold. The exact colours are in `frontend/src/theme.tsx`.
  Tests: jest `Text maps font weight to the matching Inter face`; colours and the font loading: none (checked by hand)

## Interfaces

Routes in `frontend/src/app/`: `login`, `sign-up`, `forgot-password`, `reset-password`, `restore`, and, for signed-in Users without a scheduled deletion, the group `(app)`: `index` (redirect), `results`, `friends`, `groups`, `settings/` (`index` redirect, `account`, `appearance`), `sessions/new` and `sessions/[id]`. Static web export (`web.output: static`), so each route is its own HTML file.

## Not yet

Native iOS and Android; the Groups section.

## Code

`frontend/src/app/_layout.tsx` (gate), `frontend/src/app/(app)/` (layout and screens), `frontend/src/theme.tsx` (colours and the saved choice), `frontend/src/app/restore.tsx`, `frontend/src/components/shell.tsx` (header, footer), `frontend/src/components/ui.tsx`.
