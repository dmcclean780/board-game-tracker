# 0019. Friends are symmetric and need no acceptance

- Status: accepted
- Date: 2026-11-26

## Context and problem statement

Users want to save other Users as Friends by entering their friend code. A friendship could be a one-way bookmark, or a mutual link that the other User must accept.

## Considered options

- One-way: A's list holds B; B sees nothing. Smallest, but "friend" then means different things to each side.
- Mutual with a request: A asks, B accepts. Needs pending requests, a screen to answer them and a way to tell B.
- Mutual without a request: entering the code makes both Friends at once.

## Decision

Mutual without a request. One `friendships` row per pair (smaller id first) is the whole state, so adding twice or from both sides cannot make a duplicate, and either side can end it for both. The friend code is the consent: it is random, 8 characters, and its owner can replace it at any time, which stops the old code working but keeps existing Friends.

## Consequences

- Anyone who learns a code can add its owner and so appears in their list with a display name; the owner is not asked. Replacing the code is the only way to stop further adds.
- A Friend sees only the other's display name, so nothing sensitive leaks through the list.
- A request flow can be added later without changing the table: pending requests would be a second table.
- Codes are not retried on a collision (about 1 in 10^12 per pair); revisit if Users grow into the millions.
