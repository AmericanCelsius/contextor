# Contextor

Contextor is a local-first terminal workspace for collecting, structuring, and operationalizing context.

At its core, Contextor turns scattered tabs, files, folders, pages, notes, and future connected systems into dense, reviewable output bundles that are actually useful for downstream reasoning. Today, that means browser context capture, folder compilation, page export, literal directory copy, browser diagnostics, and browser-based review workflows. Over time, the goal is for Contextor to grow into a broader **context and workflow operating layer** that can support founders, operators, and small teams as they research, triage, summarize, verify, and prepare work across many systems.

Contextor is designed to become a serious **browser-first, debuggable, terminal-native workflow machine** that can later connect to stronger agentic runtimes, coding-agent harnesses, research tools, and long-running execution layers.

---

## Table of Contents

- [Changelog](#changelog)
- [What Contextor Is](#what-contextor-is)
- [Why Contextor Exists](#why-contextor-exists)
- [Current Product State](#current-product-state)
- [What Contextor Can Do Right Now](#what-contextor-can-do-right-now)
- [Terminal UI Overview](#terminal-ui-overview)
- [Offline Mode](#offline-mode)
- [TUI Navigation and Keybinds](#tui-navigation-and-keybinds)
- [CLI Workflows](#cli-workflows)
- [Output Model](#output-model)
- [Current Architecture](#current-architecture)
- [Current Dependencies](#current-dependencies)
- [Planned Connectors and Agentic Integrations](#planned-connectors-and-agentic-integrations)
- [Where Claw Code Fits](#where-claw-code-fits)
- [Startup Use Case](#startup-use-case)
- [Deployment Model](#deployment-model)
- [Fresh macOS Start](#fresh-macos-start)
- [Roadmap](#roadmap)
- [Install and Run](#install-and-run)
- [Final Positioning](#final-positioning)

---

## Changelog

For a lightweight iteration-by-iteration development log, see [CHANGELOG.md](/Users/david/Desktop/Agents%20&%20Automation/contextor/CHANGELOG.md).

---

## What Contextor Is

Contextor should be understood as:

- a **local-first context compiler**
- a **browser-first workflow console**
- a **terminal-based operator workspace**
- a **reviewable artifact generator**
- a **future agentic integration hub**

It is meant to sit between:

- browsers
- local folders
- documents
- external research
- operator workflows
- future connected tools
- downstream LLM reasoning

The simplest useful mental model is:

> **Contextor is the operating system for context.**

Not the model itself.  
Not the browser itself.  
Not the founder.  
Not the business.  

It is the layer that helps all of those work better together.

---

## Why Contextor Exists

Most people still use LLMs by manually stuffing in:

- random copied text
- incomplete browser tabs
- half-remembered files
- messy notes
- disconnected threads
- weak prompt structure
- poorly organized research

That works sometimes, but it does not scale.

Contextor exists to solve that problem by making context collection and context packaging systematic.

Instead of relying on manual copy-paste, Contextor is built to:

- gather context across tabs, files, and pages
- preserve provenance and structure
- compress noise into signal
- create reusable context packs
- make research and execution repeatable
- improve downstream LLM performance by giving models stronger, cleaner inputs

In simple terms:

> Contextor turns “too many sources, too little structure” into “one clean operating context.”

---

## Current Product State

Contextor has already moved beyond the earlier browser-served dashboard concept.

The main interface is now a **terminal-contained TUI** built for keyboard-first use. The current product has a working command-line interface, structured run outputs, folder and page workflows, browser diagnostics, and a retro-futuristic terminal command-console presentation.

Contextor also has an explicit **offline mode** for local-only work. Offline mode does not require WiFi, API keys, online LLM services, Chrome remote debugging, or browser attach success.

This means Contextor is already useful as:

- a personal research assistant shell
- a browser workflow console
- a folder summarizer
- a page exporter
- a context pack generator
- a basis for future agentic workflow expansion

---

## What Contextor Can Do Right Now

### Browser context workflows
- compile currently open Chrome or Chromium tabs into a dense `context.md`
- capture either the current tab, all tabs, or matched tabs
- inspect browser attach health before running tab workflows
- export dynamic pages such as LinkedIn to markdown, text, and PDF
- use repeated expansion and scroll passes for dynamic page capture

### Folder and file workflows
- compile a folder into a compressed context bundle
- scan recursively through supported files
- rank files by relevance and recency
- suppress duplicate content
- create a literal directory copy as aggregated markdown and text
- export a faithful textual snapshot of a directory for downstream LLM use
- redact `.env`-style secrets, tokens, credentials, usernames, emails, and connection strings from local outputs by default

### Review and browser audit workflows
- stage future arbitrary operator prompts in the prompt console
- inspect output folders and run logs from inside the TUI
- verify configuration and browser state before launching workflows

### Supported file types
Current filesystem support includes:
- `.txt`
- `.md`
- `.pdf`
- `.json`
- `.csv`
- `.docx`

### Current strengths
- high-signal context generation
- reviewable artifacts
- reproducible outputs
- strong browser-first orientation
- dense operator workflow UX
- useful for project prep, research, and context packaging

---

## Terminal UI Overview

The TUI is the main user-facing product surface.

It is designed like a retro-futuristic local command console and is meant to feel:

- fast
- dense
- keyboard-first
- operator-friendly
- visually distinctive
- more like a command console than a web dashboard

The interface is organized into a few major regions.

### 1. Header bar
The top bar shows:
- Contextor version
- console identity/status
- browser status
- input echo / animation state

### 2. Command Grid
The left panel lists the main available actions.

This is the main action menu and currently includes entries such as:
- Export Literal Folder Copy
- View Latest Runs
- Prompt Console
- Summarize Folder Context
- Compile Open Tabs
- Export Current Page
- Launch Chrome Debug Browser
- Open Output Runs Folder
- View Latest Logs
- Offline Mode
- View Current Config Summary

### 3. Mission Control panel
The center panel explains the selected workflow and acts as the primary action/description surface.

It typically shows:
- the selected workflow name
- what the workflow does
- workflow notes
- execution hints
- what the next step is

### 4. Intel / Browser panel
The right-side panel acts as a browser status and operational intel panel.

It typically shows:
- browser attach state
- attach mode
- attach URL
- visible tabs
- issues
- suggestions
- scopes or sample contexts

### 5. Footer / keybind strip
The bottom panel acts as a live operator legend.

It shows:
- keybind hints
- active panel state
- panel or form focus
- local time and environment hints
- current session context

This layout is one of the major strengths of Contextor because it gives the project a distinct operator-console identity rather than a generic utility feel.

---

## Offline Mode

Offline mode launches Contextor as a local-only workspace. It is designed for flights, no-WiFi sessions, machines without API keys, and cases where Chrome remote debugging is not available.

Offline mode supports:
- `Summarize Folder Context`
- `Export Literal Folder Copy`
- local file scanning and path autocomplete
- markdown/text output generation
- output folder creation
- run logs and recent-run review
- config and output inspection

Offline mode disables:
- browser tab capture
- page export
- Chrome attach checks
- online/API/LLM assumptions
- legacy browser social-audit flows

Launch offline mode directly:

```bash
contextor offline
contextor tui --offline
contextor start --offline
contextor launch --offline
```

The TUI also includes an `Offline Mode` command-grid entry. Use it to toggle local-only operation inside the terminal. Browser panels will report that offline mode is active instead of treating disabled browser checks as an attach failure.

Optional fullscreen startup is best-effort and off by default:

```bash
contextor start --fullscreen
contextor start --offline --fullscreen
```

On macOS this requests fullscreen with AppleScript/System Events. If the terminal or accessibility permissions block it, Contextor simply continues without fullscreen.

---

## TUI Navigation and Keybinds

The TUI is designed for keyboard-first operation.

### Primary movement
- `↑` / `↓` move through command selections
- `Enter` run the selected action or open a workflow form
- `Tab` switch inspect panels or autocomplete path fields
- `Left` / `Right` move the cursor inside active text fields
- `Ctrl+U` clear the active text field

### Focus and panel shortcuts
- `l` focus logs
- `u` focus recent runs
- `c` focus config
- `b` focus browser status
- When the runs panel is focused, `↑` / `↓` browse runs and `Enter` opens the selected run folder

### Runtime controls
- `x` open the abort prompt for active workflows
- `g` launch the Chrome debug helper
- `r` refresh
- `o` open the `output/runs` folder, or the selected run folder when the runs panel is focused

### Form and session control
- `Esc` back out of forms
- `q` open the quit confirmation prompt

### Navigation philosophy
The TUI is meant to let an operator move quickly between:
- selecting a job
- understanding the job
- validating browser state
- launching the job
- reviewing the output
- inspecting logs
- moving to the next task

That workflow matters because Contextor is not just a one-off utility. It is meant to become a reusable command center.

---

## CLI Workflows

Contextor also ships with direct CLI workflows for operators who want more explicit command execution.

### Prompt console

The TUI now includes a **Prompt Console** that acts as the future-facing operator prompt box.

It currently:
- stages a mission prompt in a Claude-Code-style console surface
- lets the operator choose a rough future execution scope
- keeps execution in preview-only mode
- prepares the main dashboard for broader arbitrary agent tasks later

It does **not** execute arbitrary browser-control or multi-step agentic tasks in `v0.2.2`.

### TUI launch
```bash
contextor tui
contextor dashboard
contextor offline
contextor launch
contextor start
contextor start --offline
contextor launch --offline
```

### Browser diagnostics
```bash
contextor browser-status
```

### Tabs
```bash
contextor tabs --all --goal "summarize my current browser context"
contextor tabs --current
contextor tabs --match "brightspace|gradescope|edstem"
```

### Folder compile
```bash
contextor folder "/absolute/path/to/folder" --goal "summarize this project folder"
```

### Literal directory copy
```bash
contextor copy-folder "/absolute/path/to/folder" --goal "create a literal directory copy for downstream review"
contextor copy-folder "/absolute/path/to/folder" --include-hidden
contextor copy-folder "/absolute/path/to/folder" --format md
contextor copy-folder "/absolute/path/to/folder" --format txt
contextor copy-folder "/absolute/path/to/folder" --format both
contextor copy-folder "/absolute/path/to/folder" --omit-generated-dirs common
contextor copy-folder "/absolute/path/to/folder" --include-generated-dirs
contextor copy-folder "/absolute/path/to/folder" --pdf
contextor copy-folder "/absolute/path/to/folder" --no-pdf
contextor copy-folder "/absolute/path/to/folder" --chunk-markdown --chunk-lines 10000 --chunk-bytes 8388608
```

Literal directory copy is fully offline-capable. The TUI `Requested Format` selector and CLI `--format` flag support markdown only, text only, or both. When both formats are selected, Contextor writes markdown files under `markdown/` and text files under `text/` inside the run folder.

By default, literal copy skips common generated/cache folders so uploads are cleaner and smaller. The TUI `Omit Generated Dirs` selector and CLI `--omit-generated-dirs` flag support `common`, `python`, `node`, `compiled`, and `none`. The `common` preset skips folders such as `__pycache__`, `.pytest_cache`, `node_modules`, `.next`, `.turbo`, `dist`, `build`, `target`, `tmp`, and similar generated directories. Use `--include-generated-dirs` or select `Do not omit` to copy them anyway.

Media and binary files are metadata-only in literal directory copies. Contextor lists file path, type, size, status, and notes for formats such as `svg`, `png`, `jpg`, `mp4`, `mp3`, `webm`, `m4a`, and other image/audio/video files instead of embedding raw media bytes or SVG image data.

Markdown directory-copy output is also rendered into searchable PDF by default when markdown is generated. This supports upload targets that accept PDF but reject `.md` or `.txt`, such as some Microsoft 365 Copilot and PowerPoint Copilot surfaces. Use `--no-pdf` or turn `PDF From Markdown` off in the TUI to skip this step. If no local Chromium-compatible browser is available for PDF rendering, Contextor logs a warning and keeps the markdown/text outputs.

The TUI also exposes a `Chunk Markdown` option in the `Export Literal Folder Copy` form. When enabled, Contextor writes continuation files such as `{source_folder}_context_part01of03.md` plus matching `.txt` parts when text output is selected. Chunks preserve file bodies, prefer directory/subdirectory boundaries, include the full directory listing, and record chunk paths/warnings in the manifest.

After a successful interactive CLI export, Contextor asks whether to open that run's output folder. Press `Enter`, `y`, or `yes` to open it; pass `--no-open-output-prompt` to skip the prompt.

### Page export
```bash
contextor page-export --current --mode linkedin --goal "export this LinkedIn page"
```

### Social audit fallback
```bash
contextor social-audit --platform instagram --mode non-mutuals --dry-run
```

This logic is preserved as a legacy CLI fallback, but the Instagram audit has been removed from the main TUI command grid while the broader prompt console path is prepared.

These workflows make Contextor useful both as:
- a terminal application
- a scriptable tool
- a later orchestration target for agentic systems

---

## Output Model

One of Contextor’s most important design choices is that every run generates structured output.

Typical outputs include:
- `context.md`
- `context.txt`
- `{source_folder}_context.md` and `{source_folder}_context.txt` for literal directory-copy runs
- `{source_folder}_context_part01of03.md` and matching `.txt` parts for chunked literal directory-copy runs
- `{source_folder}_context.pdf` or matching chunked PDF parts rendered from markdown directory-copy output
- `logs/run.log`
- workflow artifacts
- source manifests
- page exports
- review bundles

A typical run path looks like:

```text
output/runs/<timestamp>__<workflow>__<goal-slug>/
```

For example, copying a folder named `My Project Folder` writes:

```text
output/runs/<timestamp>__directory-copy__<goal-slug>/my_project_folder_context.md
output/runs/<timestamp>__directory-copy__<goal-slug>/my_project_folder_context.txt
```

Whitespace is converted to underscores, unsafe filename characters are sanitized, and generated run artifacts under `output/runs/` are ignored by git.

### Redaction defaults

Contextor redacts likely secrets before writing local file content into context bundles, literal directory-copy outputs, source manifests, TUI runtime logs, and run logs. This includes `.env`-style keys such as:

- `API_KEY`
- `TOKEN`
- `SECRET`
- `PASSWORD`
- `USER`
- `USERNAME`
- `EMAIL`
- `PRIVATE_KEY`
- `CLIENT_SECRET`
- `DATABASE_URL`
- `DB_PASSWORD`

Examples:

```text
OPENAI_API_KEY="********"
DATABASE_URL="********"
EMAIL="*******@gmail.com"
PASSWORD="********"
```

Hidden dotfiles and dot-directories are skipped by default in literal directory copy. If `--include-hidden` or the TUI `Include Hidden` option is enabled, secret-like values are still redacted before output.

This output-first design matters because it gives Contextor:

- reproducibility
- inspectability
- easy downstream reuse
- easy debugging
- clean handoff into ChatGPT and other LLMs
- operator confidence in what was actually captured

---

## Current Architecture

Contextor’s architecture is best thought of in layers.

### 1. Control layer
How the user interacts with the system:
- terminal TUI
- CLI
- future voice surface
- future remote trigger surfaces

### 2. Orchestration layer
How workflows are routed:
- browser context workflows
- folder compile workflows
- page export workflows
- startup research workflows
- future assignment and status workflows
- future scheduling and job queue logic

### 3. Tool layer
The execution primitives:
- browser automation
- file parsing
- text extraction
- HTML to Markdown conversion
- future external connectors
- future computer-use tools

### 4. Reasoning layer
How summarization and synthesis happen:
- current structured workflows
- OpenAI API integration path
- Anthropic API integration path
- future optional local-model support

### 5. Storage / artifacts layer
What Contextor writes and preserves:
- output bundles
- logs
- manifests
- page artifacts
- review packs
- future indexed memory

This layered structure is what gives Contextor room to grow into stronger agentic behavior later.

---

## Current Dependencies

The current codebase already depends on a practical set of tools that make the present product work.

### Runtime dependencies
- **commander**: CLI command parsing
- **ink** and **react**: terminal-contained TUI rendering
- **@inkjs/ui**: optional Ink-compatible UI component path
- **mammoth**: `.docx` extraction
- **pdf-parse**: PDF extraction
- **playwright-core**: browser automation backbone
- **turndown**: HTML to Markdown conversion

### Development dependencies
- **typescript**
- **tsx**
- relevant `@types/*` packages for typed development

### Effective UI stack
The broader current UI/runtime picture includes:
- **Ink** for terminal UI rendering
- custom terminal panels
- `@inkjs/ui` as an evaluated component path
- **TerminalTextEffects** as animation inspiration
- **Node.js + TypeScript** as the primary application runtime

### Why these dependencies matter
Together, these dependencies let Contextor:
- drive browsers
- parse documents
- normalize text
- render a rich terminal UI
- run as a structured CLI/TUI tool rather than a loose script pile

---

## Planned Connectors and Agentic Integrations

Contextor’s long-term direction is not to become every agent framework at once. It is to stay strong at the core while selectively preparing for more powerful orchestration and execution systems.

### Browser execution connectors
- **Playwright** as the primary browser execution layer
- **Puppeteer** as a secondary / fallback browser option

### Reasoning connectors
- **OpenAI API**
- **Anthropic API**
- future optional local-model fallback

### Research and data connectors
Potential future connector targets include:
- Gmail / webmail
- Drive / file stores
- portal connectors
- startup research pipelines
- search and enrichment layers
- note systems
- future task and reporting pipelines

### Agentic reference and integration targets
Contextor should continue tracking and learning from:
- **OpenClaw**
- **OpenManus**
- **Manus**
- **Claude Code**
- **Cline**
- **Perplexity**
- **Claw Code**

These do not all need to become hard dependencies. In many cases they are better thought of as:
- reference architectures
- execution models
- harness ideas
- orchestration inspirations
- future interoperability targets

---

## Where Claw Code Fits

Claw Code should be explicitly included in Contextor’s future development picture.

### Why it matters
Claw Code represents a useful coding-agent runtime and harness pattern. It helps frame how agent loops, command execution, CLI-native agent UX, and developer-facing task systems can be structured.

### What it is useful for
- understanding agent loop execution
- understanding tool invocation flow
- studying CLI-native agent harness behavior
- exploring how coding-agent workflows can complement context workflows

### How it fits inside Contextor’s roadmap
Claw Code is **not** the primary browser-first execution layer. It should not replace Playwright or the core context-collection engine.

Instead, it fits as:
- a future coding-agent reference
- a possible integration-adjacent developer workflow tool
- a bridge between context compilation and technical execution workflows

That gives Contextor a path to support both:
- information / research / browser workflows
- coding / implementation / technical operator workflows

---

## Startup Use Case

Contextor becomes much more important once you think of it as startup infrastructure rather than just a personal utility.

A startup lives inside information overload:
- market research
- competitor intelligence
- customer notes
- emails
- strategy docs
- product plans
- team chats
- investor notes
- research tabs
- execution threads

Contextor is meant to become the system that organizes that chaos.

### What this means in practice
Once properly connected to future agentic implementations, Contextor can support:

- market research
- competitor sweeps
- founder briefing packs
- document ingestion
- opportunity synthesis
- customer thread extraction
- recurring research summaries
- internal knowledge compression
- pre-decision operating briefs
- startup-grade context packs before product, strategy, or outreach work

This is one of the biggest reasons the project matters.

---

## Deployment Model

The recommended future deployment model is a split setup.

### MacBook
Acts as the:
- daily-driver machine
- control plane
- operator console
- review and launch surface

### Windows PC
Acts as the:
- long-running agent hub
- heavier execution node
- recurring job runner
- future remote automation host

### Cloud APIs
Act as the:
- reasoning layer
- summarization layer
- synthesis layer
- future planning and orchestration support

### Why this deployment matters
This setup gives Contextor:
- heavier automation on a dedicated machine
- cleaner recurring execution
- remote launch and review from the daily-driver machine
- a solid path toward founder/operator workflows and future startup operations

---

## Fresh macOS Start

Use this path on a new Mac or fresh clone. It does not assume the `contextor` command is already installed globally.

```bash
git clone https://github.com/AmericanCelsius/contextor.git
cd contextor
bash scripts/start-macos.sh --offline
```

That script:
- verifies macOS and an interactive terminal
- verifies Node.js `>=20` and npm
- offers a Homebrew Node install if Node is missing and Homebrew is available
- runs `npm install`
- runs `npm run build`
- launches the TUI directly with `node dist/cli/index.js tui`

Setup without launching:

```bash
bash scripts/setup-macos.sh
```

Setup and make `contextor` available globally in your shell:

```bash
bash scripts/setup-macos.sh --link
contextor start --offline
```

If `contextor start` or `contextor launch` says `command not found`, the package has not been linked yet. Use `bash scripts/start-macos.sh --offline` from the repo, or run `bash scripts/setup-macos.sh --link`.

If Enter or navigation keys do not work, launch from a real interactive terminal such as Terminal.app or iTerm2. Avoid launching the TUI from a non-interactive IDE task runner.

---

## Roadmap

Contextor’s roadmap should be understood as staged expansion rather than random feature accumulation.

### Phase 1 — Harden the core
Focus on:
- browser workflows
- folder compilation
- page export
- browser diagnostics
- TUI usability
- output quality
- better context density

### Phase 2 — Startup-grade reporting and sweeps
Focus on:
- recurring research flows
- daily or weekly summaries
- status-check workflows
- richer output bundles
- operator briefing packs

### Phase 3 — Dedicated agent hub model
Focus on:
- remote execution
- Windows-hosted long-running jobs
- MacBook control-plane workflows
- recurring job orchestration

### Phase 4 — Stronger agentic integration
Focus on:
- OpenAI / Anthropic reasoning layers
- future browser-side operator tools
- future connector-backed workflows
- agent routing and orchestration patterns
- OpenClaw / OpenManus / Manus style inspirations

### Phase 5 — Coding-agent adjacency
Focus on:
- Claw Code
- Claude Code-inspired harness patterns
- developer-facing workflow augmentation
- technical execution paired with context compilation

### Phase 6 — Broader operating layer
Focus on:
- richer startup operating intelligence
- founder dashboards
- better memory/indexing
- recurring internal intelligence workflows
- multi-surface control

---

## Install and Run

### Fresh macOS one-liner

```bash
bash scripts/start-macos.sh --offline
```

Optional fullscreen:

```bash
bash scripts/start-macos.sh --offline --fullscreen
```

### Manual install
```bash
npm install
npm run build
```

Optional:
```bash
npm link
```

### Launch the TUI
Without global linking:

```bash
node dist/cli/index.js tui
node dist/cli/index.js tui --offline
```

After `npm link`:

```bash
contextor tui
```

or

```bash
contextor start
contextor launch
```

Offline/local-only launch:

```bash
contextor offline
contextor start --offline
contextor launch --offline
```

Best-effort fullscreen launch:

```bash
contextor start --fullscreen
contextor start --offline --fullscreen
```

### Typical browser setup
Launch Chrome with remote debugging:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
```

### Common workflows
```bash
contextor browser-status
contextor tabs --all --goal "summarize my current browser context"
contextor folder "/absolute/path/to/folder" --goal "summarize this project folder"
contextor copy-folder "/absolute/path/to/folder" --goal "create a literal directory copy for downstream review"
contextor copy-folder "/absolute/path/to/folder" --include-hidden --goal "create a literal directory copy for downstream review"
contextor page-export --current --mode linkedin --goal "export this LinkedIn page"
contextor social-audit --platform instagram --mode non-mutuals --dry-run
```

---

## Final Positioning

Contextor is a serious local-first context and workflow system.

Today, it is a strong terminal tool for collecting, structuring, exporting, and reviewing context.

Tomorrow, it can become foundational infrastructure for high-context work across projects, startups, research, operations, and future businesses — especially once connected to stronger agentic implementations, browser operators, reasoning APIs, workflow schedulers, research connectors, and developer-facing execution harnesses like Claw Code where appropriate.

The right way to understand the project is:

- browser-first
- context-first
- output-first
- operator-first
- extensible toward agentic systems
- built to become a durable layer for real work
