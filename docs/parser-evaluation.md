# Parser Evaluation (M1)

Date: 2026-02-23

## Candidates

1. `demofile` (Node/TS native)
2. Python-based external parser pipeline (wrapper process)

## Scoring Criteria

| Criterion | Weight | demofile | Python pipeline |
|---|---:|---:|---:|
| CS2 `.dem` compatibility / maintenance | 0.30 | 0.75 | 0.65 |
| Tick-level access (angles/shots/kills) | 0.25 | 0.70 | 0.80 |
| Parse speed (single match) | 0.20 | 0.80 | 0.55 |
| Integration cost in Node/TS CLI | 0.15 | 0.90 | 0.35 |
| Error handling + debuggability | 0.10 | 0.75 | 0.60 |
| Weighted total | 1.00 | **0.77** | **0.62** |

## Decision

Selected parser: `demofile`.

Rationale:
- Native Node/TypeScript fit with low integration overhead.
- Sufficient event-level data for MVP metrics.
- Better end-to-end runtime profile for local CLI usage.

## API Freeze

`parseDemo(path): Promise<ParsedMatch>` is the adapter contract for MVP.
