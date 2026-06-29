# Contextor Quickstart

## Install

```bash
npm install
npm run build
```

## Launch Chrome For Real Tab Access

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
```

If you only want a separate automation profile:

```bash
./scripts/open-chrome-debug.sh
```

## Launch The TUI

```bash
node dist/cli/index.js tui
```

Or after `npm link`:

```bash
contextor tui
```

One-line bootstrap:

```bash
contextor launch
contextor start
contextor start --offline
contextor launch --offline
```

Local-only offline mode:

```bash
contextor offline
contextor tui --offline
```

Offline mode does not require WiFi, API keys, Chrome remote debugging, browser attach, or online LLM services. Use it for `Summarize Folder Context`, `Export Literal Folder Copy`, output review, logs, and config inspection.

The TUI now includes a `Prompt Console` action as a future-facing panel scaffold. It does not execute arbitrary agentic browser-control tasks in `v0.2.2`.

Current top TUI actions:

- `1. Export Literal Folder Copy`
- `2. View Latest Runs`

When the latest-runs panel is focused, use `↑` / `↓` to browse runs and `Enter` or `o` to open the selected run folder.

## Useful First Commands

Check browser attach status:

```bash
contextor browser-status
```

Compile open tabs:

```bash
contextor tabs --all --goal "summarize my current browser context"
```

Compile a folder:

```bash
contextor folder "/absolute/path/to/folder" --goal "summarize this project folder"
```

Folder compile notes:

- default file limit is `all`
- both the TUI and the direct CLI command show live folder progress
- the TUI confirms a folder compile before starting it
- while a folder compile is running, press `x` to open the abort prompt

Run a literal directory copy:

```bash
contextor copy-folder "/absolute/path/to/folder" --goal "create a literal directory copy for downstream review"
contextor copy-folder "/absolute/path/to/folder" --include-hidden --goal "create a literal directory copy for downstream review"
```

Literal directory copy notes:

- this is separate from `Summarize Folder Context` in the TUI
- it reuses the same path autocomplete and confirmation flow as the summarizer
- it writes aggregated file bodies to `{source_folder}_context.md` and `{source_folder}_context.txt`
- it redacts `.env`-style secrets, tokens, usernames, emails, passwords, private keys, and database URLs by default
- interactive CLI exports ask whether to open the generated run folder; press `Enter`, `y`, or `yes` to open it
- while the workflow is running, press `x` to open the abort prompt

Tabs workflow notes:

- inside the TUI, `x` now opens the abort prompt for tab capture runs too
- `o` opens the `output/runs` container folder

Export the current LinkedIn page:

```bash
contextor page-export --current --mode linkedin --goal "export this LinkedIn page"
```

## Output Location

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
```

Generated run artifacts under `output/runs/` are ignored by git.

## Current Primary GUI

- `contextor tui` is the main GUI
- `contextor launch` and `contextor start` install, build, then open the TUI
- `contextor gui` is only a deprecated alias to the TUI
- the old browser dashboard is no longer the primary product surface
- press `g` inside the TUI to launch the Chrome debug helper in a separate profile

## Safety Defaults

- browser workflows are read-only by default
- `contextor social-audit` remains as a legacy CLI fallback and is still read-only and dry-run
- no email sending, portal submission, deletion, or account-changing actions
