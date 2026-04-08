# AGENTS.md

## Project Purpose

Contextor is a local-first context compiler and browser automation tool. As of `v0.2.1`, the primary interactive UI is the terminal-contained TUI under `src/tui/`.

Primary surfaces:

- CLI in `src/cli/index.ts`
- TUI in `src/tui/`
- orchestration in `src/core/orchestrator.ts`

## Core Constraints

- Keep the orchestrator simple and deterministic
- Privacy and read-only defaults matter more than aggressive automation
- Do not add autonomous multi-agent behavior
- Do not add risky browser or social actions by default
- Do not reintroduce a browser-first GUI as the main interface

## Key Workflows

- `tabs`: compile open tabs into `context.md`
- `folder`: compile a folder into `context.md`
- `page-export`: export current page to markdown, text, PDF
- `social-audit`: read-only Instagram non-mutuals audit
- `browser-status`: inspect CDP/browser attach health
- `tui`: launch the main terminal dashboard
- `launch` / `start`: install, build, then launch the TUI from the project root

## Important Files

- `config/contextor.config.json`
- `src/adapters/browserAdapter.ts`
- `src/adapters/filesystemAdapter.ts`
- `src/compiler/contextCompiler.ts`
- `src/workflows/*.ts`
- `src/tui/*`

## Build Commands

```bash
npm install
npm run typecheck
npm run build
npm run smoke:folder
```

## Browser Notes

- open-tab workflows require a Chrome session launched with `--remote-debugging-port=9222`
- browser attach diagnostics are exposed through `browser-status` and the TUI browser panel
- do not silently treat a fresh launched profile as the user’s existing tab session
- never close the user’s attached Chrome session from code

## TUI Notes

- Ink is the primary TUI runtime
- the TUI is keyboard-first and terminal-contained
- keep visual styling intentional, readable, and slightly retro
- keep startup, shutdown, run-progress, and validation animations working
- avoid external animation runtimes unless complexity stays very low
- preserve the input-echo layer so the last command/navigation key remains visible
- keep folder path autocomplete and quoted-path handling working
- preserve quit confirmation on `q`
- keep folder compile defaulted to `all` unless the operator explicitly narrows it

## Safety Notes

- keep communication and portal workflows read-only
- keep Instagram audit review-only unless explicitly expanded in a later milestone
- preserve logging and output manifests
- respect `allowedDirectories`

## Output Contract

Every workflow should continue writing to:

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
```

With:

- `context.md`
- `context.txt`
- `logs/run.log`
- `artifacts/`
- `manifests/`
