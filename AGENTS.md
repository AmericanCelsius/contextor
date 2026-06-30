# AGENTS.md

## Project Purpose

Contextor is a local-first context compiler and browser automation tool. As of `v0.2.2`, the primary interactive UI is the terminal-contained TUI under `src/tui/`.

Primary surfaces:

- CLI in `src/cli/index.ts`
- TUI in `src/tui/`
- orchestration in `src/core/orchestrator.ts`
- macOS fresh-clone bootstrap scripts in `scripts/start-macos.sh` and `scripts/setup-macos.sh`

## Core Constraints

- Keep the orchestrator simple and deterministic
- Privacy and read-only defaults matter more than aggressive automation
- Do not add autonomous multi-agent behavior
- Do not add risky browser or social actions by default
- Do not reintroduce a browser-first GUI as the main interface

## Key Workflows

- `tabs`: compile open tabs into `context.md`
- `task-console`: prompt-console scaffold for future arbitrary connector-backed task entry inside the TUI
- `folder`: compile a folder into `context.md`
- `copy-folder`: export a literal directory copy into aggregated markdown/text outputs
- `copy-folder --chunk-markdown`: export a literal directory copy into strategic continuation markdown/text chunks for easier downstream upload
- `page-export`: export current page to markdown, text, PDF
- `social-audit`: legacy read-only Instagram audit fallback kept outside the main TUI
- `browser-status`: inspect CDP/browser attach health
- `offline`: launch the main terminal dashboard in local-only offline mode
- `tui`: launch the main terminal dashboard
- `launch` / `start`: install, build, then launch the TUI from the project root; supports `--offline` and best-effort `--fullscreen`

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

Fresh macOS clone path:

```bash
bash scripts/start-macos.sh --offline
```

Setup-only path:

```bash
bash scripts/setup-macos.sh --link
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
- avoid React key collisions in repeated TUI lists so warnings do not bleed into the active terminal
- keep the fresh macOS startup scripts working without assuming `contextor` is globally linked
- keep `scripts/start-macos.sh` launching with direct `node dist/cli/index.js tui` after install/build so stdin remains a real interactive TTY
- keep fixed-width TUI panels clamped to the current terminal width
- keep folder compile defaulted to `all` unless the operator explicitly narrows it
- preserve the folder compile confirmation step before the run starts
- keep folder compile abortable from the TUI once it is running
- keep tabs abortable from the TUI once a capture run has started
- keep the literal directory-copy workflow separate from the summarizer, while reusing the same folder-path autocomplete UX
- keep the TUI browser-launch helper available for separate Chrome debug profiles
- keep the main TUI moving away from Instagram-specific panels and toward a broader prompt-console surface without deleting fallback audit logic
- preserve offline mode as a first-class local-only mode that does not require WiFi, API keys, online LLMs, Chrome remote debugging, or browser attach
- keep the Offline Mode command visible in the TUI command grid
- keep directory-copy success prompts for opening the exact generated run folder
- keep literal directory-copy output filenames source-folder-based, e.g. `my_project_context.md` and `my_project_context.txt`
- keep strategic directory-copy chunks source-folder-based, e.g. `my_project_context_part01of03.md`, and do not split file bodies across chunks
- keep `copy-folder --format md`, `--format txt`, and `--format both` honoring the requested output type; when both is selected, keep markdown and text files in separate run subfolders
- keep literal directory-copy generated/cache directory omission enabled by default with the `common` preset, and preserve the TUI/CLI option to switch presets or copy generated dirs
- keep `Export Literal Folder Copy` as the first TUI command and `View Latest Runs` as the second TUI command unless product direction changes explicitly
- keep the latest-runs panel browsable with Up/Down and openable with Enter or `o`

## Safety Notes

- keep communication and portal workflows read-only
- keep the preserved Instagram audit fallback review-only unless explicitly expanded in a later milestone
- preserve logging and output manifests
- respect `allowedDirectories`
- redact `.env`-style secrets, credentials, tokens, emails, usernames, private keys, and connection strings by default before writing outputs, manifests, logs, or TUI previews

## Output Contract

Every workflow should continue writing to:

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
```

With:

- `context.md` / `context.txt` for standard compile workflows
- `{source_folder}_context.md` / `{source_folder}_context.txt` for literal directory-copy workflows
- `logs/run.log`
- `artifacts/`
- `manifests/`

Generated run artifacts under `output/runs/` must stay ignored by git.
