For each simultaneous task, create a separate Git worktree with its own branch
and make all changes for that task in that worktree.

## Specs

`docs/specs/` describes what the system does today, one file per feature area (see its README for the format).

After implementing a change, in the same worktree and branch, before saying it is done:

- If it adds, changes or removes behaviour that a user, an API caller or an operator can observe (screens, routes, errors, configuration, background jobs), update the matching spec, or create one and add it to the index in `docs/specs/README.md`.
- Add or change requirements as numbered, testable sentences. Never reuse an ID; mark dropped ones `removed`.
- Link each requirement to the tests that prove it, and write `Tests: none` when there is no test, so gaps stay visible. If you added tests, reference them.
- Keep the spec's "Not yet" and "Code" sections accurate.
- Record decisions in an ADR and domain rules in `docs/business-rules/` instead, and link to them from the spec rather than copying them.
- Changes with no observable behaviour (refactors, formatting, dependency bumps) need no spec change.
- Mention in the final summary which specs you touched.
