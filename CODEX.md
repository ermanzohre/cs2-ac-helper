# CODEX RULES — CS2 Anti-Cheat Helper (Erman)

Goal: Build a CLI tool that parses CS2 demo files and produces a suspicion report.
We will move in small, safe steps and keep the repo always runnable.

## Working style

- Always propose a plan first (max 8 bullets) before editing code.
- Make minimal changes per step; prefer small PR-style commits.
- Keep the CLI working after each step (build + run).

## Tech constraints (for now)

- Node.js + TypeScript
- CLI uses `commander`
- Output: JSON report first, then HTML
- No network calls, no external services

## Repo conventions

- Put CLI entry in `src/cli/index.ts`
- Parsing logic in `src/core/*`
- Report format in `src/report/*`

## Definition of done for each step

- `npm run build` passes
- A test command is shown that I can run in PowerShell
- Any new file/function is referenced from the CLI
