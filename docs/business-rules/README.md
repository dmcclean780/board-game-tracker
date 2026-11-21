# Business rules

One file per area (e.g. `scoring.md`, `players.md`, `games.md`, `sessions.md`). Every rule has a stable ID `BR-<AREA>-<NNN>` that code and tests reference. IDs are never reused; retire a rule by marking it `deprecated`.

Real rules are defined in a dedicated domain session. See [template.md](template.md).
