# Contextor

Contextor is a local-first context aggregation and browser automation tool for macOS. It compiles browser tabs, selected folders, and dynamic pages into dense output bundles under `output/runs/<timestamp>/`.

Phase 1 ships:

- A working CLI: `contextor`
- A lightweight local GUI dashboard
- Browser workflows for tabs, page export, and a read-only Instagram audit
- Filesystem compilation for `.txt`, `.md`, `.pdf`, `.json`, `.csv`, and `.docx`
- Timestamped outputs with logs, manifests, and page artifacts

## What Works Now

- Compile open Chrome or Chromium tabs into a single `context.md`
- Compile a selected local folder into a single `context.md`
- Expand and export the current page to markdown, text, and PDF
- Run a local GUI dashboard for the main workflows
- Generate a read-only Instagram non-mutuals audit report

## Requirements

- macOS on Apple Silicon or Intel
- Node.js 20+
- Google Chrome or Chromium installed

## Install

```bash
npm install
npm run build
```

## First Run

### 1. Launch Chrome with Remote Debugging

For Contextor to read the tabs already open in your real browser session, Chrome must be started with remote debugging enabled.

Close Chrome completely, then launch it from Terminal:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
```

If you prefer a separate automation profile instead of your main profile, use:

```bash
./scripts/open-chrome-debug.sh
```

Important:

- The dedicated script launches a separate profile, so it does not include your existing tabs.
- To compile your real currently open tabs, the browser instance that already has those tabs must be the one launched with `--remote-debugging-port=9222`.

### 2. Verify Config

Contextor reads `config/contextor.config.json`.

Default behavior:

- Allowed directories: repo root, `~/Desktop`, `~/Documents`, `~/Downloads`
- Output root: `./output`
- Browser mode: `attach-or-launch`
- Social audit: dry-run / read-only

If you want to compile folders outside those locations, add them to `allowedDirectories`.

### 3. Run a Real Workflow

Compile all open tabs:

```bash
node dist/cli/index.js tabs --all --goal "summarize my current browser context"
```

Compile a folder:

```bash
node dist/cli/index.js folder "/absolute/path/to/folder" --goal "summarize this project folder"
```

Export the current LinkedIn page:

```bash
node dist/cli/index.js page-export --current --mode linkedin --goal "export this LinkedIn page"
```

Run the read-only Instagram audit:

```bash
node dist/cli/index.js social-audit --platform instagram --mode non-mutuals --dry-run
```

Start the GUI:

```bash
node dist/cli/index.js gui --port 4317
```

Open:

```text
http://127.0.0.1:4317
```

## CLI Reference

### Tabs

```bash
contextor tabs --all
contextor tabs --match "brightspace|gradescope|edstem"
contextor tabs --current
```

Behavior:

- `--all` captures all open tabs
- `--match` matches against both URL and title
- default behavior captures the current visible tab

### Folder

```bash
contextor folder "/absolute/path/to/folder"
contextor folder "./docs" --goal "summarize the documentation"
```

Behavior:

- recursively scans supported files
- scores them by recency and goal overlap
- compiles the highest-signal files into one context bundle

### Compile

```bash
contextor compile --goal "summarize my homework context" --tabs --all-tabs
contextor compile --goal "combine folder and browser context" --folder "/path/to/folder" --tabs
```

### Page Export

```bash
contextor page-export --current --mode linkedin
contextor page-export --current --mode generic
```

Behavior:

- expands dynamic content
- scrolls until stable
- exports markdown, text, and PDF when supported by the page/browser

### Social Audit

```bash
contextor social-audit --platform instagram --mode non-mutuals --dry-run
```

Behavior:

- reads follower/following lists already open in Chrome
- compares following vs followers
- filters likely brands, institutions, and public figures heuristically
- exports `instagram_non_mutuals.md` and `instagram_non_mutuals.csv`

Phase 1 safety:

- no unfollowing
- no account-changing actions
- `--allow-account-actions` and `--confirm` are reserved and still do not perform actions in this milestone

## GUI

The GUI is a lightweight local dashboard with a retro arcade shell.

Available actions:

- Compile Open Tabs
- Compile Folder
- Export Current Page
- Instagram Non-Mutuals Audit
- Open Latest Output Folder
- View Latest Logs

The GUI also shows:

- current workflow status
- recent runs
- output paths
- latest logs
- config preview

## Output Structure

Each run creates:

```text
output/
  runs/
    <timestamp>/
      context.md
      context.txt
      logs/
        run.log
      artifacts/
        *.md
        *.txt
        *.pdf
        instagram_non_mutuals.md
        instagram_non_mutuals.csv
      manifests/
        sources.json
        instagram_audit.json
```

Example:

```text
output/runs/2026-04-07T21-55-47/context.md
output/runs/2026-04-07T21-55-47/artifacts/page.pdf
output/runs/2026-04-07T21-55-47/manifests/sources.json
```

## Browser Strategy Notes

Built-in strategies:

- `generic`
- `linkedin`
- `gmail`
- `portal`
- `instagram`

Highlights:

- LinkedIn uses repeated "more/show more/read more" passes and scroll stabilization
- Gmail/webmail extraction is read-only
- Course portal extraction is tuned for Brightspace, Gradescope, EdStem, Canvas-like pages
- Instagram audit is read-only and review-oriented

## Filesystem Strategy Notes

Supported file types:

- `.txt`
- `.md`
- `.pdf`
- `.json`
- `.csv`
- `.docx`

Contextor does not blindly dump whole folders. It:

- scans recursively
- extracts text
- ranks files by relevance
- suppresses duplicate content
- compiles excerpts, summaries, and key points

## Config

Main file:

```text
config/contextor.config.json
```

Key fields:

- `allowedDirectories`
- `outputDirectory`
- `browser.attachUrl`
- `browser.mode`
- `browser.userDataDir`
- `strategies.enabled`
- `redaction`
- `socialAudit`
- `safety`

## Permissions and macOS Notes

You may need to grant:

- Files and Folders access for Terminal or your Node runtime if you want to read `Desktop`, `Documents`, or `Downloads`
- Browser remote debugging access by launching Chrome with `--remote-debugging-port=9222`

Contextor does not require Accessibility permissions for CDP-based browser control.

## Safety Defaults

Default safety posture:

- local-first
- read-only by default
- no email sending
- no portal submission
- no deletion or archiving
- no account-changing actions
- logs written for every run
- obvious tokens and cookie headers redacted where feasible

## Development

Install and verify:

```bash
npm install
npm run typecheck
npm run build
```

Useful commands:

```bash
npm run gui
npm run smoke:folder
```

## Known Phase 1 Constraints

- Existing real tabs require Chrome to be launched with remote debugging enabled
- The Instagram audit works best when follower and following lists are already open and scrolled in Chrome
- Browser exports depend on the page being accessible in the attached Chrome session
