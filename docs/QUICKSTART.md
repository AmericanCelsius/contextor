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
```

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

Export the current LinkedIn page:

```bash
contextor page-export --current --mode linkedin --goal "export this LinkedIn page"
```

## Output Location

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
```

## Current Primary GUI

- `contextor tui` is the main GUI
- `contextor launch` and `contextor start` install, build, then open the TUI
- `contextor gui` is only a deprecated alias to the TUI
- the old browser dashboard is no longer the primary product surface
- press `g` inside the TUI to launch the Chrome debug helper in a separate profile

## Safety Defaults

- browser workflows are read-only by default
- Instagram audit is read-only and dry-run
- no email sending, portal submission, deletion, or account-changing actions
