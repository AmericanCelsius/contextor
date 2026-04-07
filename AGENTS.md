# AGENTS.md

## Project Purpose

Contextor is a local-first context compiler and browser automation tool. The primary product surfaces are:

- CLI in `src/cli/index.ts`
- local dashboard in `src/gui/server.ts` plus `src/gui/public/`
- orchestration in `src/core/orchestrator.ts`

## Core Constraints

- Keep the orchestrator simple and deterministic
- Privacy and read-only defaults matter more than aggressive automation
- Do not add autonomous multi-agent behavior
- Do not add risky browser actions by default

## Key Workflows

- `tabs`: compile open tabs into `context.md`
- `folder`: compile a folder into `context.md`
- `page-export`: export current page to markdown, text, PDF
- `social-audit`: read-only Instagram non-mutuals audit

## Important Files

- `config/contextor.config.json`
- `src/adapters/browserAdapter.ts`
- `src/adapters/filesystemAdapter.ts`
- `src/compiler/contextCompiler.ts`
- `src/workflows/*.ts`
- `src/gui/server.ts`

## Build Commands

```bash
npm install
npm run typecheck
npm run build
```

## Browser Notes

- Existing user tabs require Chrome launched with `--remote-debugging-port=9222`
- Dedicated automation profile launch falls back to `browser.userDataDir`
- Never close the user's attached Chrome session from code

## Safety Notes

- Keep communication and portal workflows read-only
- Keep Instagram audit review-only unless the user explicitly requests a separate action implementation
- Preserve logging and output manifests
- Respect `allowedDirectories`

## Output Contract

Every workflow should continue writing to:

```text
output/runs/<timestamp>/
```

With:

- `context.md`
- `context.txt`
- `logs/run.log`
- `artifacts/`
- `manifests/`
