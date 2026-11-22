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

**Player**:
Someone who takes part in a game. A Player may or may not be a User.

**Scheduled deletion**:
The state of a User who asked to delete their account and can still restore it during the 30-day grace period.
