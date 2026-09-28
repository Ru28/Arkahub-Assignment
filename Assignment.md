# Engineer exercise: installation readiness report

**Time limit: 60 active minutes. Language: your choice.** Intended for an engineer with roughly three years of experience. We assess implementation and reasoning, not familiarity with solar terminology or a particular framework.

Arkahub's operations team needs to know which solar installations can be scheduled. Each order has three prerequisites: payment cleared, site survey completed, and materials available. Different systems send status updates. Messages may be duplicated or arrive out of order; a newer correction can reopen a previously completed task.

Build a local program or function that turns the supplied JSON into the exact report described below. No UI, web server, database, login, cloud deployment, or external integration is required. Use maps/dictionaries, lists, and tests in a language you know well.

## Input

The root object contains `orders` and `updates`. Orders always have unique non-empty string `order_id` values and a valid `city`. The root structure and order list are guaranteed valid, including an empty order list. Individual updates can be invalid.

An update has these fields:

```json
{"event_id":"e1","order_id":"ARK-101","task":"payment","status":"done","revision":1}
```

Allowed tasks, in canonical order: `payment`, `site_survey`, `materials`.

Allowed statuses: `pending`, `done`. An absent task starts as pending.

Revision is a **positive JSON integer** for that `(order_id, task)`, not a global sequence. Reject strings, booleans, zero, negatives, and fractional numbers as revisions. No update has an integer-valued float spelling such as `1.0`; cross-language JSON parser representation is not the subject of the exercise.

## Rules

1. Validate each update independently. Required string fields must be non-empty after trimming for the emptiness check; identifiers are otherwise used as supplied. Do not silently coerce types. Unknown extra fields can be ignored.
2. Reject invalid shape/types/status/revision as `invalid_update`. Then check the order exists (`unknown_order`), then the task is allowed (`unknown_task`). This order defines precedence if more than one field is wrong.
3. Invalid updates do not change state or enter the duplicate set. Report each rejected occurrence with its zero-based input index, `event_id` if it is a non-empty string (otherwise null), and reason.
4. Process each valid `event_id` once. A repeated valid event ID counts as a duplicate and makes no additional change. Repeated IDs have identical business fields in this exercise; conflicting reused event IDs are outside scope.
5. For each `(order_id, task)`, the update with the highest revision wins, regardless of arrival order. A higher revision of `pending` reopens the task. Equal revisions have the same status in this exercise, so either can be retained. A distinct, older valid event is not a duplicate; it simply does not replace newer task state.
6. An order is `ready` only when all three tasks are done; otherwise it is `blocked`.

## Output

Return/write a JSON object with exactly these fields:

- `orders`: one entry per input order, sorted ascending by `order_id` (all IDs in the fixtures are ASCII). Each entry has `order_id`, `city`, `status` (`ready`/`blocked`), `completed_tasks` (0–3), and `pending_tasks` in canonical task order.
- `summary`: `total_orders`, `ready`, and `blocked`.
- `duplicate_updates`: count of repeated valid event IDs.
- `rejected_updates`: the rejection records, in input order, each with `index`, `event_id`, and `reason`.

JSON object key order and whitespace do not matter. Array order and value types do matter. Empty collections must be JSON arrays, not null.

`input.json` and `expected.json` show a complete example. `empty-input.json` and `empty-expected.json` cover empty input. The provided `check_output.py` is an optional Python comparator; your submission can be in any language and does not need Python.

Example invocation shape (choose and document your own):

```text
your-program input.json > actual.json
python3 check_output.py expected.json actual.json
```

## Deliverables

1. Source and any dependency information needed to run it.
2. Automated tests covering: an initially untouched order; all tasks done; a duplicate; late older data; a higher-revision correction back to pending; invalid/unknown data. Tests can combine cases where their assertions remain clear.
3. A README of **at most 350 words** with exact run/test commands, the approach, time/space complexity, limitations, and actual active time. Identify unfinished work honestly.
4. A brief tooling statement: AI/tools used or “none,” and one thing you independently checked. No private chat transcripts required.

Suggested split: 10 minutes reading/examples, 30 implementation, 15 testing, 5 notes. Stop after 60 active minutes. Extra features/polish earn no extra credit. Setup failures pause the clock.

AI, search, and documentation are allowed. Another person's help is not allowed. Submit privately. During the follow-up, we will ask you to trace an example and make a small change; AI remains allowed during implementation. We assess correctness, clear reasoning, edge-case tests, and your ability to own the result. We do not require distributed-systems expertise for this task.
