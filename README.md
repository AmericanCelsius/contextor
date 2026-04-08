# Contextor

Contextor is a local-first context aggregation and browser automation tool for macOS. In `v0.2.0`, the primary GUI surface is a true terminal-contained TUI built with Ink. The old browser dashboard is no longer the main interface.

## What Changed In v0.2.0

- Replaced the browser-first HTML dashboard with a terminal-contained TUI
- Added `contextor tui` and `contextor dashboard`
- Kept the existing core workflows intact
- Improved Chrome attach diagnostics for open-tab workflows
- Deprecated `contextor gui` as a browser-surface entrypoint; it now forwards to the TUI

The TUI is designed as a retro-futuristic command console with panel layout, keyboard navigation, recent runs, logs, config summary, and browser attach status.

## Install

```bash
npm install
npm run build
```

Optional:

```bash
npm link
```

## First Run

### 1. Launch Chrome With Remote Debugging

Open-tab workflows require attaching to the real Chrome session you want Contextor to inspect.

Close Chrome completely, then launch it from Terminal:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
```

If you only want a separate automation profile:

```bash
./scripts/open-chrome-debug.sh
```

Important:

- The dedicated script launches a separate profile and does not include your existing tabs.
- `tabs`, `page-export`, and `social-audit` are attach-oriented workflows. They do not silently treat a fresh automation profile as your already-open browsing session.

### 2. Launch The TUI

```bash
contextor tui
```

Or without `npm link`:

```bash
node dist/cli/index.js tui
```

You can also use:

```bash
contextor dashboard
```

Deprecated alias:

```bash
contextor gui
```

### 3. Use The Command Grid

The TUI supports:

- Compile Open Tabs
- Compile Folder
- Export Current Page
- Instagram Non-Mutuals Audit
- Open Latest Output Folder
- View Latest Logs
- View Recent Runs
- View Current Config Summary

Keyboard-first controls:

- `↑` / `↓` select action
- `Enter` run or open a form
- `Tab` switch inspect panels
- `r` refresh
- `o` open the latest output folder
- `l` focus logs
- `u` focus recent runs
- `c` focus config
- `b` focus browser status
- `q` quit

## CLI Reference

### TUI

```bash
contextor tui
contextor dashboard
```

### Browser Status

```bash
contextor browser-status
```

This prints:

- attach URL
- current browser mode
- whether the CDP endpoint is reachable
- usable tab count
- current attach issues

### Tabs

```bash
contextor tabs --all --goal "summarize my current browser context"
contextor tabs --current
contextor tabs --match "brightspace|gradescope|edstem"
```

Behavior:

- `--all` captures all attached open tabs
- `--match` matches against both URL and title
- if Chrome is not actually exposing the CDP endpoint, Contextor now fails with an explicit attach error instead of the older vague “No browser tabs matched”

### Folder

```bash
contextor folder "/absolute/path/to/folder" --goal "summarize this project folder"
```

Supported file types:

- `.txt`
- `.md`
- `.pdf`
- `.json`
- `.csv`
- `.docx`

### Page Export

```bash
contextor page-export --current --mode linkedin --goal "export this LinkedIn page"
```

Exports:

- markdown
- text
- PDF

### Social Audit

```bash
contextor social-audit --platform instagram --mode non-mutuals --dry-run
```

Still read-only in `v0.2.0`.

## Output Structure

Each run writes to:

```text
output/runs/<timestamp>/
```

With artifacts such as:

```text
context.md
context.txt
logs/run.log
artifacts/*.md
artifacts/*.txt
artifacts/*.pdf
manifests/sources.json
```

Instagram audit runs also write their audit artifacts in the same timestamped bundle.

## Browser Attach Notes

The attach URL is configured in:

```text
config/contextor.config.json
```

Current default:

```json
{
  "browser": {
    "attachUrl": "http://127.0.0.1:9222",
    "mode": "attach-or-launch"
  }
}
```

Operational reality for the current product:

- open-tab workflows require a real attachable Chrome session
- the TUI browser panel and `browser-status` command make attach failures visible
- attach failure messaging now explains what to relaunch and why
- Contextor never closes the user’s attached Chrome session

## Safety Defaults

Contextor remains:

- local-first
- read-only by default
- no email sending
- no portal submission
- no deleting or archiving
- no account-changing social actions
- logging and manifest generation are preserved for each run

## TUI Notes

The TUI is built with Ink and custom terminal panels. `@inkjs/ui` was evaluated as part of the integration path, but the shipped interface relies primarily on custom Ink components. `TerminalTextEffects` was evaluated as inspiration only and was not adopted as a Python runtime dependency.

Implemented visual polish:

- alternate-screen terminal containment
- retro command-console panel styling
- lightweight built-in boot splash

Not implemented:

- external Python animation runtime
- browser-based GUI as the primary surface

## Development

```bash
npm install
npm run typecheck
npm run build
npm run smoke:folder
```

Useful local commands:

```bash
node dist/cli/index.js tui
node dist/cli/index.js browser-status
node dist/cli/index.js tabs --all --goal "summarize my current browser context"
```
