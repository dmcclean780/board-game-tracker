# Glossary

**Project**:
A moon unit of the repo: `frontend`, `backend` or `db`.
_Avoid_: service

**Target**:
A moon task of a project, written `project:task` (for example `backend:test`).

**CI template**:
The shared composite action that every CI job uses, passing only variables such as the targets to run.

**User**:
A person with an account who signs in. All Users have the same role for now.
_Avoid_: account holder

**Game**:
A title whose results the app knows how to record, such as Root.

**Session**:
One sitting of a Game on a play date, recorded by one User, who alone can see it.
_Avoid_: match, play

**Player**:
A name on a Session, typed in by the User who records it. Not linked to a User yet.

**Result**:
What a Session records about how it ended. Its format belongs to the Game: Root records each Player's faction and score and who won, while a cooperative Game would record one shared outcome.

**Map**:
The Root board a Session was played on: Autumn, Winter, Lake or Mountain.

**Deck**:
The Root card deck in use. Only Standard so far.

**Landmark**:
An optional Root board piece added to the map; a Session has at most two.

**Points victory**:
A Root win by the first Player to reach 30 points.

**Dominance victory**:
A Root win by a Player who played a dominance card. Scores are still recorded but do not decide the win.

**Coalition**:
A Root Vagabond who wins together with the Player they chose as partner, beside that Player's own victory.

**Scheduled deletion**:
The state of a User who asked to delete their account and can still restore it during the 30-day grace period.
