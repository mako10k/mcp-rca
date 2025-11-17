# case_get Pagination and Include Guide

The `case_get` tool returns the latest state of a single RCA case. Large collections (observations, hypotheses, tests, results) can be selectively included and paged to control response size.

## Include Semantics

- Omit `include` to receive all collections (observations are still paged by the current limit).
- Pass `include: []` to receive only top-level metadata (no collections) for minimal responses.
- Provide any combination of `observations`, `hypotheses`, `tests`, and `results` to include specific collections.

```ts
await case_get({ caseId, include: ["observations", "hypotheses"] });
```

## Observation Paging

Observations can be paged via `observationLimit` and `observationCursor`:

```ts
// First page (defaults: limit 20, cursor omitted)
const first = await case_get({
  caseId,
  include: ["observations"],
  observationLimit: 10,
});

const nextCursor = first.cursors?.nextObservationCursor;

// Next page
const second = await case_get({
  caseId,
  include: ["observations"],
  observationLimit: 10,
  observationCursor: nextCursor,
});
```

### Cursor Metadata

When observations are included, the response contains paging metadata in `cursors`:

| Field | Description |
|-------|-------------|
| `observationLimit` | Limit applied to the current page (default 20, max 100) |
| `observationReturned` | Number of observations returned in this page |
| `observationTotal` | Total observations stored on the case |
| `hasMoreObservations` | `true` when another page is available |
| `nextObservationCursor` | Cursor to request the next page (undefined when no more pages) |

## Example Response

```json
{
  "case": {
    "id": "case_123",
    "observations": [ /* up to observationLimit items */ ],
    "hypotheses": [],
    "tests": [],
    "results": []
  },
  "cursors": {
    "observationLimit": 10,
    "observationReturned": 10,
    "observationTotal": 25,
    "hasMoreObservations": true,
    "nextObservationCursor": "eyJvZmZzZXQiOjEwfQ"
  }
}
```

Use `hasMoreObservations` or `nextObservationCursor` to determine when paging is complete.
