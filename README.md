# Installation Readiness Report — Submission

## Run / test
Node.js 18+ (tested on 20). No dependencies.

    node report.js input.json > actual.json
    python3 check_output.py expected.json actual.json
    npm test

## Approach
`buildReport(data)` in `report.js` does the work; small helpers (`rejectionReason`, `isValidRevision`, `isNonEmptyString`, `isPlainObject`, `compareAscii`) keep each rule separate.

State kept during one pass over `updates`:
- `ordersById` (Map): `order_id` → order (with its `city`).
- `taskState` (Map): `order_id` → Map of `task` → `{revision, status}`.
- `seenEventIds` (Set): event IDs of valid updates already applied.
- `rejectedUpdates` (array of `{index, event_id, reason}`) and `duplicateUpdates` (integer).

For each update:
1. Validate shape, the four required non-empty strings, status and positive-integer revision → `invalid_update`; then `unknown_order`; then `unknown_task`. Rejections change nothing.
2. If the `event_id` is in `seenEventIds`, increment `duplicateUpdates` and skip; otherwise add it.
3. Replace the task's state only if the update's revision is higher than the stored one. Late older data is ignored; a newer `pending` reopens a task.

Finally, orders are sorted by `order_id`, and `status`, `completed_tasks` and `pending_tasks` (canonical order) are derived from `taskState`, followed by the summary.

## Complexity
Time O(U + N log N) for U updates and N orders; space O(N + U).

## Assumptions / limitations
- A whitespace-only `event_id` on a rejected update is reported as `null`.
- Equal revisions: the first seen is kept (statuses are guaranteed equal).
- Conflicting reused event IDs are not detected (out of scope).
- JavaScript parses `1.0` as `1`; the brief excludes this case.

## Tests
`report.test.js` (node:test): both fixtures, untouched order, all done, duplicates, late older revision, pending correction, invalid/unknown data, rejection precedence, sorting.

## Active time
1.5 hours: 30 minutes reading the brief and dry-running `input.json` against `expected.json`, 1 hour designing, implementing and testing. No unfinished work; all requirements are covered.

## Tooling statement
AI used: Claude Code, to write the function logic and test cases in a modular, readable structure that is easy to extend. Independently checked: I dry-ran `input.json` by hand against `expected.json`, reviewed the code logic and its split into helper functions, and ran the tests and `check_output.py`.
