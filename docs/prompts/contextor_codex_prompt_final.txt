# Contextor — Final VS Code Codex Prompt

You are building a real local desktop tool called Contextor.

You are working inside a fresh macOS Apple Silicon project directory named `contextor`.

Your job is to fully implement the first truly usable version of Contextor in this one run, not just scaffold it.

Contextor is a LOCAL-FIRST context aggregation and browser automation tool with:
1. a working CLI
2. a barebones local GUI dashboard
3. clear instructions files
4. real output artifacts

The build must be useful immediately after this run.

## Important local repo context

Before you start, inspect this local folder in the repo and use it as **visual inspiration** for the GUI:

- `gui-inspiration/`

It currently contains example reference images for the dashboard styling. These images are **inspiration only**, not shipped app assets. Infer the design language from them and build a GUI that is readable, usable, and practical first.

## Product name and naming

Use these naming conventions:

- Product name: Contextor
- Folder / repo / CLI name: `contextor`
- Lowercase paths and filenames where practical
- Add:
  - `README.md`
  - `AGENTS.md`
  - `docs/QUICKSTART.md`

`README.md` should be the full setup and usage guide.  
`QUICKSTART.md` should be the short version.  
`AGENTS.md` should contain concise project instructions for future Codex runs.

## Primary goals

By the end of this run, Contextor must actually support these workflows:

1. Compile currently open Chrome / Chromium tabs into a single `context.md`
2. Compile a selected local folder into a single `context.md`
3. Expand a dynamic webpage like LinkedIn and export the fully expanded page to:
   - markdown
   - text
   - PDF
4. Provide a simple local GUI dashboard to run these workflows and inspect output files
5. Produce logs and save outputs in a predictable timestamped structure

These are the highest-priority deliverables and must work by the end of this run.

## Secondary goals

After the core milestone is working, also implement and scaffold these additional capabilities:

6. Read-only browser-based context gathering from sites already open in Chrome, such as:
   - Gmail / webmail
   - Brightspace
   - Gradescope
   - EdStem
   - Discord web
   - WhatsApp Web
   - Instagram web

7. A read-only Instagram social audit workflow:
   - browse followers/following in Chrome
   - scroll lists
   - collect likely non-mutual accounts
   - heuristically filter likely companies, institutions, celebrities, and public figures
   - export a reviewable report such as:
     - `instagram_non_mutuals.md`
     - `instagram_non_mutuals.csv`

Important:
- Do NOT auto-unfollow by default
- Do NOT perform account-changing actions by default
- If you scaffold unfollow or similar account actions, they must be disabled by default and require:
  - `--dry-run` default behavior
  - explicit `--allow-account-actions`
  - explicit `--confirm`
  - preview of targets
  - clear logging

Read-only workflows are much more important than risky automation in this milestone.

## Product philosophy

Contextor is NOT a toy agent swarm and NOT a vague AutoGPT clone.

It is:
- local-first
- privacy-conscious
- workflow-driven
- practical
- easy to debug
- agentic only where useful

Use a SIMPLE ORCHESTRATOR.  
Do NOT build a sprawling multi-agent framework.

## Tech stack

Prefer this stack:

- Node.js
- TypeScript
- Playwright
- a lightweight local GUI
- markdown output
- optional small Python helper only if clearly justified for PDF or DOCX text extraction

For the GUI, prefer a very lightweight and practical approach:
- small local web dashboard
- simple React + Vite frontend if needed
- minimal backend API or direct local integration
- do NOT over-engineer a native desktop shell unless it is trivial

The GUI must be easy to run locally and should not block the CLI from being the primary automation interface.

## GUI requirements

Implement a barebones GUI that is actually accessible locally.

The GUI should:
- be runnable locally from the project
- allow the user to:
  - run “compile open tabs”
  - run “compile folder”
  - run “export current page”
  - run “instagram social audit” in read-only mode
- show:
  - recent runs
  - output file paths
  - basic logs
  - buttons to open output folders or copy paths
- include a simple settings view or config preview if feasible

The GUI is phase 1 and should be intentionally lightweight.  
Do NOT overcomplicate it.

## GUI visual style

Design the GUI in a retro arcade aesthetic inspired by Pac-Man-era cabinets and late-80s/early-90s arcade machine interfaces.

Visual direction:
- dark background
- neon accents
- playful late-20th-century arcade energy
- chunky pixel-like typography where appropriate
- high-contrast controls
- simple bold outlines
- nostalgic 8-bit / 16-bit retro arcade feel
- some light inspiration from:
  - Pac-Man-era cabinet UI
  - retro arcade menus
  - the offline dinosaur game
  - Atari 8-bit menu / utility interfaces

Important:
- keep the GUI usable first and stylized second
- do NOT let the theme harm readability
- use the aesthetic as a tasteful shell, not as visual chaos
- keep the interface clean and minimal

Suggested feel:
- retro arcade dashboard
- crisp control panels
- modest neon highlight colors
- subtle pixel-art flavor
- practical modern layout with nostalgic styling

## Browser adapter requirements

Implement a robust BrowserAdapter using Playwright that can:

- attach to an existing Chrome / Chromium session using CDP if available
- otherwise launch a dedicated Chromium automation profile
- enumerate open tabs
- process:
  - current tab
  - all tabs
  - tabs matching title / URL filters
- extract:
  - URL
  - title
  - visible text
  - cleaned HTML-to-Markdown conversion
- support dynamic content expansion
- export PDF / markdown / text

The BrowserAdapter must support repeated passes that:
- find visible controls like:
  - "…more"
  - "...more"
  - "see more"
  - "show more"
  - "expand"
  - "read more"
- click them in batches
- wait for DOM stabilization
- scroll
- repeat until no new useful content appears or a safe max is reached

Implement this in a resilient, locator-based way using Playwright best practices.

## Site strategies

Create a strategy system for site-specific handling.

At minimum include:
- generic strategy
- LinkedIn expansion strategy
- Gmail / webmail extraction strategy
- course portal extraction strategy
- Instagram follower/following extraction strategy

The LinkedIn strategy must:
- expand all visible “more” style controls
- scroll until stable
- export a full PDF
- save markdown and text too

The Instagram strategy in this milestone must be READ-ONLY by default and should:
- attach to the logged-in browser session
- detect follower/following pages if they are open
- scroll intelligently
- extract usernames / display names / hints where visible
- compare likely mutual vs non-mutual when practical
- filter likely brands / institutions / public figures heuristically
- output a reviewable report
- never unfollow by default

## Filesystem adapter requirements

Implement a FilesystemAdapter that:

- accepts an allowlisted root directory
- recursively scans the directory
- supports at minimum:
  - `.txt`
  - `.md`
  - `.pdf`
  - `.json`
  - `.csv`
- optionally `.docx` if feasible without overcomplicating phase 1

For each file gather:
- path
- name
- extension
- modified time
- size
- extracted text
- short summary
- key points

Use simple relevance scoring based on:
- recency
- filename similarity to user goal
- folder/path similarity
- keyword overlap
- duplicate suppression

Do NOT blindly dump full file contents into outputs.  
Compile high-signal context.

## Context compiler requirements

Implement a ContextCompiler that outputs:

- `context.md`
- optional `context.txt`
- optional page-export PDFs
- optional CSV / JSON manifests

Use this output structure:

```text
output/
  runs/
    <timestamp>/
      context.md
      context.txt
      logs/
      artifacts/
      manifests/
```

For example:
- `output/runs/2026-04-07T20-15-00/context.md`
- `output/runs/2026-04-07T20-15-00/artifacts/page.pdf`
- `output/runs/2026-04-07T20-15-00/manifests/sources.json`

Preferred `context.md` structure:

```md
# Task Goal
# Executive Summary
# Key Findings
# Browser Sources
## Source 1
## Source 2
# File Sources
## File 1
## File 2
# Communication / Portal Notes
# Actionable Notes for LLM
# Source Manifest
```

The compiler must:
- preserve provenance
- deduplicate repeated content
- compress low-value text
- keep output dense and useful
- avoid fluff

## Orchestration requirements

Build a single orchestrator that can:
- receive a goal string
- decide whether to use browser adapter, filesystem adapter, or both
- run a fixed and understandable workflow
- produce artifacts in `/output/runs/<timestamp>/`

Do NOT build a sprawling autonomous loop.  
Keep it controlled and debuggable.

## CLI requirements

Create a CLI named `contextor` with commands like:

- `contextor tabs`
- `contextor tabs --all`
- `contextor tabs --match "brightspace|gradescope|edstem"`
- `contextor folder "/absolute/path/to/folder"`
- `contextor compile --goal "summarize my current homework context"`
- `contextor page-export --current`
- `contextor page-export --current --mode linkedin`
- `contextor social-audit --platform instagram --mode non-mutuals`
- `contextor social-audit --platform instagram --mode non-mutuals --dry-run`
- `contextor social-audit --platform instagram --mode non-mutuals --allow-account-actions --confirm`

The first implementation must make these commands work:
- `contextor tabs --all`
- `contextor folder "<path>"`
- `contextor page-export --current --mode linkedin`

The social audit command must work in read-only audit mode.

## GUI actions

The GUI should expose buttons or forms for:
- Compile Open Tabs
- Compile Folder
- Export Current Page
- Instagram Non-Mutuals Audit
- Open Latest Output Folder
- View Latest Logs

The GUI should show:
- status of the current run
- latest output path
- recent artifacts
- any important errors

## Safety / privacy / permissions

This is local-first and privacy-conscious.

Implement these rules:

- file access restricted to configured allowlisted roots
- communication and social workflows read-only by default
- destructive or outbound actions disabled by default
- explicit flags required for any account-changing action
- redact obvious secrets / tokens where feasible
- never auto-send emails
- never auto-submit portal forms
- never auto-delete or archive anything
- never scrape password fields into output
- log all actions

## Configuration

Create:

- `config/contextor.config.json`

Support settings for:
- allowed directories
- output directory
- browser attach URL
- browser mode
- enabled strategies
- redaction settings
- social audit settings
- safety defaults
- dry-run defaults

Create a clearly documented sample config.

## Project structure

Use a clean structure like:

```text
contextor/
  package.json
  tsconfig.json
  README.md
  AGENTS.md
  docs/
    QUICKSTART.md
  .gitignore
  config/
    contextor.config.json
  src/
    core/
      orchestrator.ts
      config.ts
      logger.ts
      types.ts
      relevance.ts
      redaction.ts
    adapters/
      browserAdapter.ts
      filesystemAdapter.ts
    strategies/
      genericStrategy.ts
      linkedInStrategy.ts
      gmailStrategy.ts
      portalStrategy.ts
      instagramStrategy.ts
    compiler/
      contextCompiler.ts
      markdownRenderer.ts
    workflows/
      compileTabsWorkflow.ts
      compileFolderWorkflow.ts
      exportCurrentPageWorkflow.ts
      instagramAuditWorkflow.ts
    cli/
      index.ts
    gui/
      ... lightweight frontend and backend glue ...
    utils/
      text.ts
      files.ts
      markdown.ts
      dates.ts
  output/
  scripts/
```

If a tiny Python helper is necessary, isolate it under:
- `py/`

## Implementation order

Build in this order:

1. package.json + TypeScript setup
2. BrowserAdapter
3. FilesystemAdapter
4. ContextCompiler
5. CLI
6. LinkedIn page export workflow
7. Tabs compilation workflow
8. Folder compilation workflow
9. Barebones GUI
10. Instagram read-only audit workflow
11. README / QUICKSTART / AGENTS / sample config / polish

## Required deliverables

By the end of this run, you must:

1. Create the full project files
2. Write real code, not pseudocode
3. Install required dependencies
4. Run typecheck / build if possible
5. Run smoke tests or example commands if possible
6. Create:
   - `README.md`
   - `docs/QUICKSTART.md`
   - `AGENTS.md`
7. Include instructions for:
   - enabling Chrome remote debugging
   - attaching Contextor to existing Chrome
   - using the GUI
   - using the CLI
8. Ensure the project is immediately usable for:
   - compiling open tabs into one context.md
   - compiling a selected local folder into one context.md
   - expanding/exporting the current page to PDF/Markdown/Text
   - viewing and launching workflows from a local GUI
   - producing a read-only Instagram non-mutuals audit report

## Practical engineering rules

- Prefer shipping a working first milestone over overengineering
- Avoid unnecessary frameworks
- Use resilient Playwright locators
- Use clear logs
- Keep modules understandable
- Keep comments concise and useful
- Add TODO markers only for true phase-2 work
- If permissions or environment block a step, adapt and keep going
- Do not stop at architecture explanation
- Do not leave the repo half-scaffolded
- Implement the product

## Final execution instructions

Do the work now in this repo.

At the end, provide:
- a brief summary of what was built
- exact commands I should run first
- any permissions I must manually grant
- where outputs are saved
- which features are read-only or dry-run by default
