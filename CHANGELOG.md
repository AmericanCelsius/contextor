# Changelog

This is the lightweight development log for Contextor.

It is meant to be a fast reference for what changed across the major build iterations, starting from the first usable baseline created in this project run.

## Current UI Pass

- Added first-class offline mode through `contextor offline`, `contextor tui --offline`, and `contextor start/launch --offline`.
- Added an Offline Mode command-grid entry so local-only operation is reachable inside the TUI.
- Disabled browser diagnostics and browser workflows cleanly while offline mode is active.
- Added default key-aware redaction for `.env`-style secrets, tokens, credentials, usernames, emails, private keys, and connection strings before local outputs are written.
- Changed literal directory-copy output names to `{source_folder}_context.md` and `{source_folder}_context.txt`.
- Added interactive post-copy confirmation to open the exact generated run folder.
- Added explicit generated-run ignore rules for `output/runs/**`.
- Added best-effort `--fullscreen` launch support without making fullscreen automatic.
- Renamed the two folder-oriented TUI actions so they are visually and semantically easier to distinguish.
- Tightened dashboard resizing so the terminal layout collapses sooner on mid-sized screens and short terminals.
- Refreshed the startup animation and added a small retro Contextor status badge in the live dashboard header.
- Raised the visual contrast of the local time, UTC time, and approximate location telemetry in the footer.

## v0.2.2

### Product direction
- Kept the terminal TUI as the main interface.
- Added a separate native literal directory-copy workflow rather than overloading the folder summarizer.
- Began shifting the main dashboard away from the Instagram-specific audit panel toward a broader prompt-console direction.

### Added
- `copy-folder` workflow for recursive literal directory export into aggregated markdown/text outputs.
- TUI action for `Export Literal Folder Copy`.
- Prompt Console scaffold for future arbitrary connector-backed or agentic task entry.
- Browser intel improvements showing filtered noisy targets and detected local Chrome profiles.
- Runtime sink for TUI warnings and stderr so log noise is captured in a runtime log instead of polluting the active terminal.

### Improved
- Browser diagnostics for Chrome/CDP attach reliability.
- Filtering of noisy Google/ads targets from the browser target pool.
- Main progress presentation inside the TUI with larger, more prominent compilation feedback.
- TUI naming so `Summarize Folder Context` and `Export Literal Folder Copy` are easier to tell apart.
- Full-screen and mid-sized terminal layout behavior with more adaptive panel sizing.
- Startup and idle-state retro animation treatment.
- README and operator docs to better describe what Contextor is and where it is heading.

### Fixed
- TUI startup regression caused by legacy `output/.contextor-gui` existing as a file instead of a directory.
- Wrong or weak browser-status visibility around attach failures and local profiles.
- Main TUI/dashboard path for Instagram audit decommissioning prep without deleting the fallback logic.

## v0.2.1

### Product direction
- Polished the new TUI after the `v0.2.0` runtime swap.
- Preserved `v0.2.0` as the stable TUI baseline while improving usability, safety, and operator feedback.

### Added
- Animated startup, shutdown, validation, and run-state feedback.
- One-line bootstrap commands: `contextor launch` and `contextor start`.
- Input echo so the last command/navigation key remains visible.
- Folder-path suggestions, autocomplete, quoted-path handling, and recommended path seeds.
- Folder compile confirmation flow before execution.
- Abort flow for long-running folder and tab workflows.
- Browser-launch helper inside the TUI for separate debug Chrome profiles.
- Runtime clocks, UTC timestamps, and approximate environment/location metadata in the TUI and output files.

### Improved
- Folder compile now defaults to `all` rather than a small file cap.
- Folder compile progress reporting with counts and percentage.
- Output run naming with workflow and goal slugs: `output/runs/<timestamp>__<workflow>__<goal-slug>/`.
- TUI safety around accidental quit and accidental folder-submit cases.
- Text input behavior for path editing, cursor movement, and field clearing.

### Fixed
- Backspace/delete handling in the TUI on macOS terminals.
- Empty timestamp folders being created in the repo root.
- PDF parsing warning noise around missing `glyf` table handling.
- `.gitignore` coverage for generated output and local animation reference material.

## v0.2.0

### Product direction
- Replaced the browser-served HTML dashboard with a true terminal-contained TUI.
- Promoted the TUI to the primary interactive surface for Contextor.

### Added
- Ink-based terminal dashboard with:
  - command grid
  - mission control panel
  - browser intel panel
  - logs, recent runs, and config views
- `contextor tui` / `contextor dashboard`
- Browser attach diagnostics surfaced directly in the terminal UI.

### Improved
- Separation between CLI workflows, core orchestration, and the interactive UI layer.
- CDP/browser attach failure messaging so open-tab workflows are more debuggable.
- TUI-first docs and usage guidance.

### Deprecated or removed
- Browser-first HTML dashboard as the main interface.
- `contextor gui` retained only as a deprecated alias to the TUI.

## v0.1.0

### Initial usable baseline
- Established the first working Contextor architecture.
- Added the initial CLI.
- Added the first local dashboard implementation.
- Added browser workflows for:
  - compiling open tabs
  - exporting the current page
  - LinkedIn expansion/export
- Added filesystem compilation for local folders.
- Added timestamped run outputs with logs, artifacts, and manifests.
- Added initial read-only Instagram audit capability.
- Added setup and operator docs:
  - `README.md`
  - `docs/QUICKSTART.md`
  - `AGENTS.md`

## Notes

- `v0.2.0` is the baseline TUI architecture milestone.
- `v0.2.1` is the TUI polish and operator-feedback milestone.
- `v0.2.2` adds literal directory copy plus the next dashboard direction shift toward a more general prompt console.
- Legacy workflows may still exist in the codebase even when removed from the main dashboard, if they are being intentionally preserved as fallbacks.
