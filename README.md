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
- `--pretty` / `--no-pretty` JSON indentation toggle
- `--verbose` include parser diagnostics in warnings

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
