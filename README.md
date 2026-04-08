# Contextor

Contextor is a local-first context aggregation and browser automation tool for macOS. In `v0.2.2`, the primary GUI surface is a true terminal-contained TUI built with Ink. The old browser dashboard is no longer the main interface.

## What Changed In v0.2.2

- Preserved the `v0.2.1` TUI as the baseline and moved the new directory-copy work into `v0.2.2`
- Added animated startup, shutdown, run-progress, browser-connect, and path-validation indicators
- Added live input echo so the last navigation or command key is always visible
- Added folder-path autocomplete, recommended Finder/current working directory seeds, cursor movement, and quoted-path normalization for TUI path entry
- Made folder compile default to `File Limit = all`, with progress feedback in both the TUI and `contextor folder`
- Added `Copy Folder As Markdown/Text`, a separate literal directory-export workflow that aggregates recursive file bodies instead of summarizing them
- Added descriptive run folder names: `output/runs/<timestamp>__<workflow>__<goal-slug>/`
- Added `contextor launch` and `contextor start` as one-line bootstrap commands
- Kept the existing core workflows intact and read-only by default

The TUI is designed as a retro-futuristic command console with panel layout, keyboard navigation, recent runs, logs, config summary, browser attach status, and animated workflow feedback.

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

One-line bootstrap:

```bash
contextor launch
contextor start
```

Deprecated alias:

```bash
contextor gui
```

### 3. Use The Command Grid

The TUI supports:

- Compile Open Tabs
- Compile Folder
- Copy Folder As Markdown/Text
- Export Current Page
- Instagram Non-Mutuals Audit
- Launch Chrome Debug Browser
- Open Latest Output Folder
- View Latest Logs
- View Recent Runs
- View Current Config Summary

Keyboard-first controls:

- `↑` / `↓` select action
- `Enter` run or open a form
- `Enter` on the folder form opens a confirmation panel before the compile starts
- `Enter` on the directory-copy form opens a confirmation panel before the export starts
- `Tab` switch inspect panels, or autocomplete the folder path field when it is active
- `Left` / `Right` move the cursor inside active text fields
- `Ctrl+U` clear the active text field
- `x` open the abort prompt while a folder compile is running
- `x` also aborts the literal directory-copy workflow once it is running
- `g` launch the Chrome debug browser helper from inside the TUI
- `r` refresh
- `o` open the latest output folder
- `l` focus logs
- `u` focus recent runs
- `c` focus config
- `b` focus browser status
- `Esc` back out of forms
- `q` open the quit confirmation prompt

## CLI Reference

### TUI

```bash
contextor tui
contextor dashboard
contextor launch
contextor start
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

Default behavior:

- scans all supported files unless you explicitly pass `--limit <count>`
- shows a live progress bar in direct CLI mode
- the TUI shows a confirmation step before the folder compile starts
- once running, the TUI exposes a cancel prompt for the folder workflow

### Literal Directory Copy

```bash
contextor copy-folder "/absolute/path/to/folder" --goal "create a literal directory copy for downstream review"
```

Behavior:

- keeps `Compile Folder` separate from the literal copier workflow
- reuses the same TUI folder-path autocomplete, path validation, and confirmation flow
- recursively scans the selected directory and aggregates readable file bodies into root `context.md` and `context.txt`
- attempts text extraction for common document formats and generic UTF-8 readable files
- skips binary-looking files with explicit notes in the aggregated output and manifest

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

Still read-only in `v0.2.2`.

## Output Structure

Each run writes to:

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
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

Instagram audit runs also write their audit artifacts in the same run bundle.

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

The TUI is built with Ink and custom terminal panels. `@inkjs/ui` was evaluated as part of the integration path, but the shipped interface relies primarily on custom Ink components. `TerminalTextEffects` was used as animation inspiration, but the shipped runtime remains Node.js and TypeScript rather than embedding the Python engine directly.

Implemented visual polish:

- alternate-screen terminal containment
- retro command-console panel styling
- startup and shutdown animation sequences
- animated run-progress and browser/path indicators
- live input echo for navigation and command keys
- folder-path autocomplete and validation hints

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
node dist/cli/index.js launch
node dist/cli/index.js browser-status
node dist/cli/index.js tabs --all --goal "summarize my current browser context"
```
