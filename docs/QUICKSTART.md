# Contextor Quickstart

## Install

```bash
npm install
npm run build
```

## Launch Chrome For Real Tab Access

Close Chrome, then run:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
```

If you only want a separate automation profile:

```bash
./scripts/open-chrome-debug.sh
```

## Run First Commands

Compile all open tabs:

```bash
node dist/cli/index.js tabs --all --goal "summarize my current browser context"
```

Compile a folder:

```bash
node dist/cli/index.js folder "/absolute/path/to/folder" --goal "summarize this folder"
```

Export the current LinkedIn page:

```bash
node dist/cli/index.js page-export --current --mode linkedin --goal "export this LinkedIn page"
```

Run the GUI:

```bash
node dist/cli/index.js gui --port 4317
```

Open:

```text
http://127.0.0.1:4317
```

## Output Location

```text
output/runs/<timestamp>/
```

Key files:

- `context.md`
- `context.txt`
- `logs/run.log`
- `artifacts/`
- `manifests/sources.json`

## Safety Defaults

- Browser workflows are read-only by default
- Instagram audit is read-only and dry-run
- No emails, portal submissions, deletions, or account actions are performed

## If Folder Access Fails

Add the path to:

```text
config/contextor.config.json
```
