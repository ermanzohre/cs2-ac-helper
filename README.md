# CS2 Anti-Cheat Helper

CLI tool that analyzes a single CS2 demo and produces suspicion-focused reports.

## Usage

```powershell
npm install
npm run build
node dist/cli/index.js analyze .\match.dem --out .\reports
```

## CLI options

- `--out <dir>` output directory, default `./reports`
- `--format <list>` comma-separated `json,html,csv`, default `json,html`
- `--csv` adds `csv` output
- `--min-samples <n>` default `8`
- `--min-rounds <n>` default `10`
- `--parser <name>` `auto|demofile|demoparser2`, default `auto`
- `--lang <code>` `tr|en`, default `tr`
- `--known-clean <list>` comma-separated known clean players (name matching is normalized)
- `--known-suspicious <list>` comma-separated known suspicious players
- `--known-cheat <list>` alias of `--known-suspicious`
- `--focus-player <name>` builds team-only Trust Factor table for this player and teammates (default `Morpheus`)
- `--pretty` / `--no-pretty` JSON indentation toggle
- `--verbose` include parser diagnostics in warnings

## Feedback calibration

You can calibrate verdicts with known player feedback when a demo has trusted labels:

```powershell
node dist/cli/index.js analyze .\match.dem --out .\reports --lang tr --known-clean "aKs--,Morpheus,MAG,Mmt" --known-suspicious "INSPIRING"
```

Notes:
- Name matching ignores case, punctuation and accents (example: `aKs--` equals `aks`).
- If a name is provided in both clean and suspicious lists, suspicious takes priority and a warning is added.
- If a provided name is not found in the demo, a warning is added.

## Parser selection

- `auto` chooses parser based on demo header:
  - `PBDEMS2` -> `demoparser2` (CS2 demos)
  - otherwise -> `demofile`
- `demofile` is kept for older CSGO/legacy demo compatibility.
- `demoparser2` is recommended for CS2 matchmaking/replay demos.

## Output files

- `report.json`
- `report.html`
- `timeline.csv` (only when `--csv` is provided)

Each player row now includes combat context:
- kills / deaths / K-D ratio
- damage given / damage taken
- ADR (average damage per round)
- headshot rate

`report.html` and `report.json` also include a team-only Trust Factor table for `--focus-player`:
- includes only the focus player and same-team teammates
- computes a per-player Trust Factor (0-100)
- provides actionable "how to increase" recommendations for each player

## Detection notes

Current proxy rules prioritize these suspicious patterns:

- smoke + headshot combinations
- prepared peek timing (probing shots before kill + short shot-to-kill lead)
- stable angle hold before kill followed by immediate elimination

These are still behavioral proxies from demo events, not direct cheat proof by themselves.

## Verdict labels

Each player includes a verdict label for easier reading:

- `Belirsiz / Inconclusive`
- `Temiz / Clean`
- `Izlenmeli / Watch`
- `Supheli / Suspicious`
- `Yuksek suphe / High Suspicion`
